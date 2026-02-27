/**
 * 本機資料夾範例圖 → 上傳到 Supabase Storage（雲端）→ 寫入 manufacturer_portfolio 種子資料
 *
 * 用法：node scripts/upload-portfolio-images-and-seed.js [本機資料夾路徑]
 * 預設路徑：docs/portfolio-images
 * 資料夾結構：一層 = 分類 key（對應 custom_product_categories.key），底下放圖檔
 *
 * 需 .env：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET = 'custom-products';
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function getAllImageFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      results.push(...getAllImageFiles(full, baseDir));
    } else if (IMAGE_EXT.includes(path.extname(e.name).toLowerCase())) {
      results.push({ fullPath: full, relativePath: rel, name: e.name });
    }
  }
  return results;
}

function getCategoryKeyFromRelative(relativePath) {
  const parts = relativePath.split(path.sep);
  return parts[0] || '';
}

async function uploadFile(supabase, localPath, storagePath, mimeType) {
  const buffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType || 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

function getMime(name) {
  const ext = (path.extname(name) || '').toLowerCase();
  if (['.png'].includes(ext)) return 'image/png';
  if (['.gif'].includes(ext)) return 'image/gif';
  if (['.webp'].includes(ext)) return 'image/webp';
  return 'image/jpeg';
}

async function main() {
  const baseDir = path.resolve(process.cwd(), process.argv[2] || 'docs/portfolio-images');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('請在 .env 設定 SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(baseDir)) {
    console.error('資料夾不存在：', baseDir);
    console.error('請先建立資料夾並放入依分類 key 命名的子資料夾與圖檔。');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const images = getAllImageFiles(baseDir);
  if (images.length === 0) {
    console.error('未在', baseDir, '底下找到任何圖片（支援 .jpg .jpeg .png .webp .gif）');
    process.exit(1);
  }

  // 依「第一層目錄」分組 = category_key
  const byCategory = {};
  for (const img of images) {
    const key = getCategoryKeyFromRelative(img.relativePath);
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(img);
  }

  // 取得或建立示範廠商
  const categoryKeys = Object.keys(byCategory).filter(Boolean);
  let manufacturerId;
  const { data: existing } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('name', '示範廠商（範例圖）')
    .maybeSingle();
  if (existing) {
    manufacturerId = existing.id;
    await supabase.from('manufacturers').update({
      categories: categoryKeys,
      updated_at: new Date().toISOString()
    }).eq('id', manufacturerId);
    console.log('使用既有示範廠商', manufacturerId);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('manufacturers')
      .insert({
        name: '示範廠商（範例圖）',
        description: '由腳本建立，用於範例圖展示',
        categories: categoryKeys,
        contact_json: { email: '', phone: '', url: '' },
        location: '台北市',
        is_active: true
      })
      .select('id')
      .single();
    if (insErr) {
      console.error('建立示範廠商失敗：', insErr.message);
      process.exit(1);
    }
    manufacturerId = inserted.id;
    console.log('已建立示範廠商', manufacturerId);
  }

  let uploaded = 0;
  for (const img of images) {
    const categoryKey = getCategoryKeyFromRelative(img.relativePath);
    const safeName = `${Date.now()}-${uploaded}-${img.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `portfolio/${categoryKey}/${safeName}`;
    try {
      const publicUrl = await uploadFile(supabase, img.fullPath, storagePath, getMime(img.name));
      const title = path.basename(img.name, path.extname(img.name));
      const { error } = await supabase.from('manufacturer_portfolio').insert({
        manufacturer_id: manufacturerId,
        title: title || '範例作品',
        image_url: publicUrl,
        image_url_before: null,
        design_highlight: null,
        tags: categoryKey ? [categoryKey] : [],
        sort_order: uploaded
      });
      if (error) {
        console.error('寫入 DB 失敗', img.name, error.message);
      } else {
        uploaded++;
        console.log('OK', uploaded, img.relativePath, '→', publicUrl.slice(0, 60) + '...');
      }
    } catch (e) {
      console.error('上傳失敗', img.fullPath, e.message);
    }
  }

  console.log('完成：共', uploaded, '張圖已上傳至雲端並寫入 manufacturer_portfolio。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
