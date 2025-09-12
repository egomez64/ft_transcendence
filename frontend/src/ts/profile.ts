<<<<<<< HEAD
import { makeSetMsg } from "./utils";

=======
>>>>>>> pong
//politique avatar
const AVATAR = {
  FALLBACK: '/assets/login.png',
  MAX_URL_LEN: 1000,
  ALLOWED_PROTOCOLS: new Set<'http:' | 'https:'>(['http:', 'https']),
  EXT_WHITELIST: /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i,
  //bloque ip/localhost 
  BLOCK_HOST_RE: /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)$/i,
};

//utils
function pageIsHttps() {
  return location.protocol === 'https:';
}

function setMsg(el: HTMLElement | null, text: string, ok = false) {
<<<<<<< HEAD
  const target = (el as HTMLElement | null ) ?? document.querySelector<HTMLElement>('#profileMsg');
  const _set = makeSetMsg(target || '#profileMsg');
  const type = ok === true ? 'ok' : ok === false ? 'err' : 'info';
  _set(text, type);
=======
  if (!el) return;
  el.textContent = text;
  el.setAttribute('style', `color:${ok ? '#a7f3d0' : '#fbcfe8'}`);
>>>>>>> pong
}

function markError(input: HTMLInputElement | null, on: boolean) {
  if (!input) return;
  input.classList.toggle('ring-2', on);
  input.classList.toggle('ring-red-500', on);
}

function parseUrlSafe(raw: string): URL | null {
  try { return new URL(raw); }
  catch { return null; }
}

function isAllowedUrl(u: URL): string | true {
  const proto = u.protocol.toLowerCase();

  // Protocoles autorisés
  if (!(proto === 'http:' || proto === 'https:')) {
    return "Protocole non autorisé (http ou https uniquement).";
  }

  // https obligatoire si ta page est servie en https
  if (location.protocol === 'https:' && proto !== 'https:') {
    return "En HTTPS, l'avatar doit être en https://";
  }

  // Hôtes interdits (localhost, LAN…)
  if (AVATAR.BLOCK_HOST_RE.test(u.hostname)) {
    return "Hôte interdit (IP/localhost).";
  }

  // Longueur max
  if (u.href.length > AVATAR.MAX_URL_LEN) {
    return "URL trop longue.";
  }

  // Extension indicative
  if (!AVATAR.EXT_WHITELIST.test(u.pathname)) {
    return true; // tolérant : avertir mais pas bloquer
  }

  return true;
}

//Test changement d'image

function testImage(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const t = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      img.src = '';
      resolve(false);
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      resolve(true);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      resolve(false);
    };

    //cache-buster (evite le 404 cache)
    const sep = url.includes('?') ? '&' : '?';
    img.src = url + sep + '_cb=' + Date.now();
  });
}

// Integration 

export function mountProfileHandlers() {
  const form = document.getElementById('profileForm') as HTMLFormElement | null;
  const msg = document.getElementById('profileMsg') as HTMLParagraphElement | null;
  const avatarPreview = document.getElementById('profileAvatarPreview') as HTMLImageElement | null;
  if (!form) return;
  if (form.dataset.bound === '1') return; //evite le double binding
  form.dataset.bound = '1';

  const emailIn     = form.querySelector<HTMLInputElement>('input[name="email"]');
  const usernameIn  = form.querySelector<HTMLInputElement>('input[name="username"]');
  const aliasIn     = form.querySelector<HTMLInputElement>('input[name="alias"]');
  const avatarUrlIn = form.querySelector<HTMLInputElement>('input[name="avatar_url"]');

  let user: any = null;
  try { user = JSON.parse(localStorage.getItem('auth') || 'null'); } catch {}
<<<<<<< HEAD
  if (!user) { 
    history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
=======
  if (!user) { location.replace('#login'); return; }
>>>>>>> pong

  //email lecture seule
  if (emailIn) { emailIn.value = user.email ?? ''; emailIn.disabled = true; }
  if (usernameIn) usernameIn.value = user.username ?? '';
  if (aliasIn) aliasIn.value = user.alias ?? '';
  if (avatarUrlIn) avatarUrlIn.value = user.avatar_url ?? '';

  //preview
  if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;

  //verif
  let debounceTimer: number | undefined;

  async function applyAvatar(raw: string) {
    const val = (raw || '').trim();
    if (!val) {
      if (avatarPreview) avatarPreview.src = AVATAR.FALLBACK;
      markError(avatarUrlIn, false);
      setMsg(msg, '', true);
      return;
    }

    const parsed = parseUrlSafe(val);
    if (!parsed) {
      if (avatarPreview) avatarPreview.src = AVATAR.FALLBACK;
      markError(avatarUrlIn, true);
<<<<<<< HEAD
      setMsg(msg, "profile.avatar.invalid_scheme", false);
=======
      setMsg(msg, "URL invalide (utilise http(s)://..)", false);
>>>>>>> pong
      return;
    }

    const allow = isAllowedUrl(parsed);
    if (allow !== true) {
      if (avatarPreview) avatarPreview.src = AVATAR.FALLBACK;
      markError(avatarUrlIn, true);
      setMsg(msg, allow, false);
      return;
    }

    //test reel
<<<<<<< HEAD
    setMsg(msg, "profile.avatar.checking", true);
=======
    setMsg(msg, "Verification de l'image...", true);
>>>>>>> pong
    markError(avatarUrlIn, false);

    const ok = await testImage(parsed.href, 5000);
    if (ok) {
      if (avatarPreview) avatarPreview.src = parsed.href;
      markError(avatarUrlIn, false);
<<<<<<< HEAD
      setMsg(msg, "profile.avatar.updated", true);
    } else {
      if (avatarPreview) avatarPreview.src = AVATAR.FALLBACK;
      markError(avatarUrlIn, true);
      setMsg(msg, "profile.avatar.fetch_error", false);
=======
      setMsg(msg, "Avatar mis a jour", true);
    } else {
      if (avatarPreview) avatarPreview.src = AVATAR.FALLBACK;
      markError(avatarUrlIn, true);
      setMsg(msg, "Impossible de charger l'image a cette URL.", false);
>>>>>>> pong
    }
  }

  avatarUrlIn?.addEventListener('input', () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => applyAvatar(avatarUrlIn!.value), 350);
  });
  avatarUrlIn?.addEventListener('blur', () => applyAvatar(avatarUrlIn!.value));

  //submit
  form.addEventListener('submit', async(e) => {
    e.preventDefault();

    const newAvatar = (avatarUrlIn?.value || '').trim();
    if (newAvatar) {
      const parsed = parseUrlSafe(newAvatar);
      const allow = parsed && isAllowedUrl(parsed as URL);
      if (!parsed || allow !== true || !(await testImage(parsed.href, 3000))) {
        markError(avatarUrlIn, true);
<<<<<<< HEAD
        setMsg(msg, "profile.avatar.invalid_url", false);
=======
        setMsg(msg, "L'URL d'avatar n'est pas valide", false);
>>>>>>> pong
        avatarUrlIn?.focus();
        return;
      }
    }

    // maj user
    const updated = {
      ...user,
      username: (usernameIn?.value || '').trim(),
      alias:    (aliasIn?.value || '').trim() || null,
      avatar_url: newAvatar || null,
    };
<<<<<<< HEAD
    setMsg(msg, "profile.saving");
=======
    setMsg(msg, "Sauvegarde...");
>>>>>>> pong

    //appel API
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', //utile pour cookie
        body: JSON.stringify(updated),
      });

      const data = await res.json().catch(() => ({}));

      //gestion erreur

      if (!res.ok) {
        markError(usernameIn, false);
        markError(aliasIn, false);

        //conflits (username/alias pris)
        if (res.status === 409) {
          const err = (data?.error || '').toLowerCase();
          if (err.includes('username')) {
            markError(usernameIn, true);
<<<<<<< HEAD
            setMsg(msg, 'profile.username_taken', false);
=======
            setMsg(msg, 'Ce nom d’utilisateur est déjà pris.', false);
>>>>>>> pong
            usernameIn?.focus();
            return;
          }
          if (err.includes('alias')) {
            markError(aliasIn, true);
<<<<<<< HEAD
            setMsg(msg, 'profile.alias_taken', false);
=======
            setMsg(msg, 'Cet alias est déjà pris.', false);
>>>>>>> pong
            aliasIn?.focus();
            return;
          }
        }

        //erreur de validation
        if (res.status === 400 && Array.isArray(data?.details) && data.details.length) {
          setMsg(msg, data.details[0], false);
          //surligner
          if (String(data.details[0]).toLowerCase().includes('username')) {
            markError(usernameIn, true);
            usernameIn?.focus();
          }
          if (String(data.details[0]).toLowerCase().includes('alias')) {
            markError(aliasIn, true);
            aliasIn?.focus();
          }
          return;
        }

<<<<<<< HEAD
        setMsg(msg, data?.error || 'profile.update_error', false);
=======
        setMsg(msg, data?.error || 'Erreur lors de la mise à jour.', false);
>>>>>>> pong
        return;
      }

    //succes on recupere l'utilisateur
    const updateUser = data?.user || {};
    if (usernameIn) usernameIn.value = updateUser.username ?? updated.username;
    if (aliasIn) aliasIn.value = updateUser.alias ?? (updated.alias || '');
    if (avatarUrlIn) avatarUrlIn.value = updateUser.avatar_url ?? (updated.avatar_url || '');
    const avatarPreview = document.getElementById('profileAvatarPreview') as HTMLImageElement | null;
    if (avatarPreview) avatarPreview.src = updateUser.avatar_url || AVATAR.FALLBACK;

    //maj du localstorage
    const next = { ...user, ...updateUser};
    localStorage.setItem('auth', JSON.stringify(next));

    //feedback global event
<<<<<<< HEAD
    setMsg(msg, 'profile.saved', true);
    window.dispatchEvent(new CustomEvent('auth:changed'));
    }
    catch (err) {
      setMsg(msg, 'common.network_error', false);
=======
    setMsg(msg, '✅ Sauvegardé !', true);
    window.dispatchEvent(new CustomEvent('auth:changed'));
    }
    catch (err) {
      setMsg(msg, 'Erreur reseau.', false);
>>>>>>> pong
    }
  });
  
  //reset bouton
  const cancel = document.getElementById('profileCancel') as HTMLButtonElement | null;
  cancel?.addEventListener('click', () => {
    if (usernameIn) usernameIn.value = user.username ?? '';
    if (aliasIn)    aliasIn.value = user.alias ?? '';
    if (avatarUrlIn) avatarUrlIn.value = user.avatar_url ?? '';
    if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;
    markError(avatarUrlIn, false);
    setMsg(msg, '');
  });
}