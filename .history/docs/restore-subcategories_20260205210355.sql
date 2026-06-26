-- ========================================
-- 從預設配置恢復所有主分類的子分類資料
-- ========================================

-- 恢復 event (活動)
UPDATE ai_categories 
SET subcategories = '["婚禮籌備","場地 餐飲","設備租賃","活動協助","攝影服務","娛樂表演"]'::jsonb
WHERE key = 'event';

-- 恢復 learn (學習)
UPDATE ai_categories 
SET subcategories = '["鋼琴 鍵盤樂器","國樂課程","設計課程","個人成長","理工 商管課程","證照課程","弦樂課程","歌唱 樂理","才藝課程","各科家教","電腦課程","行銷課程","管樂 打擊樂課程","繪畫課程","舞蹈課程","語言課程","美容相關課程","其他課程"]'::jsonb
WHERE key = 'learn';

-- 恢復 health (運動)
UPDATE ai_categories 
SET subcategories = '["健身雕塑","武術運動","健康諮詢","球類運動","瑜珈 皮拉提斯","有氧運動","游泳潛水"]'::jsonb
WHERE key = 'health';

-- 恢復 home (居家)
UPDATE ai_categories 
SET subcategories = '["清潔服務","家電 燈具","廚房","門片 拉門","木工 油漆 壁紙","泥作 圍藝","家事服務","搬家 回收","抓漏防水","櫥櫃 家具","消毒除蟲","地板 地毯 磁磚","鐵作 採光罩","寵物","水電工程","衛浴","窗戶 窗簾","室內設計與裝潢","其他裝修工程","保全防盜"]'::jsonb
WHERE key = 'home';

-- 恢復 beauty (美業)
UPDATE ai_categories 
SET subcategories = '["美容美髮","彩妝造型","美甲美睫","紋繡霧眉","美體SPA","醫美諮詢","新娘秘書","美容保養品","男士理容"]'::jsonb
WHERE key = 'beauty';

-- 恢復 business (商業)
UPDATE ai_categories 
SET subcategories = '["行銷服務","印刷 招牌","網頁 程式","嵌入式開發","資料輸入 校稿","紙紮諮詢","人力支援","拍照攝影","平面設計","IT相關服務","商業空間設計","音樂製作","企業補助顧問","影片製作","多媒體設計","工業設計","翻譯服務","職涯成長","公司業務支援"]'::jsonb
WHERE key = 'business';

-- 恢復 other (其他)
UPDATE ai_categories 
SET subcategories = '["3C維修","汽車 機車","代辦服務","交通運輸","服飾配件","樂器維修","手工製作"]'::jsonb
WHERE key = 'other';

-- 驗證結果
SELECT 
    key,
    name,
    jsonb_array_length(subcategories) as "子分類數",
    subcategories
FROM ai_categories
WHERE parent_key IS NULL
ORDER BY name;
