import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Create a new session
export const createSession = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Session name, start date, and end date are required',
      });
    }

    // If this session is being set as active, deactivate all other sessions
    if (isActive) {
      await prisma.session.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const session = await prisma.session.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
      },
    });

    logger.info(`Session created: ${session.name}`);
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session,
    });
  } catch (error) {
    logger.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
    });
  }
};

// Get all sessions
export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: {
        startDate: 'desc',
      },
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
    });
  }
};

// Get a single session
export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: parseInt(id) },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session',
    });
  }
};

// Update a session
export const updateSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const session = await prisma.session.findUnique({
      where: { id: parseInt(id) },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // If this session is being set as active, deactivate all other sessions
    if (isActive === true) {
      await prisma.session.updateMany({
        where: { 
          isActive: true,
          id: { not: parseInt(id) }
        },
        data: { isActive: false },
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedSession = await prisma.session.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    logger.info(`Session updated: ${updatedSession.name}`);
    res.json({
      success: true,
      message: 'Session updated successfully',
      data: updatedSession,
    });
  } catch (error) {
    logger.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session',
    });
  }
};

// Delete a session
export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check if session has associated invoices
    if (session._count.invoices > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete session. It has ${session._count.invoices} associated invoices. Please delete or reassign those invoices first.`,
      });
    }

    await prisma.session.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Session deleted: ${session.name}`);
    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    logger.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session',
    });
  }
};

// Get active session
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { isActive: true },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error('Get active session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active session',
    });
  }
};
