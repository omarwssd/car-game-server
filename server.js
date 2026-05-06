const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).substr(2, 9);

  players[id] = { x: 0, y: 0, z: 0, rot: 0 };

  console.log("Player connected:", id);

  // Send player their ID
  ws.send(JSON.stringify({
    type: "init",
    id: id,
    players: players
  }));

  // Notify others
  broadcast({
    type: "join",
    id: id,
    data: players[id]
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "update") {
      players[id] = data.data;

      broadcast({
        type: "update",
        id: id,
        data: data.data
      });
    }
  });

  ws.on("close", () => {
    delete players[id];

    broadcast({
      type: "leave",
      id: id
    });

    console.log("Player disconnected:", id);
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
