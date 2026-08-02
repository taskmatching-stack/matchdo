/**
 * 自 repo public/ 同步 Store bundle → www/（勿手改 www/）。
 * 見 docs/PLAN-promo-camera-capacitor-app.md §4
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '../..');
const PUBLIC = path.join(REPO_ROOT, 'public');
const WWW = path.join(APP_ROOT, 'www');
const NODE_MODULES = path.join(APP_ROOT, 'node_modules');

const STATIC_FILES = [
  'css/bootstrap.min.css',
  'css/morandi-global.css',
  'css/image-lightbox.css',
  'css/promo-camera.css',
  'css/promo-camera-presets.css',
  'css/promo-camera-app.css',
  'css/digital-asset-picker.css',
  'js/auth-middleware.js',
  'js/i18n.js',
  'js/matchdo-promo-image.js',
  'js/digital-asset-picker.js',
  'js/image-lightbox.js',
  'js/promo-camera/api.js',
  'js/promo-camera/state.js',
  'js/promo-camera/index.js',
  'js/promo-camera/presets.js',
  'js/promo-camera/app-shell.js',
  'js/promo-camera/app-runtime.js',
  'js/promo-camera/app-native-bridge.js',
  'config/auth-config.js',
  'locales/zh-TW.json',
  'locales/en.json',
  'img/matchdo-logo.png',
  'img/cam-lcd-on.png'
];

const JS_PATCH_NAMES = new Set([
  'js/promo-camera/app-shell.js',
  'js/promo-camera/presets.js'
]);

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error('Missing source file: ' + src);
  }
  ensureDirForFile(dest);
  fs.copyFileSync(src, dest);
}

function copyOptional(src, dest) {
  if (fs.existsSync(src)) copyFile(src, dest);
}

function patchStoreJs(relPath, content) {
  if (!JS_PATCH_NAMES.has(relPath)) return content;
  return content
    .replace(/(['"])\/login\.html/g, '$1https://matchdo.cc/login.html')
    .replace(/(['"])\/credits\.html/g, '$1https://matchdo.cc/credits.html');
}

function copyStaticFromPublic() {
  for (const rel of STATIC_FILES) {
    const src = path.join(PUBLIC, rel);
    const dest = path.join(WWW, rel);
    if (JS_PATCH_NAMES.has(rel)) {
      const content = patchStoreJs(rel, fs.readFileSync(src, 'utf8'));
      ensureDirForFile(dest);
      fs.writeFileSync(dest, content, 'utf8');
    } else {
      copyFile(src, dest);
    }
  }
}

function copyVendors() {
  copyFile(
    path.join(NODE_MODULES, 'bootstrap/dist/js/bootstrap.bundle.min.js'),
    path.join(WWW, 'js/vendor/bootstrap.bundle.min.js')
  );

  const biCss = path.join(NODE_MODULES, 'bootstrap-icons/font/bootstrap-icons.css');
  const biFonts = path.join(NODE_MODULES, 'bootstrap-icons/font/fonts');
  copyFile(biCss, path.join(WWW, 'vendor/bootstrap-icons/bootstrap-icons.css'));
  if (fs.existsSync(biFonts)) {
    for (const name of fs.readdirSync(biFonts)) {
      copyFile(path.join(biFonts, name), path.join(WWW, 'vendor/bootstrap-icons/fonts', name));
    }
  }

  const supabaseCandidates = [
    'dist/umd/supabase.js',
    'dist/module/index.js'
  ];
  let supabaseSrc = null;
  for (const rel of supabaseCandidates) {
    const candidate = path.join(NODE_MODULES, '@supabase/supabase-js', rel);
    if (fs.existsSync(candidate)) {
      supabaseSrc = candidate;
      break;
    }
  }
  if (!supabaseSrc) {
    throw new Error('Cannot find @supabase/supabase-js browser bundle in node_modules');
  }
  copyFile(supabaseSrc, path.join(WWW, 'js/vendor/supabase.js'));

  copyFile(path.join(APP_ROOT, 'store/capacitor-boot.js'), path.join(WWW, 'store/capacitor-boot.js'));
}

function patchBootstrapIconsCss() {
  const cssPath = path.join(WWW, 'vendor/bootstrap-icons/bootstrap-icons.css');
  if (!fs.existsSync(cssPath)) return;
  const css = fs.readFileSync(cssPath, 'utf8');
  fs.writeFileSync(cssPath, css.replace(/\.\/fonts\//g, './fonts/'), 'utf8');
}

function buildIndexHtml() {
  const srcHtml = fs.readFileSync(path.join(PUBLIC, 'client/promo-camera-app.html'), 'utf8');
  let html = srcHtml;

  html = html.replace(/<link rel="canonical"[^>]*>\s*/i, '');
  html = html.replace(/<link rel="manifest"[^>]*>\s*/i, '');
  html = html.replace(/<meta name="robots"[^>]*>\s*/i, '');

  html = html.replace(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap-icons@1\.11\.0\/font\/bootstrap-icons\.css/g,
    'vendor/bootstrap-icons/bootstrap-icons.css'
  );

  html = html.replace(/href="\/css\//g, 'href="css/');
  html = html.replace(/src="\/img\//g, 'src="img/');
  html = html.replace(/href="\/img\//g, 'href="img/');
  html = html.replace(/href="\/login\.html/g, 'href="https://matchdo.cc/login.html');

  html = html.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.0\.0[\s\S]*?<script src="\/js\/promo-camera\/app-shell\.js[^"]*"><\/script>\s*/i,
    ''
  );
  html = html.replace(/<script src="\/js\/promo-camera\/pwa-install-prompt\.js[^"]*"><\/script>\s*/i, '');

  const scripts = [
    '<script src="js/vendor/bootstrap.bundle.min.js"></script>',
    '<script src="js/vendor/supabase.js"></script>',
    '<script src="config/auth-config.js"></script>',
    '<script src="js/auth-middleware.js"></script>',
    '<script src="js/i18n.js"></script>',
    '<script src="js/matchdo-promo-image.js"></script>',
    '<script src="js/digital-asset-picker.js"></script>',
    '<script src="js/image-lightbox.js"></script>',
    '<script src="js/promo-camera/api.js"></script>',
    '<script src="js/promo-camera/state.js"></script>',
    '<script src="js/promo-camera/app-runtime.js"></script>',
    '<script src="js/promo-camera/index.js"></script>',
    '<script src="js/promo-camera/presets.js"></script>',
    '<script src="js/promo-camera/app-shell.js"></script>',
    '<script src="js/promo-camera/app-native-bridge.js"></script>'
  ].join('\n  ');

  const i18nMarker = html.indexOf('function pcAppApplyI18n()');
  if (i18nMarker === -1) {
    throw new Error('pcAppApplyI18n() not found in promo-camera-app.html');
  }
  const scriptOpen = html.lastIndexOf('<script>', i18nMarker);
  if (scriptOpen === -1) {
    throw new Error('inline i18n script block not found');
  }
  html = html.slice(0, scriptOpen) + scripts + '\n\n  ' + html.slice(scriptOpen);

  html = html.replace(/<head>/i, '<head>\n  <script src="store/capacitor-boot.js"></script>');

  fs.writeFileSync(path.join(WWW, 'index.html'), html, 'utf8');
}

function main() {
  console.log('[sync-www] repo:', REPO_ROOT);
  rmrf(WWW);
  fs.mkdirSync(WWW, { recursive: true });
  copyStaticFromPublic();
  copyVendors();
  patchBootstrapIconsCss();
  buildIndexHtml();
  console.log('[sync-www] done →', WWW);
}

main();
