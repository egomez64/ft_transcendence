import { initTournamentBracketPage } from "./tournament-bracket";
import { makeSetMsg, fetchWithAuth } from "./utils";

const AVATAR = {
  FALLBACK: "/assets/login.png",
};

function setMsg(el: HTMLElement | null, text: string, ok = false) {
  const target = (el as HTMLElement | null) ?? document.querySelector<HTMLElement>("#profileMsg");
  const _set = makeSetMsg(target || "#profileMsg");
  const type = ok === true ? "ok" : ok === false ? "err" : "info";
  _set(text, type);
}

export async function mountProfileHandlers() {
  const form = document.getElementById("profileForm") as HTMLFormElement | null;
  const msg = document.getElementById("profileMsg") as HTMLParagraphElement | null;
  const avatarPreview = document.getElementById("profileAvatarPreview") as HTMLImageElement | null;
  const saveBtn = document.getElementById("profileSave") as HTMLButtonElement | null;
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  const emailIn = form.querySelector<HTMLInputElement>('input[name="email"]');
  const usernameIn = form.querySelector<HTMLInputElement>('input[name="username"]');
  const aliasIn = form.querySelector<HTMLInputElement>('input[name="alias"]');
  const avatarFileIn = form.querySelector<HTMLInputElement>('input[name="avatar"]');

  //password iinputs
  const oldPwIn = form.querySelector<HTMLInputElement>('input[name="old_password"]');
  const newPwIn = form.querySelector<HTMLInputElement>('input[name="new_password"]');
  const newPw2In = form.querySelector<HTMLInputElement>('input[name="new_password_confirm"]');
  
  // ---- Récup utilisateur courant depuis la session (cookies)
  let user: any = null;
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) throw new Error("Not authenticated");
    const data = await res.json();
    if (!data.ok || !data.user) throw new Error("No user");
    user = data.user;
  } catch {
    history.replaceState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }

  // ---- Hydrate les champs
  if (emailIn) {
    emailIn.value = user.email ?? "";
    emailIn.disabled = true;
  }
  if (usernameIn) usernameIn.value = user.username ?? "";
  if (aliasIn) aliasIn.value = user.alias ?? "";
  if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;

  //snapshot initial pour "dirty state"
  const initial: { username: string; alias: string; avatar: File | null } = {
    username: usernameIn?.value || "",
    alias: aliasIn?.value || "",
    avatar: null,
  };

  const isPwSectionDirty = () =>
    !!(newPwIn?.value || newPw2In?.value || oldPwIn?.value);

  const isDirty = () => {
    const uname = (usernameIn?.value || "");
    const ali = (aliasIn?.value || "");
    const avatarSelected = !!(avatarFileIn?.files && avatarFileIn.files[0]);
    return (
      uname !== initial.username ||
      ali !== initial.alias ||
      avatarSelected ||
      isPwSectionDirty()
    );
  };

  const updateSaveDisabled = () => {
    if (!saveBtn) return;
    saveBtn.disabled = !isDirty();
  }


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

  //any input change
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

    if (!uname) {
      setMsg(msg, "profile.username_required", false);
      usernameIn?.focus();
      return;
    }

    //validation de mdp
    const oldPw = oldPwIn?.value || "";
    const newPw = newPwIn?.value || "";
    const newPw2 = newPw2In?.value || "";

    if(newPw || newPw2 || oldPw) {
      if (!oldPw) {
        setMsg(msg, "profile.password.old_required", false);
        oldPwIn?.focus();
        return;
      }
      if(!newPw || !newPw2) {
        setMsg(msg, "profile.password.new_required", false);
        (newPw ? newPw2In : newPwIn)?.focus();
        return;
      }
      if(newPw !== newPw2) {
        setMsg(msg, "profile.password.mismatch", false);
        newPw2In?.focus();
        return;
      }
    }

    const formData = new FormData();
    formData.append("username", uname);
    // envoyer alias vide => backend peut normaliser en NULL
    formData.append("alias", alias);
    if (avatarFileIn?.files?.[0]) {
      formData.append("avatar", avatarFileIn.files[0]);
    }
    if (newPw) {
      formData.append("old_password", oldPw);
      formData.append("new_password", newPw);
    }

    setMsg(msg, "profile.saving");
    saveBtn && (saveBtn.disabled = true);

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
      if (usernameIn) usernameIn.value = updated.username ?? uname;
      if (aliasIn) aliasIn.value = updated.alias ?? alias;
      if (avatarPreview) avatarPreview.src = updated.avatar_url || AVATAR.FALLBACK;

      initial.username = usernameIn?.value || "";
      initial.alias = aliasIn?.value || "";
      if (avatarFileIn) avatarFileIn.value = "";
      if (oldPwIn) oldPwIn.value = "";
      if (newPwIn) newPwIn.value = "";
      if (newPw2In) newPw2In.value = "";

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
    if (usernameIn) usernameIn.value = user.username ?? "";
    if (aliasIn) aliasIn.value = user.alias ?? "";
    if (avatarPreview) avatarPreview.src = user.avatar_url || AVATAR.FALLBACK;
    if (avatarFileIn) avatarFileIn.value = "";
    if (lastObjectUrl) { URL.revokeObjectURL(lastObjectUrl); lastObjectUrl = null; }
    if (oldPwIn) oldPwIn.value = "";
    if (newPwIn) newPwIn.value = "";
    if (newPw2In) newPw2In.value = "";
    setMsg(msg, "");

    initial.username = usernameIn?.value || "";
    initial.alias = aliasIn?.value || "";
    updateSaveDisabled();
  });

  // Clean URL objet au démontage éventuel
  window.addEventListener("beforeunload", () => {
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  });

  updateSaveDisabled();
}
