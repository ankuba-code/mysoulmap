import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PHASE_KEYS, createSplashEngine, smoothstep, textOpacity } from "./engine";
import { loadSplashPlaces } from "./places";

const SEEN_KEY = "soulmap_splash_seen_v1";

function seenBefore() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode */
  }
}

function reducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lineText(copy, key, count) {
  const sub = String(copy?.[`${key}Sub`] || "");
  return {
    title: copy?.[`${key}Title`] || "",
    sub: sub.replace("{n}", String(count)),
  };
}

export default function Splash({ copy, onBegin }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const lineRefs = useRef([]);
  const hintRef = useRef(null);
  const ctaRef = useRef(null);
  const skipRef = useRef(null);
  const progressRef = useRef(0);
  const paintRef = useRef(() => {});
  const [places, setPlaces] = useState([]);
  const [reduced] = useState(reducedMotion);
  const [returning] = useState(seenBefore);

  useEffect(() => {
    let active = true;
    loadSplashPlaces().then((next) => {
      if (active && next.length) setPlaces(next);
    });
    return () => {
      active = false;
    };
  }, []);

  function paint(progress) {
    const last = PHASE_KEYS.length - 1;
    lineRefs.current.forEach((node, index) => {
      if (!node) return;
      const opacity = reduced ? (index === last ? 1 : 0) : textOpacity(progress, index);
      node.style.opacity = String(opacity);
      node.style.transform = `translateY(${(1 - opacity) * 12}px)`;
      node.setAttribute("aria-hidden", opacity < 0.5 ? "true" : "false");
    });
    const ctaOpacity = reduced ? 1 : smoothstep(0.92, 0.98, progress);
    if (ctaRef.current) {
      ctaRef.current.style.opacity = String(ctaOpacity);
      ctaRef.current.style.pointerEvents = ctaOpacity > 0.5 ? "auto" : "none";
      ctaRef.current.setAttribute("aria-hidden", ctaOpacity > 0.5 ? "false" : "true");
    }
    if (hintRef.current) {
      hintRef.current.hidden = reduced || progress >= 0.03;
    }
    if (skipRef.current) {
      skipRef.current.hidden = reduced || progress >= 0.9;
    }
  }

  paintRef.current = paint;

  useLayoutEffect(() => {
    paintRef.current(progressRef.current);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const engine = createSplashEngine(canvas, { places, reducedMotion: reduced });
    let frame = 0;

    function update() {
      frame = 0;
      const total = wrap.offsetHeight - window.innerHeight;
      const next = reduced || total <= 0 ? (reduced ? 1 : 0) : Math.min(1, Math.max(0, -wrap.getBoundingClientRect().top / total));
      progressRef.current = next;
      engine.setProgress(next);
      if (next > 0.97) markSeen();
      paintRef.current(next);
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
    update();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      engine.destroy();
    };
  }, [places, reduced]);

  function begin() {
    markSeen();
    onBegin?.();
  }

  const height = reduced ? "100svh" : returning ? "260vh" : "600vh";

  return (
    <section ref={wrapRef} className="splash-host" style={{ height }} aria-label="SoulMap">
      <div className="splash-stage">
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="splash-texts">
          {PHASE_KEYS.map((key, index) => {
            const line = lineText(copy, key, places.length);
            return (
              <div
                key={key}
                ref={(node) => {
                  lineRefs.current[index] = node;
                }}
                className={index === 0 ? "splash-line splash-line-first" : "splash-line"}
                aria-hidden="true"
              >
                <h2>{line.title}</h2>
                <p>{line.sub}</p>
              </div>
            );
          })}
        </div>
        <div ref={hintRef} className="splash-hint">
          {copy?.hint}
        </div>
        <div ref={ctaRef} className="splash-cta" aria-hidden="true">
          <button type="button" onClick={begin}>
            {copy?.start}
          </button>
          <small>{copy?.disclosure}</small>
        </div>
        <button ref={skipRef} type="button" className="splash-skip" onClick={begin}>
          {copy?.skip} →
        </button>
      </div>
    </section>
  );
}
