import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const renderer = new THREE.WebGPURenderer({ antialias: true });
document.body.prepend(renderer.domElement);
const isCoarse = window.matchMedia('(pointer: coarse)').matches;

const width = TSL.uniform(window.innerWidth);
const height = TSL.uniform(window.innerHeight);
if (isCoarse) {
    height.value = window.screen.height;
}

let isPaused = false;
const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", () => {
    pauseBtn.innerHTML = isPaused ? "⏸︎" : "⏵︎";
    isPaused = !isPaused;
});

await renderer.init();
renderer.setSize(width.value, height.value);

window.addEventListener("resize", () => {
    width.value = window.innerWidth;
    if (!isCoarse) {
        height.value = window.innerHeight;
    }
    renderer.setSize(width.value, height.value);

    updateCameraFrustum();

    if (!isAnimating) {
        isAnimating = true;
        renderer.setAnimationLoop(animate);
    }
});

const a = TSL.uniform(0.63);
const b = TSL.uniform(2.10);

const aMin = .45, aMax = .65;
const bMin = 1.8, bMax = 2.15;

const seedJitter = 40;
const displayScale = 115.0;
const graphPosition = TSL.vec2(0, 50);

const cores = navigator.hardwareConcurrency;
const memory = navigator.deviceMemory;

let useBloom;
let particleCount;
let totalSteps;
let opacity;

const debugMode = "";
if (cores <= 2 || memory <= 1 || debugMode == "low") {
    console.log("projects: low");
    renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    particleCount = 50_000;
    totalSteps = 50;
    useBloom = true;
    opacity = .4;
} else if (cores <= 4 || memory <= 2 || debugMode == "medium") {
    if (isCoarse) {
        console.log("projects: medium (mobile)");
        renderer.setPixelRatio(window.devicePixelRatio*0.75);
        particleCount = 100_000;
        totalSteps = 50;
        useBloom = true;
        opacity = .75;
    } else {
        console.log("projects: medium");
        renderer.setPixelRatio(window.devicePixelRatio);
        particleCount = 100_000;
        totalSteps = 50;
        useBloom = true;
        opacity = .2;
    }
} else {
    if (isCoarse) {
        console.log("projects: high (mobile)");
        renderer.setPixelRatio(window.devicePixelRatio);
        particleCount = 250_000;
        totalSteps = 50;
        useBloom = true;
        opacity = .65;
    } else {
        console.log("projects: high");
        renderer.setPixelRatio(window.devicePixelRatio * 2);
        particleCount = 500_000;
        totalSteps = 50;
        useBloom = true;
        opacity = 0.1;
    }
}

function hash11(x) {
    return TSL.fract(TSL.sin(x.mul(12.9898)).mul(43758.5453123));
}

const scene = new THREE.Scene();

const viewHeight = 60;
const camera = new THREE.OrthographicCamera(
    -viewHeight * (width.value / height.value),
    viewHeight * (width.value / height.value),
    viewHeight,
    -viewHeight,
    0.1,
    1000
);
camera.position.set(0, 30, 90);
camera.lookAt(0, 0, 0);

function updateCameraFrustum() {
    const aspect = width.value / height.value;
    camera.left = -viewHeight * aspect;
    camera.right = viewHeight * aspect;
    camera.top = viewHeight;
    camera.bottom = -viewHeight;
    camera.updateProjectionMatrix();
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3)
);
geometry.setDrawRange(0, particleCount);

const material = new THREE.PointsMaterial({ color: 0xffffff });
material.transparent = true;
material.blending = THREE.AdditiveBlending;
material.depthWrite = false;
material.opacity = opacity;
material.size = 10;

const points = new THREE.Points(geometry, material);
scene.add(points);

const particlePosition = TSL.Fn(() => {
    const id = TSL.vertexIndex.toFloat();

    const rx = hash11(id).mul(seedJitter).sub(seedJitter * 0.5);
    const ry = hash11(id.add(10.0)).mul(seedJitter).sub(seedJitter * 0.5);

    const pos = TSL.vec2(rx, ry).toVar();

    TSL.Loop(totalSteps, () => {
        const x = pos.x;
        const y = pos.y;

        const newX = TSL.sin(x.mul(x).sub(y.mul(y)).add(a));
        const newY = TSL.cos(TSL.float(2.0).mul(x).mul(y).add(b));

        pos.assign(TSL.vec2(newX, newY));
    });

    const rotated = TSL.vec2(pos.y, pos.x.negate());

    return TSL.vec3(
        rotated.x.mul(displayScale).add(graphPosition.x),
        rotated.y.mul(displayScale).add(graphPosition.y),
        0.0
    );
})();

material.positionNode = particlePosition;

const pipeline = new THREE.RenderPipeline(renderer);

const gradColor0 = new THREE.Color(0x000000);
const gradColor1 = new THREE.Color(0x5900ff);
const gradColor2 = new THREE.Color(0x00ffea);



function rgb2hsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h / 6 + 1) % 1;
    }

    return [h, max === 0 ? 0 : d / max, max];
}

const hsv0 = rgb2hsv(gradColor0.r, gradColor0.g, gradColor0.b);
const hsv1 = rgb2hsv(gradColor1.r, gradColor1.g, gradColor1.b);
const hsv2 = rgb2hsv(gradColor2.r, gradColor2.g, gradColor2.b);

const gradStop1 = 0, gradStop2 = .5;

const gradSmooth1 = Math.max(.9, 1e-4);

function hsv2rgb(c) {
    const K = TSL.vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    const p = TSL.abs(
        c.x.add(K.xyz).fract().mul(6.0).sub(K.www)
    );

    return c.z.mul(
        TSL.mix(K.xxx, TSL.clamp(p.sub(K.xxx), 0.0, 1.0), c.y)
    );
}

function mixHue(h0, h1, t) {
    const start = TSL.float(h0);
    const diff = TSL.float(h1).sub(start);
    const wrapped = diff.sub(TSL.round(diff));
    return start.add(wrapped.mul(t)).fract();
}

function gradientMap(colorNode) {
    const luma = TSL.dot(colorNode.rgb, TSL.vec3(0.2126, 0.7152, 0.0722));
    const stepEpsilon = 1e-5;
    const t1 = TSL.step(gradStop1 + stepEpsilon, luma);

    const h_a = mixHue(hsv0[0], hsv1[0], t1);
    const s_a = TSL.mix(hsv0[1], hsv1[1], t1);
    const v_a = TSL.mix(hsv0[2], hsv1[2], t1);

    const t2 = TSL.smoothstep(
        gradStop2 - gradSmooth1 * 0.5,
        gradStop2 + gradSmooth1 * 0.5,
        luma
    );
    const h_b = mixHue(h_a, hsv2[0], t2);
    const s_b = TSL.mix(s_a, hsv2[1], t2);
    const v_b = TSL.mix(v_a, hsv2[2], t2);

    const finalRgb = hsv2rgb(TSL.vec3(h_b, s_b, v_b));
    return TSL.vec4(finalRgb, colorNode.a);
}

const scenePass = pass(scene, camera);
const gradedPass = gradientMap(scenePass);

const bloomStrength = 1;
const bloomRadius = 1;
const bloomThreshold = .15;
const bloomPass = bloom(gradedPass, bloomStrength, bloomRadius, bloomThreshold);

const combined = gradedPass.add(bloomPass);
pipeline.outputNode = useBloom ? combined : gradedPass;

const paramTarget = { x: a.value, y: b.value };
const lerpSpeed = .08;

function updateParamTarget(clientX, clientY) {
    const nx = THREE.MathUtils.clamp(clientX / width.value, 0, 1);
    const ny = THREE.MathUtils.clamp(clientY / height.value, 0, 1);
    paramTarget.x = aMin + nx * (aMax - aMin);
    paramTarget.y = bMin + ny * (bMax - bMin);
}

let isAnimating = true;

if (isCoarse) {
    window.addEventListener("scroll", (event) => {

        if (!isAnimating) {
            isAnimating = true;
            // console.log("animating")
            renderer.setAnimationLoop(animate);
        }
    });

} else {
    window.addEventListener("mousemove", (event) => {
        updateParamTarget(event.clientX, event.clientY);
        if (!isAnimating) {
            isAnimating = true;
            renderer.setAnimationLoop(animate);
        }
    });
}

let firstFrame = true;
const settleThreshold = 0.00001;


async function animate() {
    if (isPaused) return;

    if (isCoarse) {
        const scrollFraction = window.scrollY / ((document.documentElement.scrollHeight - height.value) * 1);
        const t = scrollFraction * Math.PI;
        paramTarget.x = .57 + 0.15 * Math.cos(t + 1)
        paramTarget.y = 2.05 + 0.1 * Math.sin(t);

        //         const aMin = .45, aMax = .75;
        //         const bMin = 1.8, bMax = 2.3;
    }

    if (firstFrame) {
        firstFrame = false;
        a.value = paramTarget.x + 0.005;
        b.value = paramTarget.y - 0.005;
        document.getElementById("loading").style.display = "none";
    }

    const xdist = paramTarget.x - a.value;
    const ydist = paramTarget.y - b.value;
    const settled = Math.abs(xdist) + Math.abs(ydist) < settleThreshold;

    a.value += xdist * lerpSpeed;
    b.value += ydist * lerpSpeed;

    pipeline.render();

    if (settled) {
        renderer.setAnimationLoop(null);
        isAnimating = false;
    }
}

renderer.setAnimationLoop(animate);