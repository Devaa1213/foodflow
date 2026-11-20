// FOODFLOW — Delivery partner dashboard

let ffUser = null;
let ffOnline = false;
let ffPoll = null;

ffRequireRole("delivery", (user) => {
  ffUser = user;
  document.getElementById("ff-sidebar-name").textContent = user.name || user.email;
  document.getElementById("ff-partner-name").textContent = `Hi, ${user.name?.split(" ")[0] || "there"}`;
  initNav();
  loadSummary();
  loadDashboardActive();
  ffPoll = setInterval(() => {
    const active = document.querySelector(".ff-view.ff-active")?.dataset.view;
    if (active === "available") loadAvailable();
    if (active === "active" || active === "dashboard") loadActive();
  }, 8000);
});

document.getElementById("ff-logout-btn").addEventListener("click", () => {
  clearInterval(ffPoll);
  ffLogout();
});

function initNav() {
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((el) =>
    el.addEventListener("click", () => showView(el.dataset.view))
  );
  document.getElementById("ff-mobile-menu-btn")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-sidebar-backdrop")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-status-toggle").addEventListener("click", toggleOnline);
}

function toggleSidebar() {
  document.getElementById("ff-sidebar").classList.toggle("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.toggle("ff-open");
}

function showView(name) {
  document.querySelectorAll(".ff-view").forEach((v) => v.classList.toggle("ff-active", v.dataset.view === name));
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((b) => b.classList.toggle("ff-active", b.dataset.view === name));
  document.getElementById("ff-sidebar").classList.remove("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.remove("ff-open");
  if (name === "available") loadAvailable();
  if (name === "active") loadActive();
  if (name === "history") loadHistory();
  if (name === "earnings") loadEarnings();
  if (name === "profile") renderProfile();
  if (name === "dashboard") { loadSummary(); loadDashboardActive(); }
}

async function loadSummary() {
  try {
    const summary = await ffApi.get(`/api/delivery/${ffUser.uid}/summary`);
    ffOnline = summary.status === "online";
    updateStatusButton();
    ffAnimateCounter(document.getElementById("ff-stat-deliveries"), summary.todayDeliveries || 0);
    document.getElementById("ff-stat-earnings").textContent = ffFormatCurrency(summary.todayEarnings || 0);
    document.getElementById("ff-stat-rating").textContent = summary.rating ? `${summary.rating} ★` : "—";
  } catch (err) {
    // leave defaults
  }
}

function updateStatusButton() {
  const btn = document.getElementById("ff-status-toggle");
  btn.textContent = ffOnline ? "● Online" : "● Offline";
  btn.style.color = ffOnline ? "var(--ff-success)" : "var(--ff-ink-soft)";
}

async function toggleOnline() {
  ffOnline = !ffOnline;
  updateStatusButton();
  try {
    await ffApi.patch(`/api/delivery/${ffUser.uid}/status`, { status: ffOnline ? "online" : "offline" });
    // Simulate a location ping so smart assignment has coordinates to score against.
    await ffApi.patch(`/api/delivery/${ffUser.uid}/location`, {
      lat: 14.44 + Math.random() * 0.01,
      lng: 79.985 + Math.random() * 0.01,
    });
    ffToast(ffOnline ? "You're online" : "You're offline", "success");
  } catch (err) {
    ffToast("Could not update status", "error");
  }
}

// ---------------- Available deliveries ----------------
async function loadAvailable() {
  const el = document.getElementById("ff-available-list");
  el.innerHTML = ffLoadingState("Checking for available deliveries...");
  try {
    const { orders } = await ffApi.get("/api/delivery/available");
    el.innerHTML = orders.length ? orders.map(availableCard).join("") : ffEmptyState("No deliveries available right now.", "🛵");
    el.querySelectorAll("button[data-id]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await ffApi.post(`/api/orders/${btn.dataset.id}/assign`, { partnerId: ffUser.uid });
          ffToast("Delivery accepted", "success");
          loadAvailable();
          loadDashboardActive();
        } catch {
          ffToast("Could not accept delivery", "error");
        }
      })
    );
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load available deliveries.");
  }
}

function availableCard(o) {
  return `
    <div class="ff-card" style="padding:18px 20px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>#${o.id.slice(0, 8).toUpperCase()}</strong>
        <div style="font-size:13px; color:var(--ff-ink-soft); margin-top:4px;">${o.restaurantName} → ${o.customerName || "Customer"} · ${ffFormatCurrency(o.total)}</div>
      </div>
      <button class="ff-btn ff-btn-primary ff-btn-sm" data-id="${o.id}">Accept</button>
    </div>`;
}

// ---------------- Active delivery ----------------
async function loadDashboardActive() {
  const el = document.getElementById("ff-dashboard-active");
  el.innerHTML = ffLoadingState();
  try {
    const { orders } = await ffApi.get(`/api/delivery/${ffUser.uid}/active`);
    el.innerHTML = orders.length ? orders.map(activeCard).join("") : ffEmptyState("No active delivery right now.", "📍");
    bindActiveActions(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load active delivery.");
  }
}

async function loadActive() {
  const el = document.getElementById("ff-active-list");
  el.innerHTML = ffLoadingState("Loading active delivery...");
  try {
    const { orders } = await ffApi.get(`/api/delivery/${ffUser.uid}/active`);
    el.innerHTML = orders.length ? orders.map(activeCard).join("") : ffEmptyState("No active delivery right now.", "📍");
    bindActiveActions(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load active delivery.");
  }
}

const ACTIVE_NEXT = { PICKED_UP: { next: "OUT_FOR_DELIVERY", label: "Start Delivery" }, OUT_FOR_DELIVERY: { next: "DELIVERED", label: "Mark Delivered" } };

function activeCard(o) {
  const step = o.status === "READY_FOR_PICKUP" ? { next: "PICKED_UP", label: "Mark Picked Up" } : ACTIVE_NEXT[o.status];
  return `
    <div class="ff-card" style="padding:18px 20px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>#${o.id.slice(0, 8).toUpperCase()}</strong>
        <span class="ff-badge ff-badge-warning">${o.status.replace(/_/g, " ")}</span>
      </div>
      <div style="font-size:13.5px; color:var(--ff-ink-soft); margin-bottom:12px;">${o.restaurantName} → ${o.customerName || "Customer"} · ${ffFormatCurrency(o.total)}</div>
      ${step ? `<button class="ff-btn ff-btn-primary ff-btn-sm" data-id="${o.id}" data-status="${step.next}">${step.label}</button>` : ""}
    </div>`;
}

function bindActiveActions(container) {
  container.querySelectorAll("button[data-status]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await ffApi.patch(`/api/orders/${btn.dataset.id}/status`, { status: btn.dataset.status });
        ffToast("Delivery updated", "success");
        loadActive();
        loadDashboardActive();
        loadSummary();
      } catch {
        ffToast("Could not update delivery", "error");
      }
    })
  );
}

// ---------------- History ----------------
async function loadHistory() {
  const el = document.getElementById("ff-history-content");
  el.innerHTML = ffLoadingState("Loading history...");
  try {
    const { orders } = await ffApi.get(`/api/delivery/${ffUser.uid}/history`);
    el.innerHTML = orders.length
      ? `<table class="ff-table"><thead><tr><th>Order</th><th>Restaurant</th><th>Total</th><th>Date</th></tr></thead><tbody>
          ${orders.map((o) => `<tr><td>#${o.id.slice(0, 8).toUpperCase()}</td><td>${o.restaurantName}</td><td>${ffFormatCurrency(o.total)}</td><td>${ffFormatDate(o.createdAt)}</td></tr>`).join("")}
        </tbody></table>`
      : ffEmptyState("No completed deliveries yet.", "🧾");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load history.");
  }
}

// ---------------- Earnings ----------------
async function loadEarnings() {
  const el = document.getElementById("ff-earnings-content");
  el.innerHTML = ffLoadingState();
  try {
    const summary = await ffApi.get(`/api/delivery/${ffUser.uid}/summary`);
    el.innerHTML = `
      <div class="ff-cart-line"><span>Today's deliveries</span><span>${summary.todayDeliveries || 0}</span></div>
      <div class="ff-cart-line"><span>Today's earnings</span><span>${ffFormatCurrency(summary.todayEarnings || 0)}</span></div>
      <div class="ff-cart-line"><span>Rating</span><span>${summary.rating ? summary.rating + " ★" : "—"}</span></div>`;
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load earnings.");
  }
}

// ---------------- Profile ----------------
function renderProfile() {
  document.getElementById("ff-profile-content").innerHTML = `
    <div class="ff-field"><label class="ff-label">Name</label><div>${ffUser.name || "—"}</div></div>
    <div class="ff-field"><label class="ff-label">Email</label><div>${ffUser.email}</div></div>
    <div class="ff-field"><label class="ff-label">Role</label><div style="text-transform:capitalize;">${ffUser.role}</div></div>
  `;
}
