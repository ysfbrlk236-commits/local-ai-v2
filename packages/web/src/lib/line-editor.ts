/**
 * Terminal satır düzenleyici.
 *
 * Kabuk boru üzerinden çalıştığı için yankı, imleç ve geçmiş istemcide
 * tutulur. Bu sınıf xterm'in `onData` dizgilerini alır ve ekrana yazılacak
 * metni ve yapılacak işi döner; xterm'e bağımlı değil, böylece test
 * edilebilir.
 */

export type EditorAction =
  | { type: "submit"; line: string }
  | { type: "interrupt" }
  | { type: "clear" };

export interface EditorResult {
  /** Terminale yazılacak ham metin (yankı ve imleç hareketleri). */
  echo: string;
  actions: EditorAction[];
}

const HISTORY_LIMIT = 500;

export class LineEditor {
  line = "";
  cursor = 0;
  prompt = "";
  /** Görünür istem uzunluğu (renk kodları hariç). */
  promptWidth = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private draft = "";

  constructor(history: string[] = []) {
    this.history = history.slice(-HISTORY_LIMIT);
  }

  get entries(): string[] {
    return this.history;
  }

  setPrompt(prompt: string, width: number): void {
    this.prompt = prompt;
    this.promptWidth = width;
  }

  /** Satırı istemle birlikte baştan çizer. */
  redraw(): string {
    const back = this.line.length - this.cursor;
    return `\r\x1b[K${this.prompt}${this.line}${back > 0 ? `\x1b[${back}D` : ""}`;
  }

  feed(data: string): EditorResult {
    let echo = "";
    const actions: EditorAction[] = [];

    // Yapıştırma: birden çok karakter ve kaçış dizisi değil.
    if (data.length > 1 && !data.startsWith("\x1b")) {
      const parts = data.replace(/\r\n?/g, "\n").split("\n");
      parts.forEach((part, index) => {
        const result = this.insert(part.replace(/[\x00-\x1f]/g, ""));
        echo += result;
        if (index < parts.length - 1) {
          const submitted = this.submit();
          echo += submitted.echo;
          actions.push(...submitted.actions);
        }
      });
      return { echo, actions };
    }

    switch (data) {
      case "\r":
      case "\n":
        return this.submit();
      case "\x7f":
      case "\b":
        if (this.cursor > 0) {
          this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor);
          this.cursor -= 1;
          echo = this.redraw();
        }
        break;
      case "\x1b[3~":
        if (this.cursor < this.line.length) {
          this.line = this.line.slice(0, this.cursor) + this.line.slice(this.cursor + 1);
          echo = this.redraw();
        }
        break;
      case "\x1b[D":
        if (this.cursor > 0) {
          this.cursor -= 1;
          echo = "\x1b[D";
        }
        break;
      case "\x1b[C":
        if (this.cursor < this.line.length) {
          this.cursor += 1;
          echo = "\x1b[C";
        }
        break;
      case "\x1b[H":
      case "\x1b[1~":
      case "\x01":
        this.cursor = 0;
        echo = this.redraw();
        break;
      case "\x1b[F":
      case "\x1b[4~":
      case "\x05":
        this.cursor = this.line.length;
        echo = this.redraw();
        break;
      case "\x1b[A":
        echo = this.browse(-1);
        break;
      case "\x1b[B":
        echo = this.browse(1);
        break;
      case "\x15":
        this.line = "";
        this.cursor = 0;
        echo = this.redraw();
        break;
      case "\x03":
        this.line = "";
        this.cursor = 0;
        this.historyIndex = -1;
        actions.push({ type: "interrupt" });
        break;
      case "\x0c":
        actions.push({ type: "clear" });
        break;
      case "\t":
        echo = this.insert("  ");
        break;
      default:
        if (data.startsWith("\x1b")) break; // tanınmayan kaçış dizisi
        if (data >= " " || data.length > 1) echo = this.insert(data);
    }
    return { echo, actions };
  }

  private insert(text: string): string {
    if (!text) return "";
    this.line = this.line.slice(0, this.cursor) + text + this.line.slice(this.cursor);
    this.cursor += text.length;
    return this.cursor === this.line.length ? text : this.redraw();
  }

  private submit(): EditorResult {
    const line = this.line;
    if (line.trim() && this.history[this.history.length - 1] !== line) {
      this.history.push(line);
      if (this.history.length > HISTORY_LIMIT) this.history.shift();
    }
    this.line = "";
    this.cursor = 0;
    this.historyIndex = -1;
    this.draft = "";
    return { echo: "\r\n", actions: [{ type: "submit", line }] };
  }

  private browse(direction: -1 | 1): string {
    if (this.history.length === 0) return "";
    if (this.historyIndex === -1) {
      if (direction === 1) return "";
      this.draft = this.line;
      this.historyIndex = this.history.length - 1;
    } else {
      this.historyIndex += direction;
    }
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      this.line = this.draft;
    } else {
      this.line = this.history[this.historyIndex] ?? "";
    }
    this.cursor = this.line.length;
    return this.redraw();
  }
}
