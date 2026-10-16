import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const viewer = document.getElementById('watch-hero-viewer');
const canvas = document.getElementById('watch-hero-canvas');
const status = document.getElementById('watch-hero-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0, 6);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const environmentGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = environmentGenerator.fromScene(new RoomEnvironment(renderer)).texture;
environmentGenerator.dispose();

const key = new THREE.DirectionalLight(0xffd39a, 5);
key.position.set(-3, 4, 5);
scene.add(key);
const edge = new THREE.DirectionalLight(0xffbb65, 5);
edge.position.set(3, 1, -3);
scene.add(edge);
const soft = new THREE.DirectionalLight(0xb4c3cf, 1.8);
soft.position.set(2, -3, 4);
scene.add(soft);

const watchPivot = new THREE.Group();
watchPivot.rotation.set(-0.13, 4.9, 0.07);
scene.add(watchPivot);
let centeredWatch = null;
function fitWatch() {
  if (!centeredWatch) return;
  const targetSize = viewer.clientWidth < 700 ? 0.8 : 1.6;
  centeredWatch.scale.setScalar(targetSize / centeredWatch.userData.originalSize);
}
const modelUrls = [
  'https://propanda32.github.io/3d-watch-experience/Models/movado_gold_watch__photorealistic_3d_model.glb',
  'https://raw.githubusercontent.com/ProPanda32/3d-watch-experience/main/Models/movado_gold_watch__photorealistic_3d_model.glb'
];
const loader = new GLTFLoader();
function loadWatch(index = 0) {
  loader.load(modelUrls[index], gltf => {
    const watch = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(watch);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(largest) || largest <= 0) {
      status.textContent = 'The watch model has no visible geometry.';
      return;
    }
    const centered = new THREE.Group();
    watch.position.sub(center);
    centered.add(watch);
    centered.userData.originalSize = largest;
    centeredWatch = centered;
    fitWatch();
    watchPivot.add(centered);
    status.remove();
  }, undefined, error => {
    console.error('Could not load the Movado GLB:', error);
    if (index + 1 < modelUrls.length) loadWatch(index + 1);
    else status.textContent = 'The interactive watch could not be loaded.';
  });
}
loadWatch();

let dragging = false;
let lastX = 0, lastY = 0, velocityX = 0, velocityY = 0;
viewer.addEventListener('pointerdown', event => {
  if (event.target !== canvas) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  velocityX = velocityY = 0;
  viewer.setPointerCapture(event.pointerId);
});
viewer.addEventListener('pointermove', event => {
  if (!dragging) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  watchPivot.rotation.y += dx * 0.007;
  watchPivot.rotation.x = THREE.MathUtils.clamp(watchPivot.rotation.x + dy * 0.005, -0.75, 0.75);
  velocityX = dx * 0.00065;
  velocityY = dy * 0.00045;
  lastX = event.clientX;
  lastY = event.clientY;
});
function release() { dragging = false; }
viewer.addEventListener('pointerup', release);
viewer.addEventListener('pointercancel', release);
viewer.addEventListener('lostpointercapture', release);

function resize() {
  const width = viewer.clientWidth, height = viewer.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = width < 700 ? 7.2 : 6;
  camera.updateProjectionMatrix();
  fitWatch();
}
new ResizeObserver(resize).observe(viewer);
resize();
const clock = new THREE.Clock();
let visible = true;
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(viewer);
}
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (visible && !document.hidden) {
    if (!dragging) {
      watchPivot.rotation.y += velocityX + (reducedMotion ? 0 : 0.12 * dt);
      watchPivot.rotation.x = THREE.MathUtils.clamp(watchPivot.rotation.x + velocityY, -0.75, 0.75);
      const decay = Math.exp(-3.5 * dt);
      velocityX *= decay;
      velocityY *= decay;
      watchPivot.rotation.x += (-0.13 - watchPivot.rotation.x) * (1 - Math.exp(-0.45 * dt));
    }
    renderer.render(scene, camera);
  }
}
animate();
