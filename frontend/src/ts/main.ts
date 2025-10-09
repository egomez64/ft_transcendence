// src/ts/main.ts
import "../style.css";
import "../output.css";
import { initFriendsPage } from "./friends";
import { mountRegisterHandlers } from "./register";
import { mountLoginHandlers } from "./login";
import { mountDashboard, paintDashboardUsername } from "./dashboard";
import { mountProfileHandlers } from "./profile";
import { mountSetPasswordPage } from "./set-password";
import { initPongPage } from "./pong";
import {
  setupAuthMenu,
  closeAuthDropdown,
  isAuthed,
  bindGlobalMenuOnce,
  currentUser,
  getMeOnce,
} from "./layout";
import { applyTranslations, initI18n } from "../i18n";
import { initPlayPage } from "./play";
import { initLocal1v1Page } from "./1vs1";
import { initTwofaPage } from "./twofa";
import { initTournamentPage } from "./tournament";
import { initTournamentBracketPage } from "./tournament-bracket";
import { fetchWithAuth, ensureFreshAcces } from "./utils";

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

// 🔹 mount peut retourner une fonction d’unmount
type MountFn = () => void | (() => void) | Promise<void | (() => void)>;
const PAGE_MAP: Record<string, { file: string; mount?: MountFn; protected?: boolean }> = {
  home:       { file: "home.html" },
  login:      { file: "login.html", mount: mountLoginHandlers, protected: false },
  register:   { file: "register.html", mount: mountRegisterHandlers, protected: false },
  dashboard:  { file: "dashboard.html", mount: () => { mountDashboard(); paintDashboardUsername(); }, protected: true },
  play:       { file: "play.html", mount: initPlayPage, protected: false },
  profils:    { file: "profile.html", mount: mountProfileHandlers, protected: true },
  friends:    { file: "friends.html", mount: initFriendsPage, protected: false },
  pong:       { file: "pong.html", mount: initPongPage, protected: false },
  '1v1':      { file: "1v1.html", mount: initLocal1v1Page, protected : false},
  twofa:      { file: "twofa.html", mount: initTwofaPage, protected : false},
  tournament: { file: "tournament.html", mount: initTournamentPage, protected : false},
<<<<<<< HEAD
  "tournament/bracket": {file: "tournament-bracket.html", mount: initTournamentBracketPage, protected: false},
  'set-password': {file: "set-password.html", mount: mountSetPasswordPage, protected : false},
=======
  "tournament/bracket": { file: "tournament-bracket.html", mount: initTournamentBracketPage, protected: false },
>>>>>>> refs/remotes/origin/main
};

// --------- ROUTER ---------

let ROUTING = false; // anti-réentrance
let CURRENT_UNMOUNT: (() => void) | null = null; // 🔹 unmount courant

export async function loadPage() {
  // 🔹 cleanup de l’ancienne page avant d’afficher la nouvelle
  try { CURRENT_UNMOUNT?.(); } catch (e) { console.warn("[unmount error]", e); }
  CURRENT_UNMOUNT = null;

  const key = routeFromLocation();
  const def = PAGE_MAP[key] ?? PAGE_MAP.home;

  // 🔹 s’assurer d’un access token frais + hydratation /me (dédupliquée)
  await ensureFreshAcces();
  await getMeOnce();

  if (def.protected) {
    let authed = !!currentUser();
    if (!authed) authed = await isAuthed();
    if (!authed) {
      await navigate("/login", true);
      return;
    }
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

  const keyElMap: Record<string, string> = {
    friends: "#friendSearchForm",
  };
  const keyEl = keyElMap[key];
  if (keyEl) await waitFor(keyEl);

  await Promise.resolve();
  await new Promise(requestAnimationFrame);

  try {
    const maybeUnmount = await def.mount?.();
    if (typeof maybeUnmount === "function") {
      CURRENT_UNMOUNT = maybeUnmount;
    }
  } catch (e) {
    console.error("[mount]", key, e);
  }

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
    // 🔹 avertit les pages (pour purger listeners, touches, etc.)
    window.dispatchEvent(new Event("page:leaving"));

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

// Bouton logout (menu header) — on ne touche plus au localStorage
document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest("#logoutBtn");
  if (!btn) return;
  e.preventDefault();
  try {
    await fetchWithAuth("/api/auth/logout", { method: "POST" });
  } catch {}
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
  bindGlobalMenuOnce();
  await initI18n();
  await ensureFreshAcces();
  await getMeOnce();   // précharge /me avant le premier mount
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
