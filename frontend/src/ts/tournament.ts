// src/ts/tournament.ts
import { applyTranslations, t } from "../i18n";
import { currentUser } from "./layout";

const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

const TOURNAMENT_LOGIN = `${API_BASE}/api/tournament/login`;

type UserMini = { id: number; username: string; email?: string };
type LoginResp =
  | { ok: true; user: UserMini }
  | { ok: false; error?: string; error_key?: string };

const SLOT_IDS = [2, 3, 4] as const;

export function initTournamentPage() {
  try {
    const me = currentUser();
    const p1 = document.getElementById("p1-username") as HTMLInputElement | null;
    if (p1) p1.value = me?.username || "(non connecté)";
  } catch {}

  for (const i of SLOT_IDS) {
    mountSlotLogin(i);
  }

  const startBtn = document.getElementById("t-start") as HTMLButtonElement | null;
  startBtn?.addEventListener("click", () => {
    if (!canStart()) return;
    sessionStorage.setItem("tournament:players", JSON.stringify(getPlayers()));
    history.pushState({}, "", "/pong");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  applyTranslations(document);
  updateStartButton();
}

function mountSlotLogin(i: 2 | 3 | 4) {
  const u = document.getElementById(`p${i}-username`) as HTMLInputElement | null;
  const p = document.getElementById(`p${i}-password`) as HTMLInputElement | null;
  const b = document.getElementById(`p${i}-login`) as HTMLButtonElement | null;
  const m = document.getElementById(`p${i}-msg`) as HTMLParagraphElement | null;
  const badge = document.getElementById(`p${i}-badge`) as HTMLSpanElement | null;

  b?.addEventListener("click", async () => {
    if (!u?.value || !p?.value) {
      if (m) m.textContent = t("tournament.errors.missing_credentials") || "Identifiants requis.";
      return;
    }
    b.disabled = true;

    try {
      const res = await fetch(TOURNAMENT_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // pas nécessaire ici, mais ok
        body: JSON.stringify({ username: u.value.trim(), password: p.value }),
      });
      const body = (await res.json().catch(() => ({}))) as LoginResp;

      if (!res.ok || !body.ok) {
        const msg = (body as any)?.error_key || (body as any)?.error || t("common.server_error");
        if (m) m.textContent = String(msg);
        b.disabled = false;
        return;
      }

      // Insert (avec contrôle doublon)
      const inserted = upsertTournamentPlayer(i, body.user);
      if (!inserted.ok) {
        if (m) m.textContent = t(inserted.errorKey!);
        b.disabled = false;
        return;
      }

      // lock visuel
      u!.readOnly = true;
      p!.disabled = true;
      b!.disabled = true;
      b!.classList.add("opacity-60", "cursor-not-allowed");
      if (badge) {
        badge.textContent = "Connecté";
        badge.className =
          "ml-auto text-xs rounded-full px-2 py-1 bg-green-600/30 text-green-300 font-bold";
      }
      if (m) m.textContent = "";

      updateStartButton();
    } catch {
      if (m) m.textContent = t("common.network_error") || "Erreur réseau.";
      b!.disabled = false;
    }
  });
}

function getPlayers(): (UserMini | null)[] {
  const me = currentUser();
  const arr: (UserMini | null)[] = [
    me ? { id: me.id, username: me.username, email: me.email } : null,
  ];
  for (const i of SLOT_IDS) {
    const raw = sessionStorage.getItem(`tournament:p${i}`);
    arr.push(raw ? (JSON.parse(raw) as UserMini) : null);
  }
  return arr;
}

function upsertTournamentPlayer(slot: 2 | 3 | 4, user: UserMini): { ok: boolean; errorKey?: string } {
  const existing = getPlayers().filter(Boolean) as UserMini[];
  if (existing.some((u) => u.username === user.username)) {
    return { ok: false, errorKey: "tournament.errors.already_joined" };
  }
  sessionStorage.setItem(`tournament:p${slot}`, JSON.stringify(user));
  return { ok: true };
}

function canStart(): boolean {
  const players = getPlayers().filter(Boolean);
  return players.length === 4; // 4 joueurs non nuls
}

function updateStartButton() {
  const btn = document.getElementById("t-start") as HTMLButtonElement | null;
  const lock = document.getElementById("t-lock") as HTMLElement | null;
  const ok = canStart();
  if (!btn || !lock) return;

  btn.disabled = !ok;
  if (ok) {
    btn.className =
      "inline-flex items-center gap-3 py-4 px-8 rounded-full font-extrabold bg-gradient-to-r from-[#ff1493] to-[#8b008b] text-white hover:opacity-90 transition";
    lock.textContent = "🔓";
  } else {
    btn.className =
      "inline-flex items-center gap-3 py-4 px-8 rounded-full font-extrabold bg-slate-600 text-white opacity-70 cursor-not-allowed";
    lock.textContent = "🔒";
  }
}
