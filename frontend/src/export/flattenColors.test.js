import { describe, expect, it } from "vitest";
import { detachClone, flattenComputedColors, stripDocumentStyles } from "./flattenColors";

describe("flattenComputedColors", () => {
  it("copies computed colors onto the clone", () => {
    const source = document.createElement("div");
    source.style.color = "rgb(28, 25, 23)";
    source.style.backgroundColor = "rgb(250, 250, 249)";
    const target = source.cloneNode(true);
    flattenComputedColors(source, target);
    expect(target.style.color).toBe("rgb(28, 25, 23)");
    expect(target.style.backgroundColor).toBe("rgb(250, 250, 249)");
  });
});

describe("detachClone", () => {
  it("appends an offscreen clone and returns a cleanup holder", () => {
    const source = document.createElement("section");
    source.textContent = "Machu Picchu";
    document.body.append(source);
    const { clone, holder } = detachClone(source);
    expect(clone.textContent).toBe("Machu Picchu");
    expect(holder.getAttribute("data-soulmap-export")).toBe("true");
    holder.remove();
    source.remove();
  });
});

describe("stripDocumentStyles", () => {
  it("removes stylesheets from a document clone", () => {
    const doc = document.implementation.createHTMLDocument("export");
    doc.head.append(doc.createElement("style"));
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    doc.head.append(link);
    stripDocumentStyles(doc);
    expect(doc.querySelectorAll("style, link[rel='stylesheet']")).toHaveLength(0);
  });
});
