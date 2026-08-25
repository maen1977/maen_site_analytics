import fs from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const pages = [
  {
    file: "public/index.html",
    fallback: "home",
  },
  {
    file: "public/index_phone.html",
    fallback: "maintenance",
  },
];
const validPages = [
  "home",
  "devices",
  "softwares",
  "maintenance",
  "works",
  "receiverSoftware",
  "frequencies",
  "sports",
  "worldcup2026",
  "contact",
];

for (const { file, fallback } of pages) {
  const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const escapedFallback = fallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const loaderPattern = new RegExp(
    `var requestedPage=\\(window\\.location\\.hash\\|\\|''\\)\\.replace\\(/\\^#\\/,''\\);var initialPage=document\\.getElementById\\(requestedPage\\)\\?requestedPage:'${escapedFallback}'`,
  );
  if (!loaderPattern.test(html)) {
    throw new Error(`${file}: load handler must prefer a valid hash and use ${fallback} only as fallback`);
  }
  if (!html.includes('/assets/maensat-enhancements.js?v=20260824-sports-v1')) {
    throw new Error(`${file}: latest enhancements cache-buster is missing`);
  }
  if ((html.match(/maensat-enhancements\.js\?v=/g) || []).length !== 1) {
    throw new Error(`${file}: expected exactly one cache-busted enhancements script`);
  }
}

const enhancements = fs.readFileSync(new URL("../public/assets/maensat-enhancements.js", import.meta.url), "utf8");
if (!enhancements.includes("var requested = hashPage() || (isMobileVersion ? \"maintenance\" : \"home\");")) {
  throw new Error("maensat-enhancements.js: initial page must prefer a valid hash");
}
for (const page of validPages) {
  if (!enhancements.includes(`\"${page}\"`)) {
    throw new Error(`maensat-enhancements.js: missing valid page ${page}`);
  }
}

console.log("Direct section link checks passed for desktop and mobile.");
