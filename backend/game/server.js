const io = require("socket.io");

let clients = [];
let wss = null;
let state = null;

function startGameServer(server, cors) {
	wss = new io.Server(server, { cors: cors, path: "/ws" });
	wss.on("connection", (ws) => {
		console.log("Client connecté Pong WS");
		ws.on("move", (data) => {
			console.log(data);
			const player = data.side === "left" ? state.left : state.right;
			if (data.dir === "stop") {
				player.up = false;
				player.down = false;
			} else {
				player.up = data.dir === "up";
				player.down = data.dir === "down";
			}
			// If somebody move, start the game //To change with proper hook
			if (state.status === "idle") {
				state.status = "playing";
				resetBall(state);
			}
		});
		ws.on("restart", () => resetGame(state));
		ws.on("disconnect", () => console.log("Client déconnecté Pong WS"));
		ws.on("error", (err) => console.log("Client déconnecté Pong WS", err));
		clients.push(ws);
	});

	const GAME_WIDTH = 800;
	const GAME_HEIGHT = 400;
	const PADDLE_LENGTH = 80;
	const PADDLE_HEIGHT = 10;
	const PADDLE_SPEED = 6;
	const TICK_MS = 1000 / 60;
	const LEFT_PADDLE_X = -GAME_WIDTH / 2 + PADDLE_HEIGHT;
	const RIGHT_PADDLE_X = GAME_WIDTH / 2 - PADDLE_HEIGHT;
	const BALL_RADIUS = 10;
	const WIN_SCORE = 10;
   // let lastAIUpdate = Date.now() - 1000;
    let targetY = 0;
    const AI_ENABLED = true;
	const AI = {
		reactMs: 0,
		speedMul: 1.35,
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
	//       Sous-fonctions	  	  //
	// ========================== */

	function createInitialState() {
		return {
			status: "idle",
			ball: { x: 0, y: 0, vx: 0, vy: 0, speed: 5 },
			left: { y: 0, up: false, down: false },
			right: { y: 0, up: false, down: false },
			score: { left: 0, right: 0 },
			winner: null,
		};
	}

	function resetGame(state) {
		state.status = "idle";
		state.score.left = 0;
		state.score.right = 0;
		state.winner = null;
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
				state.ball.vx = state.ball.speed * (Math.random() > 0.5 ? 1 : -1);
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
			checkWin(state);
			resetBall(state);
		}
		if (state.ball.x > GAME_WIDTH / 2) {
			state.score.left++;
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
        // Copie locale des données de la balle
        let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;

        // Bornes verticales (terrain centré)
        const minY = -H / 2 + ballRadius;
        const maxY =  H / 2 - ballRadius;

        // Position X où la balle "touche" le paddle (face gauche du paddle droit)
        const hitX = targetX - ballRadius;

        // --------------------------
        // 1) Pré-avance = délai IA (elle ne voit la balle qu’après 1s)
        // --------------------------
        for (let i = 0; i < leadTicks; i++) {
            x += vx;
            y += vy;

            // Gestion rebonds
            if (y < minY) {
            y = minY + (minY - y); // on "reflète" à l’intérieur
            vy = -vy;              // inversion de vitesse verticale
            } else if (y > maxY) {
            y = maxY - (y - maxY);
            vy = -vy;              // ⚠️ corrigé (avant tu avais "vy = vy")
            }
        }

        // --------------------------
        // 2) Simulation jusqu’au paddle
        // --------------------------
        for (let i = 0; i < stepLimit; i++) {
            x += vx;
            y += vy;

            // Rebonds sur murs
            if (y < minY) {
                y = minY + (minY - y);
                vy = -vy;
            } 
            else if (y > maxY) {
                y = maxY - (y - maxY);
                vy = -vy;
            }

            // Si la balle a atteint la face du paddle → on renvoie la position Y
            if (x >= hitX) {
            return clamp(y, minY, maxY);
            }
        }

        // --------------------------
        // 3) Cas de secours (si jamais on n’a pas atteint le paddle)
        // --------------------------
        return clamp(y, minY, maxY);
    }

	function updateAI() {
		if (!AI_ENABLED) return;

		const now = Date.now();
		const H = GAME_HEIGHT;

		//if (now - lastAIUpdate >= AI.reactMs) {
			//lastAIUpdate = now;
        setTimeout(() => {
			const paddleX = RIGHT_PADDLE_X
			const TICK_MS = 1000 / 60;
			const leadTicks = Math.round(1000 / TICK_MS);

			const predictedY = predictBallYAtX_simCentered(state.ball, paddleX, {
			H,
			ballRadius: BALL_RADIUS,
			leadTicks,
			stepLimit: 3000
			});

			//const aimY = (1 - AI.anticipate) * state.ball.y + AI.anticipate * predictedY;

			let noisyY = state.ball.y * ((state.ball.y / predictedY) * AI.anticipate);
			if (Math.random() < AI.errorRate && state.score.right >= WIN_SCORE - 1) {
			noisyY += (Math.random() * 2 - 1) * 40;
			}

			/*const minY = -H/2 + PADDLE_LENGTH / 2;
			const maxY =  H/2 - PADDLE_LENGTH / 2;
			targetY = clamp(noisyY, minY, maxY);

			const dx = Math.max(1, (paddleX - state.ball.x));
			const maxTravel = dx * (PADDLE_SPEED * AI.speedMul);
			targetY = clamp(targetY, state.right.y - maxTravel, state.right.y + maxTravel);
			targetY = clamp(targetY, minY, maxY);*/
            targetY = (state.ball.vx > 0) ? noisyY: 0;
		//}
        }, AI.reactMs);

		const step = PADDLE_SPEED * AI.speedMul;
		/*const diff = targetY - state.right.y;
		if (Math.abs(diff) <= step) {
			state.right.y = targetY;
		} else {
			state.right.y += Math.sign(diff) * step;
		}

		const minY = -GAME_HEIGHT/2 + PADDLE_LENGTH / 2;
		const maxY =  GAME_HEIGHT/2 - PADDLE_LENGTH / 2;
		state.right.y = clamp(state.right.y, minY, maxY);*/
		if (targetY > state.right.y + 5) {
			if (state.right.y + PADDLE_LENGTH / 2 < GAME_HEIGHT / 2) state.right.y += step;
		} else if (targetY < state.right.y - 5) {
			if (state.right.y - PADDLE_LENGTH / 2 > -GAME_HEIGHT / 2) state.right.y -= step;
		}
	}


    /*function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

	
	 
	function reflectYCentered(rawY, H) {
		const yCanvasRaw = rawY + H / 2;
		const period = 2 * H;
		let y = yCanvasRaw % period;
		if (y < 0) y += period;
		const mirroredCanvas = (y <= H) ? y : (period - y);

		return mirroredCanvas - H / 2;
	}

	
	function predictBallYAtX(ball, targetX) {
		const H = GAME_HEIGHT;

		if (
			!ball ||
			!Number.isFinite(ball.x) || !Number.isFinite(ball.y) ||
			!Number.isFinite(ball.vx) || !Number.isFinite(ball.vy)
		) {
			return 0;
		}
		if (ball.vx <= 0) return ball.y;
		const dx = targetX - ball.x;
		if (dx <= 0) return ball.y;
		const t = dx / ball.vx;
		const rawY = ball.y + ball.vy * t;
		if (!Number.isFinite(rawY)) return 0;
		const yReflected = reflectYCentered(rawY, H);
		return clamp(yReflected, -H / 2, +H / 2);
	}

	function updateAI(state) {
		if (!AI_ENABLED) return;
		//const now = Date.now();
		
		//if (now - lastAIUpdate >= AI.reactMs) {
			//lastAIUpdate = now;
		setTimeout(() => {
			const paddleX = RIGHT_PADDLE_X;
			const predictedY = predictBallYAtX(state.ball, paddleX);
			console.log({ predictedY });
			const aimY = (state.ball.vx > 0) ? ((1 - AI.anticipate) * state.ball.y + AI.anticipate * predictedY) : 0;
			//if (!Number.isFinite(aimY)) aimY = GAME_HEIGHT / 2;
			let noisyY = aimY
			//if (Math.random() < AI.errorRate) {
			//	noisyY += (Math.random() * 2 - 1) * 40;
			//}
			targetY = (state.ball.vx > 0) ? state.ball.y + noisyY : 0;
		}, AI.reactMs);
		//}
		const step = PADDLE_SPEED * AI.speedMul;
		if (targetY > state.right.y + 5) {
			if (state.right.y + PADDLE_LENGTH / 2 < GAME_HEIGHT / 2) state.right.y += step;
		} else if (targetY < state.right.y - 5) {
			if (state.right.y - PADDLE_LENGTH / 2 > -GAME_HEIGHT / 2) state.right.y -= step;
		}
	}*/

	function gameLoop(state, wss) {
		updatePaddles(state);
		updateBall(state);
        updateAI(state);
		//handleCollisions(state);
		handleScore(state);
		broadcastState(wss, state);
	}
}

module.exports = { startGameServer };