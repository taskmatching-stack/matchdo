-- =============================================
-- Listings 表新增「數量區間 × 單價區間」階梯定價
-- 承包商可自訂：不同數量區間對應不同單價區間
-- 更新：2026-02-06
-- =============================================

-- 新增欄位
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS price_tiers JSONB DEFAULT NULL;

COMMENT ON COLUMN public.listings.price_tiers IS '階梯定價：依數量區間對應不同單價區間。格式見下方。若為 null 或空陣列，則使用 price_min/price_max/unit。';

-- ========================================
-- price_tiers 格式說明
-- ========================================
/*
陣列，每筆一階。依 quantity_min 由小到大排序。

[
  {
    "quantity_min": 1,        -- 數量下限（含）
    "quantity_max": 10,        -- 數量上限（含），null 表示「以上」
    "unit_price_min": 8000,    -- 該區間單價下限
    "unit_price_max": 12000    -- 該區間單價上限
  },
  {
    "quantity_min": 11,
    "quantity_max": 30,
    "unit_price_min": 7000,
    "unit_price_max": 10000
  },
  {
    "quantity_min": 31,
    "quantity_max": null,
    "unit_price_min": 6000,
    "unit_price_max": 9000
  }
]

媒合時：依發包商的「數量」落入哪一階，取該階的 unit_price_min/max × 數量 與總預算比對。
*/

-- 索引（可選，方便查有無階梯）
CREATE INDEX IF NOT EXISTS idx_listings_price_tiers
ON public.listings USING GIN (price_tiers)
WHERE price_tiers IS NOT NULL AND jsonb_array_length(price_tiers) > 0;

SELECT 'listings.price_tiers 已新增，承包商可填多組數量×單價區間' AS message;
