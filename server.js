const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS = 10;

// rooms structure
const rooms = {
  // roomId: { players: { id: data }, sockets: { id: ws } }
};

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

wss.on("connection", (ws) => {
  const playerId = Math.random().toString(36).substr(2, 9);
  const roomId = findRoom();

  ws.roomId = roomId;
  ws.id = playerId;

  if (!rooms[roomId]) createRoom();

  rooms[roomId].players[playerId] = { x: 0, y: 0, z: 0, rot: 0 };
  rooms[roomId].sockets[playerId] = ws;

  console.log(`Player ${playerId} joined ${roomId}`);

  // send init
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

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "update") {
      rooms[roomId].players[playerId] = data.data;

      broadcast(roomId, {
        type: "update",
        id: playerId,
        data: data.data
      });
    }
  });

  ws.on("close", () => {
    delete rooms[roomId].players[playerId];
    delete rooms[roomId].sockets[playerId];

    broadcast(roomId, {
      type: "leave",
      id: playerId
    });

    console.log(`Player ${playerId} left ${roomId}`);
  });
});

server.listen(3000, () => {
  console.log("Server running with rooms");
});
