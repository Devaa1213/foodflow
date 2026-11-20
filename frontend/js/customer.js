// FOODFLOW — Customer dashboard

let ffUser = null;
let ffCart = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("ff_cart") || "[]");
    return Array.isArray(saved)
      ? saved.filter((item) =>
          item &&
          item.id &&
          item.restaurantId &&
          Number.isFinite(Number(item.price)) &&
          Number.isFinite(Number(item.quantity)) &&
          Number(item.quantity) > 0
        ).map((item) => ({ ...item, price: Number(item.price), quantity: Number(item.quantity) }))
      : [];
  } catch {
    return [];
  }
})();
let ffRestaurantsCache = [];
let ffActiveRestaurant = null;
let ffTrackingOrderId = localStorage.getItem("ff_active_order_id") || null;
let ffTrackingPoll = null;

ffRequireRole("customer", (user) => {
  ffUser = user;
  document.getElementById("ff-sidebar-name").textContent = user.name || user.email;
  document.getElementById("ff-greeting").textContent = `Good day, ${user.name?.split(" ")[0] || "there"}!`;
  initNav();
  loadDashboardRestaurants();
  renderCart();
  renderProfile();
  if (ffTrackingOrderId) startTracking(ffTrackingOrderId);
});

document.getElementById("ff-logout-btn").addEventListener("click", ffLogout);

// ---------------- View routing ----------------
function initNav() {
  document.querySelectorAll("[data-view]").forEach((el) => {
    if (el.tagName === "BUTTON" && el.closest(".ff-sidebar-nav")) {
      el.addEventListener("click", () => showView(el.dataset.view));
    }
  });
  document.getElementById("ff-back-to-restaurants").addEventListener("click", () => showView("restaurants"));
  document.getElementById("ff-mobile-menu-btn")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-sidebar-backdrop")?.addEventListener("click", toggleSidebar);
  document.getElementById("ff-checkout-btn").addEventListener("click", () => {
    if (!ffCart.length) return ffToast("Your cart is empty.", "error");
    renderCheckoutSummary();
    showView("checkout");
  });
  document.getElementById("ff-place-order-btn").addEventListener("click", placeOrder);
}

function toggleSidebar() {
  document.getElementById("ff-sidebar").classList.toggle("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.toggle("ff-open");
}

function showView(name) {
  document.querySelectorAll(".ff-view").forEach((v) => v.classList.toggle("ff-active", v.dataset.view === name));
  document.querySelectorAll(".ff-sidebar-nav .ff-nav-item").forEach((b) =>
    b.classList.toggle("ff-active", b.dataset.view === name)
  );
  document.getElementById("ff-sidebar").classList.remove("ff-open");
  document.getElementById("ff-sidebar-backdrop").classList.remove("ff-open");
  if (name === "cart") renderCart();
  if (name === "restaurants") loadRestaurantsList();
  if (name === "history") loadHistory();
  if (name === "tracking") renderTrackingEmptyIfNeeded();
}

// ---------------- Restaurants ----------------
async function loadDashboardRestaurants() {
  const el = document.getElementById("ff-dashboard-restaurants");
  el.innerHTML = ffLoadingState("Loading restaurants...");
  try {
    const { restaurants } = await ffApi.get("/api/restaurants");
    ffRestaurantsCache = restaurants;
    el.innerHTML = restaurants.length
      ? restaurants.map(restaurantCard).join("")
      : ffEmptyState("No restaurants available.");
    bindRestaurantCards(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load restaurants. Try again.");
  }
}

async function loadRestaurantsList() {
  const el = document.getElementById("ff-restaurants-list");
  el.innerHTML = ffLoadingState("Loading restaurants...");
  try {
    const { restaurants } = ffRestaurantsCache.length
      ? { restaurants: ffRestaurantsCache }
      : await ffApi.get("/api/restaurants");
    ffRestaurantsCache = restaurants;
    el.innerHTML = restaurants.length ? restaurants.map(restaurantCard).join("") : ffEmptyState("No restaurants available.");
    bindRestaurantCards(el);
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load restaurants. Try again.");
  }
}

function restaurantCard(r) {
  return `
    <div class="ff-card ff-r-card" data-id="${r.id}">
      <div class="ff-r-image">🍽️</div>
      <div class="ff-r-body">
        <h4>${r.name}</h4>
        <div class="ff-r-meta">
          <span>${r.cuisine || "Multi-cuisine"}</span>
          <span class="ff-r-rating">★ ${r.rating || "—"}</span>
        </div>
        <div class="ff-r-meta">
          <span>Prep ${r.prepTimeMin || "–"} min</span>
          <span>Delivery ${r.deliveryTimeMin || "–"} min</span>
        </div>
      </div>
    </div>`;
}

function bindRestaurantCards(container) {
  container.querySelectorAll(".ff-r-card").forEach((card) =>
    card.addEventListener("click", () => openRestaurant(card.dataset.id))
  );
}

async function openRestaurant(id) {
  showView("restaurant-detail");
  const menuEl = document.getElementById("ff-rd-menu");
  document.getElementById("ff-rd-name").textContent = "Loading...";
  menuEl.innerHTML = ffLoadingState("Loading menu...");
  try {
    const r = await ffApi.get(`/api/restaurants/${id}`);
    ffActiveRestaurant = r;
    document.getElementById("ff-rd-name").textContent = r.name;
    document.getElementById("ff-rd-meta").textContent = `${r.cuisine || ""} · ★ ${r.rating || "—"} · ${r.deliveryTimeMin || "–"} min delivery`;
    menuEl.innerHTML = r.menu?.length
      ? r.menu.map(menuItemRow).join("")
      : ffEmptyState("No dishes available yet.", "🍽️");
    bindMenuControls(menuEl, r);
  } catch (err) {
    document.getElementById("ff-rd-name").textContent = "Restaurant";
    menuEl.innerHTML = ffErrorState("Unable to load menu. Try again.");
  }
}

function menuItemRow(item) {
  const inCart = ffCart.find((c) => c.id === item.id);
  return `
    <div class="ff-menu-item" data-id="${item.id}">
      <div>
        <h4>${item.name}</h4>
        <div class="ff-price">${ffFormatCurrency(item.price)}${item.available === false ? " · Unavailable" : ""}</div>
      </div>
      ${item.available === false
        ? `<span class="ff-badge ff-badge-neutral">Sold out</span>`
        : inCart
          ? `<div class="ff-qty-control">
              <button data-action="dec">−</button>
              <span data-role="qty">${inCart.quantity}</span>
              <button data-action="inc">+</button>
             </div>`
          : `<button class="ff-btn ff-btn-primary ff-btn-sm" data-action="add">Add</button>`}
    </div>`;
}

function bindMenuControls(container, restaurant) {
  container.querySelectorAll(".ff-menu-item").forEach((row) => {
    const itemId = row.dataset.id;
    const item = restaurant.menu.find((m) => m.id === itemId);
    row.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "add" || action === "inc") addToCart(item, restaurant);
        if (action === "dec") decrementCart(item.id);
        row.outerHTML = menuItemRow({ ...item, available: item.available });
        bindMenuControls(container, restaurant);
      })
    );
  });
}

// ---------------- Cart ----------------
function saveCart() {
  localStorage.setItem("ff_cart", JSON.stringify(ffCart));
  renderCartBadge();
  renderCart();
}

function addToCart(item, restaurant) {
  if (ffCart.length && ffCart[0].restaurantId !== restaurant.id) {
    if (!confirm("Your cart has items from another restaurant. Clear cart and add this instead?")) return;
    ffCart = [];
  }
  const existing = ffCart.find((c) => c.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    ffCart.push({ id: item.id, name: item.name, price: item.price, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name });
  }
  saveCart();
  ffToast(`${item.name} added to cart`, "success");
}

function decrementCart(itemId) {
  const existing = ffCart.find((c) => c.id === itemId);
  if (!existing) return;
  existing.quantity -= 1;
  if (existing.quantity <= 0) ffCart = ffCart.filter((c) => c.id !== itemId);
  saveCart();
}

function renderCartBadge() {
  const count = ffCart.reduce((sum, c) => sum + c.quantity, 0);
  const badge = document.getElementById("ff-cart-count-badge");
  badge.textContent = count ? `(${count})` : "";
}

function cartTotals() {
  const subtotal = ffCart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const deliveryFee = subtotal > 0 ? 40 : 0;
  const discount = 0;
  const total = Math.max(subtotal + deliveryFee - discount, 0);
  return { subtotal, deliveryFee, discount, total };
}

function renderCart() {
  renderCartBadge();
  const itemsEl = document.getElementById("ff-cart-items");
  const summaryEl = document.getElementById("ff-cart-summary");
  if (!ffCart.length) {
    itemsEl.innerHTML = ffEmptyState("Your cart is empty.", "🛒");
    summaryEl.innerHTML = "";
    return;
  }
  itemsEl.innerHTML = ffCart
    .map(
      (c) => `
      <div class="ff-menu-item">
        <div><h4>${c.name}</h4><div class="ff-price">${ffFormatCurrency(c.price)} × ${c.quantity}</div></div>
        <div class="ff-qty-control">
          <button data-id="${c.id}" data-action="dec">−</button>
          <span>${c.quantity}</span>
          <button data-id="${c.id}" data-action="inc">+</button>
        </div>
      </div>`
    )
    .join("");
  itemsEl.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      const item = ffCart.find((c) => c.id === btn.dataset.id);
      if (btn.dataset.action === "inc") item.quantity += 1;
      else decrementCart(item.id);
      saveCart();
    })
  );
  const t = cartTotals();
  summaryEl.innerHTML = `
    <div class="ff-cart-line"><span>Subtotal</span><span>${ffFormatCurrency(t.subtotal)}</span></div>
    <div class="ff-cart-line"><span>Delivery fee</span><span>${ffFormatCurrency(t.deliveryFee)}</span></div>
    <div class="ff-cart-line"><span>Discount</span><span>−${ffFormatCurrency(t.discount)}</span></div>
    <div class="ff-cart-total"><span>Total</span><span>${ffFormatCurrency(t.total)}</span></div>`;
}

function renderCheckoutSummary() {
  const t = cartTotals();
  document.getElementById("ff-checkout-summary").innerHTML = `
    <h3 style="margin-bottom:14px;">Order summary</h3>
    ${ffCart.map((c) => `<div class="ff-cart-line"><span>${c.name} × ${c.quantity}</span><span>${ffFormatCurrency(c.price * c.quantity)}</span></div>`).join("")}
    <div class="ff-cart-total"><span>Total</span><span>${ffFormatCurrency(t.total)}</span></div>`;
}

async function placeOrder() {
  if (!ffCart.length) return ffToast("Your cart is empty.", "error");
  const btn = document.getElementById("ff-place-order-btn");
  btn.disabled = true;
  btn.textContent = "Placing order...";
  const t = cartTotals();
  try {
    const order = await ffApi.post("/api/orders", {
      customerId: ffUser.uid,
      customerName: ffUser.name,
      restaurantId: ffCart[0].restaurantId,
      restaurantName: ffCart[0].restaurantName,
      items: ffCart.map((c) => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity })),
      deliveryFee: t.deliveryFee,
      discount: t.discount,
      customerLocation: { lat: 14.4426 + Math.random() * 0.01, lng: 79.9865 + Math.random() * 0.01 },
    });
    ffCart = [];
    saveCart();
    ffTrackingOrderId = order.id;
    localStorage.setItem("ff_active_order_id", order.id);
    ffToast("Order placed!", "success");
    startTracking(order.id);
    showView("tracking");
  } catch (err) {
    ffToast("Could not place order. Try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
}

// ---------------- Order tracking ----------------
const TRACK_STAGES = [
  { key: "PLACED", label: "Order placed" },
  { key: "CONFIRMED", label: "Restaurant confirmed" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { key: "PICKED_UP", label: "Picked up" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

function renderTrackingEmptyIfNeeded() {
  if (!ffTrackingOrderId) {
    document.getElementById("ff-tracking-content").innerHTML = ffEmptyState("No active order right now.", "📍");
  }
}

function startTracking(orderId) {
  clearInterval(ffTrackingPoll);
  fetchAndRenderTracking(orderId);
  ffTrackingPoll = setInterval(() => fetchAndRenderTracking(orderId), 5000);
}

async function fetchAndRenderTracking(orderId) {
  const el = document.getElementById("ff-tracking-content");
  try {
    const order = await ffApi.get(`/api/orders/${orderId}`);
    const currentIndex = TRACK_STAGES.findIndex((s) => s.key === order.status);
    el.innerHTML = `
      <div class="ff-card" style="padding:24px; max-width:520px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
          <div>
            <h3 style="margin-bottom:2px;">${order.restaurantName}</h3>
            <p style="margin:0; font-size:13px;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span class="ff-badge ff-badge-info">ETA ${order.eta?.etaMinLow ?? "–"}–${order.eta?.etaMinHigh ?? "–"} min</span>
        </div>
        <ul class="ff-tracker">
          ${TRACK_STAGES.map((s, i) => {
            const cls = i < currentIndex ? "ff-done" : i === currentIndex ? "ff-current" : "";
            const icon = i < currentIndex ? "✓" : i === currentIndex ? "●" : "○";
            return `<li class="${cls}"><div class="ff-dot">${icon}</div><div><div class="ff-tstep-title">${s.label}</div></div></li>`;
          }).join("")}
        </ul>
        <div style="border-top:1px solid var(--ff-line); padding-top:14px; margin-top:8px;">
          ${order.items.map((it) => `<div class="ff-cart-line"><span>${it.name} × ${it.quantity}</span><span>${ffFormatCurrency(it.price * it.quantity)}</span></div>`).join("")}
          <div class="ff-cart-total"><span>Total</span><span>${ffFormatCurrency(order.total)}</span></div>
        </div>
      </div>`;
    if (order.status === "DELIVERED") {
      clearInterval(ffTrackingPoll);
      localStorage.removeItem("ff_active_order_id");
    }
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load order status.");
  }
}

// ---------------- History ----------------
async function loadHistory() {
  const el = document.getElementById("ff-history-content");
  el.innerHTML = ffLoadingState("Loading order history...");
  try {
    const { orders } = await ffApi.get(`/api/orders?customerId=${ffUser.uid}`);
    el.innerHTML = orders.length
      ? `<table class="ff-table"><thead><tr><th>Order</th><th>Restaurant</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>
          ${orders
            .map(
              (o) => `<tr>
                <td>#${o.id.slice(0, 8).toUpperCase()}</td>
                <td>${o.restaurantName}</td>
                <td>${o.items.length} item(s)</td>
                <td>${ffFormatCurrency(o.total)}</td>
                <td><span class="ff-badge ${o.status === "DELIVERED" ? "ff-badge-success" : "ff-badge-warning"}">${o.status.replace(/_/g, " ")}</span></td>
                <td>${ffFormatDate(o.createdAt)}</td>
              </tr>`
            )
            .join("")}
        </tbody></table>`
      : ffEmptyState("No orders yet — your history will show up here.", "🧾");
  } catch (err) {
    el.innerHTML = ffErrorState("Unable to load order history.");
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
