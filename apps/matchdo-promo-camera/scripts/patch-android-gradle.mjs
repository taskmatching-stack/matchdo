/**
 * Windows：專案路徑含非 ASCII（如 AI建站）時，Android Gradle 預設會失敗。
 * 每次 cap sync 後套用 override（android/ 在 .gitignore，需自動 patch）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRADLE_PROPS = path.resolve(__dirname, '../android/gradle.properties');
const MARKER = 'android.overridePathCheck=true';

if (!fs.existsSync(GRADLE_PROPS)) {
  console.log('[patch-android-gradle] skip: android/gradle.properties not found');
  process.exit(0);
}

let text = fs.readFileSync(GRADLE_PROPS, 'utf8');
if (text.includes(MARKER)) {
  console.log('[patch-android-gradle] already patched');
  process.exit(0);
}

text = text.trimEnd() + '\n\n# Allow non-ASCII project path on Windows (e.g. D:\\AI建站\\...)\n' + MARKER + '\n';
fs.writeFileSync(GRADLE_PROPS, text, 'utf8');
console.log('[patch-android-gradle] added android.overridePathCheck=true');
