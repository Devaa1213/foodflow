// FOODFLOW — Shared Anime.js helpers

function ffAnimateCounter(el, target, opts = {}) {
  const obj = { val: 0 };
  anime({
    targets: obj,
    val: target,
    duration: opts.duration || 900,
    easing: "easeOutExpo",
    round: 1,
    update: () => {
      el.textContent = (opts.prefix || "") + obj.val + (opts.suffix || "");
    },
  });
}

function ffFadeInUp(targets, opts = {}) {
  anime({
    targets,
    opacity: [0, 1],
    translateY: [16, 0],
    duration: opts.duration || 500,
    delay: anime.stagger(opts.stagger || 60),
    easing: "easeOutQuad",
  });
}

function ffPulse(el) {
  anime({ targets: el, scale: [1, 1.06, 1], duration: 380, easing: "easeOutQuad" });
}

// Observe elements and fade them in the first time they enter the viewport.
function ffObserveReveal(selector) {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          ffFadeInUp(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  els.forEach((el) => {
    el.style.opacity = 0;
    io.observe(el);
  });
}
