const TAU = Math.PI * 2;
const LINES = 14;

const PHASES = [
  { key: "stille", at: 0.0, color: [255, 236, 210], bg: [8, 7, 12] },
  { key: "erde", at: 0.17, color: [201, 140, 84], bg: [16, 11, 8] },
  { key: "wasser", at: 0.34, color: [64, 150, 180], bg: [6, 13, 20] },
  { key: "feuer", at: 0.51, color: [245, 150, 60], bg: [20, 9, 6] },
  { key: "luft", at: 0.68, color: [205, 215, 230], bg: [12, 14, 20] },
  { key: "aether", at: 0.84, color: [176, 136, 236], bg: [9, 6, 16] },
];

export const PHASE_KEYS = PHASES.map((phase) => phase.key);

const ELEMENT_COLORS = {
  erde: [201, 140, 84],
  wasser: [64, 150, 180],
  feuer: [245, 150, 60],
  luft: [205, 215, 230],
  aether: [176, 136, 236],
};

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function breath(t) {
  const ph = t % 10;
  const v = ph < 4 ? smoothstep(0, 1, ph / 4) : 1 - smoothstep(0, 1, (ph - 4) / 6);
  return 0.55 + 0.45 * v;
}

export function phaseInfo(p) {
  for (let i = PHASES.length - 1; i >= 0; i -= 1) {
    if (p >= PHASES[i].at) {
      const next = PHASES[i + 1];
      if (!next) {
        const span = 1 - PHASES[i].at || 1;
        return { index: i, next: i, local: (p - PHASES[i].at) / span, blend: 0 };
      }
      const local = (p - PHASES[i].at) / (next.at - PHASES[i].at);
      return { index: i, next: i + 1, local, blend: smoothstep(0.55, 1, local) };
    }
  }
  return { index: 0, next: 1, local: 0, blend: 0 };
}

export function textOpacity(p, idx) {
  const info = phaseInfo(p);
  if (info.index !== idx) return 0;
  const local = info.local;
  if (idx === PHASES.length - 1) return smoothstep(0, 0.35, local);
  const fadeIn = idx === 0 ? 1 : smoothstep(0.04, 0.2, local);
  const fadeOut = 1 - smoothstep(0.42, 0.56, local);
  return fadeIn * fadeOut;
}

export function createSplashEngine(canvas, opts = {}) {
  const ctx = canvas?.getContext?.("2d") ?? null;
  if (!ctx) {
    return { setProgress() {}, destroy() {} };
  }

  const places = opts.places && opts.places.length ? opts.places : [];
  const reduced = !!opts.reducedMotion;
  let w = 1;
  let h = 1;
  let particles = [];
  let stars = [];
  let links = [];
  let target = reduced ? 1 : 0;
  let cur = target;
  let raf = 0;
  let alive = true;
  const t0 = performance.now();
  const oa = { x: 0, y: 0, a: 0, c: null };
  const ob = { x: 0, y: 0, a: 0, c: null };

  function build() {
    const n = opts.particleCount || (window.innerWidth < 700 ? 700 : 1400);
    particles = Array.from({ length: n }, (_, i) => ({
      r1: Math.random(),
      r2: Math.random(),
      r3: Math.random(),
      r4: Math.random(),
      line: i % LINES,
      place: places.length ? i % places.length : 0,
    }));
    const seen = new Set();
    links = [];
    places.forEach((a, i) => {
      places
        .map((b, j) => ({ j, d: (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2 }))
        .filter((item) => item.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push([i, j]);
          }
        });
    });
  }

  function project(lat, lon) {
    const mapW = Math.min(w * 0.92, h * 1.9);
    const mapH = mapW * (135 / 360) * (h > w ? 1.7 : 1);
    const left = (w - mapW) / 2;
    const top = (h - mapH) / 2 + h * 0.04;
    const la = Math.max(-60, Math.min(75, lat));
    return [left + ((lon + 180) / 360) * mapW, top + ((75 - la) / 135) * mapH];
  }

  function layoutStars() {
    stars = places.map((place) => {
      const [x, y] = project(place.lat, place.lon);
      return { x, y, c: ELEMENT_COLORS[place.element] || ELEMENT_COLORS.aether };
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutStars();
    if (reduced) draw(0, true);
  }

  function shape(key, p, t, out) {
    const cx = w / 2;
    const cy = h / 2;
    out.c = null;
    switch (key) {
      case "stille": {
        const a = p.r1 * TAU + t * 0.05;
        const rad = 2 + p.r2 * p.r2 * 42 * breath(t);
        out.x = cx + Math.cos(a) * rad;
        out.y = cy + Math.sin(a) * rad;
        out.a = 0.15 + 0.55 * (1 - p.r2);
        break;
      }
      case "erde": {
        const k = p.line;
        const u = p.r1;
        const base = h * 0.32 + (k / (LINES - 1)) * h * 0.46;
        out.x = u * w;
        out.y = base + Math.sin(u * 5.5 + k * 0.9) * h * 0.03 + Math.sin(u * 15 + k * 2.1) * h * 0.008 + Math.sin(t * 0.25 + k) * 1.5;
        out.a = 0.45 + 0.25 * p.r4;
        break;
      }
      case "wasser": {
        const k = p.line;
        const u = p.r1;
        const base = h * 0.3 + (k / (LINES - 1)) * h * 0.44;
        out.x = u * w;
        out.y = base + Math.sin(u * 8 + t * 0.7 + k * 0.6) * h * 0.028 * (0.6 + k / LINES) + Math.sin(u * 21 - t * 1.1 + k) * h * 0.006;
        out.a = 0.5 + 0.3 * p.r4;
        break;
      }
      case "feuer": {
        const life = (p.r2 + t * 0.11 * (0.55 + p.r3)) % 1;
        const spread = (1 - life) * Math.min(w, h) * 0.2 + 6;
        out.x = cx + (p.r1 - 0.5) * 2 * spread * (0.4 + 0.6 * p.r4) + Math.sin(t * 2.4 + p.r4 * 12) * life * 14;
        out.y = h * 0.86 - life * h * 0.6;
        out.a = (1 - life) ** 0.9 * 0.95;
        break;
      }
      case "luft": {
        const speed = 10 + p.r3 * 28;
        out.x = ((p.r1 * (w + 60) + t * speed) % (w + 60)) - 30;
        out.y = p.r2 * h + Math.sin(t * 0.45 + p.r4 * TAU) * h * 0.04;
        out.a = 0.2 + 0.35 * p.r4;
        break;
      }
      case "aether": {
        const star = stars[p.place] || { x: cx, y: cy, c: ELEMENT_COLORS.aether };
        const a = p.r1 * TAU + t * (0.15 + p.r3 * 0.35) * (p.r4 > 0.5 ? 1 : -1);
        const rad = 1 + p.r2 ** 3 * 16;
        out.x = star.x + Math.cos(a) * rad;
        out.y = star.y + Math.sin(a) * rad;
        out.a = 0.3 + 0.7 * (1 - p.r2);
        out.c = star.c;
        break;
      }
      default:
        out.x = cx;
        out.y = cy;
        out.a = 0;
    }
  }

  function glow(x, y, r, c, a) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
    gradient.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function draw(t, still = false) {
    const info = phaseInfo(cur);
    const from = PHASES[info.index];
    const to = PHASES[info.next];
    const blend = info.blend;
    const bg = mix(from.bg, to.bg, blend);
    const last = PHASES.length - 1;
    const aetherWeight = info.index === last ? 1 : info.next === last ? blend : 0;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(${bg[0] | 0},${bg[1] | 0},${bg[2] | 0},${still ? 1 : 0.22})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    if (aetherWeight > 0.01 && links.length) {
      ctx.strokeStyle = `rgba(200,180,255,${0.12 * aetherWeight})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const [i, j] of links) {
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
      }
      ctx.stroke();
    }

    for (const particle of particles) {
      shape(from.key, particle, t, oa);
      let x = oa.x;
      let y = oa.y;
      let alpha = oa.a;
      let color = oa.c || from.color;
      if (blend > 0) {
        shape(to.key, particle, t, ob);
        x = lerp(oa.x, ob.x, blend);
        y = lerp(oa.y, ob.y, blend);
        alpha = lerp(oa.a, ob.a, blend);
        color = mix(color, ob.c || to.color, blend);
      }
      const size = 0.8 + particle.r3 * 1.4;
      ctx.fillStyle = `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha.toFixed(2)})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    if (aetherWeight > 0.01) {
      stars.forEach((star, index) => glow(star.x, star.y, 10 + Math.sin(t * 1.2 + index) * 3, star.c, 0.28 * aetherWeight));
    }
    const stillWeight = info.index === 0 ? 1 - blend : 0;
    if (stillWeight > 0.01) glow(w / 2, h / 2, 70 * breath(t), PHASES[0].color, 0.2 * stillWeight);
  }

  function frame(now) {
    if (!alive) return;
    cur += (target - cur) * 0.07;
    if (Math.abs(target - cur) < 0.0005) cur = target;
    draw((now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  }

  build();
  resize();
  window.addEventListener("resize", resize);
  if (!reduced) raf = requestAnimationFrame(frame);

  return {
    setProgress(p) {
      if (!reduced) target = Math.min(1, Math.max(0, p));
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}
