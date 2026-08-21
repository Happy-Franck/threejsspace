/* ---------- Three.js starfield background ---------- */
/* THREE is loaded globally via the UMD script tag in index.html */

const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.0018);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  4000
);
camera.position.z = 0;

const STAR_LAYERS = [
  { count: 2600, spread: 2200, size: 1.4, color: 0xffffff, depthRange: 3000 },
  { count: 1400, spread: 1800, size: 2.4, color: 0x4fd1ff, depthRange: 2600 },
  { count: 900, spread: 1400, size: 3.2, color: 0x8f6bff, depthRange: 2000 },
];

const starGroups = STAR_LAYERS.map((layer) => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(layer.count * 3);

  for (let i = 0; i < layer.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * layer.spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * layer.spread;
    positions[i * 3 + 2] = Math.random() * -layer.depthRange;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: layer.color,
    size: layer.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, layer };
});

/* Slow ambient rotation + scroll-driven camera dolly + mouse parallax */

const scrollState = { current: 0, target: 0 };
const mouseState = { x: 0, y: 0, targetX: 0, targetY: 0 };

function getScrollProgress() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

window.addEventListener(
  "scroll",
  () => {
    scrollState.target = getScrollProgress();
  },
  { passive: true }
);

window.addEventListener("mousemove", (e) => {
  mouseState.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseState.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  scrollState.current += (scrollState.target - scrollState.current) * 0.06;
  mouseState.x += (mouseState.targetX - mouseState.x) * 0.04;
  mouseState.y += (mouseState.targetY - mouseState.y) * 0.04;

  camera.position.z = -scrollState.current * 2600;
  camera.position.x = mouseState.x * 40;
  camera.position.y = -mouseState.y * 30;
  camera.rotation.y = mouseState.x * 0.04;
  camera.rotation.x = -mouseState.y * 0.04;

  starGroups.forEach(({ points }, i) => {
    points.rotation.y = elapsed * 0.01 * (i + 1);
    points.rotation.x = elapsed * 0.004 * (i + 1);
  });

  renderer.render(scene, camera);
}

animate();

/* ---------- Scroll reveal ---------- */

const revealEls = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
);

revealEls.forEach((el) => observer.observe(el));

/* ---------- Header state on scroll ---------- */

const header = document.querySelector(".site-header");
let lastScrollY = window.scrollY;

window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    header.style.transform = y > lastScrollY && y > 120 ? "translateY(-100%)" : "translateY(0)";
    lastScrollY = y;
  },
  { passive: true }
);

/* ---------- Mobile nav burger ---------- */

const burger = document.querySelector(".nav-burger");
const mainNav = document.querySelector(".main-nav");

burger.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("is-open");
  burger.classList.toggle("is-active", isOpen);
});
