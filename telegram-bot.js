const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
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

const BOT_TOKEN = "7616976997:AAFwMuLdqlQE48hYj3E-yFXxvIpeGvwaEro";
if (!BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN env var before running the bot.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function loadCfg() { return readJSON(CONFIG_FILE) || {}; }
function loadData() { return readJSON(DATA_FILE) || { items: [] }; }

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Skyzopedia admin bot ready. Commands:\n/settitle Your title\n/setdesc Your description\n/setbanner https://...\n/additem title|summary|content\n/delitem item_id\n/listitems\n/settoken newtoken\n/setowner telegram_id');
});

bot.onText(/\/settitle\s+(.+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  cfg.title = match[1].trim(); writeJSON(CONFIG_FILE, cfg);
  bot.sendMessage(msg.chat.id, 'Title updated.');
});

bot.onText(/\/setdesc\s+([\s\S]+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  cfg.description = match[1].trim(); writeJSON(CONFIG_FILE, cfg);
  bot.sendMessage(msg.chat.id, 'Description updated.');
});

bot.onText(/\/setbanner\s+(https?:\/\/\S+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  cfg.bannerUrl = match[1]; writeJSON(CONFIG_FILE, cfg);
  bot.sendMessage(msg.chat.id, 'Banner updated.');
});

bot.onText(/\/settoken\s+(\S+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  cfg.adminToken = match[1]; writeJSON(CONFIG_FILE, cfg);
  bot.sendMessage(msg.chat.id, 'Admin token updated.');
});

bot.onText(/\/additem\s+([\s\S]+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  const parts = match[1].split('|').map(s => s.trim());
  const title = parts[0];
  const summary = parts[1] || '';
  const content = parts[2] || '';
  if (!title) return bot.sendMessage(msg.chat.id, 'Usage: /additem title|summary|content');
  const data = loadData();
  const id = 'item_' + nanoid(8);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'');
  const item = { id, title, slug, summary, content, createdAt: new Date().toISOString() };
  data.items.unshift(item); writeJSON(DATA_FILE, data);
  bot.sendMessage(msg.chat.id, `Item added: ${item.id} — ${item.title}`);
});

bot.onText(/\/delitem\s+(\S+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  const id = match[1];
  const data = loadData();
  const idx = data.items.findIndex(x => x.id === id);
  if (idx === -1) return bot.sendMessage(msg.chat.id, 'Item not found');
  const removed = data.items.splice(idx,1); writeJSON(DATA_FILE, data);
  bot.sendMessage(msg.chat.id, `Removed ${removed[0].id}`);
});

bot.onText(/\/listitems/, (msg) => {
  const data = loadData();
  const list = data.items.slice(0,20).map(i => `${i.id} — ${i.title}`).join('\n') || 'No items';
  bot.sendMessage(msg.chat.id, `Items:\n${list}`);
});

bot.onText(/\/setowner\s+(\d+)/, (msg, match) => {
  const cfg = loadCfg();
  if (cfg.ownerTelegramId && cfg.ownerTelegramId !== msg.from.id) return bot.sendMessage(msg.chat.id, 'Unauthorized');
  cfg.ownerTelegramId = parseInt(match[1]); writeJSON(CONFIG_FILE, cfg);
  bot.sendMessage(msg.chat.id, `ownerTelegramId set to ${cfg.ownerTelegramId}`);
});