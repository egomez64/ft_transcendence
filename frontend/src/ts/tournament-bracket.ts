import { applyTranslations, t } from "../i18n";

type UserMini = { id: number, username: string, email?: string };
type TState = {
	players: [UserMini, UserMini, UserMini, UserMini];
	matches: {
		semi1 : { p1: UserMini, p2:UserMini; result?: { winner: UserMini; score: [number, number ] } };
		semi2 : { p1: UserMini, p2:UserMini; result?: { winner: UserMini; score: [number, number ] } };
		final : { p1?: UserMini, p2?:UserMini; result?: { winner: UserMini; score: [number, number ] } };
	};
};

const KEY_STATE = "tournament:state";
const KEY_PLAYERS = "tournament:players";
const KEY_CURRENT = "tournament:current";
const KEY_LOCALMATCH = "localMatch";

export function initTournamentBracketPage() {
	// initialiser l'etat
	ensureState();
	const repRaw = sessionStorage.getItem("tournament:report");
	if (repRaw) {
		try {
			const { winnerName, scoreL, scoreR } = JSON.parse(repRaw);
			//appliquer 
			applyReportToState(winnerName, scoreL, scoreR);
		} finally {
			sessionStorage.removeItem("tournament:report");
		}
	}
	//render
	render(ensureState());
	//trad
	applyTranslations(document);
}

function ensureState(): TState {
	const raw = sessionStorage.getItem(KEY_STATE);
	if (raw) return JSON.parse(raw) as TState;

	const plist = JSON.parse(sessionStorage.getItem(KEY_PLAYERS) || "[]") as (UserMini | null)[];
	if (!plist || plist.length !== 4 || plist.some((p) => !p)) {
		history.replaceState({}, "", "/tournament");
		window.dispatchEvent(new PopStateEvent("popstate"));
	}
	const [p1, p2, p3, p4] = plist as [UserMini, UserMini, UserMini, UserMini];

	const st: TState = {
		players: [p1, p2, p3 , p4],
		matches: {
			semi1: { p1, p2},
			semi2: { p1: p3, p2: p4},
			final: {},
		},
	};
	sessionStorage.setItem(KEY_STATE, JSON.stringify(st));
	return st;
}

function save(st: TState) {
	sessionStorage.setItem(KEY_STATE, JSON.stringify(st));
}

function render(st: TState) {
	//nom
	setTxt("#sf1-p1", st.matches.semi1.p1.username);
	setTxt("#sf1-p2", st.matches.semi1.p2.username);
	setTxt("#sf2-p1", st.matches.semi2.p1.username);
	setTxt("#sf2-p2", st.matches.semi2.p2.username);

	setTxt("#f-p1", st.matches.final.p1?.username || "—");
	setTxt("#f-p2", st.matches.final.p2?.username || "—");

	//resultat
	setTxt("#sf1-res", st.matches.semi1.result ? resLabel(st.matches.semi1.result) : "");
	setTxt("#sf2-res", st.matches.semi2.result ? resLabel(st.matches.semi2.result) : "");
	setTxt("#f-res", st.matches.final.result ? resLabel(st.matches.final.result) : "");

	//button
	setupPlayBtn("sf1-play", !!st.matches.semi1.result, () => startMatch("semi1", st.matches.semi1.p1, st.matches.semi1.p2));
	setupPlayBtn("sf2-play", !!st.matches.semi2.result, () => startMatch("semi2", st.matches.semi2.p1, st.matches.semi2.p2));

	//finale jouable que quand les semi sont fini
	const fReady = !!st.matches.final.p1 && !!st.matches.final.p2;
	setupPlayBtn("f-play", !!st.matches.final.result || !fReady, () => startMatch("final", st.matches.final.p1!, st.matches.final.p2!));


	//winner final
	const winnerWrap = document.getElementById("t-winner")!;
	if (st.matches.final.result?.winner) {
		winnerWrap.classList.remove("hidden");
		setTxt("#t-winner-name", st.matches.final.result.winner.username);
	} else {
		winnerWrap.classList.add("hidden");
	}
}

function resLabel(r: { winner: UserMini; score: [number, number] }) {
	const [l, rgt] = r.score;
	return `${t("tournament.result") || "Resultat"} : ${l} - ${rgt} • ${t("tournament.winner") || "Vainqueur"} : ${r.winner.username}`;
}

function setTxt(sel: string, val: string) {
	const el = document.querySelector(sel);
	if (el) el.textContent = val;
}

function setupPlayBtn(id: string, disabled: boolean, onClick: () => void) {
	const b = document.getElementById(id) as HTMLButtonElement | null;
	if (!b) return;
	if (disabled) {
		b.disabled = true;
		b.className = "w-full py-3 rounded-full font-bold bg-slate-600 text-white opacity-70 cursor-not-allowed";
	} else {
		b.disabled = false;
		b.className = "w-full py-3 rounded-full font-bold bg-gradient-to-r from-[#ff1493] to-[#8b008b] text-white hover:opacity-90 transition";
		b.onclick = onClick;
	}
}


// lance un match en local dans /pong et enregistre un contexte tournoi
function startMatch(key: "semi1" | "semi2" | "final", p1: UserMini, p2: UserMini) {
	//purge ancien
	sessionStorage.removeItem("tournament:report");
	
	sessionStorage.setItem(KEY_CURRENT, JSON.stringify({ key }));

	//injecter un local match
	sessionStorage.setItem(
		KEY_LOCALMATCH,
		JSON.stringify({
			id: Date.now(),
			p1: { id: p1.id, username: p1.username},
			p2: { id: p2.id, username: p2.username},
			controls: { left: "WS", right: "ARROWS"},
			mode: "local-1v1",
			tournamentReturn: "/tournament/bracket",
		})
	);

	history.pushState({}, "","/pong");
	window.dispatchEvent(new PopStateEvent("popstate"));
}

//appele par /pong a la fin d'un match

export function applyMatchResultFromPong(winnerName: string, scoreL: number, scoreR: number) {
	const curRaw = sessionStorage.getItem(KEY_CURRENT);
	if (!curRaw) return;
	const st = ensureState();

	const { key } = JSON.parse(curRaw) as { key: "semi1" | "semi2" | "final" };
	const m = st.matches[key];

	//trouver le winner
	const winner =
		m.p1 && m.p1.username === winnerName ? m.p1 :
		m.p2 && m.p2.username === winnerName ? m.p2 :
		(scoreL > scoreR ? m.p1 : m.p2);
	
	m.result = { winner: winner!, score: [scoreL, scoreR] };

	//propager vers la final
	if (key === "semi1")
		st.matches.final.p1 = winner!;
	else if (key === "semi2")
		st.matches.final.p2 = winner!;

	save(st);
	sessionStorage.removeItem(KEY_CURRENT);
}

function applyReportToState(winnerName: string, scoreL: number, scoreR: number) {
	const curRaw = sessionStorage.getItem(KEY_CURRENT);
	if (!curRaw) return;
	const st = ensureState();
	const { key } = JSON.parse(curRaw) as { key: "semi1" | "semi2" | "final" };

	const m = st.matches[key];
	const winner =
		m.p1 && m.p1.username === winnerName ? m.p1 :
		m.p2 && m.p2.username === winnerName ? m.p2 :
			(scoreL > scoreR ? m.p1 : m.p2);
	
	m.result = { winner: winner!, score: [scoreL, scoreR] };

	if (key === "semi1") st.matches.final.p1 = winner!;
	if (key === "semi2") st.matches.final.p2 = winner!;
	sessionStorage.setItem(KEY_STATE, JSON.stringify(st));
	sessionStorage.removeItem(KEY_CURRENT);
}