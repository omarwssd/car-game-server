const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS = 10;

// =========================
// ROOMS
// =========================
const rooms = {};

function createRoom() {
  const id = "room_" + Math.random().toString(36).substr(2, 6);
  rooms[id] = { players: {}, sockets: {} };
  return id;
}

function findRoom() {
  for (const id in rooms) {
    if (Object.keys(rooms[id].players).length < MAX_PLAYERS) {
      return id;
    }
  }
  return createRoom();
}

function send(ws, data) {
  ws.send(JSON.stringify(data));
}

function broadcast(roomId, data) {
  const msg = JSON.stringify(data);

  for (const id in rooms[roomId].sockets) {
    const client = rooms[roomId].sockets[id];
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// =========================
// CONNECTION
// =========================
wss.on("connection", (ws) => {
  const playerId = Math.random().toString(36).substr(2, 9);
  const roomId = findRoom();

  ws.id = playerId;
  ws.roomId = roomId;

  if (!rooms[roomId]) createRoom();

  // 🔥 IMPORTANT: player now includes NAME
  rooms[roomId].players[playerId] = {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    name: "Unknown" // default until join packet
  };

  rooms[roomId].sockets[playerId] = ws;

  console.log(`Player ${playerId} joined ${roomId}`);

  // =========================
  // INIT (SEND FULL ROOM STATE)
  // =========================
  send(ws, {
    type: "init",
    id: playerId,
    room: roomId,
    players: rooms[roomId].players
  });

  // =========================
  // MESSAGES
  // =========================
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // =========================
    // JOIN (FIXED NAME HANDLING)
    // =========================
    if (data.type === "join") {

      const name = data.name || "Unknown";

      // 🔥 store name properly in server state
      rooms[roomId].players[playerId].name = name;

      console.log(`Player joined: ${name} (${playerId})`);

      broadcast(roomId, {
        type: "join",
        id: playerId,
        name: name
      });
    }

    // =========================
    // POSITION UPDATE
    // =========================
    if (data.type === "update") {
      if (rooms[roomId].players[playerId]) {
        rooms[roomId].players[playerId] = {
          ...rooms[roomId].players[playerId],
          ...data.data
        };

        broadcast(roomId, {
          type: "update",
          id: playerId,
          data: rooms[roomId].players[playerId]
        });
      }
    }
  });

  // =========================
  // DISCONNECT
  // =========================
  ws.on("close", () => {
    if (!rooms[roomId]) return;

    delete rooms[roomId].players[playerId];
    delete rooms[roomId].sockets[playerId];

    broadcast(roomId, {
      type: "leave",
      id: playerId
    });

    console.log(`Player ${playerId} left ${roomId}`);
  });
});

// =========================
// START SERVER
// =========================
server.listen(3000, () => {
  console.log("Server running with rooms + names fixed");
});
