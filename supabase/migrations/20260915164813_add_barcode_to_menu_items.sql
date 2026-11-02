ALTER TABLE public.menu_items
  ADD COLUMN barcode text;

CREATE UNIQUE INDEX menu_items_vendor_id_barcode_key
  ON public.menu_items (vendor_id, barcode)
  WHERE barcode IS NOT NULL;
