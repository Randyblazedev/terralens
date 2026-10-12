// A small, safe Markdown renderer for blog posts. All text is escaped first, and only a fixed set of
// formatting is turned into HTML (headings, paragraphs, lists, quotes, bold, italic, code, links, images).
// Used on the server (public blog pages) and in the admin preview, so both look the same.
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function inline(raw, opts = {}) {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1.5 py-0.5 text-[.9em]">$1</code>');
  s = s.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" decoding="async" class="my-6 w-full rounded-2xl">`);
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (m, text, url) => {
    const external = /^https?:/.test(url);
    return `<a href="${url}"${external ? ` rel="${opts.sponsored ? "sponsored nofollow noopener" : "noopener nofollow"}" target="_blank"` : ""} class="text-sky-300 underline underline-offset-2 hover:text-sky-200">${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return s;
}

export function renderMarkdown(src, opts = {}) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      // "#" is shown as a second-level heading because the page title is already the only H1.
      const level = m[1].length === 3 ? 3 : 2;
      out.push(level === 2 ? `<h2 class="mt-10 text-2xl font-extrabold text-white">${inline(m[2], opts)}</h2>` : `<h3 class="mt-8 text-xl font-bold text-white">${inline(m[2], opts)}</h3>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr class="my-10 border-white/10">'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote class="mt-6 border-l-4 border-sky-300/50 pl-4 italic text-white/60">${inline(quote.join(" "), opts)}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(`<ul class="mt-5 list-disc space-y-2 pl-6 leading-8 text-white/70">${items.map(t => `<li>${inline(t, opts)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+[.)]\s+/, ""));
      out.push(`<ol class="mt-5 list-decimal space-y-2 pl-6 leading-8 text-white/70">${items.map(t => `<li>${inline(t, opts)}</li>`).join("")}</ol>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>\s?|-{3,}\s*$)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p class="mt-5 leading-8 text-white/70">${inline(para.join(" "), opts)}</p>`);
  }
  return out.join("\n");
}

export const readingMinutes = text => Math.max(1, Math.round(String(text || "").trim().split(/\s+/).length / 200));
