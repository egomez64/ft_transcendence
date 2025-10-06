// layout.ts — version corrigée (affichage du username/avatar + menu réactif sans localStorage)

import { fetchWithAuth } from "./utils";
import { t, applyTranslations } from "../i18n";

/* Sélecteurs du layout */
const SEL = {
  authMenu: "#authMenu",
  authBadgeName: "#authBadgeName",
  logoutBtn: "#logoutBtn",
  authAvatar: "#authAvatar", // ajouté pour gérer l’image du profil
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

export function isAuthed(): boolean {
  return !!AUTH_CACHE;
}

/* Gestion du menu de langue (inchangé) */
export function setupLangDropdown() {
  const btn = document.getElementById("langDropdownBtn");
  const menu = document.getElementById("langDropdownMenu");
  if (!btn || !menu) return;

  const openClass = "dropdown-open";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    menu.classList.toggle(openClass);
  });

  document.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest("#langDropdown")) menu.classList.remove(openClass);
    },
    { capture: true }
  );
}

/* --- Auth logic --- */

/** Recharge l'utilisateur depuis /api/auth/me et met à jour le cache */
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

/** Met à jour le nom et l'avatar dans le header */
export function renderAuthBadge() {
  const nameEl = document.querySelector(SEL.authBadgeName) as HTMLElement | null;
  const avatarEl = document.querySelector(SEL.authAvatar) as HTMLImageElement | null;
  const menuEl = document.querySelector(SEL.authMenu) as HTMLElement | null;

  if (!nameEl && !avatarEl && !menuEl) return;

  const u = currentUser();

  if (!u) {
    // Utilisateur non connecté → affichage du lien Login
    if (menuEl) {
      menuEl.innerHTML = `
        <a href="/login" class="text-pink-300 hover:text-pink-100 transition">
          ${t("login")}
        </a>`;
    }
    return;
  }

  // Utilisateur connecté → affichage nom + avatar + dropdown
  if (menuEl) {
    menuEl.innerHTML = `
      <div id="authDropdownTrigger" class="flex items-center gap-2 cursor-pointer select-none relative">
        <img id="authAvatar" src="${u.avatar_url || "/assets/login.png"}"
          alt="avatar" class="w-8 h-8 rounded-full object-cover border border-pink-400/40" />
        <span id="authBadgeName" class="font-semibold text-pink-200">${u.alias || u.username}</span>
      </div>
      <div id="authDropdown" class="hidden absolute mt-10 right-0 bg-[#1a1a2e]/95 rounded-lg shadow-lg border border-pink-500/20 py-2 w-40">
        <a href="/profils" class="block px-4 py-2 hover:bg-pink-500/10 text-pink-200">${t("profile")}</a>
        <button id="logoutBtn" class="block w-full text-left px-4 py-2 hover:bg-pink-500/10 text-pink-200">${t("logout")}</button>
      </div>
    `;

    applyTranslations(menuEl);
    setupDropdown();
  }
}

/** Gestion du dropdown utilisateur */
function setupDropdown() {
  const trigger = document.getElementById("authDropdownTrigger");
  const dropdown = document.getElementById("authDropdown");
  if (!trigger || !dropdown) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => dropdown.classList.add("hidden"));
}

/** Ferme le dropdown utilisateur */
export function closeAuthDropdown() {
  const dropdown = document.getElementById("authDropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

/** Met à jour tout le menu utilisateur (badge + logout listener) */
export async function setupAuthMenu() {
  await refreshAuth();
  renderAuthBadge();

  const logoutBtn = document.querySelector(SEL.logoutBtn) as HTMLButtonElement | null;
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "1";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetchWithAuth("/api/auth/logout", { method: "POST" });
      } catch {}
      AUTH_CACHE = null;
      window.dispatchEvent(new CustomEvent("auth:changed"));
    });
  }
}

/* --- Rafraîchit automatiquement le header quand l’auth change --- */
window.addEventListener("auth:changed", () => {
  setupAuthMenu();
});
