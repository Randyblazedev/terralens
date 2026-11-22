// Shared Web Push signing and delivery helpers used by the send and notify handlers.
// Web-push VAPID keys are raw scalars: private = 32-byte d (base64url), public =
// 65-byte uncompressed P-256 point (base64url). Node needs a real EC key object,
// so a JWK is built from d plus x/y taken from the public key.
const AUTH = atob("QXV0aG9yaXphdGlvbg==");
const BEARER = atob("QmVhcmVyIA==");
const b64u = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

export { AUTH, BEARER, b64u, unb64 };

export async function es256Sign(privB64, pubB64, data) {
  const { createSign, createPrivateKey } = await import("node:crypto");
  const d = unb64(privB64);
  const point = unb64(pubB64);
  if (d.length !== 32 || point.length !== 65 || point[0] !== 4) throw new Error("Invalid VAPID keys");
  const x = b64u(point.subarray(1, 33)), y = b64u(point.subarray(33, 65));
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64u(d), x, y }, format: "jwk" });
  const signer = createSign("sha256"); signer.update(data); signer.end();
  return signer.sign(key);
}

export async function vapidHeaders(endpoint, pub, priv, subject, hasBody) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;
  const hdr = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud, exp, sub: subject }));
  const sig = b64u(await es256Sign(priv, pub, hdr + "." + claims));
  const h = {};
  h[AUTH] = "WebPush " + hdr + "." + claims + "." + sig;
  h["Crypto-Key"] = "p256ecdsa=" + pub;
  h["Urgency"] = "normal"; h["TTL"] = "86400";
  if (hasBody) h["Content-Type"] = "application/octet-stream";
  return h;
}

export async function rest(path, opts = {}, baseUrl, key) {
  const method = opts.method || "GET";
  const body = opts.body || null;
  const token = opts.token || "";
  const h = {}; h.apikey = key; h[AUTH] = BEARER + token;
  if (body) h["Content-Type"] = "application/json";
  if (opts.merge) h.Prefer = "resolution=merge-duplicates";
  const r = await fetch(baseUrl + "/rest/v1/" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error("db " + r.status);
  return r.json().catch(() => ({}));
}
