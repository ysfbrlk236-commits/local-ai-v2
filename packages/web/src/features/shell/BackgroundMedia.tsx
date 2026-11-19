import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppearance } from "../../stores/appearance";

/**
 * GIF ya da video arka planı.
 *
 * `body`'ye taşınır ki uygulamanın yerleşimindeki bir stacking context
 * arkasında kalmasın; karartma katmanı (body::after) yine üstünde durur.
 * Video sessiz ve döngüde oynar; sekme gizliyken duraklatılır ki boşuna
 * işlemci harcamasın.
 */
export function BackgroundMedia() {
  const media = useAppearance((s) => s.media);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (media?.kind !== "video") return undefined;
    const onVisibility = () => {
      const element = video.current;
      if (!element) return;
      if (document.hidden) element.pause();
      else void element.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [media]);

  if (!media || typeof document === "undefined") return null;

  return createPortal(
    <div className="bg-media" aria-hidden="true">
      {media.kind === "video" ? (
        <video ref={video} src={media.url} autoPlay muted loop playsInline />
      ) : (
        <img src={media.url} alt="" />
      )}
    </div>,
    document.body,
  );
}
