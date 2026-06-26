const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    console.log('Checking projects table...');
    
    // Try to insert a dummy record to see if it works
    try {
        const { data, error } = await supabase
            .from('projects')
            .insert({ 
                title: 'Test Project', 
                description: 'Test Description', 
                status: 'open',
                tags: [] 
            })
            .select();

        if (error) {
            console.error('Insert failed:', error);
        } else {
            console.log('Insert successful:', data);
            // clean up
            await supabase.from('projects').delete().eq('id', data[0].id);
        }
    } catch (e) {
        console.error('Exception during insert:', e);
    }
}

checkSchema();
