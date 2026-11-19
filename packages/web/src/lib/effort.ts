/**
 * Efor seviyeleri. Sunucu bunları ayrı bir kavram olarak bilmiyor; sohbet
 * isteğinin sıcaklık, en fazla token ve sistem yönergesi alanlarına çevrilir.
 */
export type EffortId = "fast" | "balanced" | "deep";

export interface EffortPreset {
  id: EffortId;
  temperature: number;
  maxTokens: number;
  prompt?: string;
}

export const EFFORTS: EffortPreset[] = [
  {
    id: "fast",
    temperature: 0.4,
    maxTokens: 768,
    prompt: "Kısa, net ve doğrudan cevap ver. Gereksiz açıklama yapma.",
  },
  { id: "balanced", temperature: 0.7, maxTokens: 2048 },
  {
    id: "deep",
    temperature: 0.6,
    maxTokens: 8192,
    prompt:
      "Cevap vermeden önce problemi adım adım düşün. Varsayımlarını kontrol et, " +
      "alternatifleri değerlendir ve ayrıntılı, iyi gerekçelendirilmiş bir cevap ver.",
  },
];

export function effortById(id: string | null | undefined): EffortPreset {
  return EFFORTS.find((e) => e.id === id) ?? EFFORTS[1]!;
}
