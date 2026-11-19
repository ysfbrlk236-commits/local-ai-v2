import { useCallback, useEffect, useRef, useState } from "react";
import { hsvToRgb, parseHex, rgbToHsv, toHex, type Hsv } from "../../lib/color";
import { useUi } from "../../stores/ui";

const SIZE = 200;

/**
 * Renk çemberi: açı = ton, merkezden uzaklık = doygunluk, alttaki sürgü =
 * parlaklık. Yanında R/G/B sayıları ve hex kodu; hangisi değişirse
 * diğerleri onu izler.
 */
export function ColorPicker({
  value,
  recent,
  onChange,
}: {
  value: string;
  recent: string[];
  onChange: (hex: string) => void;
}) {
  const t = useUi((s) => s.t);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(parseHex(value) ?? { r: 0, g: 0, b: 0 }));
  const [hexDraft, setHexDraft] = useState(value);
  const dragging = useRef(false);

  // Dışarıdan gelen değer değişirse (ör. hazır tema) iç durumu eşitle.
  useEffect(() => {
    const rgb = parseHex(value);
    if (!rgb) return;
    if (toHex(hsvToRgb(hsv)) !== value.toLowerCase()) setHsv(rgbToHsv(rgb));
    setHexDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Çemberi çiz: parlaklık değişince yeniden.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = ctx.createImageData(SIZE, SIZE);
    const r = SIZE / 2;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - r;
        const dy = y - r;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * SIZE + x) * 4;
        if (dist > r) {
          image.data[i + 3] = 0;
          continue;
        }
        let h = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (h < 0) h += 360;
        const rgb = hsvToRgb({ h, s: dist / r, v: hsv.v });
        image.data[i] = rgb.r;
        image.data[i + 1] = rgb.g;
        image.data[i + 2] = rgb.b;
        // Kenarda yumuşatma.
        image.data[i + 3] = dist > r - 1 ? Math.round((r - dist) * 255) : 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [hsv.v]);

  const emit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      const hex = toHex(hsvToRgb(next));
      setHexDraft(hex);
      onChange(hex);
    },
    [onChange],
  );

  const pick = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = SIZE / rect.width;
    const dx = (clientX - rect.left) * scale - SIZE / 2;
    const dy = (clientY - rect.top) * scale - SIZE / 2;
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (SIZE / 2));
    // Çok koyu bir renkten başlanırsa çember simsiyah kalır; parlat.
    emit({ h, s, v: hsv.v < 0.2 ? 0.85 : hsv.v });
  };

  const rgb = hsvToRgb(hsv);
  const angle = (hsv.h * Math.PI) / 180;
  const knobX = 50 + Math.cos(angle) * hsv.s * 50;
  const knobY = 50 + Math.sin(angle) * hsv.s * 50;

  const setChannel = (channel: "r" | "g" | "b", raw: string) => {
    const n = Math.max(0, Math.min(255, Number.parseInt(raw, 10) || 0));
    const next = { ...rgb, [channel]: n };
    const hex = toHex(next);
    setHsv(rgbToHsv(next));
    setHexDraft(hex);
    onChange(hex);
  };

  return (
    <div className="picker">
      <div className="picker__wheel">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          aria-label={t("theme.wheel")}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            pick(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => dragging.current && pick(event.clientX, event.clientY)}
          onPointerUp={() => {
            dragging.current = false;
          }}
        />
        <span
          className="picker__knob"
          style={{ left: `${knobX}%`, top: `${knobY}%`, background: toHex(rgb) }}
        />
      </div>

      <div className="picker__controls">
        <label className="picker__row">
          <span>{t("theme.brightness")}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={(event) => emit({ ...hsv, v: Number(event.target.value) / 100 })}
          />
        </label>

        <div className="picker__rgb">
          {(["r", "g", "b"] as const).map((channel) => (
            <label key={channel} className={`picker__channel picker__channel--${channel}`}>
              <span>{channel.toUpperCase()}</span>
              <input
                className="input input--compact"
                type="number"
                min={0}
                max={255}
                value={rgb[channel]}
                onChange={(event) => setChannel(channel, event.target.value)}
              />
            </label>
          ))}
        </div>

        <label className="picker__row">
          <span>HEX</span>
          <input
            className="input input--compact picker__hex"
            value={hexDraft}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => {
              setHexDraft(event.target.value);
              const parsed = parseHex(event.target.value);
              if (parsed) {
                setHsv(rgbToHsv(parsed));
                onChange(toHex(parsed));
              }
            }}
          />
          <span className="picker__preview" style={{ background: toHex(rgb) }} />
        </label>

        {recent.length > 0 && (
          <div className="picker__recent" aria-label={t("theme.recent")}>
            {recent.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch swatch--small"
                style={{ background: color }}
                title={color}
                onClick={() => {
                  const parsed = parseHex(color);
                  if (!parsed) return;
                  setHsv(rgbToHsv(parsed));
                  setHexDraft(color);
                  onChange(color);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
