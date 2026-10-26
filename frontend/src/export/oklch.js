function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toSrgb(channel) {
  const abs = Math.abs(channel);
  const encoded = abs > 0.0031308 ? Math.sign(channel) * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * channel;
  return clampByte(encoded * 255);
}

function parseComponent(raw, percentIsHundred = false) {
  const text = raw.trim();
  const number = parseFloat(text);
  if (Number.isNaN(number)) {
    return 0;
  }
  if (text.endsWith("%")) {
    return percentIsHundred ? number / 100 : number / 100;
  }
  return number;
}

export function oklchToRgb(expression) {
  const match = expression.match(/oklch\(\s*([^)]+)\)/i);
  if (!match) {
    return "rgb(0, 0, 0)";
  }
  const [main, alphaPart] = match[1].split("/").map((part) => part.trim());
  const tokens = main.split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 3) {
    return "rgb(0, 0, 0)";
  }
  let lightness = parseComponent(tokens[0], true);
  if (lightness > 1) {
    lightness /= 100;
  }
  const chroma = parseComponent(tokens[1]);
  const hue = parseComponent(tokens[2].replace("deg", ""));
  const hueRad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRad);
  const b = chroma * Math.sin(hueRad);
  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const red = toSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  if (alphaPart) {
    const alpha = parseComponent(alphaPart, true);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return `rgb(${red}, ${green}, ${blue})`;
}

export function replaceOklch(value) {
  if (!value || !value.includes("oklch")) {
    return value;
  }
  return value.replace(/oklch\([^)]+\)/gi, (match) => oklchToRgb(match));
}
