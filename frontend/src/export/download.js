export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadCanvasPng(canvas, filename) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
      } else {
        reject(new Error("PNG konnte nicht erzeugt werden."));
      }
    }, "image/png");
  });
  downloadBlob(blob, filename);
}
