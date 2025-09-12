// export function laodDashboard(): void {
//     const content = document.getElementById("dashboard-content");
//     const buttons = document.querySelectorAll(".tab-button");
    
//     const views = {
//         stats: `
//             <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/controller.svg" alt="Partie jouées" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pink-300">Parties jouées</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">128</p>
//                 </div>
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/trophy.svg" alt="Victoires" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pink-300">Victoires</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">74</p>
//                 </div>
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/broken-heart.svg" alt="Broken heart" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pinj-300">Loose</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">54</p>             
//                 </div>
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/bar-chart.svg" alt="Win rate" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pinj-300">Win rate</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">57.8%</p>
//                 </div>
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/flamme.png" alt="Win rate" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pinj-300">Win streak</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">3</p>
//                 </div>
//                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
//                     <img src="assets/dashboard/medal.png" alt="Win rate" class="w-10 h-10 mb-4" />
//                     <p class="text-xl font-bold text-pinj-300">Rank</p>
//                     <p class="text-3xl font-extrabold mt-2 text-white">1</p>
//                 </div>
//             <div>
//         `,
//         history: `
//             <div class="bg-black/30 p-6 rounded-xl shadow-neon w-full mx-auto space-y-4">
//                 <h3 class="text-2xl font-bold text-pink-300 mb-4">📝 Historique des parties</h3>

//                 <div class="space-y-4">
//                 <!-- match 1 -->
//                     <div class="bg-[#1a0020]/80 p-4 rounded-xl flex justify-between items-center shadow-inner">
//                         <div class="flex items-center gap-4">
//                             <span class="w-3 h-3 rounded-full bg-green-400"></span>
//                             <div>
//                                 <p class="text-pink-100 font-semibold">vs CyberAlice</p>
//                                 <p class="text-sm text-pink-400">2024-01-15</p>
//                             </div>
//                         </div>
//                         <div class="text-right">
//                             <p class="text-green-400 font-bold text-xl">5 - 3</p>
//                         </div>
//                     </div>
                
//                 <!-- match 2 -->
//                     <div class="bg-[#1a0020]/80 p-4 rounded-xl flex justify-between items-center shadow-inner">
//                         <div class="flex items-center gap-4">
//                             <span class="w-3 h-3 rounded-full bg-red-400"></span>
//                             <div>
//                                 <p class="text-pink-100 font-semibold">vs CyberBob</p>
//                                 <p class="text-sm text-pink-400">2024-01-16</p>
//                             </div>
//                         </div>
//                         <div class="text-right">
//                             <p class="text-red-400 font-bold text-xl">4 - 5</p>
//                         </div>
//                     </div>
                
//                 <!-- match 3 -->
//                     <div class="bg-[#1a0020]/80 p-4 rounded-xl flex justify-between items-center shadow-inner">
//                         <div class="flex items-center gap-4">
//                             <span class="w-3 h-3 rounded-full bg-green-400"></span>
//                             <div>
//                                 <p class="text-pink-100 font-semibold">vs CyberCharlie</p>
//                                 <p class="text-sm text-pink-400">2024-01-17</p>
//                             </div>
//                         </div>
//                         <div class="text-right">
//                             <p class="text-green-400 font-bold text-xl">5 - 4</p>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//         `,
//         ranking: `
//             <div class="bg-black/30 p-6 rounded-xl shadow-neon w-full mx-auto space-y-4">
//                 <h3 class="text-2xl font-bold text-pink-300 mb-4">🏆 Classement</h3>

//                 <div class="space-y-3">
//                     <!-- rank 1 -->
//                     <div class="flex items-center justify-between bg-[#1a1a2e]/70 rounded-xl px-6 py-4 shadow-lg">
//                         <!-- Gauche : Rang + Pseudo + Win/Loss -->
//                         <div class="flex items-center space-x-4">
//                             <!-- Rang / Médaille -->
//                             <div class="text-2xl w-8 text-center">
//                             🥇
//                             </div>
//                             <!-- Nom + Stat -->
//                             <div class="flex flex-col">
//                             <span class="font-bold text-pink-100 text-lg">SynthMaster</span>
//                             <span class="text-sm text-left text-pink-400">145W - 23L</span>
//                             </div>
//                         </div>

//                         <!-- Droite : Score + WR -->
//                         <div class="text-right">
//                             <div class="text-yellow-400 font-extrabold text-lg">2156 pts</div>
//                             <div class="text-pink-300 text-sm">86% WR</div>
//                         </div>
//                         </div>

//                     <!-- rank 2 -->
//                     <div class="flex items-center justify-between bg-[#1a1a2e]/70 rounded-xl px-6 py-4 shadow-lg">
//                         <!-- Gauche : Rang + Pseudo + Win/Loss -->
//                         <div class="flex items-center space-x-4">
//                             <!-- Rang / Médaille -->
//                             <div class="text-2xl w-8 text-center">
//                             🥈
//                             </div>
//                             <!-- Nom + Stat -->
//                             <div class="flex flex-col">
//                             <span class="font-bold text-pink-100 text-lg">CyberBob</span>
//                             <span class="text-sm text-left text-pink-400">115W - 43L</span>
//                             </div>
//                         </div>

//                         <!-- Droite : Score + WR -->
//                         <div class="text-right">
//                             <div class="text-yellow-400 font-extrabold text-lg">1856 pts</div>
//                             <div class="text-pink-300 text-sm">70% WR</div>
//                         </div>
//                         </div>

//                     <!-- rank 3 -->
//                     <div class="flex items-center justify-between bg-[#1a1a2e]/70 rounded-xl px-6 py-4 shadow-lg">
//                         <!-- Gauche : Rang + Pseudo + Win/Loss -->
//                         <div class="flex items-center space-x-4">
//                             <!-- Rang / Médaille -->
//                             <div class="text-2xl w-8 text-center">
//                             🥉
//                             </div>
//                             <!-- Nom + Stat -->
//                             <div class="flex flex-col">
//                             <span class="font-bold text-pink-100 text-lg">CyberAlice</span>
//                             <span class="text-sm text-left text-pink-400">105W - 83L</span>
//                             </div>
//                         </div>

//                         <!-- Droite : Score + WR -->
//                         <div class="text-right">
//                             <div class="text-yellow-400 font-extrabold text-lg">1406 pts</div>
//                             <div class="text-pink-300 text-sm">51% WR</div>
//                         </div>
//                         </div>

//                     <!-- rank 4-->
//                     <div class="flex items-center justify-between bg-[#1a1a2e]/70 rounded-xl px-6 py-4 shadow-lg">
//                         <!-- Gauche : Rang + Pseudo + Win/Loss -->
//                         <div class="flex items-center space-x-4">
//                             <!-- Rang / Médaille -->
//                             <div class="text-2xl w-8 text-center">
//                             #4
//                             </div>
//                             <!-- Nom + Stat -->
//                             <div class="flex flex-col">
//                             <span class="font-bold text-pink-100 text-lg">CyberEric</span>
//                             <span class="text-sm text-left text-pink-400">100W - 83L</span>
//                             </div>
//                         </div>

//                         <!-- Droite : Score + WR -->
//                         <div class="text-right">
//                             <div class="text-yellow-400 font-extrabold text-lg">1350 pts</div>
//                             <div class="text-pink-300 text-sm">50% WR</div>
//                         </div>
//                         </div>

//                     <!-- rank 5-->
//                     <div class="flex items-center justify-between bg-[#1a1a2e]/70 rounded-xl px-6 py-4 shadow-lg">
//                         <!-- Gauche : Rang + Pseudo + Win/Loss -->
//                         <div class="flex items-center space-x-4">
//                             <!-- Rang / Médaille -->
//                             <div class="text-2xl w-8 text-center">
//                             #5
//                             </div>
//                             <!-- Nom + Stat -->
//                             <div class="flex flex-col">
//                             <span class="font-bold text-pink-100 text-lg">CyberTeddy</span>
//                             <span class="text-sm text-left text-pink-400">98W - 83L</span>
//                             </div>
//                         </div>

//                         <!-- Droite : Score + WR -->
//                         <div class="text-right">
//                             <div class="text-yellow-400 font-extrabold text-lg">1300 pts</div>
//                             <div class="text-pink-300 text-sm">51% WR</div>
//                         </div>
//                         </div>

//                         </div>
//                     </div>
//                 </div>
//             </div>
//         `,
//     };

//     function show(tab: keyof typeof views) {
//         if (content) content.innerHTML = views[tab];
//     }

//     buttons.forEach(btn => {
//         btn.addEventListener("click", () => {
//             const tab = (btn as HTMLElement).dataset.tab as keyof typeof views;
//             show(tab);
//         });
//     });

//     show("stats");
// }

// function currentUser(): { username?: string } | null {
//   try { return JSON.parse(localStorage.getItem('auth') || 'null'); }
//   catch { return null; }
// }

// export function paintDashboardUsername() {
//   const el = document.getElementById('dashUsername');
//   if (!el) return;
//   const user = currentUser();
//   el.textContent = user?.username ?? 'Invité';
// }

// frontend/src/pages/dashboard.ts (ou ton chemin actuel)

// src/pages/dashboard.ts

<<<<<<< HEAD
import { applyTranslations, t } from "../i18n";

=======
>>>>>>> pong
// ---- Types & helpers ----
type Stats = { wins: number; losses: number; played: number; winRate: number };

function getAuth(): null | { id: number; username: string; email: string } {
  const raw = localStorage.getItem('auth');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ---- Views ----
function statsView() {
  return `
<<<<<<< HEAD
<div id="stats-state" class="text-pink-200 mb-4"></div>
<div id="stats-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 hidden">
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/controller.svg" alt="Partie jouées" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pink-300 " data-i18n="dashboard.stats.played">Parties jouées</p>
                     <p id="st-played" class="text-3xl font-extrabold mt-2 text-white">0</p>
                 </div>
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/trophy.svg" alt="Victoires" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pink-300" data-i18n="dashboard.stats.wins" >Victoires</p>
                     <p id="st-wins" class="text-3xl font-extrabold mt-2 text-white">74</p>
                 </div>
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/broken-heart.svg" alt="Broken heart" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pinj-300" data-i18n="dashboard.stats.losses">Loose</p>
                     <p id="st-losses" class="text-3xl font-extrabold mt-2 text-white">54</p>             
                 </div>
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/bar-chart.svg" alt="Win rate" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pinj-300" data-i18n="dashboard.stats.winrate" >Win rate</p>
                     <p id="st-winrate" class="text-3xl font-extrabold mt-2 text-white">57.8%</p>
                 </div>
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/flamme.png" alt="Win rate" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pinj-300" data-i18n="dashboard.stats.streak">Win streak</p>
                     <p class="text-3xl font-extrabold mt-2 text-white">3</p>
                 </div>
                 <div class="bg-[#1a1a2e]/70 p-6 rounded-xl shadow-neon flex flex-col items-center transistion-transform transform hover:scale-105 duration-300">
                     <img src="assets/dashboard/medal.png" alt="Win rate" class="w-10 h-10 mb-4" />
                     <p class="text-xl font-bold text-pinj-300" data-i18n="dashboard.stats.rank">Rank</p>
                     <p class="text-3xl font-extrabold mt-2 text-white">1</p>
                 </div>
             </div>
=======
    <div class="bg-black/30 p-6 rounded-xl shadow-neon space-y-6">
      <h3 class="text-2xl font-bold text-pink-200">Statistiques</h3>
      <div id="stats-state" class="text-pink-300">Chargement…</div>
      <div id="stats-grid" class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center hidden">
        <div class="p-4 rounded-xl bg-black/40 border border-pink-500/30">
          <div class="text-sm opacity-80">Victoires</div>
          <div id="st-wins" class="text-3xl font-extrabold">—</div>
        </div>
        <div class="p-4 rounded-xl bg-black/40 border border-pink-500/30">
          <div class="text-sm opacity-80">Défaites</div>
          <div id="st-losses" class="text-3xl font-extrabold">—</div>
        </div>
        <div class="p-4 rounded-xl bg-black/40 border border-pink-500/30">
          <div class="text-sm opacity-80">Joués</div>
          <div id="st-played" class="text-3xl font-extrabold">—</div>
        </div>
        <div class="p-4 rounded-xl bg-black/40 border border-pink-500/30">
          <div class="text-sm opacity-80">Win Rate</div>
          <div id="st-winrate" class="text-3xl font-extrabold">—</div>
        </div>
      </div>
    </div>
>>>>>>> pong
  `;
}

function historyView() {
  return `
    <div class="bg-black/30 p-6 rounded-xl shadow-neon">
      <h3 class="text-2xl font-bold text-pink-200">Historique</h3>
      <p class="text-pink-300/80 mt-2">À venir…</p>
    </div>`;
}

function rankingView() {
  return `
    <div class="bg-black/30 p-6 rounded-xl shadow-neon">
      <h3 class="text-2xl font-bold text-pink-200">Classement</h3>
      <p class="text-pink-300/80 mt-2">À venir…</p>
    </div>`;
}

// ---- Data loader ----
async function loadStats(userId: number) {
  const state = document.getElementById("stats-state")!;
  const grid  = document.getElementById("stats-grid")!;

<<<<<<< HEAD
  const showRetry = (msgKey: string, vars?: Record<string, any>) => {
    state.innerHTML = `${t(msgKey, vars)} <button id="retry" class="underline" data-i18n="common.retry">Reessayer</button>`
    applyTranslations(state);
=======
  const showRetry = (msg: string) => {
    state.innerHTML = `${msg} <button id="retry" class="underline">Réessayer</button>`;
>>>>>>> pong
    grid.classList.add("hidden");
    document.getElementById("retry")?.addEventListener("click", () => loadStats(userId));
  };

  try {
<<<<<<< HEAD
    state.textContent = t('common.loading');
=======
    state.textContent = "Chargement…";
>>>>>>> pong
    grid.classList.add("hidden");

    // (1) Validation basique de l’id
    if (!Number.isFinite(Number(userId))) {
<<<<<<< HEAD
      showRetry("dashboard.invalid_user_id");
=======
      showRetry("❌ ID utilisateur invalide. Veuillez vous reconnecter.");
>>>>>>> pong
      return;
    }

    // (2) Appel API
    const url = `/api/users/${Number(userId)}/stats`;
    const res = await fetch(url);

    // (3) HTTP non-OK → essayer d’afficher un message backend
    if (!res.ok) {
<<<<<<< HEAD
      let key = res.status === 401 ? 'auth.must_login'
              : res.status === 404 ? 'users.not_found'
              : 'common.server_error';
      try {
        const body = await res.json();
        key = body?.error_key || key;
      } catch {}
      showRetry(key);
=======
      let detail = "";
      try {
        const errBody = await res.json();
        detail = errBody?.message || errBody?.error || "";
      } catch {
        // pas de JSON → ignorer
      }
      console.debug("[Stats] HTTP error", res.status, detail || "(no body)", "url:", url);
      const label =
        res.status === 401 ? "Non autorisé" :
        res.status === 404 ? "Utilisateur introuvable" :
        "Erreur serveur";
      showRetry(`❌ ${label}${detail ? ` — ${detail}` : ""}.`);
>>>>>>> pong
      return;
    }

    // (4) JSON attendu
    let s: any;
    try {
      s = await res.json();
    } catch (e) {
<<<<<<< HEAD
      showRetry('dashboard.invalid_response');
=======
      console.debug("[Stats] JSON parse error", e);
      showRetry("❌ Réponse invalide du serveur.");
>>>>>>> pong
      return;
    }

    // (5) Tolérance aux null/undefined et types
    const wins    = Number(s?.wins)    || 0;
    const losses  = Number(s?.losses)  || 0;
    const played  = Number(s?.played)  || (wins + losses);
    const winRate = Number.isFinite(Number(s?.winRate))
      ? Number(s.winRate)
      : (played ? Math.round((wins / played) * 100) : 0);

    // (6) Affichage
    (document.getElementById("st-wins")!).textContent    = String(wins);
    (document.getElementById("st-losses")!).textContent  = String(losses);
    (document.getElementById("st-played")!).textContent  = String(played);
    (document.getElementById("st-winrate")!).textContent = `${winRate}%`;

    state.textContent = "";
    grid.classList.remove("hidden");
  } catch (e: any) {
<<<<<<< HEAD
    showRetry('common.network_error');
=======
    console.debug("[Stats] Network error", e);
    showRetry("❌ Problème réseau (proxy / CORS / backend indisponible).");
>>>>>>> pong
  }
}

// ---- Controller ----
function setActiveTab(name: "stats"|"history"|"ranking") {
  const content = document.getElementById("dashboard-content")!;
  content.innerHTML =
    name === "stats"   ? statsView() :
    name === "history" ? historyView() :
                         rankingView();
<<<<<<< HEAD
    applyTranslations(content);
=======

>>>>>>> pong
    if (name === "stats") {
    const raw = localStorage.getItem("auth");
    let user: any = null;
    try { user = raw ? JSON.parse(raw) : null; } catch {}
    const state = document.getElementById("stats-state");
    if (!user?.id) {
        if (state) state.textContent = "Veuillez vous connecter.";
        return;
    }
    // lance le chargement
    loadStats(Number(user.id));
    }
}

// Public: appelé après injection de dashboard.html
export function mountDashboard() {
  // 1) Pseudo (dans <span id="dashUsername">…</span>)
  const user = getAuth();
  const nameEl = document.getElementById("dashUsername");
  if (user && nameEl) nameEl.textContent = user.username;

  // 2) Tabs click
  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab as "stats"|"history"|"ranking";
      setActiveTab(tab);
    });
  });

  // 3) Onglet par défaut
  setActiveTab("stats");
}

// Compat: certains imports existants utilisent ce nom
export const laodDashboard = mountDashboard;

// Utilisé par main.ts pour mettre à jour le header du dashboard
export function paintDashboardUsername() {
  const el = document.getElementById('dashUsername');
  if (!el) return;
  const user = getAuth();
  el.textContent = user?.username ?? 'Invité';
}

