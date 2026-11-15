import { ApiError, productImageUrl } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { useRef, useState } from "react";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import { useToast } from "../state/ToastContext";
import { MaterialIcon } from "./MaterialIcon";

/**
 * An item's tile in the inventory: its picture (or emoji until it has one), with a
 * small camera button to add or replace the picture. The tile keeps the same size
 * as before; `sm` is the desktop table row, `md` the phone card.
 */
export function ItemPhoto({ item, size = "md" }: { item: MenuItem; size?: "sm" | "md" }) {
  const upload = usePhotoUpload();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);

  const url = productImageUrl(item.imagePath, "thumb");
  const showImage = Boolean(url) && broken !== url;
  const box = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await upload(item.vendorId, item.id, file);
      notify("Photo saved", "success");
    } catch (err) {
      // Failures from the database were already shown by the store; show the rest.
      if (!(err instanceof ApiError)) notify(err instanceof Error ? err.message : "Couldn't save the photo", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className={`relative flex ${box} shrink-0 items-center justify-center rounded bg-surface-container`}>
      {showImage ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(url ?? null)} className="h-full w-full rounded object-contain" />
      ) : (
        item.art
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        aria-label={`${item.imagePath ? "Change" : "Add"} photo for ${item.name}`}
        title={item.imagePath ? "Change photo" : "Add photo"}
        className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-on-primary shadow"
      >
        <MaterialIcon name={busy ? "hourglass_top" : "add_a_photo"} className="text-[10px]" />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid={`photo-input-${item.id}`}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </span>
  );
}
