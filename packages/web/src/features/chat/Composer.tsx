import { useEffect, useRef, useState } from "react";
import type { ChatImage } from "../../lib/api";
import { EFFORTS, type EffortId } from "../../lib/effort";
import { useAudio } from "../../stores/audio";
import { useUi } from "../../stores/ui";
import { ModelMenu, type ModelChoice } from "./ModelMenu";
import { Popover } from "./Popover";

/** Tarayici dosyayi zaten okuyabiliyor; sunucuya cozucu koymaya gerek yok. */
async function toChatImage(file: File): Promise<ChatImage & { preview: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Tek seferde apply etmek buyuk dosyada yigin sinirini asar.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const mimeType = file.type || "image/png";
  return { base64, mimeType, preview: `data:${mimeType};base64,${base64}` };
}

/**
 * Mesaj kutusu. Üstte metin, altta tek satır araç çubuğu:
 * [görsel] [ses]  ……  [model ▾] [efor ▾] [gönder]
 */
export function Composer({
  disabled,
  sending,
  canSendImages,
  choice,
  effort,
  onChoose,
  onEffort,
  onSend,
  onStop,
}: {
  disabled: boolean;
  sending: boolean;
  /** Görsel gönderilebilir mi: yüklü modelde görüntü kodlayıcı var mı. */
  canSendImages?: boolean;
  choice: ModelChoice | null;
  effort: EffortId;
  onChoose: (choice: ModelChoice) => void;
  onEffort: (effort: EffortId) => void;
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
}) {
  const t = useUi((s) => s.t);
  const [text, setText] = useState("");
  const [images, setImages] = useState<Array<ChatImage & { preview: string }>>([]);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Model değişip görsel desteği kalkarsa ekli görseller sessizce gitmesin.
  useEffect(() => {
    if (!canSendImages) setImages([]);
  }, [canSendImages]);

  const resize = () => {
    const element = areaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 260)}px`;
  };

  const attach = async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const loaded = await Promise.all(picked.slice(0, 4).map(toChatImage));
    setImages((prev) => [...prev, ...loaded].slice(0, 4));
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed, images.map(({ base64, mimeType }) => ({ base64, mimeType })));
    setText("");
    setImages([]);
    if (areaRef.current) areaRef.current.style.height = "auto";
  };

  const voice = useVoice((transcribed) => {
    setText((prev) => (prev ? `${prev.trimEnd()} ${transcribed}` : transcribed));
    requestAnimationFrame(() => {
      resize();
      areaRef.current?.focus();
    });
  });

  const currentEffort = EFFORTS.find((e) => e.id === effort) ?? EFFORTS[1]!;

  return (
    <form
      className="composer composer--card"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="composer__box">
        {images.length > 0 && (
          <ul className="composer__thumbs">
            {images.map((image, index) => (
              <li key={image.preview.slice(-24) + index} className="composer__thumb">
                <img src={image.preview} alt="" />
                <button
                  type="button"
                  className="composer__thumb-remove"
                  aria-label={t("chat.removeImage")}
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          ref={areaRef}
          className="composer__input"
          value={text}
          rows={1}
          placeholder={disabled ? t("chat.blockedPlaceholder") : t("chat.placeholder")}
          onChange={(event) => {
            setText(event.target.value);
            resize();
          }}
          onKeyDown={(event) => {
            // Enter gönderir, Shift+Enter satır atlar.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          onPaste={(event) => {
            const files = event.clipboardData?.files;
            if (files?.length && canSendImages) void attach(files);
          }}
        />

        <div className="composer__toolbar">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              void attach(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="tool-button"
            disabled={!canSendImages || images.length >= 4}
            title={canSendImages ? t("chat.attachImage") : t("chat.noVision")}
            aria-label={t("chat.attachImage")}
            onClick={() => fileRef.current?.click()}
          >
            <IconImage />
          </button>

          <button
            type="button"
            className={voice.recording ? "tool-button tool-button--recording" : "tool-button"}
            disabled={voice.busy || (!voice.available && !voice.recording)}
            title={
              voice.available
                ? voice.recording ? t("chat.voiceStop") : t("chat.voiceStart")
                : t("chat.voiceUnavailable")
            }
            aria-label={t("chat.voiceStart")}
            onClick={() => (voice.recording ? voice.stop() : void voice.start())}
          >
            {voice.busy ? <span className="spinner" /> : <IconMic />}
            {voice.recording && <span className="tool-button__timer">{voice.seconds}s</span>}
          </button>
          {voice.error && <span className="composer__voice-error">{voice.error}</span>}

          <span className="composer__spacer" />

          <ModelMenu choice={choice} onChoose={onChoose} />

          <Popover
            label={t(`effort.${currentEffort.id}`)}
            title={t("effort.title")}
            className="pill"
            align="right"
          >
            {(close) => (
              <ul className="menu">
                <li className="menu__heading">{t("effort.title")}</li>
                {EFFORTS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="menu__item"
                      aria-pressed={item.id === effort}
                      onClick={() => {
                        onEffort(item.id);
                        close();
                      }}
                    >
                      <span className="menu__item-main">{t(`effort.${item.id}`)}</span>
                      <span className="menu__item-sub">{t(`effort.${item.id}Hint`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>

          {sending ? (
            <button type="button" className="send-button send-button--stop" onClick={onStop}
              title={t("chat.stop")} aria-label={t("chat.stop")}>
              <span className="send-button__square" />
            </button>
          ) : (
            <button type="submit" className="send-button" disabled={disabled || !text.trim()}
              title={t("chat.send")} aria-label={t("chat.send")}>
              <IconArrowUp />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * Mikrofon -> yazı. Yerel whisper modeli varsa o, yoksa OpenAI anahtarı
 * varsa bulut kullanılır. Kayıt tarayıcıda 16 kHz WAV'a çevrilir.
 */
function useVoice(onText: (text: string) => void) {
  const t = useUi((s) => s.t);
  const { overview, refresh, transcribeBlob } = useAudio();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    if (!overview) void refresh();
  }, [overview, refresh]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((tr) => tr.stop()), []);

  const localModel = overview?.speech.binary ? overview.speech.models[0]?.filename : undefined;
  const provider: "local" | "openai" | null = localModel
    ? "local"
    : overview?.speech.cloudAvailable ? "openai" : null;

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instance = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      instance.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: instance.mimeType });
        if (blob.size === 0 || !provider) return;
        setBusy(true);
        await transcribeBlob(blob, {
          provider,
          model: localModel ?? "",
          language: "",
          translate: false,
        });
        const state = useAudio.getState();
        setBusy(false);
        if (state.transcript?.text.trim()) onTextRef.current(state.transcript.text.trim());
        else if (state.error) setError(state.error);
      };
      instance.start();
      recorder.current = instance;
      setSeconds(0);
      setRecording(true);
    } catch (err) {
      setError((err as Error).name === "NotAllowedError" ? t("audio.micDenied") : (err as Error).message);
    }
  };

  const stop = () => {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  };

  return { available: provider !== null, recording, busy, seconds, error, start, stop };
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M4 18l5-5 4 4 3-3 4 4" strokeLinejoin="round" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
