import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncStudentPasswords() {
  try {
    console.log('Starting password synchronization...');

    // Get all students
    const students = await prisma.student.findMany({
      select: {
        id: true,
        email: true,
        matricNo: true,
        password: true,
      },
    });

    console.log(`Found ${students.length} students`);

    let updatedCount = 0;

    for (const student of students) {
      // Find corresponding applicant by email
      const applicant = await prisma.applicant.findUnique({
        where: { email: student.email },
        select: { password: true, email: true },
      });

      if (applicant && applicant.password) {
        // Check if passwords are different
        if (student.password !== applicant.password) {
          await prisma.student.update({
            where: { id: student.id },
            data: { password: applicant.password },
          });

          console.log(`✓ Updated password for student: ${student.matricNo}`);
          updatedCount++;
        } else {
          console.log(`- Password already in sync for: ${student.matricNo}`);
        }
      } else {
        console.log(`⚠ No applicant found for student: ${student.matricNo} (${student.email})`);
      }
    }

    console.log(`\nSynchronization complete!`);
    console.log(`Total students: ${students.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Already in sync: ${students.length - updatedCount}`);
  } catch (error) {
    console.error('Error syncing passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncStudentPasswords();
