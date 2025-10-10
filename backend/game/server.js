const io = require("socket.io");

let clients = [];
let wss = null;
let state = null;


let epoch = 0;
let serveDir = 0;

function startGameServer(server, cors) {
  wss = new io.Server(server, { cors: {origin: ["https://localhost:8443"], credentials: true }, path: "/ws" });

  wss.on("connection", (ws) => {
	console.log("Client connecté Pong WS");

	ws.on("setAi", (payload) => {
	  const enabled = !!(payload && payload.enabled);
	  state.aiEnabled = enabled;
	  state.right.up = false;
	  state.right.down = false;
	  if (enabled && state.status == "idle") {
		state.status = "playing";
		resetBall(state);
	  }
	});

	ws.on("move", (data) => {
	  console.log(data);
	  if (state.aiEnabled && data.side == "right") return;

	  const player = data.side === "left" ? state.left : state.right;
	  if (data.dir === "stop") {
		player.up = false;
		player.down = false;
	  } else {
		player.up = data.dir === "up";
		player.down = data.dir === "down";
	  }

	  // Démarre la partie au premier mouvement
	  if (state.status === "idle") {
		state.status = "playing";
		resetBall(state);
	  }
	});

	ws.on("restart", () => {
	  resetGame(state);
	  // Renvoie l'epoch au client (utilisé côté frontend pour armer l'écoute)
	  ws.emit("restarted", { epoch: state.epoch });
	});

	ws.on("disconnect", () => console.log("Client déconnecté Pong WS"));
	ws.on("error", (err) => console.log("Client déconnecté Pong WS", err));
	clients.push(ws);
  });

  // Constantes jeu
  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 400;
  const PADDLE_LENGTH = 80;
  const PADDLE_HEIGHT = 10;
  const PADDLE_SPEED = 6;
  const TICK_MS = 1000 / 60;
  const LEFT_PADDLE_X = -GAME_WIDTH / 2 + PADDLE_HEIGHT;
  const RIGHT_PADDLE_X = GAME_WIDTH / 2 - PADDLE_HEIGHT;
  const BALL_RADIUS = 10;
  const WIN_SCORE = 5;

  let lastAIUpdate = Date.now() - 1000;
  const AI = {
	reactMs: 1000,
	speedMul: 1,
	anticipate: 0.9,
	jitter: 6,
	errorRate: 0.01,
  };

  // ---- Game State ----
  state = createInitialState();
  // ---- Init ----
  resetBall(state);

  // ---- Game loop ----
  setInterval(() => gameLoop(state, wss), TICK_MS);

  /* ========================== //
  //       Sous-fonctions       //
  // ========================== */

  function createInitialState() {
	return {
	  status: "idle",
	  ball: { x: 0, y: 0, vx: 0, vy: 0, speed: 5 },
	  left: { y: 0, up: false, down: false },
	  right: { y: 0, up: false, down: false },
	  score: { left: 0, right: 0 },
	  winner: null,
	  aiEnabled: false,
	  epoch: epoch,
	};
  }

  function resetGame(state) {
	epoch += 1;
	state.status = "idle";
	state.score.left = 0;
	state.score.right = 0;
	state.winner = null;
	state.epoch = epoch; 
	resetBall(state);
  }

  function resetBall(state) {
	state.ball.x = 0;
	state.ball.y = 0;
	state.ball.vx = 0;
	state.ball.vy = 0;
	state.ball.speed = 0;

	if (state.status === "playing") {
	  setTimeout(() => {
		state.ball.speed = 5;
		state.ball.vx = state.ball.speed * (serveDir === 0 ? 1 : -1);
		state.ball.vy = (Math.random() - 0.5) * 4;
	  }, 1000);
	}
  }

  function updatePaddles(state) {
	[state.left, state.right].forEach((p) => {
	  if (p.up && p.y + PADDLE_LENGTH / 2 < GAME_HEIGHT / 2) p.y += PADDLE_SPEED;
	  if (p.down && p.y - PADDLE_LENGTH / 2 > -GAME_HEIGHT / 2) p.y -= PADDLE_SPEED;
	});
  }

  function updateBall(state) {
	const steps = Math.ceil(state.ball.speed / 5);
	for (let i = 0; i < steps; i++) {
	  state.ball.x += state.ball.vx / steps;
	  state.ball.y += state.ball.vy / steps;

	  // Up/Down bounces
	  if (
		state.ball.y > GAME_HEIGHT / 2 - PADDLE_HEIGHT ||
		state.ball.y < -GAME_HEIGHT / 2 + PADDLE_HEIGHT
	  ) {
		state.ball.vy *= -1;
	  }

	  handleCollisions(state);
	}
  }

  function handleCollisions(state) {
	// left paddle
	if (
	  state.ball.x - BALL_RADIUS < LEFT_PADDLE_X &&
	  state.ball.x + BALL_RADIUS > LEFT_PADDLE_X &&
	  state.ball.y < state.left.y + PADDLE_LENGTH / 2 &&
	  state.ball.y > state.left.y - PADDLE_LENGTH / 2
	) {
	  state.ball.vx = Math.abs(state.ball.vx);
	  state.ball.speed *= 1.05;
	  state.ball.vx = state.ball.speed;
	  const hitPos = (state.ball.y - state.left.y) / (PADDLE_LENGTH / 2);
	  state.ball.vy = hitPos * 5;
	}

	// right paddle
	if (
	  state.ball.x + BALL_RADIUS > RIGHT_PADDLE_X &&
	  state.ball.x - BALL_RADIUS < RIGHT_PADDLE_X &&
	  state.ball.y < state.right.y + PADDLE_LENGTH / 2 &&
	  state.ball.y > state.right.y - PADDLE_LENGTH / 2
	) {
	  state.ball.vx = -Math.abs(state.ball.vx);
	  state.ball.speed *= 1.05;
	  state.ball.vx = -state.ball.speed;
	  const hitPos = (state.ball.y - state.right.y) / (PADDLE_LENGTH / 2);
	  state.ball.vy = hitPos * 5;
	}
  }

  function handleScore(state) {
	if (state.status !== "playing") return;

	if (state.ball.x < -GAME_WIDTH / 2) {
	  state.score.right++;
	  serveDir = 1;
	  checkWin(state);
	  resetBall(state);
	}

	if (state.ball.x > GAME_WIDTH / 2) {
	  state.score.left++;
	  serveDir = 0;
	  checkWin(state);
	  resetBall(state);
	}
  }

  function checkWin(state) {
	if (state.score.left >= WIN_SCORE) {
	  state.status = "finished";
	  state.winner = "left";
	}
	if (state.score.right >= WIN_SCORE) {
	  state.status = "finished";
	  state.winner = "right";
	}
  }

  function broadcastState(wss, state) {
	clients.forEach((client) => {
	  client.emit("state", state);
	});
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function predictBallYAtX_simCentered(ball, targetX, { H, ballRadius, leadTicks, stepLimit }) {
	// Copie locale
	let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;

	// Bornes verticales (terrain centré)
	const minY = -H / 2 + ballRadius;
	const maxY =  H / 2 - ballRadius;

	const hitX = targetX - ballRadius;

	// 1) Pré-avance = délai IA
	for (let i = 0; i < leadTicks; i++) {
	  x += vx; y += vy;
	  if (y < minY) { y = minY + (minY - y); vy = -vy; }
	  else if (y > maxY) { y = maxY - (y - maxY); vy = -vy; }
	}

	// 2) Simulation jusqu’au paddle
	for (let i = 0; i < stepLimit; i++) {
	  x += vx; y += vy;
	  if (y < minY) { y = minY + (minY - y); vy = -vy; }
	  else if (y > maxY) { y = maxY - (y - maxY); vy = -vy; }
	  if (x >= hitX) return clamp(y, minY, maxY);
	}

	// 3) Secours
	return clamp(y, minY, maxY);
  }

  let target = 0;

  function updateAI() {
	const now = Date.now();
	const paddleX = RIGHT_PADDLE_X;
	const H = GAME_HEIGHT;
	const leadTicks = Math.round(AI.reactMs / TICK_MS);
	const predictedY = predictBallYAtX_simCentered(state.ball, paddleX, {
	  H, ballRadius: BALL_RADIUS, leadTicks, stepLimit: 2000
	});

	if (now - lastAIUpdate >= AI.reactMs) {
	  lastAIUpdate = now;
	  target = (state.ball.vx > 0) ? predictedY : 0;
	}

	const step = PADDLE_SPEED * AI.speedMul;
	if (target > state.right.y + 3) {
	  state.right.y = Math.min(state.right.y + step, H/2 - PADDLE_LENGTH/2);
	} else if (target < state.right.y - 3) {
	  state.right.y = Math.max(state.right.y - step, -H/2 + PADDLE_LENGTH/2);
	}
  }

  function gameLoop(state, wss) {
	updatePaddles(state);
	updateBall(state);
	if (state.aiEnabled) updateAI();
	handleScore(state);
	broadcastState(wss, state);
  }
}

module.exports = { startGameServer };
