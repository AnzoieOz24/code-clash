const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(room, data) { for (const p of room.players) send(p.ws, data); }
function publicState(room) {
  return {
    type: 'state',
    phase: room.phase,
    round: room.round,
    target: room.target,
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
  };
}
function resetRound(room) {
  room.phase = 'waiting';
  room.target = null;
  room.round += 1;
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 10);
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create') {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      const room = { code, players: [], phase: 'waiting', round: 0, target: null, timer: null };
      rooms.set(code, room);
      joinRoom(ws, room, msg.name);
      return;
    }
    if (msg.type === 'join') {
      const room = rooms.get(String(msg.code || '').toUpperCase());
      if (!room) return send(ws, { type: 'error', message: 'Room not found.' });
      if (room.players.length >= 2) return send(ws, { type: 'error', message: 'This room already has two players.' });
      joinRoom(ws, room, msg.name);
      return;
    }
    if (!ws.room) return;
    const room = ws.room;

    if (msg.type === 'start') {
      if (room.players.length < 2) return send(ws, { type: 'error', message: 'Wait for another player to join.' });
      if (room.phase === 'playing') return;
      room.players.forEach(p => p.score = 0);
      room.round = 1;
      startRound(room);
      return;
    }

    if (msg.type === 'hit' && room.phase === 'playing') {
      const player = room.players.find(p => p.ws === ws);
      if (!player || msg.round !== room.round || msg.target !== room.target) return;
      player.score += 1;
      if (player.score >= 10) {
        room.phase = 'finished';
        broadcast(room, { ...publicState(room), winner: player.id, message: `${player.name} wins!` });
      } else {
        startRound(room);
      }
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      room.phase = 'waiting';
      clearTimeout(room.timer);
      broadcast(room, { ...publicState(room), message: 'Your opponent left. Waiting for a new player.' });
    }
  });
});

function joinRoom(ws, room, rawName) {
  const name = String(rawName || 'Player').trim().slice(0, 18) || 'Player';
  const player = { id: ws.id, name, score: 0, ws };
  room.players.push(player);
  ws.room = room;
  send(ws, { type: 'joined', code: room.code, playerId: ws.id });
  broadcast(room, { ...publicState(room), message: room.players.length === 2 ? 'Both players are ready.' : 'Share the room code with your opponent.' });
}

function startRound(room) {
  clearTimeout(room.timer);
  room.phase = 'countdown';
  room.target = null;
  broadcast(room, { ...publicState(room), countdown: 3 });
  let n = 2;
  const countdown = setInterval(() => {
    if (!rooms.has(room.code)) return clearInterval(countdown);
    if (n > 0) broadcast(room, { ...publicState(room), countdown: n-- });
    else {
      clearInterval(countdown);
      room.phase = 'playing';
      room.target = Math.random().toString(36).slice(2, 10);
      broadcast(room, { ...publicState(room), countdown: 0 });
      room.timer = setTimeout(() => {
        if (room.phase === 'playing') {
          room.phase = 'waiting';
          broadcast(room, { ...publicState(room), message: 'Too slow! Press Start Round to try again.' });
        }
      }, 5000);
    }
  }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Code Clash running on port ${PORT}`));
