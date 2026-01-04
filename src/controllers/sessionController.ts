import { Request, Response } from 'express';
import { PrismaClient, SemesterStatus, SemesterType } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Define SessionStatus enum locally since it's not in Prisma schema
enum SessionStatus {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

// ==================== SESSION CONTROLLERS ====================

// Create a new session with optional semesters
export const createSession = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate, isActive, status, semesters } = req.body;

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

    // Create session with semesters if provided
    const session = await prisma.session.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
        status: status || SessionStatus.UPCOMING,
        ...(semesters && semesters.length > 0 && {
          semesters: {
            create: semesters.map((sem: any) => ({
              type: sem.type,
              startDate: new Date(sem.startDate),
              endDate: new Date(sem.endDate),
              isActive: sem.isActive || false,
              status: sem.status || SemesterStatus.UPCOMING,
            })),
          },
        }),
      },
      include: {
        semesters: true,
      },
    });

    logger.info(`Session created: ${session.name} with ${session.semesters.length} semesters`);
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session,
    });
  } catch (error: any) {
    logger.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create session',
    });
  }
};

// Get all sessions with optional semester inclusion
export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const { includeSemesters } = req.query;

    const sessions = await prisma.session.findMany({
      orderBy: {
        startDate: 'desc',
      },
      include: includeSemesters === 'true' ? {
        semesters: {
          orderBy: {
            type: 'asc',
          },
        },
      } : undefined,
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

// Get a single session with semesters
export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: parseInt(id) },
      include: {
        semesters: {
          orderBy: {
            type: 'asc',
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
    const { name, startDate, endDate, isActive, status } = req.body;

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
    if (status !== undefined) updateData.status = status;

    const updatedSession = await prisma.session.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        semesters: true,
      },
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
            semesters: true,
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

    // Delete session (semesters will be cascade deleted)
    await prisma.session.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Session deleted: ${session.name} with ${session._count.semesters} semesters`);
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
      include: {
        semesters: {
          orderBy: {
            type: 'asc',
          },
        },
      },
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

// ==================== SEMESTER CONTROLLERS ====================

// Create a semester for a session
export const createSemester = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { type, startDate, endDate, isActive, status } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Semester type, start date, and end date are required',
      });
    }

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check if semester already exists for this session
    const existingSemester = await prisma.semester.findUnique({
      where: {
        sessionId_type: {
          sessionId: parseInt(sessionId),
          type: type,
        },
      },
    });

    if (existingSemester) {
      return res.status(400).json({
        success: false,
        message: `${type} semester already exists for this session`,
      });
    }

    // If this semester is being set as active, deactivate all other semesters in this session
    if (isActive) {
      await prisma.semester.updateMany({
        where: { 
          sessionId: parseInt(sessionId),
          isActive: true 
        },
        data: { isActive: false },
      });
    }

    const semester = await prisma.semester.create({
      data: {
        sessionId: parseInt(sessionId),
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
        status: status || SemesterStatus.UPCOMING,
      },
    });

    logger.info(`Semester created: ${type} for session ${session.name}`);
    res.status(201).json({
      success: true,
      message: 'Semester created successfully',
      data: semester,
    });
  } catch (error: any) {
    logger.error('Create semester error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create semester',
    });
  }
};

// Get all semesters for a session
export const getSessionSemesters = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const semesters = await prisma.semester.findMany({
      where: { sessionId: parseInt(sessionId) },
      orderBy: {
        type: 'asc',
      },
    });

    res.json({
      success: true,
      data: semesters,
    });
  } catch (error) {
    logger.error('Get session semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters',
    });
  }
};

// Get a single semester
export const getSemester = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(id) },
      include: {
        session: true,
      },
    });

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found',
      });
    }

    res.json({
      success: true,
      data: semester,
    });
  } catch (error) {
    logger.error('Get semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semester',
    });
  }
};

// Update a semester
export const updateSemester = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, isActive, status } = req.body;

    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(id) },
    });

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found',
      });
    }

    // If this semester is being set as active, deactivate all other semesters in this session
    if (isActive === true) {
      await prisma.semester.updateMany({
        where: { 
          sessionId: semester.sessionId,
          isActive: true,
          id: { not: parseInt(id) }
        },
        data: { isActive: false },
      });
    }

    const updateData: any = {};
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (status !== undefined) updateData.status = status;

    const updatedSemester = await prisma.semester.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    logger.info(`Semester updated: ${updatedSemester.type} (ID: ${updatedSemester.id})`);
    res.json({
      success: true,
      message: 'Semester updated successfully',
      data: updatedSemester,
    });
  } catch (error) {
    logger.error('Update semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update semester',
    });
  }
};

// Delete a semester
export const deleteSemester = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            invoices: true,
            courseRegistrations: true,
          },
        },
      },
    });

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found',
      });
    }

    // Check if semester has associated invoices or course registrations
    if (semester._count.invoices > 0 || semester._count.courseRegistrations > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete semester. It has ${semester._count.invoices} invoices and ${semester._count.courseRegistrations} course registrations.`,
      });
    }

    await prisma.semester.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Semester deleted: ${semester.type} (ID: ${semester.id})`);
    res.json({
      success: true,
      message: 'Semester deleted successfully',
    });
  } catch (error) {
    logger.error('Delete semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete semester',
    });
  }
};

// Get active semester
export const getActiveSemester = async (req: Request, res: Response) => {
  try {
    const semester = await prisma.semester.findFirst({
      where: { isActive: true },
      include: {
        session: true,
      },
    });

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'No active semester found',
      });
    }

    res.json({
      success: true,
      data: semester,
    });
  } catch (error) {
    logger.error('Get active semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active semester',
    });
  }
};
