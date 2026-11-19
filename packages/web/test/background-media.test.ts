/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";

describe("arka plan medyası (DOM)", () => {
  it("medya varken ::before görselini boşaltır ve şeffaf panelleri açar", async () => {
    const { applyAppearance, defaultAppearance } = await import("../src/stores/appearance");
    const root = document.documentElement;
    applyAppearance(defaultAppearance(), null, true);
    expect(root.dataset["bgImage"]).toBe("on");
    expect(root.dataset["bgMedia"]).toBe("on");
    expect(root.style.getPropertyValue("--bg-image")).toBe("");
    applyAppearance(defaultAppearance(), null, false);
    expect(root.dataset["bgImage"]).toBeUndefined();
    expect(root.dataset["bgMedia"]).toBeUndefined();
  });
});
