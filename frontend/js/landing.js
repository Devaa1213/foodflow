// FOODFLOW — Cinematic scroll-driven landing page
//
// Renders the 60 provided WebP frames onto a <canvas> and maps
// scroll progress (0 -> 1) across the hero track to frame (1 -> 60).
// Frames are preloaded before playback starts; overlay text is plain
// HTML/CSS animated with Anime.js, never burned into the images.

(function () {
  const FRAME_COUNT = 60;
  const FRAME_PATH = (i) => `assets/frames/frame_${String(i).padStart(3, "0")}.webp`;

  const canvas = document.getElementById("ff-hero-canvas");
  const ctx = canvas.getContext("2d");
  const loadingEl = document.getElementById("ff-hero-loading");
  const loadingPct = document.getElementById("ff-hero-loading-pct");
  const track = document.getElementById("ff-hero-scroll-track");
  const storySections = Array.from(document.querySelectorAll(".ff-hero-story-section"));
  const finalHero = document.getElementById("ff-hero-final");
  const scrollHint = document.getElementById("ff-scroll-hint");
  const navbar = document.getElementById("ff-navbar");

  const frames = new Array(FRAME_COUNT);
  let loadedCount = 0;
  let ready = false;
  let currentFrameIndex = -1;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ready) drawFrame(currentFrameIndex === -1 ? 0 : currentFrameIndex, true);
  }

  function drawFrame(index, force = false) {
    if (!force && index === currentFrameIndex) return;
    const img = frames[index];
    if (!img) return;
    currentFrameIndex = index;

    // cover-fit the frame into the canvas
    const cw = window.innerWidth, ch = window.innerHeight;
    const iw = img.width, ih = img.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function preloadFrames() {
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
        if (loadingPct) loadingPct.textContent = `${pct}%`;
        if (loadedCount === FRAME_COUNT) onAllLoaded();
      };
      img.src = FRAME_PATH(i);
      frames[i - 1] = img;
    }
    // Safety net: never block the page forever if a frame fails.
    setTimeout(() => {
      if (!ready) onAllLoaded();
    }, 6000);
  }

  function onAllLoaded() {
    if (ready) return;
    ready = true;
    drawFrame(0, true);
    loadingEl?.classList.add("ff-hidden");
    anime({ targets: scrollHint, opacity: [0, 1], duration: 600, delay: 300 });
    requestAnimationFrame(onScroll);
  }

  // Maps a value from one range to another, clamped.
  function mapRange(v, inMin, inMax, outMin, outMax) {
    const t = Math.min(Math.max((v - inMin) / (inMax - inMin), 0), 1);
    return outMin + t * (outMax - outMin);
  }

  // Triangular opacity: fades in, holds, fades out across [start, end].
  function sectionOpacity(progress, start, end) {
    const inEnd = start + (end - start) * 0.25;
    const outStart = start + (end - start) * 0.75;
    if (progress < start || progress > end) return 0;
    if (progress < inEnd) return mapRange(progress, start, inEnd, 0, 1);
    if (progress > outStart) return mapRange(progress, outStart, end, 1, 0);
    return 1;
  }

  const STORY_RANGES = [
    [0.04, 0.19],
    [0.21, 0.36],
    [0.38, 0.53],
    [0.55, 0.7],
  ];
  const FINAL_RANGE = [0.76, 1.0];

  let ticking = false;
  function onScroll() {
    ticking = false;
    if (!ready) return;

    const rect = track.getBoundingClientRect();
    const trackTop = window.scrollY + rect.top;
    const scrollableDist = track.offsetHeight - window.innerHeight;
    const progress = mapRange(window.scrollY, trackTop, trackTop + scrollableDist, 0, 1);

    const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(progress * (FRAME_COUNT - 1))));
    drawFrame(frameIndex);

    storySections.forEach((el, i) => {
      const [s, e] = STORY_RANGES[i];
      const op = sectionOpacity(progress, s, e);
      el.style.opacity = op;
      el.style.transform = `translateY(${(1 - op) * 14}px)`;
    });

    if (finalHero) {
      const op = mapRange(progress, FINAL_RANGE[0], FINAL_RANGE[1], 0, 1);
      finalHero.style.opacity = op;
      finalHero.style.transform = `scale(${0.97 + op * 0.03})`;
    }

    if (scrollHint) {
      scrollHint.style.opacity = progress < 0.03 ? 1 : mapRange(progress, 0.03, 0.1, 1, 0);
    }

    // Navbar background state
    navbar?.classList.toggle("ff-scrolled", window.scrollY > 40);
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  preloadFrames();

  // --- Subtle Three.js atmospheric particles (floating route nodes) ---
  function initParticles() {
    const container = document.getElementById("ff-hero-particles");
    if (!container || typeof THREE === "undefined") return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const count = window.innerWidth < 720 ? 22 : 45;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf4e3d3,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    function animate() {
      requestAnimationFrame(animate);
      points.rotation.y += 0.0006;
      points.rotation.x += 0.0002;
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  initParticles();

  // --- Mobile nav toggle ---
  document.getElementById("ff-navbar-toggle")?.addEventListener("click", () => {
    document.querySelector(".ff-navbar-links")?.classList.toggle("ff-open");
  });

  // Reveal on-scroll animations for below-the-fold sections
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof ffObserveReveal === "function") {
      ffObserveReveal(".ff-step, .ff-feature-card, .ff-restaurant-preview");
    }
  });
})();
