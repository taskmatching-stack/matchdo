'use strict';

const mlf = require('../lib/manufacturer-list-filters');

const rows = [
    { id: '1', name: '乙廠', rating: 4.5, contact_json: { service_area: ['tw-tpe'] } },
    { id: '2', name: '甲廠', rating: 5, contact_json: { service_area: 'tw-tpe,tw-tao' } },
    { id: '3', name: '丙廠', rating: 3, location: 'tw-kin' }
];

const areas = mlf.parseServiceAreaCodesFromQuery({ query: { service_area: 'tw-tpe,tw-kin' } });
if (areas.length !== 2 || areas[0] !== 'tw-tpe') throw new Error('parseServiceAreaCodesFromQuery');

const paged = mlf.paginateManufacturerRows(rows, 1, 2, 'name', ['tw-tpe']);
if (paged.total !== 2) throw new Error('area filter total expected 2 got ' + paged.total);
if (paged.pageRows.length !== 2) throw new Error('name sort page size');
const names = paged.pageRows.map(function (r) { return r.name; }).sort().join('|');
if (names !== '乙廠|甲廠') throw new Error('name sort set got ' + names);

const p2 = mlf.paginateManufacturerRows(rows, 2, 2, 'rating', []);
if (p2.pageRows[0].id !== '3') throw new Error('rating sort page 2');

console.log('test-manufacturer-list-filters: ok');
