// Cloudflare Pages Functions port of the Netlify frequency updater.
// It keeps the same API behavior but stores live data in D1 (MAEN_DB) or KV (MAEN_FREQUENCY_KV).
let __runtimeContext = { env: {}, baseUrl: "" };

export function setRuntimeContext(context = {}) {
  __runtimeContext = {
    env: context.env || {},
    baseUrl: context.request ? new URL(context.request.url).origin : (context.baseUrl || "")
  };
}

function runtimeEnv() {
  return __runtimeContext.env || {};
}

function runtimeBaseUrl() {
  return __runtimeContext.baseUrl || runtimeEnv().PUBLIC_BASE_URL || runtimeEnv().PAGES_BASE_URL || "";
}

function envValue(key, fallback = "") {
  const env = runtimeEnv();
  return env && env[key] !== undefined && env[key] !== null && env[key] !== "" ? String(env[key]) : fallback;
}


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
  const env = runtimeEnv();
  if (env.MAEN_DB && typeof env.MAEN_DB.prepare === "function") {
    return {
      async get(key, options = {}) {
        const row = await env.MAEN_DB.prepare("SELECT json FROM frequency_cache WHERE key = ?").bind(key).first();
        if (!row) return null;
        return options.type === "json" ? JSON.parse(row.json) : row.json;
      },
      async setJSON(key, value) {
        await env.MAEN_DB.prepare("INSERT INTO frequency_cache (key, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at")
          .bind(key, JSON.stringify(value), new Date().toISOString())
          .run();
      }
    };
  }
  if (env.MAEN_FREQUENCY_KV && typeof env.MAEN_FREQUENCY_KV.put === "function") {
    return {
      async get(key, options = {}) {
        return env.MAEN_FREQUENCY_KV.get(key, options.type === "json" ? { type: "json" } : undefined);
      },
      async setJSON(key, value) {
        await env.MAEN_FREQUENCY_KV.put(key, JSON.stringify(value));
      }
    };
  }
  return {
    async get() { return null; },
    async setJSON() { console.warn("No MAEN_DB or MAEN_FREQUENCY_KV binding configured for frequency cache."); }
  };
}

export function authorized(req) {
  const token = envValue("ANALYTICS_ADMIN_TOKEN") || envValue("FREQUENCY_ADMIN_TOKEN") || "";
  if (!token) return false;
  const url = new URL(req.url);
  const given = url.searchParams.get("token") || req.headers.get("x-analytics-token") || req.headers.get("x-frequency-token") || "";
  return given === token;
}

async function fetchJsonAsset(path) {
  const base = runtimeBaseUrl();
  if (!base) throw new Error("Missing runtime base URL for asset fetch");
  const response = await fetch(new URL(path, base).href, { cf: { cacheTtl: 0, cacheEverything: false } });
  if (!response.ok) throw new Error(`Failed loading ${path}: ${response.status}`);
  return response.json();
}

export async function readBaselineData() {
  try {
    const baseline = await fetchJsonAsset("/frequencies/frequency-data.json");
    return baseline && Array.isArray(baseline.items) ? { ...baseline, version: baseline.version || FREQUENCY_DATA_VERSION } : { ok: true, items: [], count: 0, mode: "empty", version: FREQUENCY_DATA_VERSION };
  } catch (error) {
    console.error("Failed reading static frequency baseline", error);
    return { ok: true, items: [], count: 0, mode: "empty", version: FREQUENCY_DATA_VERSION, warning: String(error && error.message || error) };
  }
}

export async function readSources() {
  try {
    const sources = await fetchJsonAsset("/frequencies/frequency-sources.json");
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
    const technicalBlock = [lines[i], ...block];
    const channels = [];
    for (const line of block) {
      const ch = channelNameFromServiceLine(line);
      if (ch && !channels.some(x => x.toLowerCase() === ch.toLowerCase())) channels.push(ch);
    }
    const blockText = technicalBlock.join(" | ");
    const channelName = channels.length ? channels.slice(0, 18).join("، ") + (channels.length > 18 ? ` + ${channels.length - 18} قناة أخرى` : "") : candidateChannelName(lines, i);
    const item = {
      ...candidateBase(source, satelliteGroup),
      channel: channelName || `${satelliteGroup} ${frequency}${pol}`,
      channels,
      frequency,
      pol,
      sr: extractBlockSr(technicalBlock),
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


function normalizeChannelIdentity(value = "") {
  return safeText(value, 140)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/&/g, " and ")
    .replace(/\b(?:tv|channel|channels|hd|sd|uhd|4k|mpeg|dvb|new|old|feed)\b/g, " ")
    .replace(/\b(?:قناة|قناه|قنوات|اتش\s*دي|اس\s*دي|جديد|قديم|اختبار|تجريبي)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function channelIdentityTokens(value = "") {
  const stop = new Set(["al", "el", "the", "and", "و", "ال", "على", "في", "من"]);
  return normalizeChannelIdentity(value).split(" ").filter(t => t.length > 1 && !stop.has(t));
}

function channelNamesOverlap(a = "", b = "") {
  const na = normalizeChannelIdentity(a);
  const nb = normalizeChannelIdentity(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if ((na.length >= 5 && nb.includes(na)) || (nb.length >= 5 && na.includes(nb))) return true;
  const ta = channelIdentityTokens(na);
  const tb = channelIdentityTokens(nb);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  const shared = ta.filter(t => setB.has(t)).length;
  return shared >= 1 && shared / Math.min(ta.length, tb.length) >= 0.67;
}

function closureTransponderKey(item = {}) {
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

function closureBaseKey(item = {}) {
  const meta = hydrateFrequencyItem(item || {});
  return [
    normalizeSatelliteGroup(meta.satelliteGroup || meta.satellite || meta.orbit),
    normalizeOrbitSlot(meta.orbitalSlot || meta.orbit || ""),
    normalizeFrequency(meta.frequency || "")
  ].join("|");
}

function sourceIdentity(value = {}) {
  return safeText(value.id || value.sourceId || value.source || value.name || value.sourceUrl || "unknown-source", 120).toLowerCase();
}

function uniqueBySource(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = sourceIdentity(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}


function hasProgrammingSystem(item = {}) {
  return Boolean(String(item.system || "").trim() && String(item.mod || "").trim());
}

function sourceTuningKey(item = {}) {
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

function mergeTrustedOldTechnicalFields(target = {}, existing = {}) {
  const technicalFields = ["system", "mod", "fec", "sr", "pol"];
  for (const field of technicalFields) {
    if (!String(target[field] || "").trim() && String(existing[field] || "").trim()) {
      target[field] = existing[field];
      target[`${field}CarriedFromBaseline`] = true;
    }
  }
  if (existing.sourceAuditUrl && !target.sourceAuditUrl) target.sourceAuditUrl = existing.sourceAuditUrl;
  if (existing.officialSourceUrl && !target.officialSourceUrl) target.officialSourceUrl = existing.officialSourceUrl;
  return target;
}

function incompleteCandidateReason(item = {}) {
  const missing = [];
  if (!String(item.system || "").trim()) missing.push("system");
  if (!String(item.mod || "").trim()) missing.push("mod");
  return missing.length ? `Missing ${missing.join("/")} from daily source parse` : "";
}

function markCurrentConfirmation(existing = {}, now = "") {
  if (existing.missingStreak) existing.previousMissingStreak = existing.missingStreak;
  delete existing.missingStreak;
  delete existing.lastMissingAt;
  delete existing.missingSince;
  if (existing.currentStatus === "missing-from-daily-scan") existing.currentStatus = "current";
  existing.lastConfirmedAt = now;
  return existing;
}

function applyMissingProtection(item = {}, now = "", minMissingStreak = 3) {
  const nextStreak = Number(item.missingStreak || 0) + 1;
  item.missingStreak = nextStreak;
  item.missingSince = item.missingSince || now;
  item.lastMissingAt = now;
  item.currentStatus = "missing-from-daily-scan";
  item.updateProtection = `Kept because it is missing for ${nextStreak}/${minMissingStreak} protected daily scans.`;
  return item;
}

function sourceQualityAllowsRemoval(sourceQuality = {}) {
  const missing = Number(sourceQuality.missingSystemModCount || 0);
  const total = Number(sourceQuality.totalCandidates || 0);
  if (!total) return false;
  const complete = Math.max(0, total - missing);
  const ratio = missing / total;
  const validTuning = Number(sourceQuality.validTuningCount || 0);
  const validTuningRatio = total ? validTuning / total : 0;
  const maxMissing = Number(envValue("FREQUENCY_MAX_INCOMPLETE_SYSTEM_MOD_FOR_REMOVAL") || 25);
  const maxRatio = Number(envValue("FREQUENCY_MAX_INCOMPLETE_SYSTEM_MOD_RATIO_FOR_REMOVAL") || 0.10);
  const minComplete = Number(envValue("FREQUENCY_MIN_COMPLETE_CANDIDATES_FOR_REMOVAL") || 25);
  const minValidTuning = Number(envValue("FREQUENCY_MIN_VALID_TUNING_FOR_REMOVAL") || 50);
  // Removal matches frequency identity (satellite/orbit/name/frequency/polarity/SR),
  // not the optional system/mod fields. Some trusted comparison pages omit those
  // fields while still providing a valid current tuning row. Allow removal when
  // the scan contains enough valid tuning identities; the existing three-scan
  // missing streak and source-count gates remain active.
  if (validTuning >= minValidTuning && validTuningRatio >= 0.50) return true;
  if (complete >= minComplete) return true;
  return missing <= maxMissing && ratio <= maxRatio;
}

const CLOSED_SIGNAL_RE = /(\bclosed\b|\bceased\b|\bstopped\b|\bshutdown\b|\bshut\s*down\b|\bterminated\b|\bdiscontinued\b|\binactive\b|\bremoved\b|\bdeleted\b|\bleft\b|\bno\s+longer\b|\boff[-\s]?air\b|\bnot\s+broadcasting\b|\btransmission\s+stopped\b|\bservice\s+ended\b|مغلق|اغلق|أغلق|اغلقت|أغلقت|متوقف|توقف|توقفت|اوقفت|أوقفت|اوقف|أوقف|حذف|حذفت|محذوف|ازيل|أزيل|لم\s+تعد|لم\s+يعد|انتهى|انتهت|توقف\s+البث|ايقاف\s+البث|إيقاف\s+البث)/i;

function looksLikeClosedSignal(text = "") {
  return CLOSED_SIGNAL_RE.test(String(text || ""));
}

function bestClosedChannelName(lines = [], center = 0, windowText = "") {
  const bad = /^(frequency|polarization|pol|sr|fec|system|modulation|satellite|transponder|beam|coverage|source|updated|closed|ceased|stopped|removed|deleted|inactive|no longer|off air|مغلق|متوقف|محذوف|توقف البث)$/i;
  const candidates = [];
  const pushCandidate = (value = "") => {
    const cleaned = safeText(value, 120)
      .replace(CLOSED_SIGNAL_RE, " ")
      .replace(/\b(?:has|have|is|are|was|were|been|now|on|at|closed|ceased|stopped|removed|deleted|inactive|left|no\s+longer|off[-\s]?air|broadcasting|transmission|service|frequency|freq)\b/ig, " ")
      .replace(/\b(?:تم|لقد|اصبح|أصبح|على|عند|بث|البث|تردد)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned && cleaned.length >= 2 && cleaned.length <= 90 && !bad.test(cleaned) && !/^[\W\d_]+$/u.test(cleaned)) candidates.push(cleaned);
  };
  for (let i = Math.max(0, center - 6); i <= Math.min(lines.length - 1, center + 4); i++) {
    const raw = stripChannelLineNoise(lines[i] || "");
    if (!raw || raw.length < 2 || bad.test(raw)) continue;
    const beforeFreq = raw.split(/\b\d{4,5}\b/)[0];
    if (looksLikeClosedSignal(raw) && beforeFreq && beforeFreq !== raw) pushCandidate(beforeFreq);
    if (/^\d{4,5}\b/.test(raw) || /\b(?:mhz|sr|fec|dvb|symbol|frequency|polarity)\b/i.test(raw)) continue;
    pushCandidate(raw);
  }
  const compactWindow = safeText(windowText, 260);
  const beforeWindowFreq = compactWindow.split(/\b\d{4,5}\b/)[0];
  if (beforeWindowFreq && beforeWindowFreq !== compactWindow) pushCandidate(beforeWindowFreq);
  const fromText = compactWindow
    .replace(/\b\d{4,5}\b/g, " ")
    .replace(/\b(?:H|V|L|R)\b/g, " ")
    .replace(/\b(?:SR|FEC|DVB|MHz|closed|ceased|stopped|removed|deleted|inactive|left|no\s+longer|off[-\s]?air)\b/ig, " ")
    .replace(CLOSED_SIGNAL_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  pushCandidate(fromText);
  return candidates.sort((a, b) => a.length - b.length)[0] || "";
}

export function extractClosedCandidatesFromHtml(html, source = {}) {
  const lines = htmlToLines(html);
  const closed = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const around = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 5)).join(" | ");
    if (!looksLikeClosedSignal(line) && !looksLikeClosedSignal(around)) continue;
    const freq = normalizeFrequency(around);
    if (!freq) continue;
    const pol = normalizePol(around);
    const sr = normalizeSr(around);
    const channel = bestClosedChannelName(lines, i, around);
    const item = {
      ...candidateBase(source, source.satelliteGroup),
      frequency: freq,
      pol,
      sr,
      channel,
      channels: channel ? [channel] : [],
      source: source.name,
      sourceId: source.id,
      sourceUrl: source.url,
      sourceAuditUrl: source.url,
      authority: source.authority || "reference",
      trust: source.trust || "reference",
      updatePolicy: "closed-signal",
      lastCheckedAt: new Date().toISOString(),
      confidence: source.authority === "official" || source.trust === "official" ? 96 : 76,
      closedSignal: true,
      closedReason: safeText(line || around, 220)
    };
    const key = [closureTransponderKey(item), normalizeChannelIdentity(channel), sourceIdentity(item)].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      closed.push(item);
    }
  }
  return closed;
}

function buildClosedConsensus(closedCandidates = [], candidateGroups = new Map()) {
  const groups = new Map();
  for (const raw of closedCandidates || []) {
    if (!raw || !normalizeFrequency(raw.frequency || "")) continue;
    const item = hydrateFrequencyItem(raw);
    item.frequency = normalizeFrequency(item.frequency);
    item.pol = normalizePol(item.pol) || item.pol || "";
    item.sr = normalizeSr(item.sr || "") || "";
    // Use a base key so pages that say "Channel X on 11766 closed" still match
    // even when that closure note omits polarity or symbol rate.
    const key = closureBaseKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const activeByBaseKey = new Map();
  for (const group of candidateGroups.values()) {
    for (const candidate of group || []) {
      const baseKey = closureBaseKey(candidate);
      if (!activeByBaseKey.has(baseKey)) activeByBaseKey.set(baseKey, []);
      activeByBaseKey.get(baseKey).push(candidate);
    }
  }

  const minSources = Math.max(1, Number(envValue("FREQUENCY_CLOSED_MIN_SOURCES") || 2));
  const minSourcesOfficial = Math.max(1, Number(envValue("FREQUENCY_CLOSED_MIN_SOURCES_OFFICIAL") || 1));
  const consensus = new Map();
  for (const [key, rawGroup] of groups) {
    const group = uniqueBySource(rawGroup);
    const active = activeByBaseKey.get(key) || [];
    const officialClosure = group.some(x => x.authority === "official" || x.trust === "official");
    const activeSources = new Set(active.map(sourceIdentity));
    const closedSources = new Set(group.map(sourceIdentity));
    const activeOutsideClosedSources = [...activeSources].some(src => !closedSources.has(src));
    const sourceThresholdMet = group.length >= minSources || (officialClosure && group.length >= minSourcesOfficial);
    if (!sourceThresholdMet) continue;
    consensus.set(key, {
      key,
      closedSources: group,
      activeCandidates: active,
      hasIndependentActiveConfirmation: activeOutsideClosedSources,
      channelNames: [...new Set(group.flatMap(channelSet))],
      sourceCount: group.length,
      officialClosure,
      hasExactTuning: group.some(x => Boolean(normalizePol(x.pol || "") || normalizeSr(x.sr || ""))),
      sampleReason: group.find(x => x.closedReason)?.closedReason || "closed-consensus"
    });
  }
  return consensus;
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

function channelMoveScope(item = {}) {
  const meta = hydrateFrequencyItem(item);
  return [normalizeSatelliteGroup(meta.satelliteGroup || meta.satellite || meta.orbit), normalizeOrbitSlot(meta.orbitalSlot || meta.orbit || "")].join("|");
}

function channelMoveKey(item, channelName) {
  const normalizedName = safeText(channelName || "", 180).toLowerCase().normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}]+/gu, "");
  return `${channelMoveScope(item)}|${normalizedName}`;
}

function removeChannelMetadata(item, removedNames = []) {
  const metadataFields = ["channelEncryption", "channelEncryptionReason", "channelCountries", "channelCategories", "channelAliases"];
  for (const field of metadataFields) {
    if (!item[field] || typeof item[field] !== "object") continue;
    for (const key of Object.keys(item[field])) {
      if (removedNames.some(name => channelNamesOverlap(key, name))) delete item[field][key];
    }
  }
}

export function mergeFrequencyData(baselineItems, sourceCandidates, sources, options = {}) {
  const now = new Date().toISOString();
  const approvedModes = new Set(["auto-approve", "baseline-refresh"]);
  const baseline = dedupeItems(baselineItems || []).map(item => ({ ...item, baseline: true, confidence: item.confidence || 100 }));
  const byKey = new Map(baseline.map(item => [itemKey(item), item]));
  const baselineByTuning = new Map(baseline.map(item => [sourceTuningKey(item), item]));
  const candidateGroups = new Map();
  for (const cand of dedupeItems(sourceCandidates || [])) {
    const key = itemKey(cand);
    if (!candidateGroups.has(key)) candidateGroups.set(key, []);
    candidateGroups.get(key).push(cand);
  }
  const changes = {
    updated: 0,
    added: 0,
    removed: 0,
    reviewedOnly: 0,
    channelNamesAdded: 0,
    channelNamesRemoved: 0,
    closedConsensusRemoved: 0,
    closedConsensusChannelNamesRemoved: 0,
    closedConsensusReviewed: 0,
    protectedMissing: 0,
    incompleteNewSkipped: 0,
    incompleteExistingProtected: 0,
    movedChannelsRemoved: 0,
    movedRowsRemoved: 0,
    removalSkippedReason: "",
    moveCleanupSkippedReason: ""
  };
  const closedConsensus = buildClosedConsensus(options.closedCandidates || [], candidateGroups);
  const reviewedOnly = [];
  const removedItems = [];
  for (const [key, group] of candidateGroups) {
    const existing = byKey.get(key);
    const official = group.find(x => approvedModes.has(x.updatePolicy || x.mode) || x.authority === "official");
    const consensus = group.length >= 2;
    const chosen = official || (consensus ? group[0] : null);
    if (existing && chosen) {
      markCurrentConfirmation(existing, now);
      mergeTrustedOldTechnicalFields(chosen, existing);
      if (!hasProgrammingSystem(chosen) && hasProgrammingSystem(existing)) {
        changes.incompleteExistingProtected += 1;
      }
      const before = channelSet(existing);
      const current = [...new Set(group.flatMap(channelSet))].filter(Boolean);
      if (current.length) {
        const additions = current.filter(ch => !before.includes(ch));
        const removals = before.filter(ch => !current.includes(ch));
        existing.channels = current;
        existing.channel = current.slice(0, 18).join("، ") + (current.length > 18 ? ` + ${current.length - 18} قناة أخرى` : "");
        existing.channelCount = current.length;
        changes.channelNamesAdded += additions.length;
        changes.channelNamesRemoved += removals.length;
      }
      if (chosen.system && !existing.system) existing.system = chosen.system;
      if (chosen.mod && !existing.mod) existing.mod = chosen.mod;
      if (chosen.fec && !existing.fec) existing.fec = chosen.fec;
      if (chosen.sr && !existing.sr) existing.sr = chosen.sr;
      if (!existing.sourceAuditUrl && chosen.sourceUrl) existing.sourceAuditUrl = chosen.sourceUrl;
      existing.lastCheckedAt = now;
      existing.source = safeText([existing.source, ...group.map(x => x.source)].filter(Boolean).join(" + "), 350);
      existing.confidence = Math.max(existing.confidence || 80, official ? 98 : 82);
      existing.updatePolicy = official ? "daily-refreshed-official" : "daily-refreshed-consensus";
      changes.updated += 1;
    } else if (!existing && chosen) {
      const oldMatch = baselineByTuning.get(sourceTuningKey(chosen));
      const item = mergeTrustedOldTechnicalFields({ ...chosen, baseline: false, lastCheckedAt: now, updatePolicy: official ? "auto-added-official" : "auto-added-consensus", confidence: official ? 92 : 78 }, oldMatch || {});
      if (!hasProgrammingSystem(item)) {
        reviewedOnly.push({ ...item, reviewReason: incompleteCandidateReason(item) || "Incomplete technical system/mod; not auto-published", protection: "Skipped automatic publishing to avoid corrupting frequency-data.json." });
        changes.reviewedOnly += 1;
        changes.incompleteNewSkipped += 1;
      } else {
        byKey.set(key, item);
        changes.added += 1;
      }
    } else {
      reviewedOnly.push({ ...group[0], reviewReason: "Single comparison-only source; not auto-approved" });
      changes.reviewedOnly += 1;
    }
  }

  const removalEnabled = String(envValue("FREQUENCY_REMOVE_MISSING") || "1") !== "0";
  const minCandidates = Number(envValue("FREQUENCY_MIN_CANDIDATES_FOR_REMOVAL") || 50);
  const minSuccessfulSources = Number(envValue("FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_REMOVAL") || 5);
  const successfulSourceCount = Number(options.successfulSourceCount || 0);
  const sourceQualityOk = sourceQualityAllowsRemoval(options.sourceQuality || {});
  const canRemoveMissing = removalEnabled && sourceQualityOk && candidateGroups.size >= minCandidates && successfulSourceCount >= minSuccessfulSources;
  const minMissingStreak = Math.max(1, Number(envValue("FREQUENCY_REMOVE_MISSING_AFTER_CHECKS") || 3));

  // A moved channel must not remain duplicated on its old tuning for three days.
  // Build locations only from an official or multi-source-confirmed current candidate.
  const currentChannelLocations = new Map();
  for (const [candidateKey, group] of candidateGroups) {
    const official = group.find(x => approvedModes.has(x.updatePolicy || x.mode) || x.authority === "official");
    const chosen = official || (group.length >= 2 ? group[0] : null);
    if (!chosen) continue;
    for (const channelName of [...new Set(group.flatMap(channelSet))]) {
      const moveKey = channelMoveKey(chosen, channelName);
      if (!currentChannelLocations.has(moveKey)) currentChannelLocations.set(moveKey, []);
      currentChannelLocations.get(moveKey).push({ candidateKey, channelName });
    }
  }

  const moveCleanupEnabled = String(envValue("FREQUENCY_REMOVE_MOVED_CHANNELS") || "1") !== "0";
  const canCleanupMoved = moveCleanupEnabled && sourceQualityOk && candidateGroups.size >= minCandidates && successfulSourceCount >= minSuccessfulSources;
  if (canCleanupMoved) {
    for (const [oldKey, item] of [...byKey.entries()]) {
      if (item.forceKeep === true || item.keep === true || item.updatePolicy === "manual-keep") continue;
      const currentKey = itemKey(item);
      const oldChannels = channelSet(item);
      const movedChannels = oldChannels.filter(oldChannel => {
        const locations = currentChannelLocations.get(channelMoveKey(item, oldChannel)) || [];
        return locations.some(location => location.candidateKey !== currentKey);
      });
      if (!movedChannels.length) continue;
      const remainingChannels = oldChannels.filter(name => !movedChannels.includes(name));
      removeChannelMetadata(item, movedChannels);
      if (remainingChannels.length) {
        item.channels = remainingChannels;
        item.channel = remainingChannels.slice(0, 18).join("، ") + (remainingChannels.length > 18 ? ` + ${remainingChannels.length - 18} قناة أخرى` : "");
        item.channelCount = remainingChannels.length;
        item.movedChannelsRemoved = [...new Set([...(item.movedChannelsRemoved || []), ...movedChannels])];
        changes.movedChannelsRemoved += movedChannels.length;
      } else {
        byKey.delete(oldKey);
        changes.movedRowsRemoved += 1;
      }
      removedItems.push({
        satelliteGroup: item.satelliteGroup || item.satellite || "",
        orbitalSlot: item.orbitalSlot || item.orbit || "",
        satelliteName: item.satelliteName || item.satellite || "",
        frequency: item.frequency,
        pol: item.pol,
        sr: item.sr,
        channel: movedChannels.join("، "),
        channelCount: movedChannels.length,
        removedAt: now,
        removedReason: "channel-confirmed-on-new-frequency"
      });
    }
  } else if (moveCleanupEnabled) {
    changes.moveCleanupSkippedReason = !sourceQualityOk
      ? "Moved-channel cleanup skipped because source quality was unsafe."
      : "Moved-channel cleanup skipped because daily source coverage was insufficient.";
  }

  let values = [...byKey.values()];
  if (canRemoveMissing) {
    values = values.filter(item => {
      const key = itemKey(item);
      const keep = candidateGroups.has(key) || item.forceKeep === true || item.keep === true || item.updatePolicy === "manual-keep";
      if (!keep) {
        const nextStreak = Number(item.missingStreak || 0) + 1;
        if (nextStreak < minMissingStreak) {
          applyMissingProtection(item, now, minMissingStreak);
          changes.protectedMissing += 1;
          return true;
        }
        removedItems.push({
          satelliteGroup: item.satelliteGroup || item.satellite || "",
          orbitalSlot: item.orbitalSlot || item.orbit || "",
          satelliteName: item.satelliteName || item.satellite || "",
          frequency: item.frequency,
          pol: item.pol,
          sr: item.sr,
          channel: item.channel,
          channelCount: item.channelCount,
          removedAt: now,
          missingStreak: nextStreak,
          removedReason: `missing-from-daily-source-scan-after-${minMissingStreak}-protected-checks`
        });
        changes.removed += 1;
      }
      return keep;
    });
  } else {
    changes.removalSkippedReason = removalEnabled
      ? (!sourceQualityOk
        ? `لم يتم حذف الترددات الغائبة لأن جودة فحص المصادر غير آمنة: ${Number(options.sourceQuality?.missingSystemModCount || 0)} من ${Number(options.sourceQuality?.totalCandidates || 0)} مرشح ناقص system/mod.`
        : `لم يتم حذف الترددات الغائبة لأن التغطية اليومية لم تكن كافية: ${candidateGroups.size} تردد/مرشح و ${successfulSourceCount} مصدر ناجح.`)
      : "الحذف التلقائي للترددات الغائبة متوقف عبر FREQUENCY_REMOVE_MISSING=0.";
  }

  const closedRemovalEnabled = String(envValue("FREQUENCY_REMOVE_CLOSED_CONSENSUS") || "1") !== "0";
  if (closedRemovalEnabled && closedConsensus.size) {
    const nextValues = [];
    for (const item of values) {
      const key = closureBaseKey(item);
      const closed = closedConsensus.get(key);
      if (!closed || item.forceKeep === true || item.keep === true || item.updatePolicy === "manual-keep") {
        nextValues.push(item);
        continue;
      }
      const activeNames = [...new Set((closed.activeCandidates || []).flatMap(channelSet))];
      const closedNames = [...new Set(closed.channelNames || [])];
      const activeSameChannel = closedNames.length && activeNames.some(active => closedNames.some(closedName => channelNamesOverlap(active, closedName)));
      if (closed.hasIndependentActiveConfirmation || activeSameChannel) {
        reviewedOnly.push({
          ...item,
          reviewReason: "Closed signal exists, but an independent/current source still lists the same transponder or channel",
          closedSourceCount: closed.sourceCount,
          closedSources: closed.closedSources.map(s => s.source || s.sourceId || s.name).filter(Boolean).slice(0, 8),
          closedReason: closed.sampleReason
        });
        changes.closedConsensusReviewed += 1;
        nextValues.push(item);
        continue;
      }

      if (!(closed.channelNames || []).length && !closed.hasExactTuning) {
        reviewedOnly.push({
          ...item,
          reviewReason: "Closed signal found without channel name or full tuning details; kept for manual review",
          closedSourceCount: closed.sourceCount,
          closedSources: closed.closedSources.map(s => s.source || s.sourceId || s.name).filter(Boolean).slice(0, 8),
          closedReason: closed.sampleReason
        });
        changes.closedConsensusReviewed += 1;
        nextValues.push(item);
        continue;
      }

      const existingChannels = channelSet(item);
      let removedChannelNames = [];
      let remainingChannels = existingChannels;
      if (closedNames.length && existingChannels.length) {
        removedChannelNames = existingChannels.filter(name => closedNames.some(closedName => channelNamesOverlap(name, closedName)));
        remainingChannels = existingChannels.filter(name => !closedNames.some(closedName => channelNamesOverlap(name, closedName)));
        if (!removedChannelNames.length) {
          nextValues.push(item);
          continue;
        }
      }

      if (remainingChannels.length && removedChannelNames.length) {
        item.channels = remainingChannels;
        item.channel = remainingChannels.slice(0, 18).join("، ") + (remainingChannels.length > 18 ? ` + ${remainingChannels.length - 18} قناة أخرى` : "");
        item.channelCount = remainingChannels.length;
        item.closedConsensusLastAppliedAt = now;
        item.closedConsensusRemovedChannels = removedChannelNames;
        changes.channelNamesRemoved += removedChannelNames.length;
        changes.closedConsensusChannelNamesRemoved += removedChannelNames.length;
        nextValues.push(item);
        continue;
      }

      removedItems.push({
        satelliteGroup: item.satelliteGroup || item.satellite || "",
        orbitalSlot: item.orbitalSlot || item.orbit || "",
        satelliteName: item.satelliteName || item.satellite || "",
        frequency: item.frequency,
        pol: item.pol,
        sr: item.sr,
        channel: removedChannelNames.length ? removedChannelNames.join("، ") : item.channel,
        channelCount: item.channelCount,
        removedAt: now,
        removedReason: "closed-by-source-consensus",
        closedSourceCount: closed.sourceCount,
        closedSources: closed.closedSources.map(s => s.source || s.sourceId || s.name).filter(Boolean).slice(0, 8),
        closedReason: closed.sampleReason
      });
      changes.removed += 1;
      changes.closedConsensusRemoved += 1;
    }
    values = nextValues;
  }

  const items = values.sort((a, b) => {
    const sa = String(a.satelliteGroup || a.satellite || "").localeCompare(String(b.satelliteGroup || b.satellite || ""));
    if (sa) return sa;
    const oa = String(a.orbitalSlot || a.orbit || "").localeCompare(String(b.orbitalSlot || b.orbit || ""));
    if (oa) return oa;
    const na = String(a.satelliteName || a.satellite || "").localeCompare(String(b.satelliteName || b.satellite || ""));
    if (na) return na;
    return Number(a.frequency || 0) - Number(b.frequency || 0) || String(a.pol || "").localeCompare(String(b.pol || ""));
  });
  return { items, reviewedOnly, removedItems, changes, sourceCount: sources.length, checkedAt: now, successfulSourceCount, candidateCount: candidateGroups.size, closedCandidateCount: (options.closedCandidates || []).length, closedConsensusCount: closedConsensus.size };
}

export async function fetchSourceCandidates(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(envValue("FREQUENCY_FETCH_TIMEOUT_MS") || 4500));
  try {
    if (source.mode === "coverage-only") return { source, ok: true, candidates: [], closedCandidates: [], coverageOnly: true };
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "MaenSatFrequencyMonitor/1.0 (+https://maensat.netlify.app; compare/update monitor)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    const text = await response.text();
    const candidates = response.ok ? extractCandidatesFromHtml(text, source) : [];
    const closedCandidates = response.ok ? extractClosedCandidatesFromHtml(text, source) : [];
    return { source, ok: response.ok, status: response.status, candidates, closedCandidates, bytes: text.length };
  } catch (error) {
    return { source, ok: false, error: String(error && error.message || error), candidates: [], closedCandidates: [] };
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
          candidates: [],
          closedCandidates: []
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
    envValue("FREQUENCY_SOURCE_CONCURRENCY") || 16,
    fetchSourceCandidates
  );
  const candidates = sourceResults.flatMap(r => r.candidates || []);
  const closedCandidates = sourceResults.flatMap(r => r.closedCandidates || []);
  const successfulSourceCount = sourceResults.filter(r => r.ok && !r.coverageOnly).length;
  const merged = mergeFrequencyData(baseline.items || [], candidates, sources, { successfulSourceCount, closedCandidates });
  const payload = {
    ok: true,
    mode: "live",
    version: FREQUENCY_DATA_VERSION,
    updatedAt: merged.checkedAt,
    count: merged.items.length,
    removedCount: (merged.removedItems || []).length,
    candidateCount: merged.candidateCount || candidates.length,
    closedCandidateCount: merged.closedCandidateCount || closedCandidates.length,
    closedConsensusCount: merged.closedConsensusCount || 0,
    successfulSourceCount,
    groupCounts: buildGroupCounts(merged.items),
    satelliteIdentityCounts: buildSatelliteIdentityCounts(merged.items),
    satellitePositionPolicy: "v5 merge identity = satelliteGroup + orbitalSlot + satelliteName + frequency + polarity + symbolRate. This prevents accidental merging when multiple physical satellites share one orbital position.",
    expectedSourceServiceCounts: EXPECTED_SOURCE_SERVICE_COUNTS,
    items: merged.items,
    removedItems: (merged.removedItems || []).slice(0, 300),
    reviewedOnly: merged.reviewedOnly.slice(0, 200),
    sourceResults: sourceResults.map(r => ({
      id: r.source.id,
      name: r.source.name,
      ok: r.ok,
      status: r.status || null,
      candidates: (r.candidates || []).length,
      closedCandidates: (r.closedCandidates || []).length,
      coverageOnly: Boolean(r.coverageOnly),
      error: r.error || null
    })),
    changes: merged.changes,
    satellites: JORDAN_MENA_SATELLITES,
    note: "Daily Cloudflare update: imports current trusted satellite sources, refreshes channel names, adds new approved/consensus rows, and removes rows missing from the daily source scan when coverage is sufficient, and deletes rows/channels that multiple trusted sources mark as closed when no current source still confirms them. Multiple real satellites at the same orbital position are kept separate by orbitalSlot + satelliteName + satelliteIdentityKey."
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
    removedCount: payload.removedCount || (payload.removedItems || []).length || 0,
    candidateCount: payload.candidateCount || 0,
    closedCandidateCount: payload.closedCandidateCount || 0,
    closedConsensusCount: payload.closedConsensusCount || 0,
    successfulSourceCount: payload.successfulSourceCount || 0,
    sourcesChecked: checked,
    sourcesFailed: failed.length,
    changes: payload.changes,
    removedItems: (payload.removedItems || []).slice(0, 80),
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
  lines.push("تقرير تحديث الترددات اليومي - معن حنونة للستلايت");
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
  lines.push(`ترددات حُذفت لأنها لم تعد ظاهرة في الفحص اليومي أو تأكد إغلاقها: ${report.changes.removed || report.removedCount || 0}`);
  lines.push(`إشارات إغلاق رصدها الفحص: ${report.closedCandidateCount || 0}`);
  lines.push(`ترددات حُذفت بسبب إجماع مصادر على الإغلاق: ${report.changes.closedConsensusRemoved || 0}`);
  lines.push(`أسماء محطات حُذفت من ترددات قائمة بسبب الإغلاق: ${report.changes.closedConsensusChannelNamesRemoved || 0}`);
  lines.push(`أسماء محطات أضيفت: ${report.changes.channelNamesAdded}`);
  lines.push(`أسماء محطات حُذفت من ترددات قائمة: ${report.changes.channelNamesRemoved || 0}`);
  lines.push(`عناصر للمراجعة فقط: ${report.reviewedOnlyCount}`);
  if (report.changes.removalSkippedReason) lines.push(`ملاحظة الحذف: ${report.changes.removalSkippedReason}`);
  if ((report.removedItems || []).length) {
    lines.push("");
    lines.push("أمثلة على ترددات حُذفت:");
    for (const item of report.removedItems.slice(0, 12)) lines.push(`- ${item.satelliteGroup || "-"} / ${item.orbitalSlot || "-"} / ${item.frequency}${item.pol || ""} SR ${item.sr || "-"}: ${item.channel || "-"}`);
  }
  lines.push("");
  lines.push(report.note || "");
  lines.push("ملاحظة تشغيلية: هذا تقرير Cloudflare اليومي. Netlify بقي كما هو بدون تغيير.");
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
    ["مصادر ناجحة", report.successfulSourceCount],
    ["مرشحات يومية", report.candidateCount],
    ["إشارات إغلاق", report.closedCandidateCount || 0],
    ["إجماعات إغلاق", report.closedConsensusCount || 0],
    ["تحديثات", report.changes.updated],
    ["إضافات تلقائية", report.changes.added],
    ["ترددات حُذفت", report.changes.removed || report.removedCount || 0],
    ["حذف بإجماع الإغلاق", report.changes.closedConsensusRemoved || 0],
    ["محطات حُذفت بسبب الإغلاق", report.changes.closedConsensusChannelNamesRemoved || 0],
    ["أسماء محطات أضيفت", report.changes.channelNamesAdded],
    ["أسماء محطات حُذفت", report.changes.channelNamesRemoved || 0],
    ["للمراجعة فقط", report.reviewedOnlyCount]
  ].map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("");
  const failed = (report.failedSources || []).map(s => `<li>${esc(s.name || s.id)}: ${esc(s.error || s.status || "failed")}</li>`).join("");
  const removed = (report.removedItems || []).slice(0, 20).map(item => `<li>${esc(item.satelliteGroup || "-")} / ${esc(item.orbitalSlot || "-")} / ${esc(item.frequency || "-")}${esc(item.pol || "")} SR ${esc(item.sr || "-")}: ${esc(item.channel || "-")}</li>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma,Arial,sans-serif;background:#f8f5ed;color:#111;line-height:1.7"><main style="max-width:860px;margin:auto;background:#fff;border-radius:22px;padding:24px"><h1>تقرير تحديث الترددات اليومي</h1><p>وقت الفحص: <b>${esc(report.generatedAt)}</b></p><table style="width:100%;border-collapse:collapse">${rows}</table>${report.changes.removalSkippedReason ? `<p><b>ملاحظة الحذف:</b> ${esc(report.changes.removalSkippedReason)}</p>` : ""}<p>${esc(report.note)}</p>${removed ? `<h2>أمثلة على ترددات حُذفت</h2><ul>${removed}</ul>` : ""}${failed ? `<h2>مصادر تحتاج مراجعة</h2><ul>${failed}</ul>` : ""}</main></body></html>`;
}

export async function sendFrequencyUpdateEmail(report) {
  const apiKey = envValue("RESEND_API_KEY") || "";
  const to = envValue("FREQUENCY_REPORT_EMAIL") || envValue("REPORT_EMAIL") || "";
  const from = envValue("REPORT_FROM") || "Maen Analytics <onboarding@resend.dev>";
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
