// Reads environment variables defensively. Values pasted on a phone often carry a stray
// space, a newline, quotes, or a trailing slash, which makes servers reject an otherwise correct key.
const strip = value => String(value ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
export const clean = name => strip(process.env[name]);
export const cleanUrl = name => clean(name).replace(/\/+$/, "");
