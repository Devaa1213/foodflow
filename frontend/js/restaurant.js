// FOODFLOW — Restaurant dashboard

let ffUser = null;
let ffOrdersPoll = null;
let ffAssignOrderId = null;

ffRequireRole("restaurant", (user) => {
  ffUser = user;
  document.getElementById("ff-sidebar-name").textContent = user.name || user.email;
  document.getElementById("ff-rest-name").textContent = `${user.name || "Restaurant"} Dashboard`;
  initNav();
  loadDashboard();
  ffOrdersPoll = setInterval(() => {
    const active = document.querySelector(".ff-view.ff-active")?.dataset.view;
    if (active === "dashboard") loadDashboard();
    if (active === "orders") loadOrders();
  }, 8000);
});

document.getElementById("ff-logout-btn").addEventListener("click", () => {
  clearInterval(ffOrdersPoll);
  ffLogout();
});

function initNav() {
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((el) =>
    el.addEventListener("click", () => showView(el.dataset.view))
  );
  document.getElementById("ff-mobile-menu-btn")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-sidebar-backdrop")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-add-menu-btn").addEventListener("click", () => openMenuModal());
  document.getElementById("ff-menu-modal-close").addEventListener("click", () => closeModal("ff-menu-modal"));
  document.getElementById("ff-menu-form").addEventListener("submit", saveMenuItem);
  document.getElementById("ff-assign-modal-close").addEventListener("click", () => closeModal("ff-assign-modal"));
}

function toggleSidebar() {
  document.getElementById("ff-sidebar").classList.toggle("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.toggle("ff-open");
}
function closeModal(id) { document.getElementById(id).classList.remove("ff-open"); }
function openModal(id) { document.getElementById(id).classList.add("ff-open"); }

function showView(name) {
  document.querySelectorAll(".ff-view").forEach((v) => v.classList.toggle("ff-active", v.dataset.view === name));
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((b) => b.classList.toggle("ff-active", b.dataset.view === name));
  document.getElementById("ff-sidebar").classList.remove("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.remove("ff-open");
  if (name === "orders") loadOrders();
  if (name === "menu") loadMenu();
  if (name === "inventory") loadInventory();
  if (name === "analytics") loadAnalytics();
  if (name === "profile") renderProfile();
  if (name === "dashboard") loadDashboard();
}

// ---------------- Dashboard ----------------
async function loadDashboard() {
  try {
    const stats = await ffApi.get(`/api/restaurant/${ffUser.uid}/analytics`);
    ffAnimateCounter(document.getElementById("ff-stat-orders"), stats.todaysOrders);
    document.getElementById("ff-stat-revenue").textContent = ffFormatCurrency(stats.todaysRevenue);
    ffAnimateCounter(document.getElementById("ff-stat-pending"), stats.pendingOrders);
    ffAnimateCounter(document.getElementById("ff-stat-active"), stats.activeDeliveries);
  } catch (err) {
    // Keep zeros on failure rather than breaking the dashboard
  }
  loadBatchAlerts();
  loadWasteAlerts();
}

async function loadBatchAlerts() {
  const el = document.getElementById("ff-batch-alerts");
  el.innerHTML = ffLoadingState("Checking for batching opportunities...");
  try {
    const { opportunities } = await ffApi.get(`/api/restaurants/${ffUser.uid}/batches`);
    el.innerHTML = opportunities.length
      ? opportunities
          .map(
            (o) => `
        <div class="ff-alert-card ff-alert-info">
          <h4>Orders #${o.orderIdA.slice(0, 6).toUpperCase()} + #${o.orderIdB.slice(0, 6).toUpperCase()}</h4>
          <p>Same restaurant · Customers ${o.distanceApartKm} km apart · Potential distance saved: ${o.distanceSavedKm} km · Extra delay: ~${o.extraDelayMin} min</p>
          <button class="ff-btn ff-btn-ghost ff-btn-sm" data-a="${o.orderIdA}" data-b="${o.orderIdB}">Create Batch</button>
        </div>`
          )
          .join("")
      : ffEmptyState("No batching opportunities right now.", "⚡");
    el.querySelectorAll("button[data-a]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await ffApi.post("/api/orders/batch", { orderIds: [btn.dataset.a, btn.dataset.b] });
          ffToast("Batch created", "success");
          loadBatchAlerts();
        } catch {
          ffToast("Could not create batch", "error");
        }
      })
    );
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load batching data.");
  }
}

async function loadWasteAlerts() {
  const el = document.getElementById("ff-waste-alerts");
  el.innerHTML = ffLoadingState("Checking inventory...");
  try {
    const { alerts } = await ffApi.get(`/api/restaurants/${ffUser.uid}/waste-alerts`);
    el.innerHTML = alerts.length
      ? alerts
          .map(
            (a) => `
        <div class="ff-alert-card">
          <h4>${a.itemName} inventory is significantly above expected demand</h4>
          <p>Current stock: ${a.currentStock} ${a.unit} · Expected demand: ${a.expectedDemand} ${a.unit}</p>
          <p style="font-weight:600; color:var(--ff-warning);">Suggested action: ${a.suggestion}</p>
        </div>`
          )
          .join("")
      : ffEmptyState("No excess-inventory alerts right now.", "✅");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to check waste alerts.");
  }
}

// ---------------- Orders ----------------
const NEXT_STATUS = {
  PLACED: { next: "CONFIRMED", label: "Accept Order" },
  CONFIRMED: { next: "PREPARING", label: "Start Preparing" },
  PREPARING: { next: "READY_FOR_PICKUP", label: "Mark Ready" },
};

async function loadOrders() {
  const el = document.getElementById("ff-orders-list");
  el.innerHTML = ffLoadingState("Loading orders...");
  try {
    const { orders } = await ffApi.get(`/api/orders?restaurantId=${ffUser.uid}`);
    el.innerHTML = orders.length ? orders.map(orderCard).join("") : ffEmptyState("No orders yet.", "📦");
    bindOrderActions(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load orders. Try again.");
  }
}

function orderCard(o) {
  const action = NEXT_STATUS[o.status];
  const canReject = o.status === "PLACED";
  const canAssign = o.status === "READY_FOR_PICKUP" && !o.deliveryPartnerId;
  return `
    <div class="ff-card" style="padding:18px 20px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div>
          <strong>#${o.id.slice(0, 8).toUpperCase()}</strong>
          <span style="color:var(--ff-ink-soft); font-size:13px; margin-left:8px;">${o.customerName || "Customer"}</span>
        </div>
        <span class="ff-badge ${o.status === "DELIVERED" ? "ff-badge-success" : "ff-badge-warning"}">${o.status.replace(/_/g, " ")}</span>
      </div>
      <div style="font-size:13.5px; color:var(--ff-ink-soft); margin-bottom:12px;">
        ${o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")} — ${ffFormatCurrency(o.total)}
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${action ? `<button class="ff-btn ff-btn-primary ff-btn-sm" data-id="${o.id}" data-status="${action.next}">${action.label}</button>` : ""}
        ${canReject ? `<button class="ff-btn ff-btn-danger ff-btn-sm" data-id="${o.id}" data-status="REJECTED">Reject</button>` : ""}
        ${canAssign ? `<button class="ff-btn ff-btn-ghost ff-btn-sm" data-id="${o.id}" data-action="assign">Smart Assignment</button>` : ""}
      </div>
    </div>`;
}

function bindOrderActions(container) {
  container.querySelectorAll("button[data-status]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await ffApi.patch(`/api/orders/${btn.dataset.id}/status`, { status: btn.dataset.status });
        ffToast("Order updated", "success");
        loadOrders();
      } catch {
        ffToast("Could not update order", "error");
      }
    })
  );
  container.querySelectorAll('button[data-action="assign"]').forEach((btn) =>
    btn.addEventListener("click", () => openAssignModal(btn.dataset.id))
  );
}

async function openAssignModal(orderId) {
  ffAssignOrderId = orderId;
  openModal("ff-assign-modal");
  const el = document.getElementById("ff-assign-candidates");
  el.innerHTML = ffLoadingState("Finding the best delivery partner...");
  try {
    const { candidates } = await ffApi.get(`/api/orders/${orderId}/assign/candidates`);
    el.innerHTML = candidates.length
      ? candidates
          .map(
            (c, i) => `
        <div class="ff-partner-row ${i === 0 ? "ff-recommended" : ""}">
          <div>
            <div class="ff-partner-name">${i === 0 ? "⭐ " : ""}${c.name}</div>
            <div class="ff-partner-meta">Distance: ${c.distanceKm} km · Active orders: ${c.activeOrders} · ETA: ${c.estimatedArrivalMin} min</div>
          </div>
          <button class="ff-btn ff-btn-primary ff-btn-sm" data-partner="${c.partnerId}">Assign</button>
        </div>`
          )
          .join("")
      : ffEmptyState("No available delivery partners online.", "🛵");
    el.querySelectorAll("button[data-partner]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await ffApi.post(`/api/orders/${ffAssignOrderId}/assign`, { partnerId: btn.dataset.partner });
          ffToast("Delivery partner assigned", "success");
          closeModal("ff-assign-modal");
          loadOrders();
        } catch {
          ffToast("Could not assign partner", "error");
        }
      })
    );
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load candidates.");
  }
}

// ---------------- Menu management ----------------
let ffEditingMenuId = null;

async function loadMenu() {
  const el = document.getElementById("ff-menu-list");
  el.innerHTML = ffLoadingState("Loading menu...");
  try {
    const r = await ffApi.get(`/api/restaurants/${ffUser.uid}`);
    const menu = r.menu || [];
    el.innerHTML = menu.length ? menu.map(menuRow).join("") : ffEmptyState("No dishes yet — add your first one.", "📋");
    bindMenuRowActions(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load menu.");
  }
}

function menuRow(item) {
  return `
    <div class="ff-menu-item" data-id="${item.id}">
      <div>
        <h4>${item.name}</h4>
        <div class="ff-price">${ffFormatCurrency(item.price)} · ${item.category || "Uncategorized"}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="ff-badge ${item.available !== false ? "ff-badge-success" : "ff-badge-neutral"}">${item.available !== false ? "Available" : "Disabled"}</span>
        <button class="ff-btn ff-btn-ghost ff-btn-sm" data-action="toggle">${item.available !== false ? "Disable" : "Enable"}</button>
      </div>
    </div>`;
}

function bindMenuRowActions(container) {
  container.querySelectorAll(".ff-menu-item").forEach((row) => {
    row.querySelector('button[data-action="toggle"]').addEventListener("click", async () => {
      const badge = row.querySelector(".ff-badge");
      const isAvailable = badge.textContent === "Available";
      try {
        await ffApi.patch(`/api/menu/${row.dataset.id}`, { available: !isAvailable });
        loadMenu();
      } catch {
        ffToast("Could not update dish", "error");
      }
    });
  });
}

function openMenuModal() {
  document.getElementById("ff-menu-form").reset();
  openModal("ff-menu-modal");
}

async function saveMenuItem(e) {
  e.preventDefault();
  const name = document.getElementById("ff-menu-name").value.trim();
  const price = Number(document.getElementById("ff-menu-price").value);
  const category = document.getElementById("ff-menu-category").value.trim() || "Main Course";
  try {
    await ffApi.post(`/api/restaurants/${ffUser.uid}/menu`, { name, price, category, available: true });
    ffToast("Dish added", "success");
    closeModal("ff-menu-modal");
    loadMenu();
  } catch (err) {
    ffToast("Could not save dish", "error");
  }
}

// ---------------- Inventory ----------------
async function loadInventory() {
  const el = document.getElementById("ff-inventory-list");
  el.innerHTML = ffLoadingState("Loading inventory...");
  try {
    const { inventory } = await ffApi.get(`/api/restaurants/${ffUser.uid}/inventory`);
    el.innerHTML = inventory.length ? inventory.map(inventoryRow).join("") : ffEmptyState("No inventory tracked yet.", "📦");
    bindInventoryActions(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load inventory.");
  }
}

const STOCK_COLORS = { Healthy: "var(--ff-success)", "Low Stock": "var(--ff-warning)", Critical: "var(--ff-danger)", "Potential Excess": "var(--ff-info)" };

function inventoryRow(item) {
  const pct = item.predictedDemand ? Math.min(100, Math.round((item.quantity / (item.predictedDemand * 2)) * 100)) : 50;
  return `
    <div class="ff-inv-row" data-id="${item.id}">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${item.name}</strong>
          <span style="color:var(--ff-ink-soft); font-size:13px; margin-left:6px;">${item.quantity} ${item.unit}</span>
        </div>
        <span class="ff-badge" style="background:${STOCK_COLORS[item.stockStatus]}22; color:${STOCK_COLORS[item.stockStatus]};">${item.stockStatus}</span>
      </div>
      <div class="ff-inv-bar-track"><div class="ff-inv-bar-fill" style="width:${pct}%; background:${STOCK_COLORS[item.stockStatus]};"></div></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <input type="number" class="ff-input" style="width:100px; padding:6px 10px;" data-role="qty-input" value="${item.quantity}" />
        <button class="ff-btn ff-btn-ghost ff-btn-sm" data-action="update-stock">Update Stock</button>
      </div>
    </div>`;
}

function bindInventoryActions(container) {
  container.querySelectorAll(".ff-inv-row").forEach((row) => {
    row.querySelector('button[data-action="update-stock"]').addEventListener("click", async () => {
      const qty = Number(row.querySelector('[data-role="qty-input"]').value);
      try {
        await ffApi.patch(`/api/inventory/${row.dataset.id}`, { quantity: qty });
        ffToast("Stock updated", "success");
        loadInventory();
      } catch {
        ffToast("Could not update stock", "error");
      }
    });
  });
}

// ---------------- Analytics ----------------
async function loadAnalytics() {
  const popEl = document.getElementById("ff-analytics-popular");
  const sumEl = document.getElementById("ff-analytics-summary");
  popEl.innerHTML = ffLoadingState();
  sumEl.innerHTML = "";
  try {
    const stats = await ffApi.get(`/api/restaurant/${ffUser.uid}/analytics`);
    popEl.innerHTML = stats.popularFoods.length
      ? stats.popularFoods.map((f) => `<div class="ff-cart-line"><span>${f.name}</span><span>${f.count} orders</span></div>`).join("")
      : ffEmptyState("No order data yet.", "📊");
    sumEl.innerHTML = `
      <div class="ff-cart-line"><span>Today's orders</span><span>${stats.todaysOrders}</span></div>
      <div class="ff-cart-line"><span>Today's revenue</span><span>${ffFormatCurrency(stats.todaysRevenue)}</span></div>
      <div class="ff-cart-line"><span>Pending orders</span><span>${stats.pendingOrders}</span></div>
      <div class="ff-cart-line"><span>Active deliveries</span><span>${stats.activeDeliveries}</span></div>`;
  } catch (err) {
    popEl.innerHTML = ffErrorState("Unable to load analytics.");
  }
}

// ---------------- Profile ----------------
function renderProfile() {
  document.getElementById("ff-profile-content").innerHTML = `
    <div class="ff-field"><label class="ff-label">Restaurant / Owner name</label><div>${ffUser.name || "—"}</div></div>
    <div class="ff-field"><label class="ff-label">Email</label><div>${ffUser.email}</div></div>
    <div class="ff-field"><label class="ff-label">Role</label><div style="text-transform:capitalize;">${ffUser.role}</div></div>
  `;
}
