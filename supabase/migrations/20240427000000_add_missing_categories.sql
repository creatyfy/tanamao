/*
# Add missing global categories
This migration inserts missing global categories into the store_categories table.

## Query Description:
Adds 'Bebidas', 'Saudável', 'Açaí', 'Mercado', 'Farmácia', 'Salgados', 'Padaria' to store_categories if they don't exist.

## Metadata:
- Schema-Category: Data
- Impact-Level: Low
- Requires-Backup: false
- Reversible: true

## Structure Details:
Inserts rows into public.store_categories.
*/

INSERT INTO public.store_categories (name, icon, sort_order, is_active)
SELECT * FROM (VALUES 
  ('Bebidas', '🥤', 6, true),
  ('Saudável', '🥗', 7, true),
  ('Açaí', '🫐', 8, true),
  ('Mercado', '🛒', 9, true),
  ('Farmácia', '💊', 10, true),
  ('Salgados', '🥟', 11, true),
  ('Padaria', '🥖', 12, true)
) AS v(name, icon, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_categories sc WHERE sc.name = v.name
);
