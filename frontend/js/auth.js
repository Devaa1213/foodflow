// FOODFLOW — Demo/local authentication. Mock users are stored in browser localStorage.
const FF_ROLE_PAGES = { customer: "customer.html", restaurant: "restaurant.html", delivery: "delivery.html", admin: "admin.html" };
const FF_DEMO_USERS = {
  "customer@foodflow.demo": { uid: "demo_customer", name: "Demo Customer", role: "customer", password: "demo123" },
  "restaurant@foodflow.demo": { uid: "rest_greenleaf", name: "Green Leaf Kitchen", role: "restaurant", password: "demo123" },
  "delivery@foodflow.demo": { uid: "partner_arun", name: "Arun", role: "delivery", password: "demo123" },
  "admin@foodflow.demo": { uid: "demo_admin", name: "FoodFlow Admin", role: "admin", password: "demo123" }
};
function ffCurrentUser() { try { return JSON.parse(localStorage.getItem("ff_demo_user") || "null"); } catch { return null; } }
async function ffRegister({name,email,password,role}) {
  const user = { uid: `demo_${role}_${Date.now()}`, name, email, role, password };
  const users = JSON.parse(localStorage.getItem("ff_demo_users") || "{}"); users[email.toLowerCase()] = user; localStorage.setItem("ff_demo_users", JSON.stringify(users));
  localStorage.setItem("ff_demo_user", JSON.stringify(user)); return user;
}
async function ffLogin(email,password) {
  const custom = JSON.parse(localStorage.getItem("ff_demo_users") || "{}");
  const user = custom[email.toLowerCase()] || FF_DEMO_USERS[email.toLowerCase()];
  if (!user || user.password !== password) throw new Error("Demo login: use a listed demo account and password demo123, or register locally.");
  localStorage.setItem("ff_demo_user", JSON.stringify(user)); return user;
}
async function ffLogout() { localStorage.removeItem("ff_demo_user"); window.location.href = "index.html"; }
async function ffGetUserProfile(uid) { const user = ffCurrentUser(); return user && user.uid === uid ? user : null; }
async function ffRedirectToDashboard(uid) { const user = ffCurrentUser(); window.location.href = FF_ROLE_PAGES[user?.role] || "customer.html"; }
function ffRequireRole(expectedRole,onReady) {
  const user = ffCurrentUser();
  if (!user) { window.location.href = "index.html"; return; }
  if (user.role !== expectedRole) { window.location.href = FF_ROLE_PAGES[user.role] || "index.html"; return; }
  onReady(user);
}
function ffInitAuthModal() {
  const backdrop = document.getElementById("ff-auth-modal"), openBtns = document.querySelectorAll("[data-open-auth]"), closeBtn = document.getElementById("ff-modal-close"), tabs = document.querySelectorAll(".ff-modal-tab"), loginForm = document.getElementById("ff-login-form"), registerForm = document.getElementById("ff-register-form");
  if (!backdrop) return;
  openBtns.forEach(btn => btn.addEventListener("click", () => { backdrop.classList.add("ff-open"); setTab(btn.getAttribute("data-open-auth") || "login"); }));
  closeBtn?.addEventListener("click", () => backdrop.classList.remove("ff-open")); backdrop.addEventListener("click", e => { if(e.target === backdrop) backdrop.classList.remove("ff-open"); });
  function setTab(mode) { tabs.forEach(t => t.classList.toggle("ff-active",t.dataset.tab===mode)); if(loginForm) loginForm.style.display=mode==="login"?"block":"none"; if(registerForm) registerForm.style.display=mode==="register"?"block":"none"; }
  tabs.forEach(t => t.addEventListener("click",()=>setTab(t.dataset.tab)));
  loginForm?.addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("ff-login-email").value.trim(),password=document.getElementById("ff-login-password").value,btn=loginForm.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Signing in...";try{const user=await ffLogin(email,password);await ffRedirectToDashboard(user.uid);}catch(err){ffToast(err.message,"error");btn.disabled=false;btn.textContent="Log In";}});
  registerForm?.addEventListener("submit",async e=>{e.preventDefault();const name=document.getElementById("ff-reg-name").value.trim(),email=document.getElementById("ff-reg-email").value.trim(),password=document.getElementById("ff-reg-password").value,role=document.getElementById("ff-reg-role").value,btn=registerForm.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Creating account...";try{const user=await ffRegister({name,email,password,role});await ffRedirectToDashboard(user.uid);}catch(err){ffToast(err.message,"error");btn.disabled=false;btn.textContent="Create Account";}});
}
document.addEventListener("DOMContentLoaded", ffInitAuthModal);
