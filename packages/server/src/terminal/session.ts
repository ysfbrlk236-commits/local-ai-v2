import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { IS_WINDOWS } from "../config.js";

/**
 * Pipe tabanlı terminal oturumu.
 *
 * Native modül (node-pty) kuralı yüzünden gerçek bir sözde terminal yok:
 * kabuk stdin/stdout borularıyla konuşur. Bunun sonucu:
 *  - Satır düzenleme ve yankı istemcide (xterm.js) yapılır.
 *  - vim, htop gibi tam ekran programlar çalışmaz.
 *  - Ctrl+C sinyal gönderemez; çalışan komut ağacı öldürülüp kabuk aynı
 *    klasörde yeniden açılır.
 *
 * İstem (prompt) bilgisi için her komutun ardından kabuğa görünmez bir
 * işaret komutu yazılır: `\x1e<klasör>\x1f`. Çıktıdan bu işaret ayıklanır
 * ve "prompt" olayı olarak istemciye gider; böylece istemci komutun
 * bittiğini ve geçerli klasörü bilir.
 */

export const MARK_START = "\x1e";
export const MARK_END = "\x1f";
const MAX_SESSIONS = 8;
const SCROLLBACK_CHARS = 200_000;

export type TerminalEvent =
  | { type: "output"; data: string }
  | { type: "prompt"; cwd: string }
  | { type: "exit"; code: number | null };

type Listener = (event: TerminalEvent) => void;

export interface ShellSpec {
  command: string;
  args: string[];
  /** Açılışta bir kez yazılan hazırlık satırları. */
  init: string[];
  /** Geçerli klasörü işaretle birlikte basan komut. */
  marker: string;
  label: string;
}

export function defaultShell(windows = IS_WINDOWS): ShellSpec {
  if (windows) {
    return {
      command: "powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"],
      init: [
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
        "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
        "$OutputEncoding = [System.Text.Encoding]::UTF8",
        "$ProgressPreference = 'SilentlyContinue'",
      ],
      marker:
        "[Console]::Out.Write([string][char]30 + $PWD.Path + [string][char]31 + [string][char]10); [Console]::Out.Flush()",
      label: "PowerShell",
    };
  }
  const bash = ["/bin/bash", "/usr/bin/bash"].find((p) => fs.existsSync(p));
  return {
    command: bash ?? "/bin/sh",
    args: bash ? ["--noprofile", "--norc"] : [],
    init: ["exec 2>&1", "export TERM=dumb"],
    marker: "printf '\\036%s\\037\\n' \"$PWD\"",
    label: bash ? "bash" : "sh",
  };
}

/**
 * Çıktı akışından işaretleri ayıklar. İşaret parça sınırında bölünebilir;
 * tamamlanmamış işaret bir sonraki parçaya kadar bekletilir.
 */
export class MarkerParser {
  private pending = "";

  push(chunk: string): TerminalEvent[] {
    const events: TerminalEvent[] = [];
    let text = this.pending + chunk;
    this.pending = "";

    while (text.length > 0) {
      const start = text.indexOf(MARK_START);
      if (start === -1) {
        events.push({ type: "output", data: text });
        break;
      }
      if (start > 0) events.push({ type: "output", data: text.slice(0, start) });
      const end = text.indexOf(MARK_END, start + 1);
      if (end === -1) {
        this.pending = text.slice(start);
        break;
      }
      events.push({ type: "prompt", cwd: text.slice(start + 1, end) });
      // İşaretin ardındaki satır sonu da işaretin parçası.
      let next = end + 1;
      if (text[next] === "\r") next += 1;
      if (text[next] === "\n") next += 1;
      text = text.slice(next);
    }
    return events;
  }
}

export class TerminalSession {
  readonly id = randomUUID();
  readonly shell: ShellSpec;
  cwd: string;
  private child: ChildProcess | null = null;
  private parser = new MarkerParser();
  private scrollback = "";
  private listeners = new Set<Listener>();
  private disposed = false;

  constructor(cwd: string, shell: ShellSpec = defaultShell()) {
    this.cwd = cwd;
    this.shell = shell;
    this.start();
  }

  private start(): void {
    this.parser = new MarkerParser();
    const child = spawn(this.shell.command, this.shell.args, {
      cwd: this.cwd,
      env: { ...process.env, TERM: "dumb", PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
      detached: !IS_WINDOWS,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;

    const onData = (chunk: string) => {
      for (const event of this.parser.push(chunk)) this.emit(event);
    };
    child.stdout?.setEncoding("utf8").on("data", onData);
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) =>
      this.emit({ type: "output", data: chunk }),
    );
    child.stdin?.on("error", () => {
      // Kabuk kapandıysa yazma hatası beklenir; exit olayı zaten gidiyor.
    });
    child.once("error", (err) => {
      this.emit({ type: "output", data: `\r\nKabuk başlatılamadı: ${err.message}\r\n` });
      this.emit({ type: "exit", code: null });
    });
    child.once("exit", (code) => {
      if (this.child === child) {
        this.child = null;
        if (!this.disposed) this.emit({ type: "exit", code });
      }
    });

    for (const line of this.shell.init) this.writeRaw(line);
    this.writeRaw(this.shell.marker);
  }

  get alive(): boolean {
    return this.child !== null;
  }

  /** Kullanıcının yazdığı satırı kabuğa yollar ve ardından istem işaretini ister. */
  input(line: string): void {
    if (!this.child) this.start();
    // Yeniden bağlanan istemci geçmişte komutları da görsün.
    this.scrollback = (this.scrollback + `\x1b[2m${this.cwd} > ${line}\x1b[0m\n`).slice(-SCROLLBACK_CHARS);
    // Tek satırlık komutlarla çalışırız; içerideki satır sonları ayrı komut olur.
    for (const part of line.replace(/\r\n?/g, "\n").split("\n")) this.writeRaw(part);
    this.writeRaw(this.shell.marker);
  }

  /** İşaret eklemeden yazar: çalışan programın stdin'ine giden cevap. */
  write(line: string): void {
    this.writeRaw(line);
  }

  /** Ctrl+C karşılığı: çalışan ağacı öldür, aynı klasörde yeni kabuk aç. */
  interrupt(): void {
    const old = this.child;
    this.child = null;
    killTree(old?.pid);
    this.emit({ type: "output", data: "^C\r\n" });
    if (!this.disposed) this.start();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get history(): string {
    return this.scrollback;
  }

  dispose(): void {
    this.disposed = true;
    const child = this.child;
    this.child = null;
    killTree(child?.pid);
    this.listeners.clear();
  }

  private writeRaw(line: string): void {
    this.child?.stdin?.write(`${line}\n`);
  }

  private emit(event: TerminalEvent): void {
    if (event.type === "prompt") this.cwd = event.cwd;
    if (event.type === "output") {
      this.scrollback = (this.scrollback + event.data).slice(-SCROLLBACK_CHARS);
    }
    for (const listener of this.listeners) listener(event);
  }
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (IS_WINDOWS) {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => {});
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Zaten bitmiş.
    }
  }
}

// -- Oturum kaydı ---------------------------------------------------------------

const sessions = new Map<string, TerminalSession>();

export function createTerminal(cwd?: string): TerminalSession {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(`En fazla ${MAX_SESSIONS} terminal açılabilir.`);
  }
  const dir = cwd && isDirectory(cwd) ? cwd : os.homedir();
  const session = new TerminalSession(dir);
  sessions.set(session.id, session);
  return session;
}

export function getTerminal(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

export function listTerminals(): TerminalSession[] {
  return [...sessions.values()];
}

export function closeTerminal(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.dispose();
  sessions.delete(id);
  return true;
}

export function closeAllTerminals(): void {
  for (const id of [...sessions.keys()]) closeTerminal(id);
}

function isDirectory(value: string): boolean {
  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}
