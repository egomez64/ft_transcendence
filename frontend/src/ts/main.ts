
import "../style.css";
import "../output.css";
import { initFriendPage } from "./friends";
import { initLoginPage } from "./login";
import { mountRegisterHandlers } from "./register";
import { mountLoginHandlers } from "./login";
import { mountDashboard, laodDashboard, paintDashboardUsername } from "./dashboard";
import { mountProfileHandlers } from "./profile";
import { initPongPage } from "./pong";
import {
  setupAuthMenu,
  closeAuthDropdown,
  renderAuthBadge,
  currentUser,
  isAuthed,
  setupLangDropdown,
} from "./layout";

const protectedPages = new Set(['dashboard', 'play']);
const authOnlyForbidden = new Set(['login', 'register']);

async function loadLayout() {
  const layoutResp = await fetch('./src/pages/layout.html');
  const layoutHtml = await layoutResp.text();
  document.body.innerHTML = layoutHtml;
}

function getPageFromHash(): string {
  const raw = location.hash.slice(1);
  return raw.replace('.html', '') || 'home';
}

//protected si besoins d'etre connecter
//mount fonction a appeler apres injection
const PAGE_MAP: Record<string, { file: string; mount?: () => void; protected?: boolean }> = {
  home:       {file: 'home.html' },
  login:      {file: 'login.html', mount: mountLoginHandlers, protected: false},
  register:   {file: 'register.html', mount: mountRegisterHandlers, protected: false },
  dashboard:  {file: 'dashboard.html', mount: () => { mountDashboard(); laodDashboard?.(); paintDashboardUsername(); }, protected: true},
  //play:       {file: 'play.html', mount: mountPlayHandlers, protected: true},
  profils:    {file: 'profile.html', mount: mountProfileHandlers, protected: true},
  friends:    {file: 'friends.html', mount: initFriendPage, protected: true},
  pong:       {file: 'pong.html', mount: initPongPage, protected: false}, //set to true when finished
};

function normalizePage(rawHash: string): string {
  const h = (rawHash || '').trim().toLowerCase();
  if (!h || h === '#' || h === '#home') return 'home';
  const p = h.startsWith('#') ? h.slice(1) : h;
  return p;
}

export async function loadPage() {
  const page = normalizePage(location.hash);
  
  if (page === 'logout') {
    localStorage.removeItem('auth');
    setupAuthMenu();
    location.hash = '#login';
    return;
  }

  const def = PAGE_MAP[page] ?? PAGE_MAP.home;

  if (def.protected && !isAuthed()) {
    location.replace('#login');
    return;
  }

  let pageHtml = '';
  try {
    const res = await fetch(`/src/pages/${def.file}`, { cache: 'no-cache'});
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${def.file}`);
    }
    pageHtml = await res.text();
  } catch(err) {
    console.error('[loadPage] fetch error:', err);
    pageHtml = `
      <section class="max-w-xl mx-auto mt-24 bg-black/60 text-pink-100 rounded-xl p-6 border border-pink-500/30">
        <h2 class="text-2xl mb-2">Oups</h2>
        <p>Impossible de charger <code>${def.file}</code>.</p>
      </section>`;
  }

  const app = document.getElementById('app');
  if (app) app.innerHTML = pageHtml;

  try {
    def.mount?.();
  } catch (err) {
    console.error('[loadPage] mount error on', page, err);
  }

  setupAuthMenu();
}

// ---- Global listeners ----
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest('#logoutBtn');
  if (!btn) return;
  e.preventDefault();
  localStorage.removeItem('auth');
  closeAuthDropdown();
  setupAuthMenu();
  location.hash = '#login';
});

window.addEventListener('hashchange', () => {
  setupAuthMenu();
  loadPage();
  initCurrentRouteIfNeeded();
});

window.addEventListener('DOMContentLoaded', async () => {
  await loadLayout();
  setupLangDropdown();
  await loadPage();
  initCurrentRouteIfNeeded();
});

// réagit aux changements d’auth (login/logout) pour rafraîchir UI + dashboard
window.addEventListener('auth:changed', () => {
  setupAuthMenu();
  loadPage();
  if ((location.hash.slice(1).replace('.html','') || 'home') === 'dashboard') {
    paintDashboardUsername();
    // on relance le loader des stats en revenant sur l’onglet
    // (mountDashboard s’en charge si nécessaire)
    mountDashboard();
  }
});

function initCurrentRouteIfNeeded() {
  const hash = window.location.hash || '#login';
  
  if (hash === '#login' || hash.startsWith('#login')) {
    initLoginPage();
  }
}

if (window.location.pathname.endsWith("pong.html")) {
    initPongPage();
}
