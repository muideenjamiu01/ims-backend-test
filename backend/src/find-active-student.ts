import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findActiveStudent() {
  try {
    console.log('Finding active students with paid payments...');
    
    const activeStudentWithPayment = await prisma.student.findFirst({
      where: {
        status: 'ACTIVE',
        payments: {
          some: {
            status: 'PAID'
          }
        }
      },
      include: {
        payments: {
          where: { status: 'PAID' },
          take: 1
        }
      }
    });
    
    if (activeStudentWithPayment) {
      console.log('Found active student with paid payment:');
      console.log('Student ID:', activeStudentWithPayment.id);
      console.log('Name:', activeStudentWithPayment.firstName, activeStudentWithPayment.lastName);
      console.log('Email:', activeStudentWithPayment.email);
      console.log('MatricNo:', activeStudentWithPayment.matricNo);
      console.log('Status:', activeStudentWithPayment.status);
      console.log('Payment ID:', activeStudentWithPayment.payments[0]?.id);
    } else {
      console.log('No active student with paid payments found. Checking all active students...');
      
      const activeStudents = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        take: 5
      });
      
      console.log(`Found ${activeStudents.length} active students`);
      if (activeStudents.length > 0) {
        console.log('First active student:', activeStudents[0]);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findActiveStudent();