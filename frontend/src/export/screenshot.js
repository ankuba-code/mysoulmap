import html2canvas from "html2canvas";
import { downloadCanvasPng } from "./download";
import { detachClone, stripDocumentStyles } from "./flattenColors";

export async function exportScreenshot(element, filename = "soulmap.png") {
  if (!element) {
    throw new Error("Kein Ergebnis zum Exportieren.");
  }
  const { clone, holder } = detachClone(element);
  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: "#fafaf9",
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: stripDocumentStyles,
    });
    await downloadCanvasPng(canvas, filename);
  } finally {
    holder.remove();
  }
}
