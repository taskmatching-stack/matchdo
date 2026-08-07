'use strict';

const materialComboAnalytics = require('./material-combo-analytics');

const EXPORT_VERSION = '1.0';

const ASSET_KINDS = new Set(['user_design', 'promo_scene', 'material_combo', 'print', 'embed_visitor']);

const ENTRY_SURFACE_ZH = {
    design_page: '設計頁',
    promo_tab: '情境圖頁',
    promo_camera: '商攝導演',
    promo_camera_app: '商攝導演 App',
    material_combo_page: '材料組合',
    print_page: '印花',
    embed_visitor: 'Embed 訪客生圖'
};

const REF_KIND_ZH = {
    vendor_asset_prototype: '廠商數位原型',
    vendor_asset_material: '廠商材料',
    vendor_asset_part: '廠商配件',
    vendor_asset_other: '原圖印刷／風格參考',
    custom_product: '設計稿',
    vendor_asset: '廠商素材',
    upload: '使用者上傳',
    digital_asset: '數位資產',
    material_combo: '材料組合',
    print: '印花',
    unknown: '參考圖'
};

const CAMERA_CAT_LABELS = {
    camera_brand: '品牌色彩',
    film_simulation: '底片模擬',
    shooting_angle: '拍攝角度',
    aperture: '光圈',
    exposure_ev: 'EV 曝光',
    lens: '鏡頭',
    aperture_blades: '光圈葉片'
};

const DISCLAIMER_ZH = '本文件為 MatchDO 平台生成紀錄匯出，供創作过程说明，不构成法律鉴定。';

function parseReferenceSourcesList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    return [];
}

function absUrl(baseUrl, path) {
    const p = String(path || '').trim();
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    const base = String(baseUrl || '').replace(/\/$/, '');
    return base ? base + (p.startsWith('/') ? p : '/' + p) : p;
}

function inspirationPathForVendorRef(s) {
    const vid = String(s && s.vendor_asset_id || '').trim();
    if (!vid) return null;
    let kind = String(s && s.asset_kind || 'prototype').trim().toLowerCase();
    if (kind === 'other') return null;
    if (kind !== 'material' && kind !== 'part') kind = 'prototype';
    return '/inspiration/' + kind + '/' + encodeURIComponent(vid);
}

function refKindFromSource(s) {
    if (!s || typeof s !== 'object') return 'unknown';
    const vid = String(s.vendor_asset_id || '').trim();
    const ak = String(s.asset_kind || '').trim().toLowerCase();
    if (vid) {
        if (ak === 'material') return 'vendor_asset_material';
        if (ak === 'part') return 'vendor_asset_part';
        if (ak === 'other') return 'vendor_asset_other';
        return 'vendor_asset_prototype';
    }
    const t = String(s.type || s.source_type || s.ref_kind || '').trim().toLowerCase();
    if (t === 'custom_product') return 'custom_product';
    if (t === 'upload') return 'upload';
    if (t === 'digital_asset') return 'digital_asset';
    if (t === 'vendor_asset') return 'vendor_asset';
    if (t === 'material_combo') return 'material_combo';
    if (t === 'print') return 'print';
    return 'unknown';
}

function refRoleLabel(s) {
    const kind = refKindFromSource(s);
    return REF_KIND_ZH[kind] || REF_KIND_ZH.unknown;
}

function normalizeReferenceEntry(s, opts) {
    opts = opts || {};
    const audience = opts.audience || 'owner';
    const baseUrl = opts.baseUrl || '';
    const showPublicLinks = audience === 'admin' || opts.show_inspiration_links !== false;
    const refKind = refKindFromSource(s);
    const vid = String(s && s.vendor_asset_id || '').trim();
    const refId = vid || String(s && (s.id || s.source_id || s.ref_id) || '').trim() || null;
    let inspirationPath = inspirationPathForVendorRef(s);
    if (!inspirationPath && refKind === 'custom_product' && refId) {
        inspirationPath = '/inspiration/user_design/' + encodeURIComponent(refId);
    }
    const isPrivate = s && s.is_private_reference === true;
    let inspirationUrl = null;
    if (showPublicLinks && inspirationPath && !isPrivate) {
        inspirationUrl = absUrl(baseUrl, inspirationPath);
    }
    const entry = {
        ref_kind: refKind,
        ref_kind_label: refRoleLabel(s),
        ref_id: refId,
        title: String(s && (s.title || s.name) || '').trim() || null,
        image_url: String(s && (s.image_url || s.url) || '').trim() || null,
        manufacturer_name: String(s && s.manufacturer_name || '').trim() || null,
        manufacturer_profile_url: s && s.manufacturer_profile_url ? absUrl(baseUrl, s.manufacturer_profile_url) : null,
        inspiration_url: inspirationUrl,
        visibility: inspirationUrl ? 'public_link' : (isPrivate ? 'private' : 'no_public_link')
    };
    if (s && s.pattern_intent) entry.pattern_intent = String(s.pattern_intent);
    if (s && s.gallery_label) entry.gallery_label = String(s.gallery_label);
    if (s && s.material_combo && typeof s.material_combo === 'object') {
        entry.material_combo = s.material_combo;
        const snap = materialComboAnalytics.parseMaterialComboSnapshot(s.material_combo, {
            source: 'design_reference',
            source_id: refId
        });
        if (snap) entry.material_combo_summary = snap;
    }
    return entry;
}

function collectMaterialCombosForResume(rawSources, refs) {
    const seen = new Set();
    const out = [];
    function pushSnap(snap) {
        if (!snap) return;
        const key = [
            snap.main_hex, snap.main_material,
            snap.accent_hex, snap.accent_material,
            snap.third_hex, snap.third_material,
            snap.boundary || ''
        ].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        out.push(snap);
    }
    materialComboAnalytics.extractCombosFromReferenceSources(rawSources).forEach(pushSnap);
    (refs || []).forEach(function (r) {
        if (r && r.material_combo_summary) pushSnap(r.material_combo_summary);
        else if (r && r.material_combo) {
            pushSnap(materialComboAnalytics.parseMaterialComboSnapshot(r.material_combo, {
                source: 'design_reference',
                source_id: r.ref_id
            }));
        }
    });
    return out;
}

function formatCameraParamsResolved(cameraParams) {
    const cp = cameraParams && typeof cameraParams === 'object' ? cameraParams : {};
    const resolved = cp.resolved && typeof cp.resolved === 'object' ? cp.resolved : {};
    return Object.keys(resolved).map(function (cat) {
        const hit = resolved[cat];
        const name = hit && (hit.name || hit.key) ? String(hit.name || hit.key) : '';
        if (!name) return null;
        return {
            category: cat,
            category_label: CAMERA_CAT_LABELS[cat] || cat,
            name: name
        };
    }).filter(Boolean);
}

function promoEntrySurface(row) {
    const mode = String(row && row.generation_mode || '').trim();
    const ch = String(row && row.client_channel || 'web').trim().toLowerCase();
    if (mode === 'camera_advanced') {
        return ch === 'app' ? 'promo_camera_app' : 'promo_camera';
    }
    return 'promo_tab';
}

function buildPlatformBlock() {
    return {
        site: 'matchdo',
        disclaimer: DISCLAIMER_ZH
    };
}

async function fetchProfile(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase.from('profiles').select('id, email, full_name').eq('id', userId).maybeSingle();
    return data || null;
}

async function buildUserDesignResume(supabase, id, opts) {
    const select = 'id, owner_id, title, description, category, subcategory_key, reference_image_url, ai_generated_image_url, generation_prompt, generation_seed, reference_sources, show_on_homepage, created_at, updated_at, is_vendor_self_serve, data_lineage_json, generator_manufacturer_id, credit_transaction_id, composed_flux_prompt, generation_meta_json, parent_record_kind, parent_record_id';
    let { data: row, error } = await supabase.from('custom_products').select(select).eq('id', id).maybeSingle();
    if (error && /credit_transaction_id|composed_flux_prompt|generation_meta_json|parent_record/.test(error.message || '')) {
        ({ data: row, error } = await supabase.from('custom_products')
            .select('id, owner_id, title, description, category, subcategory_key, reference_image_url, ai_generated_image_url, generation_prompt, generation_seed, reference_sources, show_on_homepage, created_at, updated_at, is_vendor_self_serve, data_lineage_json, generator_manufacturer_id')
            .eq('id', id).maybeSingle());
    }
    if (error) throw error;
    if (!row || !row.ai_generated_image_url) return { error: 'not_found' };

    const audience = opts.audience || 'owner';
    if (audience === 'owner' && opts.request_user_id && row.owner_id !== opts.request_user_id) {
        return { error: 'forbidden' };
    }

    const refs = parseReferenceSourcesList(row.reference_sources).map(function (s) {
        return normalizeReferenceEntry(s, opts);
    });
    if (row.reference_image_url && String(row.reference_image_url).trim()) {
        const hasRefUrl = refs.some(function (r) { return r.image_url === row.reference_image_url; });
        if (!hasRefUrl) {
            refs.unshift(normalizeReferenceEntry({ type: 'upload', image_url: row.reference_image_url, title: '參考示意圖' }, opts));
        }
    }

    const showOnWall = row.show_on_homepage !== false;
    const inspirationPath = showOnWall ? '/inspiration/user_design/' + encodeURIComponent(row.id) : null;
    const tx = await fetchCreditTransactionSummary(supabase, row.credit_transaction_id);
    const parentRecord = buildParentRecordBlock(row, opts);

    const resume = {
        export_version: EXPORT_VERSION,
        record_id: row.id,
        asset_kind: 'user_design',
        source_table: 'custom_products',
        title: row.title || '產品設計稿',
        image: {
            output_url: row.ai_generated_image_url,
            reference_urls: refs.map(function (r) { return r.image_url; }).filter(Boolean)
        },
        prompts: promptsFromDesignRow(row),
        taxonomy: {
            category_key: row.category || null,
            subcategory_key: row.subcategory_key || null
        },
        references: refs,
        generation_context: (function () {
            const ctx = {
                entry_surface: 'design_page',
                entry_surface_label: ENTRY_SURFACE_ZH.design_page,
                generation_meta: row.generation_meta_json || null
            };
            const combos = collectMaterialCombosForResume(row.reference_sources, refs);
            if (combos.length) {
                ctx.material_combos = combos;
                ctx.material_combo_summary = combos[0];
            }
            return ctx;
        })(),
        billing: billingFromRow(row, tx),
        provenance_links: {
            inspiration_url: inspirationPath ? absUrl(opts.baseUrl, inspirationPath) : null,
            design_page_deep_link: absUrl(opts.baseUrl, '/custom-product.html')
        },
        timestamps: {
            created_at: row.created_at || null,
            completed_at: row.created_at || null,
            exported_at: new Date().toISOString()
        },
        actor: {
            user_id: audience === 'admin' ? row.owner_id : undefined,
            display_name: audience === 'admin' ? undefined : 'MatchDO 帳號持有人（已驗證）'
        },
        platform: buildPlatformBlock()
    };
    if (parentRecord) resume.parent_record = parentRecord;

    if (audience === 'admin') {
        const prof = await fetchProfile(supabase, row.owner_id);
        resume.actor = {
            user_id: row.owner_id,
            email: prof && prof.email ? prof.email : null,
            display_name: prof && prof.full_name ? prof.full_name : null
        };
        resume._internal = {
            show_on_homepage: showOnWall,
            is_vendor_self_serve: row.is_vendor_self_serve === true,
            generator_manufacturer_id: row.generator_manufacturer_id || null,
            data_lineage_json: row.data_lineage_json || null
        };
    }

    return { resume: resume };
}

async function buildPromoSceneResume(supabase, id, opts) {
    const selectFull = 'id, user_id, source_type, source_id, source_image_url, user_prompt, final_prompt, scene_template_key, scene_key, generation_mode, client_channel, camera_params, width, height, megapixels, aspect_ratio, result_image_url, points_charged, status, created_at, completed_at, show_on_homepage, credit_transaction_id, generation_meta_json, parent_record_kind, parent_record_id';
    let { data: row, error } = await supabase.from('product_promo_generations').select(selectFull).eq('id', id).maybeSingle();
    if (error && /generation_mode|client_channel|camera_params|scene_key|credit_transaction_id|generation_meta_json|parent_record/.test(error.message || '')) {
        ({ data: row, error } = await supabase.from('product_promo_generations')
            .select('id, user_id, source_type, source_id, source_image_url, user_prompt, final_prompt, scene_template_key, user_prompt, result_image_url, points_charged, status, created_at, completed_at, show_on_homepage, width, height, megapixels, aspect_ratio')
            .eq('id', id).maybeSingle());
    }
    if (error) throw error;
    if (!row || row.status !== 'success' || !row.result_image_url) return { error: 'not_found' };

    const audience = opts.audience || 'owner';
    if (audience === 'owner' && opts.request_user_id && row.user_id !== opts.request_user_id) {
        return { error: 'forbidden' };
    }

    const surface = promoEntrySurface(row);
    const refs = [];
    if (row.source_image_url && String(row.source_image_url).trim()) {
        refs.push(normalizeReferenceEntry({
            type: row.source_type || 'upload',
            id: row.source_id,
            source_id: row.source_id,
            image_url: row.source_image_url,
            title: row.source_type === 'custom_product' ? '來源設計稿' : (row.source_type === 'vendor_asset' ? '來源素材' : '產品參考圖')
        }, opts));
    }

    const showOnWall = row.show_on_homepage !== false;
    const inspirationPath = showOnWall ? '/inspiration/promo_scene/' + encodeURIComponent(row.id) : null;
    const tx = await fetchCreditTransactionSummary(supabase, row.credit_transaction_id);
    const parentRecord = buildParentRecordBlock(row, opts);

    const resume = {
        export_version: EXPORT_VERSION,
        record_id: row.id,
        asset_kind: 'promo_scene',
        source_table: 'product_promo_generations',
        title: ENTRY_SURFACE_ZH[surface] || '情境圖',
        image: {
            output_url: row.result_image_url,
            width: row.width || null,
            height: row.height || null,
            aspect_ratio: row.aspect_ratio || null,
            megapixels: row.megapixels != null ? row.megapixels : null,
            reference_urls: refs.map(function (r) { return r.image_url; }).filter(Boolean)
        },
        prompts: {
            user_prompt: row.user_prompt || null,
            final_prompt: row.final_prompt || null,
            composed_prompt: row.final_prompt || null,
            seed: null
        },
        taxonomy: {},
        references: refs,
        generation_context: {
            entry_surface: surface,
            entry_surface_label: ENTRY_SURFACE_ZH[surface] || surface,
            generation_mode: row.generation_mode || (surface.startsWith('promo_camera') ? 'camera_advanced' : 'standard'),
            client_channel: row.client_channel || null,
            scene: {
                theme_key: row.scene_template_key || null,
                scene_key: row.scene_key || null
            },
            camera_params: formatCameraParamsResolved(row.camera_params),
            generation_meta: row.generation_meta_json || null
        },
        billing: billingFromRow(row, tx),
        provenance_links: {
            inspiration_url: inspirationPath ? absUrl(opts.baseUrl, inspirationPath) : null
        },
        timestamps: {
            created_at: row.created_at || null,
            completed_at: row.completed_at || row.created_at || null,
            exported_at: new Date().toISOString()
        },
        actor: {
            display_name: audience === 'admin' ? undefined : 'MatchDO 帳號持有人（已驗證）'
        },
        platform: buildPlatformBlock()
    };
    if (parentRecord) resume.parent_record = parentRecord;

    if (audience === 'admin') {
        const prof = await fetchProfile(supabase, row.user_id);
        resume.actor = {
            user_id: row.user_id,
            email: prof && prof.email ? prof.email : null,
            display_name: prof && prof.full_name ? prof.full_name : null
        };
        resume._internal = {
            show_on_homepage: showOnWall,
            source_type: row.source_type,
            source_id: row.source_id
        };
    }

    return { resume: resume };
}

async function fetchCreditTransactionSummary(supabase, txId) {
    const id = String(txId || '').trim();
    if (!id) return null;
    const { data } = await supabase
        .from('credit_transactions')
        .select('id, amount, type, description, metadata, created_at, balance_after')
        .eq('id', id)
        .maybeSingle();
    return data || null;
}

async function manufacturerOwnedByUser(supabase, manufacturerId, userId) {
    if (!manufacturerId || !userId) return false;
    const { data } = await supabase.from('manufacturers').select('user_id').eq('id', manufacturerId).maybeSingle();
    return !!(data && data.user_id === userId);
}

function billingFromRow(row, tx) {
    const out = {
        points_charged: row.points_charged != null ? row.points_charged : (tx && tx.amount != null ? Math.abs(tx.amount) : null),
        credit_transaction_id: row.credit_transaction_id || null,
        transaction_at: tx && tx.created_at ? tx.created_at : null,
        billing_type: row.billing_type || null
    };
    if (tx && tx.description) out.transaction_description = tx.description;
    return out;
}

function buildParentRecordBlock(row, opts) {
    const kind = String(row && row.parent_record_kind || '').trim();
    const id = String(row && row.parent_record_id || '').trim();
    if (!kind || !id) return null;
    const block = { kind: kind, id: id };
    if (opts && opts.baseUrl && ASSET_KINDS.has(kind)) {
        if (kind === 'user_design') block.inspiration_url = absUrl(opts.baseUrl, '/inspiration/user_design/' + encodeURIComponent(id));
        else if (kind === 'promo_scene') block.inspiration_url = absUrl(opts.baseUrl, '/inspiration/promo_scene/' + encodeURIComponent(id));
    }
    return block;
}

function promptsFromDesignRow(row) {
    const composed = row && row.composed_flux_prompt ? String(row.composed_flux_prompt).trim() : '';
    const userPrompt = row && (row.generation_prompt || row.description) ? String(row.generation_prompt || row.description).trim() : null;
    return {
        user_prompt: userPrompt || null,
        final_prompt: row && row.generation_prompt ? row.generation_prompt : null,
        composed_prompt: composed || null,
        composed_prompt_note: composed ? null : '系統未保存完整模型 prompt',
        seed: row && row.generation_seed != null ? row.generation_seed : null
    };
}

async function buildMaterialComboResume(supabase, id, opts) {
    const { data: row, error } = await supabase
        .from('user_material_combo_generations')
        .select('id, user_id, image_url, title, category, material_combo_json, credit_transaction_id, created_at')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        if (error.code === '42P01') return { error: 'not_found' };
        throw error;
    }
    if (!row || !row.image_url) return { error: 'not_found' };

    const audience = opts.audience || 'owner';
    if (audience === 'owner' && opts.request_user_id && row.user_id !== opts.request_user_id) {
        return { error: 'forbidden' };
    }

    const combo = row.material_combo_json || {};
    const snap = materialComboAnalytics.parseMaterialComboSnapshot(combo, {
        source: 'generation',
        source_id: row.id,
        created_at: row.created_at
    });
    const tx = await fetchCreditTransactionSummary(supabase, row.credit_transaction_id);

    const resume = {
        export_version: EXPORT_VERSION,
        record_id: row.id,
        asset_kind: 'material_combo',
        source_table: 'user_material_combo_generations',
        title: row.title || '材料組合',
        image: {
            output_url: row.image_url,
            reference_urls: []
        },
        prompts: {
            user_prompt: null,
            final_prompt: null,
            composed_prompt: null,
            seed: null
        },
        taxonomy: {
            user_category: row.category || null
        },
        references: [],
        generation_context: {
            entry_surface: 'material_combo_page',
            entry_surface_label: ENTRY_SURFACE_ZH.material_combo_page,
            material_combo: combo,
            material_combo_summary: snap
        },
        billing: billingFromRow(row, tx),
        provenance_links: {},
        timestamps: {
            created_at: row.created_at || null,
            completed_at: row.created_at || null,
            exported_at: new Date().toISOString()
        },
        actor: {
            display_name: audience === 'admin' ? undefined : 'MatchDO 帳號持有人（已驗證）'
        },
        platform: buildPlatformBlock()
    };

    if (audience === 'admin') {
        const prof = await fetchProfile(supabase, row.user_id);
        resume.actor = {
            user_id: row.user_id,
            email: prof && prof.email ? prof.email : null,
            display_name: prof && prof.full_name ? prof.full_name : null
        };
    }

    return { resume: resume };
}

async function buildPrintResume(supabase, id, opts) {
    const { data: row, error } = await supabase
        .from('user_print_generations')
        .select('id, user_id, image_url, title, category, print_meta_json, credit_transaction_id, created_at')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        if (error.code === '42P01') return { error: 'not_found' };
        throw error;
    }
    if (!row || !row.image_url) return { error: 'not_found' };

    const audience = opts.audience || 'owner';
    if (audience === 'owner' && opts.request_user_id && row.user_id !== opts.request_user_id) {
        return { error: 'forbidden' };
    }

    const meta = row.print_meta_json || {};
    const tx = await fetchCreditTransactionSummary(supabase, row.credit_transaction_id);
    const sourceKind = String(meta.source_kind || 'original').trim();
    let parentRecord = null;
    if (sourceKind === 'redraw' && meta.source_print_id) {
        parentRecord = { kind: 'print', id: String(meta.source_print_id) };
    } else if (meta.source_generation_id) {
        parentRecord = { kind: 'print', id: String(meta.source_generation_id) };
    }

    const resume = {
        export_version: EXPORT_VERSION,
        record_id: row.id,
        asset_kind: 'print',
        source_table: 'user_print_generations',
        title: row.title || (meta.print_type ? String(meta.print_type) : '印花'),
        image: {
            output_url: row.image_url,
            reference_urls: []
        },
        prompts: {
            user_prompt: null,
            final_prompt: null,
            composed_prompt: null,
            seed: null
        },
        taxonomy: {
            user_category: row.category || null
        },
        references: [],
        generation_context: {
            entry_surface: 'print_page',
            entry_surface_label: ENTRY_SURFACE_ZH.print_page,
            print_meta: meta,
            derivation_type: sourceKind === 'redraw' ? 'print_redraw' : null
        },
        billing: billingFromRow(row, tx),
        provenance_links: {},
        timestamps: {
            created_at: row.created_at || null,
            completed_at: row.created_at || null,
            exported_at: new Date().toISOString()
        },
        actor: {
            display_name: audience === 'admin' ? undefined : 'MatchDO 帳號持有人（已驗證）'
        },
        platform: buildPlatformBlock()
    };
    if (parentRecord) resume.parent_record = parentRecord;

    if (audience === 'admin') {
        const prof = await fetchProfile(supabase, row.user_id);
        resume.actor = {
            user_id: row.user_id,
            email: prof && prof.email ? prof.email : null,
            display_name: prof && prof.full_name ? prof.full_name : null
        };
    }

    return { resume: resume };
}

async function buildEmbedVisitorResume(supabase, id, opts) {
    const select = 'id, embed_instance_id, manufacturer_id, prototype_asset_id, reference_sources, prompt, ai_generated_image_url, generation_seed, referrer_host, billing_type, points_charged, custom_product_id, created_at, visitor_ip_hash, embed_session_id';
    let { data: row, error } = await supabase.from('vendor_embed_designs').select(select).eq('id', id).maybeSingle();
    if (error && /visitor_ip_hash|embed_session_id|custom_product_id/.test(error.message || '')) {
        ({ data: row, error } = await supabase.from('vendor_embed_designs')
            .select('id, embed_instance_id, manufacturer_id, prototype_asset_id, reference_sources, prompt, ai_generated_image_url, generation_seed, referrer_host, billing_type, points_charged, created_at')
            .eq('id', id).maybeSingle());
    }
    if (error) {
        if (error.code === '42P01') return { error: 'not_found' };
        throw error;
    }
    if (!row || !row.ai_generated_image_url) return { error: 'not_found' };

    const audience = opts.audience || 'owner';
    if (audience === 'owner') {
        const ok = await manufacturerOwnedByUser(supabase, row.manufacturer_id, opts.request_user_id);
        if (!ok) return { error: 'forbidden' };
    }

    const refs = parseReferenceSourcesList(row.reference_sources).map(function (s) {
        return normalizeReferenceEntry(s, opts);
    });

    let mfrName = '';
    if (row.manufacturer_id) {
        const { data: mfr } = await supabase.from('manufacturers').select('company_name, user_id').eq('id', row.manufacturer_id).maybeSingle();
        mfrName = mfr && mfr.company_name ? mfr.company_name : '';
    }

    const resume = {
        export_version: EXPORT_VERSION,
        record_id: row.id,
        asset_kind: 'embed_visitor',
        source_table: 'vendor_embed_designs',
        title: 'Embed 訪客生圖',
        image: {
            output_url: row.ai_generated_image_url,
            reference_urls: refs.map(function (r) { return r.image_url; }).filter(Boolean)
        },
        prompts: {
            user_prompt: row.prompt || null,
            final_prompt: row.prompt || null,
            composed_prompt: null,
            composed_prompt_note: '系統未保存完整模型 prompt',
            seed: row.generation_seed != null ? row.generation_seed : null
        },
        taxonomy: {},
        references: refs,
        generation_context: {
            entry_surface: 'embed_visitor',
            entry_surface_label: ENTRY_SURFACE_ZH.embed_visitor,
            embed_instance_id: row.embed_instance_id || null,
            prototype_asset_id: row.prototype_asset_id || null,
            referrer_host: row.referrer_host || null
        },
        billing: {
            points_charged: row.points_charged != null ? row.points_charged : null,
            billing_type: row.billing_type || null,
            credit_transaction_id: null
        },
        provenance_links: {
            custom_product_id: row.custom_product_id || null
        },
        timestamps: {
            created_at: row.created_at || null,
            completed_at: row.created_at || null,
            exported_at: new Date().toISOString()
        },
        actor: {
            display_name: audience === 'admin' ? undefined : '廠商 Embed 紀錄'
        },
        platform: buildPlatformBlock()
    };

    if (audience === 'admin') {
        resume.actor = {
            manufacturer_id: row.manufacturer_id,
            manufacturer_name: mfrName || null
        };
        resume._internal = {
            visitor_ip_hash: row.visitor_ip_hash || null,
            embed_session_id: row.embed_session_id || null,
            custom_product_id: row.custom_product_id || null
        };
    }

    return { resume: resume };
}

/**
 * @param {object} supabase
 * @param {{ kind: string, id: string, audience?: 'owner'|'admin', request_user_id?: string, baseUrl?: string }} opts
 */
async function buildProvenanceResume(supabase, opts) {
    const kind = String(opts && opts.kind || '').trim();
    const id = String(opts && opts.id || '').trim();
    if (!ASSET_KINDS.has(kind)) return { error: 'invalid_kind' };
    if (!id) return { error: 'missing_id' };

    if (kind === 'user_design') return buildUserDesignResume(supabase, id, opts);
    if (kind === 'promo_scene') return buildPromoSceneResume(supabase, id, opts);
    if (kind === 'material_combo') return buildMaterialComboResume(supabase, id, opts);
    if (kind === 'print') return buildPrintResume(supabase, id, opts);
    if (kind === 'embed_visitor') return buildEmbedVisitorResume(supabase, id, opts);
    return { error: 'not_implemented', message: '此類型履歷尚未支援' };
}

function mapGenerationRecordSourceToKind(source) {
    const s = String(source || '').trim();
    if (s === 'site') return 'user_design';
    if (s === 'promo' || s === 'promo_camera' || s === 'promo_camera_web' || s === 'promo_camera_app') return 'promo_scene';
    if (s === 'embed') return 'embed_visitor';
    return null;
}

function safeExportBasename(resume) {
    const kind = resume && resume.asset_kind ? resume.asset_kind : 'resume';
    const id = resume && resume.record_id ? String(resume.record_id).slice(0, 8) : 'unknown';
    const d = new Date().toISOString().slice(0, 10);
    return 'MatchDO-履歷-' + kind + '-' + d + '-' + id;
}

module.exports = {
    EXPORT_VERSION,
    ASSET_KINDS,
    ENTRY_SURFACE_ZH,
    REF_KIND_ZH,
    DISCLAIMER_ZH,
    parseReferenceSourcesList,
    buildProvenanceResume,
    mapGenerationRecordSourceToKind,
    safeExportBasename,
    formatCameraParamsResolved
};
