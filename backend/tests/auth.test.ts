import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/db';

jest.mock('../src/services/db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Auth Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a user and return a JWT token', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should fail registration if fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name, email, and password are required');
    });

    it('should fail if email is already taken', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: 'taken@example.com',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Taken User',
          email: 'taken@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully authenticate user with correct credentials', async () => {
      const bcrypt = require('bcryptjs');
      const mockPasswordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: mockPasswordHash,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should reject invalid password', async () => {
      const bcrypt = require('bcryptjs');
      const mockPasswordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: mockPasswordHash,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email or password');
    });
  });
});
