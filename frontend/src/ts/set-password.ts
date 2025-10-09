import { fetchWithAuth, makeSetMsg } from "./utils";
import { navigate } from "./main";
import { t } from "../i18n";

export async function mountSetPasswordPage() {
  const form = document.getElementById("setPasswordForm") as HTMLFormElement | null;
  const newPwd = document.getElementById("newPassword") as HTMLInputElement | null;
  const confirmPwd = document.getElementById("confirmPassword") as HTMLInputElement | null;
  const msg = makeSetMsg("#setPwdMsg");
  const msgEl = document.querySelector<HTMLElement>("#setPwdMsg"); // pour afficher les détails

  if (!form || !newPwd || !confirmPwd) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const p1 = newPwd.value.trim();
    const p2 = confirmPwd.value.trim();

    if (!p1 || !p2) {
      msg("auth.missing_fields", "err");
      return;
    }
    if (p1 !== p2) {
      msg("auth.password_mismatch", "err");
      return;
    }
    // Garde le check rapide côté client si tu veux un feedback instantané,
    // sinon laisse tout au backend. Ici on mappe sur la même clé que la policy.
    if (p1.length < 8) {
      msg("password.min", "err");
      return;
    }

    try {
      const res = await fetchWithAuth("/api/auth/set-password", {
        method: "POST",
        json: { newPassword: p1 },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        // Affiche la clé principale
        msg(data?.error_key || data?.error || "common.server_error", "err");

        // + DÉTAILS (liste des règles) si fournis par le backend
        if (Array.isArray(data?.details) && data.details.length && msgEl) {
          const details = data.details.map((k: string) => `• ${t(k)}`).join("\n");
          // on concatène proprement sous le message
          msgEl.textContent = (msgEl.textContent ? msgEl.textContent + "\n" : "") + details;
          msgEl.classList.add("whitespace-pre-line");
        }
        return;
      }

      msg("auth.password_set_ok", "ok");

      // Attends un peu avant de rediriger
      setTimeout(async () => {
        // Événement global pour mettre à jour le header/menu
        window.dispatchEvent(new CustomEvent("auth:changed"));
        await navigate("/dashboard");
      }, 1000);
    } catch {
      msg("common.network_error", "err");
    }
  });
}
