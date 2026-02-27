-- ============================================
-- 更新居家子分類的 form_config 欄位
-- 請在 Supabase Dashboard → SQL Editor 中執行此腳本
-- ============================================

-- 1. 清潔服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"清潔坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"clean_type","label":"清潔類型","type":"select","required":true,"options":["日常清潔","空屋細清","裝潢後粗清","辦公室清潔"]},
  {"name":"floor_elevator","label":"樓層與電梯","type":"text","required":true,"placeholder":"例：5樓，無電梯"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__清潔服務';

-- 2. 家電 燈具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"appliance_type","label":"設備類型","type":"text","required":true,"placeholder":"例：冷氣、冰箱、燈具"},
  {"name":"quantity","label":"數量","type":"number","unit":"個","required":true,"placeholder":"請輸入數量"},
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["安裝","維修","更換","移機"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__家電_燈具';

-- 3. 廚房
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"kitchen_length","label":"廚房長度","type":"number","unit":"尺","required":true,"placeholder":"例：8尺、10尺"},
  {"name":"kitchen_type","label":"廚具類型","type":"select","required":true,"options":["系統廚具","訂製廚具","更換檯面","更換門片","全套更新"]},
  {"name":"has_appliances","label":"是否含電器","type":"select","required":true,"options":["含電器","不含電器","部分含電器"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__廚房';

-- 4. 門片 拉門
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"quantity","label":"門片數量","type":"number","unit":"片","required":true,"placeholder":"請輸入數量"},
  {"name":"door_type","label":"門片類型","type":"select","required":true,"options":["房門","廚房門","浴室門","拉門","摺疊門","隱藏門"]},
  {"name":"size","label":"尺寸","type":"text","required":true,"placeholder":"例：寬90cm×高210cm"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__門片_拉門';

-- 5. 木工 油漆 壁紙
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施工坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["木工裝潢","油漆粉刷","壁紙施工","木工+油漆","綜合裝修"]},
  {"name":"scope","label":"施工範圍","type":"text","required":true,"placeholder":"例：全室、客廳、主臥"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__木工_油漆_壁紙';

-- 6. 泥作 圍藝
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_item","label":"工程項目","type":"text","required":true,"placeholder":"例：砌磚牆、粉刷、圍牆修復"},
  {"name":"area","label":"施工坪數/長度","type":"text","required":true,"placeholder":"例：5坪 或 10米"},
  {"name":"work_location","label":"施工位置","type":"select","required":true,"options":["室內","室外","前院","後院","陽台","頂樓"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__泥作_圍藝';

-- 7. 家事服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["鐘點管家","煮飯服務","照護服務","綜合家事"]},
  {"name":"frequency","label":"服務頻率","type":"select","required":true,"options":["單次","每週一次","每週兩次","每週三次以上","每月一次"]},
  {"name":"hours","label":"每次時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__家事服務';

-- 8. 搬家 回收
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"items","label":"物品內容","type":"text","required":true,"placeholder":"例：3房2廳家具、約50箱雜物"},
  {"name":"from_floor","label":"起點樓層","type":"text","required":true,"placeholder":"例：5樓無電梯"},
  {"name":"to_floor","label":"終點樓層","type":"text","required":true,"placeholder":"例：2樓有電梯"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__搬家_回收';

-- 9. 抓漏防水
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"leak_location","label":"漏水位置","type":"text","required":true,"placeholder":"例：浴室天花板、外牆窗邊"},
  {"name":"severity","label":"漏水程度","type":"select","required":true,"options":["輕微滲水","明顯漏水","嚴重滲漏"]},
  {"name":"house_type","label":"房屋類型","type":"select","required":true,"options":["公寓","透天厝","大樓","別墅"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__抓漏防水';

-- 10. 櫥櫃 家具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"furniture_type","label":"家具類型","type":"text","required":true,"placeholder":"例：系統櫃、書櫃、衣櫃"},
  {"name":"quantity","label":"數量","type":"number","unit":"組","required":true,"placeholder":"請輸入數量"},
  {"name":"size","label":"尺寸需求","type":"text","required":true,"placeholder":"例：寬200cm×高240cm"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__櫥櫃_家具';

-- 11. 消毒除蟲
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"pest_type","label":"蟲害類型","type":"select","required":true,"options":["蟑螂","老鼠","白蟻","跳蚤","蚊蟲","其他"]},
  {"name":"severity","label":"嚴重程度","type":"select","required":true,"options":["輕微偶見","中等常見","嚴重氾濫"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__消毒除蟲';

-- 12. 地板 地毯 磁磚
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施工坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"material","label":"材質類型","type":"select","required":true,"options":["超耐磨地板","實木地板","磁磚","地毯","SPC地板","石塑地板"]},
  {"name":"remove_old","label":"是否拆除舊地板","type":"select","required":true,"options":["需要拆除","不需拆除","部分拆除"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__地板_地毯_磁磚';

-- 13. 鐵作 採光罩
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"施工類型","type":"text","required":true,"placeholder":"例：鐵窗、採光罩、樓梯扶手、防盜窗"},
  {"name":"area","label":"施工面積","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"install_location","label":"安裝位置","type":"select","required":true,"options":["陽台","頂樓","前院","後院","室內","樓梯間"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__鐵作_採光罩';

-- 14. 寵物
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"pet_type","label":"寵物類型","type":"select","required":true,"options":["狗","貓","兔子","鳥類","爬蟲","其他"]},
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["美容洗澡","訓練課程","寄養照顧","醫療諮詢","用品購買"]},
  {"name":"pet_count","label":"寵物數量","type":"number","unit":"隻","required":true,"placeholder":"請輸入數量"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__寵物';

-- 15. 水電工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["水電維修","管路更新","配電工程","衛浴安裝","綜合工程"]},
  {"name":"work_location","label":"施作位置","type":"text","required":true,"placeholder":"例：廚房、浴室、客廳"},
  {"name":"urgency","label":"緊急程度","type":"select","required":true,"options":["一般（可預約）","緊急（3天內）","非常緊急（當天）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__水電工程';

-- 16. 衛浴
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_item","label":"施工項目","type":"select","required":true,"options":["馬桶","浴缸","淋浴間","洗手台","全套更新"]},
  {"name":"bathroom_count","label":"衛浴數量","type":"number","unit":"間","required":true,"placeholder":"請輸入數量"},
  {"name":"is_renovation","label":"是否拆除重做","type":"select","required":true,"options":["是","否","部分"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__衛浴';

-- 17. 窗戶 窗簾
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"window_count","label":"窗戶數量","type":"number","unit":"扇","required":true,"placeholder":"請輸入數量"},
  {"name":"window_type","label":"窗型","type":"select","required":true,"options":["落地窗","橫拉窗","推開窗","氣密窗","天窗"]},
  {"name":"curtain_need","label":"窗簾需求","type":"select","required":true,"options":["布簾","百葉簾","捲簾","調光簾","不需要"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__窗戶_窗簾';

-- 18. 室內設計與裝潢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"house_area","label":"房屋坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"layout","label":"格局","type":"text","required":true,"placeholder":"例：3房2廳2衛"},
  {"name":"style","label":"設計風格","type":"select","required":true,"options":["現代簡約","北歐風","工業風","日式無印","古典奢華","不限風格"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__室內設計與裝潢';

-- 19. 其他裝修工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_item","label":"工程項目","type":"text","required":true,"placeholder":"請說明需要的工程項目"},
  {"name":"scope","label":"施工範圍","type":"text","required":true,"placeholder":"例：全室、客廳、特定區域"},
  {"name":"has_design","label":"是否需要設計","type":"select","required":true,"options":["需要設計","不需設計","已有設計"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__其他裝修工程';

-- 20. 保全防盜
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"equipment_type","label":"設備類型","type":"select","required":true,"options":["監視器","防盜門窗","保全系統","智能門鎖","感應器"]},
  {"name":"quantity","label":"安裝數量","type":"number","unit":"組","required":true,"placeholder":"請輸入數量"},
  {"name":"monitor_range","label":"監控範圍","type":"text","required":true,"placeholder":"例：大門、後院、車庫、室內"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'home__保全防盜';

-- ============================================
-- 活動分類
-- ============================================

-- 21. 婚禮籌備
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"guest_count","label":"賓客人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"wedding_date","label":"婚宴日期","type":"date","required":true,"placeholder":"請選擇日期"},
  {"name":"venue_type","label":"場地類型","type":"select","required":true,"options":["飯店宴會廳","婚宴會館","戶外婚禮","餐廳包場","自家或親友場地"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__婚禮籌備';

-- 22. 場地 餐飲
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"guest_count","label":"活動人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"event_date","label":"活動日期","type":"date","required":true,"placeholder":"請選擇日期"},
  {"name":"venue_type","label":"場地類型","type":"select","required":true,"options":["室內場地","戶外場地","餐廳","會議室","其他"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__場地_餐飲';

-- 23. 設備租賃
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"equipment_type","label":"設備類型","type":"text","required":true,"placeholder":"例：音響、投影機、桌椅、舞台"},
  {"name":"rental_days","label":"租借天數","type":"number","unit":"天","required":true,"placeholder":"請輸入天數"},
  {"name":"event_scale","label":"活動規模","type":"select","required":true,"options":["小型（50人以下）","中型（50-200人）","大型（200-500人）","超大型（500人以上）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__設備租賃';

-- 24. 活動協助
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"event_type","label":"活動類型","type":"text","required":true,"placeholder":"例：尾牙、記者會、展覽、派對"},
  {"name":"guest_count","label":"活動人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"service_items","label":"需要服務","type":"text","required":true,"placeholder":"例：主持人、接待人員、場控"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__活動協助';

-- 25. 攝影服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["婚禮攝影","活動紀錄","商業攝影","人像寫真","產品攝影"]},
  {"name":"shooting_hours","label":"拍攝時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"},
  {"name":"deliverables","label":"成品規格","type":"select","required":true,"options":["僅修圖照片","照片+精華影片","全程錄影","照片+婚禮MV","客製化"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__攝影服務';

-- 26. 娛樂表演
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"performance_type","label":"表演類型","type":"text","required":true,"placeholder":"例：樂團、魔術、舞蹈、樂器演奏"},
  {"name":"performance_duration","label":"表演時長","type":"number","unit":"分鐘","required":true,"placeholder":"請輸入分鐘數"},
  {"name":"guest_count","label":"觀眾人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'event__娛樂表演';

-- ============================================
-- 學習分類
-- ============================================

-- 27. 鋼琴 鍵盤樂器
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級","進階演奏"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","隔週1次","不定期"]},
  {"name":"lesson_duration","label":"每次時數","type":"number","unit":"分鐘","required":true,"placeholder":"例：60"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__鋼琴_鍵盤樂器';

-- 28. 國樂課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"instrument_type","label":"樂器類型","type":"text","required":true,"placeholder":"例：二胡、琵琶、古箏、笛子"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","隔週1次"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__國樂課程';

-- 29. 設計課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"design_type","label":"設計類型","type":"select","required":true,"options":["平面設計","UI/UX設計","室內設計","服裝設計","產品設計","其他"]},
  {"name":"software_focus","label":"主要軟體","type":"text","required":true,"placeholder":"例：Photoshop、Illustrator、Figma"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","有基礎","進階","專業提升"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__設計課程';

-- 30. 個人成長
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"course_topic","label":"課程主題","type":"text","required":true,"placeholder":"例：時間管理、溝通技巧、情緒管理"},
  {"name":"learning_format","label":"學習形式","type":"select","required":true,"options":["一對一教練","小班制（3-8人）","大班講座","線上課程"]},
  {"name":"total_hours","label":"總時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__個人成長';

-- 31. 理工 商管課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"subject","label":"科目領域","type":"text","required":true,"placeholder":"例：數學、物理、經濟、統計"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["國中","高中","大學","研究所","社會人士"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","密集班"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__理工_商管課程';

-- 32. 證照課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"certificate_type","label":"證照類型","type":"text","required":true,"placeholder":"例：多益、雅思、CPA、PMP、證券"},
  {"name":"target_score","label":"目標分數/級別","type":"text","required":true,"placeholder":"例：多益800分、中級會計師"},
  {"name":"course_duration","label":"課程期間","type":"select","required":true,"options":["1個月內","2-3個月","3-6個月","6個月以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__證照課程';

-- 33. 弦樂課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"instrument_type","label":"樂器類型","type":"select","required":true,"options":["小提琴","中提琴","大提琴","低音提琴","吉他","烏克麗麗"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","隔週1次"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__弦樂課程';

-- 34. 歌唱 樂理
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"course_type","label":"課程類型","type":"select","required":true,"options":["流行歌唱","古典聲樂","樂理","視唱聽寫","綜合"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"lesson_duration","label":"每次時數","type":"number","unit":"分鐘","required":true,"placeholder":"例：60"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__歌唱_樂理';

-- 35. 才藝課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"talent_type","label":"才藝類型","type":"text","required":true,"placeholder":"例：魔術、書法、圍棋、珠心算"},
  {"name":"student_age","label":"學員年齡","type":"select","required":true,"options":["幼兒（3-6歲）","兒童（7-12歲）","青少年（13-18歲）","成人"]},
  {"name":"class_size","label":"上課人數","type":"select","required":true,"options":["一對一","小班制（2-6人）","團體班（7人以上）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__才藝課程';

-- 36. 各科家教
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"subject","label":"科目","type":"text","required":true,"placeholder":"例：數學、英文、物理、化學"},
  {"name":"student_grade","label":"學生年級","type":"select","required":true,"options":["國小","國中","高中","大學","成人"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","考前密集"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__各科家教';

-- 37. 電腦課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"course_topic","label":"課程主題","type":"text","required":true,"placeholder":"例：Python、網頁設計、Excel、AI應用"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","有基礎","進階","專業提升"]},
  {"name":"learning_format","label":"學習形式","type":"select","required":true,"options":["實體上課","線上課程","混合模式"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__電腦課程';

-- 38. 行銷課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"marketing_field","label":"行銷領域","type":"select","required":true,"options":["數位行銷","社群行銷","廣告投放","SEO/SEM","內容行銷","品牌策略"]},
  {"name":"course_format","label":"課程形式","type":"select","required":true,"options":["工作坊","系列課程","一對一諮詢","企業內訓"]},
  {"name":"total_hours","label":"總時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__行銷課程';

-- 39. 管樂 打擊樂課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"instrument_type","label":"樂器類型","type":"text","required":true,"placeholder":"例：長笛、薩克斯風、小號、爵士鼓"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","隔週1次"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__管樂_打擊樂課程';

-- 40. 繪畫課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"painting_type","label":"繪畫類型","type":"select","required":true,"options":["素描","水彩","油畫","水墨","插畫","漫畫","數位繪畫"]},
  {"name":"student_age","label":"學員年齡","type":"select","required":true,"options":["兒童（3-12歲）","青少年（13-18歲）","成人"]},
  {"name":"class_format","label":"上課形式","type":"select","required":true,"options":["一對一","小班制（3-8人）","大班"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__繪畫課程';

-- 41. 舞蹈課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"dance_type","label":"舞蹈類型","type":"select","required":true,"options":["街舞","芭蕾","國標舞","肚皮舞","民族舞","現代舞","爵士舞"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"class_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__舞蹈課程';

-- 42. 語言課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"language","label":"語言類型","type":"select","required":true,"options":["英文","日文","韓文","西班牙文","法文","德文","其他"]},
  {"name":"learning_goal","label":"學習目標","type":"select","required":true,"options":["日常會話","商務應用","考試準備","旅遊","興趣"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","密集班"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__語言課程';

-- 43. 美容相關課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"beauty_field","label":"美容領域","type":"select","required":true,"options":["美甲","美睫","彩妝","美髮","紋繡","皮膚管理"]},
  {"name":"course_goal","label":"課程目標","type":"select","required":true,"options":["興趣學習","考取證照","創業培訓","技能提升"]},
  {"name":"course_hours","label":"課程時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__美容相關課程';

-- 44. 其他課程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"course_topic","label":"課程主題","type":"text","required":true,"placeholder":"請說明課程內容"},
  {"name":"student_count","label":"學員人數","type":"number","unit":"人","required":true,"placeholder":"請輸入人數"},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上","不定期"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'learn__其他課程';

-- ============================================
-- 運動分類
-- ============================================

-- 45. 健身雕塑
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"fitness_goal","label":"健身目標","type":"select","required":true,"options":["減脂","增肌","體態雕塑","體能提升","維持健康"]},
  {"name":"training_frequency","label":"訓練頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次","每週4次以上"]},
  {"name":"class_type","label":"課程類型","type":"select","required":true,"options":["一對一","小團體（2-4人）","團體課（5人以上）","線上課程"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__健身雕塑';

-- 46. 武術運動
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"martial_art_type","label":"武術類型","type":"text","required":true,"placeholder":"例：跆拳道、空手道、柔道、拳擊、泰拳"},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級","競賽級"]},
  {"name":"training_frequency","label":"訓練頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__武術運動';

-- 47. 健康諮詢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"consultation_type","label":"諮詢類型","type":"select","required":true,"options":["營養諮詢","運動處方","體態評估","減重計畫","運動傷害","綜合評估"]},
  {"name":"health_concern","label":"健康狀況","type":"text","required":true,"placeholder":"例：膝蓋疼痛、減重需求、體能不佳"},
  {"name":"consultation_format","label":"諮詢形式","type":"select","required":true,"options":["一對一面談","線上諮詢","健康檢測","長期追蹤"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__健康諮詢';

-- 48. 球類運動
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"sport_type","label":"球類運動","type":"select","required":true,"options":["籃球","足球","羽球","桌球","網球","排球","棒球","高爾夫","其他"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級","競賽級"]},
  {"name":"training_frequency","label":"訓練頻率","type":"select","required":true,"options":["每週1次","每週2次","每週3次以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__球類運動';

-- 49. 瑜珈 皮拉提斯
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"class_type","label":"課程類型","type":"select","required":true,"options":["哈達瑜珈","阿斯坦加","熱瑜珈","空中瑜珈","皮拉提斯","孕婦瑜珈"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級"]},
  {"name":"class_format","label":"上課形式","type":"select","required":true,"options":["一對一","小班制（3-8人）","大班","線上課程"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__瑜珈_皮拉提斯';

-- 50. 有氧運動
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"cardio_type","label":"有氧類型","type":"select","required":true,"options":["跑步","飛輪","有氧舞蹈","階梯有氧","拳擊有氧","HIIT"]},
  {"name":"intensity_level","label":"強度等級","type":"select","required":true,"options":["低強度","中強度","高強度","混合強度"]},
  {"name":"training_frequency","label":"訓練頻率","type":"select","required":true,"options":["每週1-2次","每週3-4次","每週5次以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__有氧運動';

-- 51. 游泳潛水
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"swimming_type","label":"項目類型","type":"select","required":true,"options":["游泳教學","自由潛水","水肺潛水","浮潛","救生訓練"]},
  {"name":"student_level","label":"學員程度","type":"select","required":true,"options":["完全初學","初級","中級","高級","證照考取"]},
  {"name":"lesson_frequency","label":"上課頻率","type":"select","required":true,"options":["每週1次","每週2次","密集班","不定期"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'health__游泳潛水';

-- ============================================
-- 美業分類
-- ============================================

-- 52. 美容美髮
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["剪髮","染髮","燙髮","護髮","造型","洗髮","燙染套餐"]},
  {"name":"hair_length","label":"髮長","type":"select","required":true,"options":["短髮","中長髮","長髮","超長髮"]},
  {"name":"gender","label":"性別","type":"select","required":true,"options":["男性","女性"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__美容美髮';

-- 53. 彩妝造型
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"occasion","label":"場合","type":"select","required":true,"options":["日常妝容","宴會妝","新娘妝","舞台妝","特殊造型"]},
  {"name":"service_duration","label":"服務時長","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"},
  {"name":"location","label":"服務地點","type":"select","required":true,"options":["到店服務","到府服務"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__彩妝造型';

-- 54. 美甲美睫
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["手部美甲","足部美甲","睫毛嫁接","睫毛燙","卸除","保養"]},
  {"name":"design_complexity","label":"設計複雜度","type":"select","required":true,"options":["單色","漸層","法式","彩繪","光療凝膠","特殊款式"]},
  {"name":"service_duration","label":"預估時長","type":"number","unit":"小時","required":true,"placeholder":"例：2"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__美甲美睫';

-- 55. 紋繡霧眉
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"tattoo_type","label":"紋繡類型","type":"select","required":true,"options":["霧眉","飄眉","繡眉","紋眼線","紋唇","洗眉"]},
  {"name":"is_first_time","label":"是否首次","type":"select","required":true,"options":["首次","補色","修改"]},
  {"name":"special_needs","label":"特殊需求","type":"text","required":true,"placeholder":"例：眉型設計、顏色偏好"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__紋繡霧眉';

-- 56. 美體SPA
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"spa_type","label":"療程類型","type":"select","required":true,"options":["全身按摩","局部按摩","精油SPA","淋巴排毒","去角質","身體保養"]},
  {"name":"session_duration","label":"療程時長","type":"number","unit":"分鐘","required":true,"placeholder":"例：90"},
  {"name":"treatment_area","label":"部位","type":"text","required":true,"placeholder":"例：全身、背部、腿部"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__美體SPA';

-- 57. 醫美諮詢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"treatment_type","label":"療程類型","type":"text","required":true,"placeholder":"例：雷射、音波拉提、肉毒、玻尿酸"},
  {"name":"concern_area","label":"改善部位","type":"text","required":true,"placeholder":"例：臉部、眼周、斑點、痘疤"},
  {"name":"consultation_type","label":"諮詢形式","type":"select","required":true,"options":["面對面諮詢","線上諮詢","預約療程"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__醫美諮詢';

-- 58. 新娘秘書
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_date","label":"婚禮日期","type":"text","required":true,"placeholder":"例：2024/12/25"},
  {"name":"service_items","label":"服務項目","type":"select","required":true,"options":["新娘妝髮","伴娘妝髮","媽媽妝","全天跟妝","宴客造型"]},
  {"name":"location_count","label":"服務地點數","type":"number","unit":"個","required":true,"placeholder":"例：2（迎娶+宴客）"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__新娘秘書';

-- 59. 美容保養品
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"product_type","label":"產品類型","type":"select","required":true,"options":["臉部保養","身體保養","彩妝品","髮品","香氛","工具"]},
  {"name":"skin_concern","label":"肌膚需求","type":"text","required":true,"placeholder":"例：保濕、抗老、美白、控油"},
  {"name":"budget","label":"預算","type":"text","required":true,"placeholder":"例：1000-3000元"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__美容保養品';

-- 60. 男士理容
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["剪髮","染髮","燙髮","修鬍","臉部保養","頭皮護理"]},
  {"name":"hair_style","label":"髮型需求","type":"text","required":true,"placeholder":"例：寸頭、油頭、韓系、商務"},
  {"name":"service_duration","label":"預估時長","type":"number","unit":"分鐘","required":true,"placeholder":"例：60"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'beauty__男士理容';

-- ============================================
-- 商業分類
-- ============================================

-- 61. 行銷服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"marketing_type","label":"行銷類型","type":"select","required":true,"options":["社群行銷","廣告投放","SEO優化","內容行銷","品牌策劃","KOL合作"]},
  {"name":"project_duration","label":"專案期間","type":"select","required":true,"options":["單次專案","1個月","3個月","6個月","長期合作"]},
  {"name":"target_platform","label":"目標平台","type":"text","required":true,"placeholder":"例：FB、IG、Google、LINE"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__行銷服務';

-- 62. 印刷 招牌
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"print_type","label":"製作類型","type":"select","required":true,"options":["名片","DM傳單","海報","帆布","招牌","貼紙","大圖輸出"]},
  {"name":"quantity","label":"數量","type":"number","unit":"張/個","required":true,"placeholder":"請輸入數量"},
  {"name":"size","label":"尺寸","type":"text","required":true,"placeholder":"例：A4、90x60cm"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__印刷_招牌';

-- 63. 網頁 程式
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"project_type","label":"專案類型","type":"select","required":true,"options":["形象網站","電商網站","客製化系統","APP開發","維護更新"]},
  {"name":"page_count","label":"頁面數量","type":"number","unit":"頁","required":true,"placeholder":"例：5"},
  {"name":"special_features","label":"特殊功能","type":"text","required":true,"placeholder":"例：會員系統、金流、後台管理"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__網頁_程式';

-- 64. 嵌入式開發
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"hardware_type","label":"硬體類型","type":"text","required":true,"placeholder":"例：Arduino、Raspberry Pi、STM32"},
  {"name":"project_scope","label":"專案範圍","type":"text","required":true,"placeholder":"例：感測器整合、馬達控制、物聯網"},
  {"name":"development_time","label":"開發時程","type":"select","required":true,"options":["1週內","2-4週","1-3個月","3個月以上"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__嵌入式開發';

-- 65. 資料輸入 校稿
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工作類型","type":"select","required":true,"options":["資料輸入","文件校稿","翻譯校對","表格整理","文字轉檔"]},
  {"name":"word_count","label":"字數/數量","type":"number","unit":"字/筆","required":true,"placeholder":"請輸入數量"},
  {"name":"deadline","label":"交件期限","type":"select","required":true,"options":["3天內","1週內","2週內","1個月內"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__資料輸入_校稿';

-- 66. 紙紮諮詢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"item_type","label":"商品類型","type":"text","required":true,"placeholder":"例：房屋、車輛、日用品、金銀財寶"},
  {"name":"quantity","label":"數量","type":"number","unit":"件","required":true,"placeholder":"請輸入數量"},
  {"name":"custom_needs","label":"客製需求","type":"text","required":true,"placeholder":"例：特定款式、尺寸、配件"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__紙紮諮詢';

-- 67. 人力支援
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"job_type","label":"職位類型","type":"text","required":true,"placeholder":"例：工讀生、臨時工、專案人員"},
  {"name":"people_count","label":"人數","type":"number","unit":"人","required":true,"placeholder":"請輸入人數"},
  {"name":"work_duration","label":"工作期間","type":"select","required":true,"options":["單日","1週","1個月","3個月","長期"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__人力支援';

-- 68. 拍照攝影
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"photo_type","label":"拍攝類型","type":"select","required":true,"options":["商品攝影","人像寫真","活動紀錄","空間拍攝","美食攝影"]},
  {"name":"shooting_hours","label":"拍攝時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"},
  {"name":"photo_count","label":"成品張數","type":"number","unit":"張","required":true,"placeholder":"例：30"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__拍照攝影';

-- 69. 平面設計
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"design_type","label":"設計類型","type":"select","required":true,"options":["LOGO設計","名片","海報","DM","包裝設計","型錄","插畫"]},
  {"name":"design_count","label":"設計款數","type":"number","unit":"款","required":true,"placeholder":"例：3"},
  {"name":"revision_count","label":"修改次數","type":"select","required":true,"options":["1次","2次","3次","不限次數"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__平面設計';

-- 70. IT相關服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["電腦維修","網路架設","系統安裝","資料救援","設備採購諮詢"]},
  {"name":"device_count","label":"設備數量","type":"number","unit":"台","required":true,"placeholder":"請輸入數量"},
  {"name":"urgency","label":"緊急程度","type":"select","required":true,"options":["一般","緊急（3天內）","非常緊急（當天）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__IT相關服務';

-- 71. 商業空間設計
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"space_type","label":"空間類型","type":"select","required":true,"options":["餐廳","咖啡廳","辦公室","店面","展場","飯店"]},
  {"name":"space_area","label":"空間坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"design_stage","label":"設計階段","type":"select","required":true,"options":["概念設計","3D圖","施工圖","全案設計"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__商業空間設計';

-- 72. 音樂製作
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"music_type","label":"製作類型","type":"select","required":true,"options":["原創編曲","配樂製作","混音","母帶後製","錄音","音效設計"]},
  {"name":"song_duration","label":"歌曲長度","type":"number","unit":"分鐘","required":true,"placeholder":"例：3"},
  {"name":"delivery_format","label":"交付格式","type":"select","required":true,"options":["MP3","WAV","分軌","完整專案檔"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__音樂製作';

-- 73. 企業補助顧問
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"subsidy_type","label":"補助類型","type":"text","required":true,"placeholder":"例：SBIR、研發補助、創業補助"},
  {"name":"company_stage","label":"公司階段","type":"select","required":true,"options":["尚未成立","新創（1年內）","成長期","穩定期"]},
  {"name":"service_scope","label":"服務範圍","type":"select","required":true,"options":["諮詢評估","計畫撰寫","全案代辦"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__企業補助顧問';

-- 74. 影片製作
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"video_type","label":"影片類型","type":"select","required":true,"options":["形象影片","產品介紹","活動紀錄","教學影片","廣告影片","動畫"]},
  {"name":"video_duration","label":"影片長度","type":"number","unit":"分鐘","required":true,"placeholder":"例：3"},
  {"name":"shooting_days","label":"拍攝天數","type":"number","unit":"天","required":true,"placeholder":"例：2"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__影片製作';

-- 75. 多媒體設計
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"media_type","label":"媒體類型","type":"select","required":true,"options":["動畫","Motion Graphics","互動設計","AR/VR","遊戲美術"]},
  {"name":"project_duration","label":"專案時長","type":"number","unit":"秒/分","required":true,"placeholder":"例：30秒"},
  {"name":"complexity","label":"複雜度","type":"select","required":true,"options":["簡單","中等","複雜","高度客製"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__多媒體設計';

-- 76. 工業設計
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"design_item","label":"設計品項","type":"text","required":true,"placeholder":"例：產品外觀、包裝、模具設計"},
  {"name":"design_stage","label":"設計階段","type":"select","required":true,"options":["概念草圖","3D建模","工程圖","打樣製作","量產"]},
  {"name":"quantity","label":"數量","type":"number","unit":"款","required":true,"placeholder":"請輸入數量"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__工業設計';

-- 77. 翻譯服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"language_pair","label":"語言組合","type":"text","required":true,"placeholder":"例：中翻英、英翻日"},
  {"name":"word_count","label":"字數","type":"number","unit":"字","required":true,"placeholder":"請輸入字數"},
  {"name":"document_type","label":"文件類型","type":"select","required":true,"options":["一般文件","技術文件","法律合約","學術論文","網站內容"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__翻譯服務';

-- 78. 職涯成長
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["履歷健檢","面試coaching","職涯諮詢","轉職規劃","技能培訓"]},
  {"name":"session_count","label":"諮詢次數","type":"number","unit":"次","required":true,"placeholder":"例：3"},
  {"name":"format","label":"進行方式","type":"select","required":true,"options":["一對一","小組","線上","實體"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__職涯成長';

-- 79. 公司業務支援
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"support_type","label":"支援類型","type":"select","required":true,"options":["行政支援","財會處理","法律諮詢","人資服務","採購代辦"]},
  {"name":"service_period","label":"服務期間","type":"select","required":true,"options":["單次","1個月","3個月","半年","長期"]},
  {"name":"work_hours","label":"工作時數","type":"number","unit":"小時/月","required":true,"placeholder":"例：20"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'business__公司業務支援';

-- ============================================
-- 其他分類
-- ============================================

-- 80. 3C維修
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"device_type","label":"裝置類型","type":"select","required":true,"options":["手機","平板","電腦","筆電","相機","其他3C"]},
  {"name":"issue","label":"問題描述","type":"text","required":true,"placeholder":"例：螢幕破裂、不開機、當機"},
  {"name":"urgency","label":"急迫性","type":"select","required":true,"options":["一般","緊急（3天內）","非常緊急（當天）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__3C維修';

-- 81. 汽車 機車
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"vehicle_type","label":"車輛類型","type":"select","required":true,"options":["汽車","機車","電動車","重機"]},
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["維修保養","美容清潔","改裝","檢測","買賣"]},
  {"name":"issue_description","label":"問題說明","type":"text","required":true,"placeholder":"例：定期保養、異音檢查、鈑金烤漆"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__汽車_機車';

-- 82. 代辦服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_item","label":"代辦項目","type":"text","required":true,"placeholder":"例：政府文件、車輛過戶、簽證、跑腿"},
  {"name":"urgency","label":"急迫性","type":"select","required":true,"options":["一般","緊急（3天內）","非常緊急（當天）"]},
  {"name":"location","label":"辦理地點","type":"text","required":true,"placeholder":"例：台北市、新北市"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__代辦服務';

-- 83. 交通運輸
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"transport_type","label":"運輸類型","type":"select","required":true,"options":["包車接送","貨運","搬運","機場接送","長途運輸"]},
  {"name":"distance","label":"距離","type":"text","required":true,"placeholder":"例：台北到台中、市區內"},
  {"name":"cargo_info","label":"物品資訊","type":"text","required":true,"placeholder":"例：人數或貨物大小"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__交通運輸';

-- 84. 服飾配件
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"item_type","label":"商品類型","type":"select","required":true,"options":["訂製服飾","修改","配件","飾品","鞋類"]},
  {"name":"quantity","label":"數量","type":"number","unit":"件","required":true,"placeholder":"請輸入數量"},
  {"name":"custom_needs","label":"需求說明","type":"text","required":true,"placeholder":"例：改長度、訂製西裝、手工飾品"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__服飾配件';

-- 85. 樂器維修
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"instrument_type","label":"樂器類型","type":"text","required":true,"placeholder":"例：吉他、鋼琴、小提琴、爵士鼓"},
  {"name":"issue","label":"問題描述","type":"text","required":true,"placeholder":"例：弦線更換、調音、保養、維修"},
  {"name":"urgency","label":"急迫性","type":"select","required":true,"options":["一般","緊急（1週內）","非常緊急（3天內）"]}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__樂器維修';

-- 86. 手工製作
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"craft_type","label":"手工類型","type":"text","required":true,"placeholder":"例：手工皂、蠟燭、編織、木工、陶藝"},
  {"name":"quantity","label":"數量","type":"number","unit":"個","required":true,"placeholder":"請輸入數量"},
  {"name":"custom_design","label":"客製需求","type":"text","required":true,"placeholder":"例：特定款式、顏色、尺寸"}
,{"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}]'::jsonb
WHERE key = 'other__手工製作';

-- ============================================
-- 驗證更新結果
-- ============================================
SELECT 
  key, 
  name,
  CASE 
    WHEN form_config IS NULL THEN '❌ NULL'
    WHEN jsonb_typeof(form_config) = 'object' AND form_config::text = '{}' THEN '❌ 空物件 {}'
    WHEN jsonb_typeof(form_config) = 'array' AND jsonb_array_length(form_config) = 0 THEN '⚠️  空陣列 []'
    WHEN jsonb_typeof(form_config) = 'array' AND jsonb_array_length(form_config) = 4 THEN '✅ 4 個欄位（含補充說明）'
    WHEN jsonb_typeof(form_config) = 'array' THEN '⚠️  ' || jsonb_array_length(form_config)::text || ' 個欄位（應為4個）'
    ELSE '❓ 未知格式'
  END as form_config_狀態
FROM public.ai_subcategories
WHERE category_key IN ('home', 'event', 'learn', 'health', 'beauty', 'business', 'other')
ORDER BY category_key, sort_order;

