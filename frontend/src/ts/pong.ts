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
// (Option) Trail : décommente si tu veux le sillage après que tout marche
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";

import { AdvancedDynamicTexture, TextBlock, Control } from "@babylonjs/gui";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { io } from "socket.io-client";

const THEME = {
  // on garde les couleurs pour les néons, mais on VA rendre le clearColor transparent
  bg: Color4.FromHexString("#0b022300"), // alpha 0
  neonPrimary: Color3.FromHexString("#00e5ff"),
  neonSecondary: Color3.FromHexString("#ff3cac"),
  neonAccent: Color3.FromHexString("#eeff03"),
  white: Color3.White(),
};

const GAME = {
  WIDTH: 800,
  HEIGHT: 400,
  PADDLE_LEN: 90,
  PADDLE_THICK: 10,
  BALL_SIZE: 15,
  BALL_SEGMENTS: 32,
};

export function initPongPage() {
  const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  // Canvas/scene transparents
  canvas.style.backgroundColor = "transparent";

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    alpha: true,               // clé pour transparence
    premultipliedAlpha: true,
  });

  const scene = new Scene(engine);
  scene.clearColor = THEME.bg; // transparent

  // Néon + lumière douce (presque inutile car emissive)
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.35;

  const glow = new GlowLayer("glow", scene);
  glow.intensity = 0.55;

  // Objets
  const { leftPaddle, rightPaddle, ball } = createGameObjects(scene);

  // Caméras
  const { mainCam, secondCam, gameCam } = createCameras(scene);

  // Post-process léger
  const pipeline = new DefaultRenderingPipeline("drp", true, scene, [mainCam, secondCam, gameCam]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.88;
  pipeline.bloomWeight = 0.28;
  pipeline.bloomKernel = 48;

  // HUD score (overlay 2D)
  const scoreEL = ensureScoreEl(canvas);
  const setScore = (l: number, r: number) => {scoreEL.textContent = `${l} - ${r}`;};
  setScore(0, 0);
  // Réseau
  const ws = io("http://localhost:3000", { path: "/ws", transports: ["websocket"] });

  ws.on("connect", () => { ws.emit("restart") });

  let prev = { vx: 0, vy: 0, sl: 0, sr: 0};
	ws.on("state", (s: any) => {
		leftPaddle.position.y = s.left.y;
		rightPaddle.position.y = s.right.y;
		ball.position.x = s.ball.x;
		ball.position.y = s.ball.y;
		setScore(s.score.left, s.score.right);

		// --- Détections ---
		// Rebond paddle => inversion de vx
		if (prev.vx !== 0 && s.ball.vx !== 0 && (prev.vx * s.ball.vx) < 0) {
			const col = s.ball.x >= 0 ? THEME.neonSecondary : THEME.neonPrimary;
			playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), col);
			// petit "pop" vers la caméra
			ball.position.z = 8;
		}
		// Rebond mur haut/bas => inversion de vy
		if (prev.vy !== 0 && s.ball.vy !== 0 && (prev.vy * s.ball.vy) < 0) {
			playHitParticles(scene, new Vector3(s.ball.x, s.ball.y, 0), THEME.white);
		}
		// Score changé => burst au centre
		if (s.score.left !== prev.sl || s.score.right !== prev.sr) {
			playHitParticles(scene, new Vector3(0, 0, 0), THEME.white);
		}

		prev = { vx: s.ball.vx, vy: s.ball.vy, sl: s.score.left, sr: s.score.right };
	});

  setupControls(ws, scene, mainCam, secondCam, gameCam);

	engine.runRenderLoop(() => {
  	// decay du pop Z
  	if (Math.abs(ball.position.z) > 0.01) {
  	  ball.position.z *= 0.85;
  	  if (Math.abs(ball.position.z) < 0.01) ball.position.z = 0;
  	}
  	scene.render();
	});
  window.addEventListener("resize", () => engine.resize());
}

/* =========================
   Helpers & construction
   ========================= */

function makeNeonMaterial(name: string, scene: Scene, color: Color3) {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = color;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  return m;
}

function ensureScoreEl(canvas: HTMLCanvasElement) {
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
	return el;
}

function createGameObjects(scene: Scene) {
  // Paddles
  const paddleMatL = makeNeonMaterial("paddleMatL", scene, THEME.neonPrimary);
  const paddleMatR = makeNeonMaterial("paddleMatR", scene, THEME.neonSecondary);

  const leftPaddle = MeshBuilder.CreateBox(
    "leftPaddle",
    { width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 3 },
    scene
  );
  leftPaddle.material = paddleMatL;
  leftPaddle.position.x = -GAME.WIDTH / 2 + GAME.PADDLE_THICK;
  leftPaddle.rotation.z = Math.PI / 2;

  const rightPaddle = MeshBuilder.CreateBox(
    "rightPaddle",
    { width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 3 },
    scene
  );
  rightPaddle.material = paddleMatR;
  rightPaddle.position.x = GAME.WIDTH / 2 - GAME.PADDLE_THICK;
  rightPaddle.rotation.z = Math.PI / 2;

  // Balle : plus petite et segments élevés => bien ronde
  const ball = MeshBuilder.CreateSphere(
    "ball",
    { diameter: GAME.BALL_SIZE, segments: GAME.BALL_SEGMENTS },
    scene
  );
  ball.material = makeNeonMaterial("ballMat", scene, THEME.neonAccent);

  // (Option) sillage discret – à activer plus tard si tu veux
  const trail = new TrailMesh("ballTrail", ball, scene, 8, 100, true);
  const trailMat = new StandardMaterial("trailMat", scene);
  trailMat.emissiveColor = THEME.neonAccent;
  trailMat.disableLighting = true;
  trailMat.alpha = 1;
  trail.material = trailMat;
  // Ligne médiane + cadre néon (rien d'autre : le fond vient de ta page)
  createMiddleLine(scene);

  return { leftPaddle, rightPaddle, ball };
}

function createMiddleLine(scene: Scene, segmentHeight = 10, gap = 10) {
  const lineMat = makeNeonMaterial("lineMat", scene, THEME.white);
  // Ces 3 lignes garantissent que les segments passent devant
  lineMat.backFaceCulling = false;
  lineMat.forceDepthWrite = true;
  lineMat.zOffset = -2; // “tire” le depth vers la caméra

  const FRAME_Z = 0.2;      // on met le cadre 0.2 devant le plan des paddles
  const RG = 2;             // rendu après le reste (ball/paddles en RG=1 par défaut)

  // pointillés centraux
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

  // cadre
  const up = MeshBuilder.CreateBox("hUp", { width: GAME.WIDTH, height: 1, depth: 0.5 }, scene);
  const down = MeshBuilder.CreateBox("hDown", { width: GAME.WIDTH, height: 1, depth: 0.5 }, scene);
  const left = MeshBuilder.CreateBox("vLeft", { width: 1, height: GAME.HEIGHT, depth: 0.5 }, scene);
  const right = MeshBuilder.CreateBox("vRight", { width: 1, height: GAME.HEIGHT, depth: 0.5 }, scene);

  up.material = down.material = right.material = left.material = lineMat;

  up.position.set(0,  GAME.HEIGHT / 2, FRAME_Z);
  down.position.set(0, -GAME.HEIGHT / 2, FRAME_Z);
  right.position.set( GAME.WIDTH / 2, 0, FRAME_Z);
  left.position.set(-GAME.WIDTH / 2, 0, FRAME_Z);

  up.renderingGroupId = down.renderingGroupId = left.renderingGroupId = right.renderingGroupId = RG;
}

function createCameras(scene: Scene) {
  // Caméra 1 : orthographique (gameplay net)
  const mainCam = new FreeCamera("mainCam", new Vector3(0, 0, -1000), scene);
  mainCam.mode = Camera.ORTHOGRAPHIC_CAMERA;
  mainCam.orthoLeft = -GAME.WIDTH / 2;
  mainCam.orthoRight = GAME.WIDTH / 2;
  mainCam.orthoTop = GAME.HEIGHT / 2;
  mainCam.orthoBottom = -GAME.HEIGHT / 2;
  mainCam.setTarget(Vector3.Zero());

  // Caméra 2 : ciné
  const secondCam = new FreeCamera("secondCam", new Vector3(0, -300, -500), scene);
  secondCam.setTarget(Vector3.Zero());
  secondCam.fov = 0.9;

  // Caméra 3 : perspective douce (2.5D)
  const gameCam = new FreeCamera("gameCam", new Vector3(0, -120, -750), scene);
  gameCam.setTarget(new Vector3(0, -40, 0));
  gameCam.fov = 0.8;

  scene.activeCamera = mainCam;
  return { mainCam, secondCam, gameCam };
}

function playHitParticles(scene: Scene, pos: Vector3, color: Color3) {
  const ps = new ParticleSystem("hit", 60, scene);
  // petit pixel blanc en base64 (évite d’héberger un png)
  ps.particleTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axV6eQAAAAASUVORK5CYII=",
    scene
  );
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE; // additif = néon
  ps.emitter = pos.clone();
  ps.minSize = 4; ps.maxSize = 8;
  ps.minEmitPower = 2; ps.maxEmitPower = 5;
  ps.minLifeTime = 0.12; ps.maxLifeTime = 0.3;
  ps.emitRate = 0;
  ps.color1 = new Color4(color.r, color.g, color.b, 1);
  ps.color2 = new Color4(color.r, color.g, color.b, 0.25);
  ps.disposeOnStop = true;
  ps.start();
  ps.manualEmitCount = 40; // burst court
  setTimeout(() => ps.stop(), 60);
}

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
