const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { project_id, items } = req.body;

        if (!project_id || !items || !Array.isArray(items)) {
            return res.status(400).json({ error: '缺少必要參數' });
        }

        // 先刪除該專案的舊項目
        await supabase
            .from('project_items')
            .delete()
            .eq('project_id', project_id);

        // 插入新項目
        const itemsToInsert = items.map(item => ({
            project_id,
            item_name: item.item_name,
            spec: item.spec || null,
            quantity: item.quantity || null,
            unit: item.unit || null,
            status: 'draft'
        }));

        const { error: insertError } = await supabase
            .from('project_items')
            .insert(itemsToInsert);

        if (insertError) throw insertError;

        res.json({ success: true });

    } catch (error) {
        console.error('❌ 更新項目失敗:', error);
        res.status(500).json({ 
            error: '更新項目失敗', 
            details: error.message 
        });
    }
};
