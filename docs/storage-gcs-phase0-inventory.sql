-- Phase 0：盤點 DB 內仍指向 Supabase Storage 的 URL 筆數（baseline）
-- 在 Supabase Dashboard → SQL Editor 執行；可重複執行。
-- 僅掃描「表 + 欄位確實存在」的項目（略過 ai_categories.image_url 等未建欄位）。
-- 遷移 Phase 3 完成後再跑，各 rows 應趨近 0。

DROP TABLE IF EXISTS _storage_url_inventory;
CREATE TEMP TABLE _storage_url_inventory (
    source text PRIMARY KEY,
    rows bigint NOT NULL DEFAULT 0
);

-- ========== TEXT 欄位 ==========
DO $inv$
DECLARE
    checks text[][] := ARRAY[
        ARRAY['custom_products', 'reference_image_url'],
        ARRAY['custom_products', 'ai_generated_image_url'],
        ARRAY['manufacturer_portfolio', 'image_url'],
        ARRAY['manufacturer_portfolio', 'image_url_before'],
        ARRAY['manufacturers', 'logo_url'],
        ARRAY['vendor_assets', 'image_url'],
        ARRAY['supplier_catalog_items', 'cover_image_url'],
        ARRAY['media_collections', 'cover_image_url'],
        ARRAY['product_promo_generations', 'source_image_url'],
        ARRAY['product_promo_generations', 'result_image_url'],
        ARRAY['user_print_generations', 'image_url'],
        ARRAY['user_material_combo_generations', 'image_url'],
        ARRAY['direct_messages', 'image_url'],
        ARRAY['projects', 'cover_image_url'],
        ARRAY['ai_subcategories', 'image_url'],
        ARRAY['visual_semantics_events', 'image_url']
    ];
    t text;
    c text;
    n bigint;
    q text;
BEGIN
    FOR i IN 1..coalesce(array_length(checks, 1), 0) LOOP
        t := checks[i][1];
        c := checks[i][2];
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = t
              AND column_name = c
        ) THEN
            q := format(
                'SELECT count(*)::bigint FROM public.%I WHERE %I IS NOT NULL AND %I::text LIKE $1',
                t, c, c
            );
            EXECUTE q INTO n USING '%supabase.co/storage%';
            INSERT INTO _storage_url_inventory (source, rows)
            VALUES (t || '.' || c, coalesce(n, 0))
            ON CONFLICT (source) DO UPDATE SET rows = EXCLUDED.rows;
        END IF;
    END LOOP;
END
$inv$;

-- ========== JSONB／複合（掃整段文字）==========
DO $inv$
DECLARE
    checks text[][] := ARRAY[
        ARRAY['vendor_assets', 'gallery_images'],
        ARRAY['supplier_catalog_items', 'gallery_images'],
        ARRAY['manufacturer_portfolio', 'series_image_urls'],
        ARRAY['custom_products', 'reference_sources'],
        ARRAY['projects', 'description'],
        ARRAY['listings', 'images'],
        ARRAY['help_guide_pages', 'blocks_json'],
        ARRAY['media_wall_favorites', 'item_data']
    ];
    t text;
    c text;
    n bigint;
    q text;
BEGIN
    FOR i IN 1..coalesce(array_length(checks, 1), 0) LOOP
        t := checks[i][1];
        c := checks[i][2];
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = t
              AND column_name = c
        ) THEN
            q := format(
                'SELECT count(*)::bigint FROM public.%I WHERE %I IS NOT NULL AND %I::text LIKE $1',
                t, c, c
            );
            EXECUTE q INTO n USING '%supabase.co/storage%';
            INSERT INTO _storage_url_inventory (source, rows)
            VALUES (t || '.' || c || ' (jsonb)', coalesce(n, 0))
            ON CONFLICT (source) DO UPDATE SET rows = EXCLUDED.rows;
        END IF;
    END LOOP;
END
$inv$;

-- 單一結果集（Supabase SQL Editor 只顯示最後一個 SELECT 時也能看到明細 + TOTAL）
SELECT source, rows
FROM (
    SELECT 0 AS ord, source, rows
    FROM _storage_url_inventory
    WHERE rows > 0
    UNION ALL
    SELECT 1, '--- TOTAL (non-zero) ---', coalesce(sum(rows), 0)::bigint
    FROM _storage_url_inventory
    WHERE rows > 0
) combined
ORDER BY ord, rows DESC, source;
