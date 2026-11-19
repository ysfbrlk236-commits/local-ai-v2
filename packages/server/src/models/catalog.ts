import {
  getModelDetail,
  pickBestFit,
  type HfFile,
  type HfModelDetail,
} from "./huggingface.js";

export type CatalogCategory =
  | "popular"
  | "reasoning"
  | "coding"
  | "lightweight"
  | "large"
  | "vision"
  | "embedding";

export interface CatalogModelItem {
  id: string;
  name: string;
  repo: string;
  category: CatalogCategory;
  descriptionTr: string;
  descriptionEn: string;
  parameters: string;
  contextLength: number;
  /**
   * Tercih edilen nicemleme. Dosya ADI degil: dosya adlari depo sahibine gore
   * degisiyor ve zamanla degisiyor. Gercek dosya indirme aninda Hugging
   * Face'in dosya listesinden cozulur.
   */
  preferredQuant: string;
  /** Yalnizca gosterim icin kaba boyut. Indirme bunu kullanmaz. */
  approxSizeBytes: number;
  minRamGb: number;
  tagsTr: string[];
  tagsEn: string[];
  isEmbedding?: boolean;
  /**
   * Gorsel model mi. Gorsel modeller iki dosyadir: dil modeli ve goruntu
   * kodlayici (mmproj). Yalnizca ilki indirilirse model calisir ama gorsel
   * goremez -- sessizce metin modeline donusur. Kodlayicinin adi da depoda
   * cozulur.
   */
  needsProjector?: boolean;
}

export interface CatalogModelResponse
  extends Omit<CatalogModelItem, "descriptionTr" | "descriptionEn" | "tagsTr" | "tagsEn"> {
  description: string;
  tags: string[];
  /** Kaba bir gosterge; gercek boyut cozumlemede ogrenilir. */
  fits: boolean;
  fitsReason: string;
  estimatedMb: number;
}

/** Indirmeye hazir, Hugging Face'ten cozulmus gercek dosya. */
export interface ResolvedFile {
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
  sha256: string | null;
}

export interface ResolvedCatalogModel {
  id: string;
  model: ResolvedFile;
  /** Gorsel modellerde goruntu kodlayici; yoksa null. */
  projector: ResolvedFile | null;
}

export class CatalogResolveError extends Error {}

export const CATALOG_MODELS: CatalogModelItem[] = [
  // -- Popüler & Çok Amaçlı ----------------------------------------------------

  // -- Akıl Yürütme & Düşünme (Reasoning / R1) --------------------------------

  // -- Kodlama & Yazılım (Coding & Developer) ---------------------------------
  {
    id: "qwen2.5-coder-7b-instruct",
    name: "Qwen 2.5 Coder 7B Instruct",
    repo: "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
    category: "coding",
    descriptionTr: "90+ dilde kod yazma, hata ayıklama, refactoring ve kod tamamlama şampiyonu.",
    descriptionEn: "Top benchmark performer for code generation, debugging, refactoring, and code completion in 90+ languages.",
    parameters: "7.6B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 4_680_000_000,
    minRamGb: 6.5,
    tagsTr: ["Kodlama", "Python/JS/C++", "Refactoring", "128k"],
    tagsEn: ["Coding", "Python/JS/C++", "Refactoring", "128k"],
  },

  // -- Hafif & Hızlı (Lightweight / Laptop) -----------------------------------
  {
    id: "llama-3.2-1b-instruct",
    name: "Llama 3.2 1B Instruct",
    repo: "bartowski/Llama-3.2-1B-Instruct-GGUF",
    category: "lightweight",
    descriptionTr: "Yalnızca ~800 MB boyutuyla anında inen, en düşük donanımlarda bile akıcı çalışan model.",
    descriptionEn: "Downloads in seconds at only ~800 MB, running smoothly on virtually any hardware.",
    parameters: "1.2B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 810_000_000,
    minRamGb: 1.5,
    tagsTr: ["Minimal", "Çok Hızlı", "Düşük Boyut"],
    tagsEn: ["Minimal", "Very Fast", "Small Size"],
  },

  // -- Büyük & İleri Düzey (Large & High Power) ------------------------------
  {
    id: "phi-4-14b",
    name: "Microsoft Phi-4 14B",
    repo: "bartowski/phi-4-GGUF",
    category: "large",
    descriptionTr: "Microsoft'un matematik, bilim ve akıl yürütme kıyaslamalarında rekor kıran son nesil modeli.",
    descriptionEn: "Microsoft's cutting-edge model breaking benchmarks in mathematics, science, and complex reasoning.",
    parameters: "14.7B",
    contextLength: 16384,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 9_130_000_000,
    minRamGb: 11.5,
    tagsTr: ["Microsoft", "Matematik", "Son Nesil"],
    tagsEn: ["Microsoft", "Math", "State of the Art"],
  },

  // -- Görsel & Çok Modlu (Multimodal / Vision) ------------------------------

  // -- 2026 Yeni Nesil (açık ağırlık, GGUF) -----------------------------------
  {
    id: "qwen3.6-35b-a3b-instruct",
    name: "Qwen 3.6 35B-A3B Instruct",
    repo: "unsloth/Qwen3.6-35B-A3B-GGUF",
    category: "vision",
    descriptionTr: "Hız-dostu MoE mimarisi: 35B toplam parametre ama her adımda yalnızca ~3B aktif. Görsel anlama, araç kullanımı ve çok dilli sohbette güçlü.",
    descriptionEn: "Fast MoE architecture: 35B total parameters but only ~3B active per token. Strong at vision, tool use, and multilingual chat.",
    parameters: "35B (3B aktif)",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 21_000_000_000,
    minRamGb: 24,
    tagsTr: ["Hızlı MoE", "Görsel", "Çok Dilli", "Araç Kullanımı"],
    tagsEn: ["Fast MoE", "Vision", "Multilingual", "Tool Use"],
    needsProjector: true,
  },
  {
    id: "qwen3.6-27b-instruct",
    name: "Qwen 3.6 27B Instruct",
    repo: "unsloth/Qwen3.6-27B-GGUF",
    category: "reasoning",
    descriptionTr: "Yoğun (dense) 27B model; adım adım düşünme ve uzun akıl yürütmede güçlü. Daha yavaş ama dikkatli cevaplar verir.",
    descriptionEn: "Dense 27B model; strong at step-by-step reasoning and long analysis. Slower, but careful, thoughtful answers.",
    parameters: "27B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 16_500_000_000,
    minRamGb: 20,
    tagsTr: ["Muhakeme", "Derin Düşünme", "Dense"],
    tagsEn: ["Reasoning", "Deep Thinking", "Dense"],
  },
  {
    id: "gemma-4-26b-a4b-it",
    name: "Gemma 4 26B-A4B Instruct",
    repo: "unsloth/gemma-4-26B-A4B-it-GGUF",
    category: "popular",
    descriptionTr: "Google'ın Apache 2.0 lisanslı Gemma 4 modeli. 26B toplam, 4B aktif olduğu için büyük model kalitesini daha hafif bir hızla verir.",
    descriptionEn: "Google's Apache 2.0 Gemma 4 model. 26B total with 4B active, giving large-model quality at a lighter speed.",
    parameters: "26B (4B aktif)",
    contextLength: 262144,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 16_000_000_000,
    minRamGb: 18,
    tagsTr: ["Apache 2.0", "Hızlı MoE", "256k"],
    tagsEn: ["Apache 2.0", "Fast MoE", "256k"],
  },
  {
    id: "gemma-4-12b-it",
    name: "Gemma 4 12B Instruct",
    repo: "unsloth/gemma-4-12b-it-GGUF",
    category: "popular",
    descriptionTr: "Gemma 4 ailesinin orta boy üyesi. 4-bit ile 8 GB belleğe sığar; genel sohbet ve yazım için dengeli bir seçim.",
    descriptionEn: "Mid-size member of the Gemma 4 family. Fits in 8 GB RAM at 4-bit; a balanced pick for chat and writing.",
    parameters: "12B",
    contextLength: 262144,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 7_400_000_000,
    minRamGb: 8,
    tagsTr: ["Apache 2.0", "Dengeli", "256k"],
    tagsEn: ["Apache 2.0", "Balanced", "256k"],
  },
  {
    id: "gemma-4-e4b-it",
    name: "Gemma 4 E4B Instruct",
    repo: "unsloth/gemma-4-E4B-it-GGUF",
    category: "lightweight",
    descriptionTr: "Telefon ve dizüstü için tasarlanmış küçük Gemma 4. Düşük bellekte akıcı çalışır, kısa sorular ve özetler için yeterli.",
    descriptionEn: "Small Gemma 4 designed for phones and laptops. Runs smoothly in low memory; good for quick questions and summaries.",
    parameters: "E4B (~4B)",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 5_000_000_000,
    minRamGb: 6,
    tagsTr: ["Hafif", "Apache 2.0", "Düşük Bellek"],
    tagsEn: ["Lightweight", "Apache 2.0", "Low Memory"],
  },
  {
    id: "ministral-3-8b-instruct",
    name: "Ministral 3 8B Instruct",
    repo: "unsloth/Ministral-3-8B-Instruct-2512-GGUF",
    category: "popular",
    descriptionTr: "Mistral'in 2025 sonu modeli. Küçük boyutta iyi maliyet/performans; edge ve yerel kullanım için tasarlandı.",
    descriptionEn: "Mistral's late-2025 model. Strong cost/performance at a small size, built for edge and local use.",
    parameters: "8B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 5_000_000_000,
    minRamGb: 7,
    tagsTr: ["Mistral", "Verimli", "Edge"],
    tagsEn: ["Mistral", "Efficient", "Edge"],
  },
  {
    id: "ministral-3-14b-instruct",
    name: "Ministral 3 14B Instruct",
    repo: "mistralai/Ministral-3-14B-Instruct-2512-GGUF",
    category: "large",
    descriptionTr: "Ministral 3 ailesinin en büyüğü. 14B boyutunda, 8B'ye göre belirgin şekilde daha tutarlı yanıtlar.",
    descriptionEn: "The largest of the Ministral 3 family. At 14B, noticeably more consistent answers than the 8B.",
    parameters: "14B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 9_000_000_000,
    minRamGb: 11,
    tagsTr: ["Mistral", "Büyük", "Tutarlı"],
    tagsEn: ["Mistral", "Large", "Consistent"],
  },

  // -- Korunan klasikler (hâlâ kullanışlı) --------------------------------
  {
    id: "qwen2.5-7b-instruct",
    name: "Qwen 2.5 7B Instruct",
    repo: "bartowski/Qwen2.5-7B-Instruct-GGUF",
    category: "popular",
    descriptionTr: "Mükemmel Türkçe desteği, 128k bağlam penceresi ve üstün genel sohbet kabiliyeti.",
    descriptionEn: "Strong multilingual understanding, 128k context window, and outstanding general chat quality.",
    parameters: "7.6B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 4_920_000_000,
    minRamGb: 6,
    tagsTr: ["Türkçe", "Popüler", "Geniş Bağlam", "128k"],
    tagsEn: ["Multilingual", "Popular", "Wide Context", "128k"],
  },
  {
    id: "llama-3.2-3b-instruct",
    name: "Llama 3.2 3B Instruct",
    repo: "bartowski/Llama-3.2-3B-Instruct-GGUF",
    category: "lightweight",
    descriptionTr: "8 GB RAM'li cihazlarda dahi ışık hızında çalışan, 128k bağlamlı olağanüstü kompakt model.",
    descriptionEn: "Lightning fast on 8 GB RAM machines with 128k context and surprising capability.",
    parameters: "3.2B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 2_020_000_000,
    minRamGb: 3.0,
    tagsTr: ["Hafif", "Meta", "128k", "8 GB RAM İçin İdeal"],
    tagsEn: ["Lightweight", "Meta", "128k", "Ideal for 8GB RAM"],
  },
  {
    id: "qwen2.5-3b-instruct",
    name: "Qwen 2.5 3B Instruct",
    repo: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    category: "lightweight",
    descriptionTr: "3B sınıfında en iyi Türkçe ve çok dilli anlama başarımı sunan kompakt güç merkezi.",
    descriptionEn: "Best-in-class Turkish and multilingual capability in the compact 3B segment.",
    parameters: "3.1B",
    contextLength: 32768,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 2_040_000_000,
    minRamGb: 3.0,
    tagsTr: ["Türkçe", "Kompakt", "Dengeli"],
    tagsEn: ["Multilingual", "Compact", "Balanced"],
  },
  {
    id: "qwen2.5-14b-instruct",
    name: "Qwen 2.5 14B Instruct",
    repo: "bartowski/Qwen2.5-14B-Instruct-GGUF",
    category: "large",
    descriptionTr: "Geniş parametre kapasitesiyle derin analiz, karmaşık metin yazımı ve üstün zeka.",
    descriptionEn: "High-capacity parameter scaling for deep analysis, nuanced prose, and advanced intellect.",
    parameters: "14.8B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 8_990_000_000,
    minRamGb: 11.5,
    tagsTr: ["Yüksek Zekâ", "128k", "Geniş Bilgi"],
    tagsEn: ["High Intelligence", "128k", "Broad Knowledge"],
  },
  {
    id: "mistral-small-24b-instruct",
    name: "Mistral Small 24B Instruct",
    repo: "bartowski/Mistral-Small-24B-Instruct-2501-GGUF",
    category: "large",
    descriptionTr: "Mistral AI'ın kurumsal sınıf akıl yürütme, çok dillilik ve hızlı üretim sunan yeni 24B modeli.",
    descriptionEn: "Mistral AI's new 24B model offering enterprise-grade reasoning, multilingualism, and fast inference.",
    parameters: "24.0B",
    contextLength: 32768,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 14_500_000_000,
    minRamGb: 18.0,
    tagsTr: ["Mistral AI", "Kurumsal", "Güçlü"],
    tagsEn: ["Mistral AI", "Enterprise", "Powerful"],
  },
  {
    id: "deepseek-r1-distill-qwen-7b",
    name: "DeepSeek R1 Distill Qwen 7B",
    repo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
    category: "reasoning",
    descriptionTr: "OpenAI o1 kalitesinde adım adım derin düşünme, matematiksel çıkarım ve mantık yeteneği.",
    descriptionEn: "Step-by-step reasoning, mathematical deduction, and logic matching OpenAI o1-level chains of thought.",
    parameters: "7.6B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 4_680_000_000,
    minRamGb: 6.5,
    tagsTr: ["Düşünme", "o1 Seviyesi", "Matematik", "Mantık"],
    tagsEn: ["Reasoning", "o1 Level", "Math", "Logic"],
  },
  {
    id: "qwen2.5-coder-14b-instruct",
    name: "Qwen 2.5 Coder 14B Instruct",
    repo: "Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
    category: "coding",
    descriptionTr: "Büyük kod tabanları, karmaşık sistem mimarileri ve ileri seviye yazılım geliştirme için güçlü model.",
    descriptionEn: "Formidable model for large codebases, complex system architecture, and advanced software engineering.",
    parameters: "14.8B",
    contextLength: 131072,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 8_990_000_000,
    minRamGb: 11.5,
    tagsTr: ["İleri Kodlama", "Mimari", "Geniş Depolar"],
    tagsEn: ["Advanced Coding", "Architecture", "Large Repos"],
  },
  {
    id: "qwen2-vl-7b-instruct",
    name: "Qwen 2 VL 7B Instruct",
    repo: "bartowski/Qwen2-VL-7B-Instruct-GGUF",
    category: "vision",
    descriptionTr: "Görselleri anlama, belge ve grafik okuma, OCR ve çok modlu görsel sohbet.",
    descriptionEn: "Visual comprehension, document & chart analysis, OCR, and multimodal image chat.",
    parameters: "7.6B",
    contextLength: 32768,
    preferredQuant: "Q4_K_M",
    approxSizeBytes: 4_680_000_000,
    minRamGb: 6.5,
    tagsTr: ["Görsel Anlama", "OCR", "Çok Modlu"],
    tagsEn: ["Vision", "OCR", "Multimodal"],
    needsProjector: true,
  },
  {
    id: "multilingual-e5-large",
    name: "Multilingual E5 Large",
    repo: "cstr/multilingual-e5-large-GGUF",
    category: "embedding",
    descriptionTr: "Çok dilli anlamsal benzerlik ve belge eşleştirmede yüksek doğruluklu gömme modeli.",
    descriptionEn: "High-accuracy embedding model for multilingual semantic similarity and document matching.",
    parameters: "560M",
    contextLength: 512,
    preferredQuant: "Q8_0",
    approxSizeBytes: 600_000_000,
    minRamGb: 1.0,
    tagsTr: ["Çok Dilli", "Anlamsal Benzerlik"],
    tagsEn: ["Multilingual", "Semantic Similarity"],
    isEmbedding: true,
  },

  // -- Gömme & Bilgi Tabanı (Embeddings & RAG) -------------------------------
  {
    id: "nomic-embed-text-v1.5",
    name: "Nomic Embed Text v1.5",
    repo: "nomic-ai/nomic-embed-text-v1.5-GGUF",
    category: "embedding",
    descriptionTr: "Bilgi tabanı (RAG) ve anlamsal belge araması için 8192 bağlamlı optimize edilmiş gömme modeli.",
    descriptionEn: "Optimized embedding model with 8192 context length for knowledge base (RAG) and semantic document retrieval.",
    parameters: "137M",
    contextLength: 8192,
    preferredQuant: "Q8_0",
    approxSizeBytes: 150_000_000,
    minRamGb: 0.5,
    tagsTr: ["Bilgi Tabanı", "RAG", "8k Bağlam", "Hızlı"],
    tagsEn: ["Knowledge Base", "RAG", "8k Context", "Fast"],
    isEmbedding: true,
  },
  {
    id: "bge-m3-multilingual",
    name: "BGE-M3 Multilingual Embed",
    repo: "gpustack/bge-m3-GGUF",
    category: "embedding",
    descriptionTr: "100'den fazla dilde (özellikle Türkçe) yoğun ve seyrek hibrit arama sunan en güçlü gömme modeli.",
    descriptionEn: "Top-tier embedding model supporting dense, sparse, and hybrid retrieval across 100+ languages.",
    parameters: "567M",
    contextLength: 8192,
    preferredQuant: "Q8_0",
    approxSizeBytes: 600_000_000,
    minRamGb: 1.0,
    tagsTr: ["Çok Dilli", "Türkçe Gömme", "Hibrit Arama"],
    tagsEn: ["Multilingual", "Hybrid Retrieval", "Dense+Sparse"],
    isEmbedding: true,
  },
];

export function getCatalog(lang: "tr" | "en" = "tr", freeBudgetMb = 8192): CatalogModelResponse[] {
  return CATALOG_MODELS.map((item) => {
    // Projektor de bellege giriyor; saymamak gorsel modelleri oldugundan
    // kucuk gosterirdi. Kaba bir pay yeterli: kesin sayi indirme aninda
    // Hugging Face'ten geliyor.
    const totalBytes = item.approxSizeBytes + (item.needsProjector ? 1_000_000_000 : 0);
    const estimatedMb = Math.round((totalBytes / (1024 * 1024)) * 1.2);
    const fits = freeBudgetMb >= estimatedMb;
    const gb = (estimatedMb / 1024).toFixed(1);
    const freeGb = (freeBudgetMb / 1024).toFixed(1);
    const fitsReason =
      lang === "tr"
        ? fits
          ? `Sisteminizde akıcı çalışır (~${gb} GB bellek)`
          : `Yüksek bellek gerektirir (~${gb} GB bellek, boşta ~${freeGb} GB)`
        : fits
          ? `Runs smoothly on your system (~${gb} GB RAM)`
          : `Requires high memory (~${gb} GB RAM, ~${freeGb} GB free)`;

    const { descriptionTr, descriptionEn, tagsTr, tagsEn, ...rest } = item;
    return {
      ...rest,
      description: lang === "tr" ? descriptionTr : descriptionEn,
      tags: lang === "tr" ? tagsTr : tagsEn,
      isEmbedding: item.isEmbedding ?? false,
      needsProjector: item.needsProjector ?? false,
      fits,
      fitsReason,
      estimatedMb,
    };
  });
}

export function findCatalogModel(id: string): CatalogModelItem | null {
  return CATALOG_MODELS.find((item) => item.id === id) ?? null;
}

/**
 * Katalog girdisini indirilebilir gercek dosyalara cozer.
 *
 * Dosya adi, boyut, adres ve SHA256 burada, Hugging Face'in kendi dosya
 * listesinden gelir. Katalogda sabit dosya adi tutmak surdurulemezdi: depo
 * sahipleri dosyalari yeniden adlandiriyor, parcaliyor, siliyor. Elle
 * yazilan 33 girdinin 9'u bir noktada 404 veriyordu ve bunu ancak kullanici
 * indirmeye basinca ogreniyorduk. Artik sabit olan tek sey depo kimligi;
 * depo da tasinirsa hata indirme baslamadan once ve anlasilir cikiyor.
 */
export async function resolveCatalogModel(
  id: string,
  budgetMb: number,
): Promise<ResolvedCatalogModel> {
  const item = findCatalogModel(id);
  if (!item) throw new CatalogResolveError(`Katalogda böyle bir model yok: ${id}`);

  let detail: HfModelDetail;
  try {
    detail = await getModelDetail(item.repo);
  } catch (err) {
    throw new CatalogResolveError(
      `${item.name} deposu okunamadı (${item.repo}): ${(err as Error).message}`,
    );
  }

  if (detail.files.length === 0) {
    throw new CatalogResolveError(
      `${item.name} deposunda tek dosyalık GGUF bulunamadı (${item.repo}).`,
    );
  }

  // Tercih edilen nicemleme varsa o, yoksa butceye sigan en iyisi. Tercih
  // bir istekten ibaret: depo o nicemlemeyi birakmis olabilir.
  const wanted = item.preferredQuant.toLowerCase();
  const preferred = detail.files.find((file) =>
    file.path.toLowerCase().includes(wanted),
  );
  const chosen = preferred ?? pickBestFit(detail.files, budgetMb) ?? detail.files[0];
  if (!chosen) throw new CatalogResolveError(`${item.name} için dosya seçilemedi.`);

  if (item.needsProjector && !detail.projector) {
    throw new CatalogResolveError(
      `${item.name} görsel bir model ama deposunda mmproj dosyası yok (${item.repo}).`,
    );
  }

  return {
    id: item.id,
    model: toResolved(chosen),
    projector: detail.projector ? toResolved(detail.projector) : null,
  };
}

function toResolved(file: HfFile): ResolvedFile {
  return {
    filename: file.path.split("/").pop() ?? file.path,
    downloadUrl: file.downloadUrl,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
  };
}
