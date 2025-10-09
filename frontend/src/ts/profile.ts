// src/ts/profile.ts
import { makeSetMsg, fetchWithAuth } from "./utils";
import { setLang, applyTranslations } from "../i18n";
import { getMeOnce } from "./layout";

const AVATAR = { FALLBACK: "/assets/login.png" };

function setMsg(el: HTMLElement | null, text: string, ok = false) {
  const target = (el as HTMLElement | null) ?? document.querySelector<HTMLElement>("#profileMsg");
  const _set = makeSetMsg(target || "#profileMsg");
  const type = ok === true ? "ok" : ok === false ? "err" : "info";
  _set(text, type);
}

export async function mountProfileHandlers() {
  const form = document.getElementById("profileForm") as HTMLFormElement | null;
  const msg  = document.getElementById("profileMsg") as HTMLParagraphElement | null;
  const avatarPreview = document.getElementById("profileAvatarPreview") as HTMLImageElement | null;
  const saveBtn = document.getElementById("profileSave") as HTMLButtonElement | null;

  // Dropdown langue (style layout)
  const langBtn  = document.getElementById("preferredLangBtn") as HTMLButtonElement | null;
  const langMenu = document.getElementById("preferredLangMenu") as HTMLElement | null;
  const langLbl  = document.getElementById("preferredLangLabel") as HTMLElement | null;
  const langHid  = document.getElementById("preferredLangHidden") as HTMLInputElement | null;

  if (langMenu) {
    langMenu.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
      if (!b.getAttribute("type")) b.setAttribute("type", "button");
    });
  }

  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  const emailIn      = form.querySelector<HTMLInputElement>('input[name="email"]');
  const usernameIn   = form.querySelector<HTMLInputElement>('input[name="username"]');
  const aliasIn      = form.querySelector<HTMLInputElement>('input[name="alias"]');
  const avatarFileIn = form.querySelector<HTMLInputElement>('input[name="avatar"]');

  // password inputs
  const oldPwIn   = form.querySelector<HTMLInputElement>('input[name="old_password"]');
  const newPwIn   = form.querySelector<HTMLInputElement>('input[name="new_password"]');
  const newPw2In  = form.querySelector<HTMLInputElement>('input[name="new_password_confirm"]');

  // ---- /me
  let user: any = await getMeOnce();
  if (!user) {
    if (!user) {
      history.replaceState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
  }

  // ---- Hydrate
  if (emailIn) { emailIn.value = user.email ?? ""; emailIn.disabled = true; }
  if (usernameIn) usernameIn.value = user.username ?? "";
  if (aliasIn) aliasIn.value = user.alias ?? "";
  if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;

  // Langue initiale: DB > localStorage > fr
  const initialLang: string =
    (user.preferred_lang as string | undefined)
    || (localStorage.getItem("lang") || undefined)
    || "fr";

  if (langHid) langHid.value = initialLang;
  if (langLbl) {
    langLbl.textContent = initialLang === "en" ? "English" : initialLang === "es" ? "Español" : "Français";
  }

  // Snapshot initial pour "dirty state"
  const initial = {
    username: usernameIn?.value || "",
    alias:    aliasIn?.value || "",
    preferred_lang: initialLang,
  };

  const isPwSectionDirty = () =>
    !!(newPwIn?.value || newPw2In?.value || oldPwIn?.value);

  const isDirty = () => {
    const uname  = (usernameIn?.value || "");
    const ali    = (aliasIn?.value || "");
    const lang   = (langHid?.value || initialLang);
    const avatarSelected = !!(avatarFileIn?.files && avatarFileIn.files[0]);
    return (
      uname !== initial.username ||
      ali !== initial.alias ||
      lang !== initial.preferred_lang ||
      avatarSelected ||
      isPwSectionDirty()
    );
  };

  const updateSaveDisabled = () => {
    if (!saveBtn) return;
    saveBtn.disabled = !isDirty();
  };

  // ---- Dropdown langue (aucune écriture DB ici)
  langBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const expanded = langBtn.getAttribute("aria-expanded") === "true";
    langBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
    langMenu?.classList.toggle("hidden", expanded);
  });

  // ✅ 2) empêcher la soumission + sélectionner proprement
  langMenu?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const item = (e.target as HTMLElement).closest("[data-lang]") as HTMLButtonElement | null;
    if (!item) return;

    const code = String(item.dataset.lang || "fr").toLowerCase().split(/[-_]/)[0];

    if (langHid) langHid.value = code;
    if (langLbl) langLbl.textContent = code === "en" ? "English" : code === "es" ? "Español" : "Français";

    langMenu.classList.add("hidden");
    langBtn?.setAttribute("aria-expanded", "false");

    // si tu veux activer/désactiver le bouton "Enregistrer" en live
    updateSaveDisabled?.();
  });

  document.addEventListener("click", (e) => {
    if (!langMenu || !langBtn) return;
    const within = (e.target as HTMLElement).closest("#profileLangDropdown");
    if (!within) {
      langMenu.classList.add("hidden");
      langBtn.setAttribute("aria-expanded", "false");
    }
  });

  // ---- Preview avatar (et clean URL objet)
  let lastObjectUrl: string | null = null;
  avatarFileIn?.addEventListener("change", () => {
    const file = avatarFileIn.files?.[0];
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl);
      lastObjectUrl = null;
    }
    if (file) {
      lastObjectUrl = URL.createObjectURL(file);
      if (avatarPreview) avatarPreview.src = lastObjectUrl;
    } else {
      if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;
    }
    updateSaveDisabled();
  });

  // Any input change
  [usernameIn, aliasIn, oldPwIn, newPw2In, newPwIn].forEach((inp) => {
    inp?.addEventListener("input", updateSaveDisabled);
  });

  // ---- Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isDirty()) {
      setMsg(msg, "profile.nothing_to_save", false);
      return;
    }

    const uname = (usernameIn?.value || "").trim();
    const alias = (aliasIn?.value || "").trim();
    const preferred_lang = (langHid?.value || "fr").toLowerCase().split(/[-_]/)[0];

    if (!uname) {
      setMsg(msg, "profile.username_required", false);
      usernameIn?.focus();
      return;
    }

    // Validation de mdp
    const oldPw  = oldPwIn?.value || "";
    const newPw  = newPwIn?.value || "";
    const newPw2 = newPw2In?.value || "";

    if (newPw || newPw2 || oldPw) {
      if (!oldPw) {
        setMsg(msg, "profile.password.old_required", false);
        oldPwIn?.focus();
        return;
      }
      if (!newPw || !newPw2) {
        setMsg(msg, "profile.password.new_required", false);
        (newPw ? newPw2In : newPwIn)?.focus();
        return;
      }
      if (newPw !== newPw2) {
        setMsg(msg, "profile.password.mismatch", false);
        newPw2In?.focus();
        return;
      }
    }

    const formData = new FormData();
    formData.append("username", uname);
    // envoyer alias vide => backend peut normaliser en NULL
    formData.append("alias", alias);
    formData.append("preferred_lang", preferred_lang);
    if (avatarFileIn?.files?.[0]) {
      formData.append("avatar", avatarFileIn.files[0]);
    }
    if (newPw) {
      formData.append("old_password", oldPw);
      formData.append("new_password", newPw);
    }

    setMsg(msg, "profile.saving");
    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Conflits (409)
        if (res.status === 409) {
          const err = String(data?.error || "").toLowerCase();
          if (err.includes("username")) {
            setMsg(msg, "profile.username_taken", false);
            usernameIn?.focus();
            return;
          }
          if (err.includes("alias")) {
            setMsg(msg, "profile.alias_taken", false);
            aliasIn?.focus();
            return;
          }
        }
        // Validation (400)
        if (res.status === 400) {
          const details = data?.details;
          if (Array.isArray(details) && details.length) {
            setMsg(msg, details[0], false);
            if (String(details[0]).toLowerCase().includes("username")) usernameIn?.focus();
            if (String(details[0]).toLowerCase().includes("alias")) aliasIn?.focus();
            return;
          }
        }
        setMsg(msg, data?.error_key || "profile.update_error", false);
        return;
      }

      // Succès
      const updated = data?.user || {};
      if (usernameIn)  usernameIn.value  = updated.username ?? uname;
      if (aliasIn)     aliasIn.value     = updated.alias ?? alias;
      if (avatarPreview) avatarPreview.src = updated.avatar_url || AVATAR.FALLBACK;

      // Mettre à jour langue (UI locale)
      const savedLang = (updated.preferred_lang || preferred_lang || "fr") as string;
      if (langHid) langHid.value = savedLang;
      if (langLbl) langLbl.textContent = savedLang === "en" ? "English" : savedLang === "es" ? "Español" : "Français";

      try { localStorage.setItem("lang", savedLang); } catch {}
      await setLang(savedLang);
      applyTranslations(document.body);

      // Reset inputs & snapshot
      if (avatarFileIn) avatarFileIn.value = "";
      if (oldPwIn) oldPwIn.value = "";
      if (newPwIn) newPwIn.value = "";
      if (newPw2In) newPw2In.value = "";

      initial.username = usernameIn?.value || "";
      initial.alias = aliasIn?.value || "";
      initial.preferred_lang = savedLang;

      setMsg(msg, "profile.saved", true);
      window.dispatchEvent(new CustomEvent("auth:changed"));
    } catch {
      setMsg(msg, "common.network_error", false);
    } finally {
      updateSaveDisabled();
    }
  });

  // ---- Reset
  const cancel = document.getElementById("profileCancel") as HTMLButtonElement | null;
  cancel?.addEventListener("click", () => {
    if (usernameIn)   usernameIn.value   = user.username ?? "";
    if (aliasIn)      aliasIn.value      = user.alias ?? "";
    if (avatarPreview)avatarPreview.src  = user.avatar_url || AVATAR.FALLBACK;
    if (avatarFileIn) avatarFileIn.value = "";
    if (oldPwIn) oldPwIn.value = "";
    if (newPwIn) newPwIn.value = "";
    if (newPw2In) newPw2In.value = "";

    // reset langue UI/hidden aux valeurs initiales
    const resetLang = initial.preferred_lang || "fr";
    if (langHid) langHid.value = resetLang;
    if (langLbl) langLbl.textContent = resetLang === "en" ? "English" : resetLang === "es" ? "Español" : "Français";

    setMsg(msg, "");

    initial.username = usernameIn?.value || "";
    initial.alias = aliasIn?.value || "";
    initial.preferred_lang = resetLang;
    updateSaveDisabled();
  });

  // Clean URL objet au démontage éventuel
  window.addEventListener("beforeunload", () => {
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  });

  updateSaveDisabled();
}
