-- 創建 Supabase Storage Bucket: project-images
-- 在 Supabase Dashboard > Storage 執行，或使用 SQL Editor

-- 1. 創建 bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-images',
    'project-images',
    true,  -- 設為公開
    524288000,  -- 500MB 限制
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 2. 設置 Storage Policy - 允許所有人讀取
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

-- 3. 設置 Storage Policy - 只允許已登入使用者上傳
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'project-images' 
    AND auth.role() = 'authenticated'
);

-- 4. 設置 Storage Policy - 只允許已登入使用者更新自己的檔案
CREATE POLICY "Authenticated users can update own files"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'project-images'
    AND auth.role() = 'authenticated'
);

-- 5. 設置 Storage Policy - 只允許管理員刪除
CREATE POLICY "Admins can delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'project-images'
    AND auth.role() = 'authenticated'
    AND (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE email IN ('liutsaiiu@gmail.com')
        )
    )
);
