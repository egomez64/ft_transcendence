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
	DynamicTexture,
	Camera,
	LinesMesh,
} from "@babylonjs/core";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";

const THEME = {
	bg: Color4.FromHexString('#0b0223ff'),
	neonPrimary: Color3.FromHexString('#00e5ff'),
	neonSecondary: Color3.FromHexString('#ff3cac'),
	neonAccent: Color3.FromHexString('#ffe700'),
	white: Color3.White(),
};

const GAME = {
	WIDTH: 800,
	HEIGHT: 400,
	PADDLE_LEN: 80,
	PADDLE_THICK: 10,
	BALL_SIZE: 10,
};

export function initPongPage() {
	const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
	if (!canvas) return;

	const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
	const scene = new Scene(engine);

	scene.clearColor = THEME.bg;

	const light = new HemisphericLight("light", new Vector3(0,1,0), scene);
	light.intensity = 0.4;

	const glow = new GlowLayer("glow", scene);
	glow.intensity = 0.6;

	const { leftPaddle, rightPaddle, ball, scoreTexture } = createGameObject(scene);
	const { mainCam, secondCam } = createCameras(scene);

	const ws = new WebSocket("ws://localhost:3000/ws");
	ws.onopen = () => console.log("Connecté au serveur Pong WS");
	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (msg.type === "state") {
			const s = msg.state;
			leftPaddle.position.y = s.left.y;
			rightPaddle.position.y = s.right.y;
			ball.position.x = s.ball.x;
			ball.position.y = s.ball.y;
			updateScoreDynamicTexture(scoreTexture, s.score.left, s.score.right);
		}
	};

	setupControls(ws, scene, mainCam, secondCam);

	engine.runRenderLoop(() => scene.render());
	window.addEventListener("resize", () => engine.resize());
}

function makeNeonMaterial(name: string, scene: Scene, color: Color3) {
	const m = new StandardMaterial(name, scene);
	m.emissiveColor = color;
	m.diffuseColor = Color3.Black();
	m.specularColor = Color3.Black();
	m.disableLighting = true;
	return m;
}

function createGameObject(scene: Scene) {
	const paddleMatL = makeNeonMaterial("paddleMatL", scene, THEME.neonPrimary);
	const paddleMatR = makeNeonMaterial("paddleMatR", scene, THEME.neonSecondary);
	const ballMat = makeNeonMaterial("ballMat", scene, THEME.neonAccent);

	const leftPaddle = MeshBuilder.CreateBox("leftPaddle", {
		width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 2
	}, scene);
	leftPaddle.material = paddleMatL;
	leftPaddle.position.x = -GAME.WIDTH / 2 + GAME.PADDLE_THICK;
	leftPaddle.rotation.z = Math.PI / 2;

	const rightPaddle = MeshBuilder.CreateBox("rightPaddle", {
		width: GAME.PADDLE_LEN, height: GAME.PADDLE_THICK, depth: 2
	}, scene);
	rightPaddle.material = paddleMatR;
	rightPaddle.position.x = GAME.WIDTH / 2 - GAME.PADDLE_THICK;
	rightPaddle.rotation.z = Math.PI /2;

	const ball = MeshBuilder.CreateSphere("ball", {diameter: GAME.BALL_SIZE, segments: 12}, scene );
	ball.material = ballMat;

	createMiddleLine(scene, GAME.HEIGHT);

	createNeonGrid(scene, {
		cols: 16, rows: 8, cell: 50,
		color: THEME.neonSecondary,
		y: -GAME.HEIGHT / 2 - 40,
		z: 40,
		tiltDeg: 60,
	});

	const { dt: scoreTexture } = createScorePlane(scene);
	return { leftPaddle, rightPaddle, ball, scoreTexture};
}

function createMiddleLine(scene: Scene, gameHeight: number, segmentHeight = 10, gap = 10) {
	const lineMat = makeNeonMaterial("lineMat", scene, THEME.white);

	const segments = Math.floor(gameHeight / (segmentHeight + gap));
	for (let i = 0; i < segments; i++) {
		const seg = MeshBuilder.CreateBox(`lineSeg${i}`, { width:2, height:segmentHeight, depth: 0.5}, scene);
		seg.material = lineMat;
		seg.position.x = 0;
		seg.position.y = gameHeight / 2 - (i + 0.5) * (segmentHeight + gap);
	}
	//cadre
	const up = MeshBuilder.CreateBox("hUp", {width: GAME.WIDTH, height: 1, depth: 0.5}, scene);
	const down = MeshBuilder.CreateBox("hDown", {width: GAME.WIDTH, height: 1, depth: 0.5}, scene);
	const left = MeshBuilder.CreateBox("vLeft", { width: 1, height: GAME.HEIGHT, depth: 0.5}, scene);
	const right = MeshBuilder.CreateBox("vRight", { width: 1, height: GAME.HEIGHT, depth: 0.5}, scene);

	up.material = down.material = right.material = left.material = lineMat;

	up.position.y = GAME.HEIGHT / 2;
	down.position.y = -GAME.HEIGHT / 2;
	right.position.x = GAME.WIDTH / 2;
	left.position.x = -GAME.WIDTH / 2;
}

//grid neon

function createNeonGrid(
	scene: Scene,
	opts: { cols: number; rows: number; cell: number; color: Color3; y?: number; z?: number; tiltDeg?: number }
) {
	const { cols, rows, cell, color } = opts;
	const y = opts.y ?? -200;
	const z = opts.z ?? 80;
	const tilt = (opts.tiltDeg ?? 60) * Math.PI / 180;

	const lines: Vector3[][] = [];

	const width = cols * cell;
	const depth = rows * cell;

	//ligne verticale
	for (let c = 0; c <= cols; c++) {
		const x = -width / 2 + c * cell;
		lines.push([new Vector3(x, 0, -depth / 2), new Vector3(x, 0, depth / 2)]);
	}

	// lign horizontale
	for (let r = 0; r <= rows; r++) {
		const zz = -depth / 2 + r * cell;
		lines.push([new Vector3(-width / 2, 0, zz), new Vector3(width / 2, 0, zz)]);
	}

	const lm = MeshBuilder.CreateLineSystem("neonGrid", { lines, updatable: false}, scene) as LinesMesh;
	lm.color = color;

	lm.position = new Vector3(0, y, z);
	lm.rotation.x = tilt;
}

//CAM

function createCameras(scene: Scene) {
	const mainCam = new FreeCamera("mainCam", new Vector3(0,0, -1000), scene);
	mainCam.mode = Camera.ORTHOGRAPHIC_CAMERA;

	mainCam.orthoLeft = -GAME.WIDTH / 2;
	mainCam.orthoRight = GAME.WIDTH / 2;
	mainCam.orthoTop = GAME.HEIGHT / 2;
	mainCam.orthoBottom = -GAME.HEIGHT / 2;
	mainCam.setTarget(Vector3.Zero());

	const secondCam = new FreeCamera("secondeCam", new Vector3(0, -300, -500), scene);
	secondCam.setTarget(Vector3.Zero());
	secondCam.fov = 0.9;

	scene.activeCamera = mainCam;
	return { mainCam, secondCam };
}

//controle
function setupControls(
	ws: WebSocket,
	scene: Scene,
	mainCam: FreeCamera,
	secondCam: FreeCamera
){
	const keysToLock = ["w", "s", "ArrowUp", "ArrowDown", " "];

	document.addEventListener("keydown", (e) => {
		if (keysToLock.includes(e.key)) e.preventDefault();

		if (e.key === "1") scene.activeCamera = mainCam;
		if (e.key === "2") scene.activeCamera = secondCam;

		if (e.key === "w" || e.key === "s")
			ws.send(JSON.stringify({ type: "move", side: "left", dir: e.key === "w" ? "up" : "down"}));

		if (e.key === "ArrowUp" || e.key === "ArrowDown")
			ws.send(JSON.stringify({ type: "move", side: "right", dir: e.key === "ArrowUp" ? "up" : "down"}));	
	});

	document.addEventListener("keyup", (e) => {
		if (keysToLock.includes(e.key)) e.preventDefault();

		if (e.key === "w" || e.key === "s")
			ws.send(JSON.stringify({ type: "move", side: "left", dir : "stop"}));
		if (e.key === "ArrowUp" || e.key === "ArrowDown")
			ws.send(JSON.stringify({ type: "move", side: "right", dir : "stop"}));
	});
}

//SCORE HUD

function createScorePlane(scene: Scene) {
	const plane = MeshBuilder.CreatePlane("scorePlane", { width: 120, height: 48}, scene);
	const dt = new DynamicTexture("scoreDT", { width: 512, height: 192 }, scene);

	const mat = new StandardMaterial("scoreMat", scene);
	mat.diffuseTexture = dt;
	mat.emissiveColor = THEME.white;
	mat.disableLighting = true;

	plane.material = mat;
	plane.position.y = GAME.HEIGHT / 2 - 25;
	plane.position.z = 0;
	
	return { dt };
}

function updateScoreDynamicTexture(dt: DynamicTexture, leftPoints: number, rightPoints: number){
	const ctx = dt.getContext();
	const { width, height } = dt.getSize();
	ctx.clearRect(0, 0, width, height);

	const text = `${leftPoints} - ${rightPoints}`;
	const fontPx = 96;
	ctx.font = `bold ${fontPx}px Arial`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = "#ffffff";
	ctx.fillText(text, width / 2, height / 2);

	dt.update();
}