import { useEffect, useRef } from "react";

/**
 * Drei-Punkte-Ladeanimation mit kinetischer Kraftübertragung.
 * Größe, Farbe und Tempo entsprechen dem gelieferten Spinner.
 * Rückgabe: Funktion zum Stoppen der Animation.
 */
export function createDotSpinner(canvas, opts = {}) {
  const S = opts.size ?? 32;
  const COLOR = opts.color ?? "#AFA9EC";
  const K = opts.speed ?? 0.85;

  const P = {
    r: 21,
    d: 44,
    ZD: 250,
    HF: 95,
    launch: 0.36,
    stretch: 0.24,
    land: [0.45, 0.24],
    bh: [20, 7],
    hit: 0.2,
    damp: 4.2,
    max: 0.48,
    min: -0.28,
  };

  const N = 3;
  const D0 = 0.045;
  const LW = (N - 1) * D0;
  const FL = 0.72;
  const L1 = LW + FL;
  const BH1 = 0.16;
  const BH2 = 0.1;
  const B = L1 + BH1 + BH2;
  const BACK = 14;
  const hl = P.d;

  const camY = 105;
  const camZ = -540;
  const a = Math.atan2(camY, -camZ);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const raw = (x, y, z) => {
    const dy = y - camY;
    const dz = z - camZ;
    const zc = -dy * sa + dz * ca;
    const yc = dy * ca + dz * sa;
    return [x / zc, yc / zc, zc];
  };

  const bump = (x, w) => Math.exp(-((x / w) ** 2));
  const spr = (s) => (s <= 0 ? 0 : 1 - Math.exp(-P.damp * s) * (Math.cos(11 * s) + (P.damp / 11) * Math.sin(11 * s)));

  function state(t) {
    const tau = t / K;
    const b = Math.floor(tau / B);
    const tb = tau - b * B;
    const out = [];
    for (let i = 0; i < N; i += 1) {
      let x;
      let y = 0;
      let z = 0;
      let sq = 0;
      const m0 = (i + b) % N;
      if (m0 === N - 1) {
        if (tb < LW) {
          x = hl;
          sq = P.launch * bump(tb - LW, 0.03);
        } else if (tb < L1) {
          const u = (tb - LW) / FL;
          const th = Math.PI * u;
          const k = bump(tb - LW, 0.03);
          x = -BACK / 2 + (hl + BACK / 2) * Math.cos(th);
          z = P.ZD * Math.sin(th);
          y = P.HF * 4 * u * (1 - u);
          sq = P.launch * k - P.stretch * Math.abs(1 - 2 * u) * (1 - k);
        } else {
          const s = tb - L1;
          if (s < BH1) {
            const u = s / BH1;
            x = -hl - BACK + BACK * 0.7 * u;
            y = P.bh[0] * 4 * u * (1 - u);
          } else {
            const u = (s - BH1) / BH2;
            x = -hl - BACK * 0.3 + BACK * 0.3 * u;
            y = P.bh[1] * 4 * u * (1 - u);
          }
          sq = P.land[0] * bump(s, 0.035) + P.land[1] * bump(s - BH1, 0.03) + P.hit * bump(s - BH1 - BH2, 0.03);
        }
      } else {
        const s = tb - m0 * D0;
        x = -hl + (m0 + spr(s)) * P.d;
        sq = P.hit * bump(s, 0.03);
      }
      out.push({ x, y, z, sq: Math.max(P.min, Math.min(sq, P.max)) });
    }
    return out;
  }

  const q = window.devicePixelRatio || 1;
  canvas.width = S * q;
  canvas.height = S * q;
  canvas.style.width = `${S}px`;
  canvas.style.height = `${S}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return () => {};
  }
  ctx.setTransform(q, 0, 0, q, 0, 0);

  let vmin = 1e9;
  let vmax = -1e9;
  let umin = 1e9;
  let umax = -1e9;
  const add = (x, y, z, R) => {
    const p = raw(x, y, z);
    const rr = R / p[2];
    vmin = Math.min(vmin, p[1] - rr);
    vmax = Math.max(vmax, p[1] + rr);
    umin = Math.min(umin, p[0] - rr);
    umax = Math.max(umax, p[0] + rr);
  };
  for (let k = 0; k <= 60; k += 1) {
    const th = (Math.PI * k) / 60;
    const u = k / 60;
    add(-BACK / 2 + (hl + BACK / 2) * Math.cos(th), P.r + P.HF * 4 * u * (1 - u), P.ZD * Math.sin(th), P.r * (1 + P.stretch));
  }
  add(-hl - BACK, P.r + P.bh[0], 0, P.r * (1 + P.land[0] * 0.6));
  add(hl + P.d * 0.12, P.r, 0, P.r * (1 + P.launch * 0.6));
  const pad = S / 16;
  const F = Math.min((S - 2 * pad) / (vmax - vmin), (S - 2 * pad) / (umax - umin));
  const OY = S / 2 + (F * (vmax + vmin)) / 2;
  const OX = S / 2 - (F * (umax + umin)) / 2;

  function draw(t) {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = COLOR;
    state(t)
      .map((o) => {
        const p = raw(o.x, P.r + o.y, o.z);
        return { ...o, c: [OX + F * p[0], OY - F * p[1], p[2]] };
      })
      .sort((p1, p2) => p2.c[2] - p1.c[2])
      .forEach((o) => {
        const R = (F * P.r) / o.c[2];
        const sy = 1 - o.sq;
        const sx = 1 + o.sq * 0.6;
        ctx.beginPath();
        ctx.ellipse(o.c[0], o.c[1] + R * (1 - sy), R * sx, R * sy, 0, 0, Math.PI * 2);
        ctx.fill();
      });
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) {
    draw(0);
    return () => {};
  }

  let raf;
  const t0 = performance.now();
  const loop = (now) => {
    draw((now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export default function DotSpinner({ size = 32, color = "#AFA9EC", speed = 0.85 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    return createDotSpinner(canvas, { size, color, speed });
  }, [size, color, speed]);

  return <canvas ref={canvasRef} className="shrink-0" aria-hidden="true" />;
}
