"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const TOTAL_APPLICANTS = 300;
const TOTAL_STUDENTS = 500;
const TOTAL_COURSES = 100;
const TOTAL_EXAMS = 50;
const firstNames = [
    'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Daniel', 'Emma',
    'James', 'Olivia', 'Robert', 'Sophia', 'William', 'Isabella', 'Thomas',
    'Mia', 'Charles', 'Charlotte', 'Joseph', 'Amelia', 'Christopher', 'Harper',
    'Matthew', 'Evelyn', 'Anthony', 'Abigail', 'Mark', 'Elizabeth', 'Donald',
    'Sofia', 'Steven', 'Avery', 'Paul', 'Ella', 'Andrew', 'Scarlett', 'Joshua',
    'Grace', 'Kenneth', 'Chloe', 'Kevin', 'Victoria', 'Brian', 'Madison',
    'George', 'Luna', 'Edward', 'Penelope', 'Ronald', 'Layla'
];
const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
    'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
    'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
    'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts'
];
const departments = [
    { name: 'Computer Science', code: 'CSC', description: 'Department of Computer Science' },
    { name: 'Electrical Engineering', code: 'EEE', description: 'Department of Electrical Engineering' },
    { name: 'Mechanical Engineering', code: 'MEE', description: 'Department of Mechanical Engineering' },
    { name: 'Civil Engineering', code: 'CVE', description: 'Department of Civil Engineering' },
    { name: 'Business Administration', code: 'BUS', description: 'Department of Business Administration' },
    { name: 'Economics', code: 'ECO', description: 'Department of Economics' },
    { name: 'Mathematics', code: 'MAT', description: 'Department of Mathematics' },
    { name: 'Physics', code: 'PHY', description: 'Department of Physics' },
    { name: 'Chemistry', code: 'CHE', description: 'Department of Chemistry' },
    { name: 'Biology', code: 'BIO', description: 'Department of Biology' },
];
const courseTemplates = [
    { prefix: 'Introduction to', credits: 3, level: 100 },
    { prefix: 'Advanced', credits: 4, level: 300 },
    { prefix: 'Fundamentals of', credits: 3, level: 100 },
    { prefix: 'Applied', credits: 4, level: 200 },
    { prefix: 'Theory of', credits: 3, level: 300 },
    { prefix: 'Practical', credits: 2, level: 200 },
];
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}
function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
async function seedUsers() {
    console.log('Seeding users...');
    const hashedPassword = await bcryptjs_1.default.hash('password123', 10);
    await prisma.user.createMany({
        data: [
            {
                email: 'admin@ims.edu',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN',
            },
            {
                email: 'staff@ims.edu',
                password: hashedPassword,
                firstName: 'Staff',
                lastName: 'Member',
                role: 'STAFF',
            },
        ],
    });
    console.log('✓ Users seeded');
}
async function seedDepartments() {
    console.log('Seeding departments...');
    await prisma.department.createMany({
        data: departments,
    });
    console.log('✓ Departments seeded');
}
async function seedApplicants() {
    console.log(`Seeding ${TOTAL_APPLICANTS} applicants...`);
    const applicants = [];
    for (let i = 0; i < TOTAL_APPLICANTS; i++) {
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@applicant.com`;
        applicants.push({
            firstName,
            lastName,
            email,
            phone: `+234${Math.floor(Math.random() * 9000000000) + 1000000000}`,
            dateOfBirth: getRandomDate(new Date(1995, 0, 1), new Date(2005, 11, 31)),
            gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
            address: `${Math.floor(Math.random() * 999) + 1} ${getRandomElement(lastNames)} Street`,
            previousSchool: `${getRandomElement(lastNames)} High School`,
            gradeAverage: Math.floor(Math.random() * 30) + 70,
        });
    }
    for (const applicant of applicants) {
        const created = await prisma.applicant.create({
            data: {
                ...applicant,
                gender: applicant.gender,
                admissionDecision: {
                    create: {
                        status: getRandomElement(['PENDING', 'APPROVED', 'REJECTED', 'PENDING', 'APPROVED']),
                    },
                },
            },
        });
        // Generate matric number for approved applicants
        const decision = await prisma.admissionDecision.findUnique({
            where: { applicantId: created.id },
        });
        if (decision?.status === 'APPROVED') {
            const year = new Date().getFullYear();
            const matricNo = `IMS/${year}/${String(created.id).padStart(5, '0')}`;
            await prisma.matricNumber.create({
                data: {
                    applicantId: created.id,
                    matricNo,
                },
            });
        }
    }
    console.log('✓ Applicants seeded');
}
async function seedStudents() {
    console.log(`Seeding ${TOTAL_STUDENTS} students...`);
    const depts = await prisma.department.findMany();
    const students = [];
    for (let i = 0; i < TOTAL_STUDENTS; i++) {
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const year = Math.floor(Math.random() * 5) + 2019;
        const matricNo = `IMS/${year}/${String(i + 1000).padStart(5, '0')}`;
        students.push({
            matricNo,
            firstName,
            lastName,
            email: `${matricNo.replace(/\//g, '.')}@student.ims.edu`,
            phone: `+234${Math.floor(Math.random() * 9000000000) + 1000000000}`,
            dateOfBirth: getRandomDate(new Date(1995, 0, 1), new Date(2005, 11, 31)),
            gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
            address: `${Math.floor(Math.random() * 999) + 1} ${getRandomElement(lastNames)} Avenue`,
            departmentId: getRandomElement(depts).id,
            currentLevel: getRandomElement([100, 200, 300, 400]),
            status: getRandomElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'GRADUATED', 'SUSPENDED']),
        });
    }
    await prisma.student.createMany({
        data: students,
    });
    console.log('✓ Students seeded');
}
async function seedCourses() {
    console.log(`Seeding ${TOTAL_COURSES} courses...`);
    const depts = await prisma.department.findMany();
    const courses = [];
    let courseCounter = 1;
    for (const dept of depts) {
        for (let i = 0; i < 10; i++) {
            const template = getRandomElement(courseTemplates);
            const code = `${dept.code}${template.level + i * 10}`;
            const title = `${template.prefix} ${dept.name}`;
            courses.push({
                code,
                title: `${title} ${i + 1}`,
                description: `This course covers ${title.toLowerCase()} with practical applications`,
                credits: template.credits,
                departmentId: dept.id,
                level: template.level,
                semester: Math.random() > 0.5 ? 1 : 2,
            });
            courseCounter++;
            if (courseCounter > TOTAL_COURSES)
                break;
        }
        if (courseCounter > TOTAL_COURSES)
            break;
    }
    await prisma.course.createMany({
        data: courses,
    });
    console.log('✓ Courses seeded');
}
async function seedCourseRegistrations() {
    console.log('Seeding course registrations...');
    const students = await prisma.student.findMany();
    const courses = await prisma.course.findMany();
    const registrations = [];
    for (const student of students) {
        // Each student registers for 5-8 courses
        const numCourses = Math.floor(Math.random() * 4) + 5;
        const studentCourses = courses
            .filter((c) => c.level === student.currentLevel || c.level === student.currentLevel - 100)
            .sort(() => Math.random() - 0.5)
            .slice(0, numCourses);
        for (const course of studentCourses) {
            registrations.push({
                studentId: student.id,
                courseId: course.id,
                academicYear: '2023/2024',
                semester: course.semester,
            });
        }
    }
    // Insert in batches to avoid overwhelming the database
    const batchSize = 500;
    for (let i = 0; i < registrations.length; i += batchSize) {
        await prisma.courseRegistration.createMany({
            data: registrations.slice(i, i + batchSize),
            skipDuplicates: true,
        });
    }
    console.log('✓ Course registrations seeded');
}
async function seedExamsAndScores() {
    console.log(`Seeding ${TOTAL_EXAMS} exams and scores...`);
    const courses = await prisma.course.findMany({ take: TOTAL_EXAMS });
    for (const course of courses) {
        const exam = await prisma.exam.create({
            data: {
                courseId: course.id,
                title: `${course.code} Final Exam`,
                description: `Final examination for ${course.title}`,
                examDate: getRandomDate(new Date(2023, 8, 1), new Date(2024, 5, 30)),
                maxScore: 100,
                academicYear: '2023/2024',
                semester: course.semester,
            },
        });
        // Get students registered for this course
        const registrations = await prisma.courseRegistration.findMany({
            where: { courseId: course.id },
            include: { student: true },
        });
        const scores = [];
        for (const reg of registrations) {
            const rawScore = Math.floor(Math.random() * 60) + 40; // 40-100
            let grade;
            if (rawScore >= 70)
                grade = 'A';
            else if (rawScore >= 60)
                grade = 'B';
            else if (rawScore >= 50)
                grade = 'C';
            else if (rawScore >= 45)
                grade = 'D';
            else if (rawScore >= 40)
                grade = 'E';
            else
                grade = 'F';
            scores.push({
                examId: exam.id,
                studentId: reg.studentId,
                score: rawScore,
                grade,
            });
        }
        if (scores.length > 0) {
            await prisma.score.createMany({
                data: scores,
                skipDuplicates: true,
            });
        }
    }
    console.log('✓ Exams and scores seeded');
}
async function main() {
    console.log('🌱 Starting database seed...\n');
    try {
        // Clear existing data
        console.log('Clearing existing data...');
        await prisma.score.deleteMany();
        await prisma.exam.deleteMany();
        await prisma.courseRegistration.deleteMany();
        await prisma.course.deleteMany();
        await prisma.student.deleteMany();
        await prisma.matricNumber.deleteMany();
        await prisma.admissionDecision.deleteMany();
        await prisma.applicant.deleteMany();
        await prisma.department.deleteMany();
        await prisma.user.deleteMany();
        console.log('✓ Existing data cleared\n');
        // Seed in order
        await seedUsers();
        await seedDepartments();
        await seedApplicants();
        await seedStudents();
        await seedCourses();
        await seedCourseRegistrations();
        await seedExamsAndScores();
        // Statistics
        const stats = {
            users: await prisma.user.count(),
            departments: await prisma.department.count(),
            applicants: await prisma.applicant.count(),
            students: await prisma.student.count(),
            courses: await prisma.course.count(),
            courseRegistrations: await prisma.courseRegistration.count(),
            exams: await prisma.exam.count(),
            scores: await prisma.score.count(),
        };
        console.log('\n✅ Database seeded successfully!\n');
        console.log('📊 Statistics:');
        console.log(`   Users: ${stats.users}`);
        console.log(`   Departments: ${stats.departments}`);
        console.log(`   Applicants: ${stats.applicants}`);
        console.log(`   Students: ${stats.students}`);
        console.log(`   Courses: ${stats.courses}`);
        console.log(`   Course Registrations: ${stats.courseRegistrations}`);
        console.log(`   Exams: ${stats.exams}`);
        console.log(`   Scores: ${stats.scores}`);
        console.log(`\n   Total Records: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);
    }
    catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map