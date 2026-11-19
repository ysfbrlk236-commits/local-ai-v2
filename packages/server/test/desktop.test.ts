import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApprovalGate } from "../src/agent/approval.js";
import { runAgent } from "../src/agent/loop.js";
import { builtinTools } from "../src/agent/registry.js";
import { desktopClick, desktopTools, resetDesktopState } from "../src/agent/tools/desktop.js";
import { defineTool, type Tool, type ToolContext } from "../src/agent/types.js";
import {
  DesktopError,
  parseHelperOutput,
  parseKeyCombo,
  toImage,
  toScreen,
  validateOpenTarget,
} from "../src/desktop/windows.js";
import type { ChatEvent, ChatMessage, ChatProvider } from "../src/providers/types.js";

describe("tuş birleşimleri", () => {
  it("kısayolları sanal tuş kodlarına çevirir", () => {
    expect(parseKeyCombo("ctrl+t")).toEqual([0x11, 0x54]);
    expect(parseKeyCombo("Ctrl + Shift + Tab")).toEqual([0x11, 0x10, 0x09]);
    expect(parseKeyCombo("alt+f4")).toEqual([0x12, 0x73]);
    expect(parseKeyCombo("win+d")).toEqual([0x5b, 0x44]);
    expect(parseKeyCombo("enter")).toEqual([0x0d]);
    expect(parseKeyCombo("f12")).toEqual([0x7b]);
    expect(parseKeyCombo("ctrl+1")).toEqual([0x11, 0x31]);
  });

  it("bilinmeyen tuşta durur", () => {
    expect(() => parseKeyCombo("ctrl+uçak")).toThrow(DesktopError);
    expect(() => parseKeyCombo("")).toThrow(DesktopError);
  });
});

describe("koordinatlar", () => {
  const geometry = { left: 0, top: 0, scale: 0.5, width: 1280, height: 720 };

  it("küçültülmüş görüntüden gerçek ekrana çevirir", () => {
    expect(toScreen(geometry, 640, 360)).toEqual({ x: 1280, y: 720 });
    expect(toScreen({ ...geometry, left: -1920 }, 0, 10)).toEqual({ x: -1920, y: 20 });
  });

  it("görüntü dışını reddeder", () => {
    expect(() => toScreen(geometry, 1300, 10)).toThrow(DesktopError);
  });

  it("imleci görüntü koordinatına çevirir", () => {
    expect(toImage(geometry, 1280, 720)).toEqual({ x: 640, y: 360 });
  });
});

describe("açılacak hedef", () => {
  it("adresleri, program adlarını ve yolları kabul eder", () => {
    expect(validateOpenTarget(" https://www.google.com/search?q=a ")).toBe(
      "https://www.google.com/search?q=a",
    );
    expect(validateOpenTarget("notepad")).toBe("notepad");
    expect(validateOpenTarget("C:\\Users\\ali\\belge.pdf")).toBe("C:\\Users\\ali\\belge.pdf");
  });

  it("tehlikeli şemaları ve kabuk karakterlerini reddeder", () => {
    expect(() => validateOpenTarget("file:///C:/Windows")).toThrow(DesktopError);
    expect(() => validateOpenTarget("javascript:alert(1)")).toThrow(DesktopError);
    expect(() => validateOpenTarget("notepad & del x")).toThrow(DesktopError);
    expect(() => validateOpenTarget("")).toThrow(DesktopError);
  });
});

describe("yardımcı çıktısı", () => {
  it("uyarı satırlarının arasından JSON'u bulur", () => {
    expect(parseHelperOutput('UYARI: bir şey\n{"ok":true,"width":10}')).toEqual({
      ok: true,
      width: 10,
    });
    expect(parseHelperOutput("bozuk")).toBeNull();
  });
});

function context(approve = true): ToolContext & { asked: string[] } {
  const asked: string[] = [];
  return {
    workspaceRoot: "/tmp",
    signal: new AbortController().signal,
    asked,
    requestApproval: async (request) => {
      asked.push(request.summary);
      return approve;
    },
  };
}

describe("masaüstü araçları", () => {
  it("hepsi computer riskinde ve kayıtlı", () => {
    expect(desktopTools.every((tool) => tool.risk === "computer")).toBe(true);
    const names = builtinTools().map((tool) => tool.name);
    for (const tool of desktopTools) expect(names).toContain(tool.name);
  });

  it.skipIf(process.platform === "win32")("Windows dışında açıkça hata verir", async () => {
    resetDesktopState({ left: 0, top: 0, scale: 1, width: 100, height: 100 });
    const ctx = context();
    const result = await desktopClick.run({ x: 1, y: 1 }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Windows");
    expect(ctx.asked).toHaveLength(0);
  });
});

// -- Döngüde görsel ----------------------------------------------------------

function scriptedProvider(turns: ChatEvent[][]): ChatProvider & { seen: ChatMessage[][] } {
  let index = 0;
  const seen: ChatMessage[][] = [];
  return {
    id: "llamacpp",
    label: "test",
    capabilities: { tools: true, vision: true, embeddings: false, requiresApiKey: false },
    seen,
    isReady: async () => true,
    listModels: async () => [],
    chat: (messages) => {
      seen.push(messages.map((m) => ({ ...m })));
      const turn = turns[index] ?? [{ type: "done", finishReason: "stop" }];
      index += 1;
      return (async function* () {
        for (const event of turn) yield event;
      })();
    },
  };
}

const shotTool: Tool<Record<string, never>> = defineTool({
  name: "shot",
  description: "Sahte ekran görüntüsü",
  risk: "read",
  schema: z.object({}),
  async run() {
    return { content: "görüntü alındı", images: [{ base64: "QUJD", mimeType: "image/jpeg" }] };
  },
});

function call(id: string): ChatEvent {
  return { type: "tool_call", call: { id, name: "shot", arguments: "{}" } };
}

function options(provider: ChatProvider, vision: boolean) {
  return {
    provider,
    model: "test",
    messages: [{ role: "user" as const, content: "ekrana bak" }],
    tools: [shotTool as Tool<never>],
    workspaceRoot: "/tmp",
    gate: new ApprovalGate(1000),
    signal: new AbortController().signal,
    vision,
  };
}

const imageCount = (messages: ChatMessage[]) =>
  messages.filter(
    (m) => Array.isArray(m.content) && m.content.some((part) => part.type === "image"),
  ).length;

describe("ekran görüntüsü modele gider", () => {
  it("görüntüyü ayrı bir kullanıcı mesajı olarak ekler, yalnızca sonuncuyu tutar", async () => {
    const provider = scriptedProvider([
      [call("a"), { type: "done", finishReason: "tool_calls" }],
      [call("b"), { type: "done", finishReason: "tool_calls" }],
      [{ type: "text", delta: "bitti" }, { type: "done", finishReason: "stop" }],
    ]);
    const run = runAgent(options(provider, true));
    for await (const _event of run.events) {
      // tüket
    }
    const result = await run.result;

    const second = provider.seen[1]!;
    const last = second[second.length - 1]!;
    expect(last.role).toBe("user");
    expect(Array.isArray(last.content)).toBe(true);
    expect(imageCount(second)).toBe(1);

    // Üçüncü çağrıda da yalnızca bir görüntü var: eski olan kaldırıldı.
    expect(imageCount(provider.seen[2]!)).toBe(1);
    // Kalıcılaşacak konuşmada hiç görsel kalmaz.
    expect(imageCount(result.messages)).toBe(0);
    expect(result.finalText).toBe("bitti");
  });

  it("model görsel göremiyorsa görüntüyü göndermez, söyler", async () => {
    const provider = scriptedProvider([
      [call("a"), { type: "done", finishReason: "tool_calls" }],
      [{ type: "done", finishReason: "stop" }],
    ]);
    const run = runAgent(options(provider, false));
    for await (const _event of run.events) {
      // tüket
    }
    await run.result;
    const second = provider.seen[1]!;
    expect(imageCount(second)).toBe(0);
    const toolMessage = second.find((m) => m.role === "tool")!;
    expect(String(toolMessage.content)).toContain("görsel göremiyor");
  });
});
