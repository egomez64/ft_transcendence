import { t } from "../i18n";
import { fetchWithAuth } from "./utils";
import { navigate } from "./main";


export function initTwofaPage() {
  const form = document.getElementById("twofaForm") as HTMLFormElement | null;
  const msg = document.getElementById("twofaMsg") as HTMLParagraphElement | null;
  const codeEl = document.getElementById("twofaCode") as HTMLInputElement | null;
  const resend = document.getElementById("twofaResendBtn") as HTMLButtonElement | null;
  const back = document.getElementById("twofaBackBtn") as HTMLButtonElement | null;

  if (!sessionStorage.getItem("2fa:pending")) {
    navigate("/login", true);
    return;
  }

  setTimeout(() => codeEl?.focus(), 0);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (codeEl?.value || "").trim();

    try {
      const res = await fetchWithAuth("/api/auth/2fa/verify", {
        method: "POST",
        json: { code },
      });
      const body = await res.json().catch(() => ({} as any));

      if (!res.ok || !body?.ok) {
        if (msg) {
          const key = mapTwofaErrorToKey(body?.error);
          msg.textContent = t(key);
        }
        return;
      }

      sessionStorage.removeItem("2fa:pending");

      if (body.user?.needs_password) {
        await navigate("/set-password");
        return;
      }

      try {
        const meRes = await fetchWithAuth("/api/auth/me", {
          method: "GET",
          cache: "no-store",
        });

        await meRes.text().catch(() => "");
      } catch{}

      window.dispatchEvent(new CustomEvent("auth:changed"));
      
      await new Promise((r) => setTimeout(r, 0));
      await navigate("/dashboard");
    } catch {
      if (msg) msg.textContent = t("common.network_error");
    }
  });

  resend?.addEventListener("click", async () => {
    try {
      resend.disabled = true;
      const res = await fetchWithAuth("/api/auth/2fa/resend", {
        method: "POST",
      });
      const body = await res.json().catch(() => ({} as any));
      if (msg) {
        if (res.ok && body?.ok) {
          msg.textContent = t("twofa.resent");
        } else {
          const key = mapTwofaErrorToKey(body?.error);
          msg.textContent = t(key, { s: body?.retry_after ?? ""});
        }
      }
    } finally {
      setTimeout(() => (resend.disabled = false), 15000);
    }
  });

  back?.addEventListener("click", () => {
    sessionStorage.removeItem("2fa:pending");
    navigate("/login");
  });
  
  codeEl?.addEventListener("input", () => {if (msg) msg.textContent = ""; });
}


function mapTwofaErrorToKey(code?: string): string {
  switch (code) {
    case "CODE_FORMAT":      return "mfa.code_invalid_format";
    case "CODE_INVALID":     return "mfa.invalid_or_expired";
    case "CODE_EXPIRED":     return "mfa.invalid_or_expired";
    case "NO_CODE":          return "mfa.setup_required";
    case "NO_PRE2FA":        return "mfa.invalid";
    case "INVALID_PRE2FA":   return "mfa.invalid";
    case "USER_NOT_FOUND":   return "users.not_found";
    case "TOO_SOON":         return "mfa.too_soon";
    default:                 return "common.server_error";
  }
}
