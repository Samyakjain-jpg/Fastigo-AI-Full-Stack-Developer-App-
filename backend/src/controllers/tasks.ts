import { Request, Response } from 'express';
import prisma from '../services/db';
import redis from '../services/redis';
import { generateTaskSummary } from '../services/ai';
import { emitToProject } from '../services/socket';

// Helper to invalidate project-specific search caches
const invalidateSearchCache = async (projectId: string) => {
  try {
    const keys = await redis.keys(`project:${projectId}:search:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('[Redis Cache] Failed to invalidate search cache:', error);
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, status, priority, dueDate, projectId, assigneeId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !projectId) {
      return res.status(400).json({ error: 'Title and projectId are required' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this project' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        assigneeId: assigneeId || null,
        creatorId: userId
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    // Invalidate caches
    await invalidateSearchCache(projectId);

    // Notify other users
    emitToProject(projectId, 'task_created', task);

    return res.status(201).json(task);
  } catch (error) {
    console.error('[Task Controller] Create Task Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error('[Task Controller] Get Tasks Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assigneeId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current task to check project and memberships
    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: existingTask.projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Update
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        priority: priority !== undefined ? priority : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        assigneeId: assigneeId !== undefined ? (assigneeId || null) : undefined
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    // Invalidate Redis caches
    await invalidateSearchCache(existingTask.projectId);
    // Invalidate AI Summary if description changed
    if (description !== undefined && description !== existingTask.description) {
      await redis.del(`task:summary:${id}`);
    }

    // Broadcast update
    emitToProject(existingTask.projectId, 'task_updated', updatedTask);

    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('[Task Controller] Update Task Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: existingTask.projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    await prisma.task.delete({
      where: { id }
    });

    // Invalidate Redis caches
    await invalidateSearchCache(existingTask.projectId);
    await redis.del(`task:summary:${id}`);

    // Broadcast deletion
    emitToProject(existingTask.projectId, 'task_deleted', { id, projectId: existingTask.projectId });

    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[Task Controller] Delete Task Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const searchTasks = async (req: Request, res: Response) => {
  try {
    const { projectId, q } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const queryStr = typeof q === 'string' ? q.trim() : '';

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Check Redis Cache if query is non-empty
    const cacheKey = `project:${projectId}:search:${queryStr}`;
    if (queryStr) {
      try {
        const cachedResults = await redis.get(cacheKey);
        if (cachedResults) {
          console.log(`[Redis Cache] Hit for: ${cacheKey}`);
          return res.status(200).json(JSON.parse(cachedResults));
        }
      } catch (err) {
        console.error('[Redis Cache] Error reading search cache:', err);
      }
    }

    // Perform DB Fuzzy search
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        OR: [
          { title: { contains: queryStr, mode: 'insensitive' } },
          { description: { contains: queryStr, mode: 'insensitive' } }
        ]
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Cache results in Redis for 5 minutes if a search query was supplied
    if (queryStr) {
      try {
        await redis.set(cacheKey, JSON.stringify(tasks), 'EX', 300);
      } catch (err) {
        console.error('[Redis Cache] Error saving search cache:', err);
      }
    }

    return res.status(200).json(tasks);
  } catch (error) {
    console.error('[Task Controller] Search Tasks Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getTaskSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Task ID
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Check Redis Cache
    const cacheKey = `task:summary:${id}`;
    try {
      const cachedSummary = await redis.get(cacheKey);
      if (cachedSummary) {
        console.log(`[Redis Cache] Hit for summary: ${cacheKey}`);
        return res.status(200).json({ summary: cachedSummary });
      }
    } catch (err) {
      console.error('[Redis Cache] Error reading summary cache:', err);
    }

    // If already stored in DB, we can return and cache it
    if (task.aiSummary) {
      try {
        await redis.set(cacheKey, task.aiSummary, 'EX', 3600);
      } catch (err) {
        console.error('[Redis Cache] Error saving summary to cache:', err);
      }
      return res.status(200).json({ summary: task.aiSummary });
    }

    // Generate new summary
    const summary = await generateTaskSummary(task.title, task.description || '');

    // Save summary in database
    await prisma.task.update({
      where: { id },
      data: { aiSummary: summary }
    });

    // Cache in Redis for 1 hour (3600 seconds)
    try {
      await redis.set(cacheKey, summary, 'EX', 3600);
    } catch (err) {
      console.error('[Redis Cache] Error saving summary to cache:', err);
    }

    return res.status(200).json({ summary });
  } catch (error) {
    console.error('[Task Controller] Task Summary Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
