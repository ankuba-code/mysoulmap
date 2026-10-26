import { jsPDF } from "jspdf";
import { assistantTexts, collectPlaces } from "./results";

export function exportPdf({ messages, disclosure }, filename = "soulmap.pdf") {
  const places = collectPlaces(messages);
  const notes = assistantTexts(messages);
  if (!places.length && !notes.length) {
    throw new Error("Kein Ergebnis zum Exportieren.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 20;
  const left = 20;
  const width = 170;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Soulmap", left, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (disclosure) {
    y = writeLines(doc, disclosure, left, y, width);
    y += 4;
  }

  for (const note of notes) {
    y = ensureSpace(doc, y, 16);
    y = writeLines(doc, note, left, y, width);
    y += 4;
  }

  if (places.length) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Empfehlungen", left, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const place of places) {
      y = ensureSpace(doc, y, 16);
      y = writeLines(doc, place.name, left, y, width);
      if (place.booking_link) {
        y = writeLines(doc, place.booking_link, left, y, width);
      }
      y += 3;
    }
  }

  doc.save(filename);
}

function writeLines(doc, text, x, y, width) {
  const lines = doc.splitTextToSize(String(text), width);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

function ensureSpace(doc, y, needed) {
  if (y + needed < 280) {
    return y;
  }
  doc.addPage();
  return 20;
}
