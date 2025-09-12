export function mountRegisterHandlers() {
  const form = document.getElementById('registerForm') as HTMLFormElement | null;
  const msg = document.getElementById('registerMsg') as HTMLParagraphElement | null;
  if (!form) return;

  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  const setMsg = (t: string) => {if (msg) msg.textContent = t; };

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
      setMsg('Tous les champs sont requis.');
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
    } finally {
      submitBtn && (submitBtn.disabled = false);
    }
  });
}