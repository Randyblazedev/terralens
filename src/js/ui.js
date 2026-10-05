// Site-styled replacements for the browser's alert(), confirm() and prompt() pop-ups.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
let toastHost;

export function toast(message, type = "info") {
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.className = "pointer-events-none fixed inset-x-4 bottom-5 z-[110] flex flex-col items-center gap-2";
    document.body.append(toastHost);
  }
  const accent = { success: "border-emerald-400/50", error: "border-red-400/60", info: "border-sky-300/40" }[type] || "border-sky-300/40";
  const el = document.createElement("div");
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.className = `pointer-events-auto max-w-md rounded-2xl border ${accent} bg-[#0b1220]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur`;
  el.textContent = message;
  toastHost.append(el);
  setTimeout(() => el.remove(), type === "error" ? 6000 : 3500);
}

function openDialog({ title, body, buttons, focusSelector }) {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center";
    const id = "dlg" + Math.random().toString(36).slice(2, 8);
    overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="${id}" class="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl">
      <h2 id="${id}" class="text-xl font-extrabold">${esc(title)}</h2>
      <div class="mt-3 text-sm leading-6 text-white/65">${body}</div>
      <div class="mt-6 flex justify-end gap-3">${buttons.map((b, i) => `<button type="button" data-i="${i}" class="tl-btn ${b.className} !min-h-11 !px-5">${esc(b.label)}</button>`).join("")}</div></div>`;
    document.body.append(overlay);
    document.documentElement.style.overflow = "hidden";
    const finish = value => {
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = "";
      overlay.remove();
      previous?.focus?.();
      resolve(value);
    };
    const run = i => finish(buttons[i].value(overlay));
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); finish(buttons.find(b => b.cancel)?.value(overlay) ?? null); }
      if (e.key === "Tab") {
        const f = [...overlay.querySelectorAll("button,input")];
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === "Enter" && overlay.querySelector("input") && document.activeElement?.tagName === "INPUT") { e.preventDefault(); run(buttons.findIndex(b => b.primary)); }
    };
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("click", e => {
      if (e.target === overlay) finish(buttons.find(b => b.cancel)?.value(overlay) ?? null);
      const b = e.target.closest("[data-i]"); if (b) run(Number(b.dataset.i));
    });
    (overlay.querySelector(focusSelector) || overlay.querySelector("button")).focus();
  });
}

export function confirmDialog(message, { title = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) {
  return openDialog({
    title, body: `<p>${esc(message)}</p>`, focusSelector: "[data-i='1']",
    buttons: [
      { label: cancelText, className: "tl-btn-ghost", cancel: true, value: () => false },
      { label: confirmText, className: danger ? "!bg-red-500 !text-white hover:!bg-red-400" : "tl-btn-primary", primary: true, value: () => true }
    ]
  });
}

export function promptDialog(label, { title = "Enter a value", placeholder = "", value = "", confirmText = "Save", maxLength = 80 } = {}) {
  return openDialog({
    title, focusSelector: "input",
    body: `<label class="block"><span class="mb-2 block text-white/55">${esc(label)}</span><input type="text" maxlength="${maxLength}" value="${esc(value)}" placeholder="${esc(placeholder)}" class="tl-input"></label>`,
    buttons: [
      { label: "Cancel", className: "tl-btn-ghost", cancel: true, value: () => null },
      { label: confirmText, className: "tl-btn-primary", primary: true, value: o => o.querySelector("input").value.trim() || null }
    ]
  });
}

export function alertDialog(message, { title = "Notice", okText = "OK" } = {}) {
  return openDialog({ title, body: `<p>${esc(message)}</p>`, buttons: [{ label: okText, className: "tl-btn-primary", primary: true, cancel: true, value: () => true }] });
}
