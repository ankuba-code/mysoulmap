import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { pickCard } from "../ritual/card";
import { choiceIcons } from "../ritual/marks";
import { bookingTarget } from "./bookingUrl";
import { countryFlagCodes } from "../places/country";
import { localizePlace } from "../places/localize";
import regularFont from "./fonts/NotoSans-Regular.ttf?inline";
import boldFont from "./fonts/NotoSans-Bold.ttf?inline";
import italicFont from "./fonts/NotoSans-Italic.ttf?inline";

const FONT = "NotoSans";

const INK = [42, 36, 32];
const MUTED = [110, 100, 92];
const RULE = [214, 208, 200];
const MARGIN = 18;
const SITE_LABEL = "app.mithertz.online";
const SITE_URL = "https://app.mithertz.online";

const COPY = {
  de: {
    empty: "Kein Ergebnis zum Exportieren.",
    kicker: "SoulMap",
    printTitle: "Druckkarte",
    printLead: "Die kleine Karte zum Mitnehmen, mit Symbolen und Zitat.",
    yourSoulmap: "Deine SoulMap",
    welcomeTitle: "Willkommen",
    welcomeWithCard:
      "Schön, dass du hier bist. Oben liegt die Karte, die aus deinen Antworten entstanden ist: die Symbole, die du gewählt hast, und der Satz, der sie zusammenhält. Darunter findest du Orte und Hinweise, die zu dieser Stimmung passen. Nimm das Blatt als Richtung, nicht als Liste, die du abarbeiten musst.",
    welcomePlain:
      "Schön, dass du hier bist. Hier sind die Orte und Hinweise aus deinem Gespräch. Nimm sie als Richtung, nicht als Liste, die du abarbeiten musst.",
    places: "Orte",
    notes: "Reisehinweise",
    booking: "Unterkunft auf booking.com",
    ton: "Ton",
    impuls: "Impuls",
    archetype: "Archetyp",
    element: "Element",
    rhythm: "Innere Bewegung",
    intensity: "Intensität",
    frequency: "Frequenz",
    words: {
      fire: "Feuer",
      water: "Wasser",
      earth: "Erde",
      air: "Luft",
      aether: "Äther",
      rise: "Aufstieg",
      descent: "Abstieg",
      circle: "Kreis",
      threshold: "Schwelle",
      pause: "Innehalten",
      inward: "nach innen",
      outward: "nach außen",
    },
  },
  en: {
    empty: "Nothing to export.",
    kicker: "SoulMap",
    printTitle: "Card to take with you",
    printLead: "The small card to carry along, with symbols and the line.",
    yourSoulmap: "Your SoulMap",
    welcomeTitle: "Welcome",
    welcomeWithCard:
      "Good to have you here. At the top is the card that grew from your answers: the symbols you chose, and the line that holds them together. Below are places and notes that answer that mood. Keep this page as a direction, not as a list you have to finish.",
    welcomePlain:
      "Good to have you here. These are the places and notes from your conversation. Keep them as a direction, not as a list you have to finish.",
    places: "Places",
    notes: "Travel notes",
    booking: "Stay on booking.com",
    ton: "Tone",
    impuls: "Impulse",
    archetype: "Archetype",
    element: "Element",
    rhythm: "Inner movement",
    intensity: "Intensity",
    frequency: "Frequency",
    words: {
      fire: "Fire",
      water: "Water",
      earth: "Earth",
      air: "Air",
      aether: "Aether",
      rise: "Ascent",
      descent: "Descent",
      circle: "Circle",
      threshold: "Threshold",
      pause: "Pause",
      inward: "inward",
      outward: "outward",
    },
  },
  es: {
    empty: "No hay resultado para exportar.",
    kicker: "SoulMap",
    printTitle: "Carta para llevar",
    printLead: "La carta pequeña para llevar contigo, con símbolos y la frase.",
    yourSoulmap: "Tu mapa del alma",
    welcomeTitle: "Bienvenida",
    welcomeWithCard:
      "Qué bien que estés aquí. Arriba está la carta que nació de tus respuestas: los símbolos que elegiste y la frase que los reúne. Debajo, lugares y notas que responden a ese tono. Guarda esta página como una dirección, no como una lista que tengas que cumplir.",
    welcomePlain:
      "Qué bien que estés aquí. Aquí están los lugares y las notas de tu conversación. Guárdalos como una dirección, no como una lista que tengas que cumplir.",
    places: "Lugares",
    notes: "Notas de viaje",
    booking: "Alojamiento",
    ton: "Tono",
    impuls: "Impulso",
    archetype: "Arquetipo",
    element: "Elemento",
    rhythm: "Movimiento interior",
    intensity: "Intensidad",
    frequency: "Frecuencia",
    words: {
      fire: "Fuego",
      water: "Agua",
      earth: "Tierra",
      air: "Aire",
      aether: "Éter",
      rise: "Ascenso",
      descent: "Descenso",
      circle: "Círculo",
      threshold: "Umbral",
      pause: "Pausa",
      inward: "hacia dentro",
      outward: "hacia fuera",
    },
  },
  ru: {
    empty: "Нет результата для экспорта.",
    kicker: "SoulMap",
    printTitle: "Карта с собой",
    printLead: "Небольшая карта, которую можно взять с собой, с символами и фразой.",
    yourSoulmap: "Твоя карта души",
    welcomeTitle: "Добро пожаловать",
    welcomeWithCard:
      "Хорошо, что ты здесь. Сверху карта, которая выросла из твоих ответов: символы, которые ты выбрал, и фраза, которая их держит. Ниже места и заметки, которые отвечают этому настроению. Возьми лист как направление, а не как список, который нужно выполнить.",
    welcomePlain:
      "Хорошо, что ты здесь. Здесь места и заметки из твоего разговора. Возьми их как направление, а не как список, который нужно выполнить.",
    places: "Места",
    notes: "Заметки о путешествии",
    booking: "Жильё",
    ton: "Тон",
    impuls: "Импульс",
    archetype: "Архетип",
    element: "Стихия",
    rhythm: "Внутреннее движение",
    intensity: "Интенсивность",
    frequency: "Частота",
    words: {
      fire: "Огонь",
      water: "Вода",
      earth: "Земля",
      air: "Воздух",
      aether: "Эфир",
      rise: "Подъём",
      descent: "Спуск",
      circle: "Круг",
      threshold: "Порог",
      pause: "Пауза",
      inward: "внутрь",
      outward: "наружу",
    },
  },
};

export function cardFromRitual(stored) {
  if (!stored?.result?.anima_card) {
    return null;
  }
  const language = COPY[stored.language] ? stored.language : "de";
  const anima = pickCard(stored.answers, language);
  const meta = stored.result.anima_card;
  return {
    language,
    name: anima.name,
    desc: anima.desc,
    symbol: anima.symbol,
    ton: anima.ton,
    impuls: anima.impuls,
    element: meta.element,
    innerRhythm: meta.inner_rhythm,
    intensity: meta.emotional_intensity,
    frequency: meta.dominant_frequency,
    direction: meta.travel_direction,
    icons: choiceIcons(stored.answers),
  };
}

export { countryFlagCodes } from "../places/country";

export function pdfSafe(value) {
  let text = String(value ?? "");
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u20AC/g, "EUR")
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    .replace(/\u2022/g, "-")
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF\u0400-\u04FF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function fontBase64(dataUrl) {
  const source = String(dataUrl);
  const comma = source.indexOf(",");
  return comma >= 0 ? source.slice(comma + 1) : source;
}

function useTextFont(doc) {
  doc.addFileToVFS("NotoSans-Regular.ttf", fontBase64(regularFont));
  doc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", fontBase64(boldFont));
  doc.addFont("NotoSans-Bold.ttf", FONT, "bold");
  doc.addFileToVFS("NotoSans-Italic.ttf", fontBase64(italicFont));
  doc.addFont("NotoSans-Italic.ttf", FONT, "italic");
  doc.setFont(FONT, "normal");
}

function placesForPdf(messages, listed) {
  const generated = placeBlocks(messages);
  if (!listed?.length) {
    return generated;
  }
  const notes = new Map(generated.filter((place) => place.id).map((place) => [place.id, place]));
  const seen = new Set();
  const blocks = [];
  for (const place of listed) {
    if (!place?.id || seen.has(place.id)) {
      continue;
    }
    seen.add(place.id);
    const note = notes.get(place.id);
    blocks.push({
      id: place.id,
      name: place.name || note?.name || "",
      country: place.country || note?.country || "",
      flagCountry: place.flagCountry || note?.flagCountry || "",
      primaervibration: place.primaervibration || note?.primaervibration || "",
      correspondence: place.correspondence || note?.correspondence || "",
      reasons: place.reasons?.length ? place.reasons : note?.reasons || [],
      booking_link: place.booking_link || note?.booking_link || "",
      booking_url: place.booking_url || note?.booking_url || "",
      text: note?.text || "",
    });
  }
  for (const place of generated) {
    if (!place.id || seen.has(place.id)) {
      continue;
    }
    blocks.push(place);
  }
  return blocks;
}

export function createSoulmapPdf({
  messages = [],
  disclosure = "",
  card = null,
  language = "de",
  places: listedPlaces = [],
} = {}) {
  const lang = COPY[card?.language || language] ? card?.language || language : "de";
  const copy = pdfCopy(lang);
  const places = placesForPdf(messages, listedPlaces);
  const notes = noteBlocks(messages);
  if (!places.length && !notes.length && !card) {
    throw new Error(copy.empty);
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  useTextFont(doc);
  const cursor = makeCursor(doc);

  if (card) {
    cursor.y = drawCard(doc, card, copy, cursor.margin, cursor.y, cursor.width);
    cursor.y += 10;
  }

  writeSectionTitle(doc, cursor, copy.welcomeTitle);
  writeWrapped(doc, cursor, card ? copy.welcomeWithCard : copy.welcomePlain, {
    size: 11,
    style: "normal",
    color: INK,
    gap: 4,
  });

  if (places.length) {
    writeSectionTitle(doc, cursor, copy.places);
    places.forEach((place, index) => {
      writePlace(doc, cursor, place, copy, lang);
      if (index < places.length - 1) {
        writePlaceSeparator(doc, cursor);
      }
    });
  }

  if (notes.length) {
    writeSectionTitle(doc, cursor, copy.notes);
    for (const note of notes) {
      writeNote(doc, cursor, note);
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, disclosure, page);
  }
  return doc;
}

export function exportPdf(input, filename = "soulmap.pdf") {
  const doc = createSoulmapPdf(input);
  doc.save(filename);
}

function pdfCopy(language) {
  return COPY[language] || COPY.de;
}

function plainNote(value) {
  return pdfSafe(stripMarkdown(value));
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*+]\s+/gm, "- ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function makeCursor(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  return {
    margin: MARGIN,
    width: pageWidth - MARGIN * 2,
    y: 16,
    bottom: pageHeight - 16,
    ensure(needed) {
      if (this.y + needed <= this.bottom) {
        return;
      }
      doc.addPage();
      doc.setFont(FONT, "normal");
      doc.setFontSize(9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("SoulMap", this.margin, 12);
      this.y = 20;
    },
  };
}

function linesOf(doc, text, width) {
  const safe = pdfSafe(text);
  if (!safe || width <= 0) {
    return [];
  }
  const raw = doc.splitTextToSize(safe, width);
  const lines = Array.isArray(raw) ? raw : [raw];
  return lines.map((line) => String(line)).filter((line) => line.trim() !== "");
}

function writeCenteredLine(doc, line, y, size, style, color) {
  doc.setFont(FONT, style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = doc.getTextWidth(line);
  doc.text(line, (pageWidth - textWidth) / 2, y);
  return y + size * 0.48;
}

function writeLeft(doc, cursor, line, size, style, color, indent = 0) {
  const lead = size * 0.48;
  cursor.ensure(lead + 1);
  doc.setFont(FONT, style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(line, cursor.margin + indent, cursor.y);
  cursor.y += lead;
}

function writeWrapped(doc, cursor, text, { size, style, color, indent = 0, gap = 2 }) {
  doc.setFont(FONT, style);
  doc.setFontSize(size);
  const lines = linesOf(doc, text, cursor.width - indent);
  for (const line of lines) {
    writeLeft(doc, cursor, line, size, style, color, indent);
  }
  if (lines.length) {
    cursor.y += gap;
  }
}

function writeSectionTitle(doc, cursor, label) {
  cursor.y += 1;
  cursor.ensure(14);
  writeLeft(doc, cursor, label, 13, "bold", INK);
  cursor.y += 1.2;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.35);
  doc.line(cursor.margin, cursor.y, cursor.margin + cursor.width, cursor.y);
  cursor.y += 6;
}

function drawCard(doc, card, copy, x, y, width) {
  const inner = width - 16;
  const icons = Array.isArray(card.icons) ? card.icons.filter(Boolean) : [];
  const clusterH = icons.length ? 46 : 0;
  const blocks = [
    { text: copy.printTitle, size: 9, style: "normal", color: MUTED, gap: 0 },
    { text: copy.printLead, size: 10, style: "italic", color: MUTED, gap: 2.2 },
    { text: copy.yourSoulmap, size: 9, style: "normal", color: MUTED, gap: 3 },
    { text: card.name, size: 16, style: "bold", color: INK, gap: 2.4 },
    {
      text: [labeled(copy.ton, card.ton), labeled(copy.impuls, card.impuls), labeled(copy.archetype, card.symbol)]
        .filter(Boolean)
        .join("   ·   "),
      size: 9,
      style: "normal",
      color: MUTED,
      gap: 2.2,
    },
    { text: card.desc ? `"${card.desc}"` : "", size: 11, style: "italic", color: INK, gap: 3.2 },
  ]
    .map((block) => {
      doc.setFont(FONT, block.style);
      doc.setFontSize(block.size);
      return { ...block, lines: linesOf(doc, block.text, inner) };
    })
    .filter((block) => block.lines.length);

  if (icons.length) {
    drawSymbolCluster(doc, icons, x + width / 2, y + clusterH / 2, 17);
  }

  const boxTop = y + clusterH + (icons.length ? 3 : 0);
  let cursorY = boxTop + 8;
  for (const block of blocks) {
    cursorY += block.gap;
    for (const line of block.lines) {
      cursorY = writeCenteredLine(doc, line, cursorY, block.size, block.style, block.color);
    }
  }
  const boxHeight = Math.max(28, cursorY - boxTop + 6);
  doc.setFillColor(248, 244, 238);
  doc.setDrawColor(196, 186, 174);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, boxTop, width, boxHeight, 3, 3, "FD");

  cursorY = boxTop + 8;
  for (const block of blocks) {
    cursorY += block.gap;
    for (const line of block.lines) {
      cursorY = writeCenteredLine(doc, line, cursorY, block.size, block.style, block.color);
    }
  }

  return boxTop + boxHeight;
}

function labeled(label, value) {
  if (value == null || value === "") {
    return "";
  }
  return `${label}: ${value}`;
}

function drawSymbolCluster(doc, icons, cx, cy, radius) {
  doc.setDrawColor(90, 80, 72);
  doc.setLineWidth(0.28);
  doc.circle(cx, cy, radius, "S");
  doc.circle(cx, cy, radius * 0.26, "S");
  const count = icons.length;
  icons.forEach((name, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const x = cx + radius * 0.68 * Math.cos(angle);
    const y = cy + radius * 0.68 * Math.sin(angle);
    doc.setLineWidth(0.25);
    doc.circle(x, y, 4.2, "S");
    drawMark(doc, name, x, y, 2.6);
  });
}

function drawMark(doc, name, cx, cy, s) {
  const point = (x, y) => [cx + ((x - 7) / 7) * s, cy + ((y - 7) / 7) * s];
  const poly = (pts) => strokePath(doc, pts.map(([x, y]) => point(x, y)));
  const quads = (segments) => {
    const pts = [];
    for (const [start, control, end] of segments) {
      const part = quad(point(start[0], start[1]), point(control[0], control[1]), point(end[0], end[1]));
      if (pts.length) {
        part.shift();
      }
      pts.push(...part);
    }
    strokePath(doc, pts);
  };

  doc.setDrawColor(70, 62, 56);
  doc.setLineWidth(0.28);
  switch (name) {
    case "diamond":
    case "rhombus":
      poly([
        [7, 2],
        [12, 7],
        [7, 12],
        [2, 7],
        [7, 2],
      ]);
      break;
    case "triangle":
      poly([
        [3, 11],
        [7, 3],
        [11, 11],
        [3, 11],
      ]);
      break;
    case "circle":
      doc.circle(cx, cy, s * 0.57, "S");
      break;
    case "pause":
      doc.circle(cx, cy, s * 0.57, "S");
      doc.setFillColor(70, 62, 56);
      doc.circle(cx, cy, s * 0.16, "F");
      break;
    case "wave":
    case "water":
      quads([
        [
          [1, 9],
          [4, 4],
          [7, 7],
        ],
        [
          [7, 7],
          [10, 10],
          [13, 4],
        ],
      ]);
      break;
    case "square":
    case "earth":
      {
        const [left, top] = point(3, 4);
        const [right, bottom] = point(11, 11);
        doc.rect(left, top, right - left, bottom - top, "S");
      }
      break;
    case "up":
      poly([
        [7, 12],
        [7, 3],
      ]);
      poly([
        [4, 6],
        [7, 3],
        [10, 6],
      ]);
      break;
    case "down":
    case "chevron":
      poly([
        [3, 5],
        [7, 10],
        [11, 5],
      ]);
      break;
    case "eye":
    case "air":
      quads([
        [
          [2, 7],
          [7, 2],
          [12, 7],
        ],
        [
          [12, 7],
          [7, 12],
          [2, 7],
        ],
      ]);
      break;
    case "arrow":
      poly([
        [2, 7],
        [11, 7],
      ]);
      poly([
        [8, 4],
        [11, 7],
        [8, 10],
      ]);
      break;
    case "spark":
      poly([
        [7, 2],
        [7, 7],
      ]);
      poly([
        [7, 10],
        [7, 12],
      ]);
      break;
    case "zigzag":
      poly([
        [2, 8],
        [5, 3],
        [12, 10],
      ]);
      break;
    case "flame":
      strokePath(
        doc,
        cubicChain([
          [point(7, 12), point(4, 9), point(2, 7), point(4, 4)],
          [point(4, 4), point(6, 2), point(10, 4), point(7, 7)],
          [point(7, 7), point(10, 5), point(11, 8), point(7, 12)],
        ]),
      );
      break;
    case "cross":
      poly([
        [7, 2],
        [7, 12],
      ]);
      poly([
        [2, 7],
        [12, 7],
      ]);
      break;
    case "aether":
      poly([
        [7, 2],
        [7, 12],
      ]);
      poly([
        [2, 7],
        [12, 7],
      ]);
      poly([
        [4, 4],
        [10, 10],
      ]);
      poly([
        [10, 4],
        [4, 10],
      ]);
      break;
    case "spiral":
      quads([
        [
          [7, 7],
          [12, 3],
          [10, 1],
        ],
        [
          [10, 1],
          [5, 0],
          [2, 4],
        ],
        [
          [2, 4],
          [0, 8],
          [4, 11],
        ],
        [
          [4, 11],
          [8, 14],
          [12, 10],
        ],
      ]);
      break;
    default:
      doc.circle(cx, cy, s * 0.45, "S");
  }
}

function strokePath(doc, points) {
  for (let index = 1; index < points.length; index += 1) {
    doc.line(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
  }
}

function quad(p0, p1, p2, steps = 8) {
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return points;
}

function cubic(p0, p1, p2, p3, steps = 8) {
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return points;
}

function cubicChain(segments) {
  const points = [];
  for (const [p0, p1, p2, p3] of segments) {
    const part = cubic(p0, p1, p2, p3);
    if (points.length) {
      part.shift();
    }
    points.push(...part);
  }
  return points;
}

function placeBlocks(messages) {
  const seen = new Set();
  const blocks = [];
  for (const message of messages) {
    const sections = Array.isArray(message.sections) ? message.sections : [];
    for (const section of sections) {
      if (section.kind !== "place" || !section.name) {
        continue;
      }
      const id = section.placeId || section.name;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const linked = (message.recommendedPlaces || []).find((place) => place.id === section.placeId);
      blocks.push({
        id: section.placeId || "",
        name: section.name,
        country: section.country || linked?.country || "",
        primaervibration: section.primaervibration || linked?.primaervibration || "",
        correspondence: linked?.correspondence || "",
        reasons: linked?.reasons || [],
        booking_link: linked?.booking_link || "",
        booking_url: linked?.booking_url || "",
        text: section.text || "",
      });
    }
    for (const place of message.recommendedPlaces || []) {
      if (!place?.id || seen.has(place.id)) {
        continue;
      }
      seen.add(place.id);
      blocks.push(place);
    }
  }
  return blocks;
}

const UNAVAILABLE_SENTENCES = [
  "Unser KI-Assistent ist gerade nicht erreichbar.",
  "Basierend auf deiner Anfrage ist unser KI-Assistent gerade nicht erreichbar.",
  "Our AI assistant is currently unavailable.",
  "Based on your request, our AI assistant is currently unavailable.",
  "Nuestro asistente de IA no está disponible en este momento.",
  "Según tu consulta, nuestro asistente de IA no está disponible ahora.",
  "Наш ИИ-ассистент сейчас недоступен.",
  "По твоему запросу ассистент сейчас недоступен.",
];

function withoutUnavailableNotice(value) {
  let text = String(value || "");
  for (const sentence of UNAVAILABLE_SENTENCES) {
    text = text.split(sentence).join("");
  }
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function noteBlocks(messages) {
  const notes = [];
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    const sections = Array.isArray(message.sections) ? message.sections : [];
    const described = sections.some((section) => section.kind === "place" && section.text);
    if (described) {
      for (const section of sections) {
        if (section.kind === "overview" && section.text) {
          notes.push(section.text);
        }
      }
      continue;
    }
    if (message.content) {
      notes.push(message.content);
    }
  }
  return notes.map((note) => plainNote(withoutUnavailableNotice(note))).filter(Boolean);
}

function flagDataUrl(code) {
  if (typeof document === "undefined") {
    return "";
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const context = canvas.getContext?.("2d");
  if (!context) {
    return "";
  }
  const emoji = String(code)
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
  context.font = "40px serif";
  context.textBaseline = "middle";
  context.fillText(emoji, 2, 24);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function drawBookingQr(doc, url, x, y, side) {
  let qr;
  try {
    qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  } catch {
    return;
  }
  const count = qr.modules.size;
  const quiet = 4;
  const cell = side / (count + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, side, side, "F");
  doc.setFillColor(INK[0], INK[1], INK[2]);
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.modules.get(column, row)) {
        doc.rect(x + (column + quiet) * cell, y + (row + quiet) * cell, cell, cell, "F");
      }
    }
  }
  if (typeof doc.link === "function") {
    doc.link(x, y, side, side, { url });
  }
}

function writePlace(doc, cursor, place, copy, lang) {
  const shown = localizePlace(place, lang) || place;
  if (!shown?.name) {
    return;
  }
  const target = bookingTarget(place, lang);
  const qrSide = 26;
  const fullWidth = cursor.width;
  if (target) {
    cursor.ensure(qrSide + 6);
    cursor.width = Math.max(48, fullWidth - qrSide - 4);
  }
  const top = cursor.y;
  const titleLines = linesOf(doc, shown.name, cursor.width);
  titleLines.forEach((line) => {
    writeLeft(doc, cursor, line, 12, "bold", INK, 0);
  });
  if (shown.country) {
    const flags = countryFlagCodes(shown.flagCountry || shown.country)
      .map(flagDataUrl)
      .filter(Boolean);
    let offset = 0;
    if (flags.length && typeof doc.addImage === "function") {
      flags.forEach((url, index) => {
        doc.addImage(url, "PNG", cursor.margin + index * 8, cursor.y - 3.2, 6.4, 4.6);
      });
      offset = flags.length * 8;
    }
    const countryLines = linesOf(doc, shown.country, cursor.width - offset);
    countryLines.forEach((line, index) => {
      writeLeft(doc, cursor, line, 10, "normal", INK, index === 0 ? offset : 0);
    });
  }
  cursor.y += 1;
  if (shown.primaervibration) {
    writeWrapped(doc, cursor, shown.primaervibration, { size: 9, style: "normal", color: MUTED, gap: 1 });
  }
  if (shown.text) {
    writeWrapped(doc, cursor, shown.text, { size: 10.5, style: "normal", color: INK, gap: 1.4 });
  }
  if (shown.correspondence) {
    writeWrapped(doc, cursor, shown.correspondence, { size: 10.5, style: "italic", color: INK, gap: 1.2 });
  }
  for (const reason of (place.reasons || []).slice(0, 3)) {
    if (!reason?.text) {
      continue;
    }
    writeWrapped(doc, cursor, `- ${reason.text}`, { size: 10, style: "normal", color: MUTED, indent: 2, gap: 0.8 });
  }
  const textEnd = cursor.y;
  cursor.width = fullWidth;
  if (target) {
    drawBookingQr(doc, target, cursor.margin + fullWidth - qrSide, top, qrSide);
    cursor.y = Math.max(textEnd, top + qrSide + 2);
    writeWrapped(doc, cursor, copy.booking, { size: 8, style: "normal", color: MUTED, gap: 1 });
  }
}

function writePlaceSeparator(doc, cursor) {
  cursor.y += 2;
  cursor.ensure(8);
  const inset = 24;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.35);
  doc.line(cursor.margin + inset, cursor.y, cursor.margin + cursor.width - inset, cursor.y);
  cursor.y += 6;
}

function writeNote(doc, cursor, note) {
  const rows = note.split("\n");
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) {
      cursor.y += 2;
      continue;
    }
    if (isHeading(trimmed)) {
      cursor.ensure(26);
      writeWrapped(doc, cursor, trimmed, { size: 11, style: "bold", color: INK, gap: 1.6 });
      continue;
    }
    const bullet = /^(-|\d+[.)])\s+/.test(trimmed);
    writeWrapped(doc, cursor, trimmed, {
      size: 10.5,
      style: "normal",
      color: INK,
      indent: bullet ? 3 : 0,
      gap: bullet ? 0.8 : 1.8,
    });
  }
  cursor.y += 2;
}

function isHeading(line) {
  if (line.length > 90) {
    return false;
  }
  if (/^(-|\d+[.)])\s+/.test(line)) {
    return false;
  }
  if (/[.!?]$/.test(line)) {
    return false;
  }
  return true;
}

function drawFooter(doc, disclosure, page) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 8;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, pageHeight - 13, pageWidth - MARGIN, pageHeight - 13);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const label = String(page);
  const labelWidth = doc.getTextWidth(label);
  const siteWidth = doc.getTextWidth(SITE_LABEL);
  const siteX = (pageWidth - siteWidth) / 2;
  const note = pdfSafe(disclosure);
  if (note) {
    const lines = linesOf(doc, note, Math.max(24, siteX - MARGIN - 4));
    if (lines[0]) {
      doc.text(lines[0], MARGIN, y);
    }
  }
  doc.text(SITE_LABEL, siteX, y);
  doc.link(siteX, y - 3, siteWidth, 4, { url: SITE_URL });
  doc.text(label, pageWidth - MARGIN - labelWidth, y);
}
