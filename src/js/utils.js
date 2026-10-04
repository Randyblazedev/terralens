// Returns a same-site relative path, or the fallback. Blocks open redirects
// such as "https://evil.site", "//evil.site" and "javascript:..." values.
export function safeNext(value, fallback = "profile.html") {
  if (!value || typeof value !== "string") return fallback;
  let url;
  try { url = new URL(value, location.origin); } catch { return fallback; }
  if (url.origin !== location.origin) return fallback;
  const path = url.pathname.replace(/^\/+/, "") + url.search + url.hash;
  return path || fallback;
}
