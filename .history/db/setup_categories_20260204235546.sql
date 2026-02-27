-- 一鍵建表與匯入預設分類（完整版）
-- 複製以下內容到 Supabase SQL Editor 執行

-- 1. 建立表
create table if not exists public.ai_categories (
  key text primary key,
  name text not null,
  prompt text not null default '',
  subcategories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. 匯入預設分類
insert into public.ai_categories(key, name, prompt, subcategories) values
('home', '居家', '你是居家裝修與維修估算師。依據所選子分類，列出可能需要的施工或服務項目，輸出為 JSON 陣列（item_name/spec/quantity/unit），單位使用坪/才/式/公尺。', '["清潔服務","家電 燈具","廚房","門片 拉門","木工 油漆 壁紙","泥作 圍藝","家事服務","搬家 回收","抓漏防水","櫥櫃 家具","消毒除蟲","地板 地毯 磁磚","鐵作 採光罩","寵物","水電工程","衛浴","窗戶 窗簾","室內設計與裝潢","其他裝修工程","保全防盜"]'::jsonb),
('event', '活動', '你是活動企劃與執行顧問。依據所選子分類，列出所需的人力、物資或服務項目，輸出為 JSON 陣列（item_name/spec/quantity/unit）。', '["婚禮籌備","場地 餐飲","設備租賃","活動協助","攝影服務","娛樂表演"]'::jsonb),
('learn', '學習', '你是教學課程規劃顧問。依據所選子分類，列出課程或教學所需的準備項目或服務，輸出為 JSON 陣列（item_name/spec/quantity/unit）。', '["鋼琴 鍵盤樂器","國樂課程","設計課程","個人成長","理工 商管課程","證照課程","弦樂課程","歌唱 樂理","才藝課程","各科家教","電腦課程","行銷課程","管樂 打擊樂課程","繪畫課程","舞蹈課程","語言課程","美容相關課程","其他課程"]'::jsonb),
('health', '健康', '你是健康與運動教練顧問。依據所選子分類，列出相關服務或器材需求項目，輸出為 JSON 陣列（item_name/spec/quantity/unit）。', '["健身雕塑","武術運動","健康諮詢","美容美髮","運動"]'::jsonb),
('business', '商業', '你是企業服務與設計顧問。依據所選子分類，列出專案所需的人力與交付項目，輸出為 JSON 陣列（item_name/spec/quantity/unit）。', '["行銷服務","印刷 招牌","網頁 程式","嵌入式開發","資料輸入 校稿","紙紮諮詢","人力支援","拍照攝影","平面設計","IT相關服務","商業空間設計","音樂製作","企業補助顧問","影片製作","多媒體設計","工業設計","翻譯服務","職涯成長","公司業務支援"]'::jsonb),
('other', '其他', '你是通用服務顧問。依據所選子分類，列出可能的服務或維修項目，輸出為 JSON 陣列（item_name/spec/quantity/unit）。', '["3C維修","汽車 機車","代辦服務","交通運輸","服飾配件","樂器維修","手工製作"]'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  prompt = excluded.prompt,
  subcategories = excluded.subcategories,
  updated_at = now();

-- 3. 刷新快取
alter table public.ai_categories alter column prompt set default '';

-- 4. 驗證
select key, name, jsonb_array_length(subcategories) as sub_count from public.ai_categories order by key;
