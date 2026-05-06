const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Store players
const players = {};

// When player connects
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Add player
  players[socket.id] = {
    x: 0,
    y: 0,
    z: 0,
    rot: 0
  };

  // Send current players to new player
  socket.emit("current_players", players);

  // Notify others
  socket.broadcast.emit("player_joined", {
    id: socket.id,
    data: players[socket.id]
  });

  // Receive movement updates
  socket.on("update", (data) => {
    if (players[socket.id]) {
      players[socket.id] = data;

      // Broadcast to others
      socket.broadcast.emit("player_moved", {
        id: socket.id,
        data
      });
    }
  });

  // On disconnect
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    delete players[socket.id];

    io.emit("player_left", socket.id);
  });
});

// Start server
server.listen(3000, () => {
  console.log("Server running on port 3000");
});
