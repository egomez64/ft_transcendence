<<<<<<< HEAD
import {t} from "../i18n";
import { makeSetMsg } from "./utils";

=======
>>>>>>> pong
export function mountRegisterHandlers() {
  const form = document.getElementById('registerForm') as HTMLFormElement | null;
  const msg = document.getElementById('registerMsg') as HTMLParagraphElement | null;
  if (!form) return;

  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
<<<<<<< HEAD

  const setMsg = makeSetMsg('#registerMsg');
=======
  const setMsg = (t: string) => {if (msg) msg.textContent = t; };
>>>>>>> pong

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn && (submitBtn.disabled = true);

    const data = new FormData(form);
    const payload = {
      email: String(data.get('email') || '').trim(),
      username: String(data.get('username') || '').trim(),
      password: String(data.get('password') || ''),
    };

    if (!payload.email || !payload.username || !payload.password) {
<<<<<<< HEAD
      setMsg('login.required_fields', 'err');
=======
      setMsg('Tous les champs sont requis.');
>>>>>>> pong
      submitBtn && (submitBtn.disabled = false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
<<<<<<< HEAD
        if (Array.isArray(body?.details) && body?.error_key) {
          const text = body.details.map((k: string) => t(k)).join('\n');
          setMsg(text || body.error_key, 'err');
        } else {
          setMsg(body?.error_key || body?.error || `Erreur ${res.status}`, 'err');
        }
        return;
    }

      setMsg('register.succes', 'ok');
      setTimeout(() => {
        history.pushState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 700);
    } catch (err: any) {
      setMsg(err?.message || 'common.network_error', 'err');
=======
        const msg = body?.error === 'Weak password' && Array.isArray(body?.details)
          ? body.details.join(' ')
          : (body?.error || `Erreur ${res.status}`);
        setMsg(msg);
        return;
    }

      setMsg('Compte créé ! Redirection…');
      setTimeout(() => { location.hash = '#login'; }, 700);
    } catch (err: any) {
      setMsg(err?.message || 'Erreur réseau');
>>>>>>> pong
    } finally {
      submitBtn && (submitBtn.disabled = false);
    }
  });
}