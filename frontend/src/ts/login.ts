import { makeSetMsg } from "./utils";
import { initI18n, setLang, applyTranslations } from "../i18n";

export function mountLoginHandlers() {
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
}