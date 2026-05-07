import * as THREE from 'three';
import * as TSL from 'three/tsl';

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// TSL shader
const graphScale = 5 /// number of coordinate points visible on screen
const graphCenterX = 0;
const graphCenterY = 0;
let graphCenter = TSL.uniform(TSL.vec2(graphCenterX, graphCenterY));

const uvNode = TSL.uv();

const aspectUniform = TSL.uniform(window.innerHeight / window.innerWidth);

const x = uvNode.x.mul(graphScale).sub(graphScale / 2).add(graphCenter.x);
const i = uvNode.y.mul(aspectUniform.mul(graphScale)).sub(aspectUniform.mul(graphScale).div(2)).add(graphCenter.y);
const coordinates = TSL.vec2(x,i)

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    aspectUniform.value = window.innerHeight / window.innerWidth;
});


const showRoots = false;

const roots = [
  TSL.uniform(new THREE.Vector2(1.4919137466307277, -0.18598382749326148)),
  TSL.uniform(new THREE.Vector2(-1.8090169943749473, 0.5877852522924732)),
  TSL.uniform(new THREE.Vector2(-1.8090169943749476, -0.587785252292473)),
  TSL.uniform(new THREE.Vector2(1.30901699437494723, -0.9510565162951536)),
  TSL.uniform(new THREE.Vector2(1, 0))
];

console.log(roots.map(root => root.value));

const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    roots[0].value.set(
        ((event.clientX / window.innerWidth) * graphScale - graphScale / 2 + graphCenterX),
        -((event.clientY / window.innerHeight) * graphScale * aspectUniform.value - (graphScale * aspectUniform.value) / 2) + graphCenterY
    );
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

const iterations = 20
let z = coordinates;

for (let i = 0; i < iterations; i++) {
    z = cSubtract(z, cDivide(computeF(z), computeFDerivative(z)));
    // zNext = z - (f(z)/f'(z))
}

function indexToColor(i, total) {
  const hue = i / total; // 0.0 to 1.0 spread evenly around the wheel
  return TSL.vec3(...hslToRgb(hue, 1.0, 0.5));
}

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}


const circleRadius = 0.05;
const convergenceThreshold = 0.01;

// rerun iterations, this time counting steps to convergence
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

// fire-like gradient: black -> dark blue -> purple -> red -> orange -> yellow -> white
const colorNode = TSL.vec4(
    TSL.mix(TSL.float(0), TSL.float(1), t.smoothstep(0.2, 0.8)),   // r
    TSL.mix(TSL.float(0), TSL.float(1), t.smoothstep(0.5, 1.0)),   // g
    TSL.mix(TSL.float(0.3), TSL.float(0), t.smoothstep(0.0, 0.5)), // b
    TSL.float(1)
);


const material = new THREE.MeshBasicNodeMaterial({ colorNode });

const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);



function animate() {
    renderer.render(scene, camera);

}
renderer.setAnimationLoop(animate);