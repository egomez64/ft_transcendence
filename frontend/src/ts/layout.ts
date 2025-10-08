// layout.ts — version synchronisée avec ton layout.html (langues + profil + logout)

import { fetchWithAuth } from "./utils";
import { applyTranslations, setLang } from "../i18n";

/* ============================================================================
 *  Sélecteurs du layout (IDs et sous-sélecteurs utilisés partout)
 * ==========================================================================*/
const SEL = {
  // Auth (avatar / bouton / dropdown)
  authBtn: "#authBtn",
  authDropdown: "#authDropdown",
  authMenuRoot: "#authMenu",

  // Langues (bouton globe / menu / conteneur)
  langBtn: "#langDropdownBtn",
  langMenu: "#langDropdownMenu",
  langRoot: "#langDropdown",

  // Liens / éléments internes
  profilsLink: "#profilsLink",
  logoutBtn: "#logoutBtn",
  authUsername: "#authUsername",
  authAvatarImg: "#authBtn img",
};

/* ============================================================================
 *  Types & état
 * ==========================================================================*/

/** Représentation minimale de l'utilisateur pour le header. */
type Me = {
  id: number;
  username: string;
  email?: string;
  alias?: string;
  avatar_url?: string;
} | null;

/** Cache mémoire de l'utilisateur courant (pour éviter de refetch en boucle). */
let AUTH_CACHE: Me = null;

/* ============================================================================
 *  API publique minimaliste
 * ==========================================================================*/

/** Renvoie l'utilisateur courant (depuis le cache mémoire). */
export function currentUser(): Me {
  return AUTH_CACHE;
}

/**
 * Vérifie l'authentification en interrogeant /api/auth/me.
 * Renvoie true/false (jamais d'exception).
 */
export async function isAuthed(): Promise<boolean> {
  try {
    const res = await fetchWithAuth("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({} as any));
    return !!data?.ok;
  } catch {
    return false;
  }
}

/* ============================================================================
 *  Auth — helpers privés
 * ==========================================================================*/

/**
 * Recharge /api/auth/me et met à jour le cache AUTH_CACHE.
 * Ne jette pas d'exception — renvoie toujours Me | null.
 */
async function refreshAuth(): Promise<Me> {
  try {
    const res = await fetchWithAuth("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
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

/**
 * Met à jour les éléments du header (pseudo, avatar, href, état du dropdown)
 * sans recréer le HTML.
 */
export function renderAuthBadge() {
  const user = AUTH_CACHE;

  const usernameEl = document.querySelector(SEL.authUsername) as HTMLElement | null;
  const avatarEl = document.querySelector(SEL.authAvatarImg) as HTMLImageElement | null;
  const authBtn = document.querySelector(SEL.authBtn) as HTMLAnchorElement | null;
  const dropdown = document.querySelector(SEL.authDropdown) as HTMLElement | null;

  if (!usernameEl || !authBtn || !avatarEl || !dropdown) return;

  // État déconnecté
  if (!user) {
    usernameEl.classList.add("hidden");
    usernameEl.removeAttribute("title");
    avatarEl.src = "/assets/login.png";
    authBtn.setAttribute("href", "/login");
    authBtn.setAttribute("aria-expanded", "false");
    dropdown.classList.add("hidden");
    return;
  }

  // État connecté
  const label = user.alias || user.username;
  usernameEl.textContent = label;
  usernameEl.title = label;
  usernameEl.classList.remove("hidden");
  avatarEl.src = user.avatar_url || "/assets/login.png";

  // Désactive la nav native quand connecté (le clic ouvre le menu)
  authBtn.setAttribute("href", "javascript:void(0)");
  authBtn.setAttribute("aria-expanded", "false");
}

/* ============================================================================
 *  Menus — délégation d'événements (un seul binder global)
 * ==========================================================================*/

let MENUS_BOUND = false;

/**
 * Binder global (idempotent) pour gérer d'un seul coup :
 * - l'ouverture/fermeture du menu profil (#authDropdown)
 * - l'ouverture/fermeture du menu langue (#langDropdownMenu)
 * - la sélection d'une langue
 * - le lien "Profil" et le bouton "Logout"
 * - la fermeture des menus au clic à l'extérieur
 */
export function bindGlobalMenuOnce() {
  if (MENUS_BOUND) return;
  MENUS_BOUND = true;

  document.addEventListener("click", async (e) => {
    const el = e.target as HTMLElement;

    // Pointeurs vers les menus (re-sélectionnés à chaque clic car le DOM peut être remplacé)
    const authMenu = document.querySelector(SEL.authDropdown) as HTMLElement | null;
    const langMenu = document.querySelector(SEL.langMenu) as HTMLElement | null;

    // Zones de "root" (pour savoir si on a cliqué dedans ou dehors)
    const inAuthRoot = !!el.closest(SEL.authMenuRoot);
    const inLangRoot = !!el.closest(SEL.langRoot);

    // Helpers de visibilité (lisibles)
    const showAuth = () => authMenu?.classList.remove("hidden");
    const hideAuth = () => authMenu?.classList.add("hidden");
    const toggleAuth = () => authMenu?.classList.toggle("hidden");

    const showLang = () => langMenu?.classList.remove("hidden");
    const hideLang = () => langMenu?.classList.add("hidden");
    const toggleLang = () => langMenu?.classList.toggle("hidden");

    // 1) Clic sur le bouton avatar / compte
    if (el.closest(SEL.authBtn)) {
      if (!AUTH_CACHE) {
        // Déconnecté: laisser <a href="/login"> gérer la navigation
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      toggleAuth();
      hideLang(); // ferme l'autre menu
      return;
    }

    // 2) Clic sur le bouton globe (langues)
    if (el.closest(SEL.langBtn)) {
      e.preventDefault();
      e.stopPropagation();
      toggleLang();
      hideAuth();
      return;
    }

    // 3) Sélection d'une langue
    const item = el.closest(`${SEL.langMenu} [data-lang]`) as HTMLElement | null;
    if (item) {
      const lang = item.dataset.lang;
      hideLang();
      if (lang) {
        await setLang(lang);
        applyTranslations(document.body);
      }
      return;
    }

    // 4) Lien "Profil"
    if (el.closest(SEL.profilsLink)) {
      e.preventDefault();
      hideAuth();
      window.history.pushState({}, "", "/profils");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    // 5) Bouton "Logout"
    if (el.closest(SEL.logoutBtn)) {
      e.preventDefault();
      try { await fetchWithAuth("/api/auth/logout", { method: "POST" }); } catch {}
      AUTH_CACHE = null;
      hideAuth();
      window.dispatchEvent(new CustomEvent("auth:changed"));
      return;
    }

    // 6) Clic en dehors des racines → fermer les menus
    if (!inAuthRoot) hideAuth();
    if (!inLangRoot) hideLang();
  });
}

/* ============================================================================
 *  Initialisation et utilitaires
 * ==========================================================================*/

/**
 * Met à jour l'état d'auth et rafraîchit l'affichage du badge utilisateur.
 * Idempotent et sûr à rappeler après chaque navigation / changement d'auth.
 */
export async function setupAuthMenu() {
  await refreshAuth();
  renderAuthBadge();
}

/** Ferme explicitement le dropdown utilisateur (utilisé par d'autres modules). */
export function closeAuthDropdown() {
  const dropdown = document.querySelector(SEL.authDropdown) as HTMLElement | null;
  if (dropdown) dropdown.classList.add("hidden");
}

/** Re-render du header à tout changement d'auth (login/2FA OK/logout). */
window.addEventListener("auth:changed", () => {
  setupAuthMenu();
});

setInterval(async () => {
  try {
    await fetchWithAuth('/api/auth/ping', { method: 'POST' });
  } catch {
  }
}, 60000);
