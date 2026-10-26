const CARDS = {
  de: [
    {
      name: "Kreisende Stille",
      symbol: "Kreis",
      ton: "Wartend",
      impuls: "Kreisen",
      desc: "Du bist in einer Phase des bewussten Verweilens. Die Welt dreht sich — du stehst im Zentrum und schaust zu. Diese Karte ruft Orte, die in sich selbst ruhen.",
    },
    {
      name: "Aufsteigendes Feuer",
      symbol: "Dreieck",
      ton: "Expansiv",
      impuls: "Aufstieg",
      desc: "In dir brennt etwas, das hinauswill. Diese Karte zeigt nach oben — sie ruft Orte, die erheben, weiten, den Horizont öffnen.",
    },
    {
      name: "Überquerung",
      symbol: "Kreuz",
      ton: "Suchend",
      impuls: "Überqueren",
      desc: "Du stehst an einer Schwelle. Nicht davor, nicht dahinter — mittendrin. Diese Karte ruft Brücken, Pässe, Schluchten.",
    },
    {
      name: "Erdende Tiefe",
      symbol: "Raute",
      ton: "Ruhend",
      impuls: "Innehalten",
      desc: "Du brauchst keine Bewegung — du brauchst Verwurzelung. Diese Karte zeigt nach unten, in die Erde, in die Stille.",
    },
    {
      name: "Absteigende Tiefe",
      symbol: "Spirale",
      ton: "Verwandelnd",
      impuls: "Abstieg",
      desc: "Etwas in dir will in die Tiefe. Nicht sinken — tauchen. Bewusst, neugierig, verwandlungswillig.",
    },
  ],
  en: [
    {
      name: "Circling stillness",
      symbol: "Circle",
      ton: "Waiting",
      impuls: "Circling",
      desc: "You are in a phase of conscious lingering. The world turns — you stand at the center and watch. This card calls places that rest in themselves.",
    },
    {
      name: "Rising fire",
      symbol: "Triangle",
      ton: "Expansive",
      impuls: "Ascent",
      desc: "Something in you wants out. This card points upward — it calls places that lift, widen, and open the horizon.",
    },
    {
      name: "Crossing",
      symbol: "Cross",
      ton: "Searching",
      impuls: "Crossing",
      desc: "You stand on a threshold. Not before it, not beyond it — in the middle. This card calls bridges, passes, gorges.",
    },
    {
      name: "Grounding depth",
      symbol: "Rhombus",
      ton: "Resting",
      impuls: "Pause",
      desc: "You do not need movement — you need roots. This card points down, into the earth, into the quiet.",
    },
    {
      name: "Descending depth",
      symbol: "Spiral",
      ton: "Transforming",
      impuls: "Descent",
      desc: "Something in you wants depth. Not sinking — diving. Conscious, curious, willing to change.",
    },
  ],
};

export function pickCard(answers, language = "de") {
  const deck = CARDS[language] || CARDS.de;
  const sym = Number.isInteger(answers?.q4) ? answers.q4 : 0;
  const mov = Number.isInteger(answers?.q1) ? answers.q1 : 0;
  const el = Number.isInteger(answers?.q3) ? answers.q3 : 0;
  const score = (cardIdx) => {
    const symIdx = [0, 1, 2, 3, 4][cardIdx];
    const movIdx = [2, 0, 3, 4, 1][cardIdx];
    const elIdx = [1, 0, 2, 2, 1][cardIdx];
    return (symIdx === sym ? 3 : 0) + (movIdx === mov ? 2 : 0) + (elIdx === el ? 1 : 0);
  };
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < deck.length; i += 1) {
    const value = score(i);
    if (value > bestScore) {
      bestScore = value;
      bestIdx = i;
    }
  }
  return deck[bestIdx];
}
