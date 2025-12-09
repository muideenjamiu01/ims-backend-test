const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPayment() {
  try {
    const reference = 'pay_1764530196750_2fc5ea609709dd6a';
    
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        invoice: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            matricNo: true,
          },
        },
      },
    });

    if (payment) {
      console.log('Payment found:');
      console.log('- ID:', payment.id);
      console.log('- Status:', payment.status);
      console.log('- Method:', payment.method);
      console.log('- Amount:', payment.amount);
      console.log('- Student:', payment.student?.firstName, payment.student?.lastName);
      console.log('- Created:', payment.createdAt);
      console.log('- Paid At:', payment.paidAt);
      console.log('- Gateway Response:', payment.gatewayResponse ? 'Present' : 'None');
    } else {
      console.log('Payment not found with reference:', reference);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPayment();