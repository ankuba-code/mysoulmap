import { replaceOklch } from "./oklch";

const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
];

export function flattenComputedColors(sourceRoot, targetRoot) {
  const sources = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const targets = [targetRoot, ...targetRoot.querySelectorAll("*")];
  sources.forEach((source, index) => {
    const target = targets[index];
    if (!target) {
      return;
    }
    const style = getComputedStyle(source);
    const props = Array.from({ length: style.length }, (_, index) => style.item(index));
    for (const prop of props) {
      const value = replaceOklch(style.getPropertyValue(prop));
      if (!value) {
        continue;
      }
      target.style.setProperty(prop, value);
    }
    for (const prop of COLOR_PROPS) {
      target.style[prop] = replaceOklch(style[prop]);
    }
    target.removeAttribute("class");
  });
}

export function stripDocumentStyles(doc) {
  doc.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => node.remove());
  doc.querySelectorAll("[style]").forEach((node) => {
    const current = node.getAttribute("style");
    if (current?.includes("oklch")) {
      node.setAttribute("style", replaceOklch(current));
    }
  });
}

export function detachClone(element) {
  const clone = element.cloneNode(true);
  const holder = document.createElement("div");
  holder.setAttribute("data-soulmap-export", "true");
  holder.setAttribute("aria-hidden", "true");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${Math.max(element.scrollWidth, element.clientWidth)}px`;
  holder.style.backgroundColor = "#fafaf9";
  holder.append(clone);
  document.body.append(holder);
  flattenComputedColors(element, clone);
  return { clone, holder };
}
