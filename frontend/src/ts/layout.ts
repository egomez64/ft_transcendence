// layout.ts — version synchronisée avec ton layout.html (langues + profil + logout)

import { fetchWithAuth } from "./utils";
import { t, applyTranslations, setLang } from "../i18n";

/* Sélecteurs du layout */
const SEL = {
  authBtn: "#authBtn",
  authUsername: "#authUsername",
  authAvatarImg: "#authBtn img",
  authDropdown: "#authDropdown",
  profilsLink: "#profilsLink",
  logoutBtn: "#logoutBtn",
  langBtn: "#langDropdownBtn",
  langMenu: "#langDropdownMenu",
};

/* Type utilisateur */
type Me = {
  id: number;
  username: string;
  email?: string;
  alias?: string;
  avatar_url?: string;
} | null;

/* Cache temporaire en mémoire */
let AUTH_CACHE: Me = null;

/* --- Fonctions exposées --- */
export function currentUser(): Me {
  return AUTH_CACHE;
}

export async function isAuthed(): Promise<boolean> {
  try {
    const res = await fetchWithAuth("/api/auth/me", {
      method: "GET",
      Credential: "include",
      cache: "no-store",
    });
    if(!res.ok) return false;
    const data = await res.json().catch(() => ({} as any));
    return !!data?.ok;
  } catch {
    return false;
  }
}

/* -------------------------------
   🗣️ MENU LANGUE
-------------------------------- */
export function setupLangDropdown() {
  const btn = document.querySelector(SEL.langBtn) as HTMLButtonElement | null;
  const menu = document.querySelector(SEL.langMenu) as HTMLElement | null;
  if (!btn || !menu) return;

  // Toggle d’ouverture
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  // Fermeture en cliquant ailleurs
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest("#langDropdown")) menu.classList.add("hidden");
  });

  // Sélection d'une langue
  menu.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const lang = (e.currentTarget as HTMLElement).dataset.lang;
      if (!lang) return;
      menu.classList.add("hidden");
      await setLang(lang);
      applyTranslations(document.body);
    });
  });
}

/* -------------------------------
   👤 AUTHENTIFICATION
-------------------------------- */

/** Recharge /api/auth/me et met à jour le cache */
async function refreshAuth(): Promise<Me> {
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) {
      AUTH_CACHE = null;
      return null;
    }
    const data = await res.json().catch(() => null);
    AUTH_CACHE = data?.user || null;
    return AUTH_CACHE;
  } catch {
    AUTH_CACHE = null;
    return null;
  }
}

/** Met à jour le header utilisateur sans recréer le HTML */
export function renderAuthBadge() {
  const user = AUTH_CACHE;
  const usernameEl = document.querySelector(SEL.authUsername) as HTMLElement | null;
  const avatarEl = document.querySelector(SEL.authAvatarImg) as HTMLImageElement | null;
  const authBtn = document.querySelector(SEL.authBtn) as HTMLAnchorElement | null;
  const dropdown = document.querySelector(SEL.authDropdown) as HTMLElement | null;

  if (!usernameEl || !authBtn || !avatarEl || !dropdown) return;

  if (!user) {
    // Non connecté
    usernameEl.classList.add("hidden");
    avatarEl.src = "/assets/login.png";
    authBtn.setAttribute("href", "/login");
    dropdown.classList.add("hidden");
    return;
  }

  // Connecté
  usernameEl.textContent = user.alias || user.username;
  usernameEl.classList.remove("hidden");
  avatarEl.src = user.avatar_url || "/assets/login.png";
  authBtn.setAttribute("href", "javascript:void(0)");
}

/** Active le dropdown profil/logout */
function setupAuthDropdown() {
  const authBtn = document.querySelector(SEL.authBtn) as HTMLElement | null;
  const dropdown = document.querySelector(SEL.authDropdown) as HTMLElement | null;
  if (!authBtn || !dropdown) return;

  authBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest("#authMenu")) dropdown.classList.add("hidden");
  });
}

/** Gère le bouton logout */
function setupLogout() {
  const logoutBtn = document.querySelector(SEL.logoutBtn) as HTMLButtonElement | null;
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await fetchWithAuth("/api/auth/logout", { method: "POST" });
    } catch {}
    AUTH_CACHE = null;
    window.dispatchEvent(new CustomEvent("auth:changed"));
  });
}

/** Gère le lien profil */
function setupProfileLink() {
  const profilsLink = document.querySelector(SEL.profilsLink) as HTMLAnchorElement | null;
  if (!profilsLink) return;
  profilsLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.history.pushState({}, "", "/profils");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

/* -------------------------------
   🚀 INITIALISATION GLOBALE
-------------------------------- */
export async function setupAuthMenu() {
  await refreshAuth();
  renderAuthBadge();
  setupAuthDropdown();
  setupLogout();
  setupProfileLink();
  setupLangDropdown();
}

/** Ferme le dropdown utilisateur manuellement */
export function closeAuthDropdown() {
  const dropdown = document.querySelector(SEL.authDropdown) as HTMLElement | null;
  if (dropdown) dropdown.classList.add("hidden");
}

/** Réagit à tout changement d’auth */
window.addEventListener("auth:changed", () => {
  setupAuthMenu();
});

document.addEventListener("DOMContentLoaded", () => {
  setupLangDropdown();
});
