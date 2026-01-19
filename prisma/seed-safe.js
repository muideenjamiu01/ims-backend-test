"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function safeSeed() {
    console.log('🌱 Starting safe database seed...\n');
    try {
        // Only seed if departments are missing
        const departmentCount = await prisma.department.count();
        if (departmentCount === 0) {
            console.log('Seeding departments...');
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
            await prisma.department.createMany({ data: departments });
            console.log('✓ Departments seeded');
        }
        // Only seed programs if they're missing
        const programCount = await prisma.program.count();
        if (programCount === 0) {
            console.log('Seeding programs...');
            const depts = await prisma.department.findMany();
            const programsByDepartment = {
                'Computer Science': [
                    { name: 'Computer Science', code: 'CSC', duration: 4, description: 'Bachelor of Science in Computer Science' },
                    { name: 'Software Engineering', code: 'SWE', duration: 4, description: 'Bachelor of Science in Software Engineering' },
                    { name: 'Information Technology', code: 'IT', duration: 4, description: 'Bachelor of Science in Information Technology' },
                    { name: 'Cybersecurity', code: 'CYB', duration: 4, description: 'Bachelor of Science in Cybersecurity' },
                ],
                'Electrical Engineering': [
                    { name: 'Electrical Engineering', code: 'EEE', duration: 5, description: 'Bachelor of Engineering in Electrical Engineering' },
                    { name: 'Electronics Engineering', code: 'ECE', duration: 4, description: 'Bachelor of Engineering in Electronics Engineering' },
                    { name: 'Telecommunications Engineering', code: 'TEE', duration: 4, description: 'Bachelor of Engineering in Telecommunications' },
                ],
                'Business Administration': [
                    { name: 'Business Administration', code: 'BUS', duration: 4, description: 'Bachelor of Business Administration' },
                    { name: 'Marketing', code: 'MKT', duration: 4, description: 'Bachelor of Science in Marketing' },
                    { name: 'Human Resource Management', code: 'HRM', duration: 4, description: 'Bachelor of Science in Human Resource Management' },
                    { name: 'Finance', code: 'FIN', duration: 4, description: 'Bachelor of Science in Finance' },
                ],
                // Add other departments as needed
            };
            for (const dept of depts) {
                const programs = programsByDepartment[dept.name];
                if (programs) {
                    for (const program of programs) {
                        await prisma.program.create({
                            data: {
                                ...program,
                                departmentId: dept.id,
                            },
                        });
                    }
                }
            }
            console.log('✓ Programs seeded');
        }
        // Only create admin user if none exists
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            console.log('Creating admin user...');
            await prisma.user.create({
                data: {
                    email: 'admin@ims.edu',
                    password: '$2a$10$8H1JJKGd8gF8jH8gF8jH8g',
                    firstName: 'System',
                    lastName: 'Admin',
                    role: 'ADMIN',
                },
            });
            console.log('✓ Admin user created');
        }
        console.log('\n✅ Safe seed completed successfully!');
        console.log('📊 Existing data preserved, only missing essentials added.');
    }
    catch (error) {
        console.error('❌ Error during safe seed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
safeSeed();
