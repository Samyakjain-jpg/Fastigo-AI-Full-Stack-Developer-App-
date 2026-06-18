import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/db';
import redis from '../src/services/redis';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforprodgradeapp';

jest.mock('../src/services/db', () => ({
  __esModule: true,
  default: {
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../src/services/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

jest.mock('../src/services/socket', () => ({
  emitToProject: jest.fn(),
}));

describe('Task Controller Tests', () => {
  let authToken: string;

  beforeAll(() => {
    authToken = jwt.sign(
      { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/tasks', () => {
    it('should create task if requester is project member', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'New Task',
        projectId: 'project-1',
        assigneeId: null,
      };

      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-123' });
      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Task',
          projectId: 'project-1',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockTask);
    });

    it('should forbid non-members from task creation', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Illegal Task',
          projectId: 'project-1',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/tasks/search', () => {
    it('should return tasks from db and cache them in Redis', async () => {
      const mockTasks = [{ id: 'task-1', title: 'Search Me' }];
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-123' });
      (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/api/tasks/search?projectId=project-1&q=Search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTasks);
      expect(redis.set).toHaveBeenCalled();
    });

    it('should return cached tasks if available in Redis', async () => {
      const cachedTasks = [{ id: 'task-1', title: 'Cached Task' }];
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-123' });
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedTasks));

      const response = await request(app)
        .get('/api/tasks/search?projectId=project-1&q=Cached')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(cachedTasks);
      expect(prisma.task.findMany).not.toHaveBeenCalled(); // DB is skipped!
    });
  });
});
