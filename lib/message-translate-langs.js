/**
 * 站內訊息翻譯：允許的目標語系（雙向，不限中↔英）。
 * 與 GET /api/translation/target-languages、POST …/direct-messages/:id/translate 共用。
 */
const MESSAGE_TRANSLATE_TARGET_LANGS = [
    { code: 'zh-TW', geminiName: 'Traditional Chinese (繁體中文)' },
    { code: 'en', geminiName: 'English' },
    { code: 'ja', geminiName: 'Japanese' },
    { code: 'ko', geminiName: 'Korean' },
    { code: 'es', geminiName: 'Spanish' },
    { code: 'de', geminiName: 'German' },
    { code: 'fr', geminiName: 'French' },
    { code: 'th', geminiName: 'Thai' },
    { code: 'vi', geminiName: 'Vietnamese' },
    { code: 'id', geminiName: 'Indonesian' },
    { code: 'pt', geminiName: 'Portuguese (Brazil)' }
];

const CODE_SET = new Set(MESSAGE_TRANSLATE_TARGET_LANGS.map((x) => x.code));

function normalizeMessageTranslateTargetLang(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'zh' || s === 'zh-tw' || s === 'zh-hant' || s === 'zh-hk') return 'zh-TW';
    if (s === 'zh-cn' || s === 'zh-hans') return 'zh-TW';
    if (s === 'en' || s === 'en-us' || s === 'en-gb') return 'en';
    if (s === 'ja' || s === 'jp') return 'ja';
    if (s === 'ko' || s === 'kr') return 'ko';
    if (s === 'es') return 'es';
    if (s === 'de') return 'de';
    if (s === 'fr') return 'fr';
    if (s === 'th') return 'th';
    if (s === 'vi') return 'vi';
    if (s === 'id') return 'id';
    if (s === 'pt' || s === 'pt-br') return 'pt';
    if (CODE_SET.has(s)) return s;
    return '';
}

function defaultMessageTranslateTargetFromUiLocale(uiLang) {
    const n = normalizeMessageTranslateTargetLang(uiLang);
    if (n) return n;
    return 'en';
}

function getMessageTranslateGeminiTargetName(code) {
    const c = normalizeMessageTranslateTargetLang(code);
    const row = MESSAGE_TRANSLATE_TARGET_LANGS.find((x) => x.code === c);
    return row ? row.geminiName : 'English';
}

function listMessageTranslateTargetLangsForApi(uiLang) {
    const isEn = String(uiLang || '').toLowerCase().indexOf('en') === 0;
    const labels = {
        'zh-TW': { zh: '繁體中文', en: 'Traditional Chinese' },
        en: { zh: 'English', en: 'English' },
        ja: { zh: '日本語', en: 'Japanese' },
        ko: { zh: '한국어', en: 'Korean' },
        es: { zh: 'Español', en: 'Spanish' },
        de: { zh: 'Deutsch', en: 'German' },
        fr: { zh: 'Français', en: 'French' },
        th: { zh: 'ไทย', en: 'Thai' },
        vi: { zh: 'Tiếng Việt', en: 'Vietnamese' },
        id: { zh: 'Bahasa Indonesia', en: 'Indonesian' },
        pt: { zh: 'Português (BR)', en: 'Portuguese (Brazil)' }
    };
    return MESSAGE_TRANSLATE_TARGET_LANGS.map((row) => {
        const lab = labels[row.code] || { zh: row.code, en: row.code };
        return { code: row.code, label: isEn ? lab.en : lab.zh };
    });
}

module.exports = {
    MESSAGE_TRANSLATE_TARGET_LANGS,
    normalizeMessageTranslateTargetLang,
    defaultMessageTranslateTargetFromUiLocale,
    getMessageTranslateGeminiTargetName,
    listMessageTranslateTargetLangsForApi
};
