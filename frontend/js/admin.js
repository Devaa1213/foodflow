// FOODFLOW — Admin dashboard

let ffUser = null;

ffRequireRole("admin", (user) => {
  ffUser = user;
  document.getElementById("ff-sidebar-name").textContent = user.name || user.email;
  initNav();
  loadStatistics();
});

document.getElementById("ff-logout-btn").addEventListener("click", ffLogout);

function initNav() {
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((el) =>
    el.addEventListener("click", () => showView(el.dataset.view))
  );
  document.getElementById("ff-mobile-menu-btn")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-sidebar-backdrop")?.addEventListener("click", toggleSidebar);
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
  if (name === "dashboard") loadStatistics();
  if (name === "users") loadUsers();
  if (name === "restaurants") loadRestaurants();
  if (name === "partners") loadPartners();
  if (name === "orders") loadOrders();
  if (name === "analytics") loadAnalytics();
}

async function loadStatistics() {
  try {
    const s = await ffApi.get("/api/admin/statistics");
    ffAnimateCounter(document.getElementById("ff-stat-users"), s.totalUsers);
    ffAnimateCounter(document.getElementById("ff-stat-restaurants"), s.totalRestaurants);
    ffAnimateCounter(document.getElementById("ff-stat-orders"), s.totalOrders);
    ffAnimateCounter(document.getElementById("ff-stat-active"), s.activeDeliveries);
    document.getElementById("ff-stat-revenue").textContent = ffFormatCurrency(s.revenue);
    ffAnimateCounter(document.getElementById("ff-stat-completed"), s.completedOrders);
  } catch (err) {
    ffToast("Could not load statistics", "error");
  }
}

async function loadUsers() {
  const el = document.getElementById("ff-users-content");
  el.innerHTML = ffLoadingState("Loading users...");
  try {
    const { users } = await ffApi.get("/api/admin/users");
    el.innerHTML = users.length
      ? `<table class="ff-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>
          ${users.map((u) => `<tr><td>${u.name || "—"}</td><td>${u.email || "—"}</td><td style="text-transform:capitalize;">${u.role}</td><td>${ffFormatDate(u.createdAt)}</td></tr>`).join("")}
        </tbody></table>`
      : ffEmptyState("No data available yet.", "👥");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load users.");
  }
}

async function loadRestaurants() {
  const el = document.getElementById("ff-restaurants-content");
  el.innerHTML = ffLoadingState("Loading restaurants...");
  try {
    const { restaurants } = await ffApi.get("/api/admin/restaurants");
    el.innerHTML = restaurants.length
      ? `<table class="ff-table"><thead><tr><th>Name</th><th>Cuisine</th><th>Rating</th></tr></thead><tbody>
          ${restaurants.map((r) => `<tr><td>${r.name}</td><td>${r.cuisine || "—"}</td><td>★ ${r.rating || "—"}</td></tr>`).join("")}
        </tbody></table>`
      : ffEmptyState("No data available yet.", "🍽️");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load restaurants.");
  }
}

async function loadPartners() {
  const el = document.getElementById("ff-partners-content");
  el.innerHTML = ffLoadingState("Loading delivery partners...");
  try {
    const { partners } = await ffApi.get("/api/admin/delivery-partners");
    el.innerHTML = partners.length
      ? `<table class="ff-table"><thead><tr><th>Name</th><th>Status</th><th>Active Orders</th><th>Rating</th></tr></thead><tbody>
          ${partners.map((p) => `<tr><td>${p.name}</td><td><span class="ff-badge ${p.status === "online" ? "ff-badge-success" : "ff-badge-neutral"}">${p.status}</span></td><td>${p.activeOrders || 0}</td><td>★ ${p.rating || "—"}</td></tr>`).join("")}
        </tbody></table>`
      : ffEmptyState("No data available yet.", "🛵");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load delivery partners.");
  }
}

async function loadOrders() {
  const el = document.getElementById("ff-orders-content");
  el.innerHTML = ffLoadingState("Loading orders...");
  try {
    const { orders } = await ffApi.get("/api/admin/orders");
    el.innerHTML = orders.length
      ? `<table class="ff-table"><thead><tr><th>Order</th><th>Restaurant</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>
          ${orders
            .map(
              (o) => `<tr>
                <td>#${o.id.slice(0, 8).toUpperCase()}</td>
                <td>${o.restaurantName || "—"}</td>
                <td>${o.customerName || "—"}</td>
                <td>${ffFormatCurrency(o.total)}</td>
                <td><span class="ff-badge ${o.status === "DELIVERED" ? "ff-badge-success" : "ff-badge-warning"}">${o.status.replace(/_/g, " ")}</span></td>
                <td>${ffFormatDate(o.createdAt)}</td>
              </tr>`
            )
            .join("")}
        </tbody></table>`
      : ffEmptyState("No data available yet.", "📦");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load orders.");
  }
}

async function loadAnalytics() {
  const popEl = document.getElementById("ff-analytics-popular");
  const topEl = document.getElementById("ff-analytics-top-restaurants");
  const sumEl = document.getElementById("ff-analytics-summary");
  popEl.innerHTML = ffLoadingState();
  try {
    const a = await ffApi.get("/api/admin/analytics");
    popEl.innerHTML = a.popularFoods.length
      ? a.popularFoods.map((f) => `<div class="ff-cart-line"><span>${f.name}</span><span>${f.count} orders</span></div>`).join("")
      : ffEmptyState("No data available yet.");
    topEl.innerHTML = a.topRestaurants.length
      ? a.topRestaurants.map((r) => `<div class="ff-cart-line"><span>${r.name}</span><span>${r.orders} orders</span></div>`).join("")
      : ffEmptyState("No data available yet.");
    sumEl.innerHTML = `
      <div class="ff-cart-line"><span>Orders today</span><span>${a.ordersToday}</span></div>
      <div class="ff-cart-line"><span>Total orders</span><span>${a.ordersThisWeek}</span></div>
      <div class="ff-cart-line"><span>Revenue</span><span>${ffFormatCurrency(a.revenue)}</span></div>
      <div class="ff-cart-line"><span>Delivery completion rate</span><span>${a.deliveryCompletionRate}%</span></div>`;
  } catch (err) {
    popEl.innerHTML = ffErrorState("Unable to load analytics.");
  }
}
