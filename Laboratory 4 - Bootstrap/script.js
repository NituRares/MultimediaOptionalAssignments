const JSON_PATH = "assets/data/library.json";
const IMG_BASE = "assets/img/";

const albumGrid = document.getElementById("albumGrid");
const statusMessage = document.getElementById("statusMessage");
const searchInput = document.getElementById("searchInput");
const resultInfo = document.getElementById("resultInfo");
const backToTopBtn = document.getElementById("backToTop");

const trackModalEl = document.getElementById("exampleModal");
const modalTitleEl = document.getElementById("exampleModalLabel");
const trackStatsEl = document.getElementById("trackStats");
const trackModalBody = document.getElementById("trackModalBody");
const playSpotifyBtn = document.getElementById("playSpotifyBtn");
const trackModal = new bootstrap.Modal(trackModalEl);

let albums = [];
let viewAlbums = [];
let currentSort = "artist-asc";

function showStatus(text, type = "info") {
  statusMessage.classList.remove("d-none", "alert-info", "alert-danger", "alert-success", "alert-warning");
  statusMessage.classList.add(`alert-${type}`);
  statusMessage.textContent = text;
}
function hideStatus() {
  statusMessage.classList.add("d-none");
}

function safeText(v) {
  return (v ?? "").toString();
}
function normalize(str) {
  return safeText(str).trim().toLowerCase();
}

function getTrackCount(album) {
  return Array.isArray(album.tracklist) ? album.tracklist.length : 0;
}

function parseTimeToSeconds(timeStr) {
  const t = safeText(timeStr).trim();
  const parts = t.split(":");
  if (parts.length !== 2) return 0;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 + seconds;
}
function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function sortAlbums(list, sortKey) {
  const sorted = [...list];

  if (sortKey === "artist-asc") {
    sorted.sort((a, b) => normalize(a.artist).localeCompare(normalize(b.artist)));
  } else if (sortKey === "album-asc") {
    sorted.sort((a, b) => normalize(a.album).localeCompare(normalize(b.album)));
  } else if (sortKey === "tracks-asc") {
    sorted.sort((a, b) => getTrackCount(a) - getTrackCount(b));
  } else if (sortKey === "tracks-desc") {
    sorted.sort((a, b) => getTrackCount(b) - getTrackCount(a));
  }

  return sorted;
}

function renderAlbums(list) {
  albumGrid.innerHTML = "";

  if (list.length === 0) {
    albumGrid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-warning mb-0">No albums match your search.</div>
      </div>
    `;
    return;
  }

  list.forEach((album, index) => {
    const artist = safeText(album.artist);
    const albumName = safeText(album.album);
    const thumb = safeText(album.thumbnail);

    const col = document.createElement("div");
    col.className = "col-xl-2 col-md-3 col-sm-6 col-12";


    col.innerHTML = `
      <div class="card album-card h-100">
        <div class="album-media">
          <img src="${IMG_BASE}${thumb}" class="card-img-top" alt="${artist} - ${albumName}">
          <div class="album-overlay"></div>
          <div class="album-overlay-text">${albumName}</div>
        </div>

        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${artist}</h5>
          <p class="card-text text-secondary">${albumName}</p>

          <button type="button"
            class="btn btn-primary mt-auto view-tracklist-btn"
            data-album-index="${index}">
            View Tracklist
          </button>
        </div>

        <div class="card-footer small text-secondary d-flex justify-content-between align-items-center">
          <span>${getTrackCount(album)} tracks</span>
          <span>ID: ${safeText(album.id)}</span>
        </div>
      </div>
    `;

    albumGrid.appendChild(col);
  });
}

function applyFilterAndSort() {
  const q = normalize(searchInput.value);

  const filtered = albums.filter(a => {
    return normalize(a.artist).includes(q) || normalize(a.album).includes(q);
  });

  viewAlbums = sortAlbums(filtered, currentSort);
  renderAlbums(viewAlbums);

  resultInfo.textContent = `Showing ${viewAlbums.length} of ${albums.length} albums`;
}

function buildTrackStats(album) {
  const tracks = Array.isArray(album.tracklist) ? album.tracklist : [];

  const durations = tracks.map(t => parseTimeToSeconds(t.trackLength));
  const totalSeconds = durations.reduce((sum, v) => sum + v, 0);
  const avgSeconds = tracks.length ? totalSeconds / tracks.length : 0;

  let longest = null;
  let shortest = null;

  tracks.forEach((t, i) => {
    const sec = durations[i];
    if (!longest || sec > longest.seconds) longest = { track: t, seconds: sec };
    if (!shortest || sec < shortest.seconds) shortest = { track: t, seconds: sec };
  });

  const longestText = longest ? `${safeText(longest.track.title)} (${formatSeconds(longest.seconds)})` : "—";
  const shortestText = shortest ? `${safeText(shortest.track.title)} (${formatSeconds(shortest.seconds)})` : "—";

  return `
    <div class="stat-box">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div><strong>Total tracks:</strong> ${tracks.length}</div>
          <div><strong>Total duration:</strong> ${formatSeconds(totalSeconds)}</div>
          <div><strong>Average track:</strong> ${formatSeconds(avgSeconds)}</div>
        </div>
        <div class="col-12 col-md-6">
          <div><strong>Longest:</strong> ${longestText}</div>
          <div><strong>Shortest:</strong> ${shortestText}</div>
        </div>
      </div>
    </div>
  `;
}

function buildTracklistTable(album) {
  const tracks = Array.isArray(album.tracklist) ? album.tracklist : [];

  if (tracks.length === 0) {
    return `<div class="alert alert-warning mb-0">No tracks found for this album.</div>`;
  }

  const rows = tracks.map((t, i) => {
    const number = t.number ?? (i + 1);
    const title = safeText(t.title);
    const length = safeText(t.trackLength);
    const url = safeText(t.url);

    return `
      <tr>
        <td class="text-secondary" style="width:64px;">${number}</td>
        <td>
          <a class="link-success track-link" href="${url}" target="_blank" rel="noopener noreferrer">
            ${title}
          </a>
        </td>
        <td class="text-secondary text-end" style="width:90px;">${length}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-responsive">
      <table class="table table-dark table-hover align-middle mb-0">
        <thead>
          <tr>
            <th class="text-secondary">#</th>
            <th class="text-secondary">Title (Spotify)</th>
            <th class="text-secondary text-end">Length</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function openAlbumModal(album) {
  const artist = safeText(album.artist);
  const albumName = safeText(album.album);

  modalTitleEl.textContent = `${artist} - ${albumName}`;

  trackStatsEl.innerHTML = buildTrackStats(album);
  trackModalBody.innerHTML = buildTracklistTable(album);

  const firstUrl = album?.tracklist?.[0]?.url ? safeText(album.tracklist[0].url) : "";
  if (firstUrl) {
    playSpotifyBtn.href = firstUrl;
    playSpotifyBtn.classList.remove("d-none");
  } else {
    playSpotifyBtn.classList.add("d-none");
  }

  trackModal.show();
}

albumGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".view-tracklist-btn");
  if (!btn) return;

  const idx = Number(btn.getAttribute("data-album-index"));
  const album = viewAlbums[idx];
  if (!album) return;

  openAlbumModal(album);
});

document.addEventListener("click", (e) => {
  const sortBtn = e.target.closest("[data-sort]");
  if (!sortBtn) return;

  currentSort = sortBtn.getAttribute("data-sort");
  applyFilterAndSort();
});


searchInput.addEventListener("input", applyFilterAndSort);

window.addEventListener("scroll", () => {
  backToTopBtn.style.display = window.scrollY > 400 ? "inline-flex" : "none";
});
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function loadLibrary() {
  try {
    showStatus("Loading library...", "info");

    const res = await fetch(JSON_PATH);
    if (!res.ok) throw new Error(`Failed to fetch ${JSON_PATH} (HTTP ${res.status})`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("library.json must be an array of albums");
    }

    albums = data;
    hideStatus();
    applyFilterAndSort();
  } catch (err) {
    showStatus(`Error: ${err.message}`, "danger");
  }
}

loadLibrary();
