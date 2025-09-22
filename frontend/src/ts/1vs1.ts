type MatchApiResponse =
  | { ok: true; match_id: number; player1: { id: number; username: string }; player2: { id: number; username: string } }
  | { ok: false; error: string };

const MATCH_API = "/api/match/local";

export function initLocal1v1Page() {
  const form = document.getElementById("p2-form") as HTMLFormElement | null;
  const userEl = document.getElementById("p2-username") as HTMLInputElement | null;
  const passEl = document.getElementById("p2-password") as HTMLInputElement | null;
  const errEl  = document.getElementById("p2-error") as HTMLParagraphElement | null;
  const btn    = document.getElementById("p2-submit") as HTMLButtonElement | null;
  if (!form || !userEl || !passEl || !errEl || !btn) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    btn.disabled = true; btn.textContent = "Connexion…";

    try {
      const res = await fetch(MATCH_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userEl.value.trim(), password: passEl.value }),
      });
      const data = (await res.json()) as MatchApiResponse;

      if (!res.ok || !("ok" in data) || !data.ok) {
        errEl.textContent = normalizeErrorMsg((data as any)?.error || "UNKNOWN_ERROR");
        return;
      }

      // ✅ clé correcte : localMatch
      sessionStorage.setItem(
        "localMatch",
        JSON.stringify({
          id: data.match_id,
          p1: data.player1,
          p2: data.player2,
          controls: { left: "WS", right: "ARROWS" },
          mode: "local-1v1",
        })
      );

      window.location.href = "/pong";
    } catch {
      errEl.textContent = "Échec de la connexion. Vérifiez le serveur et réessayez.";
    } finally {
      btn.disabled = false; btn.textContent = "Continuer";
    }
  };
}

function normalizeErrorMsg(code: string): string {
  switch (code) {
    case "PLAYER1_NOT_AUTHENTICATED": return "Le joueur 1 n'est pas connecté dans cet onglet.";
    case "MISSING_CREDENTIALS":      return "Veuillez saisir le nom d'utilisateur et le mot de passe du joueur 2.";
    case "PLAYER2_NOT_FOUND":        return "Aucun compte ne correspond à ce nom d'utilisateur.";
    case "PLAYER2_INVALID_PASSWORD": return "Mot de passe incorrect pour le joueur 2.";
    case "CANNOT_PLAY_WITH_SELF":    return "Le joueur 2 doit être un compte différent du joueur 1.";
    default:                         return "Impossible de créer le match local.";
  }
}
