import { makeSetMsg } from "./utils";
import { initI18n, setLang, applyTranslations, t } from "../i18n";
import { fetchWithAuth } from "./utils";
import { navigate } from "./main";

const API_BASE =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'https://localhost:8443'
    : '';

export function mountLoginHandlers() {
  const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
  const googleBtn = document.getElementById("googleLoginBtn") as HTMLButtonElement | null;

  const setMsg = makeSetMsg("#loginMsg");

  // ⚠️ Patch : neutraliser l’action native du formulaire
  if (loginForm) {
    loginForm.setAttribute("action", "");
    loginForm.setAttribute("method", "post");
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      window.location.assign(`${API_BASE}/api/auth/google`);
    });
  }

  // ---- Étape 1 : LOGIN ----
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(loginForm);
    const payload = {
      username: String(data.get("username") || "").trim(),
      password: String(data.get("password") || ""),
    };

    if (!payload.username || !payload.password) {
      setMsg('auth.missing_credentials', 'err');
      return;
    }

    try {
      const res = await fetchWithAuth("/api/auth/login", {
        method: "POST",
        json: payload,
      });
      const body = await res.json().catch(() => ({} as any));

      if (!res.ok || !body?.ok) {
        // <- CLEF NORMALISÉE EN PROVENANCE DU BACK
        const key =
          body?.error_key
            ?? (res.status === 500 ? 'common.internal_error' : 'auth.login_failed');

        setMsg(key, "err", body?.params);
        return;
      }

      if (body.step === "2fa_required") {
        sessionStorage.setItem("2fa:pending", "1");
        history.pushState({}, "", "/twofa");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      if (body.user) {
        localStorage.setItem("auth", JSON.stringify(body.user));
        window.dispatchEvent(new CustomEvent("auth:changed"));
        await navigate("/dashboard");
      }
    } catch (err: any) {
      setMsg("common.network_error", "err");
    }
  });
}