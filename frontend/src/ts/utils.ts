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