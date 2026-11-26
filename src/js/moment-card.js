import { supabase } from "./supabase.js";
import { escapeHtml, imgSize } from "./app.js?v=20261125fix";

const icons = {
  heart: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  badge: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 12 2 2 4-4"/><path d="M12 3.2l2.1 1.5 2.6-.2 1 2.4 2.2 1.4-.7 2.5.7 2.5-2.2 1.4-1 2.4-2.6-.2L12 20.8l-2.1-1.5-2.6.2-1-2.4L4.1 15.7l.7-2.5-.7-2.5 2.2-1.4 1-2.4 2.6.2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  images: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'
};

function timeAgo(timestamp) {
  const created = new Date(timestamp).getTime();
  if (!Number.isFinite(created)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(created).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function authorOf(moment, session) {
  const profile = moment.profiles || {};
  const own = !!(session && moment.user_id === session.user.id);
  const name = own
    ? (session.user.user_metadata?.full_name || session.user.user_metadata?.name || profile.display_name || profile.username || "Traveler")
    : (profile.display_name || profile.username || "Traveler");
  const avatar = own
    ? (session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url || profile.avatar_url || "")
    : (profile.avatar_url || "");
  const verified = !!profile.verified || ["verified_host", "business", "admin"].includes(profile.role || "");
  return { name, avatar, verified, own };
}

function mediaMarkup(moment) {
  const mediaUrl = escapeHtml(moment.media_url || "");
  const label = moment.kind === "video" ? "Short video" : "Photo";
  const media = moment.kind === "video"
    ? `<video src="${mediaUrl}" controls playsinline aria-label="Moment video"></video>`
    : `<img src="${mediaUrl}" alt="${escapeHtml(moment.caption || "World Moment")}" loading="lazy">`;
  return `<div class="moment-media-v2">
    ${media}
    <span class="moment-media-count">${icons.images} 1/1</span>
    <span class="moment-media-kind">${label}</span>
  </div>`;
}

function locationMarkup(moment) {
  const place = moment.places;
  if (!place || !place.id) return "";
  const label = [place.name, place.country].filter(Boolean).join(", ");
  return `<a class="moment-location" href="place/${encodeURIComponent(place.id)}">${icons.pin}<span>${escapeHtml(label)}</span>${icons.arrow}</a>`;
}

export function momentCard(moment, session) {
  const author = authorOf(moment, session);
  const avatar = author.avatar
    ? `<img class="moment-avatar" src="${escapeHtml(imgSize(author.avatar, 120))}" alt="" referrerpolicy="no-referrer">`
    : `<span class="moment-avatar moment-avatar-fallback">${escapeHtml(author.name.charAt(0).toUpperCase())}</span>`;
  const place = moment.places || {};
  const supporting = [place.category, place.country].filter(Boolean).join(" · ");
  return `<article class="moment-card-v2" id="moment-${escapeHtml(moment.id)}" data-moment="${escapeHtml(moment.id)}">
    <header class="moment-card-head">
      <div class="moment-author">
        <span class="moment-avatar-wrap">${avatar}${author.verified ? '<span class="moment-online-dot" title="Verified host"></span>' : ""}</span>
        <div class="min-w-0">
          <p class="moment-author-name">${escapeHtml(author.name)}${author.verified ? `<span class="moment-verified" title="Verified host">${icons.badge}</span>` : ""}</p>
          <p class="moment-meta">${escapeHtml(timeAgo(moment.created_at))}<span aria-hidden="true"> · </span>Moments</p>
        </div>
      </div>
      <div class="moment-more-wrap">
        <button type="button" class="moment-icon-btn" data-more aria-label="More options" aria-expanded="false">${icons.more}</button>
        <div class="moment-menu" data-menu hidden>
          <button type="button" data-copy>Copy link</button>
          ${author.own ? '<button type="button" data-delete>Delete moment</button>' : ""}
        </div>
      </div>
    </header>
    ${mediaMarkup(moment)}
    <div class="moment-card-body">
      ${moment.caption ? `<p class="moment-caption">${escapeHtml(moment.caption)}</p>` : ""}
      ${supporting ? `<p class="moment-support">${escapeHtml(supporting)}</p>` : ""}
      ${locationMarkup(moment)}
      <div class="moment-rule"></div>
      <div class="moment-actions">
        <button type="button" class="moment-action" data-like aria-pressed="false">${icons.heart}<span data-like-count>0</span></button>
        <button type="button" class="moment-action" data-comment-toggle aria-expanded="false">${icons.comment}<span data-comment-count>0</span></button>
        <button type="button" class="moment-action" data-share>${icons.share}<span class="moment-share-label">Share</span></button>
      </div>
      <section class="moment-comments" data-comments-panel hidden>
        <div class="moment-comment-list" data-comment-list></div>
        ${session ? `<form class="moment-comment-form" data-comment-form><input maxlength="500" class="tl-input" placeholder="Add a comment" data-comment-input aria-label="Add a comment"><button class="tl-btn tl-btn-primary" type="submit">Post</button></form>` : '<p class="moment-comment-signin"><a href="login.html?next=moments.html">Sign in</a> to comment.</p>'}
      </section>
    </div>
  </article>`;
}

async function shareMoment(moment, onMessage, copyOnly = false) {
  const url = location.origin + location.pathname + "#moment-" + moment.id;
  const payload = { title: "TerraLens moment", text: moment.caption || "A moment from TerraLens", url };
  try {
    if (!copyOnly && navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(url);
    onMessage("Moment link copied.");
  } catch (error) {
    if (error && error.name === "AbortError") return;
    onMessage("Share link: " + url);
  }
}

function confirmDeleteMoment() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4";
    overlay.innerHTML = '<div class="tl-card w-full max-w-sm p-6"><h2 class="text-lg font-bold">Delete this moment?</h2><p class="mt-2 text-sm text-white/55">This removes the post and its image. It cannot be undone.</p><div class="mt-5 flex justify-end gap-2"><button class="tl-btn tl-btn-ghost" data-cancel>Cancel</button><button class="tl-btn tl-btn-primary" data-confirm>Delete</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cancel]").onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector("[data-confirm]").onclick = () => { overlay.remove(); resolve(true); };
  });
}

async function loadComments(card, momentId, onMessage) {
  const list = card.querySelector("[data-comment-list]");
  const { data, error } = await supabase
    .from("moment_comments")
    .select("id,body,created_at,profiles!moment_comments_user_id_fkey(display_name,username,avatar_url)")
    .eq("moment_id", momentId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) { onMessage(error.message); return; }
  if (!data || !data.length) {
    list.innerHTML = '<p class="moment-comment-empty">No comments yet. Start the conversation.</p>';
    return;
  }
  list.innerHTML = data.map(comment => {
    const profile = comment.profiles || {};
    const name = profile.display_name || profile.username || "Traveler";
    const avatar = profile.avatar_url
      ? `<img class="moment-comment-avatar" src="${escapeHtml(imgSize(profile.avatar_url, 80))}" alt="" referrerpolicy="no-referrer">`
      : `<span class="moment-comment-avatar moment-comment-avatar-fallback">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    return `<div class="moment-comment"><span class="moment-comment-avatar-wrap">${avatar}</span><div><p class="moment-comment-name">${escapeHtml(name)}</p><p class="moment-comment-body">${escapeHtml(comment.body)}</p></div></div>`;
  }).join("");
}

export async function hydrateMomentFeed(feed, rows, session, onMessage) {
  for (const moment of rows) {
    const card = feed.querySelector(`[data-moment="${CSS.escape(moment.id)}"]`);
    if (!card) continue;
    const likeButton = card.querySelector("[data-like]");
    const likeCount = card.querySelector("[data-like-count]");
    const commentCount = card.querySelector("[data-comment-count]");
    const commentButton = card.querySelector("[data-comment-toggle]");
    const panel = card.querySelector("[data-comments-panel]");

    const likes = await supabase.from("moment_likes").select("moment_id,user_id").eq("moment_id", moment.id);
    const likeRows = likes.data || [];
    likeCount.textContent = String(likeRows.length);
    let isLiked = !!(session && likeRows.some(row => row.user_id === session.user.id));
    likeButton.setAttribute("aria-pressed", isLiked ? "true" : "false");
    likeButton.classList.toggle("is-liked", isLiked);

    const comments = await supabase.from("moment_comments").select("id", { count: "exact", head: true }).eq("moment_id", moment.id);
    commentCount.textContent = String(comments.count || 0);

    likeButton.onclick = async () => {
      if (!session) { location.href = "login.html?next=moments.html"; return; }
      likeButton.disabled = true;
      if (isLiked) {
        const { error } = await supabase.from("moment_likes").delete().eq("moment_id", moment.id).eq("user_id", session.user.id);
        if (!error) {
          likeCount.textContent = String(Math.max(0, Number(likeCount.textContent) - 1));
          likeButton.setAttribute("aria-pressed", "false");
          likeButton.classList.remove("is-liked");
          isLiked = false;
        } else onMessage(error.message);
      } else {
        const { error } = await supabase.from("moment_likes").insert({ moment_id: moment.id, user_id: session.user.id });
        if (!error) {
          likeCount.textContent = String(Number(likeCount.textContent) + 1);
          likeButton.setAttribute("aria-pressed", "true");
          likeButton.classList.add("is-liked");
          isLiked = true;
        } else onMessage(error.message);
      }
      likeButton.disabled = false;
    };

    let commentsLoaded = false;
    commentButton.onclick = async () => {
      const open = panel.hasAttribute("hidden");
      if (open) {
        panel.removeAttribute("hidden");
        commentButton.setAttribute("aria-expanded", "true");
        if (!commentsLoaded) { await loadComments(card, moment.id, onMessage); commentsLoaded = true; }
      } else {
        panel.setAttribute("hidden", "");
        commentButton.setAttribute("aria-expanded", "false");
      }
    };

    const form = card.querySelector("[data-comment-form]");
    if (form) form.onsubmit = async event => {
      event.preventDefault();
      const input = card.querySelector("[data-comment-input]");
      const body = input.value.trim();
      if (!body) return;
      const { error } = await supabase.from("moment_comments").insert({ moment_id: moment.id, user_id: session.user.id, body });
      if (error) { onMessage(error.message); return; }
      input.value = "";
      commentCount.textContent = String(Number(commentCount.textContent) + 1);
      await loadComments(card, moment.id, onMessage);
    };

    card.querySelector("[data-share]").onclick = () => shareMoment(moment, onMessage);

    const moreButton = card.querySelector("[data-more]");
    const menu = card.querySelector("[data-menu]");
    moreButton.onclick = () => {
      const open = menu.hasAttribute("hidden");
      if (open) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
      moreButton.setAttribute("aria-expanded", open ? "true" : "false");
    };
    menu.querySelector("[data-copy]").onclick = () => { menu.setAttribute("hidden", ""); shareMoment(moment, onMessage, true); };
    const deleteButton = menu.querySelector("[data-delete]");
    if (deleteButton) deleteButton.onclick = async () => {
      menu.setAttribute("hidden", "");
      if (!await confirmDeleteMoment()) return;
      const { error } = await supabase.from("moments").delete().eq("id", moment.id).eq("user_id", session.user.id);
      if (error) { onMessage(error.message); return; }
      try {
        const url = new URL(moment.media_url);
        const marker = "/object/public/place-images/";
        const index = url.pathname.indexOf(marker);
        if (index !== -1) await supabase.storage.from("place-images").remove([decodeURIComponent(url.pathname.slice(index + marker.length))]);
      } catch {}
      card.remove();
      onMessage("Moment deleted.");
    };
  }

  const target = location.hash && document.querySelector(location.hash);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
}
