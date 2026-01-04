import { PrismaClient, Gender, StudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Nigerian first names
const firstNames = [
  'Adewale', 'Oluwaseun', 'Chinedu', 'Ngozi', 'Yusuf', 'Fatima', 'Emeka', 'Aisha',
  'Tunde', 'Chioma', 'Ibrahim', 'Zainab', 'Babatunde', 'Blessing', 'Musa', 'Grace',
  'Kehinde', 'Amina', 'Adeola', 'Halima', 'Chukwudi', 'Hadiza', 'Olusegun', 'Khadija',
  'Adebayo', 'Hauwa', 'Ikechukwu', 'Maryam', 'Segun', 'Salamatu', 'Chidera', 'Hassana',
  'Adekunle', 'Rahma', 'Obinna', 'Safiya', 'Kunle', 'Rashida', 'Nnamdi', 'Rukayya',
  'Femi', 'Asmau', 'Chima', 'Habiba', 'Tayo', 'Sa\'ada', 'Uzoma', 'Jamila',
  'Bola', 'Nana', 'Uche', 'Hajara', 'Wale', 'Bilkisu', 'Ebuka', 'Rabia',
  'Deji', 'Zahra', 'Ifeanyi', 'Sadiya', 'Lanre', 'Sumaiya', 'Chibuzor', 'Amira',
  'Biodun', 'Nafisa', 'Chukwuma', 'Hanifa', 'Tosin', 'Lubaba', 'Chinedum', 'Asiya',
  'Niyi', 'Ruqayya', 'Obinna', 'Ummu', 'Damilare', 'Kaltum', 'Chukwuemeka', 'Aisha',
  'Kayode', 'Zulaikha', 'Chinonso', 'Hafsah', 'Sola', 'Mariya', 'Ekene', 'Basira'
];

// Nigerian last names
const lastNames = [
  'Adeyemi', 'Okonkwo', 'Bello', 'Abdullahi', 'Okafor', 'Musa', 'Nwankwo', 'Aliyu',
  'Eze', 'Usman', 'Okoro', 'Ahmed', 'Ogunleye', 'Mohammed', 'Chikezie', 'Yusuf',
  'Ojo', 'Suleiman', 'Nwosu', 'Ibrahim', 'Adeleke', 'Garba', 'Ugwu', 'Abubakar',
  'Adebayo', 'Shehu', 'Chukwu', 'Idris', 'Akinyemi', 'Ismail', 'Obi', 'Mustapha',
  'Fashola', 'Kabir', 'Emeka', 'Lawal', 'Olaniyan', 'Hassan', 'Chukwuma', 'Sanusi',
  'Adegoke', 'Jibril', 'Okeke', 'Nuhu', 'Oladipo', 'Zakari', 'Udoh', 'Hamza',
  'Akinola', 'Nasir', 'Chidi', 'Abubakar', 'Adekunle', 'Sani', 'Nnamdi', 'Umar',
  'Babajide', 'Adamu', 'Ikenna', 'Isa', 'Oluwole', 'Suleiman', 'Chinedu', 'Haruna',
  'Afolabi', 'Tanko', 'Obinna', 'Yahaya', 'Olayinka', 'Muhammed', 'Chigozie', 'Sadiq',
  'Ogundele', 'Aminu', 'Uchenna', 'Bashir', 'Adeshina', 'Rabiu', 'Ebuka', 'Farouk',
  'Ogunleye', 'Danjuma', 'Chukwuemeka', 'Balarabe', 'Adeyinka', 'Lukman', 'Ifeanyi', 'Kabiru'
];

// Email domains
const emailDomains = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com',
  'icloud.com', 'aol.com', 'mail.com'
];

function generateMatricNo(year: number, deptCode: string, index: number): string {
  return `IMS/${year}/${deptCode}/${String(index).padStart(5, '0')}`;
}

function generateEmail(firstName: string, lastName: string): string {
  const domain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
  const rand = Math.floor(Math.random() * 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand}@${domain}`;
}

function generatePhone(): string {
  const prefixes = ['0803', '0806', '0810', '0813', '0816', '0703', '0706', '0803', '0805', '0807', '0811', '0814', '0815', '0905', '0906'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const rest = Math.floor(Math.random() * 10000000);
  return `${prefix}${String(rest).padStart(7, '0')}`;
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function main() {
  console.log('Starting to seed 1000 students...\n');

  // Fetch all departments
  const departments = await prisma.department.findMany();
  
  if (departments.length === 0) {
    console.error('No departments found. Please seed departments first.');
    return;
  }

  console.log(`Found ${departments.length} departments`);

  // Fetch all programs
  const programs = await prisma.program.findMany();
  
  if (programs.length === 0) {
    console.error('No programs found. Please seed programs first.');
    return;
  }

  console.log(`Found ${programs.length} programs`);

  // Fetch active session
  const activeSession = await prisma.session.findFirst({
    where: { isActive: true }
  });

  if (!activeSession) {
    console.error('No active session found. Please create a session first.');
    return;
  }

  console.log(`Active session: ${activeSession.name}\n`);

  // Define levels and their distribution
  const levels = [100, 200, 300, 400, 500];
  const levelDistribution = [300, 250, 200, 150, 100]; // Total: 1000

  // Calculate students per department per level
  const studentsPerDept = Math.floor(1000 / departments.length);
  
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  let totalCreated = 0;
  let counter = 1;

  // Create students distributed across departments and levels
  for (const department of departments) {
    const deptCode = department.code.toUpperCase();
    let deptStudents = 0;

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      const studentsForLevel = Math.floor((levelDistribution[levelIndex] / 1000) * studentsPerDept);

      console.log(`Creating ${studentsForLevel} students for ${department.name} - Level ${level}`);

      for (let i = 0; i < studentsForLevel; i++) {
        const firstName = getRandomItem(firstNames);
        const lastName = getRandomItem(lastNames);
        const gender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
        const email = generateEmail(firstName, lastName);
        const phone = generatePhone();
        
        // Generate unique matric number
        const currentYear = 2024 + Math.floor(Math.random() * 3); // 2024-2026
        const matricNo = generateMatricNo(currentYear, deptCode, counter++);
        
        // Random enrollment date within the session
        const enrollmentDate = getRandomDate(
          new Date(2023, 8, 1), // Sept 1, 2023
          new Date(2025, 11, 31) // Dec 31, 2025
        );

        // Random date of birth (18-25 years old)
        const dateOfBirth = getRandomDate(
          new Date(1998, 0, 1),
          new Date(2006, 11, 31)
        );

        // Random address
        const address = `${Math.floor(Math.random() * 100) + 1} ${getRandomItem(lastNames)} Street, ${getRandomItem(['Lagos', 'Abuja', 'Kano', 'Port Harcourt', 'Ibadan', 'Enugu', 'Jos', 'Kaduna', 'Maiduguri', 'Benin City'])}`;

        try {
          await prisma.student.create({
            data: {
              matricNo,
              firstName,
              lastName,
              email,
              phone,
              gender,
              dateOfBirth,
              address,
              departmentId: department.id,
              programId: programs[Math.floor(Math.random() * programs.length)].id,
              currentLevel: level,
              enrollmentDate,
              status: StudentStatus.ACTIVE,
              acceptanceFeePaid: true,
              currentSessionId: activeSession.id,
              password: hashedPassword,
              username: matricNo,
              walletBalance: 0,
              cgpa: 0,
            },
          });

          deptStudents++;
          totalCreated++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`Duplicate entry, skipping...`);
            counter++;
            continue;
          }
          throw error;
        }
      }
    }

    console.log(`✓ Created ${deptStudents} students for ${department.name}\n`);
  }

  // Fill remaining students to reach exactly 1000
  let remaining = 1000 - totalCreated;
  if (remaining > 0) {
    console.log(`\nCreating ${remaining} additional students to reach 1000...`);
    
    for (let i = 0; i < remaining; i++) {
      const department = getRandomItem(departments);
      const level = getRandomItem(levels);
      const firstName = getRandomItem(firstNames);
      const lastName = getRandomItem(lastNames);
      const gender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
      const email = generateEmail(firstName, lastName);
      const phone = generatePhone();
      
      const currentYear = 2024 + Math.floor(Math.random() * 3);
      const matricNo = generateMatricNo(currentYear, department.code.toUpperCase(), counter++);
      
      const enrollmentDate = getRandomDate(
        new Date(2023, 8, 1),
        new Date(2025, 11, 31)
      );

      const dateOfBirth = getRandomDate(
        new Date(1998, 0, 1),
        new Date(2006, 11, 31)
      );

      const address = `${Math.floor(Math.random() * 100) + 1} ${getRandomItem(lastNames)} Street, ${getRandomItem(['Lagos', 'Abuja', 'Kano', 'Port Harcourt', 'Ibadan', 'Enugu', 'Jos', 'Kaduna', 'Maiduguri', 'Benin City'])}`;

      try {
        await prisma.student.create({
          data: {
            matricNo,
            firstName,
            lastName,
            email,
            phone,
            gender,
            dateOfBirth,
            address,
            departmentId: department.id,
            programId: programs[Math.floor(Math.random() * programs.length)].id,
            currentLevel: level,
            enrollmentDate,
            status: StudentStatus.ACTIVE,
            acceptanceFeePaid: true,
            currentSessionId: activeSession.id,
            password: hashedPassword,
            username: matricNo,
            walletBalance: 0,
            cgpa: 0,
          },
        });

        totalCreated++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          remaining++;
          counter++;
          continue;
        }
        throw error;
      }
    }
  }

  console.log(`\n✅ Successfully created ${totalCreated} students!`);
  
  // Show distribution summary
  console.log('\n=== DISTRIBUTION SUMMARY ===');
  for (const department of departments) {
    const count = await prisma.student.count({
      where: { departmentId: department.id }
    });
    console.log(`${department.name}: ${count} students`);
  }

  console.log('\n=== LEVEL DISTRIBUTION ===');
  for (const level of levels) {
    const count = await prisma.student.count({
      where: { currentLevel: level }
    });
    console.log(`Level ${level}: ${count} students`);
  }

  const totalStudents = await prisma.student.count();
  console.log(`\nTotal students in database: ${totalStudents}`);
}

main()
  .catch((e) => {
    console.error('Error seeding students:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
