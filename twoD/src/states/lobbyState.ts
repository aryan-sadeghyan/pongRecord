import { GameState, GameDI } from "./GameState";
import { canvas } from "../main";
import { io, Socket } from "socket.io-client";

interface LobbyStateI extends GameState {
  enter(gameDI?: GameDI): void;
  exit(gameDI?: GameDI): void;
  update(...args: any[]): void;
  render(...args: any[]): void;
  handleInput(gameDI: GameDI, keyCode: string, pressed: boolean): void;
  startLoop(gameDI: GameDI): void;
  stopLoop(): void;
}

interface Button {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onClick: () => void;
}

export default class LobbyState implements LobbyStateI {
  private animationFrameId: number | null = null;
  private buttons: Button[] = [];
  private messages: string[] = [];
  private gameDI: GameDI | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;

  enter(gameDI: GameDI): void {
    console.log("Entering Lobby State");
    this.gameDI = gameDI;

    // Connect to Socket.io server
    this.connectToServer();

    // Create buttons
    this.initializeButtons();

    // Add click listener
    this.clickHandler = this.handleClick.bind(this);
    canvas.addEventListener("click", this.clickHandler);

    // Add initial message
    this.addMessage("Welcome to the Lobby");

    this.startLoop(gameDI);
  }

  exit(gameDI: GameDI): void {
    console.log("Exiting Lobby State");

    // Remove click handler
    if (this.clickHandler) {
      canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.stopLoop();
  }

  connectToServer(): void {
    // Connect to the Socket.io server
    try {
      this.socket = io("http://localhost:3000");

      // Set up socket event listeners
      this.socket.on("connect", () => {
        this.addMessage("Connected to server!");
      });

      this.socket.on("disconnect", () => {
        this.addMessage("Disconnected from server");
      });

      this.socket.on("room:created", (data) => {
        this.currentRoomId = data.roomId;
        this.addMessage(`Room created! Room ID: ${data.roomId}`);
      });

      this.socket.on("room:joined", (data) => {
        this.currentRoomId = data.roomId;
        this.addMessage(`Joined room: ${data.roomId}`);
      });

      this.socket.on("room:error", (data) => {
        this.addMessage(`Error: ${data.message}`);
      });

      this.socket.on("player:joined", () => {
        this.addMessage("Another player has joined your room!");
      });

      this.socket.on("game:start", () => {
        this.addMessage("Game starting...");
        // Wait a moment before starting the game to let players see the message
        setTimeout(() => {
          if (this.gameDI) {
            this.gameDI.changeState(this.gameDI.playState);
          }
        }, 2000);
      });
    } catch (error) {
      console.error("Failed to connect to server:", error);
      this.addMessage("Failed to connect to server");
    }
  }

  initializeButtons(): void {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const btnWidth = 300;
    const btnHeight = 60;
    const btnX = canvasWidth / 2 - btnWidth / 2;

    this.buttons = [
      {
        x: btnX,
        y: 200,
        width: btnWidth,
        height: btnHeight,
        text: "Create Room",
        onClick: () => this.createRoom(),
      },
      {
        x: btnX,
        y: 300,
        width: btnWidth,
        height: btnHeight,
        text: "Join Room",
        onClick: () => this.promptJoinRoom(),
      },
      {
        x: btnX,
        y: 400,
        width: btnWidth,
        height: btnHeight,
        text: "Back to Menu",
        onClick: () => this.goBackToMenu(),
      },
    ];
  }

  handleClick(e: MouseEvent): void {
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if any button was clicked
    for (const button of this.buttons) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
      ) {
        button.onClick();
        break;
      }
    }
  }

  createRoom(): void {
    if (this.socket) {
      this.socket.emit("create:room");
      this.addMessage("Creating room...");
    } else {
      this.addMessage("Error: Not connected to server");
    }
  }

  promptJoinRoom(): void {
    // In a real implementation, this would be a proper input dialog
    // For now, we'll use the browser's prompt
    const roomId = prompt("Enter Room ID to join:");
    if (roomId) {
      this.joinRoom(roomId);
    }
  }

  joinRoom(roomId: string): void {
    if (this.socket) {
      this.socket.emit("join:room", { roomId });
      this.addMessage(`Attempting to join room ${roomId}...`);
    } else {
      this.addMessage("Error: Not connected to server");
    }
  }

  goBackToMenu(): void {
    if (this.gameDI) {
      this.gameDI.changeState(this.gameDI.menuState);
    }
  }

  addMessage(message: string): void {
    this.messages.push(message);
    // Keep only the last 5 messages
    if (this.messages.length > 5) {
      this.messages.shift();
    }
    console.log(message);
  }

  update(dt: number): void {
    // No continuous updates needed for lobby
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Title
    ctx.fillStyle = "white";
    ctx.font = "48px 'Lexend Mega'";
    ctx.textAlign = "center";
    ctx.fillText("Lobby", ctx.canvas.width / 2, 100);

    // Connection status
    ctx.fillStyle = this.socket?.connected ? "#00ff00" : "#ff0000";
    ctx.font = "16px 'Lexend Mega'";
    ctx.fillText(
      this.socket?.connected ? "Connected to Server" : "Not Connected",
      ctx.canvas.width / 2,
      140
    );

    // Current room info
    if (this.currentRoomId) {
      ctx.fillStyle = "white";
      ctx.font = "20px 'Lexend Mega'";
      ctx.fillText(`Room ID: ${this.currentRoomId}`, ctx.canvas.width / 2, 170);
    }

    // Draw buttons
    this.buttons.forEach((button) => {
      // Button background
      ctx.fillStyle = "#333";
      ctx.fillRect(button.x, button.y, button.width, button.height);

      // Button border
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x, button.y, button.width, button.height);

      // Button text
      ctx.fillStyle = "white";
      ctx.font = "24px 'Lexend Mega'";
      ctx.textAlign = "center";
      ctx.fillText(
        button.text,
        button.x + button.width / 2,
        button.y + button.height / 2 + 8
      );
    });

    // Message display area
    const messageAreaX = ctx.canvas.width / 2 - 350;
    const messageAreaY = 500;
    const messageAreaWidth = 700;
    const messageAreaHeight = 150;

    // Message area background
    ctx.fillStyle = "#111";
    ctx.fillRect(
      messageAreaX,
      messageAreaY,
      messageAreaWidth,
      messageAreaHeight
    );

    // Message area border
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      messageAreaX,
      messageAreaY,
      messageAreaWidth,
      messageAreaHeight
    );

    // Draw messages
    ctx.fillStyle = "white";
    ctx.font = "18px 'Lexend Mega'";
    ctx.textAlign = "left";

    this.messages.forEach((message, index) => {
      ctx.fillText(message, messageAreaX + 20, messageAreaY + 30 + index * 25);
    });
  }

  handleInput(gameDI: GameDI, keyCode: string, pressed: boolean): void {
    if (pressed) {
      if (keyCode === "Escape") {
        gameDI.changeState(gameDI.menuState);
      }
    }
  }

  startLoop(gameDI: GameDI): void {
    console.log("Starting Loop for Lobby State");

    const loop = () => {
      const context = canvas.getContext("2d");
      if (context) {
        // Ensure canvas dimensions are up to date
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Re-initialize buttons on resize
        this.initializeButtons();

        this.render(context);
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  stopLoop(): void {
    console.log("Stopping Loop for Lobby State");
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
