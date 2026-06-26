-- Enable required extension for UUID generation if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 基礎單價資料庫（AI/估價會用到）
CREATE TABLE IF NOT EXISTS price_library (
  id BIGSERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  unit TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'TWD',
  supplier_id UUID,
  region TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_library_item_name ON price_library (item_name);
CREATE INDEX IF NOT EXISTS idx_price_library_tags ON price_library USING GIN (tags);

-- 專家檔案（技能、標籤、時薪）
CREATE TABLE IF NOT EXISTS experts_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  display_name TEXT,
  title TEXT,
  skills TEXT[],
  tags TEXT[],
  rate NUMERIC(12,2),
  currency TEXT DEFAULT 'TWD',
  location TEXT,
  availability TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_experts_profile_tags ON experts_profile USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_experts_profile_skills ON experts_profile USING GIN (skills);

-- 專家上架的服務（listing）
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  price_min NUMERIC(12,2),
  price_max NUMERIC(12,2),
  currency TEXT DEFAULT 'TWD',
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_expires ON listings (expires_at);
CREATE INDEX IF NOT EXISTS idx_listings_tags ON listings USING GIN (tags);

-- 客戶提出的專案（project）
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC(12,2),
  currency TEXT DEFAULT 'TWD',
  tags TEXT[],
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON projects USING GIN (tags);

-- 專案與服務的媒合結果（match）
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

-- 對話（訊息）摘要（簡化）
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 金流（簡化：僅記錄狀態與時間）
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'TWD',
  status TEXT DEFAULT 'initiated',
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- 後台旗標（檢舉/審核用）
CREATE TABLE IF NOT EXISTS admin_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_admin_flags_entity ON admin_flags (entity_type, entity_id);

-- AI 分類（後台可管理）
CREATE TABLE IF NOT EXISTS ai_categories (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT,
  subcategories JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
