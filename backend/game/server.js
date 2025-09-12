const { WebSocketServer } = require("ws");

function startGameServer(server) {
	const wss = new WebSocketServer({ server, path: "/ws" });

	const state = {
		ball: { x: 0, y: 0, vx: 0, vy: 0, speed: 5 },
		left: { y: 0, up: false, down: false },
		right: { y: 0, up: false, down: false },
		score: { left: 0, right: 0 },
	};

	const GAME_WIDTH = 800;
	const GAME_HEIGHT = 400;
	const PADDLE_LENGTH = 80;
	const PADDLE_HEIGHT = 10;
	const PADDLE_SPEED = 6;
	const TICK_MS = 1000 / 60;
	const LEFT_PADDLE_X = -GAME_WIDTH / 2 + PADDLE_HEIGHT;
	const RIGHT_PADDLE_X =	GAME_WIDTH / 2 - PADDLE_HEIGHT;
	const BALL_RADIUS = 5;

	function resetBall() {
		state.ball.x = 0;
		state.ball.y = 0;
		state.ball.speed = 5;
		state.ball.vx = state.ball.speed * (Math.random() > 0.5 ? 1 : -1);
		state.ball.vy = (Math.random() - 0.5) * 4;
	}

function handleCollisions() {
	// Left
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

	// Right
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

	function handleScore() {
		if (state.ball.x < -GAME_WIDTH / 2) {
			state.score.right++;
			resetBall();
		}

		if (state.ball.x > GAME_WIDTH / 2) {
			state.score.left++;
			resetBall();
		}
	}

	resetBall();

	wss.on("connection", (ws) => {
		console.log("Client connecté Pong WS");

		ws.send(JSON.stringify({ type: "state", state }));

		ws.on("message", (msg) => {
			const data = JSON.parse(msg.toString());
			if (data.type === "move") {
				const player = data.side === "left" ? state.left : state.right;
				player.up = data.dir === "up";
				player.down = data.dir === "down";
				if (data.dir === "stop") {
					player.up = false;
					player.down = false;
				}
			}
		});

		ws.on("close", () => console.log("Client déconnecté Pong WS"));
	});

	setInterval(() => {
		[state.left, state.right].forEach((p) => {
			if (p.up && p.y + PADDLE_LENGTH / 2 < GAME_HEIGHT / 2) p.y += PADDLE_SPEED;
			if (p.down && p.y - PADDLE_LENGTH / 2 > -GAME_HEIGHT / 2) p.y -= PADDLE_SPEED;
		});

		state.ball.x += state.ball.vx;
		state.ball.y += state.ball.vy;

		if (state.ball.y > GAME_HEIGHT / 2 - PADDLE_HEIGHT || state.ball.y < -GAME_HEIGHT / 2 + PADDLE_HEIGHT) {
			state.ball.vy *= -1;
		}

		handleCollisions();
		handleScore();

		wss.clients.forEach((client) => {
			if (client.readyState === 1) client.send(JSON.stringify({ type: "state", state }));
		});
	}, TICK_MS);
}

module.exports = { startGameServer };
