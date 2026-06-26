-- Embed Simulator：iframe 實例、用量計數、訪客成圖
-- 執行：Supabase SQL Editor（部署 embed API 前必跑）

ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS embed_enabled boolean DEFAULT false;

ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS embed_generations_monthly integer DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.embed_enabled IS '是否可使用嵌入式產品模擬器';
COMMENT ON COLUMN public.subscription_plans.embed_generations_monthly IS '廠商每月免費 embed 生圖次數（0=僅能超額扣點）';

CREATE TABLE IF NOT EXISTS public.manufacturer_embed_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '預設模擬器',
  embed_key text NOT NULL UNIQUE,
  embed_secret text NOT NULL,
  prototype_asset_id uuid REFERENCES public.vendor_assets(id) ON DELETE SET NULL,
  allowed_origins jsonb DEFAULT '[]'::jsonb,
  rate_limit_per_ip_hour integer DEFAULT 5,
  daily_cap integer DEFAULT 100,
  monthly_cap integer DEFAULT 500,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embed_instances_mfr ON public.manufacturer_embed_instances(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_embed_instances_key ON public.manufacturer_embed_instances(embed_key);

COMMENT ON TABLE public.manufacturer_embed_instances IS '廠商 iframe 嵌入實例（一 iframe = 一款主產品）';
COMMENT ON COLUMN public.manufacturer_embed_instances.prototype_asset_id IS '綁定主產品 vendor_assets.id；訪客不可改款';

CREATE TABLE IF NOT EXISTS public.embed_instance_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embed_instance_id uuid NOT NULL REFERENCES public.manufacturer_embed_instances(id) ON DELETE CASCADE,
  date date NOT NULL,
  count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(embed_instance_id, date)
);

CREATE INDEX IF NOT EXISTS idx_embed_usage_instance_date ON public.embed_instance_usage_counters(embed_instance_id, date);

CREATE TABLE IF NOT EXISTS public.vendor_embed_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embed_instance_id uuid NOT NULL REFERENCES public.manufacturer_embed_instances(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  prototype_asset_id uuid REFERENCES public.vendor_assets(id) ON DELETE SET NULL,
  reference_sources jsonb DEFAULT '[]'::jsonb,
  prompt text,
  ai_generated_image_url text,
  generation_seed integer,
  visitor_ip_hash text,
  embed_session_id text,
  referrer_host text,
  billing_type text CHECK (billing_type IN ('plan_quota', 'credit_overage')),
  points_charged integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embed_designs_mfr ON public.vendor_embed_designs(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_embed_designs_instance ON public.vendor_embed_designs(embed_instance_id);
CREATE INDEX IF NOT EXISTS idx_embed_designs_created ON public.vendor_embed_designs(created_at DESC);

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('points_embed_simulator_generate', '10', now())
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- 測試用：建立實例後以 Node 產生 sig
-- node -e "const c=require('crypto'); const k='YOUR_EMBED_KEY'; const s='YOUR_SECRET'; console.log(c.createHmac('sha256',s).update(k).digest('hex'))"
