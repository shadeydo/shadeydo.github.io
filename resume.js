import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";


const renderer = new THREE.WebGPURenderer({ antialias: false });
document.body.prepend(renderer.domElement);


let width = window.innerWidth;
let height = window.innerHeight;
let graphScale = width/height*5;

await renderer.init();
renderer.setSize(width, height);


window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    graphScale = width / height * 5;
    renderer.setSize(width, height);
    aspectUniform.value = height / width;
});

// constants up here!

const epsilon = 2; // radius of source

const friction = 0.1;

const pendulumLength = .8;
const gravity = 1.0;
const chargeMass = 1;


const graphCenterX = 2;
const graphCenterY = 0;
let graphCenter = TSL.uniform(TSL.vec2(graphCenterX, graphCenterY));

const lerpSpeed = 0.01;

const sources = 5;
const startAngle = 3 * Math.PI / 4;
const radius = 1;

const sourcesArray = Array.from({ length: sources }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / sources;
    return TSL.uniform(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
});



const cores = navigator.hardwareConcurrency;
const memory = navigator.deviceMemory;


// console.log("CPU cores:",cores,"| memory:", memory);

const debugMode = "";

let useBloom;
let runtime;


if (cores <= 2 || memory <= 1 || debugMode == "low") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.5);
    console.log("resume: low")
    runtime = 15;
    useBloom = false;
} else {
    renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    console.log("resume:medium/high");
    runtime = 30;
    useBloom = true;
}

const iterations = runtime * 1;
const timeStepSize = 8 / runtime;

const palette = [
    new THREE.Color(0xDD614A),
    new THREE.Color(0x0B6E4F),
    new THREE.Color(0x120D0C),
    new THREE.Color(0x212198),
    new THREE.Color(0xC6C2B8)


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

const mindists = get_closest_source(simulatedPoints);
let color = TSL.vec3(0, 0, 0);
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
const bloomPass = bloom(scenePass, .1, .5, 0.1);

pipeline.outputNode = useBloom
    ? scenePass.add(bloomPass)
    : scenePass;
    

const timer = new THREE.Timer();

let firstFrame = true;


const mouseTarget = { x: 0, y: 0 };

const SETTLE_THRESHOLD = .000001;
let isAnimating = true;


function animate() {
    timer.update();
    const t = (timer.getElapsed());

    const xdist = mouseTarget.x - sourcesArray[0].value.x;
    const ydist = mouseTarget.y - sourcesArray[0].value.y;
    const dist = xdist * xdist + ydist * ydist;

    sourcesArray[0].value.x += xdist * lerpSpeed;
    sourcesArray[0].value.y += ydist * lerpSpeed;
    if (isCoarse) {
        mouseTarget.y = 3*Math.cos(t)/(1+(Math.sin(t)*Math.sin(t)));
        mouseTarget.x = 3*Math.sin(t)*Math.cos(t)/(1+(Math.sin(t)*Math.sin(t)));
    }
    pipeline.render();
    if (firstFrame) {
        firstFrame = false;
        sourcesArray[0].value.x = -10
        sourcesArray[0].value.y = 10
        mouseTarget.x = -1;
        mouseTarget.y = 0;

        document.getElementById("loading").style.display = "none";
    }
    if (dist < SETTLE_THRESHOLD) {
        renderer.setAnimationLoop(null); 
        isAnimating = false;
        // console.log("paused");
    }
    
}

const isCoarse = window.matchMedia('(pointer: coarse)').matches;
if (!isCoarse) {
    window.addEventListener("mousemove", (event) => {
        mouseTarget.x = (event.clientX / width) * graphScale - graphScale / 2 + graphCenterX;
        mouseTarget.y = -((event.clientY / height) * graphScale * aspectUniform.value - (graphScale * aspectUniform.value) / 2) + graphCenterY;
        if (!isAnimating) {
            isAnimating = true;
            // console.log("animating")
            renderer.setAnimationLoop(animate);
        }
    });
    
}

renderer.setAnimationLoop(animate);