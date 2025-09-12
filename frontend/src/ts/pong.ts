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
} from "@babylonjs/core";

export function initPongPage() {
	const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
	if (!canvas) return;

	const engine = new Engine(canvas, true);
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0, 0, 0, 1);
	const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
	
	light.intensity = 1.7;

	const { leftPaddle, rightPaddle, ball, scoreTexture } = createGameObjects(scene);
	const { mainCam, secondCam } = createCameras(scene);

	// ---- WebSocket ----
	const ws = new WebSocket("ws://localhost:3000/ws");
	ws.onopen = () => console.log("Connecté au serveur Pong WS");
	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (msg.type === "state") {
			const state = msg.state;
			leftPaddle.position.y = state.left.y;
			rightPaddle.position.y = state.right.y;
			ball.position.x = state.ball.x;
			ball.position.y = state.ball.y;
			updateScoreDynamicTexture(scoreTexture, state.score.left, state.score.right);
		}
	};

	setupControls(ws, scene, mainCam, secondCam);

	engine.runRenderLoop(() => scene.render());
}

// ---- Create Mesh ----
function createGameObjects(scene: Scene) { 
	const GAME_HEIGHT = 400;
	const PADDLE_LENGTH = 80;
	const PADDLE_HEIGHT = 10;
	const BALL_SIZE = 10;

	const paddleMat = new StandardMaterial("paddleMat", scene);
	paddleMat.diffuseColor = Color3.White();
	const ballMat = new StandardMaterial("ballMat", scene);
	ballMat.diffuseColor = Color3.White();

	const leftPaddle = MeshBuilder.CreateBox("leftPaddle", { width: PADDLE_LENGTH, height: PADDLE_HEIGHT, depth: 10 }, scene);
	leftPaddle.material = paddleMat;
	leftPaddle.position.x = -400 + PADDLE_HEIGHT;
	leftPaddle.rotation.z = Math.PI / 2;

	const rightPaddle = MeshBuilder.CreateBox("rightPaddle", { width: PADDLE_LENGTH, height: PADDLE_HEIGHT, depth: 10 }, scene);
	rightPaddle.material = paddleMat;
	rightPaddle.position.x = 400 - PADDLE_HEIGHT;
	rightPaddle.rotation.z = Math.PI / 2;

	const ball = MeshBuilder.CreateSphere("ball", { diameter: BALL_SIZE }, scene);
	ball.material = ballMat;

	createMiddleLine(scene, GAME_HEIGHT);
	const { dt: scoreTexture } = createScorePlane(scene);

	return { leftPaddle, rightPaddle, ball, scoreTexture };
}

// ---- Midle Line ----
function createMiddleLine(scene: Scene, gameHeight: number, segmentHeight = 10, gap = 10) {
	const GAME_WIDTH = 800;
	const GAME_HEIGHT = 400;

	const lineMaterial = new StandardMaterial("lineMat", scene);
	lineMaterial.diffuseColor = Color3.White();
	const segments = Math.floor(gameHeight / (segmentHeight + gap));
	for (let i = 0; i < segments; i++) {
		const segment = MeshBuilder.CreateBox(`lineSeg${i}`, { width: 2, height: segmentHeight, depth: -1 }, scene);
		segment.material = lineMaterial;
		segment.position.x = 0;
		segment.position.y = gameHeight / 2 - (i + 0.5) * (segmentHeight + gap);
	}

	const up = MeshBuilder.CreateBox("horizontal up", { width: GAME_WIDTH, height: 1, depth: -1 }, scene);
	const down = MeshBuilder.CreateBox("horizontal down", { width: GAME_WIDTH, height: 1, depth: -1 }, scene);
	const right = MeshBuilder.CreateBox("vertical right", { width: 1, height: GAME_HEIGHT, depth: -1 }, scene);
	const left = MeshBuilder.CreateBox("vertical left", { width: 1, height: GAME_HEIGHT, depth: -1 }, scene);

	up.position.x = 0;
	up.position.y = GAME_HEIGHT / 2;
	down.position.x = 0;
	down.position.y = -(GAME_HEIGHT / 2);

	right.position.x = GAME_WIDTH / 2;
	right.position.y = 0;
	left.position.x = -(GAME_WIDTH / 2);
	left.position.y = 0;
}

// ---- Cameras ----
function createCameras(scene: Scene) {
	const mainCam = new FreeCamera("mainCam", new Vector3(0, 0, -1000), scene);
	const secondCam = new FreeCamera("secondCam", new Vector3(0, -300, -500), scene);

	secondCam.setTarget(Vector3.Zero());
	secondCam.fov = 0.9;

	mainCam.mode = 1;
	mainCam.setTarget(Vector3.Zero());
	scene.activeCamera = mainCam;

	return { mainCam, secondCam };
}

// ---- Controles ----
function setupControls(
	ws: WebSocket,
	scene: Scene,
	mainCam: FreeCamera,
	secondCam: FreeCamera
) {
	const keysToLock = ["w", "s", "ArrowUp", "ArrowDown"];

	document.addEventListener("keydown", (e) => {
		if (keysToLock.includes(e.key)) e.preventDefault(); // deny scroll page

		if ("1".includes(e.key))
			scene.activeCamera = mainCam;
		if ("2".includes(e.key))
			scene.activeCamera = secondCam;
		if (["w", "s"].includes(e.key))
			ws.send(JSON.stringify({ type: "move", side: "left", dir: e.key === "w" ? "up" : "down" }));
		if (["ArrowUp", "ArrowDown"].includes(e.key))
			ws.send(JSON.stringify({ type: "move", side: "right", dir: e.key === "ArrowUp" ? "up" : "down" }));
	});

	document.addEventListener("keyup", (e) => {
		if (keysToLock.includes(e.key)) e.preventDefault(); // deny scroll page

		if (["w", "s"].includes(e.key))
			ws.send(JSON.stringify({ type: "move", side: "left", dir: "stop" }));
		if (["ArrowUp", "ArrowDown"].includes(e.key))
			ws.send(JSON.stringify({ type: "move", side: "right", dir: "stop" }));
	});
}

// ---- Score ----
function createScorePlane(scene: Scene) {
	const plane = MeshBuilder.CreatePlane("scorePlane", { width: 100, height: 40 }, scene);
	const dt = new DynamicTexture("scoreDT", { width: 256, height: 128 }, scene);
	const mat = new StandardMaterial("scoreMat", scene);
	mat.diffuseTexture = dt;
	mat.emissiveColor = Color3.White();
	plane.material = mat;
	plane.position.y = 175;
	plane.position.z = 0;
	return { dt };
}

function updateScoreDynamicTexture(dt: DynamicTexture, leftPoints: number, rightPoints: number) {
	const ctx = dt.getContext();
	ctx.clearRect(0, 0, dt.getSize().width, dt.getSize().height);
	dt.drawText(`${leftPoints} - ${rightPoints}`, null, 64, "bold 64px Arial", "white", "transparent", true);
}