# Production Database Seeding Guide

This guide explains how to seed your production database with all necessary data.

## Overview

The main seed file `prisma/seed.ts` now handles **ALL** seeding operations in a single command. It creates:

- ✅ **2 Admin Users** (admin@ims.edu, staff@ims.edu)
- ✅ **10 Departments** (Computer Science, Engineering, Business, etc.)
- ✅ **3 Academic Sessions** (Previous, Current, Upcoming) with 6 semesters
- ✅ **32 Programs** distributed across departments
- ✅ **300 Applicants** with admission decisions
- ✅ **1,500 Students** with Nigerian names, distributed across:
  - All 10 departments
  - 5 levels (100, 200, 300, 400, 500)
  - Realistic distribution: More students in lower levels
- ✅ **100 Courses** across departments and levels
- ✅ **Course Registrations** for all students
- ✅ **50 Exams** with student scores and grades

## Additional Seed Files (Optional - For Specific Data)

### 1. Payment Types (`prisma/seedPaymentTypes.ts`)
Creates 10 payment type categories (School Fee, Departmental Fee, etc.)

```bash
npx ts-node prisma/seedPaymentTypes.ts
```

### 2. Comprehensive Courses (`prisma/seedComprehensiveCourses.ts`)
Creates 338 detailed courses for all departments (replaces the 100 generic courses from main seed)

```bash
npx ts-node prisma/seedComprehensiveCourses.ts
```

## Production Deployment Commands

### Step 1: Apply Database Migrations
```bash
cd ims-backend
npx prisma migrate deploy
```

### Step 2: Generate Prisma Client
```bash
npx prisma generate
```

### Step 3: Seed All Data (ONE COMMAND)
```bash
npx ts-node prisma/seed.ts
```

This single command will create:
- Users, departments, sessions, programs
- **1,500 students** with realistic Nigerian data
- Courses, exams, registrations, and scores

### Step 4: (Optional) Add Payment Types
```bash
npx ts-node prisma/seedPaymentTypes.ts
```

### Step 5: (Optional) Replace with Comprehensive Courses
⚠️ **Warning**: This will delete the 100 generic courses and create 338 detailed ones.

```bash
npx ts-node prisma/seedComprehensiveCourses.ts
```

## Student Data Details

### Distribution by Level (1,500 students total)
- **Level 100**: ~450 students (30%)
- **Level 200**: ~400 students (27%)
- **Level 300**: ~350 students (23%)
- **Level 400**: ~200 students (13%)
- **Level 500**: ~100 students (7%)

### Distribution by Department
Students are evenly distributed across all 10 departments (~150 per department)

### Student Data Features
- ✅ Nigerian first and last names (80+ unique names each)
- ✅ Realistic email addresses (8 different domains)
- ✅ Nigerian phone numbers with proper prefixes
- ✅ Addresses from 10 major Nigerian cities
- ✅ Unique matric numbers (IMS/YEAR/DEPT/00000 format)
- ✅ Birth dates (ages 18-25)
- ✅ Enrollment dates within academic sessions
- ✅ Default password: `password123` (hashed with bcrypt)
- ✅ All assigned to active session
- ✅ All have acceptance fee paid
- ✅ Linked to programs and departments

## Verification

After seeding, verify your data:

```bash
# Count students
npx prisma studio
# Or use SQL
SELECT COUNT(*) FROM "Student";
SELECT "departmentId", COUNT(*) FROM "Student" GROUP BY "departmentId";
SELECT "currentLevel", COUNT(*) FROM "Student" GROUP BY "currentLevel";
```

## Expected Results

```
📊 Final Statistics:
   Users: 2
   Departments: 10
   Sessions: 3
   Semesters: 6
   Programs: 32
   Applicants: 300
   Students: 1,500
   Courses: 100 (or 338 if using comprehensive seed)
   Course Registrations: ~7,500
   Exams: 50
   Scores: ~25,000

   Total Records: ~35,000+
```

## Important Notes

1. **Idempotency**: The main seed file uses `upsert` for users and departments, so it's safe to run multiple times
2. **Existing Data**: The seed script preserves real applicant registrations (only deletes test data)
3. **Passwords**: All users and students have password `password123` (hashed)
4. **Active Session**: Students are linked to the currently active academic session
5. **Matric Numbers**: Format is `IMS/YEAR/DEPT/00000` (e.g., `IMS/2024/CSC/00001`)

## Troubleshooting

### "Unique constraint failed" Error
This usually means data already exists. The main seed handles this for users and departments, but if you see it for students, it means students already exist. You may need to clear the Student table first.

### "No active session found"
Make sure sessions are created before students. The main seed file handles this automatically in the correct order.

### TypeScript Compilation Errors
If using `ts-node` fails in production, compile first:
```bash
npx tsc prisma/seed.ts --outDir prisma
node prisma/seed.js
```

## Deprecated Files

The following files are now **DEPRECATED** and should not be used:

- ❌ `prisma/seed1000Students.ts` - Functionality merged into main seed.ts
- ❌ `prisma/seedStudentPortal.ts` - Replaced by comprehensive seed.ts

Use **only** `prisma/seed.ts` as your single source of truth for seeding.
