const ICONS = {
  q0: ["diamond", "triangle", "circle", "wave", "square"],
  q1: ["up", "down", "eye", "arrow", "pause"],
  q2: ["spark", "triangle", "eye", "chevron", "zigzag"],
  q3: ["flame", "water", "earth", "air"],
  q4: ["circle", "triangle", "cross", "rhombus", "spiral"],
  q5: ["wave", "up", "water", "pause"],
};

const PHASE = {
  intro: { letter: "", labelKey: "phaseIntro" },
  q0: { letter: "A", labelKey: "phaseA" },
  q1: { letter: "B", labelKey: "phaseB" },
  q2: { letter: "C", labelKey: "phaseC" },
  q3: { letter: "D", labelKey: "phaseD" },
  q4: { letter: "D", labelKey: "phaseD" },
  q5: { letter: "E", labelKey: "phaseE" },
  q6: { letter: "E", labelKey: "phaseE" },
  q7: { letter: "E", labelKey: "phaseE" },
  card: { letter: "", labelKey: "phaseCard" },
};

export function iconFor(questionId, index) {
  return ICONS[questionId]?.[index] || "circle";
}

export function phaseFor(step) {
  return PHASE[step] || PHASE.intro;
}

export function choiceIcons(answers) {
  return ["q0", "q1", "q2", "q3", "q4", "q5"]
    .map((id) => (Number.isInteger(answers?.[id]) ? iconFor(id, answers[id]) : null))
    .filter(Boolean);
}

export function progressDots(step) {
  const order = ["intro", "q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "card"];
  const idx = order.indexOf(step);
  if (idx <= 0) {
    return { active: 0, doneUntil: -1 };
  }
  if (idx >= 1 && idx <= 8) {
    const active = Math.min(6, idx - 1);
    return { active, doneUntil: active - 1 };
  }
  return { active: 6, doneUntil: 5 };
}

export function Mark({ name, className = "h-3 w-3" }) {
  const line = "fill-none stroke-current";
  const common = { className: line, strokeWidth: 0.8 };
  return (
    <svg className={className} viewBox="0 0 14 14" aria-hidden="true">
      {name === "diamond" || name === "rhombus" ? <path {...common} d="M7 2 L12 7 L7 12 L2 7 Z" /> : null}
      {name === "triangle" ? <path {...common} d="M3 11 L7 3 L11 11" /> : null}
      {name === "circle" || name === "pause" ? <circle className={line} cx="7" cy="7" r="4" strokeWidth="0.8" /> : null}
      {name === "pause" ? <circle cx="7" cy="7" r="1.2" className="fill-current" /> : null}
      {name === "wave" || name === "water" ? <path {...common} d="M1 9 Q4 4 7 7 Q10 10 13 4" /> : null}
      {name === "square" || name === "earth" ? <rect {...common} x="3" y="4" width="8" height="7" rx="1" /> : null}
      {name === "up" ? <path {...common} d="M7 12 V3 M4 6 L7 3 L10 6" /> : null}
      {name === "down" || name === "chevron" ? <path {...common} d="M3 5 L7 10 L11 5" /> : null}
      {name === "eye" ? <path {...common} d="M2 7 Q7 2 12 7 Q7 12 2 7 Z" /> : null}
      {name === "arrow" ? <path {...common} d="M2 7 H11 M8 4 L11 7 L8 10" /> : null}
      {name === "spark" ? <path {...common} d="M7 2 V7 M7 10 V12" strokeLinecap="round" /> : null}
      {name === "zigzag" ? <path {...common} d="M2 8 L5 3 L12 10" /> : null}
      {name === "flame" ? <path {...common} d="M7 12 C4 9 2 7 4 4 C6 2 10 4 7 7 C10 5 11 8 7 12 Z" /> : null}
      {name === "air" ? <path {...common} d="M2 7 Q7 2 12 7 Q7 12 2 7" /> : null}
      {name === "cross" ? <path {...common} d="M7 2 V12 M2 7 H12" /> : null}
      {name === "spiral" ? <path {...common} d="M7 7 Q12 3 10 1 Q5 0 2 4 Q0 8 4 11 Q8 14 12 10" /> : null}
    </svg>
  );
}

export function SymbolCluster({ icons, size = 220 }) {
  const chip = 29;
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg className="pointer-events-none absolute inset-0 text-white/40" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="0.6" />
      </svg>
      {icons.map((name, index) => {
        const count = Math.max(icons.length, 1);
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
        const left = 50 + 34 * Math.cos(angle) - chip / 2;
        const top = 50 + 34 * Math.sin(angle) - chip / 2;
        return (
          <span
            key={`${name}-${index}`}
            className="absolute flex items-center justify-center rounded-full border border-white/40 text-white/85"
            style={{ left: `${left}%`, top: `${top}%`, width: `${chip}%`, height: `${chip}%` }}
          >
            <Mark name={name} className="h-[46%] w-[46%]" />
          </span>
        );
      })}
    </div>
  );
}
