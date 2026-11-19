import { useEffect, useState } from "react";
import type { Telemetry } from "@studio/shared";
import { api } from "../../lib/api";
import { useAppearance } from "../../stores/appearance";
import { useModels } from "../../stores/models";
import { useNav } from "../../stores/nav";
import { useUi } from "../../stores/ui";

const INTERVAL_MS = 2000;

function gb(mb: number): string {
  return (mb / 1024).toFixed(1);
}

function Meter({ label, value, total, text }: { label: string; value: number; total: number; text: string }) {
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  const level = ratio > 0.9 ? "high" : ratio > 0.7 ? "mid" : "low";
  return (
    <span className="status__item" title={`${label}: ${text}`}>
      <span className="status__label">{label}</span>
      <span className="status__meter">
        <span className={`status__fill status__fill--${level}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="status__value">{text}</span>
    </span>
  );
}

/** Üstteki canlı kaynak çubuğu. Tema sekmesinden açılıp kapanır, öğeleri seçilir. */
export function StatusBar() {
  const t = useUi((s) => s.t);
  const { showStatusBar, statusItems } = useAppearance((s) => s.appearance);
  const engine = useModels((s) => s.engine);
  const go = useNav((s) => s.go);
  const [data, setData] = useState<Telemetry | null>(null);

  useEffect(() => {
    if (!showStatusBar) return undefined;
    let cancelled = false;
    const poll = () =>
      void api
        .telemetry()
        .then((value) => !cancelled && setData(value))
        .catch(() => undefined);
    poll();
    const timer = setInterval(poll, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showStatusBar]);

  if (!showStatusBar) return null;

  const engineText =
    engine?.state === "ready"
      ? engine.model.replace(/\.gguf$/i, "")
      : engine?.state === "starting"
        ? `${t("status.loading")} ${Math.round((engine.progress ?? 0) * 100)}%`
        : t("status.noModel");

  return (
    <div className="status" role="status">
      {statusItems.model && (
        <button type="button" className="status__item status__model" onClick={() => go("models")}>
          <span className={`dot ${engine?.state === "ready" ? "dot--ok" : engine?.state === "starting" ? "dot--warn" : ""}`} />
          {engineText}
        </button>
      )}
      <span className="composer__spacer" />
      {data && statusItems.cpu && (
        <Meter label={t("status.cpu")} value={data.cpuUsagePercent} total={100} text={`${Math.round(data.cpuUsagePercent)}%`} />
      )}
      {data && statusItems.ram && (
        <Meter label={t("status.ram")} value={data.memoryUsedMb} total={data.memoryTotalMb}
          text={`${gb(data.memoryUsedMb)}/${gb(data.memoryTotalMb)} GB`} />
      )}
      {data && statusItems.vram && data.vramTotalMb > 0 && (
        <Meter label={t("status.vram")} value={data.vramUsedMb} total={data.vramTotalMb}
          text={`${gb(data.vramUsedMb)}/${gb(data.vramTotalMb)} GB`} />
      )}
      <button type="button" className="status__gear" title={t("nav.theme")} onClick={() => go("theme")}>
        ⚙
      </button>
    </div>
  );
}
