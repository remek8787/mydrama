const DEFAULT_KEY = "331D2CC91BC4C0B2218052619DBBBA84";
const SEEK_STEP_SECONDS = 10;

const platforms = {
  dramabox: {
    label: "Dramabox",
    base: "https://dramabox.dramabos.my.id",
    langs: ["in", "en", "th", "vi", "ja", "ko"],
    defaultLang: "in",
    feedPaths: {
      homepage: (lang) => `/api/v1/homepage?page=1&lang=${enc(lang)}`,
      latest: (lang) => `/api/v1/latest?lang=${enc(lang)}`,
      dubbed: (lang) => `/api/v1/dubbed?classify=terpopuler&page=1&lang=${enc(lang)}`,
      foryou: (lang) => `/api/v1/foryou?lang=${enc(lang)}`,
      popular: (lang) => `/api/v1/populersearch?lang=${enc(lang)}`
    },
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
    feedPaths: {
      homepage: (lang) => `/api/home?lang=${enc(lang)}&offset=0`
    },
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
    feedPaths: {
      homepage: (lang) => `/api/home?lang=${enc(lang)}&page=1&size=30`
    },
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
  episodes: [],
  currentEpisodeId: null,
  episodesPage: 1,
  episodesPerPage: 24,
  autoNext: true,
  recommendedResults: [],
  activeFeed: "homepage",
  popularKeywords: []
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
  feedButtons: byId("feedButtons"),
  recStatus: byId("recStatus"),
  recommendGrid: byId("recommendGrid"),
  popularKeywords: byId("popularKeywords"),
  resultCount: byId("resultCount"),
  resultGrid: byId("resultGrid"),
  detailTitle: byId("detailTitle"),
  detailMeta: byId("detailMeta"),
  episodeSummary: byId("episodeSummary"),
  episodePagination: byId("episodePagination"),
  autoNextToggle: byId("autoNextToggle"),
  episodeList: byId("episodeList"),
  rawJson: byId("rawJson"),
  playerInfo: byId("playerInfo"),
  player: byId("videoPlayer"),
  tapSeekHint: byId("tapSeekHint")
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

function showTapSeekHint(text) {
  if (!ui.tapSeekHint) return;
  ui.tapSeekHint.textContent = text;
  ui.tapSeekHint.classList.add("show");
  clearTimeout(showTapSeekHint._timer);
  showTapSeekHint._timer = setTimeout(() => {
    ui.tapSeekHint.classList.remove("show");
  }, 700);
}

function seekBy(seconds) {
  const video = ui.player;
  if (!video) return;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;

  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const next = Math.max(0, Math.min(video.duration, current + seconds));
  video.currentTime = next;
  showTapSeekHint(`${seconds > 0 ? "+" : "-"}${Math.abs(seconds)}s`);
}

function handlePlayerTapSeek(event) {
  const video = ui.player;
  if (!video) return;

  const rect = video.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  // Jangan ganggu area kontrol bawaan video di bawah.
  if (rect.bottom - y < 58) return;

  const leftBound = rect.left + rect.width * 0.35;
  const rightBound = rect.right - rect.width * 0.35;

  if (x <= leftBound) {
    seekBy(-SEEK_STEP_SECONDS);
  } else if (x >= rightBound) {
    seekBy(SEEK_STEP_SECONDS);
  }
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

function extractDramaItems(data) {
  let list = [];

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

  return normalizeItems(list);
}

function extractKeywordSuggestions(data) {
  const preferPaths = [
    "keywords",
    "data.keywords",
    "list",
    "data.list",
    "records",
    "data.records",
    "result",
    "data"
  ];

  for (const p of preferPaths) {
    const val = getByPath(data, p);
    if (Array.isArray(val) && val.length && typeof val[0] === "string") {
      return val.map((x) => String(x).trim()).filter(Boolean);
    }

    if (Array.isArray(val) && val.length && typeof val[0] === "object") {
      const fromObj = val
        .map((x) => x.keyword || x.keyWord || x.name || x.title || "")
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (fromObj.length) return fromObj;
    }
  }

  const arrays = deepCollectArrays(data).filter((arr) => Array.isArray(arr) && arr.length);
  for (const arr of arrays) {
    if (typeof arr[0] === "string") return arr.map((x) => String(x).trim()).filter(Boolean);
    if (typeof arr[0] === "object") {
      const fromObj = arr
        .map((x) => x.keyword || x.keyWord || x.name || x.title || "")
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (fromObj.length) return fromObj;
    }
  }

  return [];
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
      <article class="drama-card ${state.selectedItem && String(state.selectedItem.id) === String(item.id) ? "active" : ""}" data-idx="${idx}">
        <img src="${item.image || "https://dummyimage.com/400x600/0f172a/94a3b8&text=No+Cover"}" alt="${escapeHtml(item.title)}" loading="lazy" />
        <div class="info">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="sub">${escapeHtml(item.subtitle || item.id || "")}</div>
        </div>
      </article>
    `)
    .join("");

  ui.resultGrid.querySelectorAll(".drama-card").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      const item = state.searchResults[idx];
      if (item) loadDetail(item);
    });
  });
}

function renderPopularKeywords() {
  if (!ui.popularKeywords) return;

  if (!state.popularKeywords.length) {
    ui.popularKeywords.innerHTML = "";
    return;
  }

  ui.popularKeywords.innerHTML = state.popularKeywords
    .slice(0, 12)
    .map(
      (kw) =>
        `<button type="button" class="keyword-chip" data-keyword="${escapeHtml(kw)}">${escapeHtml(kw)}</button>`
    )
    .join("");

  ui.popularKeywords.querySelectorAll(".keyword-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kw = btn.getAttribute("data-keyword") || "";
      ui.queryInput.value = kw;
      searchDrama();
    });
  });
}

function renderRecommendations() {
  if (!ui.recommendGrid) return;

  const feedLabelMap = {
    homepage: "Homepage",
    latest: "Latest",
    dubbed: "Dubbed",
    foryou: "For You",
    popular: "Popular"
  };

  const feedLabel = feedLabelMap[state.activeFeed] || state.activeFeed;
  if (ui.recStatus) ui.recStatus.textContent = feedLabel;

  if (!state.recommendedResults.length) {
    ui.recommendGrid.innerHTML = `<div class="empty">Belum ada rekomendasi untuk menu ${feedLabel}.</div>`;
    return;
  }

  ui.recommendGrid.innerHTML = state.recommendedResults
    .map((item, idx) => `
      <article class="drama-card ${state.selectedItem && String(state.selectedItem.id) === String(item.id) ? "active" : ""}" data-rec-idx="${idx}">
        <img src="${item.image || "https://dummyimage.com/400x600/0f172a/94a3b8&text=No+Cover"}" alt="${escapeHtml(item.title)}" loading="lazy" />
        <div class="info">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="sub">${escapeHtml(item.subtitle || item.id || "")}</div>
        </div>
      </article>
    `)
    .join("");

  ui.recommendGrid.querySelectorAll(".drama-card").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-rec-idx"));
      const item = state.recommendedResults[idx];
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
    state.searchResults = extractDramaItems(data);
    renderResults();
    setStatus(`Beranda dimuat. Menampilkan ${state.searchResults.length} judul.`);
  } catch (err) {
    console.error(err);
    setStatus(`Gagal memuat beranda: ${err.message}`);
  }
}

async function loadFeedContent(feedKey = "homepage") {
  const cfg = platforms[state.currentPlatform];
  const feedPathFn = cfg.feedPaths?.[feedKey];

  state.activeFeed = feedKey;

  if (ui.feedButtons) {
    ui.feedButtons.querySelectorAll(".feed-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-feed") === feedKey);
    });
  }

  if (!feedPathFn) {
    state.recommendedResults = [];
    if (feedKey === "popular") state.popularKeywords = [];
    renderRecommendations();
    renderPopularKeywords();
    return;
  }

  setStatus(`Memuat rekomendasi ${feedKey}...`);

  try {
    const path = feedPathFn(state.currentLang, state.apiKey);
    const data = await apiGet(path);
    state.recommendedResults = extractDramaItems(data);

    if (feedKey === "popular") {
      state.popularKeywords = extractKeywordSuggestions(data);
    }

    renderRecommendations();
    renderPopularKeywords();
    setStatus(`Rekomendasi ${feedKey} dimuat (${state.recommendedResults.length} judul).`);
  } catch (err) {
    if (feedKey === "popular") {
      state.popularKeywords = [];
    }
    state.recommendedResults = [];
    renderRecommendations();
    renderPopularKeywords();
    setStatus(`Feed ${feedKey} gagal dimuat: ${err.message}`);
  }
}

function refreshFeedButtonsAvailability() {
  if (!ui.feedButtons) return;
  const cfg = platforms[state.currentPlatform];
  const availableFeeds = cfg.feedPaths || {};

  ui.feedButtons.querySelectorAll(".feed-btn").forEach((btn) => {
    const feed = btn.getAttribute("data-feed") || "homepage";
    const enabled = Boolean(availableFeeds[feed]);
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  });

  if (!availableFeeds[state.activeFeed]) {
    state.activeFeed = "homepage";
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

function episodeKey(ep) {
  return `${String(ep.id || "")}|${Number(ep.no) || 0}`;
}

function mergeEpisodeLists(lists) {
  const map = new Map();

  for (const list of lists) {
    for (const ep of list) {
      const key = episodeKey(ep);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...ep });
        continue;
      }

      map.set(key, {
        ...prev,
        ...ep,
        url: prev.url || ep.url,
        title: prev.title && prev.title !== `Episode ${prev.no}` ? prev.title : ep.title,
        locked: prev.locked && ep.locked
      });
    }
  }

  return [...map.values()].sort((a, b) => a.no - b.no);
}

function setQueryParam(path, key, value) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, String(value));
  return `${pathname}?${params.toString()}`;
}

async function safeApiGet(path) {
  try {
    return await apiGet(path);
  } catch {
    return null;
  }
}

async function fetchMoreEpisodes(baseEpisodePath, firstBatch) {
  if (!baseEpisodePath || !firstBatch.length || firstBatch.length > 12) return [];

  const collectedKeys = new Set(firstBatch.map(episodeKey));

  const pageModes = [
    (page, seed) => setQueryParam(baseEpisodePath, "page", page),
    (page, seed) => setQueryParam(setQueryParam(baseEpisodePath, "page", page), "size", Math.max(seed * 3, 30)),
    (page, seed) => setQueryParam(setQueryParam(baseEpisodePath, "page", page), "limit", Math.max(seed * 3, 30)),
    (page, seed) => setQueryParam(baseEpisodePath, "offset", (page - 1) * seed)
  ];

  for (const buildPath of pageModes) {
    const page2Data = await safeApiGet(buildPath(2, firstBatch.length));
    if (!page2Data) continue;

    const page2Episodes = normalizeEpisodes(page2Data);
    const page2New = page2Episodes.filter((ep) => !collectedKeys.has(episodeKey(ep)));
    if (!page2New.length) continue;

    page2New.forEach((ep) => collectedKeys.add(episodeKey(ep)));
    const extraPayloads = [page2Data];

    for (let page = 3; page <= 50; page++) {
      const nextData = await safeApiGet(buildPath(page, firstBatch.length));
      if (!nextData) break;

      const nextEpisodes = normalizeEpisodes(nextData);
      if (!nextEpisodes.length) break;

      const newEpisodes = nextEpisodes.filter((ep) => !collectedKeys.has(episodeKey(ep)));
      if (!newEpisodes.length) break;

      newEpisodes.forEach((ep) => collectedKeys.add(episodeKey(ep)));
      extraPayloads.push(nextData);

      if (nextEpisodes.length < firstBatch.length) break;
    }

    return extraPayloads;
  }

  return [];
}

function getSortedEpisodes() {
  return [...state.episodes].sort((a, b) => a.no - b.no);
}

function getCurrentEpisodeIndex(sortedEpisodes = getSortedEpisodes()) {
  if (!sortedEpisodes.length || !state.currentEpisodeId) return -1;
  return sortedEpisodes.findIndex((ep) => String(ep.id) === String(state.currentEpisodeId));
}

function jumpToEpisodePageByIndex(index) {
  if (index < 0) return;
  state.episodesPage = Math.floor(index / state.episodesPerPage) + 1;
}

async function loadDetail(item) {
  state.selectedItem = item;
  state.detailData = null;
  state.episodes = [];
  state.currentEpisodeId = null;
  state.episodesPage = 1;

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

    let normalizedEpisodes = normalizeEpisodes(epData);

    if (cfg.episodesPath) {
      const epPath = cfg.episodesPath(item.id, state.currentLang, key);
      const extraEpisodePayloads = await fetchMoreEpisodes(epPath, normalizedEpisodes);
      if (extraEpisodePayloads.length) {
        normalizedEpisodes = mergeEpisodeLists([normalizedEpisodes, ...extraEpisodePayloads.map(normalizeEpisodes)]);
      }
    }

    state.episodes = normalizedEpisodes;
    ui.rawJson.textContent = JSON.stringify({ detail, episodes: state.episodes.map((x) => x.raw) }, null, 2);

    const extra = findValue(detail, ["synopsis", "desc", "description", "intro", "summary"]);
    ui.detailMeta.textContent = `${platforms[state.currentPlatform].label} • ${state.episodes.length} episode${
      state.episodes.length > 1 ? "s" : ""
    }${extra ? `\n\n${String(extra).slice(0, 260)}` : ""}`;

    renderEpisodes(true);

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
    if (ui.episodeSummary) ui.episodeSummary.textContent = "0 episode";
    if (ui.episodePagination) ui.episodePagination.innerHTML = "";
    ui.episodeList.innerHTML = `<div class="empty">Episode belum tersedia / endpoint tidak mengembalikan list episode.</div>`;
    return;
  }

  const sorted = getSortedEpisodes();
  const totalPages = Math.max(1, Math.ceil(sorted.length / state.episodesPerPage));
  if (state.episodesPage > totalPages) state.episodesPage = totalPages;
  if (state.episodesPage < 1) state.episodesPage = 1;

  const start = (state.episodesPage - 1) * state.episodesPerPage;
  const pageEpisodes = sorted.slice(start, start + state.episodesPerPage);

  const currentIndex = getCurrentEpisodeIndex(sorted);
  if (ui.episodeSummary) {
    const nowPlaying = currentIndex >= 0 ? ` • Now: E${sorted[currentIndex].no}` : "";
    ui.episodeSummary.textContent = `${sorted.length} episode • Hal ${state.episodesPage}/${totalPages}${nowPlaying}`;
  }

  if (ui.episodePagination) {
    const prevDisabled = state.episodesPage <= 1 ? "disabled" : "";
    const nextDisabled = state.episodesPage >= totalPages ? "disabled" : "";
    ui.episodePagination.innerHTML = `
      <button class="ep-page-btn" data-page="1" ${prevDisabled}>« First</button>
      <button class="ep-page-btn" data-page="${state.episodesPage - 1}" ${prevDisabled}>‹ Prev</button>
      <span class="ep-page-info">${state.episodesPage} / ${totalPages}</span>
      <button class="ep-page-btn" data-page="${state.episodesPage + 1}" ${nextDisabled}>Next ›</button>
      <button class="ep-page-btn" data-page="${totalPages}" ${nextDisabled}>Last »</button>
    `;
  }

  ui.episodeList.innerHTML = pageEpisodes
    .map((ep) => {
      const lockIcon = ep.locked ? "🔒 " : "";
      const activeClass = String(ep.id) === String(state.currentEpisodeId) ? " playing" : "";
      return `<button class="ep-btn${activeClass}" data-ep="${escapeHtml(ep.id)}">${lockIcon}E${ep.no}</button>`;
    })
    .join("");

  ui.episodeList.querySelectorAll(".ep-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-ep");
      const ep = state.episodes.find((x) => String(x.id) === String(id));
      if (ep) await playEpisode(ep);
    });
  });

  if (ui.episodePagination) {
    ui.episodePagination.querySelectorAll(".ep-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetPage = Number(btn.getAttribute("data-page"));
        if (!Number.isFinite(targetPage)) return;
        state.episodesPage = targetPage;
        renderEpisodes();
      });
    });
  }
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
    state.currentEpisodeId = String(ep.id);
    const sorted = getSortedEpisodes();
    const idx = getCurrentEpisodeIndex(sorted);
    jumpToEpisodePageByIndex(idx);
    renderEpisodes();
    ui.playerInfo.textContent = `Now playing: Episode ${ep.no} • ${ep.title}`;
  } catch (err) {
    ui.playerInfo.textContent = `Gagal play Episode ${ep.no}: ${err.message}`;
  }
}

async function playNextEpisode() {
  const sorted = getSortedEpisodes();
  if (!sorted.length) return;

  const currentIndex = getCurrentEpisodeIndex(sorted);
  if (currentIndex < 0) return;

  const nextEpisode = sorted[currentIndex + 1];
  if (!nextEpisode) {
    ui.playerInfo.textContent = `Episode terakhir selesai.`;
    return;
  }

  ui.playerInfo.textContent = `Episode ${sorted[currentIndex].no} selesai. Lanjut ke Episode ${nextEpisode.no}...`;
  await playEpisode(nextEpisode);
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
  if (ui.feedButtons) {
    ui.feedButtons.querySelectorAll(".feed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const feed = btn.getAttribute("data-feed") || "homepage";
        loadFeedContent(feed);
      });
    });
  }

  if (ui.autoNextToggle) {
    ui.autoNextToggle.checked = state.autoNext;
    ui.autoNextToggle.addEventListener("change", () => {
      state.autoNext = ui.autoNextToggle.checked;
    });
  }

  ui.player.addEventListener("ended", () => {
    if (state.autoNext) playNextEpisode();
  });

  ui.player.addEventListener("pointerup", handlePlayerTapSeek);

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
    state.currentEpisodeId = null;
    state.episodesPage = 1;
    ui.episodeList.innerHTML = "";
    if (ui.episodeSummary) ui.episodeSummary.textContent = "0 episode";
    if (ui.episodePagination) ui.episodePagination.innerHTML = "";
    ui.detailTitle.textContent = "Detail Drama";
    ui.detailMeta.textContent = "Pilih drama dari hasil pencarian.";
    state.recommendedResults = [];
    state.popularKeywords = [];
    renderRecommendations();
    renderPopularKeywords();
    buildLangSelect();
    refreshFeedButtonsAvailability();
    saveLocal();
    setStatus(`Platform diubah ke ${platforms[state.currentPlatform].label}.`);
    loadFeedContent("homepage");
    loadHomeContent();
  });

  ui.langSelect.addEventListener("change", () => {
    state.currentLang = ui.langSelect.value;
    saveLocal();
    loadFeedContent(state.activeFeed || "homepage");
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
    loadFeedContent(state.activeFeed || "homepage");
    loadHomeContent();
  });
}

function init() {
  loadLocal();
  const qs = applyUrlOverrides();
  buildPlatformSelect();
  buildLangSelect();
  refreshFeedButtonsAvailability();
  ui.apiKey.value = state.apiKey;
  ui.queryInput.value = qs.query;
  bindEvents();
  renderRecommendations();
  renderPopularKeywords();
  renderResults();
  saveLocal();

  if (qs.autoSearch && qs.query) {
    loadFeedContent("homepage");
    setStatus("Mode auto search dari URL aktif.");
    searchDrama();
    return;
  }

  setStatus("Ready. Beranda drama akan dimuat otomatis.");
  loadFeedContent("homepage");
  loadHomeContent();
}

init();
