const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS = 10;

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
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on("connection", (ws) => {
  const playerId = Math.random().toString(36).substr(2, 9);
  const roomId = findRoom();

  ws.id = playerId;
  ws.roomId = roomId;

  if (!rooms[roomId]) createRoom();

  console.log(`Player ${playerId} connected to ${roomId}`);

  // =========================
  // MESSAGE HANDLER
  // =========================
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // =========================
    // JOIN
    // =========================
    if (data.type === "join") {
      const playerName = data.name || "Unknown";

      console.log("JOIN RECEIVED:");
      console.log("ID:", playerId);
      console.log("NAME:", playerName);

      rooms[roomId].players[playerId] = {
        x: 0,
        y: 0,
        z: 0,
        rot: 0,
        name: playerName
      };

      rooms[roomId].sockets[playerId] = ws;

      // send full state to joining player
      send(ws, {
        type: "init",
        id: playerId,
        room: roomId,
        players: rooms[roomId].players
      });

      // notify others
      broadcast(roomId, {
        type: "join",
        id: playerId,
        data: rooms[roomId].players[playerId]
      });
    }

    // =========================
    // UPDATE
    // =========================
    if (data.type === "update") {
      if (rooms[roomId].players[playerId]) {
        rooms[roomId].players[playerId].x = data.data.x;
        rooms[roomId].players[playerId].y = data.data.y;
        rooms[roomId].players[playerId].z = data.data.z;
        rooms[roomId].players[playerId].rot = data.data.rot;

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
    console.log(`Player ${playerId} left ${roomId}`);

    if (rooms[roomId]) {
      delete rooms[roomId].players[playerId];
      delete rooms[roomId].sockets[playerId];

      broadcast(roomId, {
        type: "leave",
        id: playerId
      });
    }
  });
});

server.listen(3000, () => {
  console.log("Server running with rooms");
});
