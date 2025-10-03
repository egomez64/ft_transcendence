import { makeSetMsg, fetchWithAuth } from "./utils";

const AVATAR = {
  FALLBACK: '/assets/login.png',
};

function setMsg(el: HTMLElement | null, text: string, ok = false) {
  const target = (el as HTMLElement | null) ?? document.querySelector<HTMLElement>('#profileMsg');
  const _set = makeSetMsg(target || '#profileMsg');
  const type = ok === true ? 'ok' : ok === false ? 'err' : 'info';
  _set(text, type);
}

export async function mountProfileHandlers() {
  const form = document.getElementById('profileForm') as HTMLFormElement | null;
  const msg = document.getElementById('profileMsg') as HTMLParagraphElement | null;
  const avatarPreview = document.getElementById('profileAvatarPreview') as HTMLImageElement | null;
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  const emailIn = form.querySelector<HTMLInputElement>('input[name="email"]');
  const usernameIn = form.querySelector<HTMLInputElement>('input[name="username"]');
  const aliasIn = form.querySelector<HTMLInputElement>('input[name="alias"]');
  const avatarFileIn = form.querySelector<HTMLInputElement>('input[name="avatar"]');

  let user: any = null;
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) throw new Error("Not authenticated");
    const data = await res.json();
    if (!data.ok || !data.user) throw new Error("No user");
    user = data.user;
  } catch {
    history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }


  if (emailIn) { emailIn.value = user.email ?? ''; emailIn.disabled = true; }
  if (usernameIn) usernameIn.value = user.username ?? '';
  if (aliasIn) aliasIn.value = user.alias ?? '';
  if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;

  //preview
  avatarFileIn?.addEventListener('change', () => {
    const file = avatarFileIn.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      if (avatarPreview) avatarPreview.src = previewUrl;
    } else {
      if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;
    }
  });

  //submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('username', (usernameIn?.value || '').trim());
    formData.append('alias', (aliasIn?.value || '').trim() || '');
    if (avatarFileIn?.files?.[0]) {
      formData.append('avatar', avatarFileIn.files[0]);
    }

    setMsg(msg, "profile.saving");

    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status == 409) {
          const err = (data?.error || '').toLowerCase();
          if (err.includes('username')) {
            setMsg(msg, 'profile.username_taken', false);
            usernameIn?.focus();
            return;
          }
          if (err.includes('alias')) {
            setMsg(msg,'profile.alias_taken', false);
            aliasIn?.focus();
            return;
          }
        }
        setMsg(msg, data?.error || 'profile.update_error', false);
        return;
      }

      const updateUser = data?.user || {};
      if (usernameIn) usernameIn.value = updateUser.username ?? '';
      if (aliasIn) aliasIn.value = updateUser.alias ?? '';
      if (avatarPreview) avatarPreview.src = updateUser.avatar_url || AVATAR.FALLBACK;

      setMsg(msg, 'profile.saved', true);
      window.dispatchEvent(new CustomEvent('auth:changed'));
    } catch (err) {
      setMsg(msg, 'common.network_error', false);
    }
  });

  //reset
  const cancel = document.getElementById('profileCancel') as HTMLButtonElement | null;
  cancel?.addEventListener('click', () => {
    if (usernameIn) usernameIn.value = user.username ?? '';
    if (aliasIn) aliasIn.value = user.alias ?? '';
    if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;
    setMsg(msg, '');
  });
}