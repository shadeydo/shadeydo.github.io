import * as THREE from "three";
import * as TSL from "three/tsl";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const renderer = new THREE.WebGPURenderer({ antialias: false });
document.body.prepend(renderer.domElement);

let width = window.innerWidth;
let height = window.innerHeight;
let graphScale;
const aspectUniform = TSL.uniform(height / width);
const framesPerIteration = 3;
const useBloom = true;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
let brushRadius;
let percentFill;
const decayChance = 0;

if (isCoarse) {
    graphScale = 2;
    brushRadius = 100;
    percentFill = 1;

} else {
    graphScale = 2;
    brushRadius = 1;
    percentFill = 50;
}

await renderer.init();
renderer.setSize(width, height);

window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height);
    aspectUniform.value = height / width;
});

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const GRID_W = Math.floor(width / graphScale);
const GRID_H = Math.floor(height / graphScale);

function makeStorageTex() {
    const texture = new THREE.StorageTexture(GRID_W, GRID_H);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

const textureA = makeStorageTex();
const textureB = makeStorageTex();


const clearCompute = TSL.Fn(() => {
    const coord = TSL.ivec2(TSL.instanceIndex.mod(GRID_W), TSL.instanceIndex.div(GRID_W));
    TSL.textureStore(textureA, coord, TSL.vec4(0, 0, 0, 1)).toWriteOnly();
})().compute(GRID_W * GRID_H);

await renderer.computeAsync(clearCompute);





let pingPong = 0;
const displayTex = TSL.texture(textureA, TSL.uv().flipY());
const rawVal = displayTex.r.mul(255).round().toInt();



const cursorX = TSL.uniform(-999, 'int');
const cursorY = TSL.uniform(-999, 'int');


function makePaintCompute(targetTex) {
    return TSL.Fn(() => {
        const coord = TSL.ivec2(TSL.instanceIndex.mod(GRID_W), TSL.instanceIndex.div(GRID_W));
        const dx = coord.x.toFloat().sub(cursorX.toFloat());
        const dy = coord.y.toFloat().sub(cursorY.toFloat());
        const dist = dx.mul(dx).add(dy.mul(dy)).sqrt();
        TSL.If(dist.lessThanEqual(brushRadius), () => {
            const hash = TSL.uint(coord.x).mul(2246822519).bitXor(TSL.uint(coord.y).mul(3266489917)).bitXor(TSL.frameId.mul(1013904223)).toFloat().div(4294967295.0);
            TSL.If(hash.lessThan(percentFill / 100), () => {
                TSL.textureStore(targetTex, coord, TSL.vec4(TSL.float(1).div(255), 0, 0, 1)).toWriteOnly();
            });
        });
    })().compute(GRID_W * GRID_H);
}

const paintComputeA = makePaintCompute(textureA);
const paintComputeB = makePaintCompute(textureB);


function makeBrainCompute(readTex, writeTex) {
    return TSL.Fn(() => {
        const coord = TSL.ivec2(
            TSL.instanceIndex.mod(GRID_W),
            TSL.instanceIndex.div(GRID_W)
        );

        const getCell = (dx, dy) => {
            const nx = coord.x.add(dx).add(GRID_W).mod(GRID_W);
            const ny = coord.y.add(dy).add(GRID_H).mod(GRID_H);
            return TSL.textureLoad(readTex, TSL.ivec2(nx, ny)).r.mul(255).round().toInt();
        };

        const self = getCell(0, 0);
        const nw = getCell(-1, -1);
        const n = getCell(0, -1);
        const ne = getCell(1, -1);
        const w = getCell(-1, 0);
        const e = getCell(1, 0);
        const sw = getCell(-1, 1);
        const s = getCell(0, 1);
        const se = getCell(1, 1);

        const count = TSL.int(0).toVar();
        for (const neighbor of [nw, n, ne, w, e, sw, s, se]) {
            count.addAssign(neighbor.equal(1).select(TSL.int(1), TSL.int(0)));
        }

        const newState = TSL.int(0).toVar();
        TSL.If(self.equal(2), () => {
            newState.assign(0);
        }).ElseIf(self.equal(1), () => {
            newState.assign(2);
        }).Else(() => {
            TSL.If(count.equal(2), () => {
                newState.assign(1);
            });
        });


        const decayHash = TSL.uint(coord.x).mul(2246822519).bitXor(TSL.uint(coord.y).mul(3266489917)).bitXor(TSL.frameId.mul(1013904223)).toFloat().div(4294967295.0);
        const decayed = TSL.select(decayHash.lessThan(decayChance), TSL.int(0), newState);

        const isBorder = coord.x.equal(0)
            .or(coord.x.equal(GRID_W - 1))
            .or(coord.y.equal(0))
            .or(coord.y.equal(GRID_H - 1));

        const stored = TSL.select(isBorder, TSL.int(0), decayed).toFloat().div(255);
        TSL.textureStore(writeTex, coord, TSL.vec4(stored, 0, 0, 1)).toWriteOnly();
    })().compute(GRID_W * GRID_H);
}

const computeAtoB = makeBrainCompute(textureA, textureB);
const computeBtoA = makeBrainCompute(textureB, textureA);



const color = TSL.select(
    rawVal.equal(1), new THREE.Color(0xFFFFFF),
    TSL.select(
        rawVal.equal(2), new THREE.Color(0x00FF00),
        new THREE.Color(0x000000)
    )
);

const material = new THREE.MeshBasicNodeMaterial({ colorNode: color });
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);

const pipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
const bloomPass = bloom(scenePass, 0.1, 0.2, 0.1);
pipeline.outputNode = useBloom ? scenePass.add(bloomPass) : scenePass;

let mouseActive = false;
if (!isCoarse) {
    window.addEventListener("mousemove", (event) => {
        cursorX.value = Math.floor((event.clientX / width) * GRID_W);
        cursorY.value = Math.floor((event.clientY / height) * GRID_H);
        mouseActive = true;
    });
}
const timer = new THREE.Timer();


let frame = 0;

async function animate() {
    if (frame === 0) {
        document.getElementById("loading").style.display = "none";
    }


    if (mouseActive) {
        const paintCompute = pingPong === 0 ? paintComputeA : paintComputeB;
        await renderer.computeAsync(paintCompute);
        mouseActive = false;
    } else if (isCoarse) {
        if (mouseActive = true) {
            if (frame % 2 == 0) {
                cursorX.value = (width / graphScale) / 2;
                cursorY.value = 10;
            } else {
                cursorX.value = (width / graphScale) / 2;
                cursorY.value = (height/graphScale)-100;
            }


            if (frame < 16) {
                const paintCompute = pingPong === 0 ? paintComputeA : paintComputeB;
                await renderer.computeAsync(paintCompute);
            }

        }

        mouseActive = false;
    }


    if (frame % framesPerIteration === 0) {
        if (pingPong === 0) {
            await renderer.computeAsync(computeAtoB);
            displayTex.value = textureB;
            pingPong = 1;
        } else {
            await renderer.computeAsync(computeBtoA);
            displayTex.value = textureA;
            pingPong = 0;
        }
    }

    pipeline.render();
    frame++;
}

renderer.setAnimationLoop(animate);