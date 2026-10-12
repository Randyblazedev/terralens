import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esc, siteUrl, trunc, configured, imgSize, rest, facets, categoryPath, cardHtml, jsonLd, breadcrumbLd, breadcrumbHtml, fillTemplate } from "./_lib/seo.js";
import { renderMarkdown, readingMinutes } from "../src/js/markdown.js";

// Server-rendered blog: /blog, /blog/category/:category and /blog/:slug.
// Posts are written by admins in /admin.html and are public to read.
const PAGE = 12;
export const BLOG_CATEGORIES = { "travel-tips": "Travel Tips", destinations: "Destinations", photography: "Photography", guides: "Guides", news: "News" };
let template;
const loadTemplate = () => (template ??= readFileSync(join(process.cwd(), "hub.html"), "utf8"));
const fmt = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function postCard(p) {
  const img = p.cover_url ? `<a href="/blog/${esc(p.slug)}" class="block aspect-[16/9] overflow-hidden bg-white/5" tabindex="-1" aria-hidden="true"><img src="${esc(imgSize(p.cover_url, 640))}" srcset="${esc(imgSize(p.cover_url, 480))} 480w, ${esc(imgSize(p.cover_url, 800))} 800w" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw" alt="${esc(p.title)}" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-700 group-hover:scale-105"></a>` : "";
  return `<article class="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">${img}<div class="p-6"><div class="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300"><a href="/blog/category/${esc(p.category)}" class="hover:underline">${esc(BLOG_CATEGORIES[p.category] || p.category)}</a><span class="text-white/35">${esc(fmt(p.published_at || p.created_at))}</span>${p.is_guest ? '<span class="rounded-full border border-amber-300/40 px-2 py-0.5 text-amber-200">Guest post</span>' : ""}</div><h2 class="font-display text-xl font-bold"><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2><p class="mt-3 text-sm leading-6 text-white/60">${esc(p.excerpt)}</p><a href="/blog/${esc(p.slug)}" class="mt-5 inline-flex text-sm font-bold text-sky-300 hover:underline" aria-label="Read ${esc(p.title)}">Read article</a></div></article>`;
}

function errorPage(res, html, site, status, title, msg) {
  res.setHeader("Cache-Control", status === 404 ? "public, s-maxage=60" : "no-store");
  return res.status(status).send(fillTemplate(html, { title: `${title} | TerraLens`, description: msg, canonical: site + "/blog", robots: "noindex", body: `<main class="tl-section"><div class="tl-shell max-w-2xl text-center"><h1 class="text-4xl font-extrabold">${esc(title)}</h1><p class="mt-4 text-white/55">${esc(msg)}</p><a href="/blog" class="tl-btn tl-btn-primary mt-8">Back to the blog</a></div></main>` }));
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = loadTemplate(), site = siteUrl(req);
  if (!configured()) return errorPage(res, html, site, 404, "Blog not available", "The blog is not available right now.");
  try {
    return req.query.view === "post" ? await post(req, res, html, site) : await list(req, res, html, site);
  } catch {
    return errorPage(res, html, site, 503, "Please try again", "This page could not load right now.");
  }
}

async function list(req, res, html, site) {
  const category = req.query.category ? String(req.query.category) : "";
  if (category && !BLOG_CATEGORIES[category]) return errorPage(res, html, site, 404, "Category not found", "There is no blog category with that name.");
  const page = Math.min(500, Math.max(1, parseInt(req.query.page, 10) || 1)), offset = (page - 1) * PAGE;
  const filter = category ? `&category=eq.${encodeURIComponent(category)}` : "";
  const { rows, total } = await rest(`posts?select=slug,title,excerpt,category,cover_url,published_at,created_at,is_guest&status=eq.published${filter}&order=published_at.desc&limit=${PAGE}&offset=${offset}`, { count: true });
  if (!rows.length && page > 1) return errorPage(res, html, site, 404, "Page not found", "That page of the blog does not exist.");
  const count = total ?? rows.length, pages = Math.max(1, Math.ceil(count / PAGE));
  const base = category ? `/blog/category/${category}` : "/blog", label = category ? BLOG_CATEGORIES[category] : "";
  const h1 = category ? `${label} Articles` : "TerraLens Blog";
  const intro = category ? `Articles about ${label.toLowerCase()} from the TerraLens team: practical advice for planning trips and finding beautiful places.` : "Travel tips, destination guides and photography advice to help you find beautiful places and plan trips that are worth the journey.";
  const title = trunc(category ? `${label}: Travel Articles${page > 1 ? ` (Page ${page})` : ""} | TerraLens Blog` : `TerraLens Blog: Travel Tips, Guides & Photography${page > 1 ? ` (Page ${page})` : ""}`, 62);
  const description = trunc(intro, 158), canonical = site + base + (page > 1 ? `?page=${page}` : "");
  const crumbs = [["Home", "/"], ["Blog", "/blog"], ...(category ? [[label, base]] : [])];
  const href = p => base + (p > 1 ? `?page=${p}` : "");
  const nums = []; for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  const pagination = pages > 1 ? `<nav aria-label="Pagination" class="mt-10 flex flex-wrap items-center justify-center gap-2">${page > 1 ? `<a class="tl-btn tl-btn-ghost !min-h-10" rel="prev" href="${href(page - 1)}">Previous</a>` : ""}${nums.map(p => p === page ? `<span aria-current="page" class="tl-btn tl-btn-primary !min-h-10">${p}</span>` : `<a class="tl-btn tl-btn-ghost !min-h-10" href="${href(p)}">${p}</a>`).join("")}${page < pages ? `<a class="tl-btn tl-btn-ghost !min-h-10" rel="next" href="${href(page + 1)}">Next</a>` : ""}</nav>` : "";
  const chips = [["", "All"], ...Object.entries(BLOG_CATEGORIES)].map(([k, v]) => `<a href="${k ? `/blog/category/${k}` : "/blog"}" class="rounded-full border px-4 py-2 text-sm ${k === category ? "border-sky-300 bg-sky-300/10 text-white" : "border-white/10 text-white/70 hover:bg-white/10"}"${k === category ? ' aria-current="page"' : ""}>${v}</a>`).join("");
  const body = `<main class="tl-section"><div class="tl-shell">${breadcrumbHtml(crumbs)}<p class="tl-eyebrow">Blog</p><h1 class="mt-3 text-4xl font-extrabold sm:text-5xl">${esc(h1)}</h1><p class="mt-4 max-w-3xl leading-7 text-white/60">${esc(intro)}</p><div class="mt-8 flex flex-wrap gap-2">${chips}</div>${rows.length ? `<div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${rows.map(postCard).join("")}</div>` : `<p class="mt-10 text-white/50">No articles here yet. Check back soon.</p>`}${pagination}<section class="mt-16 rounded-3xl border border-white/10 bg-white/[.03] p-6 sm:p-8"><h2 class="text-2xl font-extrabold">Want to write for TerraLens?</h2><p class="mt-2 max-w-2xl leading-7 text-white/60">Our own team writes most articles. If you have a travel or photography story to share, you can publish a guest post for a one-time fee of US$5. Email us to get started.</p><a href="/write-for-us.html" class="tl-btn tl-btn-ghost mt-5">How guest posts work</a></section></div></main>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Blog", name: "TerraLens Blog", url: site + "/blog", description: intro, publisher: { "@type": "Organization", name: "TerraLens", url: site + "/" }, blogPost: rows.map(p => ({ "@type": "BlogPosting", headline: p.title, url: `${site}/blog/${p.slug}`, datePublished: p.published_at || p.created_at, ...(p.cover_url ? { image: imgSize(p.cover_url, 800) } : {}) })) },
    breadcrumbLd(site, crumbs)
  ];
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(rows.length ? 200 : 200).send(fillTemplate(html, { title, description, canonical, image: rows[0]?.cover_url ? imgSize(rows[0].cover_url, 1200) : site + "/assets/og-image.png", ldBlocks: ld.map(jsonLd), body, robots: rows.length ? undefined : "noindex" }));
}

async function post(req, res, html, site) {
  const slug = String(req.query.slug || "").toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return errorPage(res, html, site, 404, "Article not found", "We could not find that article.");
  let p = null;
  try { p = (await rest(`posts?select=*,author:profiles(display_name,username)&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`)).rows[0]; }
  catch { p = (await rest(`posts?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`)).rows[0]; }
  if (!p) return errorPage(res, html, site, 404, "Article not found", "We could not find that article.");

  const [relatedRes, facetRes] = await Promise.all([
    rest(`posts?select=slug,title,excerpt,category,cover_url,published_at,created_at,is_guest&status=eq.published&category=eq.${encodeURIComponent(p.category)}&slug=neq.${encodeURIComponent(p.slug)}&order=published_at.desc&limit=3`).catch(() => ({ rows: [] })),
    facets().catch(() => ({ categories: [] }))
  ]);
  const url = `${site}/blog/${p.slug}`, label = BLOG_CATEGORIES[p.category] || p.category;
  const published = p.published_at || p.created_at, minutes = readingMinutes(p.content), words = String(p.content).trim().split(/\s+/).length;
  const authorName = p.is_guest ? (p.guest_name || "Guest author") : (p.author?.display_name || p.author?.username || "");
  const crumbs = [["Home", "/"], ["Blog", "/blog"], [label, `/blog/category/${p.category}`], [p.title, `/blog/${p.slug}`]];
  const title = trunc(`${p.title} | TerraLens`, 62), description = trunc(p.excerpt, 158);
  const image = p.cover_url ? imgSize(p.cover_url, 1200) : site + "/assets/og-image.png";
  const ld = [
    { "@context": "https://schema.org", "@type": "BlogPosting", headline: trunc(p.title, 110), description: p.excerpt, ...(p.cover_url ? { image: [imgSize(p.cover_url, 1200)] } : {}), datePublished: published, dateModified: p.updated_at || published, articleSection: label, wordCount: words, inLanguage: "en", mainEntityOfPage: { "@type": "WebPage", "@id": url }, author: authorName ? { "@type": "Person", name: authorName, ...(p.is_guest && p.guest_link ? { url: p.guest_link } : {}) } : { "@type": "Organization", name: "TerraLens" }, publisher: { "@type": "Organization", name: "TerraLens", logo: { "@type": "ImageObject", url: site + "/assets/terralens-mark.png" } } },
    breadcrumbLd(site, crumbs)
  ];
  const more = relatedRes.rows.length ? `<section class="mt-16"><h2 class="text-2xl font-extrabold">More articles</h2><div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${relatedRes.rows.map(postCard).join("")}</div></section>` : "";
  const explore = `<section class="mt-16 rounded-3xl border border-white/10 bg-white/[.03] p-6 sm:p-8"><h2 class="text-2xl font-extrabold">Find your next place</h2><p class="mt-2 text-white/60">Browse places by category, or build a day-by-day plan with the free trip planner.</p><div class="mt-5 flex flex-wrap gap-2">${(facetRes.categories || []).slice(0, 6).map(c => `<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="${categoryPath(c.category)}">${esc(c.category)}</a>`).join("")}<a class="rounded-full border border-sky-300/40 px-4 py-2 text-sm text-sky-200 hover:bg-sky-300/10" href="/planner.html">Plan a trip</a></div></section>`;
  const body = `<main class="tl-section"><div class="tl-shell max-w-3xl">${breadcrumbHtml(crumbs)}<article><p class="tl-eyebrow"><a href="/blog/category/${esc(p.category)}" class="hover:underline">${esc(label)}</a></p><h1 class="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">${esc(p.title)}</h1><p class="mt-4 text-sm text-white/45">${p.is_guest ? "Guest post by " : "By "}${p.is_guest && p.guest_link ? `<a href="${esc(p.guest_link)}" rel="sponsored nofollow noopener" target="_blank" class="underline">${esc(authorName)}</a>` : esc(authorName)} · <time datetime="${esc(String(published).slice(0, 10))}">${esc(fmt(published))}</time> · ${minutes} min read</p>${p.cover_url ? `<img src="${esc(imgSize(p.cover_url, 1200))}" srcset="${esc(imgSize(p.cover_url, 640))} 640w, ${esc(imgSize(p.cover_url, 1200))} 1200w" sizes="(min-width:768px) 768px, 100vw" width="1200" height="675" fetchpriority="high" alt="${esc(p.title)}" class="mt-8 aspect-[16/9] w-full rounded-3xl object-cover">` : ""}${p.is_guest ? '<p class="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/[.06] p-4 text-sm leading-6 text-amber-100/80">This is a guest post. The author paid a one-time fee to publish it on TerraLens, links in it are marked as sponsored, and the views are the author\'s own. <a href="/write-for-us.html" class="underline">How guest posts work</a>.</p>' : ""}<div class="mt-6">${renderMarkdown(p.content, { sponsored: !!p.is_guest })}</div></article>${explore}${more}</div></main>`;
  const extraMeta = `<meta property="article:published_time" content="${esc(published)}"><meta property="article:section" content="${esc(label)}">${p.cover_url ? `<link rel="preload" as="image" href="${esc(imgSize(p.cover_url, 1200))}" fetchpriority="high">` : ""}\n`;
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(fillTemplate(html, { title, description, canonical: url, image, ogType: "article", preload: extraMeta, ldBlocks: ld.map(jsonLd), body }));
}
