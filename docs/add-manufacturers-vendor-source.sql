-- 廠商來源標記：供種子廠商模式區分「平台邀請/代建」與「自行註冊建檔」
-- 執行：Supabase SQL Editor（種子廠商實作時執行，可重複執行）
-- 還原點：見 docs/還原點-種子廠商實作前.md

ALTER TABLE public.manufacturers
    ADD COLUMN IF NOT EXISTS vendor_source text DEFAULT NULL;

COMMENT ON COLUMN public.manufacturers.vendor_source IS '來源：seed=種子廠商（平台邀請/代建），self_serve=自行註冊建檔，NULL=舊資料或未區分。不影響曝光與權限，僅供統計與日後擴充';

-- 既有資料不變（維持 NULL），新建立的種子廠商由 API 或後台寫入 vendor_source = ''seed''
