-- Phase 3：DB 內 Supabase Storage URL → https://media.matchdo.cc/
-- 在 Supabase Dashboard → SQL Editor 執行（Phase 2 物件已複製到 GCS 後）。
-- 可重複執行；已改寫的 row 不會再 match LIKE 條件。
--
-- 驗證：再跑 docs/storage-gcs-phase0-inventory.sql，TOTAL 應趨近 0。

BEGIN;

-- ========== TEXT 欄位 ==========
DO $rw$
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
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = c
        ) THEN
            q := format(
                'UPDATE public.%I SET %I = regexp_replace(%I::text,
                    ''^https://[^/]+\.supabase\.co/storage/v1/object/public/'',
                    ''https://media.matchdo.cc/'', ''g'')
                 WHERE %I IS NOT NULL AND %I::text LIKE ''%%supabase.co/storage%%''',
                t, c, c, c, c
            );
            EXECUTE q;
            GET DIAGNOSTICS n = ROW_COUNT;
            RAISE NOTICE 'TEXT %.%: % rows updated', t, c, n;
        END IF;
    END LOOP;
END
$rw$;

-- ========== JSONB（整段 regexp_replace 再 cast 回 jsonb）==========
DO $rw$
DECLARE
    checks text[][] := ARRAY[
        ARRAY['vendor_assets', 'gallery_images'],
        ARRAY['supplier_catalog_items', 'gallery_images'],
        ARRAY['manufacturer_portfolio', 'series_image_urls'],
        ARRAY['custom_products', 'reference_sources'],
        ARRAY['projects', 'description'],
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
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = c
        ) THEN
            q := format(
                'UPDATE public.%I SET %I = regexp_replace(%I::text,
                    ''https://[^/]+\.supabase\.co/storage/v1/object/public/'',
                    ''https://media.matchdo.cc/'', ''g'')::jsonb
                 WHERE %I IS NOT NULL AND %I::text LIKE ''%%supabase.co/storage%%''',
                t, c, c, c, c
            );
            EXECUTE q;
            GET DIAGNOSTICS n = ROW_COUNT;
            RAISE NOTICE 'JSONB %.%: % rows updated', t, c, n;
        END IF;
    END LOOP;
END
$rw$;

-- ========== TEXT[]（listings.images 為 text[]，非 jsonb）==========
DO $rw$
DECLARE
    n bigint;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'images'
          AND udt_name = '_text'
    ) THEN
        UPDATE public.listings
        SET images = ARRAY(
            SELECT regexp_replace(elem, 'https://[^/]+\.supabase\.co/storage/v1/object/public/', 'https://media.matchdo.cc/', 'g')
            FROM unnest(images) AS elem
        )
        WHERE images IS NOT NULL
          AND array_to_string(images, ' ') LIKE '%supabase.co/storage%';
        GET DIAGNOSTICS n = ROW_COUNT;
        RAISE NOTICE 'TEXT[] listings.images: % rows updated', n;
    END IF;
END
$rw$;

COMMIT;

-- 驗證（應 0 或極少）
SELECT count(*)::bigint AS remaining_supabase_storage_urls
FROM (
    SELECT reference_image_url AS u FROM public.custom_products WHERE reference_image_url LIKE '%supabase.co/storage%'
    UNION ALL
    SELECT ai_generated_image_url FROM public.custom_products WHERE ai_generated_image_url LIKE '%supabase.co/storage%'
    UNION ALL
    SELECT image_url FROM public.vendor_assets WHERE image_url LIKE '%supabase.co/storage%'
) x;
