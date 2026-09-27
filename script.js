const CATS = ["Semua", "Tobrut", "Tepos", "Dildo", "Muncrat"];

let videos = [];

let query = "";
let page = "videos";
let activeGenre = "Semua"; // genre yang aktif di taskbar halaman Categories
let profileDrill = null;  // nama artis/channel yang sedang dibuka di halaman Artis/Chanel

const grid = document.getElementById("grid");
const chips = document.getElementById("chips");
const subHeader = document.getElementById("subHeader");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyText = document.getElementById("emptyText");
const pageTitle = document.getElementById("pageTitle");

const PAGE_TITLES = { videos: "Video", categories: "Categories", artis: "Artis", chanel: "Chanel" };

// --- Penyimpanan video (IndexedDB) ---
// File video (blob) disimpan permanen di browser, bukan cuma di memori,
// jadi videonya masih ada walau halaman di-refresh atau ditutup.
const DB_NAME = "hivereelDB";
const STORE_NAME = "videos";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function saveVideoToDB(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add(record);
    req.onsuccess = () => resolve(req.result); // id yang dihasilkan
    req.onerror = () => reject(req.error);
  });
}

async function loadVideosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteVideoFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadSavedVideos() {
  try {
    const saved = await loadVideosFromDB();
    const restored = saved
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((rec) => ({
        dbId: rec.id,
        title: rec.title,
        cat: rec.cat,
        user: rec.user,
        url: URL.createObjectURL(rec.blob),
      }));
    videos = [...restored];
    render();
  } catch (err) {
    console.error("Gagal memuat video tersimpan:", err);
  }
}

function renderChips() {
  chips.innerHTML = "";
  CATS.forEach((c) => {
    const el = document.createElement("button");
    el.className = "chip" + (c === activeGenre ? " active" : "");
    el.textContent = c;
    el.addEventListener("click", () => {
      activeGenre = c;
      render();
    });
    chips.appendChild(el);
  });
}

function iconPlay() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}

// Isi konten grid berbeda tergantung halaman aktif:
// - videos: semua video, difilter oleh chip kategori
// - categories: kartu kategori dulu, atau video 1 kategori kalau sudah dipilih
// - artis / chanel: kartu profil dulu, atau video 1 artis/channel kalau sudah dipilih
function getListForCurrentPage() {
  let list;

  if (page === "videos") {
    list = videos;
  } else if (page === "categories") {
    list = videos.filter((v) => activeGenre === "Semua" || v.cat === activeGenre);
  } else if (page === "artis" || page === "chanel") {
    list = profileDrill ? videos.filter((v) => v.user === profileDrill) : [];
  } else {
    list = videos;
  }

  if (query) list = list.filter((v) => v.title.toLowerCase().includes(query.toLowerCase()));
  return list;
}

function getUniqueProfiles() {
  const names = [...new Set(videos.map((v) => v.user).filter(Boolean))];
  return query ? names.filter((n) => n.toLowerCase().includes(query.toLowerCase())) : names;
}

function renderSubHeader() {
  const isProfileDrill = (page === "artis" || page === "chanel") && profileDrill;

  if (isProfileDrill) {
    const backLabel = page === "artis" ? "Semua artis" : "Semua channel";
    const prefixLabel = page === "artis" ? "Artis" : "Channel";

    subHeader.style.display = "flex";
    subHeader.innerHTML = `
      <button class="back-chip" id="backToList">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg>
        ${backLabel}
      </button>
      <span class="sub-title">${prefixLabel}: <b>${profileDrill}</b></span>`;
    document.getElementById("backToList").addEventListener("click", () => {
      profileDrill = null;
      render();
    });
  } else {
    subHeader.style.display = "none";
    subHeader.innerHTML = "";
  }
}

function renderProfileGrid() {
  const profiles = getUniqueProfiles();

  grid.innerHTML = "";
  emptyState.style.display = profiles.length ? "none" : "flex";
  emptyTitle.textContent = page === "artis" ? "Belum ada artis" : "Belum ada channel";
  emptyText.textContent = "Unggah video dan isi nama artis/channel untuk mengisi halaman ini.";

  profiles.forEach((name) => {
    const count = videos.filter((v) => v.user === name).length;
    const card = document.createElement("div");
    card.className = "card profile-card";
    card.innerHTML = `
      <span class="avatar big"></span>
      <div class="card-body">
        <p class="card-title">${name}</p>
        <div class="card-meta">${count} video</div>
      </div>`;
    card.addEventListener("click", () => {
      profileDrill = name;
      render();
    });
    grid.appendChild(card);
  });
}

function renderGrid() {
  const list = getListForCurrentPage();

  grid.innerHTML = "";
  emptyState.style.display = list.length ? "none" : "flex";
  if (page === "categories") {
    emptyTitle.textContent = "Belum ada video di kategori ini";
    emptyText.textContent = "Unggah video dengan kategori ini untuk mengisinya.";
  } else if (page === "artis" || page === "chanel") {
    emptyTitle.textContent = "Belum ada video di sini";
    emptyText.textContent = "Unggah video dengan artis/channel ini untuk mengisinya.";
  } else {
    emptyTitle.textContent = "Belum ada video di sini";
    emptyText.textContent = "Unggah video pertamamu untuk mulai mengisi Hivereel.";
  }

  list.forEach((v) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb">
        ${
          v.url
            ? `<video src="${v.url}" muted playsinline></video>`
            : `<div style="width:100%;height:100%;background:linear-gradient(160deg,var(--surface-2),var(--surface));"></div>`
        }
        <div class="play">${iconPlay()}</div>
      </div>
      <div class="card-body">
        <p class="card-title">${v.title}</p>
        <div class="card-meta"><span class="avatar"></span> ${v.user} · ${v.cat}</div>
      </div>`;

    // Preview on hover only makes sense with a mouse; touch devices just tap to open.
    const vidEl = card.querySelector("video");
    if (vidEl && window.matchMedia("(hover: hover)").matches) {
      card.addEventListener("mouseenter", () => {
        vidEl.currentTime = 0;
        vidEl.play().catch(() => {});
      });
      card.addEventListener("mouseleave", () => vidEl.pause());
    }
    card.addEventListener("click", () => openPlayer(v));
    grid.appendChild(card);
  });
}

function render() {
  pageTitle.textContent = PAGE_TITLES[page];

  renderSubHeader();

  // Chip genre (pill, sama seperti desain di fitur Video) cuma dipakai di halaman Categories
  const showChips = page === "categories";
  chips.style.display = showChips ? "flex" : "none";
  if (showChips) renderChips();

  // Halaman Artis/Chanel: tampilkan kartu profil dulu sebelum satu profil dipilih
  const showProfileTiles = (page === "artis" || page === "chanel") && !profileDrill;

  grid.style.display = "grid";

  if (showProfileTiles) renderProfileGrid();
  else renderGrid();
}

// Navigation
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("show");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("show");
}

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    page = btn.dataset.page;
    activeGenre = "Semua"; // mulai dari "Semua" setiap kali masuk halaman Categories
    profileDrill = null;   // mulai dari daftar profil setiap kali masuk halaman Artis/Chanel
    if (window.innerWidth <= 720) closeSidebar();
    render();
  });
});

document.getElementById("menuBtn").addEventListener("click", () => {
  if (sidebar.classList.contains("open")) closeSidebar();
  else openSidebar();
});
sidebarBackdrop.addEventListener("click", closeSidebar);

document.getElementById("searchInput").addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

// Player
const playerOverlay = document.getElementById("playerOverlay");
const playerVideo = document.getElementById("playerVideo");
const playerTitle = document.getElementById("playerTitle");
const playerMeta = document.getElementById("playerMeta");
const deletePlayerBtn = document.getElementById("deletePlayer");

function openPlayer(v) {
  if (!v.url) return; // sample cards have no real file to play
  playerVideo.src = v.url;
  playerTitle.textContent = v.title;
  playerMeta.textContent = `${v.user} · ${v.cat}`;
  deletePlayerBtn.style.display = v.dbId ? "flex" : "none";
  deletePlayerBtn.onclick = () => removeVideo(v);
  playerOverlay.classList.add("show");
  playerVideo.play().catch(() => {});
}

async function removeVideo(v) {
  if (!v.dbId) return;
  await deleteVideoFromDB(v.dbId);
  videos = videos.filter((x) => x.dbId !== v.dbId);
  closePlayer();
  render();
}

function closePlayer() {
  playerOverlay.classList.remove("show");
  playerVideo.pause();
  playerVideo.removeAttribute("src");
  playerVideo.load();
}

document.getElementById("closePlayer").addEventListener("click", closePlayer);
playerOverlay.addEventListener("click", (e) => {
  if (e.target === playerOverlay) closePlayer();
});

// Upload modal
const overlay = document.getElementById("overlay");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const dzText = document.getElementById("dzText");
let pendingFile = null;

document.getElementById("openUpload").addEventListener("click", () => {
  if (window.innerWidth <= 720) closeSidebar();
  overlay.classList.add("show");
});
document.getElementById("cancelUpload").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

function closeModal() {
  overlay.classList.remove("show");
  pendingFile = null;
  dzText.textContent = "Seret video ke sini, atau klik untuk memilih file";
  document.getElementById("titleInput").value = "";
  document.getElementById("artistInput").value = "";
  document.getElementById("catInput").value = "";
}

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) {
    pendingFile = fileInput.files[0];
    dzText.textContent = "Terpilih: " + pendingFile.name;
  }
});

["dragover", "dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    if (evt === "dragover") dropzone.classList.add("drag");
    else dropzone.classList.remove("drag");
    if (evt === "drop" && e.dataTransfer.files[0]) {
      pendingFile = e.dataTransfer.files[0];
      dzText.textContent = "Terpilih: " + pendingFile.name;
    }
  });
});

document.getElementById("confirmUpload").addEventListener("click", async () => {
  const title = document.getElementById("titleInput").value.trim() || "Video tanpa judul";
  const user = document.getElementById("artistInput").value.trim() || "Tanpa nama";
  const cat = document.getElementById("catInput").value.trim() || "Vlog";

  if (!pendingFile) {
    closeModal();
    return;
  }

  const record = { title, cat, user, blob: pendingFile, createdAt: Date.now() };
  let dbId = null;
  try {
    dbId = await saveVideoToDB(record);
  } catch (err) {
    console.error("Gagal menyimpan video:", err);
  }

  const url = URL.createObjectURL(pendingFile);
  videos.unshift({ dbId, title, cat, user, url });
  closeModal();

  page = "videos";
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  document.querySelector('.nav-item[data-page="videos"]').classList.add("active");
  render();
});

loadSavedVideos();
