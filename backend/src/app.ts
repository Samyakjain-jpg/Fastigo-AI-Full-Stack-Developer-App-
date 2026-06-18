import express from 'express';
import cors from 'cors';
import { register, login } from './controllers/auth';
import { authenticateToken } from './middleware/auth';
import {
  createProject,
  getProjects,
  getProjectById,
  addProjectMember,
  getUsers
} from './controllers/projects';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  searchTasks,
  getTaskSummary
} from './controllers/tasks';
import prisma from './services/db';
import redis from './services/redis';

const app = express();

app.use(cors({
  origin: '*', // For demo / local development. In production, define actual domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Public health check route
app.get('/api/health', async (req, res) => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  try {
    await redis.ping();
  } catch (err) {
    redisStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';
  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      cache: redisStatus
    }
  });
});

// Authentication Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// Authenticated Routes
app.use(authenticateToken);

// User Queries
app.get('/api/users', getUsers);

// Project Routes
app.post('/api/projects', createProject);
app.get('/api/projects', getProjects);
app.get('/api/projects/:id', getProjectById);
app.post('/api/projects/:id/members', addProjectMember);

// Task Routes
app.post('/api/tasks', createTask);
app.get('/api/tasks', getTasks);
app.put('/api/tasks/:id', updateTask);
app.delete('/api/tasks/:id', deleteTask);
app.get('/api/tasks/search', searchTasks); // Query params: projectId, q
app.post('/api/tasks/:id/summary', getTaskSummary);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error Handler]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
