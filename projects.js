import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";


const renderer = new THREE.WebGPURenderer({ antialias: false });
document.body.prepend(renderer.domElement);


let width = window.innerWidth;
let height = window.outerHeight;

await renderer.init();
renderer.setSize(width, height);


window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.outerHeight;

    renderer.setSize(width, height);
    aspectUniform.value = height / width;
});

// constants up here!

const epsilon = .05; // radius of source

const friction = 0.1;

const pendulumLength = 1;
const gravity = 1.0;
const chargeMass = 1;

const graphScale = 2;
const graphCenterX = -.5;
const graphCenterY = .2;
let graphCenter = TSL.uniform(TSL.vec2(graphCenterX, graphCenterY));

const lerpSpeed = 0.05;

const sources = 5;
const startAngle = 3 * Math.PI / 4;
const radius = 1;

const sourcesArray = Array.from({ length: sources }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / sources;
    return TSL.uniform(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
});



const cores = navigator.hardwareConcurrency;
const memory = navigator.deviceMemory;


console.log(cores, memory);

const debugMode = "l";

let useBloom;
let runtime;


if (cores <= 2 || memory <= 1 || debugMode == "low") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.5);
    console.log("low")
    runtime = 15;
    useBloom = false;
} else if (cores <= 4 || memory <= 2 || debugMode == "medium") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    console.log("medium");
    runtime = 30;
    useBloom = true;
} else {
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log("high")
    runtime = 60;
    useBloom = true;
}

const iterations = runtime * .7;
const timeStepSize = 8 / runtime;

let palette = [
    new THREE.Color(0x0000F6),
    new THREE.Color(0xFFFFFF),
    new THREE.Color(0x000000),
    new THREE.Color(0xFFFFFF),
    new THREE.Color(0x000000)


]

let sourcesUniform = TSL.uniformArray(sourcesArray, "vec2");

function get_closest_source(point) {
    let minDist = TSL.dot(point.sub(sourcesArray[0]), point.sub(sourcesArray[0]));
    let minIndex = TSL.float(0);

    for (let i = 1; i < sourcesArray.length; i++) {
        const diff = point.sub(sourcesArray[i]);
        const dist = TSL.dot(diff, diff);
        const isCloser = dist.lessThan(minDist);
        minDist = TSL.select(isCloser, dist, minDist);
        minIndex = TSL.select(isCloser, TSL.float(i), minIndex);
    }
    return minIndex;
}

function calc_acceleration(charge, velocity) {
    let acceleration = TSL.vec2(0, 0);
    for (let i = 0; i < sourcesArray.length; i++) {
        const diff = charge.sub(sourcesArray[i]);
        const distSquared = TSL.dot(diff, diff).add(epsilon);
        acceleration = acceleration.add(diff.div(distSquared.mul(TSL.sqrt(distSquared))));
    }
    return acceleration
        .sub(charge.mul(gravity / pendulumLength))
        .sub(velocity.mul(friction))
        .div(chargeMass);
}





const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);


const aspectUniform = TSL.uniform(height / width);

const uvNode = TSL.uv();
const x = uvNode.x.mul(graphScale).sub(graphScale / 2).add(graphCenter.x);
const y = uvNode.y.mul(aspectUniform.mul(graphScale)).sub(aspectUniform.mul(graphScale).div(2)).add(graphCenter.y);
let vel = TSL.vec2(0, 0);
let points = TSL.vec2(x, y);


const simulate = TSL.Fn(() => {
    let acceleration = calc_acceleration(points, vel);


    let newVel = vel.add(acceleration.mul(timeStepSize));
    let newPoints = points.add(newVel.add(vel).div(2).mul(timeStepSize));
    let newAccel = calc_acceleration(newPoints, newVel);


    let prevPoints = points.toVar();
    let prevVel = vel.toVar();
    let prevAccel = acceleration.toVar();

    points = newPoints.toVar();
    vel = newVel.toVar();
    acceleration = newAccel.toVar();

    TSL.Loop(iterations, () => {
        const halfVel = vel.add(acceleration.mul(timeStepSize * 0.5)).toVar();
        newPoints = points.add(halfVel.mul(timeStepSize)).toVar();
        newAccel = calc_acceleration(newPoints, halfVel).toVar();
        newVel = halfVel.add(newAccel.mul(timeStepSize * 0.5)).toVar();

        points.assign(newPoints);
        vel.assign(newVel);
        acceleration.assign(newAccel);

        points.assign(newPoints);
        vel.assign(newVel);
        acceleration.assign(newAccel);

    });
    return points;
});
const simulatedPoints = simulate();


// palette = [
//     new THREE.Color(0x0E0210),
//     new THREE.Color(0x36073D),
//     new THREE.Color(0x450e7b),
//     new THREE.Color(0x310d8a),
//     new THREE.Color(0x7e0e4d),
//     new THREE.Color(0xb80f1f),
//     new THREE.Color(0xd69318),
//     new THREE.Color(0xdfcf21),
//     new THREE.Color(0x80a49c),
//     new THREE.Color(0xd5d5d5),
// ].reverse();



const mindists = get_closest_source(simulatedPoints);

let color = TSL.vec3(0, 0, 0);

// color = color.add(
// TSL.select(mindists.greaterThan(3),new THREE.Color(0xd5d5d5),
// TSL.select(mindists.greaterThan(2),new THREE.Color(0x80a49c),
// TSL.select(mindists.greaterThan(1.5),new THREE.Color(0x80a49c),
// TSL.select(mindists.greaterThan(1.25),new THREE.Color(0xdfcf21),
// TSL.select(mindists.greaterThan(1),new THREE.Color(0xd69318),
// TSL.select(mindists.greaterThan(0.8),new THREE.Color(0xb80f1f),
// TSL.select(mindists.greaterThan(0.6),new THREE.Color(0x7e0e4d),
// TSL.select(mindists.greaterThan(.4),new THREE.Color(0x310d8a),
// TSL.select(mindists.greaterThan(.2),new THREE.Color(0x450e7b),
// TSL.select(mindists.greaterThan(.1),new THREE.Color(0x36073D),
// TSL.vec3(0, 0, 0)
// )))))))))));

palette.forEach((c, i) => {
    const match = mindists.equal(TSL.float(i));
    color = color.add(TSL.select(match, TSL.vec3(c.r, c.g, c.b), TSL.vec3(0, 0, 0)));
});


const colorNode = color;

const material = new THREE.MeshBasicNodeMaterial({ colorNode });
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const pipeline = new THREE.RenderPipeline(renderer);

const scenePass = pass(scene, camera);
const bloomPass = bloom(scenePass, 0.05, .5, 0.01);

pipeline.outputNode = useBloom
    ? scenePass.add(bloomPass)
    : scenePass;



const timer = new THREE.Timer();

let firstFrame = true;


const mouseTarget = { x: sourcesArray[0].value.x, y: sourcesArray[0].value.y };

function animate() {
    timer.update();

    sourcesArray[0].value.x += (mouseTarget.x - sourcesArray[0].value.x) * lerpSpeed;
    sourcesArray[0].value.y += (mouseTarget.y - sourcesArray[0].value.y) * lerpSpeed;
    // console.log(sourcesArray[0].value.x, sourcesArray[0].value.y);
    pipeline.render();
    if (firstFrame) {
        firstFrame = false;
        sourcesArray[0].value.x = -.85
        sourcesArray[0].value.y = .7
        mouseTarget.x = -0.768;
        mouseTarget.y = 0.670;
        document.getElementById("loading").style.display = "none";
    }
}

const isCoarse = window.matchMedia('(pointer: coarse)').matches;
if (!isCoarse) {
    window.addEventListener("mousemove", (event) => {
        mouseTarget.x = (event.clientX / width) * graphScale - graphScale / 2 + graphCenterX;
        mouseTarget.y = -((event.clientY / height) * graphScale * aspectUniform.value - (graphScale * aspectUniform.value) / 2) + graphCenterY;
    });
}

renderer.setAnimationLoop(animate);