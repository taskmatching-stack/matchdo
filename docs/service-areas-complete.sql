-- =============================================
-- 服務地區完整建置 SQL（可重複執行，安全冪等）
-- 在 Supabase SQL Editor 一次貼上執行
-- =============================================

-- ① 加入新欄位（若已存在則跳過）
ALTER TABLE public.service_areas
    ADD COLUMN IF NOT EXISTS parent_code text,
    ADD COLUMN IF NOT EXISTS area_type   text NOT NULL DEFAULT 'country';

-- 加外鍵（若尚未加）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'service_areas_parent_code_fkey'
    ) THEN
        ALTER TABLE public.service_areas
            ADD CONSTRAINT service_areas_parent_code_fkey
            FOREIGN KEY (parent_code) REFERENCES public.service_areas(code) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sa_parent ON public.service_areas(parent_code);
CREATE INDEX IF NOT EXISTS idx_sa_type   ON public.service_areas(area_type);

-- =============================================
-- ② 插入「台灣 TW」頂層節點
-- =============================================
INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active)
VALUES ('TW','台灣','Taiwan','ASIA','亞洲','Asia',1,'country',NULL,true)
ON CONFLICT (code) DO UPDATE SET area_type='country', parent_code=NULL, is_active=true;

-- ③ 把所有台灣縣市的 parent_code 設為 'TW'，area_type 設為 'tw_city'
UPDATE public.service_areas
SET parent_code = 'TW', area_type = 'tw_city'
WHERE code IN (
    'TW-TPE','TW-NWT','TW-KEE','TW-TAO','TW-HSQ','TW-HSZ','TW-ILA',
    'TW-TXG','TW-MIA','TW-CHA','TW-NAN','TW-YUN',
    'TW-KHH','TW-TNN','TW-CYI','TW-CYQ','TW-PIF','TW-PEH',
    'TW-HUA','TW-TTT',
    'TW-KIN','TW-LIE'
);

-- ④ 把所有海外國家設為 country、parent_code=NULL
UPDATE public.service_areas
SET area_type = 'country', parent_code = NULL
WHERE code IN ('JP','KR','SG','HK','MY','TH','VN','PH','ID','AU','NZ','US','CA','GB','DE','FR','NL','AE','OTHER')
  AND area_type != 'country';

-- =============================================
-- ⑤ 英國（GB）：4 地區 + 主要城市
-- =============================================
INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('GB-ENG','英格蘭','England',      'OVERSEAS','海外','Overseas',10,'state','GB',true),
('GB-SCT','蘇格蘭','Scotland',     'OVERSEAS','海外','Overseas',20,'state','GB',true),
('GB-WLS','威爾斯','Wales',        'OVERSEAS','海外','Overseas',30,'state','GB',true),
('GB-NIR','北愛爾蘭','N. Ireland', 'OVERSEAS','海外','Overseas',40,'state','GB',true)
ON CONFLICT (code) DO UPDATE SET area_type='state', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('GB-ENG-LON','倫敦',       'London',      'OVERSEAS','海外','Overseas',10,'city','GB-ENG',true),
('GB-ENG-MAN','曼徹斯特',   'Manchester',  'OVERSEAS','海外','Overseas',20,'city','GB-ENG',true),
('GB-ENG-BHM','伯明罕',     'Birmingham',  'OVERSEAS','海外','Overseas',30,'city','GB-ENG',true),
('GB-ENG-LDS','里茲',       'Leeds',       'OVERSEAS','海外','Overseas',40,'city','GB-ENG',true),
('GB-ENG-LVP','利物浦',     'Liverpool',   'OVERSEAS','海外','Overseas',50,'city','GB-ENG',true),
('GB-ENG-BST','布里斯托',   'Bristol',     'OVERSEAS','海外','Overseas',60,'city','GB-ENG',true),
('GB-SCT-EDI','愛丁堡',     'Edinburgh',   'OVERSEAS','海外','Overseas',10,'city','GB-SCT',true),
('GB-SCT-GLA','格拉斯哥',   'Glasgow',     'OVERSEAS','海外','Overseas',20,'city','GB-SCT',true),
('GB-WLS-CDF','加的夫',     'Cardiff',     'OVERSEAS','海外','Overseas',10,'city','GB-WLS',true),
('GB-NIR-BFS','貝爾法斯特', 'Belfast',     'OVERSEAS','海外','Overseas',10,'city','GB-NIR',true)
ON CONFLICT (code) DO UPDATE SET area_type='city', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

-- =============================================
-- ⑥ 美國（US）：主要州 + 城市
-- =============================================
INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('US-CA','加利福尼亞州','California',       'OVERSEAS','海外','Overseas',10,'state','US',true),
('US-NY','紐約州',      'New York',         'OVERSEAS','海外','Overseas',20,'state','US',true),
('US-TX','德克薩斯州',  'Texas',            'OVERSEAS','海外','Overseas',30,'state','US',true),
('US-FL','佛羅里達州',  'Florida',          'OVERSEAS','海外','Overseas',40,'state','US',true),
('US-IL','伊利諾伊州',  'Illinois',         'OVERSEAS','海外','Overseas',50,'state','US',true),
('US-WA','華盛頓州',    'Washington',       'OVERSEAS','海外','Overseas',60,'state','US',true),
('US-MA','麻薩諸塞州',  'Massachusetts',    'OVERSEAS','海外','Overseas',70,'state','US',true),
('US-GA','喬治亞州',    'Georgia',          'OVERSEAS','海外','Overseas',80,'state','US',true),
('US-NV','內華達州',    'Nevada',           'OVERSEAS','海外','Overseas',90,'state','US',true),
('US-HI','夏威夷州',    'Hawaii',           'OVERSEAS','海外','Overseas',100,'state','US',true)
ON CONFLICT (code) DO UPDATE SET area_type='state', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('US-CA-LA', '洛杉磯',    'Los Angeles',   'OVERSEAS','海外','Overseas',10,'city','US-CA',true),
('US-CA-SF', '舊金山',    'San Francisco', 'OVERSEAS','海外','Overseas',20,'city','US-CA',true),
('US-CA-SD', '聖地牙哥',  'San Diego',     'OVERSEAS','海外','Overseas',30,'city','US-CA',true),
('US-CA-SJ', '聖荷西',    'San Jose',      'OVERSEAS','海外','Overseas',40,'city','US-CA',true),
('US-NY-NYC','紐約市',    'New York City', 'OVERSEAS','海外','Overseas',10,'city','US-NY',true),
('US-NY-BUF','水牛城',    'Buffalo',       'OVERSEAS','海外','Overseas',20,'city','US-NY',true),
('US-TX-HOU','休士頓',    'Houston',       'OVERSEAS','海外','Overseas',10,'city','US-TX',true),
('US-TX-DAL','達拉斯',    'Dallas',        'OVERSEAS','海外','Overseas',20,'city','US-TX',true),
('US-TX-AUS','奧斯汀',    'Austin',        'OVERSEAS','海外','Overseas',30,'city','US-TX',true),
('US-FL-MIA','邁阿密',    'Miami',         'OVERSEAS','海外','Overseas',10,'city','US-FL',true),
('US-FL-ORL','奧蘭多',    'Orlando',       'OVERSEAS','海外','Overseas',20,'city','US-FL',true),
('US-IL-CHI','芝加哥',    'Chicago',       'OVERSEAS','海外','Overseas',10,'city','US-IL',true),
('US-WA-SEA','西雅圖',    'Seattle',       'OVERSEAS','海外','Overseas',10,'city','US-WA',true),
('US-MA-BOS','波士頓',    'Boston',        'OVERSEAS','海外','Overseas',10,'city','US-MA',true),
('US-GA-ATL','亞特蘭大',  'Atlanta',       'OVERSEAS','海外','Overseas',10,'city','US-GA',true),
('US-NV-LAS','拉斯維加斯','Las Vegas',     'OVERSEAS','海外','Overseas',10,'city','US-NV',true),
('US-HI-HNL','檀香山',    'Honolulu',      'OVERSEAS','海外','Overseas',10,'city','US-HI',true)
ON CONFLICT (code) DO UPDATE SET area_type='city', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

-- =============================================
-- ⑦ 澳洲（AU）：8 州/領地 + 主要城市
-- =============================================
INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('AU-NSW','新南威爾斯州',       'New South Wales',        'OVERSEAS','海外','Overseas',10,'state','AU',true),
('AU-VIC','維多利亞州',         'Victoria',               'OVERSEAS','海外','Overseas',20,'state','AU',true),
('AU-QLD','昆士蘭州',           'Queensland',             'OVERSEAS','海外','Overseas',30,'state','AU',true),
('AU-WA', '西澳大利亞州',       'Western Australia',      'OVERSEAS','海外','Overseas',40,'state','AU',true),
('AU-SA', '南澳大利亞州',       'South Australia',        'OVERSEAS','海外','Overseas',50,'state','AU',true),
('AU-TAS','塔斯馬尼亞州',       'Tasmania',               'OVERSEAS','海外','Overseas',60,'state','AU',true),
('AU-ACT','澳洲首都領地',       'ACT (Canberra)',         'OVERSEAS','海外','Overseas',70,'state','AU',true),
('AU-NT', '北領地',             'Northern Territory',     'OVERSEAS','海外','Overseas',80,'state','AU',true)
ON CONFLICT (code) DO UPDATE SET area_type='state', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

INSERT INTO public.service_areas (code, name_zh, name_en, group_code, group_zh, group_en, sort_order, area_type, parent_code, is_active) VALUES
('AU-NSW-SYD','雪梨',     'Sydney',      'OVERSEAS','海外','Overseas',10,'city','AU-NSW',true),
('AU-NSW-NEW','紐卡索',   'Newcastle',   'OVERSEAS','海外','Overseas',20,'city','AU-NSW',true),
('AU-VIC-MEL','墨爾本',   'Melbourne',   'OVERSEAS','海外','Overseas',10,'city','AU-VIC',true),
('AU-VIC-GEE','吉隆',     'Geelong',     'OVERSEAS','海外','Overseas',20,'city','AU-VIC',true),
('AU-QLD-BNE','布里斯本', 'Brisbane',    'OVERSEAS','海外','Overseas',10,'city','AU-QLD',true),
('AU-QLD-GCT','黃金海岸', 'Gold Coast',  'OVERSEAS','海外','Overseas',20,'city','AU-QLD',true),
('AU-QLD-CNS','凱恩斯',   'Cairns',      'OVERSEAS','海外','Overseas',30,'city','AU-QLD',true),
('AU-WA-PER', '伯斯',     'Perth',       'OVERSEAS','海外','Overseas',10,'city','AU-WA', true),
('AU-SA-ADL', '阿得雷德', 'Adelaide',    'OVERSEAS','海外','Overseas',10,'city','AU-SA', true),
('AU-TAS-HOB','荷巴特',   'Hobart',      'OVERSEAS','海外','Overseas',10,'city','AU-TAS',true),
('AU-ACT-CBR','坎培拉',   'Canberra',    'OVERSEAS','海外','Overseas',10,'city','AU-ACT',true),
('AU-NT-DRW', '達爾文',   'Darwin',      'OVERSEAS','海外','Overseas',10,'city','AU-NT', true)
ON CONFLICT (code) DO UPDATE SET area_type='city', parent_code=EXCLUDED.parent_code, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en;

-- =============================================
-- ⑧ 驗證結果
-- =============================================
SELECT area_type, count(*) as cnt
FROM public.service_areas
GROUP BY area_type
ORDER BY area_type;

SELECT code, name_zh, area_type, parent_code
FROM public.service_areas
WHERE parent_code IS NULL
ORDER BY sort_order, code;
