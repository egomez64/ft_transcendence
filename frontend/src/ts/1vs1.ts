import { initI18n, t } from "../i18n";

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
  const cancel = document.getElementById("p2-cancel") as HTMLAnchorElement | null;
  if (!form || !userEl || !passEl || !errEl || !btn || !cancel) return;

  let currentAbort: AbortController | null = null;
  let cancelled = false;

  cancel.addEventListener("click", (e) => {
    e.preventDefault();
    cancelled = true;
    if (currentAbort) currentAbort.abort();
    btn.disabled = false;
    btn.textContent = t("local1v1.actions.continue");
    errEl.textContent = "";
    history.pushState({}, "", "/play");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    cancelled = false;
    errEl.textContent = "";
    btn.disabled = true; btn.textContent = t("local1v1.actions.connecting");

    if (!userEl.value.trim() || !passEl.value) {
      errEl.textContent = t("local1v1.errors.missing_credentials");
      btn.disabled = false;
      btn.textContent = t("local1v1.actions.continue");
      return;
    }

    currentAbort = new AbortController();

    try {
      const res = await fetch(MATCH_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userEl.value.trim(), password: passEl.value }),
        signal: currentAbort.signal
      });

      if (cancelled) return;

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
    } catch (err:any) {
      if (cancelled || err?.name === "AbortError")
        return;
      errEl.textContent = t("local1v1.errors.login_failed");
    } finally {
      if (!cancelled)   
        btn.disabled = false; btn.textContent = t("local1v1.actions.continue");
      currentAbort = null;
    }
  };
}

function normalizeErrorMsg(code: string): string {
  switch (code) {
    case "PLAYER1_NOT_AUTHENTICATED": return t("local1v1.errors.p1_not_auth");
    case "MISSING_CREDENTIALS":      return t("local1v1.errors.missing_credentials");
    case "PLAYER2_NOT_FOUND":        return t("local1v1.errors.p2_not_found");
    case "PLAYER2_INVALID_PASSWORD": return t("local1v1.errors.p2_bad_password");
    case "CANNOT_PLAY_WITH_SELF":    return t("local1v1.errors.cannot_play_with_self");
    default:                         return t("local1v1.errors.generic");
  }
}
