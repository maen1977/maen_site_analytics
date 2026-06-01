#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

function normalizeArabic(value = '') {
  return String(value ?? '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, ' ').replace(/\s+/g, ' ').trim();
}
function score(q, a) {
  const tokens = normalizeArabic(q).split(' ').filter(t => t.length > 1);
  let s = 0;
  for (const t of tokens) if (a.normalizedText.includes(t) || (a.tokens || []).includes(t)) s += 4;
  return s;
}
const index = JSON.parse(await readFile('public/service/index/service-search-index.json', 'utf8'));
assert.ok(index.count > 17000, 'service index should contain the hyper expanded internal-first knowledge base');
for (const q of ['كيف أشبك ريسيفر سبايدر على النت', 'يوتيوب معلق على شاشة سامسونج', 'كيف أنزل شاهد على شاشة G-Guard', 'لا توجد إشارة no signal', 'تحديث سوفتوير ريسيفر تايجر', 'كيف أنزل اليوتيوب على G Guard', 'شاشة ماجيك شاهد مش موجود', 'ريسيفر انفينتي iptv يقطع', 'كيف اعرف موديل شاشة جنرال فيو', 'قطعة واي فاي لا تظهر على ريسيفر غزال', 'HDMI لا يعمل على شاشة Magic', 'توصيل ساوندبار ARC على شاشة LG', 'تفعيل اشتراك رسمي على ريسيفر ماجستيك', 'ذاكرة شاشة TCL ممتلئة', 'تثبيت شاهد على Google TV', 'لا يوجد Google Play على شاشة G-Guard', 'نتفليكس كود خطأ على Hisense', 'Smart Hub لا يفتح على سامسونج', 'Server Expired على ريسيفر Starsat', 'DiSEqC غلط على جيون', 'YouTube شاشة سوداء على TCL', 'AirPlay لا يظهر على LG']) {
  const best = [...index.articles].sort((a, b) => score(q, b) - score(q, a))[0];
  assert.ok(score(q, best) > 0, `query should match: ${q}`);
}
console.log(JSON.stringify({ ok: true, articles: index.count }, null, 2));
