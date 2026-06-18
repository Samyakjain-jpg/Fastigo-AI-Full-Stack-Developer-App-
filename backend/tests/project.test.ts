import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforprodgradeapp';

jest.mock('../src/services/db', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('Project Controller Tests', () => {
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

  describe('POST /api/projects', () => {
    it('should create a project and set creator as OWNER', async () => {
      const mockProject = {
        id: 'project-abc',
        name: 'New Project',
        description: 'Project Desc',
        ownerId: 'user-123',
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Project',
          description: 'Project Desc',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockProject);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should block unauthorized requests', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Unauthorized Project',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should return projects that user belongs to', async () => {
      const mockMemberships = [
        {
          project: {
            id: 'project-1',
            name: 'Project 1',
            members: [],
          },
        },
      ];

      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue(mockMemberships);

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('project-1');
    });
  });
});
