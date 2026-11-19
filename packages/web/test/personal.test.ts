import { describe, expect, it } from "vitest";
import { hsvToRgb, parseHex, rgbToHsv, toHex, withAlpha } from "../src/lib/color";
import { LineEditor } from "../src/lib/line-editor";
import { PRESETS, REGIONS, cssVariables, normalize } from "../src/stores/appearance";
import { effortById } from "../src/lib/effort";

describe("renk dönüşümleri", () => {
  it("hex ayrıştırır, kısa biçimi açar", () => {
    expect(parseHex("#abc")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHex("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex("#zzzzzz")).toBeNull();
  });
  it("hsv gidiş-dönüş kayıpsız", () => {
    for (const hex of ["#8fbf9f", "#ff2e4d", "#000000", "#ffffff", "#6ea8ff"]) {
      expect(toHex(hsvToRgb(rgbToHsv(parseHex(hex)!)))).toBe(hex);
    }
  });
  it("saydamlık ekler", () => {
    expect(withAlpha("#ff0000", 0.5)).toBe("rgb(255 0 0 / 0.50)");
    expect(withAlpha("#ff0000", 1)).toBe("#ff0000");
  });
});

describe("görünüm", () => {
  it("her hazır tema her bölgeyi tanımlar", () => {
    for (const preset of PRESETS) {
      for (const region of REGIONS) expect(parseHex(preset.palette[region.key]), `${preset.id}.${region.key}`).not.toBeNull();
    }
  });
  it("eksik kayıt varsayılanlarla tamamlanır", () => {
    const a = normalize({ palette: { accent: "#123456" } as never, fontScale: 1.1 });
    expect(a.palette.accent).toBe("#123456");
    expect(a.palette.sidebar).toMatch(/^#/);
    expect(a.statusItems.cpu).toBe(true);
  });
  it("görsel varken yüzeyler saydamlaşır, vurgu saydamlaşmaz", () => {
    const a = normalize({ panelOpacity: 0.5 });
    const vars = cssVariables(a, true);
    expect(vars["--sidebar-bg"]).toContain("/ 0.50");
    expect(vars["--accent"]).toBe(a.palette.accent);
    expect(cssVariables(a, false)["--sidebar-bg"]).toBe(a.palette.sidebar);
  });
});

describe("terminal satır düzenleyici", () => {
  it("yazar, siler, gönderir", () => {
    const e = new LineEditor();
    e.feed("l"); e.feed("s"); e.feed("x"); e.feed("\x7f");
    expect(e.line).toBe("ls");
    expect(e.feed("\r").actions).toEqual([{ type: "submit", line: "ls" }]);
    expect(e.line).toBe("");
  });
  it("imleç ortasına ekler", () => {
    const e = new LineEditor();
    e.feed("ac"); e.feed("\x1b[D"); e.feed("b");
    expect(e.line).toBe("abc");
  });
  it("geçmişte gezinir ve taslağı korur", () => {
    const e = new LineEditor(["git status", "npm test"]);
    e.feed("ya");
    e.feed("\x1b[A");
    expect(e.line).toBe("npm test");
    e.feed("\x1b[A");
    expect(e.line).toBe("git status");
    e.feed("\x1b[B"); e.feed("\x1b[B");
    expect(e.line).toBe("ya");
  });
  it("çok satırlı yapıştırma her satırı gönderir", () => {
    const e = new LineEditor();
    const r = e.feed("echo 1\necho 2\nkalan");
    expect(r.actions).toEqual([{ type: "submit", line: "echo 1" }, { type: "submit", line: "echo 2" }]);
    expect(e.line).toBe("kalan");
  });
  it("Ctrl+C keser", () => {
    const e = new LineEditor();
    e.feed("sleep");
    expect(e.feed("\x03").actions).toEqual([{ type: "interrupt" }]);
    expect(e.line).toBe("");
  });
});

describe("efor", () => {
  it("bilinmeyen değer dengeliye düşer", () => {
    expect(effortById("x").id).toBe("balanced");
    expect(effortById("deep").maxTokens).toBeGreaterThan(effortById("fast").maxTokens);
  });
});
