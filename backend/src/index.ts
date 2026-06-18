import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setIo } from './services/socket';
import prisma from './services/db';
import redis from './services/redis';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // For demo / local development
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Configure Socket.io instance in the global helper
setIo(io);

// Socket.io Connection Event Listeners
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Join a project-specific room to receive updates
  socket.on('join_project', (projectId: string) => {
    if (projectId) {
      const room = `project_${projectId}`;
      socket.join(room);
      console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
    }
  });

  // Leave a project-specific room
  socket.on('leave_project', (projectId: string) => {
    if (projectId) {
      const room = `project_${projectId}`;
      socket.leave(room);
      console.log(`[Socket] Client ${socket.id} left room: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});

// Graceful Shutdown Handler
const handleGracefulShutdown = async (signal: string) => {
  console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);
  
  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed.');
  });

  // Close Prisma connection
  try {
    await prisma.$disconnect();
    console.log('[Server] Prisma disconnected.');
  } catch (err) {
    console.error('[Server] Error disconnecting Prisma:', err);
  }

  // Close Redis connection
  try {
    await redis.quit();
    console.log('[Server] Redis connection closed.');
  } catch (err) {
    console.error('[Server] Error closing Redis connection:', err);
  }

  process.exit(0);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
