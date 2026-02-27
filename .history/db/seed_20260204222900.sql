-- 初始基礎單價資料
INSERT INTO price_library (item_name, unit, unit_price, currency, region, tags)
VALUES
  ('超耐磨地板', '坪', 2500, 'TWD', '台灣', ARRAY['室內','裝修','地板']),
  ('油漆', '坪', 1800, 'TWD', '台灣', ARRAY['室內','裝修','塗裝']),
  ('系統櫃', '式', 12000, 'TWD', '台灣', ARRAY['室內','裝修','木作']),
  ('玻璃隔間', '才', 3500, 'TWD', '台灣', ARRAY['室內','隔間','玻璃']),
  ('燈具安裝', '式', 800, 'TWD', '台灣', ARRAY['室內','電力','燈具']),
  ('地板基礎整平', '坪', 900, 'TWD', '台灣', ARRAY['室內','地板','基礎']);

-- 初始 AI 分類（可後續在後台調整）
INSERT INTO ai_categories (key, name, prompt, subcategories)
VALUES
  (
    'space',
    '空間施作',
    '你是一個專業的空間工程估算師。請分析這張設計圖，列出所有需要的細項工程（如地板、系統櫃、油漆等），並嚴格輸出為 JSON 陣列，每個元素包含: item_name, spec, quantity, unit。',
    '["地板","系統櫃","木作","油漆","玻璃","燈具","鐵件","水電","窗簾","磁磚"]'::jsonb
  ),
  (
    'sign',
    '廣告牌設計',
    '你是一個專業的廣告牌設計估價師。請分析這張設計圖，列出所有需要的工程項目（如結構、燈箱、噴繪、安裝等），並嚴格輸出為 JSON 陣列，每個元素包含: item_name, spec, quantity, unit。',
    '["結構","燈箱","噴繪","安裝","電力","鋁料","壓克力"]'::jsonb
  ),
  (
    'model',
    '建模製作',
    '你是一個專業的3D建模估價師。請分析這張設計圖，列出所有需要的建模項目（如建築、家具、場景等），並嚴格輸出為 JSON 陣列，每個元素包含: item_name, spec, quantity, unit。',
    '["建築","家具","場景","人物","燈光","貼圖"]'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
