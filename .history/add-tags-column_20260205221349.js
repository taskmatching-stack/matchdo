require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
});

async function addTagsColumn() {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    try {
        console.log('Adding tags column to projects table...');
        await client.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT \'[]\'::jsonb;');
        console.log('Success!');
    } catch (e) {
        console.error('Error adding column:', e);
    } finally {
        client.release();
        pool.end();
    }
}

addTagsColumn();
