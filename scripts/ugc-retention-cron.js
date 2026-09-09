#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const ugcRetention = require('../lib/ugc-retention');

async function main() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }
    const supabase = createClient(url, key);
    const stats = await ugcRetention.runRetentionSweep(supabase);
    console.log(JSON.stringify({
        ok: true,
        at: new Date().toISOString(),
        stats
    }, null, 2));
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
