import { useRef, useState } from "react";
import {
  PRESETS,
  REGIONS,
  compressImage,
  useAppearance,
  type RegionKey,
  type StatusBarItems,
} from "../../stores/appearance";
import { useUi } from "../../stores/ui";
import { ColorPicker } from "./ColorPicker";

const GROUPS = ["general", "layout", "chat", "terminal"] as const;

export function ThemeView() {
  const t = useUi((s) => s.t);
  const {
    appearance, image, saved, recentColors,
    update, setColor, applyPreset, setImage, saveCurrent, loadSaved, deleteSaved,
    exportJson, importJson, reset,
  } = useAppearance();
  const [selected, setSelected] = useState<RegionKey>("accent");
  const [themeName, setThemeName] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      setImage(await compressImage(file));
    } catch (err) {
      setImageError((err as Error).message);
    }
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "local-ai-studio-tema.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleItem = (key: keyof StatusBarItems) =>
    update({ statusItems: { ...appearance.statusItems, [key]: !appearance.statusItems[key] } });

  return (
    <div className="main__inner theme">
      <header>
        <h1 className="page-title">{t("theme.title")}</h1>
        <p className="page-lead">{t("theme.lead")}</p>
      </header>

      {/* Hazır temalar */}
      <section className="card">
        <h2 className="card__title">{t("theme.presets")}</h2>
        <div className="presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset"
              aria-pressed={appearance.presetId === preset.id}
              onClick={() => applyPreset(preset.id)}
            >
              <span className="preset__mock" style={{ background: preset.palette.bg }}>
                <span style={{ background: preset.palette.sidebar }} className="preset__side" />
                <span className="preset__body">
                  <span style={{ background: preset.palette.chatBar }} className="preset__bar" />
                  <span style={{ background: preset.palette.userBubble }} className="preset__bubble" />
                  <span style={{ background: preset.palette.accent }} className="preset__dot" />
                </span>
              </span>
              <span className="preset__name">{preset.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Bölge renkleri + renk çemberi */}
      <section className="card">
        <h2 className="card__title">{t("theme.regions")}</h2>
        <p className="card__hint">{t("theme.regionsHint")}</p>
        <div className="regions">
          <div className="regions__list">
            {GROUPS.map((group) => (
              <div key={group} className="regions__group">
                <p className="regions__group-title">{t(`theme.group.${group}`)}</p>
                {REGIONS.filter((r) => r.group === group).map((region) => (
                  <button
                    key={region.key}
                    type="button"
                    className="region"
                    aria-pressed={selected === region.key}
                    onClick={() => setSelected(region.key)}
                  >
                    <span className="swatch" style={{ background: appearance.palette[region.key] }} />
                    <span className="region__label">{t(`theme.region.${region.key}`)}</span>
                    <code className="region__hex">{appearance.palette[region.key]}</code>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="regions__picker">
            <p className="regions__editing">
              {t("theme.editing")}: <strong>{t(`theme.region.${selected}`)}</strong>
            </p>
            <ColorPicker
              value={appearance.palette[selected]}
              recent={recentColors}
              onChange={(hex) => setColor(selected, hex)}
            />
          </div>
        </div>
      </section>

      {/* Arka plan */}
      <section className="card">
        <h2 className="card__title">{t("theme.background")}</h2>
        <div className="bg-editor">
          <div
            className="bg-editor__preview"
            style={image ? { backgroundImage: `url("${image}")` } : undefined}
          >
            {!image && <span>{t("theme.noImage")}</span>}
          </div>
          <div className="bg-editor__controls">
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                void pickImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="row">
              <button type="button" className="button" onClick={() => imageInput.current?.click()}>
                {t("theme.chooseImage")}
              </button>
              {image && (
                <button type="button" className="button button--ghost" onClick={() => setImage(null)}>
                  {t("theme.removeImage")}
                </button>
              )}
            </div>
            {imageError && <p className="model__error">{imageError}</p>}
            <Slider label={t("theme.blur")} min={0} max={30} value={appearance.bgBlur} suffix="px"
              onChange={(v) => update({ bgBlur: v })} />
            <Slider label={t("theme.dim")} min={0} max={80} value={Math.round(appearance.bgDim * 100)} suffix="%"
              onChange={(v) => update({ bgDim: v / 100 })} />
            <Slider label={t("theme.panelOpacity")} min={30} max={100} value={Math.round(appearance.panelOpacity * 100)} suffix="%"
              onChange={(v) => update({ panelOpacity: v / 100 })} />
          </div>
        </div>
      </section>

      {/* Yerleşim */}
      <section className="card">
        <h2 className="card__title">{t("theme.layout")}</h2>
        <div className="theme__grid">
          <Slider label={t("theme.fontSize")} min={85} max={125} value={Math.round(appearance.fontScale * 100)} suffix="%"
            onChange={(v) => update({ fontScale: v / 100 })} />
          <Slider label={t("theme.radius")} min={0} max={20} value={appearance.radius} suffix="px"
            onChange={(v) => update({ radius: v })} />
          <Slider label={t("theme.sidebarWidth")} min={11} max={22} value={appearance.sidebarWidth} suffix="rem"
            onChange={(v) => update({ sidebarWidth: v })} />
          <label className="check">
            <input type="checkbox" checked={appearance.bubbles} onChange={() => update({ bubbles: !appearance.bubbles })} />
            {t("theme.bubbles")}
          </label>
          <label className="check">
            <input type="checkbox" checked={appearance.base === "light"}
              onChange={() => update({ base: appearance.base === "light" ? "dark" : "light" })} />
            {t("theme.lightControls")}
          </label>
        </div>
      </section>

      {/* Üst durum çubuğu */}
      <section className="card">
        <h2 className="card__title">{t("theme.statusBar")}</h2>
        <div className="theme__grid">
          <label className="check">
            <input type="checkbox" checked={appearance.showStatusBar}
              onChange={() => update({ showStatusBar: !appearance.showStatusBar })} />
            {t("theme.showStatusBar")}
          </label>
          {(["cpu", "ram", "vram", "model"] as const).map((key) => (
            <label key={key} className="check">
              <input type="checkbox" disabled={!appearance.showStatusBar}
                checked={appearance.statusItems[key]} onChange={() => toggleItem(key)} />
              {t(`status.${key}`)}
            </label>
          ))}
        </div>
      </section>

      {/* Temalarım */}
      <section className="card">
        <h2 className="card__title">{t("theme.mine")}</h2>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            saveCurrent(themeName);
            setThemeName("");
          }}
        >
          <input className="input" placeholder={t("theme.namePlaceholder")} value={themeName}
            maxLength={40} onChange={(event) => setThemeName(event.target.value)} />
          <button type="submit" className="button" disabled={!themeName.trim()}>{t("theme.save")}</button>
        </form>
        {saved.length > 0 && (
          <ul className="saved-themes">
            {saved.map((item) => (
              <li key={item.name} className="saved-themes__item">
                <span className="swatch" style={{ background: item.appearance.palette.accent }} />
                <span className="saved-themes__name">{item.name}</span>
                <button type="button" className="button button--ghost" onClick={() => loadSaved(item.name)}>
                  {t("theme.apply")}
                </button>
                <button type="button" className="button button--ghost" onClick={() => deleteSaved(item.name)}>
                  {t("theme.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" className="button button--ghost" onClick={download}>{t("theme.export")}</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setImportError(!importJson(await file.text()));
            }} />
          <button type="button" className="button button--ghost" onClick={() => importInput.current?.click()}>
            {t("theme.import")}
          </button>
          <button type="button" className="button button--ghost" onClick={reset}>{t("theme.reset")}</button>
        </div>
        {importError && <p className="model__error">{t("theme.importError")}</p>}
      </section>
    </div>
  );
}

function Slider({
  label, min, max, value, suffix, onChange,
}: {
  label: string; min: number; max: number; value: number; suffix: string; onChange: (value: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider__head">
        <span>{label}</span>
        <span className="slider__value">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
