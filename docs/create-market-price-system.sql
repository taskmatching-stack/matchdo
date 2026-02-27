-- =============================================
-- 市場價格管理系統
-- 用途：預先計算市場價，提升媒合效能
-- 更新：2026-02-06
-- =============================================

-- ========================================
-- 1. 市場價格表（預先計算結果）
-- ========================================

CREATE TABLE IF NOT EXISTS public.market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL,              -- 子分類 key (例：home__interior_design)
    tag_filter TEXT[],                      -- 標籤過濾（NULL = 預設，用於細分市場價）
    market_price DECIMAL(10,2) NOT NULL,    -- 市場價（底價均值 × 1.25）
    avg_price_min DECIMAL(10,2),            -- 平均底價
    avg_price_max DECIMAL(10,2),            -- 平均上限價
    median_price DECIMAL(10,2),             -- 中位數價格
    sample_count INT,                       -- 樣本數量
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,                        -- 更新者（管理員）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subcategory, tag_filter)         -- 子分類 + tags 組合唯一
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_market_prices_subcategory 
ON public.market_prices(subcategory);

CREATE INDEX IF NOT EXISTS idx_market_prices_updated 
ON public.market_prices(last_updated_at DESC);

-- 註解
COMMENT ON TABLE public.market_prices IS '市場價格表（預先計算，供媒合快速查詢）';
COMMENT ON COLUMN public.market_prices.tag_filter IS 'NULL = 預設市場價；有值 = 特定 tags 的細分市場價';
COMMENT ON COLUMN public.market_prices.market_price IS '市場價 = 排除離群值後的底價均值 × 1.25';

-- ========================================
-- 2. 價格計算規則表（管理員控制）
-- ========================================

CREATE TABLE IF NOT EXISTS public.price_calculation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL UNIQUE,       -- 子分類
    enable_tag_split BOOLEAN DEFAULT false, -- 是否啟用 tag 細分
    split_tags TEXT[],                      -- 要細分的 tags（例：['豪宅', '現代風格']）
    min_sample_size INT DEFAULT 5,          -- 最小樣本數（少於此數不細分）
    auto_update_enabled BOOLEAN DEFAULT true,     -- 是否自動更新
    auto_update_frequency TEXT DEFAULT 'daily',   -- daily/weekly/monthly
    notes TEXT,                             -- 管理員備註
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_price_rules_subcategory 
ON public.price_calculation_rules(subcategory);

-- 註解
COMMENT ON TABLE public.price_calculation_rules IS '價格計算規則（管理員控制市場價的計算方式）';
COMMENT ON COLUMN public.price_calculation_rules.enable_tag_split IS '當某子分類中不同 tags 的價位有明顯差異時，管理員可啟用細分';
COMMENT ON COLUMN public.price_calculation_rules.split_tags IS '要細分的 tags 清單（例：豪宅、現代風格等）';

-- ========================================
-- 3. 價格趨勢記錄表（歷史追蹤）
-- ========================================

CREATE TABLE IF NOT EXISTS public.price_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL,
    tag_filter TEXT[],                      -- NULL = 預設，有值 = 特定 tags
    market_price DECIMAL(10,2),
    sample_count INT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_price_trends_subcategory_date 
ON public.price_trends(subcategory, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_trends_recorded 
ON public.price_trends(recorded_at DESC);

-- 註解
COMMENT ON TABLE public.price_trends IS '價格趨勢歷史記錄（每次更新都會新增一筆，用於繪製趨勢圖）';

-- ========================================
-- 4. 媒合評分設定表
-- ========================================

CREATE TABLE IF NOT EXISTS public.matching_config (
    subcategory TEXT PRIMARY KEY,           -- 子分類
    category_weight DECIMAL(3,2) DEFAULT 0.10,      -- 主分類匹配權重
    subcategory_weight DECIMAL(3,2) DEFAULT 0.10,   -- 子分類匹配權重
    price_weight DECIMAL(3,2) DEFAULT 0.40,         -- 價格合理度權重
    keyword_weight DECIMAL(3,2) DEFAULT 0.40,       -- 關鍵字相關度權重
    price_tolerance DECIMAL(3,2) DEFAULT 0.00,      -- 價格過濾寬容度（0 = 嚴格）
    notes TEXT,                             -- 管理員備註
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT weights_sum_check CHECK (
        category_weight + subcategory_weight + price_weight + keyword_weight = 1.00
    )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_matching_config_subcategory 
ON public.matching_config(subcategory);

-- 註解
COMMENT ON TABLE public.matching_config IS '媒合評分設定（管理員可針對不同子分類調整權重）';
COMMENT ON COLUMN public.matching_config.price_tolerance IS '價格過濾寬容度（例：0.20 = 允許師傅均價超出預算 20%）';

-- ========================================
-- 5. RLS 政策
-- ========================================

ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_calculation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_config ENABLE ROW LEVEL SECURITY;

-- 所有人可讀市場價格
CREATE POLICY "市場價格公開可讀"
    ON public.market_prices FOR SELECT
    USING (true);

-- 管理員可管理
CREATE POLICY "管理員可管理市場價格"
    ON public.market_prices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "管理員可管理計算規則"
    ON public.price_calculation_rules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "管理員可管理趨勢記錄"
    ON public.price_trends FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "管理員可管理媒合設定"
    ON public.matching_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- ========================================
-- 6. 驗證資料表
-- ========================================

SELECT 
    '✅ market_prices 表已建立' as message,
    COUNT(*) as total_records
FROM public.market_prices;

SELECT 
    '✅ price_calculation_rules 表已建立' as message,
    COUNT(*) as total_records
FROM public.price_calculation_rules;

SELECT 
    '✅ price_trends 表已建立' as message,
    COUNT(*) as total_records
FROM public.price_trends;

SELECT 
    '✅ matching_config 表已建立' as message,
    COUNT(*) as total_records
FROM public.matching_config;

SELECT '🎉 市場價格管理系統資料表建立完成！' as summary;
