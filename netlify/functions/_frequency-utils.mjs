import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";

export const FREQUENCY_STORE_NAME = "maen-frequency-data";
export const FREQUENCY_DATA_KEY = "live/frequency-data.json";
export const FREQUENCY_REPORT_KEY = "reports/latest-frequency-update.json";

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export function getFrequencyStore() {
  return getStore({ name: FREQUENCY_STORE_NAME, consistency: "strong" });
}

export function authorized(req) {
  const token = process.env.ANALYTICS_ADMIN_TOKEN || process.env.FREQUENCY_ADMIN_TOKEN || "";
  if (!token) return false;
  const url = new URL(req.url);
  const given = url.searchParams.get("token") || req.headers.get("x-analytics-token") || req.headers.get("x-frequency-token") || "";
  return given === token;
}

export async function readJsonFile(relativeFromNetlifyDir) {
  const url = new URL(relativeFromNetlifyDir, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

export async function readBaselineData() {
  const baseline = await readJsonFile("../frequency-baseline.json");
  return baseline && Array.isArray(baseline.items) ? baseline : { ok: true, items: [], count: 0, mode: "empty" };
}

export async function readSources() {
  try {
    const sources = await readJsonFile("../frequency-sources.json");
    return Array.isArray(sources) ? sources : [];
  } catch (error) {
    console.error("Failed reading frequency sources", error);
    return [];
  }
}

export function safeText(value, max = 400) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n) || 32));
}

export function normalizeSatelliteGroup(value = "") {
  const text = safeText(value, 120).toLowerCase();
  if (/nile|7\s*w|نايل/.test(text)) return "Nilesat";
  if (/eutelsat\s*8|8\s*w/.test(text)) return "Eutelsat 8W";
  if (/badr|arab|arabsat|26\s*e|عرب|بدر/.test(text)) return "Arabsat / BADR";
  if (/eshail|es'hail|25\.?8\s*e|سهيل/.test(text)) return "Es'hailSat";
  if (/hot\s*bird|13\s*e/.test(text)) return "Hot Bird";
  if (/turksat|türksat|42\s*e/.test(text)) return "Türksat";
  if (/yahsat|52\.?5\s*e/.test(text)) return "Yahsat";
  if (/hellas|39\s*e/.test(text)) return "Hellas Sat";
  if (/astra|19\.?2|28\.?2/.test(text)) return "Astra";
  if (/amos|4\s*w/.test(text)) return "Amos";
  if (/intelsat|68\.?5/.test(text)) return "Intelsat";
  return safeText(value, 120) || "Other";
}

export function normalizeFrequency(value) {
  const match = String(value ?? "").replace(/,/g, ".").match(/\b(\d{4,5})(?:\.(\d{1,3}))?\b/);
  if (!match) return "";
  const n = Number(match[1] + (match[2] ? "." + match[2] : ""));
  if (!Number.isFinite(n)) return "";
  if (n < 3000 || n > 13000) return "";
  return String(Math.round(n));
}

export function normalizePol(value) {
  const text = String(value ?? "").toUpperCase();
  const m = text.match(/(?:^|[\s,;:/\-])([HVLR])(?:[\s,;:/\-]|$)/) || text.match(/\b(HORIZONTAL|VERTICAL|RIGHT|LEFT)\b/);
  if (!m) return "";
  const v = m[1];
  if (v === "HORIZONTAL") return "H";
  if (v === "VERTICAL") return "V";
  if (v === "RIGHT") return "R";
  if (v === "LEFT") return "L";
  return v;
}

export function normalizeSr(value) {
  const text = String(value ?? "");
  const explicit = text.match(/(?:SR|Symbol\s*Rate)\D{0,12}(\d{3,5})/i);
  const m = explicit || text.match(/\b(1000|1500|2200|2500|2750|3000|5000|6666|7200|7500|10000|20000|22000|27500|29700|30000|45000)\b/);
  return m ? m[1] : "";
}

export function normalizeFec(value) {
  const text = String(value ?? "");
  const m = text.match(/\b([1-9]\s*\/\s*[1-9]|auto)\b/i);
  return m ? m[1].replace(/\s+/g, "").toUpperCase() : "";
}

export function normalizeSystem(value) {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("DVB-S2")) return "DVB-S2";
  if (text.includes("DVB-S")) return "DVB-S";
  return "";
}

export function normalizeMod(value) {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("8PSK")) return "8PSK";
  if (text.includes("16APSK")) return "16APSK";
  if (text.includes("QPSK")) return "QPSK";
  return "";
}

function candidateChannelName(lines, index) {
  const bad = /^(frequency|polarization|pol|sr|fec|system|modulation|satellite|transponder|beam|coverage|source|updated|learn more|channel name|country|category|name|logo|sid|provider|encryption|packages|video|audio)$/i;
  for (let j = Math.max(0, index - 8); j <= Math.min(lines.length - 1, index + 3); j++) {
    if (j === index) continue;
    let line = safeText(lines[j], 120);
    if (!line || line.length < 3 || bad.test(line)) continue;
    if (/\d{4,5}|mhz|dvb|fec|symbol/i.test(line)) continue;
    line = line.replace(/\s*Image\s*$/i, "").trim();
    if (line) return line;
  }
  return "";
}

export function htmlToLines(html) {
  const clean = decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>|<\/th>/gi, " \t ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/[\r\t]+/g, " ");
  return clean.split("\n").map(x => safeText(x, 300)).filter(Boolean);
}

export function extractCandidatesFromHtml(html, source) {
  const lines = htmlToLines(html);
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const windowText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(" | ");
    const freqMatches = [...lines[i].matchAll(/\b(\d{4,5}(?:[\.,]\d{1,3})?)\s*(?:MHz)?\b/gi)];
    for (const fm of freqMatches) {
      const frequency = normalizeFrequency(fm[1]);
      if (!frequency) continue;
      const pol = normalizePol(windowText);
      if (!pol) continue;
      const sr = normalizeSr(windowText);
      const fec = normalizeFec(windowText);
      const channelName = candidateChannelName(lines, i);
      const satelliteGroup = normalizeSatelliteGroup(source.satelliteGroup || source.name || "");
      const item = {
        satellite: source.orbit || source.satelliteGroup || "",
        orbit: source.orbit || "",
        satelliteGroup,
        channel: channelName || `${satelliteGroup} ${frequency}${pol}`,
        channels: channelName ? [channelName] : [],
        frequency,
        pol,
        sr,
        fec,
        system: normalizeSystem(windowText),
        mod: normalizeMod(windowText),
        source: source.name,
        sourceUrl: source.url,
        authority: source.authority || "reference",
        trust: source.trust || "reference",
        updatePolicy: source.mode || "compare-only",
        lastCheckedAt: new Date().toISOString(),
        confidence: source.mode === "auto-approve" || source.trust === "official" ? 92 : 55
      };
      candidates.push(item);
    }
  }
  return dedupeItems(candidates);
}

export function itemKey(item) {
  return [normalizeSatelliteGroup(item.satelliteGroup || item.satellite || item.orbit), item.frequency || "", item.pol || ""].join("|");
}

export function channelSet(item) {
  const values = [];
  if (Array.isArray(item.channels)) values.push(...item.channels);
  if (item.channel) values.push(...String(item.channel).split(/،|,|\+/g));
  return [...new Set(values.map(x => safeText(x, 100)).filter(Boolean))];
}

export function dedupeItems(items = []) {
  const map = new Map();
  for (const raw of items) {
    if (!raw || !raw.frequency || !raw.pol) continue;
    const item = { ...raw };
    item.frequency = normalizeFrequency(item.frequency);
    item.pol = normalizePol(item.pol) || item.pol;
    item.satelliteGroup = normalizeSatelliteGroup(item.satelliteGroup || item.satellite || item.orbit);
    const key = itemKey(item);
    const prev = map.get(key);
    if (!prev) {
      item.channels = channelSet(item);
      item.channelCount = item.channels.length || item.channelCount || 0;
      map.set(key, item);
    } else {
      const channels = [...new Set([...channelSet(prev), ...channelSet(item)])];
      prev.channels = channels;
      prev.channel = channels.length ? channels.slice(0, 18).join("، ") + (channels.length > 18 ? ` + ${channels.length - 18} قناة أخرى` : "") : prev.channel;
      prev.channelCount = channels.length;
      prev.source = [...new Set([prev.source, item.source].filter(Boolean).flatMap(x => String(x).split(/\s*\+\s*/)))].join(" + ");
      prev.confidence = Math.max(Number(prev.confidence || 0), Number(item.confidence || 0));
      if (!prev.sr && item.sr) prev.sr = item.sr;
      if (!prev.fec && item.fec) prev.fec = item.fec;
      if (!prev.system && item.system) prev.system = item.system;
      if (!prev.mod && item.mod) prev.mod = item.mod;
    }
  }
  return [...map.values()];
}

export function mergeFrequencyData(baselineItems, sourceCandidates, sources) {
  const now = new Date().toISOString();
  const approvedModes = new Set(["auto-approve"]);
  const baseline = dedupeItems(baselineItems || []).map(item => ({ ...item, baseline: true, confidence: item.confidence || 100 }));
  const byKey = new Map(baseline.map(item => [itemKey(item), item]));
  const candidateGroups = new Map();
  for (const cand of dedupeItems(sourceCandidates || [])) {
    const key = itemKey(cand);
    if (!candidateGroups.has(key)) candidateGroups.set(key, []);
    candidateGroups.get(key).push(cand);
  }
  const changes = { updated: 0, added: 0, reviewedOnly: 0, channelNamesAdded: 0 };
  const reviewedOnly = [];
  for (const [key, group] of candidateGroups) {
    const existing = byKey.get(key);
    const official = group.find(x => approvedModes.has(x.updatePolicy) || x.authority === "official");
    const consensus = group.length >= 2;
    const chosen = official || (consensus ? group[0] : null);
    if (existing && chosen) {
      const before = channelSet(existing);
      const additions = [...new Set(group.flatMap(channelSet))].filter(ch => !before.includes(ch));
      if (additions.length) {
        const merged = [...new Set([...before, ...additions])];
        existing.channels = merged;
        existing.channel = merged.slice(0, 18).join("، ") + (merged.length > 18 ? ` + ${merged.length - 18} قناة أخرى` : "");
        existing.channelCount = merged.length;
        changes.channelNamesAdded += additions.length;
      }
      if (!existing.sourceAuditUrl && chosen.sourceUrl) existing.sourceAuditUrl = chosen.sourceUrl;
      existing.lastCheckedAt = now;
      existing.source = safeText([existing.source, ...group.map(x => x.source)].filter(Boolean).join(" + "), 350);
      existing.confidence = Math.max(existing.confidence || 80, official ? 98 : 82);
      changes.updated += 1;
    } else if (!existing && chosen) {
      const item = { ...chosen, baseline: false, lastCheckedAt: now, updatePolicy: official ? "auto-added-official" : "auto-added-consensus", confidence: official ? 92 : 78 };
      byKey.set(key, item);
      changes.added += 1;
    } else {
      reviewedOnly.push({ ...group[0], reviewReason: "Single comparison-only source; not auto-approved" });
      changes.reviewedOnly += 1;
    }
  }
  const items = [...byKey.values()].sort((a, b) => {
    const sa = String(a.satelliteGroup || a.satellite || "").localeCompare(String(b.satelliteGroup || b.satellite || ""));
    if (sa) return sa;
    return Number(a.frequency || 0) - Number(b.frequency || 0) || String(a.pol || "").localeCompare(String(b.pol || ""));
  });
  return { items, reviewedOnly, changes, sourceCount: sources.length, checkedAt: now };
}

export async function fetchSourceCandidates(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FREQUENCY_FETCH_TIMEOUT_MS || 12000));
  try {
    if (source.mode === "coverage-only") return { source, ok: true, candidates: [], coverageOnly: true };
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "MaenSatFrequencyMonitor/1.0 (+https://maensat.netlify.app; compare/update monitor)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    const text = await response.text();
    const candidates = response.ok ? extractCandidatesFromHtml(text, source) : [];
    return { source, ok: response.ok, status: response.status, candidates, bytes: text.length };
  } catch (error) {
    return { source, ok: false, error: String(error && error.message || error), candidates: [] };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runFrequencyUpdate({ sendEmail = true } = {}) {
  const baseline = await readBaselineData();
  const sources = await readSources();
  const sourceResults = [];
  for (const source of sources) {
    // Sequential fetching is gentler on external sources and easier to debug.
    // Add new source-specific parsers later if a site changes its layout.
    const result = await fetchSourceCandidates(source);
    sourceResults.push(result);
  }
  const candidates = sourceResults.flatMap(r => r.candidates || []);
  const merged = mergeFrequencyData(baseline.items || [], candidates, sources);
  const payload = {
    ok: true,
    mode: "live",
    updatedAt: merged.checkedAt,
    count: merged.items.length,
    items: merged.items,
    reviewedOnly: merged.reviewedOnly.slice(0, 200),
    sourceResults: sourceResults.map(r => ({
      id: r.source.id,
      name: r.source.name,
      ok: r.ok,
      status: r.status || null,
      candidates: (r.candidates || []).length,
      coverageOnly: Boolean(r.coverageOnly),
      error: r.error || null
    })),
    changes: merged.changes,
    satellites: JORDAN_MENA_SATELLITES,
    note: "Official sources can update data automatically. LyngSat/KingOfSat/SatBeams are used for comparison/coverage and confidence unless two trusted sources agree."
  };
  const store = getFrequencyStore();
  await store.setJSON(FREQUENCY_DATA_KEY, payload);
  const report = buildFrequencyReport(payload);
  await store.setJSON(FREQUENCY_REPORT_KEY, report);
  const email = sendEmail ? await sendFrequencyUpdateEmail(report) : { sent: false, reason: "disabled" };
  return { payload, report, email };
}

export const JORDAN_MENA_SATELLITES = [
  { value: "Nilesat", label: "نايل سات / يوتلسات 7W-8W", orbit: "7W/8W" },
  { value: "Arabsat", label: "عرب سات / بدر 26E", orbit: "26E" },
  { value: "Es'hailSat", label: "سهيل سات 25.5E / 25.8E", orbit: "25.5E/25.8E" },
  { value: "Hot Bird", label: "هوت بيرد 13E", orbit: "13E" },
  { value: "Eutelsat 16E", label: "يوتلسات 16E", orbit: "16E" },
  { value: "Eutelsat 9E", label: "يوتلسات 9E", orbit: "9E" },
  { value: "Türksat", label: "تركسات 42E", orbit: "42E" },
  { value: "Yahsat", label: "ياه سات 52.5E", orbit: "52.5E" },
  { value: "Hellas Sat", label: "هيلاس سات 39E", orbit: "39E" },
  { value: "Eutelsat 36E", label: "يوتلسات 36E", orbit: "36E" },
  { value: "Astra", label: "أسترا 19.2E / 28.2E", orbit: "19.2E/28.2E" },
  { value: "Amos", label: "أموس 4W", orbit: "4W" },
  { value: "Intelsat", label: "إنتلسات 68.5E", orbit: "68.5E" },
  { value: "Azerspace", label: "أذر سبيس 46E", orbit: "46E" }
];

export function buildFrequencyReport(payload) {
  const failed = (payload.sourceResults || []).filter(s => !s.ok);
  const checked = (payload.sourceResults || []).length;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    updatedAt: payload.updatedAt,
    totalFrequencies: payload.count,
    sourcesChecked: checked,
    sourcesFailed: failed.length,
    changes: payload.changes,
    reviewedOnlyCount: (payload.reviewedOnly || []).length,
    failedSources: failed,
    note: payload.note
  };
}

export function frequencyReportText(report) {
  const lines = [];
  lines.push("تقرير تحديث الترددات اليومي - معن حنونة للستلايت");
  lines.push(`وقت الفحص: ${report.generatedAt}`);
  lines.push("");
  lines.push(`إجمالي الترددات في قاعدة الموقع: ${report.totalFrequencies}`);
  lines.push(`المصادر التي تم فحصها: ${report.sourcesChecked}`);
  lines.push(`مصادر فشلت: ${report.sourcesFailed}`);
  lines.push(`ترددات/بيانات تم تحديثها: ${report.changes.updated}`);
  lines.push(`ترددات أضيفت تلقائيًا: ${report.changes.added}`);
  lines.push(`أسماء محطات أضيفت: ${report.changes.channelNamesAdded}`);
  lines.push(`عناصر للمراجعة فقط: ${report.reviewedOnlyCount}`);
  lines.push("");
  lines.push(report.note || "");
  if ((report.failedSources || []).length) {
    lines.push("");
    lines.push("مصادر تحتاج مراجعة:");
    for (const s of report.failedSources.slice(0, 8)) lines.push(`- ${s.name || s.id}: ${s.error || s.status || "failed"}`);
  }
  return lines.join("\n");
}

export function frequencyReportHtml(report) {
  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const rows = [
    ["إجمالي الترددات", report.totalFrequencies],
    ["المصادر المفحوصة", report.sourcesChecked],
    ["مصادر فشلت", report.sourcesFailed],
    ["تحديثات", report.changes.updated],
    ["إضافات تلقائية", report.changes.added],
    ["أسماء محطات أضيفت", report.changes.channelNamesAdded],
    ["للمراجعة فقط", report.reviewedOnlyCount]
  ].map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("");
  const failed = (report.failedSources || []).map(s => `<li>${esc(s.name || s.id)}: ${esc(s.error || s.status || "failed")}</li>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma,Arial,sans-serif;background:#f8f5ed;color:#111;line-height:1.7"><main style="max-width:780px;margin:auto;background:#fff;border-radius:22px;padding:24px"><h1>تقرير تحديث الترددات اليومي</h1><p>وقت الفحص: <b>${esc(report.generatedAt)}</b></p><table style="width:100%;border-collapse:collapse">${rows}</table><p>${esc(report.note)}</p>${failed ? `<h2>مصادر تحتاج مراجعة</h2><ul>${failed}</ul>` : ""}</main></body></html>`;
}

export async function sendFrequencyUpdateEmail(report) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const to = process.env.FREQUENCY_REPORT_EMAIL || process.env.REPORT_EMAIL || "";
  const from = process.env.REPORT_FROM || "Maen Analytics <onboarding@resend.dev>";
  if (!apiKey || !to) return { sent: false, reason: "RESEND_API_KEY or REPORT_EMAIL is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `تقرير تحديث الترددات - ${new Date().toISOString().slice(0,10)}`,
      text: frequencyReportText(report),
      html: frequencyReportHtml(report)
    })
  });
  const body = await response.text().catch(() => "");
  return { sent: response.ok, status: response.status, body: body.slice(0, 500) };
}
