import { clean, cleanUrl } from "./_lib/env.js";
import { verifyUser, hasRole, canHost, rateLimit, clientIp } from "./_lib/guard.js";

const CF_API = "https://api.cloudflare.com/client/v4";

function token() { return clean("CLOUDFLARE_STREAM_TOKEN"); }
function account() { return clean("CLOUDFLARE_ACCOUNT_ID"); }
function configured() { return !!(token() && account()); }

async function cf(path, options = {}) {
  const r = await fetch(CF_API + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + token(),
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) throw new Error((data.errors && data.errors[0] && data.errors[0].message) || ("Cloudflare " + r.status));
  return data.result;
}

async function db(path, userToken, options = {}) {
  const headers = {
    apikey: clean("SUPABASE_PUBLISHABLE_KEY"),
    Authorization: "Bearer " + userToken,
    "Content-Type": "application/json"
  };
  const r = await fetch(cleanUrl("SUPABASE_URL") + "/rest/v1/" + path, {
    method: options.method || "GET", headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || ("db " + r.status));
  return data;
}

// Viewer counts are public and come from Cloudflare, never fabricated.
async function viewerCount(playbackUrl) {
  if (!playbackUrl) return 0;
  try {
    const match = playbackUrl.match(/^https:\/\/customer-([^/]+)\.cloudflarestream\.com\/([^/]+)\//);
    if (!match) return 0;
    const r = await fetch(`https://customer-${match[1]}.cloudflarestream.com/${match[2]}/views`);
    if (!r.ok) return 0;
    const data = await r.json();
    return Number(data.liveViewers) || 0;
  } catch { return 0; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query.action || "list");
  const user = await verifyUser(req);
  const authToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  try {
    if (action === "config") {
      return res.status(200).json({ configured: configured(), canHost: user ? await canHost(req) : false });
    }

    if (action === "list") {
      try {
        const rows = await db("rpc/live_broadcast_list", authToken);
        return res.status(200).json({ broadcasts: Array.isArray(rows) ? rows : [] });
      } catch {
        // Live tables not created yet — show an honest empty state, never an error.
        return res.status(200).json({ broadcasts: [], unavailable: true });
      }
    }

    if (action === "room") {
      const id = String(req.query.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid broadcast" });
      const rows = await db("rpc/live_broadcast_one?p_id=" + encodeURIComponent(id), authToken);
      const room = Array.isArray(rows) ? rows[0] : null;
      if (!room) return res.status(404).json({ error: "Broadcast not found" });
      const comments = await db("broadcast_comments?select=id,body,created_at,user_id,profiles(display_name,username)&broadcast_id=eq." + encodeURIComponent(id) + "&order=created_at.desc&limit=100", authToken);
      const reactions = await db("broadcast_reactions?select=kind&broadcast_id=eq." + encodeURIComponent(id), authToken);
      const counts = {};
      for (const r of (Array.isArray(reactions) ? reactions : [])) counts[r.kind] = (counts[r.kind] || 0) + 1;
      const viewers = await viewerCount(room.playback_url);
      let myRequest = null;
      if (user) {
        const mine = await db("join_requests?select=id,status&broadcast_id=eq." + encodeURIComponent(id) + "&viewer_id=eq." + encodeURIComponent(user.id) + "&limit=1", authToken);
        myRequest = Array.isArray(mine) ? mine[0] || null : null;
      }
      return res.status(200).json({ room, comments: Array.isArray(comments) ? comments : [], reactions: counts, viewers, myRequest });
    }

    if (action === "create") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      if (!configured()) return res.status(503).json({ error: "Live is not configured. Add CLOUDFLARE_STREAM_TOKEN and CLOUDFLARE_ACCOUNT_ID." });
      if (!await canHost(req)) return res.status(403).json({ error: "Only verified hosts can broadcast" });
      if (!await rateLimit("live-create:" + clientIp(req), 10, 3600000)) return res.status(429).json({ error: "Too many broadcasts created. Try later." });
      const body = req.body || {};
      const title = String(body.title || "").trim().slice(0, 140);
      if (title.length < 4) return res.status(400).json({ error: "Add a title of at least 4 characters" });
      const liveInput = await cf("/accounts/" + account() + "/stream/live_inputs", {
        method: "POST",
        body: {
          meta: { name: "TerraLens: " + title },
          recording: { mode: "off" }
        }
      });
      const row = {
        host_id: user.id,
        live_input_uid: liveInput.uid,
        playback_url: (liveInput.playback && liveInput.playback.hls) || "",
        title,
        summary: String(body.summary || "").trim().slice(0, 300),
        category: String(body.category || "culture").slice(0, 40),
        visibility: body.visibility === "restricted" ? "restricted" : "public",
        status: "scheduled",
        starts_at: body.starts_at && !isNaN(Date.parse(body.starts_at)) ? new Date(body.starts_at).toISOString() : null,
        place_id: /^[0-9a-f-]{36}$/i.test(String(body.place_id || "")) ? body.place_id : null
      };
      const created = await db("broadcasts?select=id,live_input_uid,playback_url,status&on_conflict=id", authToken, { method: "POST", body: row });
      const saved = Array.isArray(created) ? created[0] : created;
      return res.status(200).json({
        id: saved.id,
        playbackUrl: saved.playback_url,
        whipUrl: liveInput.webRTC && liveInput.webRTC.url,
        whepUrl: liveInput.webRTCPlayback && liveInput.webRTCPlayback.url
      });
    }

    if (action === "start" || action === "end") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      const id = String((req.body || {}).id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid broadcast" });
      const patch = action === "start"
        ? { status: "live", started_at: new Date().toISOString() }
        : { status: "ended", ended_at: new Date().toISOString() };
      await db("broadcasts?id=eq." + encodeURIComponent(id) + "&host_id=eq." + encodeURIComponent(user.id), authToken, { method: "PATCH", body: patch });
      return res.status(200).json({ ok: true });
    }

    if (action === "comment") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      if (!await rateLimit("live-comment:" + user.id, 60, 60000)) return res.status(429).json({ error: "Slow down" });
      const body = String((req.body || {}).body || "").trim().slice(0, 300);
      const broadcastId = String((req.body || {}).broadcast_id || "");
      if (!body || !/^[0-9a-f-]{36}$/i.test(broadcastId)) return res.status(400).json({ error: "Invalid comment" });
      await db("broadcast_comments", authToken, { method: "POST", body: { broadcast_id: broadcastId, user_id: user.id, body } });
      return res.status(200).json({ ok: true });
    }

    if (action === "react") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      const broadcastId = String((req.body || {}).broadcast_id || "");
      const kind = String((req.body || {}).kind || "like").slice(0, 20);
      if (!/^[0-9a-f-]{36}$/i.test(broadcastId)) return res.status(400).json({ error: "Invalid broadcast" });
      await db("broadcast_reactions?on_conflict=broadcast_id,user_id,kind", authToken, { method: "POST", body: { broadcast_id: broadcastId, user_id: user.id, kind } });
      return res.status(200).json({ ok: true });
    }

    if (action === "join") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      const broadcastId = String((req.body || {}).broadcast_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(broadcastId)) return res.status(400).json({ error: "Invalid broadcast" });
      await db("join_requests?on_conflict=broadcast_id,viewer_id", authToken, { method: "POST", body: { broadcast_id: broadcastId, viewer_id: user.id, status: "pending" } });
      return res.status(200).json({ ok: true });
    }

    if (action === "requests") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      const rows = await db("join_requests?select=id,status,created_at,viewer_id,profiles(display_name,username)&broadcast_id=eq." + encodeURIComponent(String(req.query.id || "")) + "&order=created_at.desc&limit=100", authToken);
      return res.status(200).json({ requests: Array.isArray(rows) ? rows : [] });
    }

    if (action === "decide") {
      if (!user) return res.status(401).json({ error: "Sign in first" });
      const id = String((req.body || {}).id || "");
      const status = (req.body || {}).status === "approved" ? "approved" : "declined";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid request" });
      await db("join_requests?id=eq." + encodeURIComponent(id), authToken, { method: "PATCH", body: { status } });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: "Unknown live action" });
  } catch (err) {
    const message = String((err && err.message) || "Live request failed");
    const status = /not configured/i.test(message) ? 503 : /sign in|verified/i.test(message) ? 403 : 502;
    return res.status(status).json({ error: message });
  }
}
