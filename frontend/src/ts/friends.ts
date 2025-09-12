type Friend = {
    id: string;
    username: string;
    alias?: string;
    avatar_url?: string;
    online: boolean;
};

const FRIENDS_KEY = "friends";

function readFriends(): Friend[] {
    try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || "[]"); }
    catch { return []; }
}

//fonction a remplacer par appel api
function saveFriends(list: Friend[]) {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));
}

function statusDot(online: boolean): string {
    //vert si en ligne sinon transparent
    return online
        ? 'inline-block w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]'
        : 'inline-block w-3 h-3 rounded-full bg-transparent border border-emerald-300/40';
}

function renderList() {
    const ul = document.getElementById("friendsList");
    if (!ul) return;
    const list = readFriends();

    if (list.length === 0) {
        ul.innerHTML = `<li class="p-4 text-pink-300/80">Aucun ami pour le moment.</li>`;
        return;
    }

    ul.innerHTML = list.map(f => `
        <li class="flex items-center gap-3 p-4 hover:bg-pink-500/5 transition">
            <span class="${statusDot(f.online)}"></span>
            <img src="${f.avatar_url || "/assets/login.png"}"
                alt=""
                class="w-8 h-8 rounded-full border border-pink-500/30 object-cover" />
            <div class="flex-1">
                <div class="font-semibold text-pink-100">${f.username}</div>
                ${f.alias ? `<div class="text-xs text-pink-300/80">@${f.alias}</div>` : ""}
            </div>
            <button data-id="${f.id}" class="friends-remove text-sm px-3 py-1 rounded-md bg-black/40 border border-pink-500/30 hover:bg-black/60">
                Retirer
            </button>
        </li>
    `).join("");

    // bind remove
    ul.querySelectorAll<HTMLButtonElement>(".friends-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id!;
            const next = readFriends().filter(f => f.id !== id);
            saveFriends(next);
            renderList();
        });
    });
}

function setMsg(text: string, ok = false) {
    const p = document.getElementById("friendsMsg");
    if (!p) return;
    p.textContent = text;
    p.className = `text-sm ${ok ? "text-emerald-300" : "text-pink-200"}`;
}

// MOCK recherche utilisateur a remplacer par un fetch API
async function mockSearchUser(query: string): Promise<Friend | null> {
    //simuler user trouver avec id
    const id = btoa(query).replace(/=+$/,"").slice(0,12);
    return {
        id,
        username: query.trim(),
        alias: query.trim().toLowerCase(),
        avatar_url: "/assets/login.png",
        online: Math.random() < 0.5, // random online for demo
    };
}

// init 
export function initFriendPage() {
    const form = document.getElementById("friendsSearchForm") as HTMLFormElement | null;
    const input = document.getElementById("firendsSearchInput") as HTMLInputElement | null;

    renderList();

    if (form && input) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (!q) { setMsg("Entrez un pseudo ou alias."); return; }

            setMsg("Recherche...");
            const found = await mockSearchUser(q);
            if (!found) { setMsg("Aucun utilisateur trouvé."); return; }

            const list = readFriends();
            if (list.some(f => f.id === found.id)) { setMsg("cet utilisateur est déjà dans votre liste."); return; }

            list.push(found);
            saveFriends(list);
            input.value = "";
            setMsg(`@${found.username} ajouté à vos amis.`, true);
            renderList();
        });
    }

    //optionnel petit live status mock
    const flip = () => {
        const list = readFriends();
        if (list.length) {
            const i = Math.floor(Math.random() * list.length);
            list[i] = { ...list[i], online: Math.random() < 0.6 };
            saveFriends(list);
            renderList();
        }
    };
    const t = window.setInterval(flip, 15000);
}
