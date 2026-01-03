import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createDefaultSessions() {
  try {
    // Check if any sessions exist
    const existingSessions = await prisma.session.findMany();
    
    if (existingSessions.length > 0) {
      console.log('✓ Sessions already exist:', existingSessions.length);
      return;
    }

    // Create default sessions for current and next academic years
    const currentYear = new Date().getFullYear();
    
    const sessions = [
      {
        name: `${currentYear}/${currentYear + 1}`,
        startDate: new Date(`${currentYear}-09-01`),
        endDate: new Date(`${currentYear + 1}-08-31`),
        isActive: true,
      },
      {
        name: `${currentYear + 1}/${currentYear + 2}`,
        startDate: new Date(`${currentYear + 1}-09-01`),
        endDate: new Date(`${currentYear + 2}-08-31`),
        isActive: false,
      },
      {
        name: `${currentYear - 1}/${currentYear}`,
        startDate: new Date(`${currentYear - 1}-09-01`),
        endDate: new Date(`${currentYear}-08-31`),
        isActive: false,
      },
    ];

    for (const sessionData of sessions) {
      const session = await prisma.session.create({
        data: sessionData,
      });
      console.log(`✓ Created session: ${session.name}`);
    }

    console.log(`\n✓ Successfully created ${sessions.length} academic sessions`);
  } catch (error) {
    console.error('Error creating sessions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultSessions()
  .then(() => {
    console.log('\n✓ Session initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Session initialization failed:', error);
    process.exit(1);
  });
