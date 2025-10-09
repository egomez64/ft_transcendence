import { applyTranslations } from "../i18n";
import { fetchWithAuth } from "./utils";

export async function initPlayPage() {
  applyTranslations(document);
  // 🧹 Petit nettoyage côté serveur des vieux 'pending' 0–0
  try { await fetchWithAuth("/api/match/cleanup-pending", { method: "POST" }); } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  const vsAiLink = document.querySelector<HTMLAnchorElement>('a[aria-label="Jouer vs ia"]');
  if (vsAiLink) {
    vsAiLink.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        const res = await fetchWithAuth("/api/match/ai", { method: "POST" });
        const data = await res.json();
        if (!data.ok) {
          alert("Erreur création match IA : " + (data.error || "inconnue"));
          return;
        }
        window.location.href = "/pong";
      } catch (err) {
        console.error("Erreur /api/match/ai", err);
        alert("Impossible de créer le match IA");
      }
    });
  }
});

document.addEventListener("click", async (ev) => {
  if ((ev as any).defaultPrevented) return;
  const target = ev.target as HTMLElement | null;
  if (!target) return;

  const a = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!a) return;

  const href = a.getAttribute("href") || "";
  if (href !== "/pong" && href !== "/pong?mode=ai") return;

  ev.preventDefault();
  ev.stopPropagation();
  (ev as any).stopImmediatePropagation?.();

  try {
    const res = await fetchWithAuth("/api/match/ai", { method: "POST" });
    const data = await res.json().catch(() => ({} as any));

    if (!res.ok || !data?.ok) {
      console.error("Création match IA KO:", res.status, data);
      alert("Impossible de créer le match contre l'IA.");
      return;
    }
    history.pushState({}, "", "/pong?mode=ai");
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch (err) {
    console.error("Erreur /api/match/ai:", err);
    alert("Erreur réseau pendant la création du match IA.");
  }
}, true);
