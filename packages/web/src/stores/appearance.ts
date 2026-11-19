import { create } from "zustand";
import { readableOn, withAlpha } from "../lib/color";
import { readLocal, writeLocal } from "../lib/storage";

/**
 * Kişisel görünüm: her arayüz bölgesine ayrı renk, arka plan görseli,
 * yazı boyutu, köşe yuvarlaklığı ve üst durum çubuğu.
 *
 * Tüm değerler CSS değişkeni olarak köke yazılır; bileşenler ham renk
 * kullanmaz. Görsel ayrı anahtarda tutulur, çünkü büyük ve tema
 * kaydedilirken/paylaşılırken çoğu zaman istenmez.
 */

export const REGIONS = [
  { key: "accent", css: "--accent", group: "general" },
  { key: "bg", css: "--bg", group: "general" },
  { key: "raised", css: "--bg-raised", group: "general" },
  { key: "sunken", css: "--bg-sunken", group: "general" },
  { key: "text", css: "--text", group: "general" },
  { key: "textMuted", css: "--text-muted", group: "general" },
  { key: "border", css: "--border", group: "general" },
  { key: "sidebar", css: "--sidebar-bg", group: "layout" },
  { key: "sidebarText", css: "--sidebar-text", group: "layout" },
  { key: "sidebarActive", css: "--sidebar-active", group: "layout" },
  { key: "topbar", css: "--topbar-bg", group: "layout" },
  { key: "conversations", css: "--convlist-bg", group: "chat" },
  { key: "chatBar", css: "--bar-bg", group: "chat" },
  { key: "chatArea", css: "--chat-bg", group: "chat" },
  { key: "userBubble", css: "--bubble-user", group: "chat" },
  { key: "assistantBubble", css: "--bubble-assistant", group: "chat" },
  { key: "composer", css: "--composer-bg", group: "chat" },
  { key: "terminalBg", css: "--terminal-bg", group: "terminal" },
  { key: "terminalText", css: "--terminal-text", group: "terminal" },
  { key: "terminalPrompt", css: "--terminal-prompt", group: "terminal" },
] as const;

export type RegionKey = (typeof REGIONS)[number]["key"];
export type Palette = Record<RegionKey, string>;

/** Saydamlaşabilen, yani arka plan görseli varken altını gösteren yüzeyler. */
const SURFACES: RegionKey[] = [
  "bg", "raised", "sunken", "sidebar", "topbar", "conversations", "chatBar",
  "chatArea", "composer", "assistantBubble",
];

export interface ThemePreset {
  id: string;
  name: string;
  base: "light" | "dark";
  palette: Palette;
}

const forest: Palette = {
  accent: "#8fbf9f", bg: "#14150f", raised: "#1c1d17", sunken: "#0e0f0a",
  text: "#eceade", textMuted: "#9c9c8f", border: "#2b2d24",
  sidebar: "#0e0f0a", sidebarText: "#eceade", sidebarActive: "#24261e", topbar: "#101109",
  conversations: "#121309", chatBar: "#1c1d17", chatArea: "#14150f",
  userBubble: "#2a3a2f", assistantBubble: "#1c1d17", composer: "#1c1d17",
  terminalBg: "#0b0c08", terminalText: "#d8e8d0", terminalPrompt: "#8fbf9f",
};

export const PRESETS: ThemePreset[] = [
  { id: "forest", name: "Orman", base: "dark", palette: forest },
  {
    id: "paper", name: "Kağıt", base: "light",
    palette: {
      accent: "#3a5f4b", bg: "#fbfbfa", raised: "#ffffff", sunken: "#f2f2ef",
      text: "#1a1a18", textMuted: "#6b6b64", border: "#e2e2dd",
      sidebar: "#f2f2ef", sidebarText: "#1a1a18", sidebarActive: "#e4e4de", topbar: "#ffffff",
      conversations: "#f7f7f4", chatBar: "#ffffff", chatArea: "#fbfbfa",
      userBubble: "#e3eee7", assistantBubble: "#ffffff", composer: "#ffffff",
      terminalBg: "#1e1e1c", terminalText: "#eaeae4", terminalPrompt: "#7fbf8f",
    },
  },
  {
    id: "midnight", name: "Gece mavisi", base: "dark",
    palette: {
      accent: "#6ea8ff", bg: "#0d1220", raised: "#141b2d", sunken: "#090d18",
      text: "#e4e9f5", textMuted: "#8b95ad", border: "#222c45",
      sidebar: "#090d18", sidebarText: "#cfd8ee", sidebarActive: "#1a2440", topbar: "#0b1020",
      conversations: "#0b1120", chatBar: "#141b2d", chatArea: "#0d1220",
      userBubble: "#1d3260", assistantBubble: "#141b2d", composer: "#141b2d",
      terminalBg: "#060912", terminalText: "#c9d6ff", terminalPrompt: "#6ea8ff",
    },
  },
  {
    id: "matrix", name: "Terminal yeşili", base: "dark",
    palette: {
      accent: "#39ff88", bg: "#050805", raised: "#0b120b", sunken: "#020402",
      text: "#c8ffd8", textMuted: "#5fa874", border: "#163a1f",
      sidebar: "#020402", sidebarText: "#7dff9f", sidebarActive: "#0f2a16", topbar: "#030603",
      conversations: "#040704", chatBar: "#0b120b", chatArea: "#050805",
      userBubble: "#0f3a1c", assistantBubble: "#0b120b", composer: "#0b120b",
      terminalBg: "#000000", terminalText: "#39ff88", terminalPrompt: "#a0ffc4",
    },
  },
  {
    id: "sunset", name: "Gün batımı", base: "dark",
    palette: {
      accent: "#ff9e64", bg: "#1a1020", raised: "#24162b", sunken: "#120a17",
      text: "#f6e6ee", textMuted: "#b195a6", border: "#3a2440",
      sidebar: "#2a1230", sidebarText: "#ffd7c0", sidebarActive: "#47203f", topbar: "#1d0f22",
      conversations: "#1f1025", chatBar: "#2b1530", chatArea: "#1a1020",
      userBubble: "#5a2a3a", assistantBubble: "#24162b", composer: "#24162b",
      terminalBg: "#120812", terminalText: "#ffd7c0", terminalPrompt: "#ff9e64",
    },
  },
  {
    id: "crimson", name: "Kızıl", base: "dark",
    palette: {
      accent: "#ff2e4d", bg: "#0c0a0b", raised: "#171214", sunken: "#060505",
      text: "#f5f0f1", textMuted: "#a08a8e", border: "#3a1c22",
      sidebar: "#c8102e", sidebarText: "#ffffff", sidebarActive: "#8e0b21", topbar: "#0c0a0b",
      conversations: "#120e0f", chatBar: "#000000", chatArea: "#0c0a0b",
      userBubble: "#5c0f1d", assistantBubble: "#171214", composer: "#171214",
      terminalBg: "#000000", terminalText: "#f5f0f1", terminalPrompt: "#ff2e4d",
    },
  },
];

export interface StatusBarItems {
  cpu: boolean;
  ram: boolean;
  vram: boolean;
  model: boolean;
}

export interface Appearance {
  presetId: string;
  base: "light" | "dark";
  palette: Palette;
  /** 0.85 - 1.25 */
  fontScale: number;
  /** px */
  radius: number;
  /** rem */
  sidebarWidth: number;
  bgBlur: number;
  /** 0-0.8: görselin üstüne serilen karartma. */
  bgDim: number;
  /** 0.3-1: görsel varken panellerin opaklığı. */
  panelOpacity: number;
  bubbles: boolean;
  showStatusBar: boolean;
  statusItems: StatusBarItems;
}

export interface SavedTheme {
  name: string;
  appearance: Appearance;
}

const KEY = "studio.appearance";
const IMAGE_KEY = "studio.appearance.image";
const SAVED_KEY = "studio.appearance.saved";
const RECENT_KEY = "studio.appearance.recent";

export function defaultAppearance(): Appearance {
  const dark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const preset = PRESETS.find((p) => p.id === (dark ? "forest" : "paper"))!;
  return {
    presetId: preset.id,
    base: preset.base,
    palette: { ...preset.palette },
    fontScale: 1,
    radius: 8,
    sidebarWidth: 15,
    bgBlur: 0,
    bgDim: 0.35,
    panelOpacity: 0.82,
    bubbles: true,
    showStatusBar: true,
    statusItems: { cpu: true, ram: true, vram: true, model: true },
  };
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Eski ya da eksik kayıtları varsayılanlarla tamamlar. */
export function normalize(value: Partial<Appearance> | null): Appearance {
  const base = defaultAppearance();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    palette: { ...base.palette, ...(value.palette ?? {}) },
    statusItems: { ...base.statusItems, ...(value.statusItems ?? {}) },
  };
}

/** Görünümü CSS değişkenlerine çevirir. Test edilebilsin diye saf. */
export function cssVariables(a: Appearance, hasImage: boolean): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const region of REGIONS) {
    const color = a.palette[region.key];
    const alpha = hasImage && SURFACES.includes(region.key) ? a.panelOpacity : 1;
    vars[region.css] = withAlpha(color, alpha);
  }
  vars["--accent-text"] = readableOn(a.palette.accent);
  vars["--border-strong"] = a.palette.textMuted;
  vars["--text-faint"] = withAlpha(a.palette.textMuted, 0.75);
  vars["--bubble-user-text"] = readableOn(a.palette.userBubble) === "#111111" ? "#111111" : a.palette.text;
  vars["--radius"] = `${a.radius}px`;
  vars["--radius-lg"] = `${Math.round(a.radius * 1.6)}px`;
  vars["--sidebar-width"] = `${a.sidebarWidth}rem`;
  vars["--font-scale"] = String(a.fontScale);
  vars["--bg-blur"] = `${a.bgBlur}px`;
  vars["--bg-dim"] = String(a.bgDim);
  return vars;
}

export function applyAppearance(a: Appearance, image: string | null): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  for (const [name, value] of Object.entries(cssVariables(a, Boolean(image)))) {
    root.style.setProperty(name, value);
  }
  root.style.fontSize = `${100 * a.fontScale}%`;
  root.dataset["theme"] = a.base;
  root.dataset["bubbles"] = a.bubbles ? "on" : "off";
  if (image) {
    root.style.setProperty("--bg-image", `url("${image}")`);
    root.dataset["bgImage"] = "on";
  } else {
    root.style.removeProperty("--bg-image");
    delete root.dataset["bgImage"];
  }
}

/**
 * Seçilen görseli küçültüp JPEG'e çevirir: localStorage ~5 MB ile sınırlı,
 * telefondan gelen 12 MP fotoğraf olduğu gibi sığmaz.
 */
export async function compressImage(file: File, maxSide = 1920, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Görsel okunamadı."));
      element.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tuval açılamadı.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface AppearanceState {
  appearance: Appearance;
  image: string | null;
  saved: SavedTheme[];
  recentColors: string[];
  update: (patch: Partial<Appearance>) => void;
  setColor: (key: RegionKey, hex: string) => void;
  applyPreset: (id: string) => void;
  setImage: (dataUrl: string | null) => void;
  saveCurrent: (name: string) => void;
  loadSaved: (name: string) => void;
  deleteSaved: (name: string) => void;
  importJson: (json: string) => boolean;
  exportJson: () => string;
  reset: () => void;
}

function persist(state: Pick<AppearanceState, "appearance">) {
  writeLocal(KEY, JSON.stringify(state.appearance));
}

export const useAppearance = create<AppearanceState>((set, get) => {
  const initial = normalize(parseJson<Partial<Appearance>>(readLocal(KEY)));
  const image = readLocal(IMAGE_KEY);

  const commit = (appearance: Appearance, nextImage = get().image) => {
    persist({ appearance });
    applyAppearance(appearance, nextImage);
    set({ appearance });
  };

  return {
    appearance: initial,
    image,
    saved: parseJson<SavedTheme[]>(readLocal(SAVED_KEY)) ?? [],
    recentColors: parseJson<string[]>(readLocal(RECENT_KEY)) ?? [],

    update: (patch) => commit({ ...get().appearance, ...patch }),

    setColor: (key, hex) => {
      const current = get().appearance;
      commit({ ...current, presetId: "custom", palette: { ...current.palette, [key]: hex } });
      const recent = [hex, ...get().recentColors.filter((c) => c !== hex)].slice(0, 12);
      writeLocal(RECENT_KEY, JSON.stringify(recent));
      set({ recentColors: recent });
    },

    applyPreset: (id) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      commit({ ...get().appearance, presetId: id, base: preset.base, palette: { ...preset.palette } });
    },

    setImage: (dataUrl) => {
      if (dataUrl) writeLocal(IMAGE_KEY, dataUrl);
      else writeLocal(IMAGE_KEY, "");
      set({ image: dataUrl });
      applyAppearance(get().appearance, dataUrl);
    },

    saveCurrent: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const saved = [
        ...get().saved.filter((s) => s.name !== trimmed),
        { name: trimmed, appearance: get().appearance },
      ];
      writeLocal(SAVED_KEY, JSON.stringify(saved));
      set({ saved });
    },

    loadSaved: (name) => {
      const found = get().saved.find((s) => s.name === name);
      if (found) commit(normalize(found.appearance));
    },

    deleteSaved: (name) => {
      const saved = get().saved.filter((s) => s.name !== name);
      writeLocal(SAVED_KEY, JSON.stringify(saved));
      set({ saved });
    },

    exportJson: () => JSON.stringify(get().appearance, null, 2),

    importJson: (json) => {
      const parsed = parseJson<Partial<Appearance>>(json);
      if (!parsed || typeof parsed !== "object" || !parsed.palette) return false;
      commit(normalize(parsed));
      return true;
    },

    reset: () => commit(defaultAppearance()),
  };
});
