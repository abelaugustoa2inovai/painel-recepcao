// Busca notícias dos feeds RSS (feeds.json) e grava data.json.
// Roda no GitHub Actions (Node 20+). Sem dependências externas.
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (compatible; PainelRecepcaoRP/1.0; +https://github.com)";
const TIMEOUT_MS = 15000;

const cfg = JSON.parse(await readFile(new URL("./feeds.json", import.meta.url), "utf8"));
const PER = Number(cfg.perCategory) || 5;

// ---------- helpers ----------
const NAMED = { ndash:"–", mdash:"—", hellip:"…", laquo:"«", raquo:"»",
  lsquo:"‘", rsquo:"’", ldquo:"“", rdquo:"”", deg:"°", nbsp:" " };
const decodeEntities = (s = "") =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
   .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
   .replace(/&(ndash|mdash|hellip|laquo|raquo|lsquo|rsquo|ldquo|rdquo|deg|nbsp);/g, (_, k) => NAMED[k])
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&amp;/g, "&");

const stripTags = (s = "") => decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function truncate(s, n) {
  s = (s || "").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return (i > 40 ? cut.slice(0, i) : cut).trim() + "…";
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1] : "";
}

function attr(block, name, at) {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${at}\\s*=\\s*["']([^"']+)["'][^>]*>`, "i"));
  return m ? m[1] : "";
}

function firstImg(html = "") {
  const m = decodeEntities(html).match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function pickImage(block) {
  // ordem de preferência: media:content, media:thumbnail, enclosure, itunes:image, <img> no conteúdo
  let u = attr(block, "media:content", "url")
       || attr(block, "media:thumbnail", "url")
       || attr(block, "enclosure", "url")
       || attr(block, "itunes:image", "href");
  if (!u) u = firstImg(tag(block, "content:encoded")) || firstImg(tag(block, "description"));
  u = (u || "").trim();
  if (u.startsWith("//")) u = "https:" + u;
  return u.startsWith("http") ? u : "";
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*" }, signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

function parseFeed(xml) {
  const channelTitle = stripTags(tag(xml, "title")) || "";
  const source = channelTitle.replace(/\s*[-–|].*$/, "").trim() || channelTitle;
  const out = [];
  // RSS <item> ou Atom <entry>
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripTags(tag(b, "title"));
    if (!title) continue;
    let link = stripTags(tag(b, "link"));
    if (!link) link = attr(b, "link", "href"); // Atom
    const desc = tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded");
    const dateStr = stripTags(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    const ts = dateStr ? Date.parse(dateStr) : 0;
    out.push({
      title: truncate(title, 120),
      summary: truncate(stripTags(desc), 170),
      image: pickImage(b),
      link: link.trim(),
      source,
      published: Number.isFinite(ts) ? ts : 0
    });
  }
  return out;
}

// ---------- main ----------
const seenTitles = new Set();
const allItems = [];

for (const [key, c] of Object.entries(cfg.categories)) {
  const collected = [];
  for (const url of c.feeds) {
    try {
      const xml = await fetchText(url);
      const items = parseFeed(xml);
      collected.push(...items);
      console.log(`[ok] ${key} <- ${url} (${items.length} itens)`);
    } catch (e) {
      console.warn(`[skip] ${key} <- ${url}: ${e.message}`);
    }
  }
  // mais recentes primeiro, remove duplicados por título
  collected.sort((a, b) => b.published - a.published);
  let kept = 0;
  for (const it of collected) {
    const norm = it.title.toLowerCase().slice(0, 60);
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    allItems.push({ category: key, categoryLabel: c.label, ...it });
    if (++kept >= PER) break;
  }
}

const data = { updatedAt: new Date().toISOString(), count: allItems.length, items: allItems };
await writeFile(new URL("./data.json", import.meta.url), JSON.stringify(data, null, 2), "utf8");
console.log(`\nGravado data.json com ${allItems.length} notícias.`);
if (allItems.length === 0) process.exitCode = 1;
