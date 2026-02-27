-- Phase 1.6: 創建 Supabase Storage Buckets（project-images + custom-products）
-- 在 Supabase Dashboard > SQL Editor 執行
-- 說明：上傳目前經 server 使用 SERVICE_ROLE_KEY，會繞過 RLS；以下 policy 供前端直傳或 Dashboard 使用

-- ========== 1. project-images ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-images',
    'project-images',
    true,
    52428800,  -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 若曾執行過舊版腳本，先移除舊 policy 名稱
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete" ON storage.objects;

DROP POLICY IF EXISTS "project-images-public-read" ON storage.objects;
CREATE POLICY "project-images-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "project-images-auth-upload" ON storage.objects;
CREATE POLICY "project-images-auth-upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "project-images-auth-update" ON storage.objects;
CREATE POLICY "project-images-auth-update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "project-images-admin-delete" ON storage.objects;
CREATE POLICY "project-images-admin-delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'project-images'
    AND auth.role() = 'authenticated'
    AND auth.uid() IN (SELECT id FROM auth.users WHERE email = 'liutsaiiu@gmail.com')
);

-- ========== 2. custom-products ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'custom-products',
    'custom-products',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "custom-products-public-read" ON storage.objects;
CREATE POLICY "custom-products-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'custom-products');

DROP POLICY IF EXISTS "custom-products-auth-upload" ON storage.objects;
CREATE POLICY "custom-products-auth-upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'custom-products' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "custom-products-auth-update" ON storage.objects;
CREATE POLICY "custom-products-auth-update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'custom-products' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "custom-products-admin-delete" ON storage.objects;
CREATE POLICY "custom-products-admin-delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'custom-products'
    AND auth.role() = 'authenticated'
    AND auth.uid() IN (SELECT id FROM auth.users WHERE email = 'liutsaiiu@gmail.com')
);
