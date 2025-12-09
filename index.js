const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE = path.join(__dirname, 'data.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Read config dynamically on each request (so bot changes take effect immediately)
function getConfig() { return readJSON(CONFIG_FILE) || {}; }
function getData() { return readJSON(DATA_FILE) || { items: [] }; }

// Public site landing page
app.get('/', (req, res) => {
  const cfg = getConfig();
  const data = getData();
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${cfg.title || 'API Site'}</title>
    <style>
      :root{--bg:#0f1724;--card:#111827;--muted:#9ca3af;--accent:#7c3aed;color-scheme:dark}
      body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial;background:linear-gradient(180deg,#020617, #071133);color:#e6eef8}
      .wrap{max-width:1000px;margin:32px auto;padding:18px}
      header{display:flex;gap:16px;align-items:center}
      header img{height:72px;border-radius:8px}
      h1{margin:0;font-size:26px}
      .desc{color:var(--muted);margin-top:6px}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:18px}
      .card{background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;box-shadow:0 6px 18px rgba(2,6,23,0.6)}
      a.item{color:inherit;text-decoration:none}
      footer{margin-top:24px;color:var(--muted);font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <img src="${cfg.bannerUrl}" alt="banner" />
        <div>
          <h1>${cfg.title}</h1>
          <div class="desc">${cfg.description}</div>
        </div>
      </header>

      <section class="grid">
        ${data.items.map(i => `
          <article class="card">
            <a class="item" href="/item/${i.slug}">
              <h3>${i.title}</h3>
              <p style="color:var(--muted)">${i.summary}</p>
            </a>
          </article>
        `).join('')}
      </section>

      <footer>
        <div>API endpoint: <code>/api/items</code> — Admin token required for write operations.</div>
      </footer>
    </div>
  </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Item detail page (simple rendering)
app.get('/item/:slug', (req, res) => {
  const cfg = getConfig();
  const data = getData();
  const item = data.items.find(x => x.slug === req.params.slug);
  if (!item) return res.status(404).send('Not found');
  const html = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width'><title>${item.title}</title></head><body style="background:#0b1220;color:#fff;font-family:system-ui;padding:20px"><a href="/">← Back</a><h1>${item.title}</h1><small>${new Date(item.createdAt).toLocaleString()}</small><div style="margin-top:18px">${item.content}</div></body></html>`;
  res.send(html);
});

// --- REST API ---
app.get('/api', (req, res) => res.json({ ok: true, title: getConfig().title }));
app.get('/api/items', (req, res) => res.json({ ok: true, items: getData().items }));
app.get('/api/items/:id', (req, res) => {
  const item = getData().items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, item });
});

// Middleware to check admin token
function requireAdmin(req, res, next) {
  const cfg = getConfig();
  const token = req.headers['x-admin-token'] || req.query.adminToken || req.body.adminToken;
  if (!token || token !== cfg.adminToken) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

// Add item
app.post('/api/items', requireAdmin, (req, res) => {
  const data = getData();
  const { title, summary, content, slug } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: 'Missing title' });
  const id = 'item_' + nanoid(8);
  const newItem = { id, title, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), summary: summary||'', content: content||'', createdAt: new Date().toISOString() };
  data.items.unshift(newItem);
  writeJSON(DATA_FILE, data);
  res.json({ ok: true, item: newItem });
});

// Update item
app.put('/api/items/:id', requireAdmin, (req, res) => {
  const data = getData();
  const item = data.items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  Object.assign(item, req.body);
  writeJSON(DATA_FILE, data);
  res.json({ ok: true, item });
});

// Delete item
app.delete('/api/items/:id', requireAdmin, (req, res) => {
  const data = getData();
  const idx = data.items.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const removed = data.items.splice(idx, 1);
  writeJSON(DATA_FILE, data);
  res.json({ ok: true, removed: removed[0] });
});

// Update config (title, description, bannerUrl, adminToken)
app.put('/api/config', requireAdmin, (req, res) => {
  const cfg = getConfig();
  const allowed = ['title','description','bannerUrl','adminToken','ownerTelegramId'];
  for (const k of allowed) if (k in req.body) cfg[k] = req.body[k];
  writeJSON(CONFIG_FILE, cfg);
  res.json({ ok: true, config: cfg });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));