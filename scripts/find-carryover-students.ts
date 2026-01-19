import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findCarryOverStudents() {
  console.log('🔍 Finding students with carry over courses...\n');

  // Find all students with failed courses (grade = F)
  const studentsWithFailures = await prisma.result.findMany({
    where: {
      grade: 'F',
    },
    include: {
      student: {
        include: {
          department: true,
        },
      },
      course: true,
      session: true,
    },
    orderBy: [
      { student: { currentLevel: 'desc' } },
      { studentId: 'asc' },
    ],
  });

  // Group by student
  const studentMap = new Map<number, any>();

  for (const result of studentsWithFailures) {
    if (!studentMap.has(result.studentId)) {
      studentMap.set(result.studentId, {
        student: result.student,
        failedCourses: [],
      });
    }
    studentMap.get(result.studentId).failedCourses.push({
      course: result.course,
      session: result.session,
      semester: result.semester,
      grade: result.grade,
      score: result.score,
    });
  }

  console.log(`📊 Found ${studentMap.size} students with failed courses\n`);
  console.log('=' .repeat(100));

  let count = 0;
  for (const [studentId, data] of studentMap) {
    const student = data.student;
    const failedCourses = data.failedCourses;

    count++;
    console.log(`\n${count}. 👤 Student Information:`);
    console.log(`   Name: ${student.firstName} ${student.lastName}`);
    console.log(`   Matric No: ${student.matricNo}`);
    console.log(`   Username: ${student.username}`);
    console.log(`   Email: ${student.email}`);
    console.log(`   Level: ${student.currentLevel}`);
    console.log(`   Department: ${student.department.name}`);
    console.log(`   Status: ${student.status}`);
    
    console.log(`\n   📚 Failed Courses (${failedCourses.length}):`);
    failedCourses.forEach((fc: any, idx: number) => {
      console.log(`      ${idx + 1}. ${fc.course.code} - ${fc.course.title}`);
      console.log(`         Credits: ${fc.course.credits} | Level: ${fc.course.level} | Semester: ${fc.semester}`);
      console.log(`         Session: ${fc.session.name} | Grade: ${fc.grade} | Score: ${fc.score}`);
    });

    console.log('\n   🔑 Login Credentials:');
    console.log(`      Username: ${student.username}`);
    console.log(`      Password: password123 (default)`);
    
    console.log('\n' + '-'.repeat(100));

    // Show only first 10 students for readability
    if (count >= 10) {
      console.log(`\n... and ${studentMap.size - 10} more students`);
      break;
    }
  }

  console.log('\n✅ Done! Use the credentials above to login and test carry over registration.');
  console.log('\n💡 Quick Test Steps:');
  console.log('   1. Login to student portal with any username above');
  console.log('   2. Navigate to Course Registration');
  console.log('   3. You should see the "Carry Over Courses" section');
  console.log('   4. Select failed courses and choose retake type');
  console.log('   5. Submit registration with normal + carry over courses\n');
}

findCarryOverStudents()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
