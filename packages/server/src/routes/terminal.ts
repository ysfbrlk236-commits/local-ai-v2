import { z } from "zod";
import { EventStream } from "../http/sse.js";
import { HttpError } from "../http/errors.js";
import type { Router } from "../http/router.js";
import {
  closeTerminal,
  createTerminal,
  getTerminal,
  listTerminals,
  type TerminalSession,
} from "../terminal/session.js";

/**
 * Terminal uçları. Ajanın `run_command` aracından farklı olarak burada
 * onay kapısı yok: komutu kullanıcı kendi eliyle yazıyor, tıpkı kendi
 * terminalinde olduğu gibi. Erişim yine oturum token'ı ve 127.0.0.1 ile
 * sınırlı.
 */

const CreateBody = z.object({ cwd: z.string().max(4096).optional() });
/** `raw`: komut çalışırken programın kendisine giden satır (ör. "e/h" sorusu). */
const InputBody = z.object({ line: z.string().max(100_000), raw: z.boolean().optional() });

function describe(session: TerminalSession) {
  return { id: session.id, shell: session.shell.label, cwd: session.cwd, alive: session.alive };
}

function find(id: string | undefined): TerminalSession {
  const session = id ? getTerminal(id) : undefined;
  if (!session) throw HttpError.notFound("Terminal oturumu bulunamadı.");
  return session;
}

export function registerTerminalRoutes(router: Router): void {
  router.get("/api/terminal", {}, () => ({ sessions: listTerminals().map(describe) }));

  router.post("/api/terminal", { body: CreateBody }, ({ body }) => {
    try {
      return describe(createTerminal(body.cwd));
    } catch (err) {
      throw HttpError.conflict("terminal_limit", (err as Error).message);
    }
  });

  /** Çıktı akışı. Önce birikmiş geçmiş, sonra canlı olaylar gelir. */
  router.post("/api/terminal/:id/stream", {}, ({ res, params }) => {
    const session = find(params["id"]);
    const stream = new EventStream(res);
    if (session.history) stream.send("output", { data: session.history });
    stream.send("prompt", { cwd: session.cwd });
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "output") stream.send("output", { data: event.data });
      else if (event.type === "prompt") stream.send("prompt", { cwd: event.cwd });
      else stream.send("exit", { code: event.code });
    });
    const keepAlive = setInterval(() => {
      if (stream.isClosed) return;
      res.write(": ping\n\n");
    }, 15_000);
    res.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
    return undefined;
  });

  router.post("/api/terminal/:id/input", { body: InputBody }, ({ params, body }) => {
    const session = find(params["id"]);
    if (body.raw) session.write(body.line);
    else session.input(body.line);
    return { ok: true };
  });

  router.post("/api/terminal/:id/interrupt", {}, ({ params }) => {
    find(params["id"]).interrupt();
    return { ok: true };
  });

  router.del("/api/terminal/:id", {}, ({ params }) => {
    if (!closeTerminal(params["id"] ?? "")) throw HttpError.notFound("Terminal oturumu bulunamadı.");
    return { ok: true };
  });
}
