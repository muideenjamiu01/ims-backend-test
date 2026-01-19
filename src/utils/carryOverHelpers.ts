import prisma from '../config/database';
import { GradeValue } from '@prisma/client';

/**
 * Get failed courses that are eligible for carry over registration
 * Only for students in levels 200-500
 */
export async function getEligibleCarryOverCourses(studentId: number) {
  // Get student details
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      currentLevel: true,
      departmentId: true,
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // 100-level students cannot register carry over courses
  if (student.currentLevel < 200) {
    return [];
  }

  // Get all failed courses (grade = F)
  const failedResults = await prisma.result.findMany({
    where: {
      studentId,
      grade: GradeValue.F,
    },
    include: {
      course: {
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      },
      session: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { sessionId: 'desc' },
      { semester: 'desc' },
    ],
  });

  // Check which failed courses have already been re-registered or passed
  const failedCourseIds = failedResults.map(r => r.courseId);

  // Get passed courses (grades better than F)
  const passedCourses = await prisma.result.findMany({
    where: {
      studentId,
      courseId: { in: failedCourseIds },
      grade: { not: GradeValue.F },
    },
    select: { courseId: true },
  });

  const passedCourseIds = new Set(passedCourses.map(p => p.courseId));

  // Get currently registered carry over courses for current session
  const currentSession = await prisma.session.findFirst({
    where: { isActive: true },
  });

  let alreadyRegisteredIds: number[] = [];
  if (currentSession) {
    const registeredCarryOvers = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        sessionId: currentSession.id,
        type: 'CARRY_OVER',
        status: { in: ['REGISTERED'] },
      },
      select: { courseId: true },
    });
    alreadyRegisteredIds = registeredCarryOvers.map(r => r.courseId);
  }

  // Filter: only courses that haven't been passed and aren't already registered
  const eligibleFailures = failedResults.filter(result => 
    !passedCourseIds.has(result.courseId) && 
    !alreadyRegisteredIds.includes(result.courseId)
  );

  // Count previous attempts for each course
  const carryOverCourses = await Promise.all(
    eligibleFailures.map(async (result) => {
      const attemptCount = await prisma.result.count({
        where: {
          studentId,
          courseId: result.courseId,
        },
      });

      return {
        id: result.course.id,
        code: result.course.code,
        title: result.course.title,
        description: result.course.description,
        credits: result.course.credits,
        level: result.course.level,
        semester: result.course.semester,
        department: result.course.department,
        originalSessionId: result.sessionId,
        originalSessionName: result.session.name,
        originalSemester: result.semester,
        previousAttempts: attemptCount,
        lastGrade: result.grade,
        lastScore: result.score,
      };
    })
  );

  return carryOverCourses;
}

/**
 * Validate carry over registration
 */
export async function validateCarryOverRegistration(
  studentId: number,
  courseId: number
): Promise<{ valid: boolean; error?: string }> {
  // Get student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { currentLevel: true },
  });

  if (!student) {
    return { valid: false, error: 'Student not found' };
  }

  // Level validation: 100-level students cannot register carry over
  if (student.currentLevel < 200) {
    return { 
      valid: false, 
      error: 'Carry over registration is only available for students in levels 200-500' 
    };
  }

  // Check if course was actually failed
  const failedResult = await prisma.result.findFirst({
    where: {
      studentId,
      courseId,
      grade: GradeValue.F,
    },
  });

  if (!failedResult) {
    return { 
      valid: false, 
      error: 'Course was not previously failed or does not exist in your records' 
    };
  }

  // Check if course has been passed in any subsequent attempt
  const passedResult = await prisma.result.findFirst({
    where: {
      studentId,
      courseId,
      grade: { not: GradeValue.F },
    },
  });

  if (passedResult) {
    return { 
      valid: false, 
      error: 'Cannot register carry over for a course you have already passed' 
    };
  }

  // Check if already registered for current session
  const currentSession = await prisma.session.findFirst({
    where: { isActive: true },
  });

  if (currentSession) {
    const existingRegistration = await prisma.courseRegistration.findFirst({
      where: {
        studentId,
        courseId,
        sessionId: currentSession.id,
        status: 'REGISTERED',
      },
    });

    if (existingRegistration) {
      return { 
        valid: false, 
        error: 'You have already registered for this course in the current session' 
      };
    }
  }

  return { valid: true };
}
