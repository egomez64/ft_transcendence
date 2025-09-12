<<<<<<< HEAD
import { makeSetMsg } from "./utils";
import { initI18n, setLang, applyTranslations } from "../i18n";

export function mountLoginHandlers() {
  if (handleOAuthRedirectFromGoogle()) return;
  if (localStorage.getItem('auth')) {
    // déjà connecté   pas de formulaire
=======
export function mountLoginHandlers() {
  if (localStorage.getItem('auth')) {
    // déjà connecté -> pas de formulaire
>>>>>>> pong
    location.replace('#dashboard');
    return;
  }
  const form = document.getElementById('loginForm') as HTMLFormElement | null;
  if (!form) return;
<<<<<<< HEAD
  const setMsg = makeSetMsg('#loginMsg');
  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  const googleBtn = document.getElementById('googleLoginBtn');
  if (googleBtn) {
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'http://localhost:3000/api/auth/google';
      });
    }
=======
  const msg = document.getElementById('loginMsg') as HTMLParagraphElement | null;
  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

>>>>>>> pong
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn && (btn.disabled = true);

    const data = new FormData(form);
    const payload = {
      username: String(data.get('username') || '').trim(),
      password: String(data.get('password') || ''),
    };

    if (!payload.username || !payload.password) {
<<<<<<< HEAD
      setMsg('login.required_fields', 'err');
=======
      msg && (msg.textContent = 'Champs requis.');
>>>>>>> pong
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
<<<<<<< HEAD
        setMsg(body?.error || `Erreur ${res.status}`, 'err');
=======
        msg && (msg.textContent = body.error || `Erreur ${res.status}`);
>>>>>>> pong
        btn && (btn.disabled = false);
        return;
      }
      localStorage.setItem('auth', JSON.stringify(body.user));
<<<<<<< HEAD
      window.dispatchEvent(new CustomEvent('auth:changed'));
      setMsg('login.succes', 'ok');
      setTimeout(() => { 
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 600);
    } catch (err: any) {
      setMsg(err?.message || 'common.network_error', 'err');
=======
      // NOUVEAU signale au layout que l’état a changé
      window.dispatchEvent(new CustomEvent('auth:changed'));
      msg && (msg.textContent = 'Connexion réussie !');
      setTimeout(() => { location.hash = '#dashboard'; }, 600);
    } catch (err: any) {
      msg && (msg.textContent = err?.message || 'Erreur réseau');
>>>>>>> pong
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
<<<<<<< HEAD
      history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
=======
      window.location.hash = '#dashboard';
>>>>>>> pong
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
<<<<<<< HEAD
      window.location.href = 'http://localhost:3000/api/auth/google';
=======
      window.location.href = 'http://localhost:300/api/auth/google';
>>>>>>> pong
    });
  }

  //si deja log 
  const saved = localStorage.getItem('auth');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user?.id) {
<<<<<<< HEAD
        history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
=======
        window.location.hash = '#dashboard';
>>>>>>> pong
      }
    } catch {}
  }
}