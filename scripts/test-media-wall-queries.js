'use strict';

const assert = require('assert');
const mw = require('../lib/media-wall-queries');

assert.strictEqual(mw.isSupabaseMissingColumnError({ code: '42703', message: 'column title_en does not exist' }, 'title_en'), true);
assert.strictEqual(mw.isSupabaseMissingColumnError({ code: '42703', message: 'column title_en does not exist' }, 'show_on_homepage'), false);
assert.strictEqual(mw.isSupabaseMissingColumnError({ code: '42703', message: 'column show_on_homepage does not exist' }, 'show_on_homepage'), true);

const sorted = mw.sortMediaWallItemsByCreatedAtDesc([
    { id: 'a', created_at: '2024-01-01T00:00:00Z' },
    { id: 'b', created_at: '2025-06-01T00:00:00Z' },
    { id: 'c', created_at: '2023-01-01T00:00:00Z' }
]);
assert.deepStrictEqual(sorted.map((x) => x.id), ['b', 'a', 'c']);

const srcMap = {
    p1: { id: 'p1', category: 'bags', subcategory_key: 'tote' },
    p2: { id: 'p2', category: 'shoes', subcategory_key: 'sneaker' }
};
const filtered = mw.filterPromoRowsBySourceCategory(
    [{ source_id: 'p1' }, { source_id: 'p2' }, { source_id: 'p1' }],
    srcMap,
    ['bags'],
    'tote'
);
assert.strictEqual(filtered.length, 2);

assert.ok(mw.CUSTOM_PRODUCT_MEDIA_WALL_SELECT.includes('show_on_homepage'));
assert.ok(mw.CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN.includes('show_on_homepage'));
assert.ok(!mw.CUSTOM_PRODUCT_MEDIA_WALL_SELECT_NO_TITLE_EN.includes('title_en'));

console.log('test-media-wall-queries: ok');
