/**
 * Product imagery stand-in.
 *
 * The spec calls for realistic product photography; this prototype ships no
 * image assets, so each product renders as a soft tinted tile with its emoji
 * mark. Swapping in real photos later means replacing this one component with
 * an <img> — every call site already passes the product through.
 */
export function ProductArt({
  art,
  tint,
  size = "md",
  className = "",
}: {
  art: string;
  tint: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
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
      <span
        className="select-none leading-none"
        style={{ filter: "drop-shadow(0 6px 10px rgb(28 27 25 / 0.16))" }}
      >
        {art}
      </span>
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
