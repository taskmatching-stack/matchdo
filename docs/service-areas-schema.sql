-- =============================================
-- service_areas 服務地區管理表
-- 執行方式：Supabase SQL Editor 貼入全部執行
--
-- 執行後：
--   1. service_areas 表建立完成，含完整種子資料
--   2. 現有 contact_info.company_address 舊中文字串自動轉 code
--   3. 現有 manufacturers.contact_json.service_area 舊中文字串自動轉 code
-- =============================================

-- ── 1. 建立 service_areas 資料表 ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_areas (
    id          serial      PRIMARY KEY,
    code        text        UNIQUE NOT NULL,   -- 'TW-TPE' / 'GB' / 'OVERSEAS'
    name_zh     text        NOT NULL,          -- '臺北'
    name_en     text        NOT NULL,          -- 'Taipei'
    group_code  text        NOT NULL,          -- 'TW-N' / 'OVERSEAS'
    group_zh    text        NOT NULL,          -- '北部'
    group_en    text        NOT NULL,          -- 'North Taiwan'
    sort_order  int         NOT NULL DEFAULT 0,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS：讀取公開，寫入限 admin
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_areas_select" ON public.service_areas;
CREATE POLICY "service_areas_select"
    ON public.service_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_areas_admin"  ON public.service_areas;
CREATE POLICY "service_areas_admin"
    ON public.service_areas FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ── 2. 種子資料（與 area-codes.js 同步，新增地區在此加入）──
-- 台灣北部
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('TW-TPE','臺北','Taipei',         'TW-N','北部','North Taiwan',10),
    ('TW-NWT','新北','New Taipei',      'TW-N','北部','North Taiwan',20),
    ('TW-KEE','基隆','Keelung',         'TW-N','北部','North Taiwan',30),
    ('TW-TAO','桃園','Taoyuan',         'TW-N','北部','North Taiwan',40),
    ('TW-HSQ','新竹縣','Hsinchu County','TW-N','北部','North Taiwan',50),
    ('TW-HSZ','新竹市','Hsinchu City',  'TW-N','北部','North Taiwan',60),
    ('TW-ILA','宜蘭','Yilan',           'TW-N','北部','North Taiwan',70)
ON CONFLICT (code) DO NOTHING;

-- 台灣中部
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('TW-TXG','臺中','Taichung',   'TW-C','中部','Central Taiwan',10),
    ('TW-MIA','苗栗','Miaoli',     'TW-C','中部','Central Taiwan',20),
    ('TW-CHA','彰化','Changhua',   'TW-C','中部','Central Taiwan',30),
    ('TW-NAN','南投','Nantou',     'TW-C','中部','Central Taiwan',40),
    ('TW-YUN','雲林','Yunlin',     'TW-C','中部','Central Taiwan',50)
ON CONFLICT (code) DO NOTHING;

-- 台灣南部
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('TW-KHH','高雄','Kaohsiung',      'TW-S','南部','South Taiwan',10),
    ('TW-TNN','臺南','Tainan',          'TW-S','南部','South Taiwan',20),
    ('TW-CYI','嘉義縣','Chiayi County','TW-S','南部','South Taiwan',30),
    ('TW-CYQ','嘉義市','Chiayi City',  'TW-S','南部','South Taiwan',40),
    ('TW-PIF','屏東','Pingtung',        'TW-S','南部','South Taiwan',50),
    ('TW-PEH','澎湖','Penghu',          'TW-S','南部','South Taiwan',60)
ON CONFLICT (code) DO NOTHING;

-- 台灣東部
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('TW-HUA','花蓮','Hualien','TW-E','東部','East Taiwan',10),
    ('TW-TTT','臺東','Taitung','TW-E','東部','East Taiwan',20)
ON CONFLICT (code) DO NOTHING;

-- 離島
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('TW-KIN','金門','Kinmen',    'TW-O','離島','Outlying Islands',10),
    ('TW-LIE','連江','Lienchiang','TW-O','離島','Outlying Islands',20)
ON CONFLICT (code) DO NOTHING;

-- 海外（新增國家：在此加一行，Admin 頁面也會同步顯示）
INSERT INTO public.service_areas (code,name_zh,name_en,group_code,group_zh,group_en,sort_order) VALUES
    ('JP','日本','Japan',          'OVERSEAS','海外','Overseas',10),
    ('KR','南韓','South Korea',    'OVERSEAS','海外','Overseas',20),
    ('SG','新加坡','Singapore',    'OVERSEAS','海外','Overseas',30),
    ('HK','香港','Hong Kong',      'OVERSEAS','海外','Overseas',40),
    ('MY','馬來西亞','Malaysia',   'OVERSEAS','海外','Overseas',50),
    ('TH','泰國','Thailand',       'OVERSEAS','海外','Overseas',60),
    ('VN','越南','Vietnam',        'OVERSEAS','海外','Overseas',70),
    ('PH','菲律賓','Philippines',  'OVERSEAS','海外','Overseas',80),
    ('ID','印尼','Indonesia',      'OVERSEAS','海外','Overseas',90),
    ('AU','澳洲','Australia',      'OVERSEAS','海外','Overseas',100),
    ('NZ','紐西蘭','New Zealand',  'OVERSEAS','海外','Overseas',110),
    ('US','美國','USA',            'OVERSEAS','海外','Overseas',120),
    ('CA','加拿大','Canada',       'OVERSEAS','海外','Overseas',130),
    ('GB','英國','UK',             'OVERSEAS','海外','Overseas',140),
    ('DE','德國','Germany',        'OVERSEAS','海外','Overseas',150),
    ('FR','法國','France',         'OVERSEAS','海外','Overseas',160),
    ('NL','荷蘭','Netherlands',    'OVERSEAS','海外','Overseas',170),
    ('AE','阿聯酋','UAE',          'OVERSEAS','海外','Overseas',180),
    ('OTHER','其他海外','Other',   'OVERSEAS','海外','Overseas',999)
ON CONFLICT (code) DO NOTHING;

-- ── 3. 舊資料遷移：中文字串 → ISO code ───────────────────────
-- 建立對照 function
CREATE OR REPLACE FUNCTION _zh_to_area_code(txt text) RETURNS text AS $$
DECLARE
    m text;
BEGIN
    -- 正規化：台 → 臺
    txt := regexp_replace(txt, '^台', '臺');
    SELECT code INTO m FROM public.service_areas WHERE name_zh = txt LIMIT 1;
    IF m IS NOT NULL THEN RETURN m; END IF;
    -- fallback: 原文保留
    RETURN txt;
END;
$$ LANGUAGE plpgsql;

-- 遷移 contact_info.company_address（逗號分隔字串）
UPDATE public.contact_info
SET    company_address = (
    SELECT string_agg(_zh_to_area_code(trim(part)), ',')
    FROM   unnest(string_to_array(company_address, ',')) AS part
    WHERE  trim(part) <> ''
)
WHERE  company_address IS NOT NULL
  AND  company_address <> ''
  -- 跳過已是 code 格式的資料（TW- 開頭或純大寫字母）
  AND  company_address !~ '^[A-Z][A-Z0-9-]';

-- 遷移 manufacturers.contact_json.service_area（字串或陣列）
UPDATE public.manufacturers
SET    contact_json = jsonb_set(
    contact_json,
    '{service_area}',
    (
        SELECT jsonb_agg(_zh_to_area_code(trim(v::text, '"')))
        FROM   jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(contact_json->'service_area') = 'array'
                THEN contact_json->'service_area'
                ELSE jsonb_build_array(contact_json->>'service_area')
            END
        ) AS v
        WHERE  trim(v::text, '"') <> ''
    )
)
WHERE  contact_json ? 'service_area'
  AND  contact_json->>'service_area' IS NOT NULL
  AND  contact_json->>'service_area' <> ''
  AND  contact_json->>'service_area' <> '[]';

-- 清理暫用 function
DROP FUNCTION IF EXISTS _zh_to_area_code(text);

-- ── 完成提示 ─────────────────────────────────────────────────
SELECT 'service_areas 表建立完成，共 ' || count(*) || ' 筆地區資料。' AS status
FROM   public.service_areas;
