import { initI18n, setLang, lang, applyTranslations } from '../i18n';

function setupAuthMenu() {
  const btn = document.getElementById('authBtn') as HTMLAnchorElement | null;
  const menu = document.getElementById('authDropdown') as HTMLDivElement | null;
  const profils = document.getElementById('profilsLink') as HTMLAnchorElement | null;
  const logout = document.getElementById('logoutBtn') as HTMLButtonElement | null;
  if (!btn || !menu) return;

  const authed = isAuthed();

  // reset
  btn.onclick = null;
  document.removeEventListener('click', outsideCloser);
  document.removeEventListener('keydown', escCloser);

  if (!authed) {
    closeAuthDropdown();
    btn.setAttribute('href', '/login')
    btn.title = 'Connexion';
  } else {
    btn.setAttribute('href', '/');
    btn.title = 'Menu du compte';

    //CLICK BTN PROFIL
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation(); 

      const wasOpen = !menu.classList.contains('hidden');
      if (wasOpen) {
        closeAuthDropdown();
      } else {
        const langMenu = document.getElementById('lang-menu') as HTMLElement | null;
        const langBtn  = document.getElementById('lang-btn')  as HTMLElement | null;
        if (langMenu) langMenu.classList.add('hidden');
        if (langBtn)  langBtn.setAttribute('aria-expanded', 'false');

        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      }
    };

    // LIEN PROFIL
    if (profils) {
      profils.onclick = () => {
        closeAuthDropdown();
        history.pushState({}, '', '/profils');
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
    }

    // BOUTON LOGOUT
    if (logout) {
      logout.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('auth');
        closeAuthDropdown();
        setupAuthMenu();
        history.replaceState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
    }

    // FERMETURE : clic extérieur + ESC 
    document.addEventListener('click', outsideCloser);
    document.addEventListener('keydown', escCloser);
  }

  function outsideCloser(ev: MouseEvent) {
    const target = ev.target as Node;
    const wrapper = document.getElementById('authMenu');
    if (wrapper && !wrapper.contains(target)) closeAuthDropdown();
  }
  function escCloser(ev: KeyboardEvent) {
    if (ev.key === 'Escape') closeAuthDropdown();
  }

  // badge username dans le header
  renderAuthBadge();
}


// ---- Langue (existant) ----
function setupLangDropdown() {
  const dropdowns = [
    { btn: document.getElementById("lang-btn"), menu: document.getElementById("lang-menu") },
];

	const authMenu = document.getElementById("authDropdown") as HTMLElement | null;
	const	authBtn = document.getElementById("authBtn") as HTMLElement | null;

  function closeAll() {
    dropdowns.forEach(d => {
      if (d?.menu && d?.btn) {
        d.menu.classList.add("hidden");
        d.btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  dropdowns.forEach(d => {
    if (!d.btn || !d.menu) return;

    d.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

			if (authMenu) authMenu.classList.add("hidden");
			if (authBtn) authBtn.setAttribute("aria-expanded", "false");

      const isHidden = d.menu?.classList.contains("hidden");
      closeAll();
      if (isHidden) {
        d.menu?.classList.remove("hidden");
        d.btn?.setAttribute("aria-expanded", "true");
      }
    });

  d.menu.querySelectorAll<HTMLElement>('[data-lang]').forEach(el => {
    el.addEventListener('click', async () => {
      const code = el.getAttribute('data-lang')!;
      await setLang(code);
      const label = el.textContent?.trim();
      d.btn?.querySelector('[data-current-lang]')?.replaceChildren(document.createTextNode(label || code.toUpperCase()));
      closeAll();
    });
  });
});

  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}

// Menu auth (existant)
function closeAuthDropdown() {
  const btn = document.getElementById('authBtn');
  const menu = document.getElementById('authDropdown');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (menu) menu.classList.add('hidden');
}

function renderAuthBadge() {
  const span = document.getElementById('authUsername');
  if (!span) return;
  const user = currentUser();
  if (user?.username) {
    span.textContent = user.username;
    span.classList.remove('hidden');
  } else {
    span.textContent = '';
    span.classList.add('hidden');
  }
}

function currentUser(): { username?: string } | null {
  try { return JSON.parse(localStorage.getItem('auth') || 'null'); }
  catch { return null; }
}

function isAuthed(): boolean {
  try {
    const raw = localStorage.getItem('auth');
    return !!raw && !!JSON.parse(raw);
  } catch {
    return false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initI18n();
});

export {
  setupAuthMenu,
  closeAuthDropdown,
  renderAuthBadge,
  currentUser,
  isAuthed,
  setupLangDropdown,
};