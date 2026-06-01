#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const knowledgeDir = path.join(root, 'public', 'service', 'knowledge');
const cacheDir = path.join(root, 'public', 'service', 'cache');
const outDir = path.join(root, 'public', 'service', 'index');
const outFile = path.join(outDir, 'service-search-index.json');

export function normalizeArabic(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return [...new Set(normalizeArabic(value).split(' ').filter(t => t.length > 1).slice(0, 120))];
}

async function walkJson(dir) {
  const out = [];
  async function walk(current) {
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function safeArray(v) { return Array.isArray(v) ? v : []; }
function hashId(text) { return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16); }

function articleFromTopic(topic, parent = {}, file = '') {
  const brand = parent.brand || parent.app || parent.name || '';
  const nameAr = parent.nameAr || '';
  const category = topic.category || parent.category || 'knowledge';
  const id = topic.id || `${category}-${hashId((brand || '') + '|' + (topic.title || ''))}`;
  const title = topic.title || parent.title || brand || id;
  const summary = topic.summary || parent.summary || '';
  const steps = safeArray(topic.steps);
  const keywords = [...safeArray(parent.aliases), ...safeArray(topic.keywords), brand, nameAr, topic.intent || '', category];
  const text = [title, summary, steps.join(' '), keywords.join(' '), safeArray(parent.knownModels).join(' '), safeArray(parent.modelFamilies).join(' '), safeArray(parent.possibleOperatingSystems).join(' '), safeArray(parent.operatingSystems).join(' ')].join(' ');
  return {
    id,
    title,
    summary,
    steps,
    category,
    intent: topic.intent || parent.intent || '',
    brand,
    nameAr,
    deviceType: parent.category || category,
    operatingSystems: safeArray(parent.possibleOperatingSystems).concat(safeArray(parent.operatingSystems)).concat(topic.os ? [topic.os] : []),
    appStore: parent.appStore || topic.appStore || '',
    knownModels: safeArray(parent.knownModels).concat(safeArray(parent.modelFamilies)),
    keywords: [...new Set(keywords.filter(Boolean).map(String))].slice(0, 80),
    tokens: tokenize(text),
    normalizedText: normalizeArabic(text),
    safe: topic.safe !== false,
    needsModelWhen: safeArray(topic.needsModelWhen),
    whenToCallTechnician: safeArray(topic.whenToCallTechnician),
    sources: safeArray(topic.sources || parent.sources),
    sourceFile: path.relative(root, file).replace(/\\/g, '/'),
    updatedAt: new Date().toISOString()
  };
}

function flattenKnowledge(json, file) {
  const articles = [];
  const items = safeArray(json.items);
  for (const item of items) {
    if (Array.isArray(item.topics) && item.topics.length) {
      for (const topic of item.topics) articles.push(articleFromTopic(topic, item, file));
    } else if (item.title || item.intent || item.id) {
      articles.push(articleFromTopic(item, {}, file));
    }
  }
  return articles;
}

export async function buildServiceKnowledgeIndex() {
  const files = await walkJson(knowledgeDir);
  const articles = [];
  const dictionaries = { aliases: [], intents: [], models: [], osSystems: [] };
  for (const file of files) {
    const json = JSON.parse(await readFile(file, 'utf8'));
    articles.push(...flattenKnowledge(json, file));
    const rel = path.relative(knowledgeDir, file).replace(/\\/g, '/');
    if (rel.includes('/aliases/') || rel.startsWith('aliases/')) dictionaries.aliases.push(...safeArray(json.items));
    if (rel.includes('/intents/') || rel.startsWith('intents/')) dictionaries.intents.push(...safeArray(json.items));
    if (rel.includes('/device-models/') || rel.startsWith('device-models/')) dictionaries.models.push(...safeArray(json.items));
    if (rel.includes('/os-systems/') || rel.startsWith('os-systems/')) dictionaries.osSystems.push(...safeArray(json.items));
  }

  let approved = { items: [] };
  try { approved = JSON.parse(await readFile(path.join(cacheDir, 'approved-answers.json'), 'utf8')); } catch {}
  for (const item of safeArray(approved.items)) {
    articles.push(articleFromTopic({
      id: item.id || `approved-${hashId(item.question || item.title || '')}`,
      title: item.title || item.question,
      summary: item.summary || item.answer,
      steps: item.steps || (item.answer ? String(item.answer).split(/\n+/).filter(Boolean) : []),
      keywords: item.keywords || [item.question, item.deviceBrand, item.intent],
      intent: item.intent || 'approved_answer',
      category: 'approved-answer',
      safe: item.safe !== false,
      sources: ['approved-answer-cache']
    }, { brand: item.deviceBrand || '', nameAr: item.nameAr || '', category: item.deviceType || 'approved-answer' }, path.join(cacheDir, 'approved-answers.json')));
  }

  const unique = new Map();
  for (const article of articles) {
    if (!article.title || !article.steps.length && !article.summary) continue;
    unique.set(article.id, article);
  }
  const finalArticles = [...unique.values()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'ar'));
  const categoryCounts = finalArticles.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {});
  const brandCounts = finalArticles.reduce((acc, a) => { if (a.brand) acc[a.brand] = (acc[a.brand] || 0) + 1; return acc; }, {});
  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: 'internal-knowledge-first',
    region: 'Jordan / Middle East',
    aiPolicy: 'AI is used only when internal knowledge and approved cache cannot answer confidently.',
    safetyPolicy: 'No illegal decryption, piracy, unsafe electrical repair, or unverified firmware instructions.',
    count: finalArticles.length,
    categoryCounts,
    brandCounts,
    dictionaries,
    articles: finalArticles
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildServiceKnowledgeIndex().then(out => console.log(JSON.stringify({ ok: true, count: out.count, file: 'public/service/index/service-search-index.json' }, null, 2))).catch(error => { console.error(error); process.exit(1); });
}
