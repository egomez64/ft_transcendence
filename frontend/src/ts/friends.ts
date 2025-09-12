import { t, applyTranslations } from "../i18n";
import { makeSetMsg } from "./utils";

type ErrorWithParams = Error & { _params?: Record<string, any> };

type Friend = {
  id: number;
  username: string;
  alias: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
};

const API = 'http://localhost:3000';

const state = {
  friends: [] as Friend[],
}

async function waitEl<T extends HTMLElement = HTMLElement>(sel: string, tries = 10): Promise<T> {
  let el = document.querySelector<T>(sel);
  if (el) return el;
  return await new Promise<T>((resolve, reject) => {
    const check = () => {
      el = document.querySelector<T>(sel);
      if (el) return resolve(el);
      if (tries-- <= 0) return reject(new Error(`Element not found after mount: ${sel}`));
      requestAnimationFrame(check);
    };
    check();
  });
}

function getEl<T extends HTMLElement = HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

const setMsg = makeSetMsg('#friendsMsg');

async function listFriends(): Promise<Friend[]> {
  const res = await fetch(`${API}/api/me/friends?limit=50&offset=0`, {
    credentials: 'include'
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('auth.must_login');
    throw new Error(t('friends.load_error'));
  }
  const data = await res.json();
  return data.friends || [];
}

async function addFriend(handle: string) {
  const res = await fetch(`${API}/api/me/friends`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friend: handle })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_key || data?.error || 'friends.add_error';
    const err: ErrorWithParams = new Error(msg);
    err._params = data?.params || {};
    throw err;
  }
  return data as { ok: true; friend: Friend; already?: boolean };
}

async function removeFriend(id: number) {
  const res = await fetch(`${API}/api/me/friends/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_key || data?.error || 'friends.remove_error';
    const err: ErrorWithParams = new Error(msg);
    err._params = data?.params || {};
    throw err;
  }
  return data as { ok: true; removed: number };
}

function renderFriends(items: Friend[]) {
  const ul = getEl<HTMLUListElement>('#friendsList');
  if (!ul) return;
  ul.innerHTML = '';

  if (!items.length) {
    ul.innerHTML = `<li class="p-4 text-pink-200/80" data-i18n="friends.empty">Aucun ami pour l’instant.</li>`;
    applyTranslations(ul);
    return;
  }

  for (const f of items) {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-3 p-3';

    const img = document.createElement('img');
    img.src = f.avatar_url || 'https://via.placeholder.com/40?text=?';
    img.alt = f.username;
    img.width = 40;
    img.height = 40;
    img.className = 'rounded-full object-cover w-10 h-10';

    const info = document.createElement('div');
    info.className = 'flex-1';
    info.innerHTML = `
      <div class="font-semibold">${f.username}</div>
      <div class="text-sm text-pink-200/80">${f.alias ?? ''}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'px-3 py-1 rounded-md border border-pink-500/40 hover:bg-pink-500/10 transition';
    btn.textContent = t('friends.remove');
    btn.addEventListener('click', async () => {
      try {
        await removeFriend(f.id);
        state.friends = state.friends.filter(x => x.id !== f.id);
        renderFriends(state.friends);
        setMsg('friends.removed', 'ok', {name: f.username});
        listFriends().then(srv => { state.friends = srv; renderFriends(state.friends); }).catch(() => {});
      } catch (e:any) {
        setMsg(e.message || 'common.network_error', 'err', e?._params);
      }
    });

    li.append(img, info, btn);
    ul.appendChild(li);
  }
}

async function refreshList() {
  const friends = await listFriends();
  state.friends = friends;
  renderFriends(state.friends);
}

export async function initFriendsPage() {
  // Sélecteurs
  const form = await waitEl<HTMLFormElement>('#friendsSearchForm');
  const input = await waitEl<HTMLFormElement>('#friendsSearchInput');
  const btn = await waitEl<HTMLFormElement>('#friendsAddBtn');

  try {
    await refreshList();
    setMsg('', 'info');
  } catch (e:any) {
    setMsg(e.message || 'friends.load_error', 'err', e?._params);
  }

  // Submit "Ajouter"
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const handle = input.value.trim();
    if (!handle) {
      setMsg('friends.enter_handle', 'info');
      return;
    }
    try {
      btn.disabled = true;
      const res = await addFriend(handle);
      await refreshList();
      setMsg(
        res.already ? 'friends.already' : 'friends.added',
        'ok',
        { name: res.friend.username }
      );
      input.value = '';
    } catch (e:any) {
      setMsg(e.message || 'common.network_error', 'err', e?._params);
    } finally {
      btn.disabled = false;
    }
  });
}