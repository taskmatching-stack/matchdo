-- =============================================
-- 市場價格計算函數
-- 用途：自動計算並更新市場價格
-- 更新：2026-02-06
-- 重要：market_price 為「市場單價」（每單位價格）
-- =============================================

-- ========================================
-- 函數 1：計算預設市場單價（按子分類）
-- 說明：從 listings.price_min（單價）計算市場單價
-- ========================================

CREATE OR REPLACE FUNCTION calculate_market_price_default(target_subcategory TEXT)
RETURNS TABLE(
    market_price DECIMAL,
    avg_price_min DECIMAL,
    avg_price_max DECIMAL,
    median_price DECIMAL,
    sample_count INT
) AS $$
DECLARE
    v_market_price DECIMAL;
    v_avg_price_min DECIMAL;
    v_avg_price_max DECIMAL;
    v_median_price DECIMAL;
    v_sample_count INT;
BEGIN
    WITH prices AS (
        -- 查詢該子分類的所有 active listings
        SELECT 
            price_min,
            price_max,
            ROW_NUMBER() OVER (ORDER BY price_min) as rn,
            COUNT(*) OVER () as total
        FROM listings
        WHERE subcategory = target_subcategory
          AND status = 'active'
          AND price_min > 0
    ),
    filtered AS (
        -- 排除前後 5% 離群值
        SELECT price_min, price_max
        FROM prices
        WHERE rn > (total * 0.05)
          AND rn <= (total * 0.95)
    )
    SELECT 
        ROUND((AVG(price_min) * 1.25)::numeric, 0),    -- 市場價 = 底價均值 × 1.25
        ROUND(AVG(price_min)::numeric, 0),             -- 平均底價
        ROUND(AVG(price_max)::numeric, 0),             -- 平均上限價
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_min)::numeric, 0),  -- 中位數
        COUNT(*)::INT                                  -- 樣本數
    INTO 
        v_market_price,
        v_avg_price_min,
        v_avg_price_max,
        v_median_price,
        v_sample_count
    FROM filtered;
    
    RETURN QUERY SELECT v_market_price, v_avg_price_min, v_avg_price_max, v_median_price, v_sample_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 函數 2：計算細分市場價（按子分類 + Tag）
-- ========================================

CREATE OR REPLACE FUNCTION calculate_market_price_with_tag(
    target_subcategory TEXT,
    target_tag TEXT
)
RETURNS TABLE(
    market_price DECIMAL,
    avg_price_min DECIMAL,
    avg_price_max DECIMAL,
    median_price DECIMAL,
    sample_count INT
) AS $$
DECLARE
    v_market_price DECIMAL;
    v_avg_price_min DECIMAL;
    v_avg_price_max DECIMAL;
    v_median_price DECIMAL;
    v_sample_count INT;
BEGIN
    WITH prices AS (
        -- 查詢該子分類中包含特定 tag 的 listings
        SELECT 
            price_min,
            price_max,
            ROW_NUMBER() OVER (ORDER BY price_min) as rn,
            COUNT(*) OVER () as total
        FROM listings
        WHERE subcategory = target_subcategory
          AND target_tag = ANY(tags)        -- 包含該 tag
          AND status = 'active'
          AND price_min > 0
    ),
    filtered AS (
        -- 排除前後 5% 離群值
        SELECT price_min, price_max
        FROM prices
        WHERE rn > (total * 0.05)
          AND rn <= (total * 0.95)
    )
    SELECT 
        ROUND((AVG(price_min) * 1.25)::numeric, 0),
        ROUND(AVG(price_min)::numeric, 0),
        ROUND(AVG(price_max)::numeric, 0),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_min)::numeric, 0),
        COUNT(*)::INT
    INTO 
        v_market_price,
        v_avg_price_min,
        v_avg_price_max,
        v_median_price,
        v_sample_count
    FROM filtered;
    
    RETURN QUERY SELECT v_market_price, v_avg_price_min, v_avg_price_max, v_median_price, v_sample_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 函數 3：更新單一子分類的市場價
-- ========================================

CREATE OR REPLACE FUNCTION update_market_price_for_subcategory(
    target_subcategory TEXT,
    admin_user_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    rule_record RECORD;
    price_result RECORD;
    tag_item TEXT;
    updated_count INT := 0;
BEGIN
    -- 1. 查詢計算規則
    SELECT * INTO rule_record
    FROM public.price_calculation_rules
    WHERE subcategory = target_subcategory;
    
    -- 2. 更新預設市場價（無 tag 過濾）
    SELECT * INTO price_result
    FROM calculate_market_price_default(target_subcategory);
    
    IF price_result.sample_count > 0 THEN
        INSERT INTO public.market_prices (
            subcategory, tag_filter, market_price, avg_price_min, avg_price_max, 
            median_price, sample_count, updated_by
        ) VALUES (
            target_subcategory, NULL, price_result.market_price, price_result.avg_price_min,
            price_result.avg_price_max, price_result.median_price, price_result.sample_count, admin_user_id
        )
        ON CONFLICT (subcategory, tag_filter) 
        DO UPDATE SET
            market_price = EXCLUDED.market_price,
            avg_price_min = EXCLUDED.avg_price_min,
            avg_price_max = EXCLUDED.avg_price_max,
            median_price = EXCLUDED.median_price,
            sample_count = EXCLUDED.sample_count,
            last_updated_at = NOW(),
            updated_by = admin_user_id;
        
        -- 記錄趨勢
        INSERT INTO public.price_trends (subcategory, tag_filter, market_price, sample_count)
        VALUES (target_subcategory, NULL, price_result.market_price, price_result.sample_count);
        
        updated_count := updated_count + 1;
    END IF;
    
    -- 3. 如果啟用 tag 細分，更新各 tag 的市場價
    IF rule_record.enable_tag_split AND rule_record.split_tags IS NOT NULL THEN
        FOREACH tag_item IN ARRAY rule_record.split_tags
        LOOP
            SELECT * INTO price_result
            FROM calculate_market_price_with_tag(target_subcategory, tag_item);
            
            -- 只有樣本數足夠才寫入
            IF price_result.sample_count >= rule_record.min_sample_size THEN
                INSERT INTO public.market_prices (
                    subcategory, tag_filter, market_price, avg_price_min, avg_price_max,
                    median_price, sample_count, updated_by
                ) VALUES (
                    target_subcategory, ARRAY[tag_item], price_result.market_price, 
                    price_result.avg_price_min, price_result.avg_price_max, 
                    price_result.median_price, price_result.sample_count, admin_user_id
                )
                ON CONFLICT (subcategory, tag_filter) 
                DO UPDATE SET
                    market_price = EXCLUDED.market_price,
                    avg_price_min = EXCLUDED.avg_price_min,
                    avg_price_max = EXCLUDED.avg_price_max,
                    median_price = EXCLUDED.median_price,
                    sample_count = EXCLUDED.sample_count,
                    last_updated_at = NOW(),
                    updated_by = admin_user_id;
                
                -- 記錄趨勢
                INSERT INTO public.price_trends (subcategory, tag_filter, market_price, sample_count)
                VALUES (target_subcategory, ARRAY[tag_item], price_result.market_price, price_result.sample_count);
                
                updated_count := updated_count + 1;
            END IF;
        END LOOP;
    END IF;
    
    RETURN format('✅ %s：已更新 %s 筆市場價記錄', target_subcategory, updated_count);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 函數 4：批次更新所有子分類的市場價
-- ========================================

CREATE OR REPLACE FUNCTION update_all_market_prices(admin_user_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    subcat_record RECORD;
    result_text TEXT := '';
    total_updated INT := 0;
BEGIN
    -- 掃描所有有 listings 的子分類
    FOR subcat_record IN 
        SELECT DISTINCT subcategory 
        FROM listings 
        WHERE subcategory IS NOT NULL 
          AND status = 'active'
        ORDER BY subcategory
    LOOP
        result_text := result_text || update_market_price_for_subcategory(subcat_record.subcategory, admin_user_id) || E'\n';
        total_updated := total_updated + 1;
    END LOOP;
    
    RETURN format('🎉 批次更新完成！共處理 %s 個子分類', total_updated) || E'\n' || result_text;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 測試查詢
-- ========================================

-- 查看所有市場價格
SELECT 
    subcategory,
    CASE 
        WHEN tag_filter IS NULL THEN '預設'
        ELSE array_to_string(tag_filter, ', ')
    END as tag,
    market_price,
    sample_count,
    last_updated_at
FROM public.market_prices
ORDER BY subcategory, tag_filter NULLS FIRST;

-- 使用範例
-- SELECT * FROM calculate_market_price_default('home__interior_design');
-- SELECT update_market_price_for_subcategory('home__interior_design');
-- SELECT update_all_market_prices();
