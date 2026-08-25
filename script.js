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

  updateGlobe(elapsed);
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

/* ---------- Global reach globe (inspired by dataarts/webgl-globe) ---------- */

const GLOBE_RADIUS = 90;
const GLOBE_CITIES = [
  { name: "Paris", lat: 48.85, lon: 2.35 },
  { name: "New York", lat: 40.71, lon: -74.0 },
  { name: "Londres", lat: 51.51, lon: -0.13 },
  { name: "Berlin", lat: 52.52, lon: 13.4 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Dubaï", lat: 25.2, lon: 55.27 },
  { name: "Singapour", lat: 1.35, lon: 103.82 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Le Cap", lat: -33.92, lon: 18.42 },
  { name: "Toronto", lat: 43.65, lon: -79.38 },
  { name: "Milan", lat: 45.46, lon: 9.19 },
];

let globeRenderer = null;
let globeScene = null;
let globeCamera = null;
let globeGroup = null;
let globeWrap = null;
let globeVisible = false;
let globeDragging = false;
let globeAutoRotate = 0.0009;
let globePointerX = 0;
let globeRotationVelocity = 0;
const globeMarkers = [];
const globeArcTravelers = [];

function latLngToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createGlowTexture(hexColor) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, hexColor + "ff");
  gradient.addColorStop(0.4, hexColor + "aa");
  gradient.addColorStop(1, hexColor + "00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function initGlobe() {
  const globeCanvas = document.getElementById("globe-canvas");
  globeWrap = document.querySelector(".globe-wrap");
  if (!globeCanvas || !globeWrap) return;

  globeRenderer = new THREE.WebGLRenderer({ canvas: globeCanvas, antialias: true, alpha: true });
  globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  globeCamera.position.z = 260;

  globeGroup = new THREE.Group();
  globeScene.add(globeGroup);

  const coreSphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x0b1830, transparent: true, opacity: 0.9 })
  );
  globeGroup.add(coreSphere);

  const wireSphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS + 1, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x2c5470, wireframe: true, transparent: true, opacity: 0.35 })
  );
  globeGroup.add(wireSphere);

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture("#4fd1ff"),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glowSprite.scale.set(GLOBE_RADIUS * 3.1, GLOBE_RADIUS * 3.1, 1);
  globeScene.add(glowSprite);

  const markerTexture = createGlowTexture("#4fd1ff");
  const hubTexture = createGlowTexture("#8f6bff");
  const hub = GLOBE_CITIES[0];
  const hubPos = latLngToVector3(hub.lat, hub.lon, GLOBE_RADIUS + 2);

  GLOBE_CITIES.forEach((city, i) => {
    const pos = latLngToVector3(city.lat, city.lon, GLOBE_RADIUS + 2);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: i === 0 ? hubTexture : markerTexture,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const baseScale = i === 0 ? 14 : 9;
    sprite.scale.set(baseScale, baseScale, 1);
    sprite.position.copy(pos);
    sprite.userData.baseScale = baseScale;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    globeGroup.add(sprite);
    globeMarkers.push(sprite);

    if (i === 0) return;

    const mid = pos.clone().add(hubPos).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(GLOBE_RADIUS + 34);
    const curve = new THREE.QuadraticBezierCurve3(hubPos, mid, pos);
    const points = curve.getPoints(48);
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const arcMaterial = new THREE.LineBasicMaterial({
      color: 0x4fd1ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    globeGroup.add(new THREE.Line(arcGeometry, arcMaterial));

    const traveler = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: markerTexture,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    traveler.scale.set(6, 6, 1);
    globeGroup.add(traveler);
    globeArcTravelers.push({ curve, sprite: traveler, offset: Math.random() });
  });

  const resizeGlobe = () => {
    const w = globeWrap.clientWidth;
    const h = globeWrap.clientHeight;
    if (!w || !h) return;
    globeCamera.aspect = w / h;
    globeCamera.updateProjectionMatrix();
    globeRenderer.setSize(w, h, false);
  };
  resizeGlobe();
  window.addEventListener("resize", resizeGlobe);

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      globeVisible = entries[0].isIntersecting;
    },
    { threshold: 0.1 }
  );
  visibilityObserver.observe(globeWrap);

  globeWrap.addEventListener("pointerdown", (e) => {
    globeDragging = true;
    globePointerX = e.clientX;
  });
  window.addEventListener("pointerup", () => {
    globeDragging = false;
  });
  window.addEventListener("pointermove", (e) => {
    if (!globeDragging) return;
    const deltaX = e.clientX - globePointerX;
    globePointerX = e.clientX;
    globeRotationVelocity = deltaX * 0.004;
  });
}

function updateGlobe(elapsed) {
  if (!globeGroup) return;
  if (!globeVisible) return;

  if (globeDragging) {
    globeGroup.rotation.y += globeRotationVelocity;
  } else {
    globeRotationVelocity *= 0.9;
    globeGroup.rotation.y += globeAutoRotate + globeRotationVelocity;
  }

  globeMarkers.forEach((sprite) => {
    const pulse = 1 + Math.sin(elapsed * 2 + sprite.userData.phase) * 0.18;
    const s = sprite.userData.baseScale * pulse;
    sprite.scale.set(s, s, 1);
  });

  globeArcTravelers.forEach(({ curve, sprite, offset }) => {
    const t = (elapsed * 0.18 + offset) % 1;
    sprite.position.copy(curve.getPointAt(t));
    sprite.material.opacity = Math.sin(t * Math.PI) * 0.9;
  });

  globeRenderer.render(globeScene, globeCamera);
}

initGlobe();
