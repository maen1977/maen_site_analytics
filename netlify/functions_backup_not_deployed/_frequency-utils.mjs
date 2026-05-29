import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";

export const FREQUENCY_STORE_NAME = "maen-frequency-data";
export const FREQUENCY_DATA_KEY = "live/frequency-data.json";
export const FREQUENCY_REPORT_KEY = "reports/latest-frequency-update.json";
export const FREQUENCY_DATA_VERSION = "satellite-orbital-structure-2026-05-28-v5";

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
  return baseline && Array.isArray(baseline.items) ? { ...baseline, version: baseline.version || FREQUENCY_DATA_VERSION } : { ok: true, items: [], count: 0, mode: "empty", version: FREQUENCY_DATA_VERSION };
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
  if (/eutelsat\s*8|8\s*w/.test(text)) return "Nilesat";
  if (/badr|arab|arabsat|26\s*e|عرب|بدر/.test(text)) return "Arabsat / BADR";
  if (/eshail|es'hail|25\.?8\s*e|سهيل/.test(text)) return "Es'hailSat";
  if (/hot\s*bird|hotbird|13\s*e/.test(text)) return "Hot Bird";
  if (/turksat|türksat|42\s*e/.test(text)) return "Türksat";
  if (/yahsat|52\.?5\s*e/.test(text)) return "Yahsat";
  if (/hellas|39\s*e/.test(text)) return "Hellas Sat";
  if (/astra|19\.?2|28\.?2/.test(text)) return "Astra";
  if (/amos|4\s*w/.test(text)) return "Amos";
  if (/intelsat|68\.?5/.test(text)) return "Intelsat";
  if (/azer|46\s*e/.test(text)) return "Azerspace";
  if (/eutelsat\s*16|16\s*e/.test(text)) return "Eutelsat 16E";
  if (/eutelsat\s*9|9\s*e/.test(text)) return "Eutelsat 9E";
  if (/eutelsat\s*36|36\s*e/.test(text)) return "Eutelsat 36E";
  return safeText(value, 120) || "Other";
}

export function normalizeOrbitSlot(value = "") {
  const text = safeText(value, 80).toUpperCase().replace(/°/g, "").replace(/\s+/g, "");
  if (!text) return "";
  if (text.includes("/")) return text.split("/").map(normalizeOrbitSlot).filter(Boolean).join("/");
  let m = text.match(/(\d{1,3}(?:\.\d+)?)([EW])/);
  if (m) return `${m[1]}${m[2]}`;
  m = text.match(/([EW])(\d{1,3}(?:\.\d+)?)/);
  if (m) return `${m[2]}${m[1]}`;
  return "";
}

export function normalizeSatelliteName(value = "") {
  return safeText(value, 120).replace(/\s+/g, " ").trim();
}

const SATELLITE_FAMILY_RULES = [
  [/hot\s*bird|hotbird|13\s*e/i, ["Hot Bird", "13E", "Hot Bird 13F/13G"]],
  [/nilesat.*eutelsat\s*7\s*west|nilesat\s*201|nilesat\s*301|7\s*w/i, ["Nilesat", "7W", "Nilesat 201/301 + Eutelsat 7 West A"]],
  [/eutelsat\s*8\s*west|8\s*w/i, ["Nilesat", "8W", "Eutelsat 8 West B"]],
  [/badr\s*4\/5\/6|badr\s*4|badr\s*5|badr\s*6/i, ["Arabsat / BADR", "26E", "BADR-4/5/6"]],
  [/badr\s*7/i, ["Arabsat / BADR", "26E", "BADR-7"]],
  [/badr\s*8/i, ["Arabsat / BADR", "26E", "BADR-8"]],
  [/arabsat|badr|26\s*e/i, ["Arabsat / BADR", "26E", "Arabsat / BADR position"]],
  [/es[’']?hail\s*2|eshail\s*2|25\.8\s*e/i, ["Es'hailSat", "25.8E", "Es'hail 2"]],
  [/es[’']?hail|eshail|25\.5\s*e/i, ["Es'hailSat", "25.5E", "Es'hailSat position"]],
  [/eutelsat\s*16a|16\s*e/i, ["Eutelsat 16E", "16E", "Eutelsat 16A"]],
  [/eutelsat\s*9b|ka\s*sat|9\s*e/i, ["Eutelsat 9E", "9E", "Eutelsat 9B / Ka-Sat 9A"]],
  [/t[üu]rksat\s*6a/i, ["Türksat", "42E", "Türksat 6A"]],
  [/t[üu]rksat\s*5b/i, ["Türksat", "42E", "Türksat 5B"]],
  [/t[üu]rksat\s*4a/i, ["Türksat", "42E", "Türksat 4A"]],
  [/t[üu]rksat\s*3a/i, ["Türksat", "42E", "Türksat 3A"]],
  [/t[üu]rksat|42\s*e/i, ["Türksat", "42E", "Türksat position"]],
  [/al\s*yah\s*1|yahsat|52\.5\s*e/i, ["Yahsat", "52.5E", "Al Yah 1"]],
  [/hellas\s*sat\s*3\/4|hellas|39\s*e/i, ["Hellas Sat", "39E", "Hellas Sat 3/4"]],
  [/eutelsat\s*36d|express\s*amu1|36\s*e/i, ["Eutelsat 36E", "36E", "Eutelsat 36D / Express AMU1"]],
  [/astra\s*2e|astra\s*2f|astra\s*2g|28\.2\s*e/i, ["Astra", "28.2E", "Astra 2E/2F/2G"]],
  [/astra\s*1n|astra\s*1p|astra\s*1m|astra\s*1kr|astra\s*1l|19\.2\s*e/i, ["Astra", "19.2E", "Astra 1KR/1L/1M/1N/1P"]],
  [/amos\s*7/i, ["Amos", "4W", "Amos 7"]],
  [/dror\s*1/i, ["Amos", "4W", "Dror 1"]],
  [/amos\s*3/i, ["Amos", "4W", "Amos 3"]],
  [/amos|4\s*w/i, ["Amos", "4W", "Amos 3 / Amos 7 / Dror 1"]],
  [/intelsat\s*20|68\.5\s*e/i, ["Intelsat", "68.5E", "Intelsat 20"]],
  [/azerspace\s*1|azercosmos|46\s*e/i, ["Azerspace", "46E", "Azerspace 1"]]
];

export function inferSatelliteMeta(input = {}) {
  const text = [input.satelliteName, input.satellite, input.satelliteGroup, input.orbitalSlot, input.orbit, input.source, input.name, input.url, input.sourceUrl, input.sourceAuditUrl, input.notes]
    .filter(Boolean).map(x => safeText(x, 160)).join(" | ");
  let satelliteGroup = normalizeSatelliteGroup(input.satelliteGroup || text || "Other");
  let orbitalSlot = normalizeOrbitSlot(input.orbitalSlot || input.orbit || text);
  let satelliteName = normalizeSatelliteName(input.satelliteName || "");
  const rawSatellite = normalizeSatelliteName(input.satellite || "");
  if (!satelliteName && rawSatellite && !/^\d+(?:\.\d+)?[EW](?:\/\d+(?:\.\d+)?[EW])?$/i.test(rawSatellite.replace(/\s+/g, ""))) satelliteName = rawSatellite;
  for (const [regex, meta] of SATELLITE_FAMILY_RULES) {
    if (regex.test(text)) {
      if (!satelliteGroup || satelliteGroup === "Other") satelliteGroup = meta[0];
      if (!orbitalSlot) orbitalSlot = meta[1];
      if (!satelliteName || /^\d+(?:\.\d+)?[EW](?:\/\d+(?:\.\d+)?[EW])?$/i.test(satelliteName.replace(/\s+/g, ""))) satelliteName = meta[2];
      break;
    }
  }
  if (!satelliteName) satelliteName = satelliteGroup + (orbitalSlot ? " position" : "");
  const satelliteCluster = [satelliteGroup, orbitalSlot ? "@ " + orbitalSlot : ""].filter(Boolean).join(" ").trim();
  const satelliteIdentityKey = [normalizeSatelliteGroup(satelliteGroup), orbitalSlot, satelliteName].map(x => safeText(x, 120).toLowerCase()).join("|");
  return { satelliteGroup, orbitalSlot, orbit: orbitalSlot || input.orbit || "", satelliteName, satelliteCluster, satelliteIdentityKey, satelliteMetaVersion: FREQUENCY_DATA_VERSION, satelliteMetaPolicy: "واجهة المستخدم تعرض القمر/المدار ببساطة، لكن الدمج الداخلي يستخدم المدار + اسم القمر الفعلي حتى لا تختلط أقمار متعددة على نفس المدار." };
}

function candidateBase(source, satelliteGroupOverride = "") {
  return inferSatelliteMeta({ ...source, satelliteGroup: satelliteGroupOverride || source.satelliteGroup, satellite: source.satelliteName || source.name, orbit: source.orbit });
}

export function hydrateFrequencyItem(raw = {}) {
  const meta = inferSatelliteMeta(raw);
  const item = { ...raw, ...meta };
  if (!item.satellite || /^\d+(?:\.\d+)?[EW](?:\/\d+(?:\.\d+)?[EW])?$/i.test(String(item.satellite || "").replace(/\s+/g, ""))) item.satellite = meta.satelliteName;
  return item;
}

export function normalizeFrequency(value) {
  const match = String(value ?? "").replace(/,/g, ".").match(/\b(\d{4,5})(?:\.(\d{1,3}))?\b/);
  if (!match) return "";
  const n = Number(match[1] + (match[2] ? "." + match[2] : ""));
  if (!Number.isFinite(n)) return "";
  // C/Ku/Ka band ranges. The previous 13000 MHz ceiling dropped Ka-band rows
  // and some published listings; keep a broad but realistic satellite range.
  if (n < 3000 || n > 50000) return "";
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
  const text = String(value ?? "").replace(/[,،]/g, " ");
  const explicit = text.match(/(?:SR|Symbol\s*Rate|SR\/FEC)\D{0,18}(\d{3,5})/i);
  if (explicit) return explicit[1];
  // KingOfSat/LyngSat often list: Frequency Pol ... DVB-S2 8PSK 27500 3/4
  const afterDvb = text.match(/DVB-S2?X?[^\d]{0,25}(?:QPSK|8PSK|16APSK|32APSK)?[^\d]{0,25}(\d{4,5})\s+(?:[1-9]\s*\/\s*[1-9]|auto)/i);
  if (afterDvb) return afterDvb[1];
  const all = [...text.matchAll(/\b(\d{4,5})\b/g)].map(m => Number(m[1]));
  const candidates = all.filter(n => n >= 1000 && n <= 60000 && ![2048,318,1918,1070,65535].includes(n));
  return candidates.length ? String(candidates[candidates.length - 1]) : "";
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

function stripChannelLineNoise(value = "") {
  return safeText(value, 160)
    .replace(/\s*Image(?::[^|]+)?\s*/gi, " ")
    .replace(/\s*Packages\s*/gi, " ")
    .replace(/\s*LyngSat Stream\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function channelNameFromServiceLine(line = "") {
  const text = stripChannelLineNoise(line);
  if (!text || !/^\s*\d{1,6}\*?\s+/.test(text)) return "";
  if (/^(Frequency|Beam|EIRP|System|SR|FEC|SID|Provider|Channel|ONID|Compression|Audio|Encryption|Updated)\b/i.test(text)) return "";
  let name = text.replace(/^\s*\d{1,6}\*?\s+/, "");
  // LyngSat lines usually continue with MPEG/HEVC/H.264 details. SatBeams lines often continue with TV/Radio + encryption.
  name = name.replace(/\s+(?:MPEG|HEVC|H\.?264|AVC|DVB)[\s\S]*$/i, "");
  name = name.replace(/\s+(?:TV|Radio|Data)\s+(?:Clear|FTA|Conax|Irdeto|Nagravision|Viaccess|Mediaguard|Panaccess|Videoguard|VideoGuard|PowerVu|BISS|Cryptoworks|NDS|BetaCrypt|Tandberg)[\s\S]*$/i, "");
  name = name.replace(/\s+(?:Conax|Irdeto|Nagravision|Viaccess|Mediaguard|Panaccess|Videoguard|VideoGuard|PowerVu|BISS|Cryptoworks|NDS|BetaCrypt|Tandberg)[\s\S]*$/i, "");
  name = name.replace(/\s+\d{3,5}(?:\s+\d{3,5})?.*$/i, "");
  name = name.replace(/[\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!name || name.length < 2 || /^\d+$/.test(name)) return "";
  if (/^(tp\s*\d+|wide|europe|main|packages?|frequency|channel|encryption|owner|date|new|feeds?|feed)$/i.test(name)) return "";
  return safeText(name, 100);
}

function extractBlockSr(blockLines = []) {
  const blockText = blockLines.join(" | ");
  const afterDvb = normalizeSr(blockText);
  if (afterDvb) return afterDvb;
  for (const line of blockLines.slice(0, 12)) {
    const candidates = [...String(line).matchAll(/\b(\d{4,5})\b/g)].map(m => Number(m[1])).filter(n => n >= 1000 && n <= 60000);
    if (candidates.length) return String(candidates[candidates.length - 1]);
  }
  return "";
}



function looksLikeDthSatHeader(lines, i) {
  const a = String(lines[i] || "");
  const b = String(lines[i + 1] || "");
  const c = String(lines[i + 2] || "");
  const d = String(lines[i + 3] || "");
  const e = String(lines[i + 4] || "");
  if (!/channel\s*name/i.test(a)) return false;
  const head = [a, b, c, d, e].join(" | ");
  return /frequency/i.test(head) && /symbol\s*rate|sr\b/i.test(head) && (/fec|video\s*format|system\s*encryption/i.test(head));
}

function isLikelyFrequencyLine(line = "") {
  const text = String(line || "").trim();
  return /^\d{4,5}(?:[\.,]\d{1,3})?(?:\s*[HVLR])?\b/i.test(text);
}

function isLikelyHeaderOrAd(line = "") {
  return /^(channel name|frequency|frequency\s+polarity|polarity|symbol rate|symbol rate\s+fec|sr|fec|system encryption|sid|vpid|onid|tid|video format|advertisement|quick search|all satellites|satellite list)$/i.test(String(line || "").trim());
}

function isLikelyDthSatDataCell(line = "") {
  const text = String(line || "").trim();
  if (!text) return true;
  if (/^\d{1,6}$/.test(text)) return true;
  if (/^(MPEG|HEVC|H\.?264|DVB|PowerVu|BISS|Conax|Irdeto|Nagravision|Viaccess|VideoGuard|Panaccess|Clear|FTA|Encrypted)/i.test(text)) return true;
  if (/^(SD|HD|UHD|4K)$/i.test(text)) return true;
  if (/^[1-9]\s*\/\s*[1-9]$/.test(text)) return true;
  return false;
}

function extractDthSatFlexibleTableCandidates(lines, source) {
  // DTHSat has more than one table shape:
  // 1) Channel / Frequency / Polarity / Symbol Rate / FEC
  // 2) Channel / "Frequency Polarity" / "Symbol Rate FEC" / System Encryption ...
  // This parser scans forward from each Channel Name header and groups rows by transponder.
  const satelliteGroup = normalizeSatelliteGroup(source.satelliteGroup || source.name || "");
  const grouped = new Map();
  for (let i = 0; i < lines.length - 3; i++) {
    if (!looksLikeDthSatHeader(lines, i)) continue;
    let j = i + 1;
    // Skip header cells after "Channel Name". DTHSat sometimes splits headers into
    // separate lines and sometimes writes combined cells like "Frequency Polarity".
    while (j < lines.length && /^(frequency|frequency\s+polarity|polarity|symbol\s*rate|sr|fec|symbol\s*rate\s*fec|system\s*encryption|sid|vpid|onid|tid|video\s*format)$/i.test(String(lines[j] || "").trim())) j++;
    while (j < lines.length && !/channel\s*name/i.test(String(lines[j] || ""))) {
      if (j >= lines.length) break;
      if (isLikelyHeaderOrAd(lines[j])) { j += 1; continue; }
      // Skip system/encryption/SID cells left over from the previous row in compound tables.
      if (isLikelyDthSatDataCell(lines[j]) || /^(MPEG|DVB|PowerVu|BISS|Conax|Irdeto|Nagravision|Viaccess|VideoGuard|Panaccess)/i.test(String(lines[j] || ""))) { j += 1; continue; }
      // Gather channel name lines until the next frequency-looking line.
      let k = j;
      const nameParts = [];
      while (k < Math.min(lines.length, j + 8) && !isLikelyFrequencyLine(lines[k]) && !/channel\s*name/i.test(String(lines[k] || ""))) {
        const part = stripChannelLineNoise(lines[k]);
        if (part && !isLikelyHeaderOrAd(part) && !isLikelyDthSatDataCell(part) && !/^updated\b/i.test(part) && !/satellite.*lnb/i.test(part)) nameParts.push(part);
        k += 1;
      }
      if (!nameParts.length || k >= lines.length || !isLikelyFrequencyLine(lines[k])) { j += 1; continue; }
      const rawName = safeText(nameParts.join(" / "), 180);
      const frequency = normalizeFrequency(lines[k]);
      let pol = normalizePol(lines[k]);
      let sr = "";
      let fec = "";
      let system = "";
      let mod = "";
      let consumeTo = k + 1;
      // Try separate polarity line first, then combined SR/FEC line.
      for (let t = k + 1; t < Math.min(lines.length, k + 8); t++) {
        const line = String(lines[t] || "");
        if (/channel\s*name/i.test(line)) break;
        if (!pol) pol = normalizePol(line);
        if (!sr) {
          // DTHSat compound cells can be like "9682-5/6 8PSK".
          const direct = line.match(/\b(\d{2,5})(?:\s*[-/]\s*([1-9]\s*\/\s*[1-9]))?/);
          if (direct && Number(direct[1]) >= 100) sr = direct[1];
        }
        if (!fec) fec = normalizeFec(line);
        if (!system) system = normalizeSystem(line);
        if (!mod) mod = normalizeMod(line);
        if (isLikelyFrequencyLine(line) && t > k + 1) break;
        consumeTo = t + 1;
        if (pol && sr && (fec || /video\s*format|system|encryption/i.test(line))) break;
      }
      if (frequency && pol && sr && rawName && !/^feed$/i.test(rawName + "x".slice(1))) {
        const cleanNames = rawName.split(/\s*\/\s*/).map(x => safeText(x, 120)).filter(Boolean);
        const channels = cleanNames.length ? cleanNames : [rawName];
        const key = [satelliteGroup, frequency, pol, sr, fec].join("|");
        const entry = grouped.get(key) || { frequency, pol, sr, fec, system, mod, channels: [] };
        if (!entry.system && system) entry.system = system;
        if (!entry.mod && mod) entry.mod = mod;
        for (const ch of channels) {
          if (ch && !isLikelyHeaderOrAd(ch) && !entry.channels.some(x => x.toLowerCase() === ch.toLowerCase())) entry.channels.push(ch);
        }
        grouped.set(key, entry);
        j = Math.max(consumeTo, k + 1);
      } else {
        j += 1;
      }
    }
  }
  const candidates = [];
  for (const entry of grouped.values()) {
    const channels = entry.channels.filter(Boolean);
    if (!channels.length) continue;
    candidates.push({
      ...candidateBase(source, satelliteGroup),
      channel: channels.slice(0, 18).join("، ") + (channels.length > 18 ? ` + ${channels.length - 18} قناة أخرى` : ""),
      channels,
      channelCount: channels.length,
      frequency: entry.frequency,
      pol: entry.pol,
      sr: entry.sr,
      fec: entry.fec,
      system: entry.system || "",
      mod: entry.mod || "",
      source: source.name,
      sourceUrl: source.url,
      sourceAuditUrl: source.url,
      authority: source.authority || "reference",
      trust: source.trust || "reference",
      updatePolicy: source.mode || "compare-only",
      lastCheckedAt: new Date().toISOString(),
      confidence: source.mode === "auto-approve" || source.mode === "baseline-refresh" ? 89 : 73,
      dataQuality: "parsed-dthsat-flexible-table"
    });
  }
  return dedupeItems(candidates);
}

function extractDthSatSimpleTableCandidates(lines, source) {
  const candidates = [];
  const satelliteGroup = normalizeSatelliteGroup(source.satelliteGroup || source.name || "");
  const header = /channel\s*name/i;
  function isHeaderAt(i) {
    return header.test(lines[i] || "") && /frequency/i.test(lines[i + 1] || "") && /polarity/i.test(lines[i + 2] || "") && /symbol\s*rate/i.test(lines[i + 3] || "") && /^fec$/i.test(String(lines[i + 4] || "").trim());
  }
  const grouped = new Map();
  for (let i = 0; i < lines.length - 9; i++) {
    if (!isHeaderAt(i)) continue;
    let j = i + 5;
    while (j + 4 < lines.length && !isHeaderAt(j)) {
      const name = stripChannelLineNoise(lines[j]);
      const frequency = normalizeFrequency(lines[j + 1]);
      const pol = normalizePol(lines[j + 2]);
      const sr = normalizeSr("SR " + lines[j + 3]);
      const fec = normalizeFec(lines[j + 4]);
      if (name && frequency && pol && sr) {
        const key = [satelliteGroup, frequency, pol, sr, fec].join("|");
        const entry = grouped.get(key) || { frequency, pol, sr, fec, channels: [] };
        if (!/^(channel name|frequency|polarity|symbol rate|fec)$/i.test(name) && !entry.channels.some(x => x.toLowerCase() === name.toLowerCase())) entry.channels.push(name);
        grouped.set(key, entry);
        j += 5;
      } else {
        j += 1;
      }
    }
  }
  for (const entry of grouped.values()) {
    const channels = entry.channels.filter(Boolean);
    if (!channels.length) continue;
    const blockText = channels.join(" | ");
    candidates.push({
      ...candidateBase(source, satelliteGroup),
      channel: channels.slice(0, 18).join("، ") + (channels.length > 18 ? ` + ${channels.length - 18} قناة أخرى` : ""),
      channels,
      channelCount: channels.length,
      frequency: entry.frequency,
      pol: entry.pol,
      sr: entry.sr,
      fec: entry.fec,
      system: normalizeSystem(blockText),
      mod: normalizeMod(blockText),
      source: source.name,
      sourceUrl: source.url,
      sourceAuditUrl: source.url,
      authority: source.authority || "reference",
      trust: source.trust || "reference",
      updatePolicy: source.mode || "compare-only",
      lastCheckedAt: new Date().toISOString(),
      confidence: source.mode === "auto-approve" || source.mode === "baseline-refresh" ? 88 : 72,
      dataQuality: "parsed-dthsat-simple-table"
    });
  }
  return dedupeItems(candidates);
}

function extractTableBlockCandidates(lines, source) {
  const candidates = [];
  const satelliteGroup = normalizeSatelliteGroup(source.satelliteGroup || source.name || "");
  for (let i = 0; i < lines.length; i++) {
    const m = String(lines[i] || "").match(/^\s*(\d{4,5})(?:[\.,]\d{1,3})?\s*([HVLR])\b/i);
    if (!m) continue;
    const frequency = normalizeFrequency(m[1]);
    const pol = normalizePol(m[2]);
    if (!frequency || !pol) continue;
    let j = i + 1;
    while (j < lines.length && !/^\s*\d{4,5}(?:[\.,]\d{1,3})?\s*[HVLR]\b/i.test(String(lines[j] || ""))) j++;
    const block = lines.slice(i + 1, j);
    const channels = [];
    for (const line of block) {
      const ch = channelNameFromServiceLine(line);
      if (ch && !channels.some(x => x.toLowerCase() === ch.toLowerCase())) channels.push(ch);
    }
    const blockText = block.join(" | ");
    const channelName = channels.length ? channels.slice(0, 18).join("، ") + (channels.length > 18 ? ` + ${channels.length - 18} قناة أخرى` : "") : candidateChannelName(lines, i);
    const item = {
      ...candidateBase(source, satelliteGroup),
      channel: channelName || `${satelliteGroup} ${frequency}${pol}`,
      channels,
      frequency,
      pol,
      sr: extractBlockSr(block),
      fec: normalizeFec(blockText),
      system: normalizeSystem(blockText),
      mod: normalizeMod(blockText),
      source: source.name,
      sourceUrl: source.url,
      sourceAuditUrl: source.url,
      authority: source.authority || "reference",
      trust: source.trust || "reference",
      updatePolicy: source.mode || "compare-only",
      lastCheckedAt: new Date().toISOString(),
      confidence: source.mode === "auto-approve" || source.trust === "official" ? 94 : 82,
      dataQuality: channels.length ? "parsed-table-block" : "parsed-transponder-only"
    };
    candidates.push(item);
    i = Math.max(i, j - 1);
  }
  return dedupeItems(candidates);
}

export function extractCandidatesFromHtml(html, source) {
  const lines = htmlToLines(html);
  const dthSatFlexibleCandidates = extractDthSatFlexibleTableCandidates(lines, source);
  const dthSatCandidates = extractDthSatSimpleTableCandidates(lines, source);
  const isDthSatSource = /dthsat/i.test(String(source.url || source.name || ""));
  if (isDthSatSource && (dthSatFlexibleCandidates.length || dthSatCandidates.length)) {
    return dedupeItems([...dthSatFlexibleCandidates, ...dthSatCandidates]);
  }
  const blockCandidates = extractTableBlockCandidates(lines, source);
  const genericCandidates = [];
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
        ...candidateBase(source, satelliteGroup),
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
        sourceAuditUrl: source.url,
        authority: source.authority || "reference",
        trust: source.trust || "reference",
        updatePolicy: source.mode || "compare-only",
        lastCheckedAt: new Date().toISOString(),
        confidence: source.mode === "auto-approve" || source.trust === "official" ? 92 : 55
      };
      genericCandidates.push(item);
    }
  }
  // Prefer the block parser because it captures all channels inside a transponder; generic parsing remains as fallback.
  return dedupeItems([...dthSatFlexibleCandidates, ...dthSatCandidates, ...blockCandidates, ...genericCandidates]);
}
export function itemKey(item) {
  // v5: several real satellites can share the same orbital slot.
  // Never merge rows only because frequency/polarity/SR match inside a grouped menu option.
  const meta = hydrateFrequencyItem(item || {});
  return [
    normalizeSatelliteGroup(meta.satelliteGroup || meta.satellite || meta.orbit),
    normalizeOrbitSlot(meta.orbitalSlot || meta.orbit || ""),
    normalizeSatelliteName(meta.satelliteName || meta.satellite || meta.satelliteGroup || "").toLowerCase(),
    normalizeFrequency(meta.frequency || ""),
    normalizePol(meta.pol || "") || meta.pol || "",
    normalizeSr(meta.sr || "") || ""
  ].join("|");
}

export function channelSet(item) {
  const values = [];
  if (Array.isArray(item.channels)) values.push(...item.channels);
  if (item.channel) values.push(...String(item.channel).split(/،|,|\+/g));
  return [...new Set(values
    .map(x => safeText(x, 100))
    .filter(Boolean)
    .filter(x => !isLikelyHeaderOrAd(x))
    .filter(x => !/^(frequency\s*polarity|system\s*encryption|symbol\s*rate|video\s*format)$/i.test(x))
  )];
}

export function dedupeItems(items = []) {
  const map = new Map();
  for (const raw of items) {
    if (!raw || !raw.frequency || !raw.pol) continue;
    const item = hydrateFrequencyItem(raw);
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
  const approvedModes = new Set(["auto-approve", "baseline-refresh"]);
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
    const oa = String(a.orbitalSlot || a.orbit || "").localeCompare(String(b.orbitalSlot || b.orbit || ""));
    if (oa) return oa;
    const na = String(a.satelliteName || a.satellite || "").localeCompare(String(b.satelliteName || b.satellite || ""));
    if (na) return na;
    return Number(a.frequency || 0) - Number(b.frequency || 0) || String(a.pol || "").localeCompare(String(b.pol || ""));
  });
  return { items, reviewedOnly, changes, sourceCount: sources.length, checkedAt: now };
}

export async function fetchSourceCandidates(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FREQUENCY_FETCH_TIMEOUT_MS || 4500));
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

export async function mapWithConcurrency(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, Math.min(Number(limit) || 8, list.length || 1));
  const results = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const index = next++;
      try {
        results[index] = await mapper(list[index], index);
      } catch (error) {
        results[index] = {
          source: list[index] || {},
          ok: false,
          error: String(error && error.message || error),
          candidates: []
        };
      }
    }
  }
  await Promise.all(Array.from({ length: max }, worker));
  return results;
}


export const EXPECTED_SOURCE_SERVICE_COUNTS = {
  "Nilesat": "7W position pages show hundreds of rows plus 8W companion pages; use live source count, not the bundled fallback, as truth.",
  "Arabsat / BADR": "BADR/Arabsat + Es'hail neighborhood; official Arabsat plus KingOfSat/LyngSat baseline-refresh sources.",
  "Hot Bird": "13F/13G position pages list well over one thousand services when TV/radio/data/encrypted rows are included.",
  "Eutelsat 16E": "16E position pages list hundreds of services; bundled fallback is only a safety copy.",
  "Amos": "Amos 4W is now audited with DTHSat simple tables + LyngSat Yes/mux pages; Feeds/Data stay marked unknown.",
  "Türksat": "42E includes Turksat 3A/4A/5B/6A; updater imports all published clear/encrypted/radio/data rows.",
  "Yahsat": "52.5E rows are refreshed from LyngSat/KingOfSat plus DTHSat Al Yah 1.",
  "Hellas Sat": "39E rows include LyngSat/KingOfSat plus DTHSat Hellas Sat/Hellas Sat 3 flexible table import.",
  "Eutelsat 36E": "36E rows include Eutelsat 36D/Express AMU1 references plus DTHSat Eutelsat 36.",
  "Intelsat": "68.5E rows include Intelsat 20 references plus DTHSat Intelsat 20."
};

export function buildGroupCounts(items = []) {
  const map = new Map();
  for (const raw of items || []) {
    const item = hydrateFrequencyItem(raw);
    const group = normalizeSatelliteGroup(item.satelliteGroup || item.satellite || item.orbit || "Other");
    const entry = map.get(group) || { satelliteGroup: group, frequencies: 0, services: 0 };
    entry.frequencies += 1;
    entry.services += Math.max(Number(item.channelCount || 0), channelSet(item).length || 1);
    map.set(group, entry);
  }
  return [...map.values()].sort((a, b) => a.satelliteGroup.localeCompare(b.satelliteGroup));
}

export function buildSatelliteIdentityCounts(items = []) {
  const map = new Map();
  for (const raw of items || []) {
    const item = hydrateFrequencyItem(raw);
    const key = item.satelliteIdentityKey || [item.satelliteGroup, item.orbitalSlot, item.satelliteName].join("|");
    const entry = map.get(key) || { satelliteGroup: item.satelliteGroup, orbitalSlot: item.orbitalSlot || item.orbit || "", satelliteName: item.satelliteName || item.satellite || "", frequencies: 0, services: 0 };
    entry.frequencies += 1;
    entry.services += Math.max(Number(item.channelCount || 0), channelSet(item).length || 1);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => String(a.satelliteGroup).localeCompare(String(b.satelliteGroup)) || String(a.orbitalSlot).localeCompare(String(b.orbitalSlot)) || String(a.satelliteName).localeCompare(String(b.satelliteName)));
}

export async function runFrequencyUpdate({ sendEmail = true } = {}) {
  const baseline = await readBaselineData();
  const sources = await readSources();
  // Netlify scheduled functions have a short execution window, so sources are
  // fetched concurrently instead of one-by-one, with short per-source timeouts. This keeps the 24-hour update
  // job from timing out before it reaches the later satellites in the list.
  const sourceResults = await mapWithConcurrency(
    sources,
    process.env.FREQUENCY_SOURCE_CONCURRENCY || 16,
    fetchSourceCandidates
  );
  const candidates = sourceResults.flatMap(r => r.candidates || []);
  const merged = mergeFrequencyData(baseline.items || [], candidates, sources);
  const payload = {
    ok: true,
    mode: "live",
    version: FREQUENCY_DATA_VERSION,
    updatedAt: merged.checkedAt,
    count: merged.items.length,
    groupCounts: buildGroupCounts(merged.items),
    satelliteIdentityCounts: buildSatelliteIdentityCounts(merged.items),
    satellitePositionPolicy: "v5 merge identity = satelliteGroup + orbitalSlot + satelliteName + frequency + polarity + symbolRate. This prevents accidental merging when multiple physical satellites share one orbital position.",
    expectedSourceServiceCounts: EXPECTED_SOURCE_SERVICE_COUNTS,
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
    note: "v5 orbital structure: the updater imports rows as before, but now keeps orbitalSlot + satelliteName + satelliteIdentityKey on every row and uses them in the merge key. Multiple real satellites at the same orbital position are no longer collapsed into one group-level transponder."
  };
  const store = getFrequencyStore();
  await store.setJSON(FREQUENCY_DATA_KEY, payload);
  const report = buildFrequencyReport(payload);
  await store.setJSON(FREQUENCY_REPORT_KEY, report);
  const email = sendEmail ? await sendFrequencyUpdateEmail(report) : { sent: false, reason: "disabled" };
  return { payload, report, email };
}

export const JORDAN_MENA_SATELLITES = [
  { value: "Nilesat", label: "نايل سات / يوتلسات 7W-8W", orbit: "7W/8W", orbitalSlots: ["7W", "8W"], physicalSatellites: ["Nilesat 201/301", "Eutelsat 7 West A", "Eutelsat 8 West B"] },
  { value: "Arabsat", label: "عرب سات / بدر 26E", orbit: "26E", orbitalSlots: ["26E"], physicalSatellites: ["BADR-4/5/6", "BADR-7", "BADR-8"] },
  { value: "Es'hailSat", label: "سهيل سات 25.5E / 25.8E", orbit: "25.5E/25.8E", orbitalSlots: ["25.5E", "25.8E"], physicalSatellites: ["Es'hailSat position", "Es'hail 2"] },
  { value: "Hot Bird", label: "هوت بيرد 13E", orbit: "13E", orbitalSlots: ["13E"], physicalSatellites: ["Hot Bird 13F/13G"] },
  { value: "Eutelsat 16E", label: "يوتلسات 16E", orbit: "16E", orbitalSlots: ["16E"], physicalSatellites: ["Eutelsat 16A"] },
  { value: "Eutelsat 9E", label: "يوتلسات 9E", orbit: "9E", orbitalSlots: ["9E"], physicalSatellites: ["Eutelsat 9B / Ka-Sat 9A"] },
  { value: "Türksat", label: "تركسات 42E", orbit: "42E", orbitalSlots: ["42E"], physicalSatellites: ["Türksat 3A", "Türksat 4A", "Türksat 5B", "Türksat 6A"] },
  { value: "Yahsat", label: "ياه سات 52.5E", orbit: "52.5E", orbitalSlots: ["52.5E"], physicalSatellites: ["Al Yah 1"] },
  { value: "Hellas Sat", label: "هيلاس سات 39E", orbit: "39E", orbitalSlots: ["39E"], physicalSatellites: ["Hellas Sat 3/4"] },
  { value: "Eutelsat 36E", label: "يوتلسات 36E", orbit: "36E", orbitalSlots: ["36E"], physicalSatellites: ["Eutelsat 36D", "Express AMU1"] },
  { value: "Astra", label: "أسترا 19.2E / 28.2E", orbit: "19.2E/28.2E", orbitalSlots: ["19.2E", "28.2E"], physicalSatellites: ["Astra 1KR/1L/1M/1N/1P", "Astra 2E/2F/2G"] },
  { value: "Amos", label: "أموس 4W", orbit: "4W", orbitalSlots: ["4W"], physicalSatellites: ["Amos 3", "Amos 7", "Dror 1"] },
  { value: "Intelsat", label: "إنتلسات 68.5E", orbit: "68.5E", orbitalSlots: ["68.5E"], physicalSatellites: ["Intelsat 20"] },
  { value: "Azerspace", label: "أذر سبيس 46E", orbit: "46E", orbitalSlots: ["46E"], physicalSatellites: ["Azerspace 1"] }
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
    groupCounts: payload.groupCounts || buildGroupCounts(payload.items || []),
    satelliteIdentityCounts: payload.satelliteIdentityCounts || buildSatelliteIdentityCounts(payload.items || []),
    satellitePositionPolicy: payload.satellitePositionPolicy || "orbitalSlot + satelliteName aware merge",
    failedSources: failed,
    note: payload.note
  };
}

export function frequencyReportText(report) {
  const lines = [];
  lines.push("تقرير تحديث الترددات الأسبوعي - معن حنونة للستلايت");
  lines.push(`وقت الفحص: ${report.generatedAt}`);
  lines.push("");
  lines.push(`إجمالي الترددات في قاعدة الموقع: ${report.totalFrequencies}`);
  if ((report.groupCounts || []).length) {
    lines.push("");
    lines.push("عدد الترددات حسب القمر:");
    for (const g of report.groupCounts) lines.push(`- ${g.satelliteGroup}: ${g.frequencies} تردد / ${g.services} خدمة تقريبًا`);
  }
  if ((report.satelliteIdentityCounts || []).length) {
    lines.push("");
    lines.push("تفصيل الأقمار الفعلية داخل كل مدار:");
    for (const s of report.satelliteIdentityCounts.slice(0, 80)) lines.push(`- ${s.satelliteGroup} / ${s.orbitalSlot || "-"} / ${s.satelliteName || "-"}: ${s.frequencies} تردد`);
  }
  lines.push(`المصادر التي تم فحصها: ${report.sourcesChecked}`);
  lines.push(`مصادر فشلت: ${report.sourcesFailed}`);
  lines.push(`ترددات/بيانات تم تحديثها: ${report.changes.updated}`);
  lines.push(`ترددات أضيفت تلقائيًا: ${report.changes.added}`);
  lines.push(`أسماء محطات أضيفت: ${report.changes.channelNamesAdded}`);
  lines.push(`عناصر للمراجعة فقط: ${report.reviewedOnlyCount}`);
  lines.push("");
  lines.push(report.note || "");
  lines.push("ملاحظة تشغيلية: يتم فحص المصادر بالتوازي حتى يكتمل التحديث الأسبوعي ضمن حد وقت Netlify Scheduled Functions.");
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
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma,Arial,sans-serif;background:#f8f5ed;color:#111;line-height:1.7"><main style="max-width:780px;margin:auto;background:#fff;border-radius:22px;padding:24px"><h1>تقرير تحديث الترددات الأسبوعي</h1><p>وقت الفحص: <b>${esc(report.generatedAt)}</b></p><table style="width:100%;border-collapse:collapse">${rows}</table><p>${esc(report.note)}</p>${failed ? `<h2>مصادر تحتاج مراجعة</h2><ul>${failed}</ul>` : ""}</main></body></html>`;
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
