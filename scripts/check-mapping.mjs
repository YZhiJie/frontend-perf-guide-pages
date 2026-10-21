#!/usr/bin/env node
/**
 * 双向映射校验门禁 check-mapping.mjs
 *
 * 职责（全量模式）：
 *  1. SVG 漫画硬规则校验：viewBox、无外部资源、font-size 显式、单行宽度、引用完整性、标签配平
 *  2. 双向映射校验：
 *     - docs/0N-*.md 末尾必须含「🎬 配套漫画」小节，且指向 comics/EP.0N.svg 与 EP.0N.md
 *     - comics/EP.0N.md 必须含 ≥3 个「### 节点」知识点，每个节点都有指向对应文档锚点的链接
 *  3. 全仓库 md 链接校验（GitHub 风格 slug，含去重后缀），死链即报错
 *  4. comics/manifest.json 与磁盘文件一致性校验
 *
 * 用法：
 *   node scripts/check-mapping.mjs             # 全量校验
 *   node scripts/check-mapping.mjs --svg-only  # 仅校验 SVG（漫画创作时快速自检）
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS_DIR = join(ROOT, "docs");
const COMICS_DIR = join(ROOT, "comics");
const SVG_ONLY = process.argv.includes("--svg-only");

const errors = [];
const err = (file, msg) =>
  errors.push(`[ERROR] ${relative(ROOT, file)} :: ${msg}`);

/* ============ GitHub 风格锚点 slug ============ */
function ghSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** 提取一个 md 文件的标题锚点表（含重复标题的 -1/-2 去重后缀） */
function headingMap(md) {
  const map = new Set();
  const counts = new Map();
  for (const line of md.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const s = ghSlug(m[2].replace(/[*_`]/g, ""));
    const n = counts.get(s) || 0;
    counts.set(s, n + 1);
    map.add(n === 0 ? s : `${s}-${n}`);
  }
  return map;
}

/* ============ SVG 校验 ============ */
function estWidth(text, fs) {
  let w = 0;
  for (const ch of text) {
    if (
      /[\u2E80-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\u3000-\u303F\u2018\u2019\u201C\u201D\u2014\u2026]/.test(
        ch,
      )
    )
      w += fs;
    else if (/[A-Z0-9@#%&WM]/.test(ch)) w += fs * 0.72;
    else if (/[iljtf.,:;'()[\]| ]/.test(ch)) w += fs * 0.42;
    else w += fs * 0.6;
  }
  return w;
}

function checkSvg(file) {
  const src = readFileSync(file, "utf8");
  const rootTag = src.match(/<svg\b[^>]*>/)?.[0];
  if (!rootTag) return err(file, "缺少 <svg> 根元素");
  if (!/viewBox="0 0 1200 840"/.test(rootTag))
    err(file, '根元素 viewBox 必须为 "0 0 1200 840"');
  if (/\s(width|height)="/.test(rootTag))
    err(file, "根元素禁止携带 width/height 属性");
  if (/(href|src)="https?:/.test(src))
    err(file, "禁止外部资源引用（http 的 href/src）");

  const ids = new Set([...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/url\(#([^)]+)\)/g)) {
    if (!ids.has(m[1])) err(file, `url(#${m[1]}) 引用的 id 未在本文件定义`);
  }
  for (const m of src.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(m[1])) err(file, `href="#${m[1]}" 引用的 id 未在本文件定义`);
  }
  for (const m of src.matchAll(/<(text|tspan)\b([^>]*)>/g)) {
    if (!/font-size="/.test(m[2]))
      err(file, `<${m[1]}> 缺少显式 font-size（${m[2].slice(0, 50)}…）`);
  }
  for (const m of src.matchAll(
    /<text\b[^>]*font-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g,
  )) {
    const fs = parseFloat(m[1]);
    for (const seg of m[2].split(/<\/tspan>/)) {
      const line = seg.replace(/<[^>]+>/g, "");
      const w = estWidth(line, fs);
      if (w > 545)
        err(
          file,
          `文本超宽（${Math.round(w)}px > 545px，fs=${fs}）：「${line.slice(0, 24)}…」`,
        );
    }
  }
  const tags = new Set(
    [...src.matchAll(/<([a-zA-Z][\w-]*)/g)].map((m) => m[1]),
  );
  for (const t of tags) {
    const open = (src.match(new RegExp(`<${t}\\b`, "g")) || []).length;
    const close = (src.match(new RegExp(`</${t}>`, "g")) || []).length;
    const self = (src.match(new RegExp(`<${t}\\b[^>]*/>`, "g")) || []).length;
    if (open - self !== close)
      err(
        file,
        `<${t}> 标签不配平（open=${open} self=${self} close=${close}）`,
      );
  }
}

/* ============ Markdown 链接校验 ============ */
function extractLinks(md) {
  return [...md.matchAll(/\[[^\]]*\]\(\s*([^)\s]+)\s*\)/g)].map((m) => m[1]);
}

function checkMdLinks(file, md, cache) {
  const links = extractLinks(md);
  for (const target of links) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [pathPart, anchor] = target.split("#");
    const abs = resolve(dirname(file), pathPart);
    if (!existsSync(abs)) {
      err(file, `死链：(${target})`);
      continue;
    }
    if (anchor && abs.endsWith(".md")) {
      const map = cache.get(abs);
      if (!map) continue;
      if (!map.has(anchor)) {
        err(file, `锚点不存在：(${target})，目标文件无标题 slug「${anchor}」`);
      }
    }
  }
}

/* ============ 结构规则校验（双向映射） ============ */
function checkStructure() {
  const docFiles = readdirSync(DOCS_DIR)
    .filter((f) => /^0[1-9]-.+\.md$/.test(f))
    .sort();

  // 1) 每个文档章节 ↔ 漫画的正向映射
  for (let n = 1; n <= 9; n++) {
    const tag = String(n).padStart(2, "0");
    const doc = docFiles.find((f) => f.startsWith(`${tag}-`));
    if (!doc) {
      err(join(DOCS_DIR, tag), `缺少第 ${n} 章文档（docs/${tag}-*.md）`);
      continue;
    }
    const docPath = join(DOCS_DIR, doc);
    const md = readFileSync(docPath, "utf8");

    const svgPath = join(COMICS_DIR, `EP.${tag}.svg`);
    const mdPath = join(COMICS_DIR, `EP.${tag}.md`);
    if (!existsSync(svgPath))
      err(docPath, `缺少配套漫画 ${relative(ROOT, svgPath)}`);
    if (!existsSync(mdPath))
      err(docPath, `缺少配套讲解稿 ${relative(ROOT, mdPath)}`);

    const idx = md.indexOf("## 🎬 配套漫画");
    if (idx < 0) {
      err(docPath, "章末缺少「## 🎬 配套漫画」小节");
      continue;
    }
    const section = md.slice(idx);
    if (!section.includes(`](../comics/EP.${tag}.svg)`))
      err(docPath, `配套漫画小节缺少链接 ../comics/EP.${tag}.svg`);
    if (!section.includes(`](../comics/EP.${tag}.md)`))
      err(docPath, `配套漫画小节缺少链接 ../comics/EP.${tag}.md`);
    if (!section.includes("| 第"))
      err(docPath, "配套漫画小节缺少「漫画格 ↔ 小节」映射表");
  }

  // 2) 漫画讲解稿 → 文档的反向映射
  for (let n = 1; n <= 9; n++) {
    const tag = String(n).padStart(2, "0");
    const mdPath = join(COMICS_DIR, `EP.${tag}.md`);
    if (!existsSync(mdPath)) continue;
    const md = readFileSync(mdPath, "utf8");
    const docLinkRe = new RegExp(
      `\\]\\(\\.\\./docs/${tag}-[^)#]+\\.md#[^)]+\\)`,
    );
    if (!docLinkRe.test(md))
      err(mdPath, "讲解稿缺少指向对应文档锚点的链接（](../docs/xx.md#...)）");

    const blocks = md.split(/^### /m).slice(1);
    const nodeBlocks = blocks.filter((b) => b.startsWith("节点"));
    if (nodeBlocks.length < 3)
      err(mdPath, `知识点节点不足 3 个（当前 ${nodeBlocks.length} 个）`);
    for (const b of nodeBlocks) {
      if (!b.includes("](../docs/"))
        err(
          mdPath,
          `知识点节点「${b.split("\n")[0].slice(0, 30)}」没有指向文档的跳转链接`,
        );
    }
  }

  // 3) manifest.json 与磁盘一致性
  const manifestPath = join(COMICS_DIR, "manifest.json");
  if (existsSync(manifestPath)) {
    let manifest = null;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (e) {
      err(manifestPath, `manifest.json 解析失败：${e.message}`);
    }
    if (manifest) {
      const eps = Array.isArray(manifest.episodes) ? manifest.episodes : [];
      const seen = new Set();
      for (const ep of eps) {
        const tag = String(ep.ep).padStart(2, "0");
        seen.add(tag);
        if (ep.slug !== `EP.${tag}`)
          err(manifestPath, `EP.${tag} 的 slug 应为 "EP.${tag}"，实际为 "${ep.slug}"`);
        for (const [label, rel] of [
          ["svg", `${ep.slug}.svg`],
          ["notes", `${ep.slug}.md`],
        ]) {
          if (!existsSync(resolve(COMICS_DIR, rel)))
            err(manifestPath, `EP.${tag} 的 ${label} 文件不存在：${rel}`);
        }
        const docRel = `../docs/${ep.part}`;
        if (!existsSync(resolve(COMICS_DIR, docRel)))
          err(manifestPath, `EP.${tag} 的对应文档不存在：${docRel}`);
        if (!String(ep.part).startsWith(`${tag}-`))
          err(manifestPath, `EP.${tag} 的 part 未指向第 ${tag} 章：${ep.part}`);
      }
      const expected = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
      if (seen.size !== 9 || !expected.every((t) => seen.has(t))) {
        err(manifestPath, `manifest 应包含 EP.01~EP.09 全部 9 话（当前 ${seen.size} 话）`);
      }
      const partFiles = new Set((manifest.parts || []).map((p) => p.file));
      for (const ep of eps) {
        if (!partFiles.has(ep.part))
          err(manifestPath, `parts 缺少 EP.${String(ep.ep).padStart(2, "0")} 的映射：${ep.part}`);
      }
    }
  } else if (!SVG_ONLY) {
    err(manifestPath, "缺少 comics/manifest.json");
  }
}

/* ============ 主流程 ============ */
function collectMd(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collectMd(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const svgFiles = existsSync(COMICS_DIR)
  ? readdirSync(COMICS_DIR)
      .filter((f) => /^EP\.\d{2}\.svg$/.test(f))
      .sort()
  : [];
for (const f of svgFiles) checkSvg(join(COMICS_DIR, f));

if (!SVG_ONLY) {
  const cache = new Map();
  for (const f of collectMd(ROOT)) {
    const md = readFileSync(f, "utf8");
    cache.set(f, { md, map: headingMap(md) });
  }
  for (const [f, { md }] of cache)
    checkMdLinks(
      f,
      md,
      new Map([...cache.entries()].map(([k, v]) => [k, v.map])),
    );
  checkStructure();

  // SVG 与讲解稿配对
  for (let n = 1; n <= 9; n++) {
    const tag = String(n).padStart(2, "0");
    const svg = join(COMICS_DIR, `EP.${tag}.svg`);
    const notes = join(COMICS_DIR, `EP.${tag}.md`);
    if (existsSync(svg) && !existsSync(notes))
      err(svg, `漫画缺少同名讲解稿 EP.${tag}.md`);
    if (!existsSync(svg) && existsSync(notes))
      err(notes, `讲解稿缺少同名漫画 EP.${tag}.svg`);
  }
}

console.log("════════════════════════════════════════");
console.log(` 双向映射校验门禁 ${SVG_ONLY ? "(--svg-only)" : "(full)"}`);
console.log("════════════════════════════════════════");
if (errors.length === 0) {
  console.log(
    `✅ 全部通过（SVG×${svgFiles.length}${SVG_ONLY ? "" : "，md 链接与映射结构已校验"}）`,
  );
} else {
  for (const e of errors) console.log(e);
  console.log(`❌ ${errors.length} 个错误`);
  process.exit(1);
}
