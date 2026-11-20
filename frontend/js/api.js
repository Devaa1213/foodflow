// FOODFLOW — API helper + shared UI utilities

const ffApi = {
  async request(path, options = {}) {
    try {
      const res = await fetch(`${FF_API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API error on ${path}:`, err);
      throw err;
    }
  },
  get(path) {
    return this.request(path);
  },
  post(path, data) {
    return this.request(path, { method: "POST", body: JSON.stringify(data) });
  },
  patch(path, data) {
    return this.request(path, { method: "PATCH", body: JSON.stringify(data) });
  },
  del(path) {
    return this.request(path, { method: "DELETE" });
  },
};

function ffToast(message, type = "default") {
  let root = document.getElementById("ff-toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "ff-toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = `ff-toast ${type === "success" ? "ff-toast-success" : type === "error" ? "ff-toast-error" : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function ffLoadingState(message = "Loading...") {
  return `<div class="ff-state"><span class="ff-spinner"></span><p style="margin-top:12px;">${message}</p></div>`;
}

function ffEmptyState(message = "No data available yet.", icon = "🍽️") {
  return `<div class="ff-state"><div class="ff-state-icon">${icon}</div><p>${message}</p></div>`;
}

function ffErrorState(message = "Unable to load. Try again.", retryFn = null) {
  const btn = retryFn
    ? `<button class="ff-btn ff-btn-ghost ff-btn-sm" onclick="(${retryFn.name || ""})()">Retry</button>`
    : "";
  return `<div class="ff-state"><div class="ff-state-icon">⚠️</div><p>${message}</p>${btn}</div>`;
}

function ffFormatCurrency(amount) {
  return `₹${Number(amount || 0).toFixed(0)}`;
}

function ffFormatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
