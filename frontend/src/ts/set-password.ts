import { fetchWithAuth, makeSetMsg } from "./utils";
import { navigate } from "./main";

export async function mountSetPasswordPage() {
  const form = document.getElementById("setPasswordForm") as HTMLFormElement | null;
  const newPwd = document.getElementById("newPassword") as HTMLInputElement | null;
  const confirmPwd = document.getElementById("confirmPassword") as HTMLInputElement | null;
  const msg = makeSetMsg("#setPwdMsg");

  if (!form || !newPwd || !confirmPwd) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const p1 = newPwd.value.trim();
    const p2 = confirmPwd.value.trim();

    if (!p1 || !p2) {
      msg("Veuillez remplir tous les champs.", "err");
      return;
    }
    if (p1 !== p2) {
      msg("Les mots de passe ne correspondent pas.", "err");
      return;
    }
    if (p1.length < 8) {
      msg("Le mot de passe doit contenir au moins 8 caractères.", "err");
      return;
    }

    try {
      const res = await fetchWithAuth("/api/auth/set-password", {
        method: "POST",
        json: { newPassword: p1 },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        msg("Erreur lors de l’enregistrement du mot de passe.", "err");
        return;
      }

      msg("Mot de passe enregistré avec succès !", "ok");

      // Attends un peu avant de rediriger
      setTimeout(async () => {
        // Événement global pour mettre à jour le header/menu
        window.dispatchEvent(new CustomEvent("auth:changed"));
        await navigate("/dashboard");
      }, 1000);
    } catch {
      msg("Erreur réseau. Veuillez réessayer.", "err");
    }
  });
}
