import { describe, expect, it, vi } from "vitest";

const html2canvas = vi.fn();
vi.mock("html2canvas", () => ({
  default: (...args) => html2canvas(...args),
}));

vi.mock("./download", () => ({
  downloadCanvasPng: vi.fn(),
}));

import { downloadCanvasPng } from "./download";
import { exportScreenshot } from "./screenshot";

describe("exportScreenshot", () => {
  it("renders the result node locally and does not call the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const node = document.createElement("section");
    node.textContent = "Ergebnis";
    document.body.append(node);
    const canvas = {};
    html2canvas.mockResolvedValue(canvas);
    await exportScreenshot(node);
    expect(html2canvas).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ backgroundColor: "#fafaf9" }),
    );
    expect(document.querySelector("[data-soulmap-export]")).toBeNull();
    node.remove();
    expect(downloadCanvasPng).toHaveBeenCalledWith(canvas, "soulmap.png");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
