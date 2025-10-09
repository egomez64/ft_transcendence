import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  FreeCamera,
  Camera,
} from "@babylonjs/core";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { io, Socket } from "socket.io-client";
import { t } from "../i18n";
import { fetchWithAuth } from "./utils";

/** Informe le bracket si on est en tournoi */
function notifyTournamentIfAny(winnerName: string, scoreL: number, scoreR: number) {
  sessionStorage.setItem("tournament:report", JSON.stringify({ winnerName, scoreL, scoreR }));
}

const THEME = {
  bg: Color4.FromHexString("#0b022300"), // transparent
  neonPrimary: Color3.FromHexString("#00e5ff"),
  neonSecondary: Color3.FromHexString("#ff3cac"),
  neonAccent: Color3.FromHexString("#eeff03"),
  white: Color3.White(),
};

const GAME = {
  WIDTH: 800,
  HEIGHT: 400,
  PADDLE_LEN: 80,
  PADDLE_THICK: 10,
  BALL_SIZE: 20,
  BALL_SEGMENTS: 32,
  WIN_SCORE: 10,
};

type LocalMatch = {
  id: number;
  p1: { id:number; username:string};
  p2: { id:number; username:string};
  controls: {left: "WS"; right:"ARROWS"};
  mode: "local-1v1";
  tournamentReturn?: string;
};

let tournamentRedirectTimer: ReturnType<typeof setTimeout> | undefined;
const COUNTDOWN_SECONDS = 3;

async function fetchMe(): Promise<{ id:number; username:string; email?:string } | null> {
  try {
    const res = await fetchWithAuth("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user || null;
  } catch {
    return null;
  }
}

async function abandonIfUnfinished() {
  try {
    const res = await fetchWithAuth("/api/match/latest");
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const match = data?.match;
    if (!match || match.status === "finished") return;
    await fetchWithAuth(`/api/match/${match.id}/abandon`, { method: "PATCH" });
  } catch {
  }
}

export function initPongPage() {
  const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  // purge éventuel report dormant (hors tournoi)
  try {
    const lm = readLocalMatch();
    if (!lm?.tournamentReturn) {
      sessionStorage.removeItem("tournament:report");
    }
  } catch {}

  // refs pour cleanup
  let engine: Engine | null = null;
  let scene: Scene | null = null;
  let networkCleanup: (() => void) | null = null;
  const onResize = () => engine?.resize();

  canvas.style.backgroundColor = "transparent";
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    alpha: true,
    premultipliedAlpha: true,
  });

  scene = new Scene(engine);
  scene.clearColor = THEME.bg;

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.35;
  const glow = new GlowLayer("glow", scene);
  glow.intensity = 0.55;

  const world = createWorld(scene);
  const cams = createCameras(scene);

  const pipeline = new DefaultRenderingPipeline("drp", true, scene, [cams.main, cams.cine, cams.persp]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.88;
  pipeline.bloomWeight = 0.28;
  pipeline.bloomKernel = 48;

  const setScore = mountScoreHUD(canvas);
  setScore(0, 0);

  const params = new URLSearchParams(location.search);
  const isVsAI = params.get("mode") == "ai";

  const lm = readLocalMatch();
  if (lm && !isVsAI) {
    mountPlayerHUD(canvas, lm.p1.username, lm.p2.username);
    networkCleanup = wireNetwork(scene, world, setScore, canvas, false, lm.p1.username);
  } else {
    fetchMe().then((me) => {
      const meName = me?.username || "Joueur 1";
      if (isVsAI) {
        mountPlayerHUD(canvas, meName, "IA");
      }
      networkCleanup = wireNetwork(scene!, world, setScore, canvas, isVsAI, meName);
    });
  }

  // Render loop
  const renderFn = () => {
    if (!scene) return;
    const { ball } = world;
    if (Math.abs(ball.position.z) > 0.01) {
      ball.position.z *= 0.85;
      if (Math.abs(ball.position.z) < 0.01) ball.position.z = 0;
    }
    scene.render();
  };
  engine.runRenderLoop(renderFn);

  window.addEventListener("resize", onResize);

  // Ceinture & bretelles : si la page annonce qu’elle part, purge les commandes
  const onLeaving = () => disableGameInput();
  window.addEventListener("page:leaving", onLeaving);

  // 🔹 retourner l’unmount pour le routeur
  return async function unmountPong() {
    // inputs & réseau
    try { await abandonIfUnfinished(); } catch {}

    try { disableGameInput(); } catch {}
    try { networkCleanup?.(); } catch {}

    // timers
    if (tournamentRedirectTimer) {
      clearTimeout(tournamentRedirectTimer);
      tournamentRedirectTimer = undefined;
    }

    // listeners globaux
    try { window.removeEventListener("resize", onResize); } catch {}
    try { window.removeEventListener("page:leaving", onLeaving); } catch {}

    // overlay (si affiché), on le cache
    const wrap = document.getElementById("pong-win-overlay");
    if (wrap) wrap.classList.add("hidden");

    // babylon
    try { engine?.stopRenderLoop(); } catch {}
    try {
      // order: dispose scene d'abord, puis engine
      scene?.dispose();
    } catch {}
    try { engine?.dispose(); } catch {}
    engine = null;
    scene = null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) CREATION MONDE
// ─────────────────────────────────────────────────────────────────────────────

function createWorld(scene: Scene) {
  const paddleMatL = makeNeonMaterial("paddleMatL", scene, THEME.neonPrimary);
  const paddleMatR = makeNeonMaterial("paddleMatR", scene, THEME.neonSecondary);
  const ballMat = makeNeonMaterial("ballMat", scene, THEME.neonAccent);

  const leftPaddle = MeshBuilder.CreateBox(
    "leftPaddle",
    { width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 1 },
    scene
  );
  leftPaddle.material = paddleMatL;
  leftPaddle.position.x = -GAME.WIDTH / 2 + GAME.PADDLE_THICK;
  leftPaddle.rotation.z = Math.PI / 2;

  const rightPaddle = MeshBuilder.CreateBox(
    "rightPaddle",
    { width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 1 },
    scene
  );
  rightPaddle.material = paddleMatR;
  rightPaddle.position.x = GAME.WIDTH / 2 - GAME.PADDLE_THICK;
  rightPaddle.rotation.z = Math.PI / 2;

  const ball = MeshBuilder.CreateSphere(
    "ball",
    { diameter: GAME.BALL_SIZE, segments: GAME.BALL_SEGMENTS },
    scene
  );
  ball.material = ballMat;

  const trail = new TrailMesh("ballTrail", ball, scene, 8, 10, true);
  const trailMat = new StandardMaterial("trailMat", scene);
  trailMat.emissiveColor = THEME.neonAccent;
  trailMat.disableLighting = true;
  trailMat.alpha = 1;
  trail.material = trailMat;

  createMiddleLine(scene);

  return { leftPaddle, rightPaddle, ball, trail };
}

function createMiddleLine(scene: Scene, segmentHeight = 10, gap = 10) {
  const lineMat = makeNeonMaterial("lineMat", scene, THEME.white);
  lineMat.backFaceCulling = false;
  lineMat.disableDepthWrite = true;
  const FRAME_Z = 0.25;
  const RG = 2;

  const segments = Math.floor(GAME.HEIGHT / (segmentHeight + gap));
  for (let i = 0; i < segments; i++) {
    const seg = MeshBuilder.CreateBox(
      `lineSeg${i}`,
      { width: 2, height: segmentHeight, depth: 0.5 },
      scene
    );
    seg.material = lineMat;
    seg.position.set(0, GAME.HEIGHT / 2 - (i + 0.5) * (segmentHeight + gap), FRAME_Z);
    seg.renderingGroupId = RG;
  }

  const up = MeshBuilder.CreateBox("hUp", { width: GAME.WIDTH, height: 2, depth: 0.5 }, scene);
  const down = MeshBuilder.CreateBox("hDown", { width: GAME.WIDTH, height: 2, depth: 0.5 }, scene);
  const left = MeshBuilder.CreateBox("vLeft", { width: 2, height: GAME.HEIGHT, depth: 0.5 }, scene);
  const right = MeshBuilder.CreateBox("vRight", { width: 2, height: GAME.HEIGHT, depth: 0.5 }, scene);

  up.material = down.material = right.material = left.material = lineMat;
  up.position.set(0, GAME.HEIGHT / 2, FRAME_Z);
  down.position.set(0, -GAME.HEIGHT / 2, FRAME_Z);
  right.position.set(GAME.WIDTH / 2, 0, FRAME_Z);
  left.position.set(-GAME.WIDTH / 2, 0, FRAME_Z);

  up.renderingGroupId = down.renderingGroupId = left.renderingGroupId = right.renderingGroupId = RG;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) CAMERAS
// ─────────────────────────────────────────────────────────────────────────────

function createCameras(scene: Scene) {
  const main = new FreeCamera("mainCam", new Vector3(0, -300, -500), scene);
  main.setTarget(Vector3.Zero());
  main.fov = 0.9;

  const cine = new FreeCamera("secondCam", new Vector3(0, -120, -750), scene);
  cine.setTarget(new Vector3(0, -40, 0));
  cine.fov = 0.8;

  const persp = new FreeCamera("gameCam", new Vector3(0, 0, -1000), scene);
  persp.mode = Camera.ORTHOGRAPHIC_CAMERA;
  persp.orthoLeft = -GAME.WIDTH / 2;
  persp.orthoRight = GAME.WIDTH / 2;
  persp.orthoTop = GAME.HEIGHT / 2;
  persp.orthoBottom = -GAME.HEIGHT / 2;
  persp.setTarget(Vector3.Zero());

  scene.activeCamera = main;
  return { main, cine, persp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) RÉSEAU + CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

async function finishGame(scoreP1: number, scoreP2: number) {
  try {
    const res = await fetchWithAuth("/api/match/latest");
    const data = await res.json();

    if (!data.ok || !data.match_id) {
      console.error("Impossible de récupérer le match :", data);
      return;
    }

    const matchId = data.match_id;

    const finishRes = await fetchWithAuth(`/api/match/${matchId}/finish`, {
      method: "PATCH",
      json: { score_p1: scoreP1, score_p2: scoreP2 },
    });

    const finishData = await finishRes.json();

    if (!finishData.ok) {
      console.error("Impossible de finir le match :", finishData.error);
      return;
    }

    console.log("Match terminé :", finishData.match);
  } catch (err) {
    console.error("Erreur lors de la fin du match :", err);
  }
}

function wireNetwork(
  scene: Scene,
  world: { leftPaddle: any; rightPaddle: any; ball: any; trail: any },
  setScore: (l: number, r: number) => void,
  canvas: HTMLCanvasElement,
  isVsAI: boolean,
  meName: string
) {
  const { leftPaddle, rightPaddle, ball, trail } = world;

  const ws: Socket = io("https://localhost:8443", {
    path: "/ws",
    transports: ["websocket"],
    withCredentials: true
  });

  let expectedEpoch: number | null = null;
  let armed = false;

  ws.on("connect", () => {
    ws.emit("restart");
    ws.emit("setAi", { enabled: isVsAI });
  });

  ws.on("restarted", (payload: any) => {
    expectedEpoch = Number(payload?.epoch) || 0;
    armed = true;
  });

  let prev = { vx: 0, vy: 0, bx: 0, by: 0, sl: 0, sr: 0 };
  let ballHiddenForWin = false;
  let gameEnded = false;
  let lastStatus: "init" | "idle" | "playing" | "finished" = "init";

  const onState = (s: any) => {
    if (!armed) return;
    if (expectedEpoch !== null && s.epoch !== undefined && expectedEpoch !== s.epoch) return;
    if (gameEnded) return;

    leftPaddle.position.y = s.left.y;
    rightPaddle.position.y = s.right.y;
    ball.position.x = s.ball.x;
    ball.position.y = s.ball.y;

    setScore(s.score.left, s.score.right);

    if (prev.vx !== 0 && s.ball.vx !== 0 && prev.vx * s.ball.vx < 0) {
      const col = s.ball.x >= 0 ? THEME.neonSecondary : THEME.neonPrimary;
      playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), col);
      ball.position.z = 8;
    }

    if (prev.vy !== 0 && s.ball.vy !== 0 && prev.vy * s.ball.vy < 0) {
      playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), THEME.white);
    }

    const scoredLeft = s.score.left > prev.sl;
    const scoredRight = s.score.right > prev.sr;
    if (scoredLeft) {
      const impact = computeGoalImpact(prev, "right");
      playHitParticles(scene, impact, THEME.neonPrimary, 20);
    }
    if (scoredRight) {
      const impact = computeGoalImpact(prev, "left");
      playHitParticles(scene, impact, THEME.neonSecondary, 20);
    }

    const finishedNow = s.status === "finished" && lastStatus !== "finished";
    if (finishedNow) {
      const leftWins = s.score.left >= GAME.WIN_SCORE;
      let winnerName = "Left";
      if (isVsAI) {
        winnerName = leftWins ? meName : "IA";
      } else {
        const lm = readLocalMatch();
        winnerName = lm ? (leftWins ? lm.p1.username : lm.p2.username) : (leftWins ? "Left" : "Right");
      }

      const lm = readLocalMatch();
      if (lm && lm.tournamentReturn) {
        notifyTournamentIfAny(winnerName, s.score.left, s.score.right);
      }

      const winnerColor = leftWins ? THEME.neonPrimary : THEME.neonSecondary;
      ball.position.set(0, 0, 0);
      explodeBall(scene, ball, trail, winnerColor);
      ballHiddenForWin = true;

      disableGameInput();

      gameEnded = true;
      finishGame(s.score.left, s.score.right);

      showWinOverlay(canvas, winnerName, s.score.left, s.score.right, leftWins ? "#00e5ff" : "#ff3cac");
    }

    if (ballHiddenForWin && s.score.left === 0 && s.score.right === 0) {
      ball.isVisible = true;
      if (trail) trail.isVisible = true;
      ball.scaling.set(1, 1, 1);
      ballHiddenForWin = false;

      const wrap = document.getElementById("pong-win-overlay");
      if (wrap) wrap.classList.add("hidden");
    }

    prev = { vx: s.ball.vx, vy: s.ball.vy, bx: s.ball.x, by: s.ball.y, sl: s.score.left, sr: s.score.right };
    lastStatus = (s.status as "idle" | "playing" | "finished") || "idle";
  };

  ws.on("state", onState);

  setupControls(
    ws,
    scene,
    scene.getCameraByName("mainCam") as FreeCamera,
    scene.getCameraByName("secondCam") as FreeCamera,
    scene.getCameraByName("gameCam") as FreeCamera,
    isVsAI
  );

  // 🔹 retourne une fonction de nettoyage réseau + input
  return function cleanupNetwork() {
    try { ws.off("state", onState); } catch {}
    try { ws.disconnect(); } catch {}
    try { ws.close(); } catch {}
    disableGameInput();
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// 6) HUD / OVERLAYS
// ─────────────────────────────────────────────────────────────────────────────

function mountScoreHUD(canvas: HTMLCanvasElement) {
  let el = document.getElementById("pong-score") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "pong-score";
    Object.assign(el.style, {
      position: "absolute",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "#fff",
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      fontWeight: "800",
      fontSize: "44px",
      textShadow: "0 0 10px rgba(0,0,0,.9)",
      pointerEvents: "none",
      zIndex: "3",
    } as CSSStyleDeclaration);
    const parent = canvas.parentElement!;
    parent.style.position ||= "relative";
    parent.appendChild(el);
  }
  return (l: number, r: number) => { el!.textContent = `${l} - ${r}`; };
}

function mountPlayerHUD(canvas: HTMLCanvasElement, p1: string, p2: string) {
  let banner = document.getElementById("pong-players-banner") as HTMLDivElement | null;
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pong-players-banner";
    Object.assign(banner.style, {
      position: "absolute",
      top: "56px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "#fff",
      fontWeight: "700",
      fontSize: "14px",
      textShadow: "0 0 8px rgba(0,0,0,.7)",
      pointerEvents: "none",
      zIndex: "3",
      letterSpacing: ".3px",
      whiteSpace: "nowrap",
    } as CSSStyleDeclaration);
    canvas.parentElement!.appendChild(banner);
  }
  banner.textContent = `${p1} (W/S) vs ${p2} (↑/↓)`;

  let left = document.getElementById("pong-left-label") as HTMLDivElement | null;
  if (!left) {
    left = document.createElement("div");
    left.id = "pong-left-label";
    Object.assign(left.style, {
      position: "absolute",
      left: "8px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#9be7ff",
      fontWeight: "800",
      textShadow: "0 0 8px rgba(0,0,0,.7)",
      pointerEvents: "none",
      zIndex: "3",
    } as CSSStyleDeclaration);
    canvas.parentElement!.appendChild(left);
  }
  left.textContent = p1;

  let right = document.getElementById("pong-right-label") as HTMLDivElement | null;
  if (!right) {
    right = document.createElement("div");
    right.id = "pong-right-label";
    Object.assign(right.style, {
      position: "absolute",
      right: "8px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#ff9bd6",
      fontWeight: "800",
      textShadow: "0 0 8px rgba(0,0,0,.7)",
      pointerEvents: "none",
      zIndex: "3",
      textAlign: "right",
    } as CSSStyleDeclaration);
    canvas.parentElement!.appendChild(right);
  }
  right.textContent = p2;
}

function ensureWinOverlay(canvas: HTMLCanvasElement) {
  let wrap = document.getElementById("pong-win-overlay") as HTMLDivElement | null;
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "pong-win-overlay";
    wrap.className = "hidden";
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(5, 0, 20, 0.6)",
      backdropFilter: "blur(2px)",
      zIndex: "5",
    } as CSSStyleDeclaration);

    const card = document.createElement("div");
    Object.assign(card.style, {
      minWidth: "min(90vw, 520px)",
      padding: "24px",
      borderRadius: "16px",
      background: "linear-gradient(135deg, rgba(88,28,135,.7), rgba(190,24,93,.6))",
      color: "white",
      boxShadow: "0 10px 40px rgba(0,0,0,.35)",
      textAlign: "center",
    } as CSSStyleDeclaration);

    card.innerHTML = `
      <h3 id="win-title" style="font-size:28px;font-weight:900;margin:0 0 6px"></h3>
      <p id="win-sub" style="opacity:.9;margin:0 0 16px"></p>
      <div id="win-score" style="font-size:40px;font-weight:800;margin-bottom:18px">0 - 0</div>
      <div id="win-countdown" style="font-size:14px;opacity:.9"></div>
    `;
    wrap.appendChild(card);
    canvas.parentElement!.style.position ||= "relative";
    canvas.parentElement!.appendChild(wrap);
  }
  return wrap;
}

function showWinOverlay(canvas: HTMLCanvasElement, winnerName: string, scoreL: number, scoreR: number, winnerColor: string) {
  const wrap = ensureWinOverlay(canvas);
  const title = wrap.querySelector("#win-title") as HTMLHeadingElement;
  const sub = wrap.querySelector("#win-sub") as HTMLParagraphElement;
  const sc = wrap.querySelector("#win-score") as HTMLDivElement;
  const cd = wrap.querySelector("#win-countdown") as HTMLDivElement | null;

  title.textContent = t("pong.win.title", { name: winnerName });
  title.style.textShadow = `0 0 14px ${winnerColor}`;
  sub.textContent = t("pong.win.subtitle");
  sc.textContent = `${scoreL} - ${scoreR}`;

  let redirectTo = "/play";
  let isTournament = false;
  try {
    const lmRaw = sessionStorage.getItem("localMatch");
    if (lmRaw) {
      const lm = JSON.parse(lmRaw);
      if (lm?.tournamentReturn) {
        redirectTo = lm.tournamentReturn;
        isTournament = true;
      }
    }
  } catch {}

  let seconds = COUNTDOWN_SECONDS;
  const cdUpdate = () => {
    if (!cd) return;
    cd.textContent = isTournament
      ? t("pong.win.countdown_bracket", { s: seconds })
      : t("pong.win.countdown_play", { s: seconds });
  };
  cdUpdate();

  wrap.classList.remove("hidden");

  if (tournamentRedirectTimer) clearTimeout(tournamentRedirectTimer);

  const tick = () => {
    seconds -= 1;
    cdUpdate();
    if (seconds <= 0) {
      sessionStorage.removeItem("localMatch");
      history.pushState({}, "", redirectTo);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    tournamentRedirectTimer = setTimeout(tick, 1000);
  };

  tournamentRedirectTimer = setTimeout(tick, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) EFFETS
// ─────────────────────────────────────────────────────────────────────────────

function makeNeonMaterial(name: string, scene: Scene, color: Color3) {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = color;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  return m;
}

function makeCircleDataURL(size = 32) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
}

function playHitParticles(scene: Scene, pos: Vector3, color: Color3, strength = 5) {
  const max = Math.round(600 * Math.min(2, strength));
  const ps = new ParticleSystem(`burst-${Math.random().toString(36).slice(2)}`, max, scene);

  ps.particleTexture = new Texture(makeCircleDataURL(24), scene);
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  ps.renderingGroupId = 3;

  ps.emitter = pos.clone();
  ps.updateSpeed = 0.015;

  ps.minSize = 3;  ps.maxSize = 8;
  ps.minLifeTime = 0.18; ps.maxLifeTime = 0.45;

  ps.direction1 = new Vector3(-2, -2, -0.2);
  ps.direction2 = new Vector3( 2,  2,  0.2);

  ps.minEmitPower = 10 * strength;
  ps.maxEmitPower = 20 * strength;

  ps.color1 = new Color4(color.r, color.g, color.b, 1);
  ps.color2 = new Color4(color.r, color.g, color.b, 0.12);
  ps.colorDead = new Color4(0, 0, 0, 0);

  ps.emitRate = Math.round(2000 * Math.min(1.5, strength));
  ps.targetStopDuration = 0.06;
  ps.disposeOnStop = true;

  ps.start();
}

function explodeBall(scene: Scene, ball: any, trail: any, color: Color3) {
  const p = ball.position.clone();
  playHitParticles(scene, p, color, 90);
  setTimeout(() => playHitParticles(scene, p, THEME.white, 40), 80);
  setTimeout(() => playHitParticles(scene, p, color, 25), 160);
  ball.isVisible = false;
  if (trail) trail.isVisible = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) CONTROLES — AbortController = easy cleanup
// ─────────────────────────────────────────────────────────────────────────────

const KEY_LIST = ['w', 's', 'ArrowUp', 'ArrowDown', ' '] as const;
type GameKey = (typeof KEY_LIST)[number];

let controller: AbortController | null = null;

function setupControls(
  ws: any,
  scene: Scene,
  mainCam: FreeCamera,
  secondCam: FreeCamera,
  gameCam: FreeCamera,
  isVsAI: boolean
) {
  controller?.abort();
  controller = new AbortController();

  const keysToLock = new Set<GameKey>(KEY_LIST);

  const onKeyDown = (e: KeyboardEvent) => {
    if (keysToLock.has(e.key as GameKey)) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (scene) {
      if (e.key === "1") scene.activeCamera = mainCam;
      if (e.key === "2") scene.activeCamera = secondCam;
      if (e.key === "3") scene.activeCamera = gameCam;
    }

    if (e.key === "w" || e.key === "s") {
      ws.emit("move", { side: "left", dir: e.key === "w" ? "up" : "down" });
    }
    if (!isVsAI && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      ws.emit("move", { side: "right", dir: e.key === "ArrowUp" ? "up" : "down" });
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (keysToLock.has(e.key as GameKey)) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "w" || e.key === "s") {
      ws.emit("move", { side: "left", dir: "stop" });
    }
    if (!isVsAI && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      ws.emit("move", { side: "right", dir: "stop" });
    }
  };

  document.addEventListener("keydown", onKeyDown, { capture: true, signal: controller.signal });
  document.addEventListener("keyup", onKeyUp, { capture: true, signal: controller.signal });
}

function disableGameInput() {
  controller?.abort();
  controller = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function computeGoalImpact(
  prevBall: { bx: number; by: number; vx: number; vy: number },
  side: "left" | "right"
): Vector3 {
  const boundaryX = side === "left" ? -GAME.WIDTH / 2 : GAME.WIDTH / 2;

  let y = prevBall.by;
  if (prevBall.vx !== 0) {
    const t = (boundaryX - prevBall.bx) / prevBall.vx;
    y = prevBall.by + prevBall.vy * t;
  }

  const pad = 4;
  const minY = -GAME.HEIGHT / 2 + pad;
  const maxY = GAME.HEIGHT / 2 - pad;

  return new Vector3(boundaryX, clamp(y, minY, maxY), 0);
}

function readLocalMatch(): LocalMatch | null {
  try {
    const raw = sessionStorage.getItem("localMatch");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
