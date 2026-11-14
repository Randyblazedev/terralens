// Full aes128gcm Web Push encryption (RFC 8291 s3 + RFC 8188 s2.2), no dependencies.
import { createECDH, createHmac, createCipheriv, randomBytes } from "node:crypto";

export function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=+$/g, "");
}
export function b64urlDecode(s) {
  let t = String(s || "");
  while (t.length % 4) t += "=";
  return Uint8Array.from(Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}
function hkdfExpand(prk, info, len) {
  const out = []; let prev = Buffer.alloc(0); let counter = 0;
  while (Buffer.concat(out).length < len) {
    counter += 1;
    const h = createHmac("sha256", prk);
    h.update(Buffer.concat([prev, Buffer.from(info), Buffer.from([counter])]));
    prev = h.digest(); out.push(prev);
  }
  return Buffer.concat(out).subarray(0, len);
}
export function encryptAes128gcm(subB64, unusedAuthB64, payloadStr, saltOverride) {
  void unusedAuthB64;
  const rawRemote = Buffer.from(b64urlDecode(subB64.p256dh));
  const pubRemote = rawRemote.length === 65 ? rawRemote : Buffer.concat([Buffer.from([4]), rawRemote]);
  const authSecret = Buffer.from(b64urlDecode(subB64.auth));
  const salt = saltOverride || randomBytes(16);
  const local = createECDH("prime256v1");
  local.generateKeys();
  const pubLocal = local.getPublicKey();
  const secret = local.computeSecret(pubRemote);
  const ctx = Buffer.concat([Buffer.from([0, 65]), pubRemote, Buffer.from([0, 65]), pubLocal]);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info" + String.fromCharCode(0)), Buffer.from("P-256"), Buffer.from([0]), ctx]);
  const prk = createHmac("sha256", authSecret).update(secret).digest();
  const ikm = hkdfExpand(Buffer.concat([salt, prk]), Buffer.concat([keyInfo, Buffer.from([1])]), 32);
  const cekInfo = Buffer.concat([Buffer.from("Content-Encoding: aes128gcm" + String.fromCharCode(0)), Buffer.from("P-256"), Buffer.from([0]), ctx]);
  const cek = hkdfExpand(Buffer.concat([salt, prk]), Buffer.concat([cekInfo, Buffer.from([1])]), 16);
  const nonceInfo = Buffer.concat([Buffer.from("Content-Encoding: nonce" + String.fromCharCode(0)), Buffer.from("P-256"), Buffer.from([0]), ctx]);
  const nonce = hkdfExpand(Buffer.concat([salt, prk]), Buffer.concat([nonceInfo, Buffer.from([1])]), 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const pt = Buffer.concat([Buffer.from(payloadStr, "utf8"), Buffer.from([2])]);
  const ct = Buffer.concat([cipher.update(pt), cipher.final(), cipher.getAuthTag()]);
  const rs = 4096;
  const header = Buffer.concat([salt, Buffer.from([(rs >> 24) & 255, (rs >> 16) & 255, (rs >> 8) & 255, rs & 255]), Buffer.from([pubLocal.length]), pubLocal]);
  return { body: Buffer.concat([header, ct]), pubLocal };
}
