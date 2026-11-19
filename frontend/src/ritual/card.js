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
  es: [
    {
      name: "Silencio que gira",
      symbol: "Círculo",
      ton: "En espera",
      impuls: "Girar",
      desc: "Estás en una fase de permanencia consciente. El mundo gira — tú estás en el centro y miras. Esta carta llama lugares que descansan en sí mismos.",
    },
    {
      name: "Fuego que asciende",
      symbol: "Triángulo",
      ton: "Expansivo",
      impuls: "Ascenso",
      desc: "Algo en ti arde y quiere salir. Esta carta señala hacia arriba — llama lugares que elevan, amplían y abren el horizonte.",
    },
    {
      name: "Travesía",
      symbol: "Cruz",
      ton: "En búsqueda",
      impuls: "Cruzar",
      desc: "Estás en un umbral. Ni antes ni después — en medio. Esta carta llama puentes, pasos y desfiladeros.",
    },
    {
      name: "Profundidad que arraiga",
      symbol: "Rombo",
      ton: "En reposo",
      impuls: "Detenerse",
      desc: "No necesitas movimiento — necesitas echar raíces. Esta carta señala hacia abajo, a la tierra, al silencio.",
    },
    {
      name: "Profundidad que desciende",
      symbol: "Espiral",
      ton: "Transformador",
      impuls: "Descenso",
      desc: "Algo en ti quiere ir a lo hondo. No hundirse — sumergirse. Con conciencia, curiosidad y ganas de transformarte.",
    },
  ],
  ru: [
    {
      name: "Кружащая тишина",
      symbol: "Круг",
      ton: "Ожидание",
      impuls: "Кружение",
      desc: "Ты в фазе осознанного пребывания. Мир вращается — ты стоишь в центре и смотришь. Эта карта зовёт места, которые покоятся в себе.",
    },
    {
      name: "Восходящий огонь",
      symbol: "Треугольник",
      ton: "Расширение",
      impuls: "Подъём",
      desc: "В тебе горит то, что хочет наружу. Эта карта указывает вверх — она зовёт места, которые поднимают, расширяют и открывают горизонт.",
    },
    {
      name: "Переправа",
      symbol: "Крест",
      ton: "Поиск",
      impuls: "Пересечение",
      desc: "Ты стоишь на пороге. Не перед ним и не за ним — посреди. Эта карта зовёт мосты, перевалы, ущелья.",
    },
    {
      name: "Укореняющая глубина",
      symbol: "Ромб",
      ton: "Покой",
      impuls: "Остановка",
      desc: "Тебе не нужно движение — тебе нужно укоренение. Эта карта указывает вниз, в землю, в тишину.",
    },
    {
      name: "Нисходящая глубина",
      symbol: "Спираль",
      ton: "Преображение",
      impuls: "Спуск",
      desc: "Что-то в тебе хочет глубины. Не тонуть — погружаться. Осознанно, с любопытством, готовое к перемене.",
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
