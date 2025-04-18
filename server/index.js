const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, set this to your client's URL
    methods: ["GET", "POST"],
  },
});

// Store active rooms
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle room creation
  socket.on("create:room", () => {
    // Generate a random 6-digit room ID
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();

    // Store room info
    rooms.set(roomId, {
      hostId: socket.id,
      players: [socket.id],
      gameState: null,
    });

    // Join the socket to this room
    socket.join(roomId);

    // Send room ID back to client
    socket.emit("room:created", { roomId });

    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // Handle room joining
  socket.on("join:room", (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room:error", { message: "Room not found" });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("room:error", { message: "Room is full" });
      return;
    }

    // Add player to room
    room.players.push(socket.id);
    rooms.set(roomId, room);

    // Join the socket to this room
    socket.join(roomId);

    // Notify client
    socket.emit("room:joined", { roomId });

    // Notify host
    io.to(room.hostId).emit("player:joined", { playerId: socket.id });

    // If room is now full (2 players), start the game
    if (room.players.length === 2) {
      io.to(roomId).emit("game:start");
    }

    console.log(`Player ${socket.id} joined room ${roomId}`);
  });

  // Handle game state updates
  socket.on("game:update", (data) => {
    const { roomId, gameState } = data;

    // Update game state for this room
    const room = rooms.get(roomId);
    if (room) {
      room.gameState = gameState;

      // Broadcast the game state to all players in the room except sender
      socket.to(roomId).emit("game:state", { gameState });
    }
  });

  // Handle player input
  socket.on("player:input", (data) => {
    const { roomId, input } = data;

    // Broadcast the input to all other players in the room
    socket.to(roomId).emit("opponent:input", { playerId: socket.id, input });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find and clean up any rooms this socket was part of
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        if (room.players.length <= 1) {
          // Last player left, delete the room
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (no players left)`);
        } else {
          // Remove this player from the room
          room.players = room.players.filter((id) => id !== socket.id);
          rooms.set(roomId, room);

          // Notify other players
          io.to(roomId).emit("player:left", { playerId: socket.id });
          console.log(`Player ${socket.id} removed from room ${roomId}`);
        }
      }
    }
  });
});

// Add a simple health check route
app.get("/", (req, res) => {
  res.send("Pong Game Server is running");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
