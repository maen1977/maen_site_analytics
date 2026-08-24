import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/data/sports-news.json");
const PREVIOUS_DATA_PATH = process.env.SPORTS_PREVIOUS_DATA || "";
const API_KEY = process.env.OPENAI_API_KEY || "";
const API_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const MAX_RETRIES = 3;
const MAX_TRANSLATED_LENGTH = 2200;
const ENGLISH_LETTERS = /[A-Za-z]/;
const SOURCE_NAMES_EN = {
  "okaz-arabic-sport": "Okaz - Football",
  "masryalyoum-arabic-sport": "Al-Masry Al-Youm - Football",
  "almala3b-jordan-sport": "Al-Mala3b Sports - Jordan - Football",
};

if (!API_KEY) throw new Error("OPENAI_API_KEY is required to publish a complete English football view");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizedText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function validateEnglish(value, label, maxLength = MAX_TRANSLATED_LENGTH) {
  const text = normalizedText(value);
  if (!text || text.length > MAX_TRANSLATED_LENGTH || !ENGLISH_LETTERS.test(text)) {
    throw new Error(`${label} is empty, too long, or not English`);
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function previousTranslations(previous) {
  const byUrl = new Map();
  for (const item of Array.isArray(previous?.items) ? previous.items : []) {
    if (item?.url && item.titleEn && item.summaryEn && item.contentEn) {
      byUrl.set(item.url, {
        titleEn: item.titleEn,
        summaryEn: item.summaryEn,
        contentEn: item.contentEn,
      });
    }
  }
  return byUrl;
}

async function translateItem(item, index) {
  const prompt = [
    "Translate this Arabic football news item into natural, accurate English.",
    "Return only the requested JSON object. Do not add facts, commentary, markdown, or a URL.",
    "Preserve club names, player names, competitions, dates, scores, and numbers; use standard English football terminology.",
    "The source text may be an excerpt, so do not invent missing details.",
    JSON.stringify({
      title: item.title,
      summary: item.summary,
      content: item.content || item.summary,
    }),
  ].join("\n\n");

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: "You are a precise Arabic-to-English football news translator. Output JSON only.",
            },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: 3000,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "football_translation",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  titleEn: { type: "string" },
                  summaryEn: { type: "string" },
                  contentEn: { type: "string" },
                },
                required: ["titleEn", "summaryEn", "contentEn"],
                additionalProperties: false,
              },
            },
          },
        }),
      });
      if (!response.ok) throw new Error(`translation API HTTP ${response.status}`);
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      const translated = JSON.parse(content || "{}");
      return {
        titleEn: validateEnglish(translated.titleEn, `item ${index} titleEn`, 180),
        summaryEn: validateEnglish(translated.summaryEn, `item ${index} summaryEn`, 360),
        contentEn: validateEnglish(translated.contentEn, `item ${index} contentEn`, 1800),
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(attempt * 1000);
    }
  }
  throw new Error(`translation failed for item ${index}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

const data = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
if (!Array.isArray(data.items) || data.items.length < 1) throw new Error("No football items to translate");
if (!data.items.every((item) => item?.language === "ar" && item?.sport === "football")) {
  throw new Error("Refusing to translate a dataset that is not Arabic football-only data");
}

let previous = {};
if (PREVIOUS_DATA_PATH) {
  try {
    previous = JSON.parse(await fs.readFile(PREVIOUS_DATA_PATH, "utf8"));
  } catch {
    previous = {};
  }
}
const cached = previousTranslations(previous);
const translated = new Array(data.items.length);
let nextIndex = 0;
async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= data.items.length) return;
    const item = data.items[index];
    const cachedTranslation = cached.get(item.url);
    translated[index] = cachedTranslation || await translateItem(item, index + 1);
    console.log(`${cachedTranslation ? "Reused" : "Translated"} ${index + 1}/${data.items.length}`);
  }
}
await Promise.all(Array.from({ length: Math.min(4, data.items.length) }, worker));

const output = {
  ...data,
  translationModel: MODEL,
  translationGeneratedAt: new Date().toISOString(),
  translationStatus: "complete",
  sources: data.sources.map((source) => ({
    ...source,
    nameEn: SOURCE_NAMES_EN[source.id] || source.nameEn || source.name,
  })),
  items: data.items.map((item, index) => ({ ...item, ...translated[index] })),
};
const temporary = `${OUTPUT}.translation-${process.pid}.tmp`;
await fs.writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await fs.rename(temporary, OUTPUT);
console.log(`English football translations complete: ${output.items.length} items; reused ${data.items.length - translated.filter((_, index) => !cached.has(data.items[index].url)).length} cached translations.`);
