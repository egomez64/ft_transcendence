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
	UniversalCamera,
	DynamicTexture,
} from "@babylonjs/core";

export function initPongPage() {
	const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
	if (!canvas) return;

	const engine = new Engine(canvas, true);
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0, 0, 0, 1);
	new HemisphericLight("light", new Vector3(0, 1, 0), scene);

	const { leftPaddle, rightPaddle, ball, scoreTexture } = createGameObjects(scene);
	const { mainCam, leftCam, rightCam } = createCameras(scene, leftPaddle, rightPaddle, canvas);

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

	setupControls(ws, scene, canvas, leftCam, rightCam, mainCam);

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

	const leftPaddle = MeshBuilder.CreateBox("leftPaddle", { width: PADDLE_LENGTH, height: PADDLE_HEIGHT, depth: 1 }, scene);
	leftPaddle.material = paddleMat;
	leftPaddle.position.x = -400 + PADDLE_HEIGHT;
	leftPaddle.rotation.z = Math.PI / 2;

	const rightPaddle = MeshBuilder.CreateBox("rightPaddle", { width: PADDLE_LENGTH, height: PADDLE_HEIGHT, depth: 1 }, scene);
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
	const lineMaterial = new StandardMaterial("lineMat", scene);
	lineMaterial.diffuseColor = Color3.White();
	const segments = Math.floor(gameHeight / (segmentHeight + gap));
	for (let i = 0; i < segments; i++) {
		const segment = MeshBuilder.CreateBox(`lineSeg${i}`, { width: 2, height: segmentHeight, depth: 1 }, scene);
		segment.material = lineMaterial;
		segment.position.x = 0;
		segment.position.y = gameHeight / 2 - (i + 0.5) * (segmentHeight + gap);
	}
}

// ---- Cameras ----
function createCameras(scene: Scene, leftPaddle: any, rightPaddle: any, canvas: HTMLCanvasElement) {
	const mainCam = new FreeCamera("mainCam", new Vector3(0, 0, -1000), scene);
	mainCam.mode = 1;
	mainCam.setTarget(Vector3.Zero());
	scene.activeCamera = mainCam;
	mainCam.attachControl(canvas, true);

	const leftCam = new UniversalCamera("leftCam", new Vector3(), scene);
	const rightCam = new UniversalCamera("rightCam", new Vector3(), scene);

	scene.onBeforeRenderObservable.add(() => {
		updateCamera(leftCam, leftPaddle, new Vector3(leftPaddle.position.x + 400, leftPaddle.position.y, 0));
		updateCamera(rightCam, rightPaddle, new Vector3(rightPaddle.position.x - 400, rightPaddle.position.y, 0));
	});

	return { mainCam, leftCam, rightCam };
}

function updateCamera(cam: UniversalCamera, paddle: any, target: Vector3) {
	cam.position.x = paddle.position.x - 30;
	cam.position.y = paddle.position.y;
	cam.position.z = -20;
	cam.fov = 0.4;
	paddle.position.z = 0;
	cam.setTarget(target);
}

// ---- Controles ----
function setupControls(
	ws: WebSocket,
	scene: Scene,
	canvas: HTMLCanvasElement,
	leftCam: UniversalCamera,
	rightCam: UniversalCamera,
	mainCam: FreeCamera
) {
	const keysToLock = ["w", "s", "ArrowUp", "ArrowDown"];

	document.addEventListener("keydown", (e) => {
		if (keysToLock.includes(e.key)) e.preventDefault(); // deny scroll page

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
