-- =============================================
-- 為 listings 表新增子分類欄位
-- 用途：支援媒合演算法的子分類匹配（20%評分）
-- =============================================

-- 1. 新增子分類欄位
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 2. 新增外鍵約束（確保子分類存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ai_subcategories'
    ) THEN
        ALTER TABLE public.listings
        ADD CONSTRAINT fk_listings_subcategory
        FOREIGN KEY (subcategory) REFERENCES public.ai_subcategories(key)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. 建立索引（優化查詢效能）
CREATE INDEX IF NOT EXISTS idx_listings_subcategory 
ON public.listings(subcategory);

-- 4. 複合索引（常用查詢：category + subcategory）
CREATE INDEX IF NOT EXISTS idx_listings_category_subcategory 
ON public.listings(category, subcategory);

-- 5. 新增欄位註解
COMMENT ON COLUMN public.listings.subcategory IS '子分類 key，對應 ai_subcategories.key，用於媒合評分';

-- 6. 驗證結果
SELECT 
    'listings 表已新增 subcategory 欄位' as message,
    COUNT(*) as total_listings,
    COUNT(subcategory) as with_subcategory
FROM public.listings;
