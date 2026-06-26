
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
const pool = new Pool({ connectionString });

async function reloadSchema() {
    console.log('Reloading Supabase Schema Cache...');
    const client = await pool.connect();
    try {
        // Force schema cache reload by notifying PostgREST
        await client.query('NOTIFY pgrst, "reload schema";');
        console.log('✅ NOTIFY pgrst sent.');
        
        // Also verify if 'analysis' column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'analysis';
        `);
        
        if (res.rows.length > 0) {
            console.log('✅ Column "analysis" exists in table "projects".');
        } else {
            console.log('⚠️ Column "analysis" does NOT exist. Creating it now...');
            await client.query(`
                ALTER TABLE projects 
                ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT '{}'::jsonb;
            `);
            console.log('✅ Column "analysis" created.');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

reloadSchema();
