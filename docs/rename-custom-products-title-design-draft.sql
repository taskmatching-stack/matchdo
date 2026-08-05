-- 舊泛用標題一次性改寫（Supabase SQL Editor，或後台 migration：rename-custom-products-title-design-draft）
-- 產品設計圖 → 產品設計稿；英文 Product design → Product design draft

UPDATE custom_products
SET title = '產品設計稿'
WHERE title = '產品設計圖';

UPDATE custom_products
SET title_en = 'Product design draft'
WHERE title_en = 'Product design';
