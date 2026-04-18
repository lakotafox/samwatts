// Netlify serverless function — receives edited index.html from the admin editor
// and commits it to the GitHub repo. Netlify's GitHub integration then auto-rebuilds.
//
// Env vars (set in Netlify dashboard → Site settings → Environment variables):
//   GITHUB_TOKEN   — fine-grained PAT with Contents: write on lakotafox/samwatts
//   GITHUB_OWNER   — lakotafox          (defaults to this)
//   GITHUB_REPO    — samwatts           (defaults to this)
//   GITHUB_BRANCH  — main               (defaults to this)
//   ADMIN_PASSWORD — shared secret sent from the admin UI as X-Admin-Password

const DEFAULTS = {
  owner:  process.env.GITHUB_OWNER  || 'lakotafox',
  repo:   process.env.GITHUB_REPO   || 'samwatts',
  branch: process.env.GITHUB_BRANCH || 'main',
};

const ALLOWED_PATHS = /^(index\.html|dashboard\.html|assets\/published\/.+|media-browser\/index\.json)$/;

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' }) };

  // simple shared-secret auth (the same password the admin's login form uses)
  const need = process.env.ADMIN_PASSWORD;
  const got  = event.headers['x-admin-password'] || event.headers['X-Admin-Password'];
  if (need && need !== got) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'bad admin password' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const files   = Array.isArray(body.files) ? body.files : [];
  const message = String(body.message || 'editor: publish from admin').slice(0, 200);
  if (!files.length) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'no files to publish' }) };

  for (const f of files) {
    const hasText = typeof f.content === 'string';
    const hasBin  = typeof f.contentB64 === 'string';
    if (!f.path || (!hasText && !hasBin)) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'each file needs {path, content|contentB64}' }) };
    if (!ALLOWED_PATHS.test(f.path))      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: `path not allowed: ${f.path}` }) };
  }

  const gh = async (path, init = {}) => {
    const r = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        'Authorization':       `Bearer ${token}`,
        'Accept':              'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28',
        ...(init.headers || {}),
      },
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${data.message || text}`);
    return data;
  };

  try {
    const { owner, repo, branch } = DEFAULTS;
    const results = [];
    for (const f of files) {
      // fetch current sha if file exists
      let sha;
      try {
        const cur = await gh(`/repos/${owner}/${repo}/contents/${f.path}?ref=${branch}`);
        sha = cur.sha;
      } catch (_) { /* new file */ }
      const contentB64 = f.contentB64 || Buffer.from(f.content, 'utf-8').toString('base64');
      const put = await gh(`/repos/${owner}/${repo}/contents/${f.path}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: contentB64, branch, ...(sha ? { sha } : {}) }),
      });
      results.push({ path: f.path, commit: put.commit?.sha?.slice(0, 7) });
    }
    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, results }) };
  } catch (e) {
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
