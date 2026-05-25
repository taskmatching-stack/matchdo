'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');

/** 白名單：僅允許執行此清單內的 migration（不可貼任意 SQL） */
const MIGRATIONS = [
    {
        id: 'digital-prototype-ai-tags',
        title: '廠商素材／作品集 AI 標籤欄位',
        description: 'vendor_assets、manufacturer_portfolio 新增 ai_tags、image_semantics_json 等（§6 T0-1）',
        files: ['add-digital-prototype-ai-tags.sql'],
        check: async (client) => columnExists(client, 'vendor_assets', 'ai_tags')
    },
    {
        id: 'custom-products-semantics',
        title: '訂製品語意欄位',
        description: 'custom_products 新增 prompt_semantics_json、image_semantics_json、ai_tags（§6 T0-2）',
        files: ['add-custom-products-semantics.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'ai_tags')
    },
    {
        id: 'visual-semantics-events',
        title: '視覺語意事件表',
        description: '建立 visual_semantics_events 供搜尋與趨勢累積（§6 T0-3）',
        files: ['add-visual-semantics-events.sql'],
        check: async (client) => tableExists(client, 'visual_semantics_events')
    },
    {
        id: 'vendor-asset-kind',
        title: '數位版型 asset_kind（原型／材料）',
        description: 'vendor_assets 新增 asset_kind：prototype | material',
        files: ['add-vendor-asset-kind.sql'],
        check: async (client) => columnExists(client, 'vendor_assets', 'asset_kind')
    },
    {
        id: 'visual-semantics-all',
        title: '視覺語意庫（一次執行三項）',
        description: '依序執行上述三個 migration；新環境建議用此項',
        files: [
            'add-digital-prototype-ai-tags.sql',
            'add-custom-products-semantics.sql',
            'add-visual-semantics-events.sql'
        ],
        check: async (client) => {
            const a = await columnExists(client, 'vendor_assets', 'ai_tags');
            const b = await columnExists(client, 'custom_products', 'ai_tags');
            const c = await tableExists(client, 'visual_semantics_events');
            return a && b && c;
        }
    }
];

async function columnExists(client, tableName, columnName) {
    const r = await client.query(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        ) AS ok`,
        [tableName, columnName]
    );
    return !!r.rows[0]?.ok;
}

async function tableExists(client, tableName) {
    const r = await client.query(
        `SELECT to_regclass($1) IS NOT NULL AS ok`,
        [`public.${tableName}`]
    );
    return !!r.rows[0]?.ok;
}

function stripSqlComments(sql) {
    return String(sql)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n');
}

function splitSqlStatements(sql) {
    const cleaned = stripSqlComments(sql);
    return cleaned
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function readMigrationSql(filename) {
    const full = path.join(DOCS_DIR, filename);
    if (!fs.existsSync(full)) throw new Error('找不到 migration 檔案：' + filename);
    const raw = fs.readFileSync(full, 'utf8');
    return splitSqlStatements(raw);
}

async function runMigrationById(id, client) {
    const def = MIGRATIONS.find((m) => m.id === id);
    if (!def) throw new Error('未知的 migration：' + id);
    const executed = [];
    for (const file of def.files) {
        const statements = readMigrationSql(file);
        for (const stmt of statements) {
            await client.query(stmt);
        }
        executed.push(file);
    }
    const applied = def.check ? await def.check(client) : true;
    return { id: def.id, title: def.title, files: executed, verified: applied };
}

async function getMigrationStatuses(client) {
    const list = [];
    for (const def of MIGRATIONS) {
        let applied = false;
        try {
            applied = def.check ? await def.check(client) : false;
        } catch (e) {
            applied = false;
        }
        list.push({
            id: def.id,
            title: def.title,
            description: def.description,
            files: def.files,
            applied,
            bundle: def.files.length > 1
        });
    }
    return list;
}

module.exports = {
    MIGRATIONS,
    getMigrationStatuses,
    runMigrationById
};
