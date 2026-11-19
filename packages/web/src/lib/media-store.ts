/**
 * Arka plan medyası (GIF, kısa video) için IndexedDB deposu.
 *
 * localStorage ~5 MB ve yalnızca metin tutar; bir video oraya sığmaz.
 * IndexedDB dosyayı olduğu gibi (Blob) saklar ve tarayıcı kotası yüzlerce
 * MB'tır. Tek kayıt tutulur: yeni medya eskisinin yerine geçer.
 */

export type MediaKind = "gif" | "video";

export interface StoredMedia {
  kind: MediaKind;
  blob: Blob;
  name: string;
}

const DB_NAME = "studio-media";
const STORE = "background";
const KEY = "current";

/** Bu boyuttan büyük dosya reddedilir; arka plan için uzun video gereksiz. */
export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;

export function mediaKindOf(file: { type: string; name: string }): MediaKind | null {
  const type = file.type.toLowerCase();
  if (type === "image/gif" || /\.gif$/i.test(file.name)) return "gif";
  if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) return "video";
  return null;
}

function open(): Promise<IDBDatabase | null> {
  const idb = globalThis.indexedDB;
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB açılamadı."));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onerror = () => reject(tx.error ?? new Error("Medya kaydedilemedi."));
      tx.onabort = () => reject(tx.error ?? new Error("Medya kaydı iptal edildi."));
    });
  } finally {
    db.close();
  }
}

export async function saveMedia(media: StoredMedia): Promise<void> {
  await run("readwrite", (store) => store.put(media, KEY));
}

export async function loadMedia(): Promise<StoredMedia | null> {
  try {
    const value = await run<StoredMedia | undefined>("readonly", (store) => store.get(KEY));
    return value ?? null;
  } catch {
    return null;
  }
}

export async function clearMedia(): Promise<void> {
  await run("readwrite", (store) => store.delete(KEY));
}
