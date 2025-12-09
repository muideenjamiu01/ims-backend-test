import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate matric number
function generateMatricNumber(year: number, deptCode: string, level: number, sequence: number): string {
  return `SUN${year.toString().slice(-2)}/${deptCode}/${level.toString().padStart(4, '0')}/${sequence.toString().padStart(3, '0')}`;
}

// Helper to generate payment reference
function generatePaymentReference(): string {
  return `PAY${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

// Helper to calculate grade from score
function calculateGrade(score: number): { grade: string; gradePoint: number } {
  if (score >= 70) return { grade: 'A', gradePoint: 5.0 };
  if (score >= 60) return { grade: 'B', gradePoint: 4.0 };
  if (score >= 50) return { grade: 'C', gradePoint: 3.0 };
  if (score >= 45) return { grade: 'D', gradePoint: 2.0 };
  if (score >= 40) return { grade: 'E', gradePoint: 1.0 };
  return { grade: 'F', gradePoint: 0.0 };
}

// Sample data
const programNames = [
  'B.Sc Computer Science',
  'B.Sc Accounting',
  'B.Sc Business Administration',
  'B.Sc Economics',
  'B.Sc Banking and Finance',
  'B.Sc Mass Communication',
  'B.Sc Political Science',
  'B.Sc International Relations',
  'B.Sc Biochemistry',
  'B.Sc Microbiology'
];

const firstNames = [
  'Oluwaseun', 'Chidinma', 'Ibrahim', 'Fatima', 'Emmanuel', 'Blessing', 'Abdullahi', 'Ngozi',
  'Tunde', 'Amina', 'Chukwuemeka', 'Aisha', 'Olumide', 'Zainab', 'Adebayo', 'Hauwa',
  'Ikechukwu', 'Maryam', 'Oluwatobi', 'Khadija', 'Emeka', 'Halima', 'Babatunde', 'Safiya',
  'Chinedu', 'Rahma', 'Adeyemi', 'Laila', 'Obiora', 'Nadia'
];

const lastNames = [
  'Okafor', 'Abubakar', 'Adeleke', 'Mohammed', 'Okonkwo', 'Suleiman', 'Adeyemi', 'Yusuf',
  'Nwankwo', 'Bello', 'Eze', 'Usman', 'Okoro', 'Aliyu', 'Oguike', 'Abdullahi',
  'Chibueze', 'Ibrahim', 'Onyeka', 'Hassan', 'Chukwu', 'Ahmad', 'Emeka', 'Musa',
  'Ifeanyi', 'Ismail', 'Nnamdi', 'Abubakar', 'Obinna', 'Sani'
];

const coursesByDepartment: { [key: string]: { code: string; title: string; credits: number; level: number }[] } = {
  'CSC': [
    { code: 'CSC101', title: 'Introduction to Computer Science', credits: 3, level: 100 },
    { code: 'CSC102', title: 'Computer Programming I', credits: 3, level: 100 },
    { code: 'CSC201', title: 'Data Structures', credits: 4, level: 200 },
    { code: 'CSC202', title: 'Computer Programming II', credits: 3, level: 200 },
    { code: 'CSC301', title: 'Database Management Systems', credits: 4, level: 300 },
    { code: 'CSC302', title: 'Operating Systems', credits: 3, level: 300 },
    { code: 'CSC401', title: 'Software Engineering', credits: 4, level: 400 },
    { code: 'CSC402', title: 'Artificial Intelligence', credits: 3, level: 400 }
  ],
  'ACC': [
    { code: 'ACC101', title: 'Principles of Accounting I', credits: 3, level: 100 },
    { code: 'ACC102', title: 'Principles of Accounting II', credits: 3, level: 100 },
    { code: 'ACC201', title: 'Financial Accounting', credits: 4, level: 200 },
    { code: 'ACC202', title: 'Cost Accounting', credits: 3, level: 200 },
    { code: 'ACC301', title: 'Auditing and Assurance', credits: 4, level: 300 },
    { code: 'ACC302', title: 'Taxation', credits: 3, level: 300 },
    { code: 'ACC401', title: 'Advanced Financial Reporting', credits: 4, level: 400 },
    { code: 'ACC402', title: 'Management Accounting', credits: 3, level: 400 }
  ],
  'BUS': [
    { code: 'BUS101', title: 'Introduction to Business', credits: 3, level: 100 },
    { code: 'BUS102', title: 'Business Mathematics', credits: 3, level: 100 },
    { code: 'BUS201', title: 'Marketing Management', credits: 4, level: 200 },
    { code: 'BUS202', title: 'Human Resource Management', credits: 3, level: 200 },
    { code: 'BUS301', title: 'Strategic Management', credits: 4, level: 300 },
    { code: 'BUS302', title: 'Entrepreneurship', credits: 3, level: 300 },
    { code: 'BUS401', title: 'Business Policy', credits: 4, level: 400 },
    { code: 'BUS402', title: 'International Business', credits: 3, level: 400 }
  ]
};

async function main() {
  console.log('Starting seed process...\n');

  // Get existing departments
  const departments = await prisma.department.findMany();
  console.log(`Found ${departments.length} existing departments`);

  if (departments.length === 0) {
    console.error('No departments found. Please run the main seed first.');
    return;
  }

  // Step 1: Create Programs
  console.log('\n📚 Creating Programs...');
  const programs = [];
  for (let i = 0; i < programNames.length && i < departments.length; i++) {
    const program = await prisma.program.create({
      data: {
        name: programNames[i],
        code: departments[i].code,
        duration: 4,
        departmentId: departments[i].id,
      },
    });
    programs.push(program);
    console.log(`  ✓ Created: ${program.name}`);
  }

  // Step 2: Create Sessions (Academic Years)
  console.log('\n📅 Creating Academic Sessions...');
  const sessions = [];
  const currentYear = 2025;
  for (let i = 0; i < 5; i++) {
    const startYear = currentYear - 4 + i;
    const endYear = startYear + 1;
    const session = await prisma.session.create({
      data: {
        name: `${startYear}/${endYear}`,
        startDate: new Date(startYear, 8, 1), // September 1st
        endDate: new Date(endYear, 7, 31),     // August 31st
        isActive: i === 4, // Only current session is active
      },
    });
    sessions.push(session);
    console.log(`  ✓ Created: ${session.name}${session.isActive ? ' (Active)' : ''}`);
  }

  // Step 3: Create Semesters
  console.log('\n📖 Creating Semesters...');
  const semesters = [];
  for (const session of sessions) {
    // First semester
    const firstSemester = await prisma.semester.create({
      data: {
        type: 'FIRST',
        sessionId: session.id,
        startDate: session.startDate,
        endDate: new Date(session.startDate.getFullYear(), 11, 31), // December 31st
        isActive: session.isActive,
      },
    });
    semesters.push(firstSemester);

    // Second semester
    const secondSemester = await prisma.semester.create({
      data: {
        type: 'SECOND',
        sessionId: session.id,
        startDate: new Date(session.endDate.getFullYear(), 0, 15), // January 15th
        endDate: session.endDate,
        isActive: false, // Current semester is first semester
      },
    });
    semesters.push(secondSemester);
  }
  console.log(`  ✓ Created ${semesters.length} semesters`);

  // Step 4: Create Courses
  console.log('\n📝 Creating Courses...');
  const createdCourses = [];
  for (const dept of departments.slice(0, 3)) {
    const deptCourses = coursesByDepartment[dept.code] || [];
    for (const courseData of deptCourses) {
      const course = await prisma.course.create({
        data: {
          code: courseData.code,
          title: courseData.title,
          credits: courseData.credits,
          level: courseData.level,
          semester: 1,
          departmentId: dept.id,
        },
      });
      createdCourses.push(course);
    }
  }
  console.log(`  ✓ Created ${createdCourses.length} courses`);

  // Step 5: Create Students
  console.log('\n👥 Creating 1000+ Students...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const students = [];

  for (let i = 0; i < 1050; i++) {
    const dept = departments[i % departments.length];
    const program = programs.find(p => p.departmentId === dept.id);
    const level = [100, 200, 300, 400][Math.floor(Math.random() * 4)];
    const enrollmentYear = currentYear - Math.floor(level / 100) + 1;
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@student.sun.edu.ng`;
    const matricNo = generateMatricNumber(enrollmentYear, dept.code, level, i + 1);

    const student = await prisma.student.create({
      data: {
        username: matricNo,
        email,
        firstName,
        lastName,
        matricNo,
        phone: `+234${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        dateOfBirth: new Date(2000 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        address: `${Math.floor(Math.random() * 100) + 1} University Road, Lagos`,
        departmentId: dept.id,
        enrollmentDate: new Date(enrollmentYear, 8, 1),
        status: i % 20 === 0 ? 'SUSPENDED' : 'ACTIVE',
        currentLevel: level,
        password: hashedPassword,
        programId: program?.id,
        walletBalance: Math.floor(Math.random() * 50000),
        acceptanceFeePaid: Math.random() > 0.2, // 80% have paid
      },
    });
    students.push(student);

    if ((i + 1) % 100 === 0) {
      console.log(`  ✓ Created ${i + 1} students...`);
    }
  }
  console.log(`  ✓ Total students created: ${students.length}`);

  // Step 6: Create Invoices
  console.log('\n💰 Creating Invoices...');
  const invoiceTypes = ['SCHOOL_FEE', 'DEPARTMENTAL_FEE', 'TECHNOLOGY_FEE', 'EXAMINATION_FEE', 'ACCEPTANCE_FEE'];
  const amounts: { [key: string]: number } = {
    'SCHOOL_FEE': 250000,
    'DEPARTMENTAL_FEE': 10000,
    'TECHNOLOGY_FEE': 12500,
    'EXAMINATION_FEE': 5000,
    'ACCEPTANCE_FEE': 25000,
  };

  let invoiceCount = 0;
  for (const student of students) {
    // Each student gets 3-5 invoices
    const numInvoices = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numInvoices; i++) {
      const type = invoiceTypes[i % invoiceTypes.length];
      const amount = amounts[type];
      const paid = Math.random() > 0.3; // 70% paid
      const partiallyPaid = !paid && Math.random() > 0.7; // 30% of unpaid are partially paid

      const amountPaid = paid ? amount : (partiallyPaid ? Math.floor(amount * (0.3 + Math.random() * 0.4)) : 0);
      
      await prisma.invoice.create({
        data: {
          invoiceNo: `INV${Date.now()}${invoiceCount.toString().padStart(6, '0')}`,
          studentId: student.id,
          sessionId: sessions[sessions.length - 1].id,
          type: type as any,
          description: `${type.replace(/_/g, ' ')} for ${sessions[sessions.length - 1].name}`,
          amount,
          amountPaid,
          balance: amount - amountPaid,
          level: student.currentLevel,
          dueDate: new Date(currentYear, 10, 30), // November 30th
          status: paid ? 'PAID' : (partiallyPaid ? 'PARTIALLY_PAID' : 'PENDING'),
        },
      });
      invoiceCount++;
    }

    if ((students.indexOf(student) + 1) % 200 === 0) {
      console.log(`  ✓ Created invoices for ${students.indexOf(student) + 1} students...`);
    }
  }
  console.log(`  ✓ Total invoices created: ${invoiceCount}`);

  // Step 7: Create Payments
  console.log('\n💳 Creating Payments...');
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { status: 'PAID' },
        { status: 'PARTIALLY_PAID' }
      ]
    },
    include: { student: true }
  });

  const methods = ['PAYSTACK', 'FLUTTERWAVE', 'WALLET'];
  let paymentCount = 0;
  for (const invoice of paidInvoices) {
    const method = methods[Math.floor(Math.random() * methods.length)];
    await prisma.payment.create({
      data: {
        reference: generatePaymentReference(),
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        amount: invoice.amountPaid,
        method: method as any,
        status: 'PAID',
        paidAt: new Date(currentYear, Math.floor(Math.random() * 10), Math.floor(Math.random() * 28) + 1),
      },
    });
    paymentCount++;

    if (paymentCount % 500 === 0) {
      console.log(`  ✓ Created ${paymentCount} payments...`);
    }
  }
  console.log(`  ✓ Total payments created: ${paymentCount}`);

  // Step 8: Create Assignments
  console.log('\n📄 Creating Assignments...');
  const assignmentCount = 50;
  const assignments = [];
  for (let i = 0; i < assignmentCount; i++) {
    const course = createdCourses[i % createdCourses.length];
    const semester = semesters[semesters.length - 1]; // Current semester
    
    const assignment = await prisma.assignment.create({
      data: {
        title: `Assignment ${i + 1}: ${course.title}`,
        description: `Complete the assignment on ${course.title}. Submit in PDF format.`,
        courseId: course.id,
        sessionId: sessions[sessions.length - 1].id,
        semesterId: semester.id,
        dueDate: new Date(currentYear, 11, Math.floor(Math.random() * 15) + 10),
        maxScore: 100,
        createdBy: 'System Admin',
      },
    });
    assignments.push(assignment);
  }
  console.log(`  ✓ Created ${assignments.length} assignments`);

  // Step 9: Create Course Registrations and Submissions
  console.log('\n📋 Creating Course Registrations and Assignment Submissions...');
  let registrationCount = 0;
  let submissionCount = 0;

  for (const student of students.slice(0, 500)) { // First 500 students
    // Get courses for student's level and department
    const studentCourses = createdCourses.filter(
      c => c.departmentId === student.departmentId && c.level === student.currentLevel
    );

    // Register for 4-6 courses
    const numCourses = Math.min(Math.floor(Math.random() * 3) + 4, studentCourses.length);
    for (let i = 0; i < numCourses; i++) {
      await prisma.courseRegistration.create({
        data: {
          studentId: student.id,
          courseId: studentCourses[i].id,
          semesterId: semesters[semesters.length - 1].id,
          academicYear: sessions[sessions.length - 1].name,
          semester: 1,
        },
      });
      registrationCount++;
    }

    // Submit assignments (60% submission rate)
    for (const assignment of assignments) {
      if (Math.random() > 0.4) {
        const isLate = Math.random() > 0.8;
        const score = isLate ? Math.floor(Math.random() * 50) + 20 : Math.floor(Math.random() * 70) + 30;
        
        await prisma.assignmentSubmission.create({
          data: {
            assignmentId: assignment.id,
            studentId: student.id,
            fileUrl: `/uploads/assignments/submission_${student.matricNo}_${assignment.id}.pdf`,
            submittedAt: isLate ? 
              new Date(assignment.dueDate.getTime() + 86400000 * Math.floor(Math.random() * 5)) : 
              new Date(assignment.dueDate.getTime() - 86400000 * Math.floor(Math.random() * 10)),
            status: Math.random() > 0.5 ? 'GRADED' : 'SUBMITTED',
            score: Math.random() > 0.5 ? score : null,
            remarks: Math.random() > 0.5 ? 'Good work! Well done.' : null,
          },
        });
        submissionCount++;
      }
    }

    if ((students.slice(0, 500).indexOf(student) + 1) % 100 === 0) {
      console.log(`  ✓ Processed ${students.slice(0, 500).indexOf(student) + 1} students...`);
    }
  }
  console.log(`  ✓ Total registrations: ${registrationCount}`);
  console.log(`  ✓ Total submissions: ${submissionCount}`);

  // Step 10: Create Results
  console.log('\n📊 Creating Results...');
  const registrations = await prisma.courseRegistration.findMany({
    include: { course: true, student: true }
  });

  let resultCount = 0;
  for (const reg of registrations.slice(0, 1000)) {
    const score = Math.floor(Math.random() * 100);
    const { grade, gradePoint } = calculateGrade(score);

    await prisma.result.create({
      data: {
        studentId: reg.studentId,
        courseId: reg.courseId,
        sessionId: sessions[sessions.length - 1].id,
        semester: reg.semester,
        score,
        grade: grade as any,
        gradePoint,
      },
    });
    resultCount++;

    if (resultCount % 200 === 0) {
      console.log(`  ✓ Created ${resultCount} results...`);
    }
  }
  console.log(`  ✓ Total results created: ${resultCount}`);

  // Step 11: Create Notifications
  console.log('\n🔔 Creating Notifications...');
  const notificationTypes = [
    { type: 'PAYMENT', title: 'Payment Reminder', message: 'Your school fee payment is due soon.' },
    { type: 'REGISTRATION', title: 'Registration Open', message: 'Course registration is now open.' },
    { type: 'RESULT', title: 'Results Published', message: 'Your results have been published.' },
    { type: 'ASSIGNMENT', title: 'New Assignment', message: 'A new assignment has been uploaded.' },
    { type: 'GENERAL', title: 'System Update', message: 'The student portal has been updated.' },
  ];

  let notificationCount = 0;
  for (const student of students.slice(0, 300)) {
    // Each student gets 5-10 notifications
    const numNotifications = Math.floor(Math.random() * 6) + 5;
    for (let i = 0; i < numNotifications; i++) {
      const notif = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      await prisma.notification.create({
        data: {
          studentId: student.id,
          type: notif.type as any,
          title: notif.title,
          message: notif.message,
          isRead: Math.random() > 0.5,
        },
      });
      notificationCount++;
    }
  }
  console.log(`  ✓ Total notifications created: ${notificationCount}`);

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📈 Summary:');
  console.log(`  Programs: ${programs.length}`);
  console.log(`  Sessions: ${sessions.length}`);
  console.log(`  Semesters: ${semesters.length}`);
  console.log(`  Courses: ${createdCourses.length}`);
  console.log(`  Students: ${students.length}`);
  console.log(`  Invoices: ${invoiceCount}`);
  console.log(`  Payments: ${paymentCount}`);
  console.log(`  Assignments: ${assignments.length}`);
  console.log(`  Registrations: ${registrationCount}`);
  console.log(`  Submissions: ${submissionCount}`);
  console.log(`  Results: ${resultCount}`);
  console.log(`  Notifications: ${notificationCount}`);
  console.log('\n🔑 Test Credentials:');
  console.log(`  Email: Any student email (e.g., ${students[0].email})`);
  console.log(`  Password: password123`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
