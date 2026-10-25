// =========================================================================
// Depo Ürünleri — Ana Uygulama Mantığı (script.js)
// =========================================================================

const EMBEDDED_CLOUD_DB_URL =
  window.DEPO_FIREBASE_CONFIG && window.DEPO_FIREBASE_CONFIG.databaseURL
    ? window.DEPO_FIREBASE_CONFIG.databaseURL
    : "https://depo-urunleri-default-rtdb.firebaseio.com";

const STORAGE_KEY = "depo_urunleri_state_v2";
const THEME_KEY = "depo_urunleri_theme";
const CLOUD_URL_KEY = "depo_urunleri_cloud_url";

let currentServerId = null;
let pendingServerId = null;
let currentTab = "urunler";
let eventSource = null;
let isRemoteUpdating = false;

function getTodayIso() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function makeInitialProduct(id, name, qty, customDelivery = null) {
  const todayIso = getTodayIso();
  return {
    id,
    name,
    qty,
    lastDelivery: customDelivery || {
      date: todayIso,
      addedQty: qty,
      prevQty: 0,
      totalAtDelivery: qty,
      isInitialRecord: true
    }
  };
}

function getSebastianCafeServer() {
  return {
    id: "srv_sebastian",
    name: "Sebastian Cafe",
    password: "1234",
    products: [
      makeInitialProduct("sb_1", "1L Orjinal Kola", 10),
      makeInitialProduct("sb_2", "1L Zero Kola", 8),
      makeInitialProduct("sb_3", "330ml Teneke Orjinal Kola", 12),
      makeInitialProduct("sb_4", "330ml Teneke Zero Kola", 10),
      makeInitialProduct("sb_5", "1L Fanta Portakal", 6),
      makeInitialProduct("sb_6", "330ml Teneke Fanta", 8),
      makeInitialProduct("sb_7", "1L Sprite", 6),
      makeInitialProduct("sb_8", "330ml Teneke Sprite", 8),
      makeInitialProduct("sb_9", "Büyük Ayran (300ml Koli)", 10),
      makeInitialProduct("sb_10", "Küçük Ayran (200ml Koli)", 14),
      makeInitialProduct("sb_11", "Sade Maden Suyu (Soda)", 15),
      makeInitialProduct("sb_12", "Limonlu Soda", 10),
      makeInitialProduct("sb_13", "Elmalı Soda", 8),
      makeInitialProduct("sb_14", "Şeftali Meyve Suyu (Teneke)", 9),
      makeInitialProduct("sb_15", "Vişne Meyve Suyu (Teneke)", 9),
      makeInitialProduct("sb_16", "Karışık Meyve Suyu (Teneke)", 7),
      makeInitialProduct("sb_17", "Portakal Meyve Suyu (1L)", 6),
      makeInitialProduct("sb_18", "Soğuk Çay Şeftali (330ml)", 8),
      makeInitialProduct("sb_19", "Soğuk Çay Limon (330ml)", 8),
      makeInitialProduct("sb_20", "Su (0.5L Koli)", 20)
    ],
    schedules: [
      { id: "sb_sc_1", company: "Coca-Cola (Kola, Fanta, Sprite)", day: "Cumartesi" },
      { id: "sb_sc_2", company: "Ayrancı (Ayran Grubu)", day: "Çarşamba ve Cumartesi" },
      { id: "sb_sc_3", company: "Beypazarı / Soda Toptancısı", day: "Salı" },
      { id: "sb_sc_4", company: "Cappy / Meyve Suyu Dağıtım", day: "Perşembe" }
    ]
  };
}

function getDefaultState() {
  const todayIso = getTodayIso();
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
  return {
    updatedAt: Date.now(),
    sebastianSeeded_v2: true,
    servers: [
      getSebastianCafeServer(),
      {
        id: "srv_merkez",
        name: "Merkez Depo (Örnek - Şifre: 1234)",
        password: "1234",
        products: [
          makeInitialProduct("p_1", "1L Orjinal Kola", 5, {
            date: threeDaysAgo,
            addedQty: 8,
            prevQty: 2,
            totalAtDelivery: 10
          }),
          makeInitialProduct("p_2", "2.5L Kola", 2, {
            date: fourDaysAgo,
            addedQty: 6,
            prevQty: 0,
            totalAtDelivery: 6
          }),
          makeInitialProduct("p_3", "330ml Kutu Kola", 8, {
            date: todayIso,
            addedQty: 8,
            prevQty: 0,
            totalAtDelivery: 8,
            isInitialRecord: true
          }),
          makeInitialProduct("p_4", "1L Fanta Portakal", 3, {
            date: todayIso,
            addedQty: 3,
            prevQty: 0,
            totalAtDelivery: 3,
            isInitialRecord: true
          }),
          makeInitialProduct("p_5", "Eti Cin Koli", 7),
          makeInitialProduct("p_6", "Ayrancı Tam Yağlı Yoğurt", 4)
        ],
        schedules: [
          { id: "sc_1", company: "Coca-Cola", day: "Cumartesi" },
          { id: "sc_2", company: "Eti", day: "Pazarları" },
          { id: "sc_3", company: "Ayrancı", day: "2 haftada bir Çarşamba" }
        ]
      }
    ]
  };
}

// Eski kayıtları ve yeni eklenen ürünleri otomatik olarak başlangıç tarihli hale getirir
function normalizeAndMigrateState(state) {
  if (!state || !Array.isArray(state.servers)) {
    return { state: getDefaultState(), changed: true };
  }
  let changed = false;
  const todayIso = getTodayIso();

  // Sebastian Cafe henüz eklenmemişse otomatik ekle
  const hasSebastian = state.servers.some(
    (s) => s.id === "srv_sebastian" || (s.name && s.name.toLocaleLowerCase("tr-TR").includes("sebastian"))
  );
  if (!hasSebastian && !state.sebastianSeeded_v2) {
    state.servers.unshift(getSebastianCafeServer());
    state.sebastianSeeded_v2 = true;
    changed = true;
  }

  // Tüm ürünlerin lastDelivery başlangıç kaydı olduğundan emin ol
  state.servers.forEach((srv) => {
    if (!Array.isArray(srv.products)) {
      srv.products = [];
      changed = true;
    }
    srv.products.forEach((p) => {
      const currentQty = Number(p.qty) || 0;
      if (!p.lastDelivery || !p.lastDelivery.date) {
        p.lastDelivery = {
          date: todayIso,
          addedQty: currentQty,
          prevQty: 0,
          totalAtDelivery: currentQty,
          isInitialRecord: true
        };
        changed = true;
      } else if (typeof p.lastDelivery.totalAtDelivery !== "number") {
        p.lastDelivery.totalAtDelivery = (Number(p.lastDelivery.prevQty) || 0) + (Number(p.lastDelivery.addedQty) || currentQty);
        changed = true;
      }
    });
  });

  return { state, changed };
}

let appState = loadLocalState();

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("depo_urunleri_state_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.servers)) {
        const { state } = normalizeAndMigrateState(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return state;
      }
    }
  } catch (e) {}
  const initial = getDefaultState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveState(pushToCloud = true) {
  appState.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  if (pushToCloud && !isRemoteUpdating) {
    pushStateToCloud();
  }
  renderAll();
}

// TEMA YÖNETİMİ (Light / Dark Mode)
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

// BULUT SENKRONİZASYONU (Cihazlar Arası Canlı Eşitleme)
function getActiveCloudUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("db");
  if (fromQuery) {
    localStorage.setItem(CLOUD_URL_KEY, fromQuery.trim());
    return fromQuery.trim().replace(/\/+$/, "");
  }
  if (EMBEDDED_CLOUD_DB_URL && EMBEDDED_CLOUD_DB_URL.trim() !== "") {
    return EMBEDDED_CLOUD_DB_URL.trim().replace(/\/+$/, "");
  }
  const fromStorage = localStorage.getItem(CLOUD_URL_KEY);
  return fromStorage ? fromStorage.trim().replace(/\/+$/, "") : "";
}

function updateSyncIndicator(status, label) {
  const dot = document.getElementById("syncDot");
  const text = document.getElementById("syncStatusText");
  if (!dot || !text) return;
  if (status === "online") {
    dot.classList.add("online");
  } else {
    dot.classList.remove("online");
  }
  text.textContent = label;
}

async function initCloudSync() {
  const dbUrl = getActiveCloudUrl();
  if (!dbUrl) {
    updateSyncIndicator("local", "Yerel Mod");
    return;
  }

  updateSyncIndicator("connecting", "Bağlanıyor...");
  const endpoint = `${dbUrl}/depo_urunleri.json`;

  try {
    const res = await fetch(endpoint);
    if (res.ok) {
      const remoteData = await res.json();
      if (remoteData && Array.isArray(remoteData.servers)) {
        const { state: migratedState, changed } = normalizeAndMigrateState(remoteData);
        isRemoteUpdating = true;
        appState = migratedState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        renderAll();
        isRemoteUpdating = false;
        if (changed) {
          await pushStateToCloud();
        }
      } else {
        await pushStateToCloud();
      }
      updateSyncIndicator("online", "Canlı Senkron");
    }
  } catch (err) {
    updateSyncIndicator("local", "Bağlantı Hatası");
  }

  if (eventSource) {
    eventSource.close();
  }
  try {
    eventSource = new EventSource(endpoint);
    eventSource.addEventListener("put", (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.path === "/" && payload.data && Array.isArray(payload.data.servers)) {
          if (!appState.updatedAt || payload.data.updatedAt > appState.updatedAt) {
            const { state: migrated } = normalizeAndMigrateState(payload.data);
            isRemoteUpdating = true;
            appState = migrated;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
            renderAll();
            isRemoteUpdating = false;
          }
        }
      } catch (_) {}
    });
  } catch (_) {}
}

async function pushStateToCloud() {
  const dbUrl = getActiveCloudUrl();
  if (!dbUrl) return;
  try {
    await fetch(`${dbUrl}/depo_urunleri.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appState)
    });
    updateSyncIndicator("online", "Canlı Senkron");
  } catch (e) {
    updateSyncIndicator("local", "Senkron Hatası");
  }
}

function openCloudModal() {
  const dbUrl = getActiveCloudUrl();
  document.getElementById("cloudUrlInput").value = dbUrl;
  updateShareLinkBox(dbUrl);
  document.getElementById("cloudModal").classList.add("open");
}

function updateShareLinkBox(dbUrl) {
  const box = document.getElementById("shareLinkContainer");
  if (dbUrl) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?db=${encodeURIComponent(dbUrl)}`;
    box.innerHTML = `<strong>Paylaşım Linki:</strong><br/><span>${shareUrl}</span>`;
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

function saveCloudConfig() {
  const val = document.getElementById("cloudUrlInput").value.trim().replace(/\/+$/, "");
  if (val) {
    localStorage.setItem(CLOUD_URL_KEY, val);
  } else {
    localStorage.removeItem(CLOUD_URL_KEY);
  }
  updateShareLinkBox(val);
  closeModal("cloudModal");
  initCloudSync();
}

function downloadEmbeddedHtml() {
  const val = document.getElementById("cloudUrlInput").value.trim().replace(/\/+$/, "");
  if (!val) {
    alert("Lütfen önce Firebase Realtime Database adresinizi kutuya yapıştırın.");
    return;
  }
  const configContent = `window.DEPO_FIREBASE_CONFIG = {\n  databaseURL: "${val}",\n  apiKey: "",\n  projectId: ""\n};\n`;
  const blob = new Blob([configContent], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "firebase-config.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// SUNUCU İŞLEMLERİ
function getCurrentServer() {
  return appState.servers.find((s) => s.id === currentServerId) || null;
}

function handleCreateServer(e) {
  e.preventDefault();
  const nameInput = document.getElementById("newServerName");
  const passInput = document.getElementById("newServerPass");
  const name = nameInput.value.trim();
  const password = passInput.value;
  if (!name || !password) return;

  const newSrv = {
    id: "srv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name,
    password,
    products: [],
    schedules: [
      { id: "sc_" + Date.now() + "_1", company: "Coca-Cola", day: "Cumartesi" },
      { id: "sc_" + Date.now() + "_2", company: "Eti", day: "Pazarları" },
      { id: "sc_" + Date.now() + "_3", company: "Ayrancı", day: "2 haftada bir Çarşamba" }
    ]
  };

  appState.servers.push(newSrv);
  nameInput.value = "";
  passInput.value = "";
  currentServerId = newSrv.id;
  currentTab = "urunler";
  saveState();
}

function promptServerPassword(serverId) {
  const srv = appState.servers.find((s) => s.id === serverId);
  if (!srv) return;
  pendingServerId = serverId;
  document.getElementById("passwordModalTitle").textContent = `${srv.name} — Giriş`;
  document.getElementById("serverPasswordPromptInput").value = "";
  document.getElementById("passwordErrorMsg").classList.add("hidden");
  document.getElementById("passwordModal").classList.add("open");
  setTimeout(() => document.getElementById("serverPasswordPromptInput").focus(), 50);
}

function handleConfirmPassword(e) {
  e.preventDefault();
  const srv = appState.servers.find((s) => s.id === pendingServerId);
  if (!srv) return;
  const entered = document.getElementById("serverPasswordPromptInput").value;
  if (entered === srv.password) {
    currentServerId = srv.id;
    currentTab = "urunler";
    closeModal("passwordModal");
    renderAll();
  } else {
    document.getElementById("passwordErrorMsg").classList.remove("hidden");
  }
}

function leaveServer() {
  currentServerId = null;
  renderAll();
}

function deleteServer(event, serverId) {
  event.stopPropagation();
  const srv = appState.servers.find((s) => s.id === serverId);
  if (!srv) return;
  const pass = prompt(`"${srv.name}" sunucusunu silmek için şifresini girin:`);
  if (pass === null) return;
  if (pass !== srv.password) {
    alert("Şifre hatalı, sunucu silinmedi.");
    return;
  }
  appState.servers = appState.servers.filter((s) => s.id !== serverId);
  saveState();
}

// ÜRÜN EKLEME VE KOLI SAYISI DÜZENLEME (+ / - ve Klavye)
function openAddProductModal() {
  document.getElementById("newProductNameInput").value = "";
  document.getElementById("newProductQtyInput").value = "1";
  document.getElementById("addProductModal").classList.add("open");
  setTimeout(() => document.getElementById("newProductNameInput").focus(), 50);
}

function handleAddProduct(e) {
  e.preventDefault();
  const srv = getCurrentServer();
  if (!srv) return;
  const name = document.getElementById("newProductNameInput").value.trim();
  const qty = Math.max(0, parseInt(document.getElementById("newProductQtyInput").value, 10) || 0);
  if (!name) return;

  if (!Array.isArray(srv.products)) srv.products = [];
  const todayIso = getTodayIso();

  // Yeni ürün eklendiği anda bugünün tarihiyle başlangıç kaydı açılır;
  // böylece "-" butonuna basıldığı anda günde kaç koli gittiği hemen hesaplanır.
  srv.products.push({
    id: "prd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name,
    qty,
    lastDelivery: {
      date: todayIso,
      addedQty: qty,
      prevQty: 0,
      totalAtDelivery: qty,
      isInitialRecord: true
    }
  });

  closeModal("addProductModal");
  saveState();
}

function ensureProductBaseline(item) {
  const todayIso = getTodayIso();
  const currentQty = Number(item.qty) || 0;
  if (!item.lastDelivery || !item.lastDelivery.date) {
    item.lastDelivery = {
      date: todayIso,
      addedQty: currentQty,
      prevQty: 0,
      totalAtDelivery: currentQty,
      isInitialRecord: true
    };
  }
}

function adjustProductQty(productId, delta) {
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.products)) return;
  const item = srv.products.find((p) => p.id === productId);
  if (!item) return;

  ensureProductBaseline(item);
  const nextQty = Math.max(0, (Number(item.qty) || 0) + delta);
  item.qty = nextQty;

  // Eğer kullanıcı ana ekranda + ile başlangıç/toplam stoğun üstüne çıkarsa tepe stoğu da güncelle
  if (nextQty > (Number(item.lastDelivery.totalAtDelivery) || 0)) {
    const diff = nextQty - (Number(item.lastDelivery.totalAtDelivery) || 0);
    item.lastDelivery.totalAtDelivery = nextQty;
    item.lastDelivery.addedQty = (Number(item.lastDelivery.addedQty) || 0) + diff;
  }

  saveState();
}

function setProductQtyDirect(productId, rawValue) {
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.products)) return;
  const item = srv.products.find((p) => p.id === productId);
  if (!item) return;

  ensureProductBaseline(item);
  const parsed = parseInt(rawValue, 10);
  const nextQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
  item.qty = nextQty;

  if (nextQty > (Number(item.lastDelivery.totalAtDelivery) || 0)) {
    const diff = nextQty - (Number(item.lastDelivery.totalAtDelivery) || 0);
    item.lastDelivery.totalAtDelivery = nextQty;
    item.lastDelivery.addedQty = (Number(item.lastDelivery.addedQty) || 0) + diff;
  }

  saveState();
}

function removeProduct(productId) {
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.products)) return;
  const item = srv.products.find((p) => p.id === productId);
  if (!item) return;
  if (!confirm(`"${item.name}" ürününü listeden kaldırmak istiyor musunuz?`)) return;
  srv.products = srv.products.filter((p) => p.id !== productId);
  saveState();
}

// MAL GELİŞ (ŞİRKET GELİŞ GÜNLERİ) İŞLEMLERİ
function handleAddCompanySchedule(e) {
  e.preventDefault();
  const srv = getCurrentServer();
  if (!srv) return;
  const companyInput = document.getElementById("companyNameInput");
  const dayInput = document.getElementById("companyDayInput");
  const company = companyInput.value.trim();
  const day = dayInput.value.trim();
  if (!company || !day) return;

  if (!Array.isArray(srv.schedules)) srv.schedules = [];
  srv.schedules.push({
    id: "sc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
    company,
    day
  });

  companyInput.value = "";
  dayInput.value = "";
  saveState();
}

function updateScheduleField(scheduleId, field, value) {
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.schedules)) return;
  const row = srv.schedules.find((s) => s.id === scheduleId);
  if (!row) return;
  row[field] = value;
  saveState();
}

function removeScheduleRow(scheduleId) {
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.schedules)) return;
  srv.schedules = srv.schedules.filter((s) => s.id !== scheduleId);
  saveState();
}

// GEÇMİŞ (TESLİMAT EKLEME VE GÜNLÜK TÜKETİM HESAPLAMA)
function calculateConsumptionStats(product) {
  ensureProductBaseline(product);
  const ld = product.lastDelivery;
  const today = new Date(getTodayIso() + "T00:00:00");
  const deliveryDate = new Date(ld.date + "T00:00:00");
  const diffMs = today.getTime() - deliveryDate.getTime();
  const rawDays = Math.max(0, Math.round(diffMs / 86400000));
  const elapsedDays = Math.max(1, rawDays);

  const totalAtDelivery = Number(ld.totalAtDelivery ?? ((Number(ld.prevQty) || 0) + (Number(ld.addedQty) || 0)));
  const currentRemaining = Number(product.qty) || 0;
  const consumedCases = Math.max(0, totalAtDelivery - currentRemaining);
  const dailyRate = consumedCases / elapsedDays;

  const formattedRate = Number.isInteger(dailyRate)
    ? dailyRate.toString()
    : dailyRate.toFixed(1).replace(/\.0$/, "");

  return {
    deliveryDateStr: ld.date,
    rawDays,
    elapsedDays,
    addedQty: Number(ld.addedQty) || 0,
    prevQty: Number(ld.prevQty) || 0,
    totalAtDelivery,
    currentRemaining,
    consumedCases,
    dailyRate,
    formattedRate,
    isInitialRecord: Boolean(ld.isInitialRecord)
  };
}

function updateDeliveryPreview() {
  const srv = getCurrentServer();
  const previewEl = document.getElementById("deliveryPreviewBox");
  if (!srv || !previewEl) return;

  const prodId = document.getElementById("deliveryProductSelect").value;
  const addedQty = parseInt(document.getElementById("deliveryQtyInput").value, 10) || 0;
  const prod = (srv.products || []).find((p) => p.id === prodId);

  if (!prod) {
    previewEl.textContent = "Önce + ikonuyla depoya ürün ekleyin.";
    return;
  }

  const prevQty = Number(prod.qty) || 0;
  const newTotal = prevQty + Math.max(0, addedQty);
  previewEl.innerHTML = `<strong>${escapeHtml(prod.name)}</strong>: Eldeki <strong>${prevQty} koli</strong> + Yeni gelen <strong>${Math.max(0, addedQty)} koli</strong> = Depoda toplam <strong>${newTotal} koli</strong> olacak.`;
}

function handleAddDelivery(e) {
  e.preventDefault();
  const srv = getCurrentServer();
  if (!srv || !Array.isArray(srv.products)) return;

  const prodId = document.getElementById("deliveryProductSelect").value;
  const addedQty = parseInt(document.getElementById("deliveryQtyInput").value, 10);
  const dateStr = document.getElementById("deliveryDateInput").value || getTodayIso();

  const prod = srv.products.find((p) => p.id === prodId);
  if (!prod || isNaN(addedQty) || addedQty <= 0) return;

  const prevQty = Number(prod.qty) || 0;
  const totalAtDelivery = prevQty + addedQty;

  prod.qty = totalAtDelivery;
  prod.lastDelivery = {
    date: dateStr,
    addedQty,
    prevQty,
    totalAtDelivery,
    isInitialRecord: false
  };

  document.getElementById("deliveryQtyInput").value = "";
  saveState();
}

function switchTab(tabName) {
  currentTab = tabName;
  renderAll();
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTurkishDate(isoDate) {
  if (!isoDate) return "-";
  try {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "short" });
  } catch (e) {
    return isoDate;
  }
}

function renderServers() {
  const container = document.getElementById("serverList");
  const servers = appState.servers || [];
  if (servers.length === 0) {
    container.innerHTML = `<div class="empty-state">Henüz oluşturulmuş bir sunucu yok. Yukarıdan ilk sunucunuzu kurabilirsiniz.</div>`;
    return;
  }

  container.innerHTML = servers
    .map((srv) => {
      const count = Array.isArray(srv.products) ? srv.products.length : 0;
      const totalCases = (srv.products || []).reduce((acc, p) => acc + (Number(p.qty) || 0), 0);
      return `
        <div class="server-card" onclick="promptServerPassword('${srv.id}')">
          <div class="server-name">
            <span>🔒 ${escapeHtml(srv.name)}</span>
            <button class="delete-icon-btn" title="Sunucuyu Sil" onclick="deleteServer(event, '${srv.id}')">✕</button>
          </div>
          <div class="server-meta">
            <span>${count} çeşit ürün</span>
            <span>Toplam ${totalCases} koli</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProducts() {
  const srv = getCurrentServer();
  if (!srv) return;
  const products = Array.isArray(srv.products) ? srv.products : [];
  const query = (document.getElementById("productSearchInput")?.value || "").trim().toLocaleLowerCase("tr-TR");

  const totalCases = products.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
  document.getElementById("productSummaryBadge").textContent = `${products.length} çeşit • ${totalCases} koli`;

  const filtered = query
    ? products.filter((p) => p.name.toLocaleLowerCase("tr-TR").includes(query))
    : products;

  const listEl = document.getElementById("productListContainer");
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="card empty-state">Ürün bulunamadı. Sağ üstteki <strong>+</strong> butonuna basarak istediğiniz kadar ürün ekleyebilirsiniz.</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((p) => {
      const stats = calculateConsumptionStats(p);
      const dayText = stats.rawDays === 0 ? "bugün" : `${stats.rawDays} gün önce`;
      const recordTypeLabel = stats.isInitialRecord
        ? `Başlangıç: ${stats.totalAtDelivery} koli (${dayText}) • Giden: ${stats.consumedCases} koli`
        : `Son geliş: +${stats.addedQty} koli (${dayText}) • Giden: ${stats.consumedCases} koli`;

      return `
        <div class="product-item">
          <div class="product-info">
            <div class="product-title">${escapeHtml(p.name)}</div>
            <div class="product-sub">
              <span class="rate-pill">günde ${stats.formattedRate} koli</span>
              <span>${recordTypeLabel}</span>
            </div>
          </div>
          <div class="stock-controls">
            <button type="button" class="step-btn" onclick="adjustProductQty('${p.id}', -1)" aria-label="1 Koli Azalt">-</button>
            <input
              type="number"
              min="0"
              step="1"
              class="qty-input"
              value="${Number(p.qty) || 0}"
              onchange="setProductQtyDirect('${p.id}', this.value)"
              onclick="this.select()"
              aria-label="Koli Sayısı"
            />
            <button type="button" class="step-btn" onclick="adjustProductQty('${p.id}', 1)" aria-label="1 Koli Artır">+</button>
            <span class="qty-unit">koli</span>
            <button type="button" class="delete-icon-btn" title="Ürünü Sil" onclick="removeProduct('${p.id}')">✕</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSchedules() {
  const srv = getCurrentServer();
  if (!srv) return;
  const schedules = Array.isArray(srv.schedules) ? srv.schedules : [];
  const tbody = document.getElementById("scheduleTableBody");

  if (schedules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Henüz şirket geliş günü eklenmedi.</td></tr>`;
    return;
  }

  tbody.innerHTML = schedules
    .map(
      (row) => `
      <tr>
        <td>
          <input
            type="text"
            class="inline-edit"
            value="${escapeHtml(row.company)}"
            onchange="updateScheduleField('${row.id}', 'company', this.value)"
          />
        </td>
        <td>
          <input
            type="text"
            class="inline-edit"
            value="${escapeHtml(row.day)}"
            onchange="updateScheduleField('${row.id}', 'day', this.value)"
          />
        </td>
        <td style="text-align:right;">
          <button type="button" class="delete-icon-btn" onclick="removeScheduleRow('${row.id}')">✕</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderHistory() {
  const srv = getCurrentServer();
  if (!srv) return;
  const products = Array.isArray(srv.products) ? srv.products : [];

  const selectEl = document.getElementById("deliveryProductSelect");
  const currentSelected = selectEl.value;
  if (products.length === 0) {
    selectEl.innerHTML = `<option value="">Önce + ile ürün ekleyin</option>`;
  } else {
    selectEl.innerHTML = products
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (Şu an: ${Number(p.qty) || 0} koli)</option>`)
      .join("");
    if (currentSelected && products.some((p) => p.id === currentSelected)) {
      selectEl.value = currentSelected;
    }
  }

  const dateInput = document.getElementById("deliveryDateInput");
  if (!dateInput.value) {
    dateInput.value = getTodayIso();
  }
  updateDeliveryPreview();

  const historyContainer = document.getElementById("historyListContainer");

  if (products.length === 0) {
    historyContainer.innerHTML = `<div class="empty-state">Henüz depoda ürün yok. Sağ üstteki + butonuyla ürün ekleyebilirsiniz.</div>`;
    return;
  }

  historyContainer.innerHTML = products
    .map((p) => {
      const st = calculateConsumptionStats(p);
      const dayLabel = st.rawDays === 0 ? "Bugün kayıt/geliş (1. gün)" : `${st.rawDays} gün geçti`;
      const sourceDetail = st.isInitialRecord
        ? `İlk kayıt stoğu: <strong>${st.totalAtDelivery} koli</strong>`
        : `Son alınan: <strong>${st.addedQty} koli</strong> (Elde ${st.prevQty} vardı → Toplam ${st.totalAtDelivery} oldu)`;

      return `
        <div class="product-item" style="flex-wrap:wrap;">
          <div class="product-info">
            <div class="product-title">${escapeHtml(p.name)}</div>
            <div class="product-sub">
              <span>📅 Başlangıç / Son Geliş: <strong>${formatTurkishDate(st.deliveryDateStr)}</strong> (${dayLabel})</span>
              <span>•</span>
              <span>${sourceDetail}</span>
              <span>•</span>
              <span>Şu an kalan: <strong>${st.currentRemaining} koli</strong> (<strong>${st.consumedCases} koli</strong> gitti)</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="rate-pill" style="font-size:0.88rem; padding:6px 10px;">günde ${st.formattedRate} koli</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  const srv = getCurrentServer();
  const serversView = document.getElementById("serversView");
  const insideView = document.getElementById("insideServerView");
  const backBtn = document.getElementById("backToServersBtn");
  const addProdBtn = document.getElementById("addProductTopBtn");
  const bottomNav = document.getElementById("bottomNav");
  const headerTitle = document.getElementById("headerTitle");
  const headerSubtitle = document.getElementById("headerSubtitle");

  if (!srv) {
    serversView.classList.remove("hidden");
    insideView.classList.add("hidden");
    backBtn.classList.add("hidden");
    addProdBtn.classList.add("hidden");
    bottomNav.classList.add("hidden");
    headerTitle.textContent = "Depo Ürünleri";
    headerSubtitle.textContent = "Sunucu seçin veya yeni oluşturun";
    renderServers();
    return;
  }

  serversView.classList.add("hidden");
  insideView.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  addProdBtn.classList.remove("hidden");
  bottomNav.classList.remove("hidden");

  headerTitle.textContent = srv.name;
  headerSubtitle.textContent =
    currentTab === "urunler"
      ? "Depo Stok Listesi"
      : currentTab === "malgelis"
      ? "Şirket Mal Geliş Çizelgesi"
      : "Teslimat Geçmişi ve Günlük Satış Hızı";

  document.getElementById("tabUrunler").classList.toggle("hidden", currentTab !== "urunler");
  document.getElementById("tabMalGelis").classList.toggle("hidden", currentTab !== "malgelis");
  document.getElementById("tabGecmis").classList.toggle("hidden", currentTab !== "gecmis");

  document.getElementById("navBtnUrunler").classList.toggle("active", currentTab === "urunler");
  document.getElementById("navBtnMalGelis").classList.toggle("active", currentTab === "malgelis");
  document.getElementById("navBtnGecmis").classList.toggle("active", currentTab === "gecmis");

  renderProducts();
  renderSchedules();
  renderHistory();
}

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try {
      appState = JSON.parse(e.newValue);
      renderAll();
    } catch (_) {}
  }
});

initTheme();
renderAll();
initCloudSync();
