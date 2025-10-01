import { t } from "../i18n";

export type MsgType = "ok" | "err" | "info";

function resolveTarget(target?: string | HTMLElement | null): HTMLElement | null {
	if (target && typeof target !== "string") return target;
	const candidates = [
		typeof target === "string" ? target : null,
		"#pageMsg", "#loginMsg", "#registerMsg", "#friendsMsg", "#dashboardMsg", "#profileMsg", "[data-msg]"
	].filter(Boolean) as string[];
	for (const sel of candidates) {
		const el = document.querySelector<HTMLElement>(sel);
		if (el) return el;
	}
	return null;
}

export function makeSetMsg(target?: string | HTMLElement | null) {
	const getEl = () => resolveTarget(target);
	return (key: string, type: MsgType = "info", vars?: Record<string, any>) => {
		const el = getEl();
		if (!el) return;
		el.textContent = t(key, vars);
		el.dataset.MsgType = type;
		el.classList.remove("hidden");
		if (!el.getAttribute("role")) el.setAttribute("role", "status");
	};
}

export function setMsg (
	key: string,
	type: MsgType = "info",
	vars?: Record<string, any>,
	target?: string | HTMLElement | null
) {
	const el = resolveTarget(target);
	if (!el) return;
	el.textContent = t(key, vars);
	el.dataset.MsgType = type;
	el.classList.remove("hidden");
	if (!el.getAttribute("role")) el.setAttribute("role", "status");
}

export function clearMsg(target?: string | HTMLElement | null) {
	const el = resolveTarget(target);
	if (!el) return;
	el.textContent = "";
	delete el.dataset.MsgType;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: any = {}) {
  // --- normalise l'URL : retire localhost:3000/5173 pour passer par Nginx ---
  function normalize(u: string): string {
    try {
      const abs = new URL(u.toString());
      if (abs.host === "localhost:3000" || abs.host === "localhost:5173") {
        return abs.pathname + abs.search + abs.hash;
      }
      return u.toString();
    } catch {
      return u
        .toString()
        .replace(/^https?:\/\/localhost:3000/, "")
        .replace(/^https?:\/\/localhost:5173/, "");
    }
  }

  const normalized =
    typeof input === "string" || input instanceof URL
      ? normalize(input.toString())
      : (input as any);

  // --- JSON helper ---
  const headers = new Headers(init.headers || {});
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    init = { ...init, body: JSON.stringify(init.json) };
  }

  const opts: RequestInit = { credentials: "include", ...init, headers };

  // --- 1er appel ---
  let res = await fetch(normalized as any, opts);
  if (res.status !== 401) return res;

  // --- refresh token ---
  const refreshRes = await fetch("/api/auth/token/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (refreshRes.ok) {
    res = await fetch(normalized as any, opts);
  }
  return res;
}