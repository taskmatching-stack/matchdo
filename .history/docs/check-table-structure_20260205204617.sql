-- 查看 ai_categories 表的所有欄位
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'ai_categories'
ORDER BY ordinal_position;
