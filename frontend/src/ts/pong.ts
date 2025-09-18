// ─────────────────────────────────────────────────────────────────────────────
// PONG 2.5D — Babylon.js (front)
// Refactor léger : structure, lisibilité, commentaires, imports nettoyés.
// Garde : fond transparent, 3 cams, trail, particules (hit/goal/win), score DOM,
//         WS "state" (socket.io), et petites touches de polish.
// ─────────────────────────────────────────────────────────────────────────────

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
import { io } from "socket.io-client";

// ─────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTES & THEME
// ─────────────────────────────────────────────────────────────────────────────

const THEME = {
  bg: Color4.FromHexString("#0b022300"), // transparent
  neonPrimary: Color3.FromHexString("#00e5ff"),     // côté gauche
  neonSecondary: Color3.FromHexString("#ff3cac"),   // côté droit
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

// ─────────────────────────────────────────────────────────────────────────────
// 2) ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export function initPongPage() {
  const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  // Canvas/scene transparents pour laisser voir ton fond vidéo/site
  canvas.style.backgroundColor = "transparent";
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    alpha: true,
    premultipliedAlpha: true,
  });

  const scene = new Scene(engine);
  scene.clearColor = THEME.bg;

  // Lumière douce + glow
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.35;
  const glow = new GlowLayer("glow", scene);
  glow.intensity = 0.55;

  // Monde (paddles/ball/trail/ligne)
  const world = createWorld(scene);

  // Caméras + pipeline (FXAA + bloom léger)
  const cams = createCameras(scene);
  const pipeline = new DefaultRenderingPipeline("drp", true, scene, [cams.main, cams.cine, cams.persp]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.88;
  pipeline.bloomWeight = 0.28;
  pipeline.bloomKernel = 48;

  // HUD score (DOM overlay)
  const setScore = mountScoreHUD(canvas);
  setScore(0, 0);

  // Réseau (WS state) + triggers d’effets
  wireNetwork(scene, world, setScore);

  // Render loop : petit amorti Z pour le “pop” de la balle
  engine.runRenderLoop(() => {
    const { ball } = world;
    if (Math.abs(ball.position.z) > 0.01) {
      ball.position.z *= 0.85;
      if (Math.abs(ball.position.z) < 0.01) ball.position.z = 0;
    }
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) CREATION MONDE
// ─────────────────────────────────────────────────────────────────────────────

function createWorld(scene: Scene) {
  // Matériaux néon
  const paddleMatL = makeNeonMaterial("paddleMatL", scene, THEME.neonPrimary);
  const paddleMatR = makeNeonMaterial("paddleMatR", scene, THEME.neonSecondary);
  const ballMat = makeNeonMaterial("ballMat", scene, THEME.neonAccent);

  // Paddles
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

  // Balle + trail
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

  // Ligne médiane + cadre
  createMiddleLine(scene);

  return { leftPaddle, rightPaddle, ball, trail };
}

function createMiddleLine(scene: Scene, segmentHeight = 10, gap = 10) {
  const lineMat = makeNeonMaterial("lineMat", scene, THEME.white);
  lineMat.backFaceCulling = false;
  lineMat.disableDepthWrite = true; // toujours visible
  const FRAME_Z = 0.25;
  const RG = 2;

  // Pointillés centraux
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

  // Cadre
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
  // Cam 1 : ortho (gameplay net)
  const main = new FreeCamera("mainCam", new Vector3(0, 0, -1000), scene);
  main.mode = Camera.ORTHOGRAPHIC_CAMERA;
  main.orthoLeft = -GAME.WIDTH / 2;
  main.orthoRight = GAME.WIDTH / 2;
  main.orthoTop = GAME.HEIGHT / 2;
  main.orthoBottom = -GAME.HEIGHT / 2;
  main.setTarget(Vector3.Zero());

  // Cam 2 : ciné
  const cine = new FreeCamera("secondCam", new Vector3(0, -300, -500), scene);
  cine.setTarget(Vector3.Zero());
  cine.fov = 0.9;

  // Cam 3 : perspective douce (2.5D)
  const persp = new FreeCamera("gameCam", new Vector3(0, -120, -750), scene);
  persp.setTarget(new Vector3(0, -40, 0));
  persp.fov = 0.8;

  scene.activeCamera = main;
  return { main, cine, persp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) RÉSEAU (WS) + TRIGGERS D'EFFETS
// ─────────────────────────────────────────────────────────────────────────────

function wireNetwork(
  scene: Scene,
  world: { leftPaddle: any; rightPaddle: any; ball: any; trail: any },
  setScore: (l: number, r: number) => void
) {
  const { leftPaddle, rightPaddle, ball, trail } = world;

  const ws = io("http://localhost:3000", { path: "/ws", transports: ["websocket"] });
  ws.on("connect", () => ws.emit("restart"));

  // Mémoire du tick précédent pour détecter inversions et scores
  let prev = { vx: 0, vy: 0, bx: 0, by: 0, sl: 0, sr: 0 };
  let ballHiddenForWin = false;

  ws.on("state", (s: any) => {
    // Sync transforms
    leftPaddle.position.y = s.left.y;
    rightPaddle.position.y = s.right.y;
    ball.position.x = s.ball.x;
    ball.position.y = s.ball.y;

    // Score
    setScore(s.score.left, s.score.right);

    // Rebond paddle (vx inverse)
    if (prev.vx !== 0 && s.ball.vx !== 0 && (prev.vx * s.ball.vx) < 0) {
      const col = s.ball.x >= 0 ? THEME.neonSecondary : THEME.neonPrimary;
      playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), col);
      ball.position.z = 8; // pop
    }

    // Rebond mur (vy inverse)
    if (prev.vy !== 0 && s.ball.vy !== 0 && (prev.vy * s.ball.vy) < 0) {
      playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), THEME.white);
    }

    // But marque : explosion au point d’impact sur le bord correspondant
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

    // Fin de partie (atteint WIN_SCORE) : explosion centrale & disparition balle
    const finishedNow =
      (s.score.left >= GAME.WIN_SCORE || s.score.right >= GAME.WIN_SCORE) &&
      (prev.sl < GAME.WIN_SCORE && prev.sr < GAME.WIN_SCORE);

    if (finishedNow) {
      const winnerColor = s.score.left >= GAME.WIN_SCORE ? THEME.neonPrimary : THEME.neonSecondary;
      ball.position.set(0, 0, 0);
      explodeBall(scene, ball, trail, winnerColor);
      ballHiddenForWin = true;
    }

    // Nouvelle manche (scores remis à 0) → on réaffiche la balle/trail
    if (ballHiddenForWin && s.score.left === 0 && s.score.right === 0) {
      ball.isVisible = true;
      if (trail) trail.isVisible = true;
      ball.scaling.set(1, 1, 1);
      ballHiddenForWin = false;
    }

    // Save prev
    prev = { vx: s.ball.vx, vy: s.ball.vy, bx: s.ball.x, by: s.ball.y, sl: s.score.left, sr: s.score.right };
  });

  // Contrôles clavier (changement de caméra + mouvements)
  setupControls(ws, scene, scene.getCameraByName("mainCam") as FreeCamera,
                      scene.getCameraByName("secondCam") as FreeCamera,
                      scene.getCameraByName("gameCam") as FreeCamera);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) HUD SCORE (DOM Overlay minimal)
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

// ─────────────────────────────────────────────────────────────────────────────
// 7) EFFETS — matériaux, particules, “grosse explosion” de fin
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
  // Capacité proportionnelle (évite les limites trop basses)
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

  // Gros burst multi-couches
  playHitParticles(scene, p, color, 90);
  setTimeout(() => playHitParticles(scene, p, THEME.white, 40), 80);
  setTimeout(() => playHitParticles(scene, p, color, 25), 160);

  // Disparition immédiate (on simule l’explosion de la balle)
  ball.isVisible = false;
  if (trail) trail.isVisible = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) CONTROLES
// ─────────────────────────────────────────────────────────────────────────────

function setupControls(
  ws: any,
  scene: Scene,
  mainCam: FreeCamera,
  secondCam: FreeCamera,
  gameCam: FreeCamera
) {
  const keysToLock = ["w", "s", "ArrowUp", "ArrowDown", " "];

  document.addEventListener("keydown", (e) => {
    if (keysToLock.includes(e.key)) e.preventDefault();

    if (e.key === "1") scene.activeCamera = mainCam;
    if (e.key === "2") scene.activeCamera = secondCam;
    if (e.key === "3") scene.activeCamera = gameCam;

    if (e.key === "w" || e.key === "s")
      ws.emit("move", { side: "left", dir: e.key === "w" ? "up" : "down" });
    if (e.key === "ArrowUp" || e.key === "ArrowDown")
      ws.emit("move", { side: "right", dir: e.key === "ArrowUp" ? "up" : "down" });
  });

  document.addEventListener("keyup", (e) => {
    if (keysToLock.includes(e.key)) e.preventDefault();

    if (e.key === "w" || e.key === "s") ws.emit("move", { side: "left", dir: "stop" });
    if (e.key === "ArrowUp" || e.key === "ArrowDown") ws.emit("move", { side: "right", dir: "stop" });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) UTILITAIRES (math & impact but)
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
