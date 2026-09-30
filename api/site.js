const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'site-images';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return getPublic(req, res);
  if (req.method === 'POST') return postAdmin(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};

async function getPublic(req, res) {
  const key = req.headers['x-admin-key'];
  const isAdmin = key && key === process.env.ADMIN_KEY;

  let q = supabase.from('site_projects').select('*').order('sort_order', { ascending: true });
  if (!isAdmin) q = q.eq('status', 'live');

  const [content, projects, meta] = await Promise.all([
    supabase.from('site_content').select('key, value'),
    q,
    supabase.from('site_meta').select('key, value')
  ]);

  if (content.error || projects.error || meta.error) {
    return res.status(500).json({
      error: content.error?.message || projects.error?.message || meta.error?.message
    });
  }

  const contentMap = {};
  (content.data || []).forEach(r => { contentMap[r.key] = r.value; });
  const metaMap = {};
  (meta.data || []).forEach(r => { metaMap[r.key] = r.value; });

  const all = projects.data || [];
  return res.status(200).json({
    content: contentMap,
    projects: all.filter(p => p.type !== 'drone'),
    drone: all.filter(p => p.type === 'drone'),
    meta: metaMap
  });
}

async function postAdmin(req, res) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    switch (action) {
      case 'save_content': {
        const { key: k, value } = body;
        if (!k) return res.status(400).json({ error: 'Missing key' });
        const { error } = await supabase.from('site_content')
          .upsert({ key: k, value, updated_at: new Date().toISOString() });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'save_meta': {
        const { key: k, value } = body;
        if (!k) return res.status(400).json({ error: 'Missing key' });
        const { error } = await supabase.from('site_meta')
          .upsert({ key: k, value: value ?? '', updated_at: new Date().toISOString() });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'create_project': {
        const p = body.project || {};
        const { data, error } = await supabase.from('site_projects')
          .insert({
            title: p.title || 'Untitled',
            description: p.description || '',
            images: p.images || [],
            video_url: p.video_url || null,
            poster_url: p.poster_url || null,
            live_url: p.live_url || '',
            status: p.status || 'draft',
            type: p.type || 'software',
            sort_order: typeof p.sort_order === 'number' ? p.sort_order : Date.now()
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ ok: true, project: data });
      }

      case 'update_project': {
        const p = body.project || {};
        if (!p.id) return res.status(400).json({ error: 'Missing id' });
        const { id, ...rest } = p;
        const { error } = await supabase.from('site_projects')
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'delete_project': {
        if (!body.id) return res.status(400).json({ error: 'Missing id' });
        const { error } = await supabase.from('site_projects').delete().eq('id', body.id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'reorder_projects': {
        const order = body.order || [];
        await Promise.all(order.map(o =>
          supabase.from('site_projects').update({ sort_order: o.sort_order }).eq('id', o.id)
        ));
        return res.status(200).json({ ok: true });
      }

      case 'sign_upload': {
        const { filename, folder } = body;
        const safe = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${folder || 'uploads'}/${Date.now()}-${safe}`;
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) throw error;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return res.status(200).json({
          ok: true,
          signedUrl: data.signedUrl,
          path,
          publicUrl: pub.publicUrl
        });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}

module.exports.config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};
