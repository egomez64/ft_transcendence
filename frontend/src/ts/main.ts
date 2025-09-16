import "../style.css";
import "../output.css";
import { initFriendsPage } from "./friends";
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
import { applyTranslations, initI18n } from "../i18n";
import { initPlayPage } from "./play";

function routeFromLocation(): string {
  const p = window.location.pathname || "/";
  if (p === "/" || p === "/home") return "home";
  return p.replace(/^\/+/, "");
}

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

// Pages nécessitant login
const protectedPages = new Set(["dashboard", "play"]);

// Layout HTML initial (header/nav/app container)
async function loadLayout() {
  if (document.getElementById("authMenu")) return; // déjà chargé
  const layoutResp = await fetch("./src/pages/layout.html");
  const layoutHtml = await layoutResp.text();
  document.body.innerHTML = layoutHtml;
}

// Carte des pages
const PAGE_MAP: Record<string, { file: string; mount?: () => void; protected?: boolean }> = {
  home:      { file: "home.html" },
  login:     { file: "login.html", mount: mountLoginHandlers, protected: false },
  register:  { file: "register.html", mount: mountRegisterHandlers, protected: false },
  dashboard: { file: "dashboard.html", mount: () => { mountDashboard(); laodDashboard?.(); paintDashboardUsername(); }, protected: true },
  play:      { file: "play.html", mount: initPlayPage, protected: false },
  profils:   { file: "profile.html", mount: mountProfileHandlers, protected: true },
  friends:   { file: "friends.html", mount: initFriendsPage, protected: false },
  pong:      { file: "pong.html", mount: initPongPage, protected: false },
};

// --------- ROUTER ---------

let ROUTING = false; // anti-réentrance

export async function loadPage() {
  const key = routeFromLocation();
  const def = PAGE_MAP[key] ?? PAGE_MAP.home;

  // guard d’accès
  if (def.protected && !isAuthed()) {
    // on redirige vers /login UNE SEULE FOIS
    await navigate("/login", true);
    return;
  }

  const app = document.getElementById("app");
  const isSSR = app?.getAttribute("data-ssr") === "1";

  if (!isSSR) {
    let html = "";
    try {
      const res = await fetch(`/src/pages/${def.file}`, { cache: "no-cache" });
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
    app?.removeAttribute("data-ssr");
    if (app) applyTranslations(app);
  }

  // Attendre un élément clé si besoin (évite les handlers sur DOM pas prêt)
  const keyElMap: Record<string, string> = {
    friends: "#friendSearchForm",
  };
  const keyEl = keyElMap[key];
  if (keyEl) await waitFor(keyEl);

  await Promise.resolve();
  await new Promise(requestAnimationFrame);

  try { def.mount?.(); } catch (e) { console.error("[mount]", key, e); }

  setupAuthMenu();
}

export async function navigate(path: string, replace = false) {
  const url = path.startsWith("/") ? path : `/${path}`;

  // pas de “tourne en rond” : si on demande la même URL → juste recharger la page
  if (url === window.location.pathname) {
    return loadPage();
  }

  if (ROUTING) return; // anti-spam et anti-réentrance
  ROUTING = true;
  try {
    if (replace) history.replaceState({}, "", url);
    else history.pushState({}, "", url);
    await loadPage();
  } finally {
    ROUTING = false;
  }
}

// ---- Global listeners ----

// Interception des liens internes (SPA)
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement)?.closest("a[href]");
  if (!a) return;
  const href = (a as HTMLAnchorElement).getAttribute("href") || "";
  if (!href.startsWith("/")) return; // liens externes : laisser passer
  e.preventDefault();
  navigate(href);
});

// Bouton logout (menu header)
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest("#logoutBtn");
  if (!btn) return;
  e.preventDefault();
  localStorage.removeItem("auth");
  closeAuthDropdown();
  setupAuthMenu();
  navigate("/login", true);
});

// Navigation back/forward
window.addEventListener("popstate", () => {
  setupAuthMenu();
  loadPage(); // lit location.pathname actuel
  const app = document.getElementById("app")!;
  applyTranslations(app);
});

// Boot
window.addEventListener("DOMContentLoaded", async () => {
  await loadLayout();
  await initI18n();
  setupLangDropdown();
  await loadPage();
});

// Quand l’auth change (login / 2FA OK / logout)
window.addEventListener("auth:changed", () => {
  setupAuthMenu();
  loadPage();
  // si on est sur dashboard, (re)peindre les infos
  if (routeFromLocation() === "dashboard") {
    paintDashboardUsername();
    mountDashboard();
  }
});
