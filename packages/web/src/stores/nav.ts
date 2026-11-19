import { create } from "zustand";

export type TabId =
  | "chat"
  | "agent"
  | "models"
  | "knowledge"
  | "image"
  | "audio"
  | "terminal"
  | "theme"
  | "settings"
  | "system";

/** Hangi sekme açık. Bileşenler başka sekmeye yönlendirebilsin diye depoda. */
export const useNav = create<{ tab: TabId; go: (tab: TabId) => void }>((set) => ({
  tab: "chat",
  go: (tab) => set({ tab }),
}));
