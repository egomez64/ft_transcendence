import { makeSetMsg } from "./utils";
import { initI18n, setLang, applyTranslations, t } from "../i18n";

/*export function mountLoginHandlers() {
  if (handleOAuthRedirectFromGoogle()) return;
  if (localStorage.getItem('auth')) {
    // déjà connecté   pas de formulaire
    location.replace('#dashboard');
    return;
  }
  const form = document.getElementById('loginForm') as HTMLFormElement | null;
  if (!form) return;
  const setMsg = makeSetMsg('#loginMsg');
  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  const googleBtn = document.getElementById('googleLoginBtn');
  if (googleBtn) {
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'http://localhost:3000/api/auth/google';
      });
    }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn && (btn.disabled = true);

    const data = new FormData(form);
    const payload = {
      username: String(data.get('username') || '').trim(),
      password: String(data.get('password') || ''),
    };

    if (!payload.username || !payload.password) {
      setMsg('login.required_fields', 'err');
      btn && (btn.disabled = false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setMsg(body?.error || `Erreur ${res.status}`, 'err');
        btn && (btn.disabled = false);
        return;
      }
      localStorage.setItem('auth', JSON.stringify(body.user));
      window.dispatchEvent(new CustomEvent('auth:changed'));
      setMsg('login.succes', 'ok');
      setTimeout(() => { 
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 600);
    } catch (err: any) {
      setMsg(err?.message || 'common.network_error', 'err');
      btn && (btn.disabled = false);
    }
  }, { once: true });
}

function clearQuery() {
  const { protocol, host, pathname, hash } = window.location;
  const clean = `${protocol}//${host}${pathname}${hash || ''}`;
  window.history.replaceState({}, '', clean);
}

function  handleOAuthRedirectFromGoogle(): boolean {
  const params = new URLSearchParams(window.location.search);
  const ok = params.get('ok');
  const provider = params.get('provider');

  if ( ok === '1' && provider === 'google') {
    const id = Number(params.get('id') || '0');
    const username = params.get('username') || '';
    const email = params.get('email') || '';

    if (id && username && email) {
      const user = { id, username, email };
      localStorage.setItem('auth', JSON.stringify(user));
      clearQuery();
      history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return true;
    }
  }
  return false;
}

export function initLoginPage() {
  if (handleOAuthRedirectFromGoogle()) return;

  const googleBtn = document.getElementById('googleLoginBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // on navvigue on fetch opar pour preserver le state
      window.location.href = 'http://localhost:3000/api/auth/google';
    });
  }

  //si deja log 
  const saved = localStorage.getItem('auth');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user?.id) {
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch {}
  }
}*/

const API_BASE =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '';

function showTwofaPanel(infoText?: string) {
  const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
  const twofaForm = document.getElementById("twofaForm") as HTMLFormElement | null;
  const twofaMsg = document.getElementById("twofaMsg") as HTMLParagraphElement | null;
  const codeInput = document.getElementById("twofaCode") as HTMLInputElement | null;

  if (loginForm) loginForm.classList.add("hidden");
  if (twofaForm) twofaForm.classList.remove("hidden");
  if (twofaMsg && infoText) twofaMsg.textContent = infoText;

  setTimeout(() => codeInput?.focus(), 0);
}

function hideTwofaPanel() {
  const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
  const twofaForm = document.getElementById("twofaForm") as HTMLFormElement | null;
  if (twofaForm) twofaForm.classList.add("hidden");
  if (loginForm) loginForm.classList.remove("hidden");
}

export function mountLoginHandlers() {
  const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
  const twofaForm = document.getElementById("twofaForm") as HTMLFormElement | null;
  const twofaMsg = document.getElementById("twofaMsg") as HTMLParagraphElement | null;
  const twofaResendBtn = document.getElementById("twofaResendBtn") as HTMLButtonElement | null;
  const twofaBackBtn = document.getElementById("twofaBackBtn") as HTMLButtonElement | null;
  const googleBtn = document.getElementById("googleLoginBtn") as HTMLButtonElement | null;

  const setMsg = makeSetMsg("#loginMsg");

  // ⚠️ Patch : neutraliser l’action native du formulaire
  if (loginForm) {
    loginForm.setAttribute("action", "");
    loginForm.setAttribute("method", "post");
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      window.location.assign(`${API_BASE}/api/auth/google`);
    });
  }

  // ---- Étape 1 : LOGIN ----
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(loginForm);
    const payload = {
      username: String(data.get("username") || "").trim(),
      password: String(data.get("password") || ""),
    };

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // important pour les cookies
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({} as any));

      if (!res.ok || !body.ok) {
        setMsg(body?.error || `Erreur ${res.status}`, "err");
        return;
      }

      if (body.step === "2fa_required") {
        showTwofaPanel("Un code vous a été envoyé par e-mail.");
        return;
      }

      if (body.user) {
        localStorage.setItem("auth", JSON.stringify(body.user));
        window.dispatchEvent(new CustomEvent("auth:changed"));
        history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch (err: any) {
      setMsg(err?.message || "Erreur réseau", "err");
    }
  });

  // ---- Étape 2 : VERIFY ----
  twofaForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(twofaForm);
    const code = String(data.get("code") || "").trim();

    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({} as any));

      if (!res.ok || !body.ok) {
        if (twofaMsg) twofaMsg.textContent = body?.error || `Erreur ${res.status}`;
        return;
      }

      localStorage.setItem("auth", JSON.stringify(body.user));
      window.dispatchEvent(new CustomEvent("auth:changed"));
      history.pushState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err: any) {
      if (twofaMsg) twofaMsg.textContent = err?.message || "Erreur réseau";
    }
  });

  // ---- Renvoyer code ----
  twofaResendBtn?.addEventListener("click", async () => {
    try {
      twofaResendBtn.disabled = true;
      const res = await fetch(`${API_BASE}/api/auth/2fa/resend`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok || !body.ok) {
        if (twofaMsg) twofaMsg.textContent = body?.error || `Erreur ${res.status}`;
      } else {
        if (twofaMsg) twofaMsg.textContent = "Code renvoyé.";
      }
    } finally {
      setTimeout(() => {
        twofaResendBtn.disabled = false;
      }, 15000);
    }
  });

  // ---- Retour ----
  twofaBackBtn?.addEventListener("click", () => {
    hideTwofaPanel();
  });
}