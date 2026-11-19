import { describe, expect, it } from "vitest";
import os from "node:os";
import { MarkerParser, TerminalSession, defaultShell, type TerminalEvent } from "../src/terminal/session.js";

describe("MarkerParser", () => {
  it("işareti çıktıdan ayıklar", () => {
    const p = new MarkerParser();
    expect(p.push("merhaba\n\x1e/tmp\x1f\nsonra")).toEqual([
      { type: "output", data: "merhaba\n" },
      { type: "prompt", cwd: "/tmp" },
      { type: "output", data: "sonra" },
    ]);
  });

  it("parça sınırında bölünen işareti birleştirir", () => {
    const p = new MarkerParser();
    expect(p.push("a\x1e/ho")).toEqual([{ type: "output", data: "a" }]);
    expect(p.push("me\x1f\r\n")).toEqual([{ type: "prompt", cwd: "/home" }]);
  });

  it("Windows yolu ve Türkçe karakter", () => {
    const p = new MarkerParser();
    expect(p.push("\x1eC:\\Users\\ışık\x1f\r\n")).toEqual([{ type: "prompt", cwd: "C:\\Users\\ışık" }]);
  });
});

describe.skipIf(process.platform === "win32")("TerminalSession", () => {
  it("komut çalıştırır, klasör değişimini istemle bildirir", async () => {
    const session = new TerminalSession(os.tmpdir(), defaultShell(false));
    const events: TerminalEvent[] = [];
    session.subscribe((e) => events.push(e));
    const prompts = () => events.filter((e) => e.type === "prompt");
    const waitPrompts = async (n: number) => {
      for (let i = 0; i < 100 && prompts().length < n; i++) await new Promise((r) => setTimeout(r, 30));
    };
    await waitPrompts(1);
    session.input("echo merhaba-dunya");
    await waitPrompts(2);
    session.input("cd /");
    await waitPrompts(3);
    const output = events.filter((e) => e.type === "output").map((e) => (e as { data: string }).data).join("");
    expect(output).toContain("merhaba-dunya");
    expect(output).not.toContain("\x1e");
    expect(session.cwd).toBe("/");
    session.dispose();
  });

  it("interrupt uzun komutu öldürüp kabuğu yeniden açar", async () => {
    const session = new TerminalSession(os.tmpdir(), defaultShell(false));
    const events: TerminalEvent[] = [];
    session.subscribe((e) => events.push(e));
    session.input("sleep 30");
    await new Promise((r) => setTimeout(r, 200));
    session.interrupt();
    session.input("echo hayatta");
    for (let i = 0; i < 100; i++) {
      if (events.some((e) => e.type === "output" && e.data.includes("hayatta"))) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(events.some((e) => e.type === "output" && e.data.includes("hayatta"))).toBe(true);
    session.dispose();
  });
});
