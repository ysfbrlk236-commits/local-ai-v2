import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { authHeaders, terminalApi, type TerminalInfo } from "../../lib/api";
import { parseHex } from "../../lib/color";
import { LineEditor } from "../../lib/line-editor";
import { postEventStream } from "../../lib/sse";
import { readLocal, writeLocal } from "../../lib/storage";
import { useAppearance } from "../../stores/appearance";
import { useUi } from "../../stores/ui";

const HISTORY_KEY = "studio.terminal.history";

/** Hex rengi 24 bit ANSI ön plan koduna çevirir. */
function ansi(hex: string): string {
  const rgb = parseHex(hex);
  return rgb ? `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m` : "";
}

function formatPrompt(shell: string, cwd: string, color: string): { text: string; width: number } {
  const visible = shell === "PowerShell" ? `PS ${cwd}> ` : `${cwd} $ `;
  const body = shell === "PowerShell" ? `PS ${cwd}>` : `${cwd} $`;
  return { text: `${ansi(color)}\x1b[1m${body}\x1b[0m `, width: visible.length };
}

export function TerminalView() {
  const t = useUi((s) => s.t);
  const [sessions, setSessions] = useState<TerminalInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openNew = useCallback(async () => {
    try {
      const info = await terminalApi.create();
      setSessions((prev) => [...prev, info]);
      setActive(info.id);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Sekmeye dönünce sunucuda yaşayan oturumları geri getir.
  useEffect(() => {
    let cancelled = false;
    void terminalApi
      .list()
      .then(({ sessions: list }) => {
        if (cancelled) return;
        if (list.length === 0) void openNew();
        else {
          setSessions(list);
          setActive((current) => current ?? list[list.length - 1]!.id);
        }
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [openNew]);

  const close = async (id: string) => {
    await terminalApi.close(id).catch(() => undefined);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (active === id) setActive(next[next.length - 1]?.id ?? null);
      return next;
    });
  };

  return (
    <div className="terminal-view">
      <div className="terminal-tabs" role="tablist">
        {sessions.map((session, index) => (
          <div key={session.id} className="terminal-tab" aria-selected={session.id === active} role="tab">
            <button type="button" className="terminal-tab__label" onClick={() => setActive(session.id)}>
              {session.shell} {index + 1}
            </button>
            <button
              type="button"
              className="terminal-tab__close"
              aria-label={t("terminal.close")}
              onClick={() => void close(session.id)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="terminal-tab terminal-tab--new" onClick={() => void openNew()}>
          + {t("terminal.new")}
        </button>
        <span className="terminal-tabs__hint">{t("terminal.hint")}</span>
      </div>
      {error && <p className="chat__error" role="alert">{error}</p>}
      {sessions.map((session) => (
        <TerminalPane key={session.id} info={session} visible={session.id === active} />
      ))}
      {sessions.length === 0 && !error && <p className="chat__empty">{t("terminal.none")}</p>}
    </div>
  );
}

function TerminalPane({ info, visible }: { info: TerminalInfo; visible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const palette = useAppearance((s) => s.appearance.palette);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-mono") || "monospace",
      fontSize: 14,
      scrollback: 5000,
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    let stored: string[] = [];
    try {
      stored = JSON.parse(readLocal(HISTORY_KEY) ?? "[]") as string[];
    } catch {
      stored = [];
    }
    const editor = new LineEditor(stored);
    let busy = true;
    let shell = info.shell;

    const showPrompt = (cwd: string) => {
      const prompt = formatPrompt(shell, cwd, paletteRef.current.terminalPrompt);
      editor.setPrompt(prompt.text, prompt.width);
      busy = false;
      term.write(editor.redraw());
    };

    const abort = new AbortController();
    void (async () => {
      try {
        for await (const event of postEventStream(`/api/terminal/${info.id}/stream`, {}, {
          headers: authHeaders(),
          signal: abort.signal,
        })) {
          const data = event.data as Record<string, unknown>;
          if (event.event === "output") term.write(String(data["data"] ?? ""));
          else if (event.event === "prompt") showPrompt(String(data["cwd"] ?? ""));
          else if (event.event === "exit") {
            term.write(`\r\n\x1b[2m[kabuk kapandı: ${String(data["code"] ?? "?")}] Enter ile yeniden başlar\x1b[0m\r\n`);
            busy = false;
          }
        }
      } catch (err) {
        if (!abort.signal.aborted) term.write(`\r\n\x1b[31m${(err as Error).message}\x1b[0m\r\n`);
      }
    })();

    const dataSub = term.onData((data) => {
      // Seçim varken Ctrl+C kopyalar, kesmez.
      if (data === "\x03" && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
        term.clearSelection();
        return;
      }
      const result = editor.feed(data);
      if (result.echo) term.write(result.echo);
      for (const action of result.actions) {
        if (action.type === "submit") {
          writeLocal(HISTORY_KEY, JSON.stringify(editor.entries.slice(-200)));
          if (busy) {
            // Komut sürerken giden satır programın kendisine.
            void terminalApi.input(info.id, action.line, true);
          } else {
            busy = true;
            void terminalApi.input(info.id, action.line);
          }
        } else if (action.type === "interrupt") {
          term.write("\r\n");
          busy = true;
          void terminalApi.interrupt(info.id);
        } else if (action.type === "clear") {
          term.clear();
          term.write(editor.redraw());
        }
      }
    });

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // Gizli sekmede boyut sıfır; görünür olunca yeniden denenir.
      }
    });
    observer.observe(host);
    shell = info.shell;

    return () => {
      abort.abort();
      observer.disconnect();
      dataSub.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [info.id, info.shell]);

  // Tema renkleri değişince terminali de boya.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = {
      background: palette.terminalBg,
      foreground: palette.terminalText,
      cursor: palette.terminalPrompt,
      cursorAccent: palette.terminalBg,
      selectionBackground: `${palette.accent}55`,
    };
  }, [palette.terminalBg, palette.terminalText, palette.terminalPrompt, palette.accent]);

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // yoksay
      }
      termRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [visible]);

  return <div ref={hostRef} className="terminal-pane" hidden={!visible} />;
}
