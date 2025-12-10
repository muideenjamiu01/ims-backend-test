import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { StudentAuthRequest } from '../types/express';
import logger from '../config/logger';
import { calculateGPA } from '../utils/helpers';
import { generateTranscript } from '../utils/pdfGenerator';
import path from 'path';
import fs from 'fs';

// Validation schemas
const getResultsSchema = z.object({
  sessionId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  semester: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

const getTranscriptSchema = z.object({
  format: z.enum(['pdf', 'json']).optional().default('pdf'),
});

/**
 * Get student results
 */
export const getResults = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = getResultsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { sessionId, semester } = validation.data;
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        matricNo: true,
        firstName: true,
        lastName: true,
        currentLevel: true,
        department: {
          select: { name: true, code: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Build filter
    const where: any = { studentId };
    if (sessionId) where.sessionId = sessionId;
    if (semester) where.semester = semester;

    // Get results
    const results = await prisma.result.findMany({
      where,
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
            level: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { sessionId: 'desc' },
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No results found for the specified criteria',
        data: {
          student,
          results: [],
          summary: null,
        },
      });
    }

    // Group by session and semester
    const groupedResults: Record<string, any> = {};

    results.forEach(result => {
      const key = `${result.sessionId}_${result.semester}`;
      
      if (!groupedResults[key]) {
        groupedResults[key] = {
          sessionId: result.sessionId,
          sessionName: result.session.name,
          semester: result.semester,
          courses: [],
          totalCredits: 0,
          gpa: 0,
        };
      }

      groupedResults[key].courses.push({
        code: result.course.code,
        title: result.course.title,
        credits: result.course.credits,
        score: result.score,
        grade: result.grade,
        gradePoint: result.gradePoint,
        isCarryOver: result.isCarryOver,
      });

      groupedResults[key].totalCredits += result.course.credits;
    });

    // Calculate GPA for each semester
    Object.values(groupedResults).forEach((group: any) => {
      const resultsData = group.courses.map((c: any) => ({
        score: c.score,
        credits: c.credits,
      }));
      group.gpa = calculateGPA(resultsData);
    });

    // Calculate CGPA (overall)
    const allResults = results.map(r => ({
      score: r.score,
      credits: r.course.credits,
    }));
    const cgpa = calculateGPA(allResults);

    // Calculate total credits earned
    const totalCreditsEarned = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        student,
        results: Object.values(groupedResults),
        summary: {
          cgpa: cgpa.toFixed(2),
          totalCreditsEarned,
          totalCoursesCompleted: results.filter(r => r.grade !== 'F').length,
          totalCoursesFailed: results.filter(r => r.grade === 'F').length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getResults:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch results',
      error: error.message,
    });
  }
};

/**
 * Get results for specific session and semester
 */
export const getSemesterResults = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { sessionId, semester } = req.params;
    const studentId = req.student!.id;

    if (!sessionId || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and semester are required',
      });
    }

    const results = await prisma.result.findMany({
      where: {
        studentId,
        sessionId: parseInt(sessionId),
        semester: parseInt(semester),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
            level: true,
          },
        },
        session: {
          select: { name: true },
        },
      },
      orderBy: {
        course: { code: 'asc' },
      },
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No results found for this semester',
      });
    }

    // Calculate GPA
    const resultsData = results.map(r => ({
      score: r.score,
      credits: r.course.credits,
    }));
    const gpa = calculateGPA(resultsData);

    const totalCredits = results.reduce((sum, r) => sum + r.course.credits, 0);
    const creditsPassed = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        session: results[0].session.name,
        semester: parseInt(semester),
        courses: results.map(r => ({
          code: r.course.code,
          title: r.course.title,
          credits: r.course.credits,
          score: r.score,
          grade: r.grade,
          gradePoint: r.gradePoint,
          isCarryOver: r.isCarryOver,
          remarks: r.remarks,
        })),
        summary: {
          gpa: gpa.toFixed(2),
          totalCredits,
          creditsPassed,
          coursesPassed: results.filter(r => r.grade !== 'F').length,
          coursesFailed: results.filter(r => r.grade === 'F').length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getSemesterResults:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch semester results',
      error: error.message,
    });
  }
};

/**
 * Get GPA and CGPA summary
 */
export const getGPASummary = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        matricNo: true,
        firstName: true,
        lastName: true,
        currentLevel: true,
        department: {
          select: { name: true },
        },
        program: {
          select: { name: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get all results grouped by session and semester
    const results = await prisma.result.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
          },
        },
        session: {
          select: { name: true },
        },
      },
      orderBy: [
        { sessionId: 'asc' },
        { semester: 'asc' },
      ],
    });

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No results available yet',
        data: {
          student,
          semesterGPAs: [],
          cgpa: 0,
          totalCreditsEarned: 0,
        },
      });
    }

    // Group by session and semester
    const semesterGroups: Record<string, any> = {};

    results.forEach(result => {
      const key = `${result.sessionId}_${result.semester}`;
      
      if (!semesterGroups[key]) {
        semesterGroups[key] = {
          sessionId: result.sessionId,
          sessionName: result.session.name,
          semester: result.semester,
          results: [],
        };
      }

      semesterGroups[key].results.push({
        score: result.score,
        credits: result.course.credits,
        grade: result.grade,
      });
    });

    // Calculate GPA for each semester
    const semesterGPAs = Object.values(semesterGroups).map((group: any) => {
      const gpa = calculateGPA(group.results);
      const totalCredits = group.results.reduce((sum: number, r: any) => sum + r.credits, 0);
      const creditsPassed = group.results
        .filter((r: any) => r.grade !== 'F')
        .reduce((sum: number, r: any) => sum + r.credits, 0);

      return {
        session: group.sessionName,
        semester: group.semester,
        gpa: parseFloat(gpa.toFixed(2)),
        totalCredits,
        creditsPassed,
      };
    });

    // Calculate overall CGPA
    const allResults = results.map(r => ({
      score: r.score,
      credits: r.course.credits,
    }));
    const cgpa = calculateGPA(allResults);

    const totalCreditsEarned = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    const totalCreditsAttempted = results.reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          matricNo: student.matricNo,
          name: `${student.firstName} ${student.lastName}`,
          level: student.currentLevel,
          department: student.department.name,
          program: student.program?.name,
        },
        semesterGPAs,
        cgpa: parseFloat(cgpa.toFixed(2)),
        totalCreditsEarned,
        totalCreditsAttempted,
        creditsRemaining: Math.max(0, (student.currentLevel / 100) * 30 - totalCreditsEarned), // Approximate
      },
    });
  } catch (error: any) {
    logger.error('Error in getGPASummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch GPA summary',
      error: error.message,
    });
  }
};

/**
 * Download academic transcript
 */
export const downloadTranscript = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = getTranscriptSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { format } = validation.data;
    const studentId = req.student!.id;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true, code: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get all results
    const results = await prisma.result.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
          },
        },
        session: {
          select: { name: true },
        },
      },
      orderBy: [
        { sessionId: 'asc' },
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No results available to generate transcript',
      });
    }

    // Group results by session and semester
    const groupedResults: Record<string, any> = {};

    results.forEach(result => {
      const key = `${result.sessionId}_${result.semester}`;
      
      if (!groupedResults[key]) {
        groupedResults[key] = {
          session: result.session.name,
          semester: result.semester,
          courses: [],
        };
      }

      groupedResults[key].courses.push({
        code: result.course.code,
        title: result.course.title,
        credits: result.course.credits,
        score: result.score,
        grade: result.grade,
        gradePoint: result.gradePoint,
      });
    });

    // Calculate CGPA
    const allResults = results.map(r => ({
      score: r.score,
      credits: r.course.credits,
    }));
    const cgpa = calculateGPA(allResults);

    const totalCreditsEarned = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    if (format === 'json') {
      return res.status(200).json({
        success: true,
        data: {
          student: {
            matricNo: student.matricNo,
            name: `${student.firstName} ${student.lastName}`,
            department: student.department.name,
            program: student.program?.name,
            level: student.currentLevel,
          },
          results: Object.values(groupedResults),
          summary: {
            cgpa: parseFloat(cgpa.toFixed(2)),
            totalCreditsEarned,
            totalCoursesCompleted: results.filter(r => r.grade !== 'F').length,
          },
        },
      });
    }

    // Generate PDF transcript
    const outputPath = path.join(
      process.env.UPLOAD_DIR || 'uploads',
      'transcripts',
      `transcript_${student.matricNo}_${Date.now()}.pdf`
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const transcriptPath = await generateTranscript(
      {
        firstName: student.firstName,
        lastName: student.lastName,
        matricNo: student.matricNo,
        department: student.department.name,
        program: student.program?.name || 'N/A',
      },
      Object.values(groupedResults),
      cgpa,
      outputPath
    );

    // Check if file exists
    if (!fs.existsSync(transcriptPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate transcript PDF',
      });
    }

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcript_${student.matricNo}.pdf"`
    );

    const fileStream = fs.createReadStream(transcriptPath);
    fileStream.pipe(res);

    logger.info(`Transcript generated for student ${student.matricNo}`);
  } catch (error: any) {
    logger.error('Error in downloadTranscript:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download transcript',
      error: error.message,
    });
  }
};

/**
 * Check if results are published for a session/semester
 */
export const checkResultsPublished = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { sessionId, semester } = req.params;
    const studentId = req.student!.id;

    if (!sessionId || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and semester are required',
      });
    }

    // Check if student has any results for this session/semester
    const resultsCount = await prisma.result.count({
      where: {
        studentId,
        sessionId: parseInt(sessionId),
        semester: parseInt(semester),
      },
    });

    // Get registered courses count
    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
      select: { name: true },
    });

    const registeredCount = await prisma.courseRegistration.count({
      where: {
        studentId,
        academicYear: session?.name,
        semester: parseInt(semester),
      },
    });

    const isPublished = resultsCount > 0;
    const isComplete = resultsCount === registeredCount;

    return res.status(200).json({
      success: true,
      data: {
        isPublished,
        isComplete,
        resultsCount,
        registeredCount,
        message: isPublished
          ? isComplete
            ? 'All results published'
            : 'Results partially published'
          : 'Results not yet published',
      },
    });
  } catch (error: any) {
    logger.error('Error in checkResultsPublished:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check results status',
      error: error.message,
    });
  }
};

/**
 * Get failed courses (for carry-over registration)
 */
export const getFailedCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const failedResults = await prisma.result.findMany({
      where: {
        studentId,
        grade: 'F',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
            level: true,
          },
        },
        session: {
          select: { name: true },
        },
      },
      orderBy: [
        { sessionId: 'desc' },
        { semester: 'desc' },
      ],
    });

    // Check which failed courses have been re-registered as carry-over
    const failedCourseIds = failedResults.map(r => r.courseId);
    const carryOverRegistrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        courseId: { in: failedCourseIds },
        isCarryOver: true,
      },
      select: { courseId: true },
    });

    const reRegisteredIds = new Set(carryOverRegistrations.map(r => r.courseId));

    const coursesWithStatus = failedResults.map(result => ({
      courseId: result.course.id,
      code: result.course.code,
      title: result.course.title,
      credits: result.course.credits,
      level: result.course.level,
      session: result.session.name,
      semester: result.semester,
      score: result.score,
      isReRegistered: reRegisteredIds.has(result.courseId),
    }));

    return res.status(200).json({
      success: true,
      data: {
        failedCourses: coursesWithStatus,
        totalFailed: failedResults.length,
        totalReRegistered: carryOverRegistrations.length,
        pendingCarryOver: failedResults.length - carryOverRegistrations.length,
      },
    });
  } catch (error: any) {
    logger.error('Error in getFailedCourses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch failed courses',
      error: error.message,
    });
  }
};
