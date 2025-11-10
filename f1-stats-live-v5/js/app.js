// v5: global search everywhere + sleek bars + Wikipedia-enhanced modal + headings cleaned
const BASES = [
  "https://api.jolpi.ca/ergast/f1",
  "https://ergast.com/api/f1"
];

let state = {
  season: null,
  rounds: [],
  driverStandings: [],
  constructorStandings: [],
  charts: {},
  nextRace: null,
  normalize: false
};

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupTheme();
  await bootstrap();
  setupLocalSearches();
  setupGlobalSearch();
  setupSortableTables();
  setupInteractiveControls();
  syncTabFromHash();
  renderDriverCards();
  renderTeamCards();
  wireModal();
});

async function bootstrap() {
  const schedule = await getJSON("/current.json");
  const races = schedule?.MRData?.RaceTable?.Races ?? [];
  const season = races[0]?.season || new Date().getFullYear().toString();
  state.season = season;
  state.rounds = races.map(r => ({ round: r.round, raceName: r.raceName, circuit: r.Circuit?.circuitName, date: r.date }));

  const nextRes = await getJSON("/current/next.json").catch(() => null);
  const next = nextRes?.MRData?.RaceTable?.Races?.[0];
  if (next) state.nextRace = { name: next.raceName, date: next.date };

  const ds = await getJSON("/current/driverStandings.json");
  const cs = await getJSON("/current/constructorStandings.json");

  state.driverStandings = (ds?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [])
    .map(row => ({
      position: +row.position,
      points: +row.points,
      wins: +row.wins,
      driver: `${row.Driver.givenName} ${row.Driver.familyName}`,
      driverId: row.Driver.driverId,
      driverUrl: row.Driver.url || null,
      code: row.Driver.code || row.Driver.driverId,
      nationality: row.Driver.nationality,
      constructor: row.Constructors?.[0]?.name || ""
    }));

  state.constructorStandings = (cs?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [])
    .map(row => ({
      position: +row.position,
      points: +row.points,
      wins: +row.wins,
      name: row.Constructor?.name,
      constructorId: row.Constructor?.constructorId,
      constructorUrl: row.Constructor?.url || null,
      nationality: row.Constructor?.nationality
    }));

  hydrateMetrics();
  renderRacesTable();
  renderDriversTable();
  renderConstructorsTable();

  buildWinsChart();
  buildConstructorPie();
  buildPointsLine();
}

/* Fetch with fallback */
async function getJSON(path) {
  for (const base of BASES) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { /* try next */ }
  }
  throw new Error(`All sources failed for path: ${path}`);
}

/* Metrics & Tables */
function hydrateMetrics() {
  document.getElementById("seasonLabel").textContent = state.season;
  document.getElementById("totalDrivers").textContent = state.driverStandings.length || "—";
  document.getElementById("totalRaces").textContent = state.rounds.length || "—";
  document.getElementById("nextGP").textContent = state.nextRace?.name ?? "—";
  document.getElementById("nextDate").textContent = state.nextRace?.date ?? "—";
}

function renderDriversTable() {
  const tb = document.querySelector("#driversTable tbody");
  tb.innerHTML = state.driverStandings.map(d => `
    <tr>
      <td class="num">${d.position}</td>
      <td>${d.driver}</td>
      <td>${d.constructor}</td>
      <td>${d.nationality}</td>
      <td class="num">${d.wins}</td>
      <td class="num">${d.points}</td>
    </tr>
  `).join("");
}
function renderConstructorsTable() {
  const tb = document.querySelector("#constructorsTable tbody");
  tb.innerHTML = state.constructorStandings.map(c => `
    <tr>
      <td class="num">${c.position}</td>
      <td>${c.name}</td>
      <td>${c.nationality}</td>
      <td class="num">${c.wins}</td>
      <td class="num">${c.points}</td>
    </tr>
  `).join("");
}
function renderRacesTable() {
  const tb = document.querySelector("#racesTable tbody");
  tb.innerHTML = state.rounds.map(r => `
    <tr>
      <td class="num">${r.round}</td>
      <td>${r.raceName}</td>
      <td>${r.circuit}</td>
      <td>${r.date}</td>
      <td data-round="${r.round}" id="winner-${r.round}">—</td>
    </tr>
  `).join("");
  fillWinners();
}
async function fillWinners() {
  const latest = await getJSON("/current/last/results.json").catch(() => null);
  const lastRound = latest?.MRData?.RaceTable?.Races?.[0]?.round;
  if (!lastRound) return;
  for (let i = 1; i <= +lastRound; i++) {
    getJSON(`/current/${i}/results.json`).then(res => {
      const race = res?.MRData?.RaceTable?.Races?.[0];
      const winner = race?.Results?.[0];
      const name = winner ? `${winner.Driver.givenName} ${winner.Driver.familyName}` : "—";
      const cell = document.getElementById(`winner-${i}`);
      if (cell) cell.textContent = name;
    }).catch(() => {});
  }
}

/* Cards from live standings */
function renderDriverCards(){
  const host = document.getElementById("driverCards");
  host.innerHTML = state.driverStandings.map(d => {
    const img = buildAvatarDataUrl(d.driver, d.code);
    const wiki = wikiTitleFromUrl(d.driverUrl);
    const subtitle = d.constructor;
    const meta = `<b>Nationality:</b> ${d.nationality} · <b>Points:</b> ${d.points} · <b>Wins:</b> ${d.wins}`;
    return `
      <article class="profile-card" data-type="driver" data-name="${d.driver.toLowerCase()}" data-team="${d.constructor.toLowerCase()}" data-wiki="${wiki||''}">
        <img class="profile-thumb" src="${img}" alt="${d.driver}" />
        <div class="profile-body">
          <h4 class="profile-title">${d.driver}</h4>
          <p class="profile-sub">${subtitle}</p>
          <template class="profile-data">
            <div data-desc="Fetching profile…" data-meta="${escapeHtml(meta)}"></div>
          </template>
        </div>
      </article>
    `;
  }).join("");
}
function renderTeamCards(){
  const host = document.getElementById("teamCards");
  host.innerHTML = state.constructorStandings.map(t => {
    const img = buildTeamLogoDataUrl(t.name);
    const wiki = wikiTitleFromUrl(t.constructorUrl);
    const meta = `<b>Points:</b> ${t.points} · <b>Wins:</b> ${t.wins}`;
    return `
      <article class="profile-card" data-type="team" data-name="${t.name.toLowerCase()}" data-wiki="${wiki||''}">
        <img class="profile-thumb" src="${img}" alt="${t.name} logo" />
        <div class="profile-body">
          <h4 class="profile-title">${t.name}</h4>
          <p class="profile-sub">${t.nationality}</p>
          <template class="profile-data">
            <div data-desc="Fetching team history…" data-meta="${escapeHtml(meta)}"></div>
          </template>
        </div>
      </article>
    `;
  }).join("");
}

/* Wikipedia-enhanced modal */
function wireModal(){
  const modal = document.getElementById("profileModal");
  const close = document.getElementById("modalClose");
  const openProfile = async (title, subtitle, img, desc, meta, wikiTitle)=>{
    document.getElementById("modalImage").src = img;
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalSubtitle").innerHTML = subtitle || "";
    document.getElementById("modalDesc").textContent = desc || "";
    document.getElementById("modalMeta").innerHTML = meta || "";
    document.getElementById("modalMore").innerHTML = wikiTitle ? `Loading more from Wikipedia…` : "";
    modal.showModal();

    if (wikiTitle){
      try{
        const sum = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`).then(r=>r.json());
        if (sum?.extract) document.getElementById("modalDesc").textContent = sum.extract;
        if (sum?.thumbnail?.source) document.getElementById("modalImage").src = sum.thumbnail.source;
        const link = sum?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
        document.getElementById("modalMore").innerHTML = `<a href="${link}" target="_blank" rel="noopener">Read more on Wikipedia</a>`;
      }catch(e){
        document.getElementById("modalMore").textContent = "";
      }
    }
  };
  document.body.addEventListener("click", (e)=>{
    const card = e.target.closest(".profile-card");
    if (!card) return;
    const name = card.querySelector(".profile-title").textContent;
    const subtitle = card.querySelector(".profile-sub").textContent;
    const img = card.querySelector(".profile-thumb").src;
    const tpl = card.querySelector(".profile-data div");
    const wiki = card.dataset.wiki || "";
    openProfile(name, subtitle, img, tpl.getAttribute("data-desc"), tpl.getAttribute("data-meta"), wiki);
  });
  close.addEventListener("click", ()=> modal.close());
}

/* Searches */
function setupGlobalSearch(){
  const input = document.getElementById("globalSearch");
  const filter = ()=>{
    const q = (input.value||"").trim().toLowerCase();
    // filter driver & team cards
    document.querySelectorAll("#driverCards .profile-card, #teamCards .profile-card").forEach(card => {
      const hay = (card.dataset.name||"") + " " + (card.dataset.team||"");
      card.style.display = hay.includes(q) ? "" : "none";
    });
    // filter tables
    filterTable("#driversTable", q);
    filterTable("#constructorsTable", q);
    filterTable("#racesTable", q);
  };
  input.addEventListener("input", filter);
}
function setupLocalSearches(){
  hookupSearch("#driverSearch", "#driversTable");
  hookupSearch("#teamSearch", "#constructorsTable");
  hookupSearch("#raceSearch", "#racesTable");
}
function hookupSearch(inputSel, tableSel){
  const input = document.getElementById(inputSel.slice(1));
  if (!input) return;
  input.addEventListener("input", ()=> filterTable(tableSel, (input.value||"").toLowerCase()));
}
function filterTable(tableSel, q){
  const rows = document.querySelectorAll(`${tableSel} tbody tr`);
  rows.forEach(tr => {
    const hay = tr.textContent.toLowerCase();
    tr.style.display = hay.includes(q) ? "" : "none";
  });
}

/* Interactions */
function setupInteractiveControls(){
  document.getElementById("winsTopN").addEventListener("change", buildWinsChart);
  document.getElementById("winsSort").addEventListener("click", (e)=>{
    const btn = e.currentTarget;
    const pressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", String(!pressed));
    buildWinsChart();
  });
  document.getElementById("pieMetric").addEventListener("change", buildConstructorPie);
  document.getElementById("normalizeBtn").addEventListener("click", (e)=>{
    const btn = e.currentTarget;
    const pressed = btn.getAttribute("aria-pressed") === "true";
    state.normalize = !pressed;
    btn.setAttribute("aria-pressed", String(state.normalize));
    drawPointsLine(document.getElementById("driverSelect").value|0);
  });
}

/* Charts */
function buildWinsChart() {
  const topSel = document.getElementById("winsTopN").value;
  const sortPressed = document.getElementById("winsSort").getAttribute("aria-pressed") === "true";

  let rows = [...state.driverStandings];
  if (sortPressed) rows.sort((a,b)=> b.wins - a.wins);
  const topN = topSel === "All" ? rows.length : Math.min(rows.length, parseInt(topSel,10) || 10);
  rows = rows.slice(0, topN);

  const ctx = document.getElementById("winsChart");
  const labels = rows.map(d => d.driver);
  const data = rows.map(d => d.wins);

  state.charts.wins && state.charts.wins.destroy();
  state.charts.wins = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Wins", data }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false }},
      scales: {
        x: { ticks: { color: getTickColor() }, grid: { display: false } },
        y: { ticks: { color: getTickColor() }, grid: { color: getGridColor() }, beginAtZero: true }
      }
    }
  });
}
function buildConstructorPie() {
  const metric = document.getElementById("pieMetric").value;
  const ctx = document.getElementById("constructorPie");
  const labels = state.constructorStandings.map(c => c.name);
  const data = state.constructorStandings.map(c => c[metric]);
  state.charts.pie && state.charts.pie.destroy();
  state.charts.pie = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: getTickColor() }}}
    }
  });
}
function buildPointsLine() {
  const select = document.getElementById("driverSelect");
  select.innerHTML = state.driverStandings.map((d, i) => `<option value="${i}">${d.driver}</option>`).join("");
  select.addEventListener("change", () => drawPointsLine(+select.value));
  drawPointsLine(0);
}
async function drawPointsLine(idx) {
  const chosen = state.driverStandings[idx];
  const rounds = state.rounds.map(r => +r.round);
  const labels = rounds.map(r => `R${r}`);
  const cumulative = [];

  for (const r of rounds) {
    try {
      const res = await getJSON(`/current/${r}/driverStandings.json`);
      const list = res?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
      const me = list.find(x => `${x.Driver.givenName} ${x.Driver.familyName}` === chosen.driver);
      cumulative.push(me ? +me.points : (cumulative[cumulative.length - 1] || 0));
    } catch {
      cumulative.push(cumulative[cumulative.length - 1] || 0);
    }
  }

  let series = cumulative;
  if (state.normalize) {
    const max = Math.max(1, cumulative[cumulative.length - 1] || 1);
    series = cumulative.map(v => Math.round((v / max) * 100));
  }

  const ctx = document.getElementById("pointsLine");
  state.charts.line && state.charts.line.destroy();
  state.charts.line = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: chosen.driver, data: series, fill: false, tension: 0.25 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getTickColor() }}},
      scales: {
        x: { ticks: { color: getTickColor() }, grid: { color: getGridColor() } },
        y: { ticks: { color: getTickColor() }, grid: { color: getGridColor() }, beginAtZero: true }
      }
    }
  });
}

/* Tabs, theme, utils */
function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("is-active", t === btn));
      document.querySelectorAll(".panel").forEach(p => p.classList.toggle("is-active", p.id === target));
      history.replaceState(null, "", `#${target}`);
    });
  });
}
function syncTabFromHash(){
  const hash = location.hash.replace("#","") || "overview";
  const targetTab = document.querySelector(`.tab[data-tab="${hash}"]`);
  if (targetTab) targetTab.click();
}
function setupSortableTables(){
  document.querySelectorAll("table.data-table thead th").forEach(th => {
    th.addEventListener("click", () => {
      const table = th.closest("table");
      const idx = Array.from(th.parentElement.children).indexOf(th);
      const tbody = table.querySelector("tbody");
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const numeric = th.classList.contains("num");
      const currentDir = th.dataset.sortDir || "none";
      const dir = currentDir === "asc" ? "desc" : "asc";
      th.dataset.sortDir = dir;
      rows.sort((a,b) => {
        const va = a.children[idx].textContent.trim();
        const vb = b.children[idx].textContent.trim();
        if (numeric){
          const na = parseFloat(va) || 0;
          const nb = parseFloat(vb) || 0;
          return dir === "asc" ? na - nb : nb - na;
        } else {
          return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        }
      });
      tbody.innerHTML = "";
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}
function setupTheme(){
  const toggle = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "light") document.documentElement.classList.add("light"), toggle.setAttribute("aria-pressed","true");
  toggle.addEventListener("click", ()=>{
    const pressed = toggle.getAttribute("aria-pressed") === "true";
    const isLight = !pressed;
    toggle.setAttribute("aria-pressed", String(isLight));
    document.documentElement.classList.toggle("light", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}

/* Global & local search helpers */
function setupLocalSearches(){ /* See hookupSearch below in Searches */ }
function setupGlobalSearch(){ /* See globalSearch above */ }

/* Utilities */
function getTickColor(){ return document.documentElement.classList.contains("light") ? "#111319" : "#cfd6e4"; }
function getGridColor(){ return document.documentElement.classList.contains("light") ? "#e5e7eb" : "#2a2f48"; }
function buildAvatarDataUrl(name, code){
  const initials = (code || name.split(' ').map(x=>x[0]).join('').slice(0,3)).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#0ea5e9'/><stop offset='100%' stop-color='#ef4444'/></linearGradient></defs>
    <rect width='100%' height='100%' rx='22' fill='url(#g)'/>
    <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='96' fill='white' opacity='0.95'>${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function buildTeamLogoDataUrl(name){
  const short = name.split(' ').map(x=>x[0]).join('').slice(0,4).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <rect width='100%' height='100%' rx='22' fill='#111827'/>
    <circle cx='120' cy='150' r='52' fill='#ff1e00'/>
    <rect x='190' y='120' width='150' height='60' rx='12' fill='#0ea5e9'/>
    <text x='50%' y='88%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='56' fill='white' opacity='0.9'>${short}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function wikiTitleFromUrl(url){
  if (!url) return null;
  try{
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[1] || null; // /wiki/Title
  }catch(e){ return null; }
}
