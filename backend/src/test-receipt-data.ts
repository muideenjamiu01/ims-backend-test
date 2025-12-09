import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReceiptData() {
  try {
    console.log('Checking for students...');
    const students = await prisma.student.findMany({ take: 3 });
    console.log(`Found ${students.length} students`);
    
    if (students.length > 0) {
      console.log('Sample student:', students[0]);
    }

    console.log('Checking for payments...');
    const payments = await prisma.payment.findMany({ 
      take: 3,
      include: {
        student: true,
        invoice: true
      }
    });
    console.log(`Found ${payments.length} payments`);
    
    if (payments.length > 0) {
      console.log('Sample payment:', payments[0]);
    }

    console.log('Checking for PAID payments...');
    const paidPayments = await prisma.payment.findMany({ 
      where: { status: 'PAID' },
      take: 3,
      include: {
        student: true,
        invoice: true
      }
    });
    console.log(`Found ${paidPayments.length} PAID payments`);
    
    if (paidPayments.length > 0) {
      console.log('Sample PAID payment:', paidPayments[0]);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReceiptData();