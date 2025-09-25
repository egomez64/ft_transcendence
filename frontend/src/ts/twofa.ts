import { t } from "../i18n";

const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

export function initTwofaPage() {
    const form = document.getElementById("twofaForm") as HTMLFormElement | null;
    const msg = document.getElementById("twofaMsg") as HTMLParagraphElement | null;
    const codeEl = document.getElementById("twofaCode") as HTMLInputElement | null;
    const resend = document.getElementById("twofaResendBtn") as HTMLButtonElement | null;
    const back = document.getElementById("twofaBackBtn") as HTMLButtonElement | null;

    if (!sessionStorage.getItem("2fa:pending")) {
        history.replaceState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
    }

    setTimeout(() => codeEl?.focus(), 0);

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = (codeEl?.value || "").trim();

    try {
        const res = await fetch(`${API_BASE}/api/auth/2fa/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify({ code }),
        });
        const body = await res.json().catch(() => ({} as any));

        if (!res.ok || !body.ok) {
            msg && (msg.textContent = body?.error || t("common.server_error"));
            return;
        }

        //succes
        localStorage.setItem("auth", JSON.stringify(body.user));
        sessionStorage.removeItem("2fa:pending");
        window.dispatchEvent(new CustomEvent("auth:changed"));
        history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
        msg && (msg.textContent = t("common.network_error"));
     }
    });

    resend?.addEventListener("click", async () => {
        try {
            resend.disabled = true;
            const res = await fetch(`${API_BASE}/api/auth/2fa/resend`, {
                method: "POST",
                credentials: "include",
            });
            const body = await res.json().catch(() => ({} as any));
            msg && (msg.textContent = res.ok && body.ok ? t("twofa.resent") : (body?.error || t("common.server_error")));
        } finally {
            setTimeout(() => (resend.disabled = false), 15000);
        }
    });

    back?.addEventListener("click", () => {
        sessionStorage.removeItem("2fa:pending");
        history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
    });
}