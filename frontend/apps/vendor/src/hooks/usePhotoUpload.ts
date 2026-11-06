import { useStore } from "@poolit/domain";
import { useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { makeStorageUploader, uploadProductPhoto } from "../lib/productPhoto";
import { resizeInBrowser } from "../lib/productPhotoBrowser";

/**
 * Shrinks a photo on this phone, uploads both sizes to the store's folder in the
 * `product-images` bucket, then attaches it to the item (see lib/productPhoto.ts
 * for the rules). Resolves to the stored path.
 */
export function usePhotoUpload() {
  const { setItemImage } = useStore();
  return useCallback(
    (vendorId: string, itemId: string, file: Blob) =>
      uploadProductPhoto({
        vendorId,
        itemId,
        file,
        deps: {
          resize: resizeInBrowser,
          upload: makeStorageUploader(supabase.storage.from("product-images")),
          setItemImage,
        },
      }),
    [setItemImage],
  );
}
