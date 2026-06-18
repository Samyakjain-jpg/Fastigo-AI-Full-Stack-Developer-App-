import { Request, Response } from 'express';
import prisma from '../services/db';

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Use a Prisma transaction to create the project and add the creator as OWNER
    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name,
          description,
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          userId,
          role: 'OWNER',
        },
      });

      return proj;
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error('[Project Controller] Create Project Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find all projects where user is a member
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    const projects = memberships.map(m => m.project);
    return res.status(200).json(projects);
  } catch (error) {
    console.error('[Project Controller] Get Projects Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify membership
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId
        }
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this project' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true }
            },
            creator: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json(project);
  } catch (error) {
    console.error('[Project Controller] Get Project By Id Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addProjectMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Project ID
    const { email, role } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Verify the requesting user is a member of the project
    const requesterMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId
        }
      }
    });

    if (!requesterMembership) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Find the user to add
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User with this email not found' });
    }

    // Check if target user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: targetUser.id
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    // Add user as member
    const newMember = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId: targetUser.id,
        role: role === 'OWNER' ? 'OWNER' : 'MEMBER'
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(201).json(newMember);
  } catch (error) {
    console.error('[Project Controller] Add Project Member Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error('[Project Controller] Get Users Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
