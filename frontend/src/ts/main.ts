
import "../style.css";
import "../output.css";
import { initFriendsPage } from "./friends";
import { initLoginPage } from "./login";
import { mountRegisterHandlers } from "./register";
import { mountLoginHandlers } from "./login";
import { mountDashboard, laodDashboard, paintDashboardUsername } from "./dashboard";
import { mountProfileHandlers } from "./profile";
import {
  setupAuthMenu,
  closeAuthDropdown,
  renderAuthBadge,
  currentUser,
  isAuthed,
  setupLangDropdown,
} from "./layout";
import { applyTranslations, setLang, initI18n } from '../i18n';
import { initPlayPage } from "./play";

function routeFromLocation(): string {
  const p = window.location.pathname || '/';
  if (p === '/' || p === '/home') return 'home';
  return p.replace(/^\/+/, '');
}

function navigate(path: string, replace = false) {
  const url = path.startsWith('/') ? path : `/${path}`;
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  loadPage();
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement)?.closest('a[href]');
  if (!a) return;

  const href = (a as HTMLAnchorElement).getAttribute('href') || '';
  if (!href.startsWith('/')) return;
  e.preventDefault();
  navigate(href);
})

async function waitFor(sel: string, tries = 10): Promise<boolean> {
  return await new Promise((resolve) => {
    const check = () => {
      if (document.querySelector(sel)) return resolve(true);
      if (tries-- <= 0) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  });
}


const protectedPages = new Set(['dashboard', 'play']);
const authOnlyForbidden = new Set(['login', 'register']);

async function loadLayout() {
  if (document.getElementById('authMenu')) return;
  const layoutResp = await fetch('./src/pages/layout.html');
  const layoutHtml = await layoutResp.text();
  document.body.innerHTML = layoutHtml;
}

//protected si besoins d'etre connecter
//mount fonction a appeler apres injection
const PAGE_MAP: Record<string, { file: string; mount?: () => void; protected?: boolean }> = {
  home:       {file: 'home.html' },
  login:      {file: 'login.html', mount: mountLoginHandlers, protected: false},
  register:   {file: 'register.html', mount: mountRegisterHandlers, protected: false },
  dashboard:  {file: 'dashboard.html', mount: () => { mountDashboard(); laodDashboard?.(); paintDashboardUsername(); }, protected: true},
  play:       {file: 'play.html', mount: initPlayPage, protected: false},
  profils:    {file: 'profile.html', mount: mountProfileHandlers, protected: true},
  friends:    {file: 'friends.html', mount: initFriendsPage, protected: false},
};

function normalizePage(rawHash: string): string {
  const h = (rawHash || '').trim().toLowerCase();
  if (!h || h === '#' || h === '#home') return 'home';
  const p = h.startsWith('#') ? h.slice(1) : h;
  return p;
}

export async function loadPage() {
  const key = routeFromLocation();
  const def = PAGE_MAP[key] ?? PAGE_MAP.home;
  if (def.protected && !isAuthed()) {
    navigate('/login', true);
    return;
  }

  const app = document.getElementById('app');
  const isSSR = app?.getAttribute('data-ssr') === '1';

  if (!isSSR) {
    let html = '';
    try {
      const res = await fetch(`/src/pages/${def.file}`, { cache: 'no-cache' });
      html = await res.text(); 
    } catch {
      html = `<section class="max-w-xl mx-auto mt-24 bg-black/60 text-pink-100 rounded-xl p-6 border border-pink-500/30">
        <h2 class="text-2xl mb-2">Oups</h2>
        <p>Impossible de charger <code>${def.file}</code>.</p>
      </section>`;
    }
    if (app) {
      app.innerHTML = html;
      applyTranslations(app);
    }
  } else {
    app?.removeAttribute('data-ssr');
    if (app) applyTranslations(app);
  }
  const keyElMap: Record<string, string>= {
    friends: '#friendSearchForm',
  };
  const keyEl = keyElMap[key];
  if (keyEl) {
    await waitFor(keyEl);
  }
  await Promise.resolve();
  await new Promise(requestAnimationFrame);

  try { def.mount?.(); } catch (e) { console.error('[mount]', key, e); }
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
  navigate('/login', true);
});

window.addEventListener('popstate', () => {
  setupAuthMenu();
  loadPage();
  const app = document.getElementById("app")!;
  applyTranslations(app);
})

window.addEventListener('DOMContentLoaded', async () => {
  await loadLayout();
  await initI18n();
  setupLangDropdown();
  await loadPage();
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