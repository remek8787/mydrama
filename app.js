const DEFAULT_KEY = "331D2CC91BC4C0B2218052619DBBBA84";

const platforms = {
  dramabox: {
    label: "Dramabox",
    base: "https://dramabox.dramabos.my.id",
    langs: ["in", "en", "th", "vi", "ja", "ko"],
    defaultLang: "in",
    homePath: (lang) => `/api/v1/homepage?page=1&lang=${enc(lang)}`,
    searchPath: (q, lang) => `/api/v1/search?query=${enc(q)}&lang=${enc(lang)}`,
    detailPath: (id, lang, key) => `/api/v1/detail?bookId=${enc(id)}&lang=${enc(lang)}&code=${enc(key)}`,
    episodesPath: (id, lang, key) => `/api/v1/allepisode?bookId=${enc(id)}&lang=${enc(lang)}&code=${enc(key)}`,
    episodeToVideoPath: null,
    idKeys: ["bookId", "id", "dramaId"],
    titleKeys: ["bookName", "title", "name"],
    imageKeys: ["coverWap", "cover", "poster", "image", "bookCover"],
    episodeIdKeys: ["episodeId", "id", "chapterId", "vid", "videoId"]
  },
  melolo: {
    label: "Melolo",
    base: "https://melolo.dramabos.my.id",
    langs: ["id", "en", "es", "ko", "th", "ja", "de", "fr", "pt", "ar", "tr"],
    defaultLang: "id",
    homePath: (lang) => `/api/home?lang=${enc(lang)}&offset=0`,
    searchPath: (q, lang) => `/api/search?lang=${enc(lang)}&q=${enc(q)}`,
    detailPath: (id, lang) => `/api/detail/${enc(id)}?lang=${enc(lang)}`,
    episodesPath: () => null,
    episodeToVideoPath: (epId, lang, key) => `/api/video/${enc(epId)}?lang=${enc(lang)}&code=${enc(key)}`,
    idKeys: ["id", "dramaId", "bookId", "seriesId", "book_id"],
    titleKeys: ["title", "name", "dramaName", "bookName", "book_name"],
    imageKeys: ["cover", "coverUrl", "poster", "img", "image", "thumb_url"],
    episodeIdKeys: ["vid", "videoId", "id", "episodeId", "chapterId"]
  },
  shortmax: {
    label: "Shortmax",
    base: "https://shortmax.dramabos.my.id",
    langs: ["in", "en", "th", "vi", "es", "pt", "de", "fr", "ja", "ko", "ar"],
    defaultLang: "in",
    homePath: (lang) => `/api/home?lang=${enc(lang)}&page=1&size=30`,
    searchPath: (q, lang) => `/api/search?lang=${enc(lang)}&q=${enc(q)}&size=20`,
    detailPath: null,
    episodesPath: (id, lang, key) => `/api/chapters/${enc(id)}?lang=${enc(lang)}&code=${enc(key)}`,
    episodeToVideoPath: null,
    idKeys: ["id", "bookId", "dramaId", "seriesId"],
    titleKeys: ["title", "name", "bookName", "dramaName"],
    imageKeys: ["cover", "coverUrl", "poster", "image"],
    episodeIdKeys: ["chapterId", "id", "episodeId", "vid", "videoId"]
  }
};

const state = {
  currentPlatform: "dramabox",
  currentLang: "in",
  apiKey: DEFAULT_KEY,
  searchResults: [],
  selectedItem: null,
  detailData: null,
  episodes: []
};

let hlsInstance = null;

const ui = {
  apiKey: byId("apiKey"),
  saveKeyBtn: byId("saveKeyBtn"),
  platformSelect: byId("platformSelect"),
  langSelect: byId("langSelect"),
  queryInput: byId("queryInput"),
  searchBtn: byId("searchBtn"),
  status: byId("status"),
  heroImage: byId("heroImage"),
  heroBadge: byId("heroBadge"),
  heroTitle: byId("heroTitle"),
  heroDesc: byId("heroDesc"),
  heroWatchBtn: byId("heroWatchBtn"),
  heroRefreshBtn: byId("heroRefreshBtn"),
  resultCount: byId("resultCount"),
  resultGrid: byId("resultGrid"),
  detailTitle: byId("detailTitle"),
  detailMeta: byId("detailMeta"),
  episodeList: byId("episodeList"),
  rawJson: byId("rawJson"),
  playerInfo: byId("playerInfo"),
  player: byId("videoPlayer")
};

function byId(id) {
  return document.getElementById(id);
}

function enc(v) {
  return encodeURIComponent(String(v ?? ""));
}

function setStatus(msg) {
  ui.status.textContent = msg;
}

function hasApiKey() {
  return Boolean(state.apiKey && state.apiKey.trim());
}

function saveLocal() {
  localStorage.setItem("mydrama_api_key", state.apiKey);
  localStorage.setItem("mydrama_platform", state.currentPlatform);
  localStorage.setItem("mydrama_lang", state.currentLang);
}

function loadLocal() {
  state.apiKey = localStorage.getItem("mydrama_api_key") || DEFAULT_KEY;
  state.currentPlatform = localStorage.getItem("mydrama_platform") || "dramabox";
  if (!platforms[state.currentPlatform]) state.currentPlatform = "dramabox";

  const defaultLang = platforms[state.currentPlatform].defaultLang;
  const savedLang = localStorage.getItem("mydrama_lang");
  state.currentLang = platforms[state.currentPlatform].langs.includes(savedLang)
    ? savedLang
    : defaultLang;
}

function applyUrlOverrides() {
  const params = new URLSearchParams(window.location.search);
  const qsPlatform = (params.get("platform") || "").toLowerCase().trim();
  const qsLang = (params.get("lang") || "").toLowerCase().trim();
  const qsKey = (params.get("key") || "").trim();

  if (qsPlatform && platforms[qsPlatform]) {
    state.currentPlatform = qsPlatform;
  }

  if (qsLang && platforms[state.currentPlatform].langs.includes(qsLang)) {
    state.currentLang = qsLang;
  }

  if (qsKey) {
    state.apiKey = qsKey;
  }

  return {
    query: (params.get("q") || "").trim(),
    autoSearch: params.get("auto") === "1"
  };
}

function buildPlatformSelect() {
  ui.platformSelect.innerHTML = Object.entries(platforms)
    .map(([key, cfg]) => `<option value="${key}">${cfg.label}</option>`)
    .join("");
  ui.platformSelect.value = state.currentPlatform;
}

function buildLangSelect() {
  const cfg = platforms[state.currentPlatform];
  ui.langSelect.innerHTML = cfg.langs.map((l) => `<option value="${l}">${l.toUpperCase()}</option>`).join("");
  if (!cfg.langs.includes(state.currentLang)) state.currentLang = cfg.defaultLang;
  ui.langSelect.value = state.currentLang;
}

async function apiGet(path) {
  const cfg = platforms[state.currentPlatform];
  const url = cfg.base + path;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}

function deepCollectArrays(input, out = []) {
  if (!input || typeof input !== "object") return out;
  if (Array.isArray(input)) {
    out.push(input);
    input.forEach((v) => deepCollectArrays(v, out));
    return out;
  }
  Object.values(input).forEach((v) => deepCollectArrays(v, out));
  return out;
}

function pickLikelyArray(data, preferred = []) {
  for (const p of preferred) {
    const val = getByPath(data, p);
    if (Array.isArray(val) && val.length) return val;
  }

  const arrays = deepCollectArrays(data).filter((a) => a.length && typeof a[0] === "object");
  if (!arrays.length) return [];
  arrays.sort((a, b) => b.length - a.length);
  return arrays[0];
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
}

function findValue(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const nested = findValue(v, keys);
      if (nested !== "") return nested;
    }
  }

  return "";
}

function findFirstUrl(input) {
  if (!input) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^https?:\/\//i.test(s) && /(m3u8|mp4|flv|mpd|webm|play\/)/i.test(s)) return s;
    return "";
  }

  if (Array.isArray(input)) {
    for (const v of input) {
      const found = findFirstUrl(v);
      if (found) return found;
    }
    return "";
  }

  if (typeof input === "object") {
    const directKeys = ["hlsUrl", "playUrl", "videoUrl", "url", "streamUrl", "m3u8", "src", "file", "play_path"];
    for (const k of directKeys) {
      if (typeof input[k] === "string") {
        const s = input[k].trim();
        if (/^https?:\/\//i.test(s)) return s;
      }
    }

    for (const v of Object.values(input)) {
      const found = findFirstUrl(v);
      if (found) return found;
    }
  }

  return "";
}

function normalizeItems(rawItems) {
  const cfg = platforms[state.currentPlatform];

  const list = rawItems
    .map((item) => {
      const id = String(findValue(item, cfg.idKeys) || "").trim();
      const title = String(findValue(item, cfg.titleKeys) || "Untitled").trim();
      const image = String(findValue(item, cfg.imageKeys) || "").trim();

      return {
        id,
        title,
        image,
        raw: item,
        subtitle: String(
          item.author ||
            item.type ||
            item.classify ||
            item.category ||
            (item.episodes ? `${item.episodes} eps` : "") ||
            (item.serial_count ? `${item.serial_count} eps` : "") ||
            ""
        )
      };
    })
    .filter((x) => x.id || x.title !== "Untitled");

  // Dedup by ID/title
  const seen = new Set();
  return list.filter((x) => {
    const key = `${x.id}::${x.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateHero(item) {
  const cfg = platforms[state.currentPlatform];

  if (!item) {
    ui.heroBadge.textContent = `Featured • ${cfg.label}`;
    ui.heroTitle.textContent = "Belum ada drama dipilih";
    ui.heroDesc.textContent = "Coba ganti platform atau bahasa, lalu cari lagi.";
    ui.heroImage.src = "https://dummyimage.com/1200x500/0f172a/94a3b8&text=No+Data";
    return;
  }

  ui.heroBadge.textContent = `${cfg.label} • ${state.currentLang.toUpperCase()}`;
  ui.heroTitle.textContent = item.title || "Untitled";

  const shortDesc =
    String(item.subtitle || findValue(item.raw, ["synopsis", "desc", "description", "intro", "summary"]) || "")
      .replace(/\s+/g, " ")
      .trim() || "Pilih untuk melihat detail dan daftar episode.";

  ui.heroDesc.textContent = shortDesc.slice(0, 180);
  ui.heroImage.src = item.image || "https://dummyimage.com/1200x500/0f172a/94a3b8&text=No+Cover";
}

function renderResults() {
  ui.resultCount.textContent = `${state.searchResults.length} hasil`;

  const heroTarget =
    (state.selectedItem &&
      state.searchResults.find((x) => String(x.id) === String(state.selectedItem.id) && x.title === state.selectedItem.title)) ||
    state.searchResults[0] ||
    null;
  updateHero(heroTarget);

  if (!state.searchResults.length) {
    ui.resultGrid.innerHTML = `<div class="empty">Tidak ada hasil. Coba keyword lain.</div>`;
    return;
  }

  ui.resultGrid.innerHTML = state.searchResults
    .map((item, idx) => `
      <article class="card ${state.selectedItem && String(state.selectedItem.id) === String(item.id) ? "active" : ""}" data-idx="${idx}">
        <img src="${item.image || "https://dummyimage.com/400x600/0f172a/94a3b8&text=No+Cover"}" alt="${escapeHtml(item.title)}" loading="lazy" />
        <div class="info">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="sub">${escapeHtml(item.subtitle || item.id || "")}</div>
        </div>
      </article>
    `)
    .join("");

  ui.resultGrid.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      const item = state.searchResults[idx];
      if (item) loadDetail(item);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function searchDrama() {
  const query = ui.queryInput.value.trim();
  if (!query) {
    await loadHomeContent();
    return;
  }

  setStatus(`Mencari “${query}” di ${platforms[state.currentPlatform].label}...`);

  try {
    const cfg = platforms[state.currentPlatform];
    const data = await apiGet(cfg.searchPath(query, state.currentLang));
    const list = pickLikelyArray(data, [
      "records",
      "result.records",
      "result.list",
      "result",
      "data.records",
      "data.list",
      "data",
      "list",
      "items",
      "recommendList.records"
    ]);

    state.searchResults = normalizeItems(list);
    renderResults();
    setStatus(`Selesai. Ditemukan ${state.searchResults.length} hasil.`);
  } catch (err) {
    console.error(err);
    setStatus(`Gagal search: ${err.message}. Kemungkinan CORS / token / endpoint limit.`);
    state.searchResults = [];
    renderResults();
  }
}

async function loadHomeContent() {
  const cfg = platforms[state.currentPlatform];
  if (!cfg.homePath) return;

  setStatus(`Memuat beranda ${cfg.label}...`);

  try {
    const data = await apiGet(cfg.homePath(state.currentLang));
    let list = [];

    // Melolo home response usually nested in data.cell.cell_data[].books[]
    const meloloCellRows = getByPath(data, "data.cell.cell_data");
    if (Array.isArray(meloloCellRows) && meloloCellRows.length) {
      list = meloloCellRows.flatMap((row) => (Array.isArray(row?.books) ? row.books : []));
    }

    if (!list.length) {
      list = pickLikelyArray(data, [
        "recommendList.records",
        "recommendList",
        "records",
        "result.records",
        "result.list",
        "result",
        "data.records",
        "data.list",
        "data.books",
        "data",
        "list",
        "items"
      ]);
    }

    state.searchResults = normalizeItems(list);
    renderResults();
    setStatus(`Beranda dimuat. Menampilkan ${state.searchResults.length} judul.`);
  } catch (err) {
    console.error(err);
    setStatus(`Gagal memuat beranda: ${err.message}`);
  }
}

function renderDetailPlaceholder(item) {
  ui.detailTitle.textContent = item.title || "Detail Drama";
  ui.detailMeta.textContent = `ID: ${item.id || "-"} • Platform: ${platforms[state.currentPlatform].label}`;
  ui.rawJson.textContent = JSON.stringify(item.raw, null, 2);
}

function normalizeEpisodes(rawData) {
  const cfg = platforms[state.currentPlatform];
  const arr = pickLikelyArray(rawData, [
    "chapterList",
    "episodeList",
    "episodes",
    "records",
    "data.chapterList",
    "data.episodes",
    "data"
  ]);

  return arr.map((ep, idx) => {
    const id = String(findValue(ep, cfg.episodeIdKeys) || idx + 1);
    const no =
      ep.episodeNum || ep.num || ep.sort || ep.index || ep.seq || ep.order || ep.chapterNum || idx + 1;
    const title = ep.title || ep.name || ep.episodeName || ep.chapterTitle || `Episode ${no}`;
    const url = findFirstUrl(ep);
    const locked = isEpisodeLocked(ep, url);

    return {
      id,
      no: Number(no) || idx + 1,
      title: String(title),
      url,
      locked,
      raw: ep
    };
  });
}

function isEpisodeLocked(rawEp, url) {
  const boolTrueKeys = ["isLock", "locked", "needPay", "isNeedPay", "needVip", "isVip", "needUnlock"];
  const boolFalseKeys = ["canWatch", "canPlay", "watchable", "playable", "isFree", "isUnlock"];
  const numericPayKeys = ["payType", "chargeType", "lockType", "unlockType"];

  for (const k of boolTrueKeys) {
    if (rawEp && rawEp[k] === true) return true;
  }

  for (const k of boolFalseKeys) {
    if (rawEp && rawEp[k] === false) return true;
  }

  for (const k of numericPayKeys) {
    const v = Number(rawEp?.[k]);
    if (Number.isFinite(v) && v > 0) return true;
  }

  // Heuristic: no direct URL and no token provided usually means locked episode.
  if (!url && !hasApiKey()) return true;

  return false;
}

async function loadDetail(item) {
  state.selectedItem = item;
  state.detailData = null;
  state.episodes = [];

  renderDetailPlaceholder(item);
  updateHero(item);
  ui.episodeList.innerHTML = `<div class="empty">Memuat detail...</div>`;

  const cfg = platforms[state.currentPlatform];
  const key = state.apiKey;

  try {
    let detail = item.raw;
    if (cfg.detailPath) {
      detail = await apiGet(cfg.detailPath(item.id, state.currentLang, key));
    }

    state.detailData = detail;

    let epData = detail;
    if (cfg.episodesPath) {
      const epPath = cfg.episodesPath(item.id, state.currentLang, key);
      if (epPath) epData = await apiGet(epPath);
    }

    state.episodes = normalizeEpisodes(epData);
    ui.rawJson.textContent = JSON.stringify({ detail, episodes: state.episodes.map((x) => x.raw) }, null, 2);

    const extra = findValue(detail, ["synopsis", "desc", "description", "intro", "summary"]);
    ui.detailMeta.textContent = `${platforms[state.currentPlatform].label} • ${state.episodes.length} episode${
      state.episodes.length > 1 ? "s" : ""
    }${extra ? `\n\n${String(extra).slice(0, 260)}` : ""}`;

    renderEpisodes();

    if (state.episodes[0]) {
      await playEpisode(state.episodes[0]);
    }
  } catch (err) {
    console.error(err);
    ui.episodeList.innerHTML = `<div class="empty">Gagal memuat detail: ${escapeHtml(err.message)}</div>`;
  }
}

function renderEpisodes() {
  if (!state.episodes.length) {
    ui.episodeList.innerHTML = `<div class="empty">Episode belum tersedia / endpoint tidak mengembalikan list episode.</div>`;
    return;
  }

  const sorted = [...state.episodes].sort((a, b) => a.no - b.no);
  ui.episodeList.innerHTML = sorted
    .map((ep) => {
      const lockIcon = ep.locked ? "🔒 " : "";
      return `<button class="ep-btn" data-ep="${escapeHtml(ep.id)}">${lockIcon}E${ep.no}</button>`;
    })
    .join("");

  ui.episodeList.querySelectorAll(".ep-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-ep");
      const ep = state.episodes.find((x) => String(x.id) === String(id));
      if (ep) await playEpisode(ep);
    });
  });
}

async function resolvePlayUrl(ep) {
  const cfg = platforms[state.currentPlatform];

  if (ep.url) return ep.url;

  if (cfg.episodeToVideoPath) {
    const data = await apiGet(cfg.episodeToVideoPath(ep.id, state.currentLang, state.apiKey));
    const found = findFirstUrl(data);
    if (found) return found;
  }

  if (state.detailData) {
    const fromDetail = findFirstUrl(state.detailData);
    if (fromDetail) return fromDetail;
  }

  return "";
}

async function playEpisode(ep) {
  if (ep.locked && !hasApiKey()) {
    ui.playerInfo.textContent = `Episode ${ep.no} terkunci. Masukkan token untuk membuka episode berbayar.`;
    return;
  }

  ui.playerInfo.textContent = `Mencari source Episode ${ep.no}...`;

  try {
    const url = await resolvePlayUrl(ep);
    if (!url) {
      ui.playerInfo.textContent = `Episode ${ep.no}: URL video tidak ditemukan.`;
      return;
    }

    loadPlayer(url);
    ui.playerInfo.textContent = `Now playing: Episode ${ep.no} • ${ep.title}`;
  } catch (err) {
    ui.playerInfo.textContent = `Gagal play Episode ${ep.no}: ${err.message}`;
  }
}

function loadPlayer(url) {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const video = ui.player;

  if (url.includes(".m3u8") && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
  } else {
    video.src = url;
  }

  video.play().catch(() => {
    // autoplay blocked by browser; user can click play
  });
}

function bindEvents() {
  ui.saveKeyBtn.addEventListener("click", () => {
    state.apiKey = ui.apiKey.value.trim() || DEFAULT_KEY;
    saveLocal();
    setStatus("API key disimpan. Episode berbayar akan coba dibuka dengan token ini.");

    if (state.selectedItem) {
      loadDetail(state.selectedItem);
    }
  });

  ui.platformSelect.addEventListener("change", () => {
    state.currentPlatform = ui.platformSelect.value;
    state.currentLang = platforms[state.currentPlatform].defaultLang;
    state.selectedItem = null;
    state.episodes = [];
    ui.episodeList.innerHTML = "";
    ui.detailTitle.textContent = "Detail Drama";
    ui.detailMeta.textContent = "Pilih drama dari hasil pencarian.";
    buildLangSelect();
    saveLocal();
    setStatus(`Platform diubah ke ${platforms[state.currentPlatform].label}.`);
    loadHomeContent();
  });

  ui.langSelect.addEventListener("change", () => {
    state.currentLang = ui.langSelect.value;
    saveLocal();
    loadHomeContent();
  });

  ui.searchBtn.addEventListener("click", searchDrama);
  ui.queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchDrama();
  });

  ui.heroWatchBtn.addEventListener("click", () => {
    const target =
      state.selectedItem ||
      state.searchResults[0] ||
      null;
    if (target) {
      loadDetail(target);
    } else {
      setStatus("Belum ada drama untuk diputar. Coba muat beranda dulu.");
    }
  });

  ui.heroRefreshBtn.addEventListener("click", () => {
    loadHomeContent();
  });
}

function init() {
  loadLocal();
  const qs = applyUrlOverrides();
  buildPlatformSelect();
  buildLangSelect();
  ui.apiKey.value = state.apiKey;
  ui.queryInput.value = qs.query;
  bindEvents();
  renderResults();
  saveLocal();

  if (qs.autoSearch && qs.query) {
    setStatus("Mode auto search dari URL aktif.");
    searchDrama();
    return;
  }

  setStatus("Ready. Beranda drama akan dimuat otomatis.");
  loadHomeContent();
}

init();
