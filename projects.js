import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const renderer = new THREE.WebGPURenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("background").appendChild(renderer.domElement);
await renderer.init();





const cores = navigator.hardwareConcurrency;
const memory = navigator.deviceMemory;


console.log(cores, memory);

const debugMode = "h";

let iterations;
let palette;
let useBloom;



if (cores <= 2 || memory <= 1 || debugMode == "low") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.5);
    console.log("low")
} else if (cores <= 4 || memory <= 2 || debugMode == "medium") {
    renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    console.log("medium")
} else {
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log("high")
    
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const aspectUniform = TSL.uniform(window.innerHeight / window.innerWidth);

window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    aspectUniform.value = window.innerHeight / window.innerWidth;
});

const uvNode = TSL.uv();


const material = new THREE.MeshBasicNodeMaterial();
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);

scene.add(mesh);

const pipeline = new THREE.RenderPipeline(renderer);

const isCoarse = window.matchMedia('(pointer: coarse)').matches;

const timer = new THREE.Timer();
let firstFrame = true;

function animate() {
    timer.update();
    const t = timer.getElapsed();
    
    pipeline.render();

    if (firstFrame) {
        firstFrame = false;
        document.getElementById("loading").style.display = "none";
    }


}

renderer.setAnimationLoop(animate);