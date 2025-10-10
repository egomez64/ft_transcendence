// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.ts
// Gestion du tableau de bord (statistiques, historique, classement)
// ─────────────────────────────────────────────────────────────────────────────

import { applyTranslations, t } from "../i18n";
import { fetchWithAuth } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
// 1) TYPES & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type Stats = { wins: number; losses: number; played: number; winRate: number };
type Me = { id: number; username: string; email?: string } | null;

/** Récupère l'utilisateur courant depuis le backend  */
async function fetchMe(): Promise<Me> {
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user || null;
  } catch {
    return null;
  }
}

async function fetchUserPublicName(userId: number): Promise<string | null> {
  try {
    const res = await fetchWithAuth(`/api/users/${userId}`);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const u = data?.user || data;
      const name = u?.alias || u?.username || null;
      if (name) return name;
    }
  } catch {}
  
  //fallback tenter via ranking
  try{
    const r = await fetchWithAuth("/api/users/ranking");
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      const u = d?.ranking?.find((x: any) => x.id === userId);
      if (u?.username) return u.username;
    }
  } catch {}

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) VUES (HTML bruts injectés dans le dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/** Vue statistiques */
function statsView() {
  return `
    <div id="stats-state" class="text-pink-200 mb-4"></div>
    <div id="stats-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 hidden">
      <!-- Parties jouées -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/controller.svg" alt="Partie jouées" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.played">Parties jouées</p>
        <p id="st-played" class="text-3xl font-extrabold mt-2 text-white">0</p>
      </div>
      <!-- Victoires -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/trophy.svg" alt="Victoires" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.wins">Victoires</p>
        <p id="st-wins" class="text-3xl font-extrabold mt-2 text-white">0</p>
      </div>
      <!-- Défaites -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/broken-heart.svg" alt="Défaites" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.losses">Défaites</p>
        <p id="st-losses" class="text-3xl font-extrabold mt-2 text-white">0</p>
      </div>
      <!-- Taux de victoire -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/bar-chart.svg" alt="Win rate" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.winrate">Win rate</p>
        <p id="st-winrate" class="text-3xl font-extrabold mt-2 text-white">0%</p>
      </div>
      <!-- Streak -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/flamme.png" alt="Streak" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.streak">Win streak</p>
        <p id="st-streak" class="text-3xl font-extrabold mt-2 text-white">0</p>
      </div>
      <!-- Rang -->
      <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center">
        <img src="assets/dashboard/medal.png" alt="Rank" class="w-10 h-10 mb-4" />
        <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.rank">Rank</p>
        <p id="st-rank" class="text-3xl font-extrabold mt-2 text-white">-</p>
      </div>
    </div>
  `;
}

/** Vue historique */
function historyView() {
  return `
    <div class="bg-black/30 p-6 rounded-xl shadow-neon">
      <h3 class="text-2xl font-bold text-pink-200">Historique</h3>
      <div id="history-list" class="mt-4 space-y-4 text-white"></div>
    </div>`;
}

/** Vue classement */
function rankingView() {
  return `
    <div id="ranking-state" class="text-pink-200 mb-4"></div>
    <div id="ranking-list" class="space-y-3"></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) DATA LOADERS
// ─────────────────────────────────────────────────────────────────────────────

/** Charge l’historique des matchs */
async function loadHistory(userId: number) {
  try {
    const res = await fetchWithAuth(`/api/history/${userId}`);
    const matches = await res.json();

    const container = document.getElementById("history-list");
    if (!container) return;

    if (matches.length === 0) {
      container.innerHTML = `<p class="text-pink-300/80">Aucun match pour l’instant</p>`;
      return;
    }

    container.innerHTML = matches
      .map(
        (m: any) => `
        <div class="bg-[#1a0020]/80 p-4 rounded-xl flex justify-between items-center shadow-inner">
          <div class="flex items-center gap-4">
            <span class="w-3 h-3 rounded-full ${
              m.result === "win"
                ? "bg-green-400"
                : m.result === "lose"
                ? "bg-red-400"
                : "bg-yellow-400"
            }"></span>
            <div>
              <p class="text-pink-100 font-semibold">${m.player} vs ${m.opponent}</p>
              <p class="text-sm text-pink-400">${new Date(m.played_at).toLocaleString()}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="${
              m.result === "win"
                ? "text-green-400"
                : m.result === "lose"
                ? "text-red-400"
                : "text-yellow-400"
            } font-bold text-xl">${m.score}</p>
          </div>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error("Erreur chargement historique :", err);
  }
}

/** Charge les stats d’un joueur et met à jour le dashboard */
async function loadStats(userId: number) {
  const state = document.getElementById("stats-state")!;
  const grid = document.getElementById("stats-grid")!;

  const showRetry = (msgKey: string) => {
    state.innerHTML = `${t(msgKey)} <button id="retry" class="underline" data-i18n="common.retry">Reessayer</button>`;
    applyTranslations(state);
    grid.classList.add("hidden");
    document.getElementById("retry")?.addEventListener("click", () => loadStats(userId));
  };

  try {
    state.textContent = t("common.loading");
    grid.classList.add("hidden");

    // 1) Validation de l’id
    if (!Number.isFinite(Number(userId))) {
      showRetry("dashboard.invalid_user_id");
      return;
    }

    // 2) Récup stats
    const res = await fetchWithAuth(`/api/users/${userId}/stats`);
    if (!res.ok) {
      showRetry("common.server_error");
      return;
    }
    const s: any = await res.json();

    // 3) Normalisation
    const wins = Number(s?.wins) || 0;
    const losses = Number(s?.losses) || 0;
    const played = Number(s?.played) || wins + losses;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

    // 4) MAJ DOM
    (document.getElementById("st-wins")!).textContent = String(wins);
    (document.getElementById("st-losses")!).textContent = String(losses);
    (document.getElementById("st-played")!).textContent = String(played);
    (document.getElementById("st-winrate")!).textContent = `${winRate}%`;
    (document.getElementById("st-streak")!).textContent = String(s?.streak || 0);

    // 5) Récup du rang via /ranking
    try {
      const resRank = await fetchWithAuth("/api/users/ranking");
      if (resRank.ok) {
        const data = await resRank.json();
        const me = data?.ranking?.find((u: any) => u.id === userId);
        if (me) {
          (document.getElementById("st-rank")!).textContent = `#${me.rank}`;
        }
      }
    } catch (e) {
      console.warn("Impossible de charger le rang :", e);
      (document.getElementById("st-rank")!).textContent = "-";
    }

    // Succès
    state.textContent = "";
    grid.classList.remove("hidden");
  } catch (e) {
    showRetry("common.network_error");
  }
}

/** Charge et affiche le classement complet */
async function loadRanking(userId: number) {
  const state = document.getElementById("ranking-state")!;
  const list = document.getElementById("ranking-list")!;

  const showRetry = (msgKey: string) => {
    state.innerHTML = `${t(msgKey)} <button id="retry-ranking" class="underline" data-i18n="common.retry">Reessayer</button>`;
    applyTranslations(state);
    list.innerHTML = "";
    document.getElementById("retry-ranking")?.addEventListener("click", () => loadRanking(userId));
  };

  try {
    state.textContent = t("common.loading");
    list.innerHTML = "";

    // 1️⃣ Validation de l’ID
    if (!Number.isFinite(Number(userId))) {
      showRetry("dashboard.invalid_user_id");
      return;
    }

    // 2️⃣ Requête principale
    const res = await fetchWithAuth("/api/users/ranking");
    if (!res.ok) {
      showRetry("common.server_error");
      return;
    }

    const data = await res.json();
    state.textContent = "";

    // 3️⃣ Construction du DOM
    list.innerHTML = data.ranking
      .map((u: any) => {
        const isMe = u.id === userId;
        return `
          <div class="flex items-center justify-between rounded-xl px-6 py-4 shadow-lg
            ${isMe ? "bg-[#2a004f]/90 border-2 border-cyan-400" : "bg-[#1a1a2e]/70"}">
            <div class="flex items-center space-x-4">
              <div class="text-2xl w-8 text-center">
                ${u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : u.rank === 3 ? "🥉" : "#" + u.rank}
              </div>
              <div class="flex flex-col">
                <span class="font-bold ${isMe ? "text-cyan-300" : "text-pink-100"} text-lg">${u.username}</span>
                <span class="text-sm text-left text-pink-400">${u.wins}W - ${u.losses}L</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-yellow-400 font-extrabold text-lg">${u.elo} pts</div>
              <div class="text-pink-300 text-sm">${u.winRate}% WR</div>
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Erreur chargement ranking :", err);
    showRetry("common.network_error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) CONTROLLER (navigation entre onglets + init dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/** Change d’onglet et charge la vue correspondante */
function setActiveTab(name: "stats" | "history" | "ranking", userIdOverride?: number) {
  const content = document.getElementById("dashboard-content")!;
  content.innerHTML = name === "stats" ? statsView() : name === "history" ? historyView() : rankingView();
  applyTranslations(content);

  fetchMe().then((user) => {
    const userId = userIdOverride ?? user?.id;

    if (!userId) {
      const target = document.getElementById(
        name === "history" ? "history-list" : "stats-state"
      );
      if (target) target.textContent = "Veuillez vous connecter.";
      return;
    }

    if (name === "stats") loadStats(userId);
    if (name === "history") loadHistory(userId);
    if (name === "ranking") loadRanking(userId);
  });
}

/** Point d’entrée public : appelé après injection de dashboard.html */
export function mountDashboard() {
  const params = new URLSearchParams(window.location.search);
  const userIdParam = params.get("userId");
  const tabParam = (params.get("tab") as "stats" | "history" | "ranking") ?? "stats";

  fetchMe().then((user) => {
    const nameEl = document.getElementById("dashUsername");
    if (user && nameEl) nameEl.textContent = user.username ?? "Invité";
  });

  //titre si friends dashboard
  (async () => {
    if (!userIdParam) return;

    const titleEl = document.querySelector<HTMLHeadingElement>('h2[data-i18n="nav.dashboard"]');
    if (!titleEl) return;

    const friendName = await fetchUserPublicName(Number(userIdParam));
    if (!friendName) return;

    const lang = (document.documentElement.getAttribute("lang") || localStorage.getItem("lang") || "fr").toLowerCase();
    const friendDash = 
      lang.startsWith("fr") ? `Tableau de bord de ${friendName}` :
      lang.startsWith("es") ? `Panel de ${friendName}` :
      `${friendName}'s Dashboard`;

    //evite les futur applyTranslations()
    titleEl.removeAttribute("data-i18n");
    titleEl.textContent = friendDash;
  })();

  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab as "stats" | "history" | "ranking";
      setActiveTab(tab, userIdParam ? Number(userIdParam) : undefined);
    });
  });

  setActiveTab(tabParam, userIdParam ? Number(userIdParam) : undefined);
}

/** Utilisé par main.ts pour mettre à jour le header */
export function paintDashboardUsername() {
  const el = document.getElementById("dashUsername");
  if (!el) return;
  fetchMe().then((user) => {
    el.textContent = user?.username ?? "Invité";
  });
}
