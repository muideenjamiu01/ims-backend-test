import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPaymentTypes() {
  console.log('Seeding payment types...');

  const paymentTypes = [
    {
      name: 'School Fee',
      code: 'SCHOOL_FEE',
      description: 'Tuition and academic fees',
      isActive: true,
    },
    {
      name: 'Departmental Fee',
      code: 'DEPARTMENTAL_FEE',
      description: 'Department-specific charges',
      isActive: true,
    },
    {
      name: 'Technology Fee',
      code: 'TECHNOLOGY_FEE',
      description: 'ICT and technology infrastructure fees',
      isActive: true,
    },
    {
      name: 'Examination Fee',
      code: 'EXAMINATION_FEE',
      description: 'Examination and assessment charges',
      isActive: true,
    },
    {
      name: 'Development Fee',
      code: 'DEVELOPMENT_FEE',
      description: 'Infrastructure development levies',
      isActive: true,
    },
    {
      name: 'Accreditation Fee',
      code: 'ACCREDITATION_FEE',
      description: 'Professional accreditation charges',
      isActive: true,
    },
    {
      name: 'Acceptance Fee',
      code: 'ACCEPTANCE_FEE',
      description: 'One-time acceptance fee for new students',
      isActive: true,
    },
    {
      name: 'Library Fee',
      code: 'LIBRARY_FEE',
      description: 'Library services and resources',
      isActive: true,
    },
    {
      name: 'Medical Fee',
      code: 'MEDICAL_FEE',
      description: 'Health services and insurance',
      isActive: true,
    },
    {
      name: 'Sports Fee',
      code: 'SPORTS_FEE',
      description: 'Sports and recreational activities',
      isActive: true,
    },
  ];

  for (const type of paymentTypes) {
    await prisma.paymentType.upsert({
      where: { code: type.code },
      update: {},
      create: type,
    });
    console.log(`✓ Created payment type: ${type.name}`);
  }

  console.log('Payment types seeded successfully!');
}

seedPaymentTypes()
  .catch((e) => {
    console.error('Error seeding payment types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
