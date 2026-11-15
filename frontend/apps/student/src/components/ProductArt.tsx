import { productImageUrl } from "@poolit/domain";
import { useState } from "react";

/**
 * Product imagery: the store's picture when there is one, otherwise a soft
 * tinted tile with the product's emoji. The tile (size, tint, sheen) is the
 * same either way, so a missing or slow picture never changes the layout; if the
 * picture fails to load the emoji tile is shown instead.
 */
export function ProductArt({
  art,
  tint,
  imagePath,
  size = "md",
  className = "",
}: {
  art: string;
  tint: string;
  /** Storage path of the product picture (MenuItem.imagePath); omit for the emoji tile. */
  imagePath?: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  // Remember which address loaded or failed, so a changed picture starts afresh.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Small tiles use the 400 px thumbnail; the big ones the 800 px picture.
  const url = productImageUrl(imagePath, size === "hero" || size === "lg" ? "full" : "thumb");
  const showImage = Boolean(url) && failedUrl !== url;
  const loaded = Boolean(url) && loadedUrl === url;
  const sizes = {
    sm: "h-14 w-14 text-2xl rounded-xl",
    md: "h-24 w-full text-[44px] rounded-2xl",
    lg: "h-32 w-full text-6xl rounded-2xl",
    hero: "h-60 w-full text-[110px] rounded-[28px]",
  };

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${sizes[size]} ${className}`}
      style={{
        background: `radial-gradient(120% 100% at 30% 15%, #ffffff 0%, ${tint} 65%, ${tint} 100%)`,
      }}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedUrl(url ?? null)}
          onError={() => setFailedUrl(url ?? null)}
          className="absolute inset-0 h-full w-full object-contain p-1"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 150ms" }}
        />
      ) : null}
      {!showImage || !loaded ? (
        <span
          className="select-none leading-none"
          style={{ filter: "drop-shadow(0 6px 10px rgb(28 27 25 / 0.16))", opacity: showImage ? 0 : 1 }}
        >
          {art}
        </span>
      ) : null}
      {/* soft top-light sheen */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(255 255 255 / 0.45) 0%, rgb(255 255 255 / 0) 45%)",
        }}
      />
    </div>
  );
}
