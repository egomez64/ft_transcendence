import { applyTranslations } from "../i18n";
import { fetchWithAuth } from "./utils";

export async function initPlayPage() {
	applyTranslations(document);
}


document.addEventListener("DOMContentLoaded", () => {
  const vsAiLink = document.querySelector<HTMLAnchorElement>('a[aria-label="Jouer vs ia"]');
  if (vsAiLink) {
    vsAiLink.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation(); // ⬅️ important : empêche le router global d'intercepter le clic

      try {
        const res = await fetchWithAuth("http://localhost:3000/api/match/ai", {
          method: "POST",
        });
        const data = await res.json();
        if (!data.ok) {
          alert("Erreur création match IA : " + (data.error || "inconnue"));
          return;
        }
        console.log("Match IA créé avec id", data.match_id);
        // on redirige seulement après l'INSERT en base
        window.location.href = "/pong";
      } catch (err) {
        console.error("Erreur /api/match/ai", err);
        alert("Impossible de créer le match IA");
      }
    });
  }
});



document.addEventListener("click", async (ev) => {
  // Si un autre handler a déjà bloqué, on ne fait rien.
  if ((ev as any).defaultPrevented) return;

  const target = ev.target as HTMLElement | null;
  if (!target) return;

  // Récupère le <a> visé (si le clic vient d'un enfant)
  const a = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!a) return;

  const href = a.getAttribute("href") || "";
  // On vise uniquement le lien qui lance le mode Pong (vs IA)
  if (href !== "/pong") return;

  // ⚠️ Empêche la navigation SPA et native AVANT tout
  ev.preventDefault();
  ev.stopPropagation();
  // Très important si d'autres handlers sont sur le même élément
  (ev as any).stopImmediatePropagation?.();

  try {
    // Appel backend pour enregistrer le match IA
    const res = await fetchWithAuth("http://localhost:3000/api/match/ai", {
      method: "POST",
    });
    const data = await res.json().catch(() => ({} as any));

    if (!res.ok || !data?.ok) {
      console.error("Création match IA KO:", res.status, data);
      alert("Impossible de créer le match contre l'IA.");
      return;
    }

    console.log("✅ Match IA créé avec id", data.match_id);

    // Seulement après enregistrement, on navigue vers /pong
    window.location.href = "/pong";
  } catch (err) {
    console.error("Erreur /api/match/ai:", err);
    alert("Erreur réseau pendant la création du match IA.");
  }
}, true /* ← phase de CAPTURE */);