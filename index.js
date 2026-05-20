import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";


const renderer = new THREE.WebGPURenderer();
document.body.prepend(renderer.domElement);

let width = window.innerWidth;
let height = window.innerHeight;

await renderer.init();
renderer.setSize(width, height);


window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;

    renderer.setSize(width, height);
    aspectUniform.value = height / width;
});

const radius = .3;
const startAngle = 7 * Math.PI / 4;
const numRoots = 7;
const convergenceThreshold = 0.01;
const graphCenterX = 0.2;
const graphCenterY = -0.2;



const cores = navigator.hardwareConcurrency;
const memory = navigator.deviceMemory;


console.log("CPU cores:", cores, "| memory:", memory);

const debugMode = "h";

let iterations;
let palette;
let useBloom;



if (cores <= 2 || memory <= 1 || debugMode == "low") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.5);
    iterations = 10;
    console.log("index: low")
    useBloom = false;
    palette = [
        new THREE.Color(0x0E0210),
        new THREE.Color(0x36073D),
        new THREE.Color(0x450e7b),
        new THREE.Color(0x310d8a),
        new THREE.Color(0x7e0e4d),
        new THREE.Color(0xb80f1f),
        new THREE.Color(0xd69318),
        new THREE.Color(0xdfcf21),
        new THREE.Color(0x80a49c),
        new THREE.Color(0xd5d5d5),
    ].reverse();
} else if (cores <= 4 || memory <= 2 || debugMode == "medium") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    iterations = 15;
    console.log("index: medium");
    useBloom = true;
    palette = [
        new THREE.Color(0x0E0210),
        new THREE.Color(0x36073D),
        new THREE.Color(0x450e7b),

        new THREE.Color(0x310d8a),

        new THREE.Color(0x7e0e4d),

        new THREE.Color(0xb80f1f),
        new THREE.Color(0xcb0f0f),
        new THREE.Color(0xd69318),
        new THREE.Color(0xdbb11d),
        new THREE.Color(0xdfcf21),
        new THREE.Color(0x7f965a),
        new THREE.Color(0x80a49c),
        new THREE.Color(0x80b2dd),
        new THREE.Color(0xabc4d9),
        new THREE.Color(0xd5d5d5),
    ].reverse();
} else {
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log("index: high")
    iterations = 20;
    useBloom = true;
    palette = [
        new THREE.Color(0x0E0210),
        new THREE.Color(0xB041F),
        new THREE.Color(0x36073D),
        new THREE.Color(0x6c0d7a),
        new THREE.Color(0x450e7b),
        new THREE.Color(0x2d0c7d),
        new THREE.Color(0x310d8a),
        new THREE.Color(0x450e7b),
        new THREE.Color(0x7e0e4d),
        new THREE.Color(0xa50f2e),
        new THREE.Color(0xb80f1f),
        new THREE.Color(0xcb0f0f),
        new THREE.Color(0xd69318),
        new THREE.Color(0xdbb11d),
        new THREE.Color(0xdfcf21),
        new THREE.Color(0x7f965a),
        new THREE.Color(0x80a49c),
        new THREE.Color(0x80b2dd),
        new THREE.Color(0xabc4d9),
        new THREE.Color(0xd5d5d5),
    ].reverse();
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

let graphScale = TSL.uniform((width / height) * .5);
let graphCenter = TSL.uniform(TSL.vec2(graphCenterX, graphCenterY));
const aspectUniform = TSL.uniform(height / width);

const uvNode = TSL.uv();
const x = uvNode.x.mul(graphScale).sub(graphScale.div(2)).add(graphCenter.x);
const i = uvNode.y.mul(aspectUniform.mul(graphScale)).sub(aspectUniform.mul(graphScale).div(2)).add(graphCenter.y);
const coordinates = TSL.vec2(x, i);

const roots = Array.from({ length: numRoots }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / numRoots;
    return TSL.uniform(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
});


function cMultiply(z1, z2) {
    const a = z1.x;
    const b = z1.y;
    const c = z2.x;
    const d = z2.y;
    return TSL.vec2(
        (a.mul(c)).sub(b.mul(d)),
        (a.mul(d)).add(b.mul(c))
    ); // (ac-bd) + i(ad + bc)
}

function cDivide(z1, z2) {
    const a = z1.x;
    const b = z1.y;
    const c = z2.x;
    const d = z2.y;
    const denom = c.mul(c).add(d.mul(d));
    return TSL.vec2(
        a.mul(c).add(b.mul(d)).div(denom),
        b.mul(c).sub(a.mul(d)).div(denom)
    );
}

function cSum(z1, z2) {
    const a = z1.x;
    const b = z1.y;
    const c = z2.x;
    const d = z2.y;
    return TSL.vec2(a.add(c), b.add(d));
}

function cSubtract(z1, z2) {
    const a = z1.x;
    const b = z1.y;
    const c = z2.x;
    const d = z2.y;
    return TSL.vec2(a.sub(c), b.sub(d));
}

function computeFAndDerivative(z) {
    let f = TSL.vec2(1, 0);
    for (const root of roots) {
        f = cMultiply(f, cSubtract(z, root));
    }

    let sum = TSL.vec2(0, 0);
    for (const root of roots) {
        sum = cSum(sum, cDivide(TSL.vec2(1, 0), cSubtract(z, root)));
    }

    return { f, df: cMultiply(f, sum) };
}

let zCheck = coordinates;
let steps = TSL.float(0);

for (let i = 0; i < iterations; i++) {
    const { f, df } = computeFAndDerivative(zCheck);
    zCheck = cSubtract(zCheck, cDivide(f, df));

    let converged = TSL.bool(false);
    for (const root of roots) {
        converged = converged.or(cSubtract(zCheck, root).length().lessThan(convergenceThreshold));
    }
    steps = TSL.select(converged.and(steps.equal(0)), TSL.float(i + 1), steps);
}

const t = steps.div(iterations);

let color = TSL.vec3(0, 0, 0);
palette.forEach((c, i) => {
    const match = steps.equal(TSL.float(i + 1));
    color = color.add(TSL.select(match, TSL.vec3(c.r, c.g, c.b), TSL.vec3(0, 0, 0)));
});

const colorNode = color;

const material = new THREE.MeshBasicNodeMaterial({ colorNode });
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const pipeline = new THREE.RenderPipeline(renderer);

const scenePass = pass(scene, camera);
const bloomPass = bloom(scenePass, .1, .5, 0.1);

pipeline.outputNode = useBloom
    ? scenePass.add(bloomPass)
    : scenePass;

const lerpSpeed = 0.05;

const isCoarse = window.matchMedia('(pointer: coarse)').matches;

const mouseTarget = { x: roots[0].value.x-0.01, y: roots[0].value.y+0.01 };

let isAnimating = true;
let firstFrame = true;

const timer = new THREE.Timer();

function animate() {

    if (isCoarse) {
        let t;
        if (document.body.scrollHeight > height) {
            t = window.scrollY / 500 + 9.5;
            // console.log(document.body.scrollHeight, height)
        } else {
            timer.update();
            t = (timer.getElapsed() / 8 + 10);
            // console.log(t);
        }
        mouseTarget.y = 0.6 * Math.cos(t) / (1 + (Math.sin(t) * Math.sin(t)));
        mouseTarget.x = 0.75 * Math.sin(t) * Math.cos(t) / (1 + (Math.sin(t) * Math.sin(t)));
    }

    const xdist = mouseTarget.x - roots[0].value.x;
    const ydist = mouseTarget.y - roots[0].value.y;
    const settled = Math.abs(xdist) + Math.abs(ydist) < 0.001;

    if (firstFrame) {
        firstFrame = false;
        roots[0].value.x = mouseTarget.x + 0.01;
        roots[0].value.y = mouseTarget.y - 0.01;
        document.getElementById("loading").style.display = "none";
    }


    roots[0].value.x += xdist * lerpSpeed;
    roots[0].value.y += ydist * lerpSpeed;




    pipeline.render();

    if (settled) {
        renderer.setAnimationLoop(null);
        isAnimating = false;
        console.log("paused")
    }
}



if (isCoarse) {
    window.addEventListener('scroll', (event) => {
        if (!isAnimating) {
            isAnimating = true;
            console.log("animating")
            renderer.setAnimationLoop(animate);
        }
    });
} else {
    window.addEventListener("mousemove", (event) => {
        mouseTarget.x = (event.clientX / width) * graphScale.value - graphScale.value / 2 + graphCenterX;
        mouseTarget.y = -((event.clientY / height) * graphScale.value * aspectUniform.value - (graphScale.value * aspectUniform.value) / 2) + graphCenterY;
        if (!isAnimating) {
            isAnimating = true;
            console.log("animating")
            renderer.setAnimationLoop(animate);
        }
    });
}




renderer.setAnimationLoop(animate);