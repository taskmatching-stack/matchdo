-- 情境圖主題／場景：回填 name_en（不覆寫已填英文）
-- 執行：後台「資料庫維護」id=`promo-scene-templates-name-en`，或 Supabase SQL Editor

-- ① 依目前中文顯示名（後台自訂名稱）
UPDATE public.promo_scene_templates t
SET name_en = v.name_en, updated_at = now()
FROM (VALUES
  ('主視覺/Banner', 'Hero / Banner'),
  ('產品主視覺廣告', 'Hero product ad'),
  ('商品頁情境輔助圖', 'Product-page lifestyle'),
  ('社群貼文', 'Social post'),
  ('活動宣傳風', 'Campaign promo'),
  ('廣告投放素材', 'Paid ad creative'),
  ('品牌質感廣告', 'Brand premium ad'),
  ('型錄／電商廣告', 'Catalog / ecommerce ad'),
  ('型錄/電商廣告', 'Catalog / ecommerce ad'),
  ('電子報/EDM行銷', 'Email / EDM'),
  ('DM／傳單風', 'Flyer / DM'),
  ('品牌形象/關於我們頁面', 'Brand / About page'),
  ('純商品規格展示（無情境）', 'Spec shot (no scene)'),
  ('商業形象', 'Corporate portrait'),
  ('時尚型錄', 'Fashion lookbook'),
  ('生活情境', 'Lifestyle'),
  ('運動', 'Sports'),
  ('美妝', 'Beauty'),
  ('證件／正式肖像', 'Formal ID portrait'),
  ('品牌形象', 'Brand image'),
  ('社群內容', 'Social content'),
  ('乾淨棚拍場景', 'Clean studio'),
  ('零售陳列場景', 'Retail display'),
  ('展場／活動攤位', 'Exhibition booth'),
  ('柔色漸層背景', 'Soft gradient'),
  ('戶外廣告場景', 'Outdoor campaign')
) AS v(name_zh, name_en)
WHERE t.name = v.name_zh
  AND (t.name_en IS NULL OR btrim(t.name_en) = '' OR t.name_en = t.name);

-- ② 種子 key 仍空時再補
UPDATE public.promo_scene_templates t
SET name_en = v.name_en, updated_at = now()
FROM (VALUES
  ('product_hero_ad', 'Hero / Banner'),
  ('hero_banner', 'Hero / Banner'),
  ('banner_hero', 'Hero / Banner'),
  ('flyer_dm', 'Email / EDM'),
  ('campaign_promo', 'Campaign promo'),
  ('brand_premium', 'Brand premium ad'),
  ('catalog_ad', 'Catalog / ecommerce ad'),
  ('social_post', 'Social post'),
  ('social_feed', 'Social post'),
  ('portrait_corporate', 'Corporate portrait'),
  ('portrait_fashion_lookbook', 'Fashion lookbook'),
  ('portrait_lifestyle', 'Lifestyle'),
  ('portrait_sports', 'Sports'),
  ('portrait_beauty', 'Beauty'),
  ('portrait_formal_id', 'Formal ID portrait'),
  ('portrait_brand_image', 'Brand image'),
  ('portrait_social_content', 'Social content'),
  ('scene_clean_studio', 'Clean studio'),
  ('scene_retail_display', 'Retail display'),
  ('scene_exhibition', 'Exhibition booth'),
  ('scene_soft_gradient', 'Soft gradient'),
  ('scene_outdoor_campaign', 'Outdoor campaign')
) AS v(key, name_en)
WHERE t.key = v.key
  AND (t.name_en IS NULL OR btrim(t.name_en) = '' OR t.name_en = t.name);
