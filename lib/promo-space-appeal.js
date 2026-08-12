/**
 * 商攝・空間攝影 Beta 申訴：讀圖對比 → 結構化 JSON 裁決
 * 讀圖＝送兩張圖進 Gemini；JSON＝輸出契約（給後端決定退點／鎖定）
 */

'use strict';

const APPEAL_LOCK_HOURS = 24;
const MIN_CONFIDENCE = 0.55;

const COMPARE_PROMPT = `你是 MatchDO 空間攝影品質審核員。使用者申訴「生成結果幾乎沒變／失敗」。

圖1＝輸入參考（平面配置圖或 ISO 空間地圖）
圖2＝AI 生成結果（空間地圖或平視攝影）

請只依影像判斷，輸出「純 JSON」（不要 markdown、不要多餘文字）：
{
  "too_similar": boolean,
  "same_viewpoint": boolean,
  "overlay_or_frame_only": boolean,
  "confidence": number,
  "reason_zh": string
}

判定指引：
- too_similar=true：主圖面高度雷同（只加框、加門、輕微改色、幾乎未改構圖）
- same_viewpoint=true：視角幾乎不變（例如仍像平面圖／仍像同一 ISO 角度，未完成平視轉換）
- overlay_or_frame_only=true：明顯疊圖、半透明殘影、未完成轉換、像在原圖上貼一層
- 若視角／構圖明顯改變（即使風格相似）→ 以上三者皆 false
- confidence：0～1，你對裁決的把握

退點條件由伺服器依 JSON 欄位決定；你只需誠實填欄位。`;

function parseAppealJudgeJson(responseText) {
    const raw = (responseText != null ? String(responseText) : '').trim();
    if (!raw) return null;
    let t = raw;
    if (t.startsWith('```')) {
        t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        const obj = JSON.parse(m[0]);
        const confidence = Math.max(0, Math.min(1, Number(obj.confidence)));
        if (!Number.isFinite(confidence)) return null;
        return {
            too_similar: obj.too_similar === true,
            same_viewpoint: obj.same_viewpoint === true,
            overlay_or_frame_only: obj.overlay_or_frame_only === true,
            confidence,
            reason_zh: String(obj.reason_zh || '').trim().slice(0, 500)
        };
    } catch (_) {
        return null;
    }
}

function decideAppealFromJudge(judge) {
    if (!judge || typeof judge !== 'object') {
        return { status: 'inconclusive', should_refund: false, lock_on_fail: false };
    }
    if (!(judge.confidence >= MIN_CONFIDENCE)) {
        return { status: 'inconclusive', should_refund: false, lock_on_fail: false };
    }
    const failSignal = !!(judge.too_similar || judge.same_viewpoint || judge.overlay_or_frame_only);
    if (failSignal) {
        return { status: 'approved', should_refund: true, lock_on_fail: false };
    }
    return { status: 'rejected', should_refund: false, lock_on_fail: true };
}

async function compareSpaceAppealImages(deps, sourcePart, resultPart) {
    const { genAI, runInGeminiQueue, getTaggingModelName, supabase } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('情境圖服務暫未設定');
    const model = await getTaggingModelName(supabase);
    const parts = [
        { text: COMPARE_PROMPT },
        { text: '圖1（輸入參考）：' },
        sourcePart,
        { text: '圖2（生成結果）：' },
        resultPart
    ];
    const modelsToTry = [model];
    if (model !== 'gemini-3.1-flash-lite') modelsToTry.push('gemini-3.1-flash-lite');
    let lastErr = null;
    let text = '';
    let usedModel = model;
    for (const m of modelsToTry) {
        try {
            const result = await runInGeminiQueue(() => genAI.models.generateContent({
                model: m,
                contents: [{ role: 'user', parts }]
            }));
            text = (result && result.text != null ? String(result.text) : '') || '';
            if (text.trim()) {
                usedModel = m;
                break;
            }
        } catch (e) {
            lastErr = e;
        }
    }
    if (!text.trim()) throw lastErr || new Error('審核服務暫時無法回應');
    const judge = parseAppealJudgeJson(text);
    const decision = decideAppealFromJudge(judge);
    return { judge, decision, model: usedModel, raw_text: text.slice(0, 2000) };
}

function lockUntilFromRejectedAt(rejectedAt) {
    if (!rejectedAt) return null;
    const t = new Date(rejectedAt).getTime();
    if (!Number.isFinite(t)) return null;
    return new Date(t + APPEAL_LOCK_HOURS * 60 * 60 * 1000).toISOString();
}

function isAppealLocked(lockUntilIso) {
    if (!lockUntilIso) return false;
    const t = new Date(lockUntilIso).getTime();
    if (!Number.isFinite(t)) return false;
    return t > Date.now();
}

module.exports = {
    APPEAL_LOCK_HOURS,
    MIN_CONFIDENCE,
    COMPARE_PROMPT,
    parseAppealJudgeJson,
    decideAppealFromJudge,
    compareSpaceAppealImages,
    lockUntilFromRejectedAt,
    isAppealLocked
};
