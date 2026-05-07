const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS = 10;

// =========================
// ROOM STORAGE
// =========================
const rooms = {
  // roomId: {
  //   players: {},
  //   sockets: {}
  // }
};

// =========================
// CREATE ROOM
// =========================
function createRoom() {
  const id =
    "room_" + Math.random().toString(36).substr(2, 6);

  rooms[id] = {
    players: {},
    sockets: {}
  };

  console.log("[ROOM CREATED]", id);

  return id;
}

// =========================
// FIND AVAILABLE ROOM
// =========================
function findRoom() {

  for (const id in rooms) {

    if (
      Object.keys(rooms[id].players).length < MAX_PLAYERS
    ) {
      return id;
    }
  }

  return createRoom();
}

// =========================
// SEND TO ONE CLIENT
// =========================
function send(ws, data) {

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// =========================
// BROADCAST TO ROOM
// =========================
function broadcast(roomId, data) {

  if (!rooms[roomId]) return;

  const msg = JSON.stringify(data);

  for (const id in rooms[roomId].sockets) {

    const client = rooms[roomId].sockets[id];

    if (
      client &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(msg);
    }
  }
}

// =========================
// PLAYER CONNECTION
// =========================
wss.on("connection", (ws) => {

  const playerId =
    Math.random().toString(36).substr(2, 9);

  const roomId = findRoom();

  ws.id = playerId;
  ws.roomId = roomId;

  console.log(
    `\n[CONNECT] Player ${playerId} → ${roomId}`
  );

  // store socket immediately
  rooms[roomId].sockets[playerId] = ws;

  // =========================
  // SEND INIT
  // =========================
  send(ws, {
    type: "init",
    id: playerId,
    room: roomId,
    players: rooms[roomId].players
  });

  // =========================
  // RECEIVE MESSAGE
  // =========================
  ws.on("message", (msg) => {

    let data;

    // safe parse
    try {
      data = JSON.parse(msg);
    }
    catch (e) {
      console.log(
        "[ERROR] Invalid JSON:",
        msg.toString()
      );
      return;
    }

    console.log("\n[RECEIVED]");
    console.log(data);

    // =========================
    // JOIN
    // =========================
    if (data.type === "join") {

      const playerName =
        data.name || "Unknown";

      console.log(
        `[JOIN] ${playerName} (${playerId})`
      );

      // store player
      rooms[roomId].players[playerId] = {
        x: 0,
        y: 0,
        z: 0,
        rot: 0,
        name: playerName
      };

      console.log(
        "[PLAYER STORED]",
        rooms[roomId].players[playerId]
      );

      // notify everyone
      broadcast(roomId, {
        type: "join",
        id: playerId,
        name: playerName,
        data: rooms[roomId].players[playerId]
      });
    }

    // =========================
    // UPDATE PLAYER
    // =========================
    if (data.type === "update") {

      if (
        rooms[roomId] &&
        rooms[roomId].players[playerId]
      ) {

        const player =
          rooms[roomId].players[playerId];

        player.x = data.data.x;
        player.y = data.data.y;
        player.z = data.data.z;
        player.rot = data.data.rot;

        broadcast(roomId, {
          type: "update",
          id: playerId,
          data: player
        });
      }
    }
  });

  // =========================
  // DISCONNECT
  // =========================
  ws.on("close", () => {

    let playerName = "Unknown";

    // get name BEFORE delete
    if (
      rooms[roomId] &&
      rooms[roomId].players[playerId]
    ) {
      playerName =
        rooms[roomId].players[playerId].name ||
        "Unknown";
    }

    console.log(
      `\n[DISCONNECT] ${playerName} (${playerId}) left ${roomId}`
    );

    if (rooms[roomId]) {

      delete rooms[roomId].players[playerId];
      delete rooms[roomId].sockets[playerId];

      // notify room
      broadcast(roomId, {
        type: "leave",
        id: playerId,
        name: playerName
      });

      // =========================
      // CLEAN EMPTY ROOM
      // =========================
      if (
        Object.keys(rooms[roomId].players).length === 0
      ) {
        console.log(
          "[ROOM REMOVED]",
          roomId
        );

        delete rooms[roomId];
      }
    }
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
