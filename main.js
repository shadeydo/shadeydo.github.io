import * as THREE from 'three';
import * as TSL from 'three/tsl';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';


const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("background").appendChild(renderer.domElement);
await renderer.init();
renderer.setPixelRatio(window.devicePixelRatio)


const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

let graphScale = TSL.uniform(window.innerWidth/window.innerHeight); /// number of coordinate points visible on screen
const graphCenterX = 0.3892857142857143;
const graphCenterY = -0.403505291005291;
let graphCenter = TSL.uniform(TSL.vec2(graphCenterX, graphCenterY));

const uvNode = TSL.uv();

const aspectUniform = TSL.uniform(window.innerHeight / window.innerWidth);

const x = uvNode.x.mul(graphScale).sub(graphScale.div(2)).add(graphCenter.x);
const i = uvNode.y.mul(aspectUniform.mul(graphScale)).sub(aspectUniform.mul(graphScale).div(2)).add(graphCenter.y);
const coordinates = TSL.vec2(x,i)

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    aspectUniform.value = window.innerHeight / window.innerWidth;
    //graphScale.value = window.innerWidth/window.innerHeight*1.5;
});

// const roots = [
//   TSL.uniform(new THREE.Vector2(1.4919137466307277, -0.18598382749326148)),
//   TSL.uniform(new THREE.Vector2(-1.8090169943749473, 0.5877852522924732)),
//   TSL.uniform(new THREE.Vector2(-1.8090169943749476, -0.587785252292473)),
//   TSL.uniform(new THREE.Vector2(1.30901699437494723, -0.9510565162951536)),
//   TSL.uniform(new THREE.Vector2(1, 0))
// ];

const radius = .5;
const startAngle = 7*Math.PI/4;
const numRoots = 10;

const roots = Array.from({ length: numRoots }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / numRoots;
    return TSL.uniform(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
});

// console.log(roots.map(r => r.value));

const mouseTarget = { x: roots[0].value.x, y: roots[0].value.y };

window.addEventListener('mousemove', (event) => {
    mouseTarget.x = ((event.clientX / window.innerWidth) * graphScale.value - graphScale.value / 2 + graphCenterX);
    mouseTarget.y = -((event.clientY / window.innerHeight) * graphScale.value * aspectUniform.value - (graphScale.value * aspectUniform.value) / 2) + graphCenterY;
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
function cSum(z1,z2) {
  const a = z1.x;
  const b = z1.y;
  const c = z2.x;
  const d = z2.y;
  return TSL.vec2(a.add(c),b.add(d));
}
function cSubtract(z1,z2) {
  const a = z1.x;
  const b = z1.y;
  const c = z2.x;
  const d = z2.y;
  return TSL.vec2(a.sub(c),b.sub(d));
}

function computeF(z) {
    let result = TSL.vec2(1, 0);
    for (const root of roots) {
        result = cMultiply(result, cSubtract(z,root));
    }
    return result;
};

function computeFDerivative(z) {
    const h = TSL.vec2(0.001, 0); // super small number so derivative can use limit definition
    return cDivide(cSubtract(computeF(cSum(z, h)), computeF(z)),h); // (f(z+h)-f(z)) / h
}

const iterations = 20;


const circleRadius = 0.05;
const convergenceThreshold = 0.01;

let zCheck = coordinates;
let steps = TSL.float(0);

for (let i = 0; i < iterations; i++) {
    zCheck = cSubtract(zCheck, cDivide(computeF(zCheck), computeFDerivative(zCheck)));
    
    // check if we've converged to any root
    let converged = TSL.bool(false);
    for (const root of roots) {
        converged = converged.or(cSubtract(zCheck, root).length().lessThan(convergenceThreshold));
    }
    steps = TSL.select(converged.and(steps.equal(0)), TSL.float(i + 1), steps);
}

// normalize to 0-1 and map to color
const t = steps.div(iterations);

const palette = [
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

let color = TSL.vec3(0, 0, 0);
palette.forEach((c, i) => {
    const match = steps.equal(TSL.float(i + 1));
    color = color.add(TSL.select(match, TSL.vec3(c.r, c.g, c.b), TSL.vec3(0, 0, 0)));
});

const colorNode = TSL.vec4(color, TSL.float(1));


const material = new THREE.MeshBasicNodeMaterial({ colorNode });

const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// const bloomPass = bloom(scenePass, 0, 0, 0);

const pipeline = new THREE.RenderPipeline(renderer);
pipeline.outputNode = pass(scene,camera).add(bloom(pass(scene, camera), .2, 1, .6));


const lerpSpeed = 0.1;

function animate() {
    roots[0].value.x += (mouseTarget.x - roots[0].value.x) * lerpSpeed;
    roots[0].value.y += (mouseTarget.y - roots[0].value.y) * lerpSpeed;
    pipeline.render();
}
renderer.setAnimationLoop(animate);