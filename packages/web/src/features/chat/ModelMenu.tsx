import { useEffect } from "react";
import { useModels } from "../../stores/models";
import { useNav } from "../../stores/nav";
import { useUi } from "../../stores/ui";
import { Popover } from "./Popover";

export interface ModelChoice {
  provider: string;
  /** Yerel için dosya adı, bulut için model kimliği. */
  model: string;
}

/** Ücretsiz modeller üstte; aralarındaki sıra API'nin verdiği gibi kalır. */
function sortFreeFirst<T extends { free?: boolean }>(models: T[]): T[] {
  return [...models].sort((a, b) => Number(Boolean(b.free)) - Number(Boolean(a.free)));
}

function shortName(filename: string): string {
  return filename.replace(/\.gguf$/i, "").replace(/[-_.]Q\d.*$/i, "");
}

/**
 * Mesaj kutusundaki model seçici. Yalnızca indirilmiş yerel modeller ve
 * anahtarı girilmiş bulut sağlayıcıları listelenir; indirme Modeller
 * sekmesinde kalır. Yerel model seçilince motor o modelle yüklenir.
 */
export function ModelMenu({
  choice,
  onChoose,
}: {
  choice: ModelChoice | null;
  onChoose: (choice: ModelChoice) => void;
}) {
  const t = useUi((s) => s.t);
  const go = useNav((s) => s.go);
  const { local, engine, providers, providerModels, busy, refresh, loadProviderModels, loadEngine } =
    useModels();

  // Motor yüklenirken ilerlemeyi göstermek için durumu yokla.
  useEffect(() => {
    if (!busy && engine?.state !== "starting") return undefined;
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, [busy, engine?.state, refresh]);

  const chatModels = local.filter((m) => !m.isEmbedding);
  const cloud = providers.filter((p) => p.id !== "llamacpp" && p.hasKey);

  const onOpen = () => {
    void refresh();
    for (const provider of cloud) {
      if (!providerModels[provider.id]) void loadProviderModels(provider.id);
    }
  };

  let label: string;
  if (!choice) label = t("modelMenu.pick");
  else if (choice.provider === "llamacpp") {
    const loading = busy || engine?.state === "starting";
    label = loading
      ? `${shortName(choice.model)} · ${Math.round((engine?.progress ?? 0) * 100)}%`
      : shortName(choice.model);
  } else {
    const found = providerModels[choice.provider]?.find((m) => m.id === choice.model);
    label = found?.label ?? choice.model;
  }

  return (
    <Popover
      label={<span className="pill__text">{label}</span>}
      title={t("modelMenu.title")}
      className="pill pill--model"
      align="right"
      onOpen={onOpen}
    >
      {(close) => (
        <ul className="menu menu--models">
          <li className="menu__heading">{t("modelMenu.local")}</li>
          {chatModels.length === 0 && <li className="menu__empty">{t("modelMenu.noLocal")}</li>}
          {chatModels.map((m) => {
            const loaded = engine?.model === m.filename && engine.state === "ready";
            const selected = choice?.provider === "llamacpp" && choice.model === m.filename;
            return (
              <li key={m.filename}>
                <button
                  type="button"
                  className="menu__item"
                  aria-pressed={selected}
                  onClick={() => {
                    onChoose({ provider: "llamacpp", model: m.filename });
                    if (!loaded) void loadEngine(m.filename);
                    close();
                  }}
                >
                  <span className="menu__item-main">
                    {loaded && <span className="dot dot--ok" aria-label={t("modelMenu.loaded")} />}
                    {shortName(m.filename)}
                  </span>
                  <span className="menu__item-sub">
                    {[m.parameters, m.quantization, m.projector ? t("modelMenu.vision") : null,
                      m.fits ? null : t("modelMenu.tight")].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}

          {cloud.map((provider) => (
            <li key={provider.id} className="menu__group">
              <p className="menu__heading">{provider.label}</p>
              <ul>
                {sortFreeFirst(providerModels[provider.id] ?? []).slice(0, 12).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="menu__item"
                      aria-pressed={choice?.provider === provider.id && choice.model === m.id}
                      onClick={() => {
                        onChoose({ provider: provider.id, model: m.id });
                        close();
                      }}
                    >
                      <span className="menu__item-main">
                        {m.label}
                        {m.free && <span className="badge badge--free">{t("modelMenu.free")}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {!providerModels[provider.id] && <li className="menu__empty">…</li>}
              </ul>
            </li>
          ))}

          <li className="menu__footer">
            <button
              type="button"
              className="menu__link"
              onClick={() => {
                go("models");
                close();
              }}
            >
              {t("modelMenu.download")} →
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );
}
