import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');

const FILES = [
  path.join(WC_DIR, 'broadcasts.json'),
  path.join(WC_DIR, 'broadcast-source.json'),
  path.join(WC_DIR, 'broadcast-observed.json')
];

function normalizeArabicText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOfChannel(channel = {}) {
  return normalizeArabicText([
    channel.name_ar,
    channel.name_en,
    channel.name,
    channel.title
  ].filter(Boolean).join(' '));
}

function isPendingStatus(channel = {}) {
  const status = normalizeArabicText(channel.status || '');
  return /pending|to be confirmed|tbc|غير مؤكد|بانتظار|انتظار|لم يؤكد|سيتم|قيد/.test(status);
}

function classifyBeinChannel(channel = {}) {
  const text = textOfChannel(channel);
  if (!text) return 'other';

  const isBein = /(?:^|\s)(?:bein\s+sports?|بي\s*ان\s*سبورت|بي\s*إن\s*سبورت)(?:\s|$)/i.test(text);
  if (!isBein) return 'other';

  if (/(connect|كونكت|news|اخباريه|الاخباريه|الاخبارية|باقات|الباقات|باقة|باقه|package)/i.test(text)) {
    return 'blocked';
  }

  if (/(4k|4\s*كي|فور\s*كي|فوركي|uhd|hdr)/i.test(text)) {
    return 'bein-4k';
  }

  const max = text.match(/(?:max|ماكس)\s*([0-9])?/i);
  if (max) {
    const number = String(max[1] || '').trim();
    if (number === '1') return 'bein-max-1';
    if (number === '2') return 'bein-max-2';
    // Generic MAX or MAX 3-6 are not exact match channels for this compact display.
    return 'blocked';
  }

  // MaenSat rule requested by owner:
  // plain "beIN Sport" / "beIN Sports" / "beIN Sport FTA" means the free beIN channel.
  if (/(free|free\s*to\s*air|fta|مفتوح|المفتوحه|المفتوحة|مجاني|مجانيه|المجانيه|المجانية)/i.test(text)) {
    return 'bein-free';
  }

  return 'bein-free';
}

function normalizeBeinChannel(channel = {}) {
  const kind = classifyBeinChannel(channel);
  const base = { ...channel };

  if (kind === 'other') return channel;
  if (kind === 'blocked') return null;

  if (kind === 'bein-free') {
    return {
      ...base,
      name_ar: 'beIN SPORTS المفتوحة',
      name_en: 'beIN SPORTS Free-to-air',
      type: 'free',
      status: 'confirmed',
      note_ar: base.note_ar || 'قاعدة MaenSat: beIN Sport / beIN Sports / beIN Sport FTA تعني beIN SPORTS المفتوحة المجانية عند ظهورها كقناة للمباراة نفسها.'
    };
  }

  if (kind === 'bein-max-1') {
    return { ...base, name_ar: 'beIN SPORTS MAX 1', name_en: 'beIN SPORTS MAX 1', type: 'encrypted', status: 'confirmed' };
  }

  if (kind === 'bein-max-2') {
    return { ...base, name_ar: 'beIN SPORTS MAX 2', name_en: 'beIN SPORTS MAX 2', type: 'encrypted', status: 'confirmed' };
  }

  if (kind === 'bein-4k') {
    return { ...base, name_ar: 'beIN SPORTS 4K', name_en: 'beIN SPORTS 4K', type: 'encrypted', status: 'confirmed' };
  }

  return channel;
}

function channelKey(channel = {}) {
  const normalized = normalizeBeinChannel(channel) || channel;
  const kind = classifyBeinChannel(normalized);
  if (kind !== 'other' && kind !== 'blocked') return kind;
  return normalizeArabicText([normalized.name_en, normalized.name_ar, normalized.type].filter(Boolean).join(' '));
}

function cleanChannels(channels = [], { defaultChannels = false } = {}) {
  if (defaultChannels) return [];

  const out = [];
  for (const raw of Array.isArray(channels) ? channels : []) {
    const normalized = normalizeBeinChannel(raw);
    if (!normalized) continue;

    const kind = classifyBeinChannel(normalized);

    // Avoid the ugly "pending / not confirmed" display, but without a blind confirmed-only filter:
    // recognizable beIN match channels are normalized and confirmed; non-beIN channels remain only if not pending.
    if (kind === 'other' && isPendingStatus(normalized)) continue;

    const key = channelKey(normalized);
    const index = out.findIndex(item => channelKey(item) === key);
    if (index >= 0) out[index] = { ...out[index], ...normalized };
    else out.push(normalized);
  }
  return out;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function cleanBroadcastFile(data = {}, file = '') {
  const out = JSON.parse(JSON.stringify(data || {}));

  out.metadata ||= {};
  out.metadata.safe_display_cleanup = true;
  out.metadata.safe_display_cleanup_ar = 'تنظيف آمن: لا تُعرض default_channels كقنوات مباراة، وbeIN Sport / beIN Sport FTA تُعامل كـ beIN SPORTS المفتوحة المجانية عندما تكون داخل قنوات المباراة نفسها.';
  out.metadata.safe_display_cleanup_last_run_at = new Date().toISOString();

  // The main broadcasts.json used to include default fallback channels. These caused pending/not-confirmed labels.
  if (Array.isArray(out.default_channels)) {
    out.default_channels = cleanChannels(out.default_channels, { defaultChannels: file.endsWith('broadcasts.json') });
  }

  out.matches ||= {};
  for (const [matchId, entry] of Object.entries(out.matches)) {
    if (!entry || typeof entry !== 'object') continue;
    if (Array.isArray(entry.channels)) {
      entry.channels = cleanChannels(entry.channels);
    }
  }

  return out;
}

let changed = 0;
for (const file of FILES) {
  const data = await readJson(file);
  if (!data) continue;
  const cleaned = cleanBroadcastFile(data, file);
  await writeJson(file, cleaned);
  console.log(`[worldcup-broadcast-safe] cleaned ${path.relative(ROOT, file)}`);
  changed += 1;
}

if (!changed) {
  console.warn('[worldcup-broadcast-safe] no broadcast JSON files were found. Run this from the repository root.');
}
