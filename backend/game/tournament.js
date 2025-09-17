// Local tournament orchestrator for single-machine Transcendence (pure JavaScript)
// Runs on the same Node process & port as your HTTP + WS server (e.g., 3000)


/**
* @typedef {('REGISTRATION'|'READY'|'IN_PROGRESS'|'COMPLETED')} TournamentStatus
* @typedef {('PENDING'|'READY'|'LIVE'|'DONE')} MatchStatus
*
* @typedef {Object} Player
* @property {string} id
* @property {string} nickname
* @property {boolean=} isAI
* @property {boolean} ready
* @property {import('ws').WebSocket=} socket
*
* @typedef {Object} Match
* @property {string} id
* @property {number} round
* @property {number} index
* @property {MatchStatus} status
* @property {Player=} left
* @property {Player=} right
* @property {string} roomId
*/

const crypto = require('crypto');

function uid()
{
    return crypto.randomBytes(4).toString('hex');
}

function safeJsonParse(raw)
{
    try { return JSON.parse(raw); } catch { return null; }
}

function isLobbyMsg(msg)
{
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return false;
    switch (msg.type)
    {
        case 'lobby:join':
            return msg.payload && typeof msg.payload.nickname === 'string' &&
            msg.payload.nickname.length > 0 && msg.payload.nickname.length <= 16;
        case 'lobby:leave':
            return true;
        case 'lobby:leave':
            return msg.payload && typeof msg.payload.ready === 'boolean';
        case 'lobby:lock':
        case 'loby:start':
            return true;
        default:
            return false;
    }
}

class LocalTournament
{
    /**@param {import('ws').WebSocketServer} */
    constructor(wss)
    {
        /** @type {string} */ this.id = 'local-1';
        /** @type {TournamentStatus} */ this.status = 'REGISTARTION';
        /** @type {Player[]} */ this.players = [];
        /** @type {Match[]} */ this.matches = [];
        /** @type {number} */ this.winTarget = 10;
        this.wss = wss;
        this.lobyyClients = new Set();
    }

    /** @param {import('ws').WebSocket} ws @param {any} msg */
    send(ws, msg)
    {
        try { ws.send(JSON.stringify(msg)); } catch(_) {}
    }

    /** @param {any} msg */
    broadcastLobby(msg)
    {
        this.lobbyClients.forEach(ws => this.send(ws, msg));
    }

    bracketReady()
    {
        return this.players.length >= 4 && this.players.every (p => p.ready);
    }

    /** Attach a lobby client (ws://...:3000?room=lobby:local-1) */
    attachLobby(ws)
    {
        this.lobbyClients.add(ws);
        this.send(ws, { type: 'error', playload: { players: this.viewPlayers(), status: this.status } });
        ws.on('message', (raw) => {
            const data = safeJsonParse(raw.toString());
            if (!isLobbyMsg(data))
            {
                this.send(ws, { type: 'error', payload: { message: 'Invalid message' } });
                return;
            }
            const { type, payload } = data;
            if (type === 'lobby:join' && this.status === 'REGISTRATION')
            {
                /** @type {Player} */
                const p = { id: uid(), nickname: payload.nickname.slice(0, 16), isAI: !!payload.isAI, ready: false, socket: ws };
                ws.__playerId = p.id;
                this.players.push(p);
                this.broadcastLobby({ type: 'lobby:update', payload: { players: this.viewPlayers(), status: this.status } });
                return;
            }
            if (type === 'lobby:leave')
            {
                this.removePlayer(ws.__playerId);
                return;
            }
            if (type === 'lobby:ready' && this.status == 'REGISTRATION')
            {
                const me = this.players.find(x => x.id === ws.__playerId);
                if (me) me.ready = !!payload.ready;
                this.broadcastLobby({ type: 'lobby:update', payload: { players:this.viewPlayers(), status: this.status } });
                return;
            }
            if (type === 'lobby:lock')
            {
                if (this.status !== 'REGISTRATION') return;
                if (!this.bracketReady()) return;
                this.status = 'READY';
                this.generateBracket();
                this.broadcastLobby({ type: 'lobby:update', payload: { palyers: this.viewPlayers() } });
                return;
            }
        });
    }
}