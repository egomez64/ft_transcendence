import {t} from "../i18n";
import { makeSetMsg } from "./utils";

export function mountRegisterHandlers() {
  const form = document.getElementById('registerForm') as HTMLFormElement | null;
  const msg = document.getElementById('registerMsg') as HTMLParagraphElement | null;
  if (!form) return;

  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  const setMsg = makeSetMsg('#registerMsg');

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
      setMsg('login.required_fields', 'err');
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
    } finally {
      submitBtn && (submitBtn.disabled = false);
    }
  });
}