#!/usr/bin/env node
/**
 * GitHub Pages 静态站点构建脚本 build-pages.mjs
 *
 * 职责：把本仓库的 markdown 教程渲染成**自包含**的静态 HTML 站点，
 * 输出到 dist-pages/，供推送到独立部署仓库（frontend-perf-guide-pages）
 * 由 GitHub Pages 托管。站点目录结构镜像源码仓库，因此文档/漫画之间的
 * 相对链接（.md → .html）可原样沿用。
 *
 * 用法：node scripts/build-pages.mjs   （等价 npm run build:pages）
 * 依赖：marked（仅构建期使用，站点产物零外部依赖）
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "dist-pages");

const SITE = {
  name: "前端性能优化完全学习指南",
  repo: "https://github.com/YZhiJie/frontend-perf-guide",
  pages: "https://yzhijie.github.io/frontend-perf-guide-pages/",
};

/* ---------- GitHub 风格锚点 slug（与 scripts/check-mapping.mjs 完全一致） ---------- */
function ghSlug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s\-_]/gu, "").trim().replace(/\s+/g, "-");
}

/* ---------- markdown → HTML ---------- */
const marked = new Marked({ gfm: true });

function render(md) {
  let html = marked.parse(md);
  // 1) 为标题补 GitHub 风格 id（含重复标题去重后缀），保证站内锚点可跳转
  const counts = new Map();
  html = html.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/g, (_full, tag, inner) => {
    const text = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const base = ghSlug(text);
    const n = counts.get(base) || 0;
    counts.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  // 2) 站内 markdown 链接 → html（保留锚点）
  html = html.replace(/href="([^"]*?)\.md(#[^"]*)?"/g, (_m, p, anchor) => `href="${p}.html${anchor || ""}"`);
  return html;
}

/* ---------- 页面外壳 ---------- */
const CSS = `
:root{--fg:#1f2328;--muted:#57606a;--line:#d0d7de;--accent:#f97316;--link:#0969da;--code-bg:#f6f8fa}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:var(--fg);background:#fff;line-height:1.75}
header.top{position:sticky;top:0;background:#0f172a;color:#e2e8f0;padding:12px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;z-index:10}
header.top .brand{font-weight:700;color:#fff}
header.top .brand em{color:var(--accent);font-style:normal}
header.top nav{margin-left:auto;display:flex;gap:16px;flex-wrap:wrap}
header.top nav a{color:#cbd5e1;text-decoration:none;font-size:14px}
header.top nav a:hover{color:var(--accent)}
header.top nav a.active{color:#fff;border-bottom:2px solid var(--accent);padding-bottom:2px}
main{max-width:880px;margin:0 auto;padding:28px 20px 64px}
main h1{font-size:28px;border-bottom:1px solid var(--line);padding-bottom:.3em}
main h2{font-size:22px;border-bottom:1px solid var(--line);padding-bottom:.3em;margin-top:2em}
main h3{font-size:18px;margin-top:1.6em}
main img{max-width:100%}
a{color:var(--link)}
code{background:var(--code-bg);padding:.15em .35em;border-radius:4px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto}
pre code{background:none;color:inherit;padding:0;font-size:13px}
table{border-collapse:collapse;width:100%;margin:1em 0;display:block;overflow:auto}
th,td{border:1px solid var(--line);padding:6px 12px;text-align:left}
th{background:var(--code-bg)}
blockquote{border-left:4px solid var(--accent);margin:1em 0;padding:.3em 1em;color:var(--muted);background:#fff7ed}
hr{border:none;border-top:1px solid var(--line);margin:2em 0}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;text-align:center;padding:20px 16px}
footer a{color:var(--link);text-decoration:none}
`;

function shell({ title, rel, body, active }) {
  const nav = (label, href, key) =>
    `<a href="${href}"${active === key ? ' class="active"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · ${SITE.name}</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <span class="brand"><em>前端性能</em>完全指南</span>
  <nav>
    ${nav("首页", rel + "index.html", "home")}
    ${nav("标准文档", rel + "docs/README.html", "docs")}
    ${nav("漫画剧场", rel + "comics/index.html", "comics")}
    ${nav("源码仓库", SITE.repo, "")}
  </nav>
</header>
<main>
${body}
</main>
<footer>
  双形态联动学习体系 ｜ 标准文档 + 漫画剧场 ｜
  源码仓库 <a href="${SITE.repo}">GitHub</a> ｜
  在线站点 <a href="${SITE.pages}">${SITE.pages}</a>
</footer>
</body>
</html>
`;
}

/* ---------- 工具 ---------- */
const titleOf = (md, fallback) => {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/[*_`]/g, "") : fallback;
};

const write = (rel, content) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

/* ---------- 构建 ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let pages = 0;

// 1) 根 README → index.html（站点首页）
{
  const md = readFileSync(join(ROOT, "README.md"), "utf8");
  write("index.html", shell({ title: titleOf(md, SITE.name), rel: "", body: render(md), active: "home" }));
  pages++;
}

// 2) docs/*.md → docs/*.html
for (const f of readdirSync(join(ROOT, "docs")).filter((n) => n.endsWith(".md")).sort()) {
  const md = readFileSync(join(ROOT, "docs", f), "utf8");
  write(`docs/${f.replace(/\.md$/, ".html")}`,
    shell({ title: titleOf(md, f), rel: "../", body: render(md), active: "docs" }));
  pages++;
}

// 3) comics/*.md → comics/*.html
for (const f of readdirSync(join(ROOT, "comics")).filter((n) => /^EP\.\d{2}\.md$/.test(n) || n === "README.md").sort()) {
  const md = readFileSync(join(ROOT, "comics", f), "utf8");
  write(`comics/${f.replace(/\.md$/, ".html")}`,
    shell({ title: titleOf(md, f), rel: "../", body: render(md), active: "comics" }));
  pages++;
}

// 4) 复制漫画 SVG
for (const f of readdirSync(join(ROOT, "comics")).filter((n) => /^EP\.\d{2}\.svg$/.test(n))) {
  cpSync(join(ROOT, "comics", f), join(OUT, "comics", f));
}

// 5) 复制并改写漫画阅读器与清单（.md → .html）
{
  const reader = readFileSync(join(ROOT, "comics", "index.html"), "utf8")
    .replace(/\.md(?=["#)])/g, ".html")
    .replace(/\.md"/g, '.html"');
  write("comics/index.html", reader);
  const manifest = readFileSync(join(ROOT, "comics", "manifest.js"), "utf8").replace(/\.md'/g, ".html'");
  write("comics/manifest.js", manifest);
}

// 6) 复制示例集（文档中 ../examples/... 链接指向这些可运行示例）
cpSync(join(ROOT, "examples"), join(OUT, "examples"), { recursive: true });

// 6b) 复制校验脚本（README 中引用了 scripts/check-mapping.mjs）
cpSync(join(ROOT, "scripts"), join(OUT, "scripts"), { recursive: true });

// 7) 关闭 Jekyll 处理 + 404
const BASE = new URL(SITE.pages).pathname; // 站点根路径，如 /frontend-perf-guide-pages/
write(".nojekyll", ""); // 关闭 Jekyll，按原样托管静态文件
write("404.html", shell({
  title: "404 · 页面未找到",
  rel: BASE,
  active: "",
  body: `<h1>404 · 页面未找到</h1>
<p>你访问的页面不存在。可返回 <a href="${BASE}">首页</a>，或浏览
<a href="${BASE}docs/README.html">标准文档</a> 与 <a href="${BASE}comics/index.html">漫画剧场</a>。</p>`,
}));

console.log(`✅ 站点已生成 → dist-pages/（共 ${pages} 个内容页 + 9 张漫画 SVG + 示例集）`);
