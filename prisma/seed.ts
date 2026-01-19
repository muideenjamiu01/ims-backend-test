import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TOTAL_APPLICANTS = 300;
const TOTAL_STUDENTS = 1500; // Will create 1500 students distributed across departments and levels
const TOTAL_COURSES = 273; // Comprehensive courses for all departments (accurate count)
const TOTAL_EXAMS = 50;

// Nigerian first names for more realistic data
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
  'Niyi', 'Ruqayya', 'Damilare', 'Kaltum', 'Chukwuemeka', 'Zulaikha', 'Kayode', 'Hafsah',
  // Additional names for variety
  'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Daniel', 'Emma',
  'James', 'Olivia', 'Robert', 'Sophia', 'William', 'Isabella', 'Thomas', 'Mia'
];

// Nigerian last names for more realistic data
const lastNames = [
  'Adeyemi', 'Okonkwo', 'Bello', 'Abdullahi', 'Okafor', 'Musa', 'Nwankwo', 'Aliyu',
  'Eze', 'Usman', 'Okoro', 'Ahmed', 'Ogunleye', 'Mohammed', 'Chikezie', 'Yusuf',
  'Ojo', 'Suleiman', 'Nwosu', 'Ibrahim', 'Adeleke', 'Garba', 'Ugwu', 'Abubakar',
  'Adebayo', 'Shehu', 'Chukwu', 'Idris', 'Akinyemi', 'Ismail', 'Obi', 'Mustapha',
  'Fashola', 'Kabir', 'Emeka', 'Lawal', 'Olaniyan', 'Hassan', 'Chukwuma', 'Sanusi',
  'Adegoke', 'Jibril', 'Okeke', 'Nuhu', 'Oladipo', 'Zakari', 'Udoh', 'Hamza',
  'Akinola', 'Nasir', 'Chidi', 'Adekunle', 'Sani', 'Nnamdi', 'Umar', 'Babajide',
  'Adamu', 'Ikenna', 'Isa', 'Oluwole', 'Haruna', 'Afolabi', 'Tanko', 'Yahaya',
  'Olayinka', 'Muhammed', 'Chigozie', 'Sadiq', 'Ogundele', 'Aminu', 'Uchenna', 'Bashir',
  'Adeshina', 'Rabiu', 'Ogunleye', 'Danjuma', 'Adeyinka', 'Lukman', 'Ifeanyi', 'Kabiru',
  // Additional names for variety
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'
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

// Comprehensive course data for Nigerian universities - 338 courses total
const comprehensiveCoursesByDepartment: Record<string, Array<{code: string; title: string; credits: number; level: number; semester: number}>> = {
  'Computer Science': [
    // 100 Level
    { code: 'CSC101', title: 'Introduction to Computer Science', credits: 3, level: 100, semester: 1 },
    { code: 'CSC102', title: 'Introduction to Problem Solving', credits: 2, level: 100, semester: 1 },
    { code: 'CSC103', title: 'Computer Programming I', credits: 3, level: 100, semester: 2 },
    { code: 'CSC104', title: 'Discrete Mathematics', credits: 3, level: 100, semester: 2 },
    { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    { code: 'PHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
    // 200 Level
    { code: 'CSC201', title: 'Computer Programming II', credits: 3, level: 200, semester: 1 },
    { code: 'CSC202', title: 'Data Structures', credits: 3, level: 200, semester: 1 },
    { code: 'CSC203', title: 'Digital Logic Design', credits: 3, level: 200, semester: 2 },
    { code: 'CSC204', title: 'Computer Architecture', credits: 3, level: 200, semester: 2 },
    { code: 'CSC205', title: 'Object Oriented Programming', credits: 3, level: 200, semester: 1 },
    { code: 'CSC206', title: 'Algorithm Analysis', credits: 3, level: 200, semester: 2 },
    { code: 'MTH201', title: 'Mathematical Methods I', credits: 3, level: 200, semester: 1 },
    { code: 'MTH202', title: 'Elementary Differential Equations', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'CSC301', title: 'Operating Systems', credits: 3, level: 300, semester: 1 },
    { code: 'CSC302', title: 'Database Management Systems', credits: 3, level: 300, semester: 1 },
    { code: 'CSC303', title: 'Software Engineering', credits: 3, level: 300, semester: 2 },
    { code: 'CSC304', title: 'Computer Networks', credits: 3, level: 300, semester: 2 },
    { code: 'CSC305', title: 'Web Technologies', credits: 3, level: 300, semester: 1 },
    { code: 'CSC306', title: 'Artificial Intelligence', credits: 3, level: 300, semester: 2 },
    { code: 'CSC307', title: 'Theory of Computation', credits: 3, level: 300, semester: 1 },
    { code: 'CSC308', title: 'Numerical Analysis', credits: 3, level: 300, semester: 2 },
    // 400 Level
    { code: 'CSC401', title: 'Compiler Construction', credits: 3, level: 400, semester: 1 },
    { code: 'CSC402', title: 'Computer Graphics', credits: 3, level: 400, semester: 1 },
    { code: 'CSC403', title: 'Distributed Systems', credits: 3, level: 400, semester: 2 },
    { code: 'CSC404', title: 'Information Security', credits: 3, level: 400, semester: 2 },
    { code: 'CSC405', title: 'Mobile Application Development', credits: 3, level: 400, semester: 1 },
    { code: 'CSC406', title: 'Cloud Computing', credits: 3, level: 400, semester: 2 },
    { code: 'CSC499', title: 'Final Year Project', credits: 6, level: 400, semester: 2 },
  ],
  'Electrical Engineering': [
    // 100 Level
    { code: 'EEE101', title: 'Introduction to Electrical Engineering', credits: 3, level: 100, semester: 1 },
    { code: 'EEE102', title: 'Engineering Drawing', credits: 2, level: 100, semester: 1 },
    { code: 'EEE103', title: 'Workshop Practice', credits: 2, level: 100, semester: 2 },
    { code: 'EMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'EMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'EPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    { code: 'EPHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
    { code: 'ECHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'EEE201', title: 'Electric Circuit Theory I', credits: 3, level: 200, semester: 1 },
    { code: 'EEE202', title: 'Electric Circuit Theory II', credits: 3, level: 200, semester: 2 },
    { code: 'EEE203', title: 'Electromagnetic Fields', credits: 3, level: 200, semester: 1 },
    { code: 'EEE204', title: 'Electronics I', credits: 3, level: 200, semester: 2 },
    { code: 'EEE205', title: 'Engineering Mathematics III', credits: 3, level: 200, semester: 1 },
    { code: 'EEE206', title: 'Digital Electronics', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'EEE301', title: 'Electrical Machines I', credits: 3, level: 300, semester: 1 },
    { code: 'EEE302', title: 'Electrical Machines II', credits: 3, level: 300, semester: 2 },
    { code: 'EEE303', title: 'Power Systems Analysis', credits: 3, level: 300, semester: 1 },
    { code: 'EEE304', title: 'Control Systems', credits: 3, level: 300, semester: 2 },
    { code: 'EEE305', title: 'Signal Processing', credits: 3, level: 300, semester: 1 },
    { code: 'EEE306', title: 'Microprocessors', credits: 3, level: 300, semester: 2 },
    { code: 'EEE307', title: 'Communication Systems', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'EEE401', title: 'Power Electronics', credits: 3, level: 400, semester: 1 },
    { code: 'EEE402', title: 'Renewable Energy Systems', credits: 3, level: 400, semester: 2 },
    { code: 'EEE403', title: 'Advanced Control Systems', credits: 3, level: 400, semester: 1 },
    { code: 'EEE404', title: 'Power System Protection', credits: 3, level: 400, semester: 2 },
    { code: 'EEE405', title: 'Electrical Installation', credits: 3, level: 400, semester: 1 },
    // 500 Level
    { code: 'EEE501', title: 'High Voltage Engineering', credits: 3, level: 500, semester: 1 },
    { code: 'EEE502', title: 'Power System Stability', credits: 3, level: 500, semester: 2 },
    { code: 'EEE503', title: 'Smart Grid Technology', credits: 3, level: 500, semester: 1 },
    { code: 'EEE504', title: 'Electric Power Quality', credits: 3, level: 500, semester: 2 },
    { code: 'EEE599', title: 'Final Year Project', credits: 6, level: 500, semester: 2 },
  ],
  'Mechanical Engineering': [
    // 100 Level
    { code: 'MEE101', title: 'Introduction to Mechanical Engineering', credits: 3, level: 100, semester: 1 },
    { code: 'MEE102', title: 'Engineering Drawing and CAD', credits: 3, level: 100, semester: 1 },
    { code: 'MEE103', title: 'Workshop Technology', credits: 2, level: 100, semester: 2 },
    { code: 'MMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'MMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'MPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    { code: 'MPHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
    // 200 Level
    { code: 'MEE201', title: 'Engineering Mechanics (Statics)', credits: 3, level: 200, semester: 1 },
    { code: 'MEE202', title: 'Engineering Mechanics (Dynamics)', credits: 3, level: 200, semester: 2 },
    { code: 'MEE203', title: 'Strength of Materials', credits: 3, level: 200, semester: 1 },
    { code: 'MEE204', title: 'Thermodynamics I', credits: 3, level: 200, semester: 2 },
    { code: 'MEE205', title: 'Manufacturing Processes', credits: 3, level: 200, semester: 1 },
    { code: 'MEE206', title: 'Materials Science', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'MEE301', title: 'Fluid Mechanics', credits: 3, level: 300, semester: 1 },
    { code: 'MEE302', title: 'Heat Transfer', credits: 3, level: 300, semester: 2 },
    { code: 'MEE303', title: 'Machine Design I', credits: 3, level: 300, semester: 1 },
    { code: 'MEE304', title: 'Machine Design II', credits: 3, level: 300, semester: 2 },
    { code: 'MEE305', title: 'Mechanics of Machines', credits: 3, level: 300, semester: 1 },
    { code: 'MEE306', title: 'Engineering Metrology', credits: 2, level: 300, semester: 2 },
    // 400 Level
    { code: 'MEE401', title: 'Mechanical Vibrations', credits: 3, level: 400, semester: 1 },
    { code: 'MEE402', title: 'Internal Combustion Engines', credits: 3, level: 400, semester: 2 },
    { code: 'MEE403', title: 'Refrigeration and Air Conditioning', credits: 3, level: 400, semester: 1 },
    { code: 'MEE404', title: 'Industrial Engineering', credits: 3, level: 400, semester: 2 },
    { code: 'MEE405', title: 'Finite Element Analysis', credits: 3, level: 400, semester: 1 },
    // 500 Level
    { code: 'MEE501', title: 'Advanced Manufacturing Systems', credits: 3, level: 500, semester: 1 },
    { code: 'MEE502', title: 'Robotics and Automation', credits: 3, level: 500, semester: 2 },
    { code: 'MEE503', title: 'Computational Fluid Dynamics', credits: 3, level: 500, semester: 1 },
    { code: 'MEE504', title: 'Engineering Management', credits: 3, level: 500, semester: 2 },
    { code: 'MEE599', title: 'Final Year Project', credits: 6, level: 500, semester: 2 },
  ],
  'Civil Engineering': [
    // 100 Level
    { code: 'CVE101', title: 'Introduction to Civil Engineering', credits: 3, level: 100, semester: 1 },
    { code: 'CVE102', title: 'Technical Drawing', credits: 2, level: 100, semester: 1 },
    { code: 'CVE103', title: 'Building Construction', credits: 3, level: 100, semester: 2 },
    { code: 'CMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'CMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'CPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    { code: 'CPHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
    // 200 Level
    { code: 'CVE201', title: 'Surveying I', credits: 3, level: 200, semester: 1 },
    { code: 'CVE202', title: 'Surveying II', credits: 3, level: 200, semester: 2 },
    { code: 'CVE203', title: 'Strength of Materials', credits: 3, level: 200, semester: 1 },
    { code: 'CVE204', title: 'Engineering Geology', credits: 3, level: 200, semester: 2 },
    { code: 'CVE205', title: 'Fluid Mechanics', credits: 3, level: 200, semester: 1 },
    { code: 'CVE206', title: 'Structural Analysis I', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'CVE301', title: 'Structural Analysis II', credits: 3, level: 300, semester: 1 },
    { code: 'CVE302', title: 'Reinforced Concrete Design', credits: 3, level: 300, semester: 2 },
    { code: 'CVE303', title: 'Soil Mechanics', credits: 3, level: 300, semester: 1 },
    { code: 'CVE304', title: 'Foundation Engineering', credits: 3, level: 300, semester: 2 },
    { code: 'CVE305', title: 'Highway Engineering', credits: 3, level: 300, semester: 1 },
    { code: 'CVE306', title: 'Water Resources Engineering', credits: 3, level: 300, semester: 2 },
    // 400 Level
    { code: 'CVE401', title: 'Steel Structures', credits: 3, level: 400, semester: 1 },
    { code: 'CVE402', title: 'Bridge Engineering', credits: 3, level: 400, semester: 2 },
    { code: 'CVE403', title: 'Environmental Engineering', credits: 3, level: 400, semester: 1 },
    { code: 'CVE404', title: 'Construction Management', credits: 3, level: 400, semester: 2 },
    { code: 'CVE405', title: 'Quantity Surveying', credits: 3, level: 400, semester: 1 },
    // 500 Level
    { code: 'CVE501', title: 'Advanced Structural Design', credits: 3, level: 500, semester: 1 },
    { code: 'CVE502', title: 'Earthquake Engineering', credits: 3, level: 500, semester: 2 },
    { code: 'CVE503', title: 'Pavement Design', credits: 3, level: 500, semester: 1 },
    { code: 'CVE504', title: 'Project Management', credits: 3, level: 500, semester: 2 },
    { code: 'CVE599', title: 'Final Year Project', credits: 6, level: 500, semester: 2 },
  ],
  'Business Administration': [
    // 100 Level
    { code: 'BUS101', title: 'Introduction to Business', credits: 3, level: 100, semester: 1 },
    { code: 'BUS102', title: 'Principles of Management', credits: 3, level: 100, semester: 1 },
    { code: 'BUS103', title: 'Business Mathematics', credits: 3, level: 100, semester: 2 },
    { code: 'BACC101', title: 'Financial Accounting I', credits: 3, level: 100, semester: 1 },
    { code: 'BACC102', title: 'Financial Accounting II', credits: 3, level: 100, semester: 2 },
    { code: 'BECO101', title: 'Principles of Economics I', credits: 3, level: 100, semester: 1 },
    { code: 'BECO102', title: 'Principles of Economics II', credits: 3, level: 100, semester: 2 },
    // 200 Level
    { code: 'BUS201', title: 'Business Communication', credits: 3, level: 200, semester: 1 },
    { code: 'BUS202', title: 'Organizational Behavior', credits: 3, level: 200, semester: 2 },
    { code: 'BUS203', title: 'Business Statistics', credits: 3, level: 200, semester: 1 },
    { code: 'BUS204', title: 'Marketing Management', credits: 3, level: 200, semester: 2 },
    { code: 'BUS205', title: 'Cost Accounting', credits: 3, level: 200, semester: 1 },
    { code: 'BUS206', title: 'Human Resource Management', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'BUS301', title: 'Financial Management', credits: 3, level: 300, semester: 1 },
    { code: 'BUS302', title: 'Strategic Management', credits: 3, level: 300, semester: 2 },
    { code: 'BUS303', title: 'Operations Management', credits: 3, level: 300, semester: 1 },
    { code: 'BUS304', title: 'Business Law', credits: 3, level: 300, semester: 2 },
    { code: 'BUS305', title: 'Research Methods', credits: 3, level: 300, semester: 1 },
    { code: 'BUS306', title: 'Entrepreneurship', credits: 3, level: 300, semester: 2 },
    // 400 Level
    { code: 'BUS401', title: 'International Business', credits: 3, level: 400, semester: 1 },
    { code: 'BUS402', title: 'Business Policy', credits: 3, level: 400, semester: 2 },
    { code: 'BUS403', title: 'Investment Management', credits: 3, level: 400, semester: 1 },
    { code: 'BUS404', title: 'E-Business', credits: 3, level: 400, semester: 2 },
    { code: 'BUS405', title: 'Leadership and Change Management', credits: 3, level: 400, semester: 1 },
    { code: 'BUS499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
  'Economics': [
    // 100 Level
    { code: 'ECO101', title: 'Principles of Economics I', credits: 3, level: 100, semester: 1 },
    { code: 'ECO102', title: 'Principles of Economics II', credits: 3, level: 100, semester: 2 },
    { code: 'ECO103', title: 'Introduction to Statistics', credits: 3, level: 100, semester: 1 },
    { code: 'EMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'EMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'EACC101', title: 'Financial Accounting I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'ECO201', title: 'Microeconomic Theory I', credits: 3, level: 200, semester: 1 },
    { code: 'ECO202', title: 'Macroeconomic Theory I', credits: 3, level: 200, semester: 2 },
    { code: 'ECO203', title: 'Development Economics I', credits: 3, level: 200, semester: 1 },
    { code: 'ECO204', title: 'Quantitative Economics', credits: 3, level: 200, semester: 2 },
    { code: 'ECO205', title: 'Statistical Methods', credits: 3, level: 200, semester: 1 },
    { code: 'ECO206', title: 'Nigerian Economy', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'ECO301', title: 'Microeconomic Theory II', credits: 3, level: 300, semester: 1 },
    { code: 'ECO302', title: 'Macroeconomic Theory II', credits: 3, level: 300, semester: 2 },
    { code: 'ECO303', title: 'Econometrics I', credits: 3, level: 300, semester: 1 },
    { code: 'ECO304', title: 'Econometrics II', credits: 3, level: 300, semester: 2 },
    { code: 'ECO305', title: 'Public Finance', credits: 3, level: 300, semester: 1 },
    { code: 'ECO306', title: 'International Economics', credits: 3, level: 300, semester: 2 },
    { code: 'ECO307', title: 'Monetary Economics', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'ECO401', title: 'Development Economics II', credits: 3, level: 400, semester: 1 },
    { code: 'ECO402', title: 'Labour Economics', credits: 3, level: 400, semester: 2 },
    { code: 'ECO403', title: 'Industrial Economics', credits: 3, level: 400, semester: 1 },
    { code: 'ECO404', title: 'Agricultural Economics', credits: 3, level: 400, semester: 2 },
    { code: 'ECO405', title: 'Economic Planning', credits: 3, level: 400, semester: 1 },
    { code: 'ECO499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
  'Mathematics': [
    // 100 Level
    { code: 'MMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'MMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'MMTH103', title: 'Trigonometry', credits: 3, level: 100, semester: 1 },
    { code: 'MMTH104', title: 'Vectors and Geometry', credits: 3, level: 100, semester: 2 },
    { code: 'MCSC101', title: 'Introduction to Computer Science', credits: 3, level: 100, semester: 1 },
    { code: 'MPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'MMTH201', title: 'Mathematical Methods I', credits: 3, level: 200, semester: 1 },
    { code: 'MMTH202', title: 'Elementary Differential Equations', credits: 3, level: 200, semester: 2 },
    { code: 'MMTH203', title: 'Linear Algebra I', credits: 3, level: 200, semester: 1 },
    { code: 'MMTH204', title: 'Linear Algebra II', credits: 3, level: 200, semester: 2 },
    { code: 'MMTH205', title: 'Real Analysis I', credits: 3, level: 200, semester: 1 },
    { code: 'MMTH206', title: 'Sets, Logic and Algebra', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'MMTH301', title: 'Abstract Algebra I', credits: 3, level: 300, semester: 1 },
    { code: 'MMTH302', title: 'Abstract Algebra II', credits: 3, level: 300, semester: 2 },
    { code: 'MMTH303', title: 'Complex Analysis I', credits: 3, level: 300, semester: 1 },
    { code: 'MMTH304', title: 'Numerical Analysis I', credits: 3, level: 300, semester: 2 },
    { code: 'MMTH305', title: 'Topology', credits: 3, level: 300, semester: 1 },
    { code: 'MMTH306', title: 'Probability Theory', credits: 3, level: 300, semester: 2 },
    { code: 'MMTH307', title: 'Mathematical Statistics', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'MMTH401', title: 'Functional Analysis', credits: 3, level: 400, semester: 1 },
    { code: 'MMTH402', title: 'Partial Differential Equations', credits: 3, level: 400, semester: 2 },
    { code: 'MMTH403', title: 'Optimization Theory', credits: 3, level: 400, semester: 1 },
    { code: 'MMTH404', title: 'Mathematical Modeling', credits: 3, level: 400, semester: 2 },
    { code: 'MMTH405', title: 'Differential Geometry', credits: 3, level: 400, semester: 1 },
    { code: 'MMTH499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
  'Physics': [
    // 100 Level
    { code: 'PPHY101', title: 'General Physics I (Mechanics)', credits: 3, level: 100, semester: 1 },
    { code: 'PPHY102', title: 'General Physics II (Electricity & Magnetism)', credits: 3, level: 100, semester: 2 },
    { code: 'PPHY103', title: 'Experimental Physics I', credits: 2, level: 100, semester: 1 },
    { code: 'PPHY104', title: 'Experimental Physics II', credits: 2, level: 100, semester: 2 },
    { code: 'PMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'PMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'PCHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'PPHY201', title: 'Thermal Physics', credits: 3, level: 200, semester: 1 },
    { code: 'PPHY202', title: 'Modern Physics', credits: 3, level: 200, semester: 2 },
    { code: 'PPHY203', title: 'Waves and Optics', credits: 3, level: 200, semester: 1 },
    { code: 'PPHY204', title: 'Electromagnetism', credits: 3, level: 200, semester: 2 },
    { code: 'PPHY205', title: 'Mathematical Methods for Physics I', credits: 3, level: 200, semester: 1 },
    { code: 'PPHY206', title: 'Electronics', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'PPHY301', title: 'Quantum Mechanics I', credits: 3, level: 300, semester: 1 },
    { code: 'PPHY302', title: 'Statistical Mechanics', credits: 3, level: 300, semester: 2 },
    { code: 'PPHY303', title: 'Classical Mechanics', credits: 3, level: 300, semester: 1 },
    { code: 'PPHY304', title: 'Solid State Physics', credits: 3, level: 300, semester: 2 },
    { code: 'PPHY305', title: 'Atomic and Molecular Physics', credits: 3, level: 300, semester: 1 },
    { code: 'PPHY306', title: 'Nuclear Physics', credits: 3, level: 300, semester: 2 },
    { code: 'PPHY307', title: 'Computational Physics', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'PPHY401', title: 'Quantum Mechanics II', credits: 3, level: 400, semester: 1 },
    { code: 'PPHY402', title: 'Particle Physics', credits: 3, level: 400, semester: 2 },
    { code: 'PPHY403', title: 'Astrophysics', credits: 3, level: 400, semester: 1 },
    { code: 'PPHY404', title: 'Condensed Matter Physics', credits: 3, level: 400, semester: 2 },
    { code: 'PPHY405', title: 'Plasma Physics', credits: 3, level: 400, semester: 1 },
    { code: 'PPHY499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
  'Chemistry': [
    // 100 Level
    { code: 'CCHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
    { code: 'CCHE102', title: 'General Chemistry II', credits: 3, level: 100, semester: 2 },
    { code: 'CCHE103', title: 'Practical Chemistry I', credits: 2, level: 100, semester: 1 },
    { code: 'CCHE104', title: 'Practical Chemistry II', credits: 2, level: 100, semester: 2 },
    { code: 'CMTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
    { code: 'CMTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
    { code: 'CPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'CCHE201', title: 'Organic Chemistry I', credits: 3, level: 200, semester: 1 },
    { code: 'CCHE202', title: 'Organic Chemistry II', credits: 3, level: 200, semester: 2 },
    { code: 'CCHE203', title: 'Inorganic Chemistry I', credits: 3, level: 200, semester: 1 },
    { code: 'CCHE204', title: 'Inorganic Chemistry II', credits: 3, level: 200, semester: 2 },
    { code: 'CCHE205', title: 'Physical Chemistry I', credits: 3, level: 200, semester: 1 },
    { code: 'CCHE206', title: 'Analytical Chemistry', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'CCHE301', title: 'Organic Chemistry III', credits: 3, level: 300, semester: 1 },
    { code: 'CCHE302', title: 'Physical Chemistry II', credits: 3, level: 300, semester: 2 },
    { code: 'CCHE303', title: 'Quantum Chemistry', credits: 3, level: 300, semester: 1 },
    { code: 'CCHE304', title: 'Industrial Chemistry', credits: 3, level: 300, semester: 2 },
    { code: 'CCHE305', title: 'Environmental Chemistry', credits: 3, level: 300, semester: 1 },
    { code: 'CCHE306', title: 'Spectroscopy', credits: 3, level: 300, semester: 2 },
    { code: 'CCHE307', title: 'Chemical Kinetics', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'CCHE401', title: 'Advanced Organic Chemistry', credits: 3, level: 400, semester: 1 },
    { code: 'CCHE402', title: 'Polymer Chemistry', credits: 3, level: 400, semester: 2 },
    { code: 'CCHE403', title: 'Biochemistry', credits: 3, level: 400, semester: 1 },
    { code: 'CCHE404', title: 'Pharmaceutical Chemistry', credits: 3, level: 400, semester: 2 },
    { code: 'CCHE405', title: 'Medicinal Chemistry', credits: 3, level: 400, semester: 1 },
    { code: 'CCHE499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
  'Biology': [
    // 100 Level
    { code: 'BBIO101', title: 'General Biology I', credits: 3, level: 100, semester: 1 },
    { code: 'BBIO102', title: 'General Biology II', credits: 3, level: 100, semester: 2 },
    { code: 'BBIO103', title: 'Practical Biology I', credits: 2, level: 100, semester: 1 },
    { code: 'BBIO104', title: 'Practical Biology II', credits: 2, level: 100, semester: 2 },
    { code: 'BCHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
    { code: 'BCHE102', title: 'General Chemistry II', credits: 3, level: 100, semester: 2 },
    { code: 'BPHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
    // 200 Level
    { code: 'BBIO201', title: 'Cell Biology', credits: 3, level: 200, semester: 1 },
    { code: 'BBIO202', title: 'Genetics', credits: 3, level: 200, semester: 2 },
    { code: 'BBIO203', title: 'Plant Physiology', credits: 3, level: 200, semester: 1 },
    { code: 'BBIO204', title: 'Animal Physiology', credits: 3, level: 200, semester: 2 },
    { code: 'BBIO205', title: 'Ecology', credits: 3, level: 200, semester: 1 },
    { code: 'BBIO206', title: 'Microbiology', credits: 3, level: 200, semester: 2 },
    // 300 Level
    { code: 'BBIO301', title: 'Molecular Biology', credits: 3, level: 300, semester: 1 },
    { code: 'BBIO302', title: 'Biochemistry', credits: 3, level: 300, semester: 2 },
    { code: 'BBIO303', title: 'Developmental Biology', credits: 3, level: 300, semester: 1 },
    { code: 'BBIO304', title: 'Evolution', credits: 3, level: 300, semester: 2 },
    { code: 'BBIO305', title: 'Immunology', credits: 3, level: 300, semester: 1 },
    { code: 'BBIO306', title: 'Biostatistics', credits: 3, level: 300, semester: 2 },
    { code: 'BBIO307', title: 'Parasitology', credits: 3, level: 300, semester: 1 },
    // 400 Level
    { code: 'BBIO401', title: 'Biotechnology', credits: 3, level: 400, semester: 1 },
    { code: 'BBIO402', title: 'Bioinformatics', credits: 3, level: 400, semester: 2 },
    { code: 'BBIO403', title: 'Conservation Biology', credits: 3, level: 400, semester: 1 },
    { code: 'BBIO404', title: 'Marine Biology', credits: 3, level: 400, semester: 2 },
    { code: 'BBIO405', title: 'Medical Microbiology', credits: 3, level: 400, semester: 1 },
    { code: 'BBIO499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
  ],
};

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedUsers() {
  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Use upsert to avoid duplicate errors
  await prisma.user.upsert({
    where: { email: 'admin@ims.edu' },
    update: {},
    create: {
      email: 'admin@ims.edu',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@ims.edu' },
    update: {},
    create: {
      email: 'staff@ims.edu',
      password: hashedPassword,
      firstName: 'Staff',
      lastName: 'Member',
      role: 'STAFF',
    },
  });

  console.log('✓ Users seeded');
}

async function seedDepartments() {
  console.log('Seeding departments...');
  
  // Use upsert to avoid duplicates
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  
  console.log('✓ Departments seeded');
}

async function seedSessions() {
  console.log('Seeding sessions and semesters...');
  
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const nextYear = currentYear + 1;
  
  // Check if sessions already exist
  const existingSessions = await prisma.session.findMany();
  
  if (existingSessions.length >= 3) {
    console.log(`✓ Sessions already exist (${existingSessions.length} found), skipping...`);
    return;
  }
  
  // Previous session (Completed)
  const previousSession = await prisma.session.upsert({
    where: { name: `${lastYear}/${currentYear}` },
    update: {},
    create: {
      name: `${lastYear}/${currentYear}`,
      startDate: new Date(`${lastYear}-09-01`),
      endDate: new Date(`${currentYear}-08-31`),
      isActive: false,
      status: 'COMPLETED',
      semesters: {
        create: [
          {
            type: 'FIRST',
            startDate: new Date(`${lastYear}-09-01`),
            endDate: new Date(`${lastYear}-12-31`),
            isActive: false,
            status: 'COMPLETED',
          },
          {
            type: 'SECOND',
            startDate: new Date(`${currentYear}-01-01`),
            endDate: new Date(`${currentYear}-08-31`),
            isActive: false,
            status: 'COMPLETED',
          },
        ],
      },
    },
  });

  // Current session (Active)
  const currentSession = await prisma.session.upsert({
    where: { name: `${currentYear}/${nextYear}` },
    update: {},
    create: {
      name: `${currentYear}/${nextYear}`,
      startDate: new Date(`${currentYear}-09-01`),
      endDate: new Date(`${nextYear}-08-31`),
      isActive: true,
      status: 'ACTIVE',
      semesters: {
        create: [
          {
            type: 'FIRST',
            startDate: new Date(`${currentYear}-09-01`),
            endDate: new Date(`${currentYear}-12-31`),
            isActive: true,
            status: 'ACTIVE',
          },
          {
            type: 'SECOND',
            startDate: new Date(`${nextYear}-01-01`),
            endDate: new Date(`${nextYear}-08-31`),
            isActive: false,
            status: 'UPCOMING',
          },
        ],
      },
    },
  });

  // Next session (Upcoming)
  const nextSession = await prisma.session.upsert({
    where: { name: `${nextYear}/${nextYear + 1}` },
    update: {},
    create: {
      name: `${nextYear}/${nextYear + 1}`,
      startDate: new Date(`${nextYear}-09-01`),
      endDate: new Date(`${nextYear + 1}-08-31`),
      isActive: false,
      status: 'UPCOMING',
      semesters: {
        create: [
          {
            type: 'FIRST',
            startDate: new Date(`${nextYear}-09-01`),
            endDate: new Date(`${nextYear}-12-31`),
            isActive: false,
            status: 'UPCOMING',
          },
          {
            type: 'SECOND',
            startDate: new Date(`${nextYear + 1}-01-01`),
            endDate: new Date(`${nextYear + 1}-08-31`),
            isActive: false,
            status: 'UPCOMING',
          },
        ],
      },
    },
  });

  console.log(`✓ Sessions seeded: ${previousSession.name}, ${currentSession.name}, ${nextSession.name}`);
  console.log(`✓ Total: 3 sessions with 6 semesters`);
}

async function seedPrograms() {
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
    'Mechanical Engineering': [
      { name: 'Mechanical Engineering', code: 'MEE', duration: 5, description: 'Bachelor of Engineering in Mechanical Engineering' },
      { name: 'Automotive Engineering', code: 'AUE', duration: 4, description: 'Bachelor of Engineering in Automotive Engineering' },
      { name: 'Manufacturing Engineering', code: 'MFE', duration: 4, description: 'Bachelor of Engineering in Manufacturing' },
    ],
    'Civil Engineering': [
      { name: 'Civil Engineering', code: 'CVE', duration: 5, description: 'Bachelor of Engineering in Civil Engineering' },
      { name: 'Structural Engineering', code: 'STE', duration: 4, description: 'Bachelor of Engineering in Structural Engineering' },
      { name: 'Environmental Engineering', code: 'ENE', duration: 4, description: 'Bachelor of Engineering in Environmental Engineering' },
    ],
    'Business Administration': [
      { name: 'Business Administration', code: 'BUS', duration: 4, description: 'Bachelor of Business Administration' },
      { name: 'Marketing', code: 'MKT', duration: 4, description: 'Bachelor of Science in Marketing' },
      { name: 'Human Resource Management', code: 'HRM', duration: 4, description: 'Bachelor of Science in Human Resource Management' },
      { name: 'Finance', code: 'FIN', duration: 4, description: 'Bachelor of Science in Finance' },
    ],
    'Economics': [
      { name: 'Economics', code: 'ECO', duration: 4, description: 'Bachelor of Science in Economics' },
      { name: 'Development Economics', code: 'DEV', duration: 4, description: 'Bachelor of Science in Development Economics' },
    ],
    'Mathematics': [
      { name: 'Mathematics', code: 'MAT', duration: 4, description: 'Bachelor of Science in Mathematics' },
      { name: 'Applied Mathematics', code: 'APM', duration: 4, description: 'Bachelor of Science in Applied Mathematics' },
      { name: 'Statistics', code: 'STA', duration: 4, description: 'Bachelor of Science in Statistics' },
    ],
    'Physics': [
      { name: 'Physics', code: 'PHY', duration: 4, description: 'Bachelor of Science in Physics' },
      { name: 'Applied Physics', code: 'APP', duration: 4, description: 'Bachelor of Science in Applied Physics' },
    ],
    'Chemistry': [
      { name: 'Chemistry', code: 'CHE', duration: 4, description: 'Bachelor of Science in Chemistry' },
      { name: 'Biochemistry', code: 'BCH', duration: 4, description: 'Bachelor of Science in Biochemistry' },
    ],
    'Biology': [
      { name: 'Biology', code: 'BIO', duration: 4, description: 'Bachelor of Science in Biology' },
      { name: 'Microbiology', code: 'MCB', duration: 4, description: 'Bachelor of Science in Microbiology' },
      { name: 'Biotechnology', code: 'BTN', duration: 4, description: 'Bachelor of Science in Biotechnology' },
    ],
  };

  for (const dept of depts) {
    const programs = programsByDepartment[dept.name as keyof typeof programsByDepartment];
    if (programs) {
      for (const program of programs) {
        await prisma.program.upsert({
          where: { code: program.code },
          update: {},
          create: {
            ...program,
            departmentId: dept.id,
          },
        });
      }
    }
  }
  
  console.log('✓ Programs seeded');
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
      username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${i}`,
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
        gender: applicant.gender as any,
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
  console.log(`Seeding ${TOTAL_STUDENTS} students with Nigerian names and realistic data...`);
  
  // Fetch all departments
  const depts = await prisma.department.findMany();
  
  if (depts.length === 0) {
    console.error('No departments found. Cannot seed students.');
    return;
  }

  console.log(`Found ${depts.length} departments`);

  // Fetch all programs
  const programs = await prisma.program.findMany();
  
  if (programs.length === 0) {
    console.error('No programs found. Cannot seed students.');
    return;
  }

  // Fetch active session
  const activeSession = await prisma.session.findFirst({
    where: { isActive: true }
  });

  if (!activeSession) {
    console.error('No active session found. Cannot seed students.');
    return;
  }

  // Define levels and their distribution (total: 1500)
  const levels = [100, 200, 300, 400, 500];
  const levelDistribution = [450, 400, 350, 200, 100]; // More realistic distribution

  // Email domains for variety
  const emailDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com',
    'icloud.com', 'aol.com', 'mail.com'
  ];

  // Helper functions
  const generateMatricNo = (year: number, deptCode: string, index: number): string => {
    return `IMS/${year}/${deptCode}/${String(index).padStart(5, '0')}`;
  };

  const generateEmail = (firstName: string, lastName: string, index: number): string => {
    const domain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
  };

  const generatePhone = (): string => {
    const prefixes = ['0803', '0806', '0810', '0813', '0816', '0703', '0706', '0805', '0807', '0811', '0814', '0815', '0905', '0906'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const rest = Math.floor(Math.random() * 10000000);
    return `${prefix}${String(rest).padStart(7, '0')}`;
  };

  const cities = ['Lagos', 'Abuja', 'Kano', 'Port Harcourt', 'Ibadan', 'Enugu', 'Jos', 'Kaduna', 'Maiduguri', 'Benin City'];

  const hashedPassword = await bcrypt.hash('password123', 10);
  
  let totalCreated = 0;
  let counter = 1;

  // Calculate students per department per level
  const studentsPerDept = Math.floor(TOTAL_STUDENTS / depts.length);

  // Create students distributed across departments and levels
  for (const department of depts) {
    const deptCode = department.code.toUpperCase();
    let deptStudents = 0;

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      const studentsForLevel = Math.floor((levelDistribution[levelIndex] / TOTAL_STUDENTS) * studentsPerDept);

      for (let i = 0; i < studentsForLevel; i++) {
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
        const email = generateEmail(firstName, lastName, counter);
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
        const address = `${Math.floor(Math.random() * 100) + 1} ${getRandomElement(lastNames)} Street, ${getRandomElement(cities)}`;

        try {
          await prisma.student.create({
            data: {
              matricNo,
              firstName,
              lastName,
              email,
              phone,
              gender: gender as any,
              dateOfBirth,
              address,
              departmentId: department.id,
              programId: programs[Math.floor(Math.random() * programs.length)].id,
              currentLevel: level,
              enrollmentDate,
              status: 'ACTIVE',
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
            // Duplicate entry, skip
            counter++;
            continue;
          }
          throw error;
        }
      }
    }

    console.log(`  ✓ Created ${deptStudents} students for ${department.name}`);
  }

  // Fill remaining students to reach exactly 1500
  let remaining = TOTAL_STUDENTS - totalCreated;
  if (remaining > 0) {
    console.log(`\n  Creating ${remaining} additional students to reach ${TOTAL_STUDENTS}...`);
    
    for (let i = 0; i < remaining; i++) {
      const department = getRandomElement(depts);
      const level = getRandomElement(levels);
      const firstName = getRandomElement(firstNames);
      const lastName = getRandomElement(lastNames);
      const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
      const email = generateEmail(firstName, lastName, counter);
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

      const address = `${Math.floor(Math.random() * 100) + 1} ${getRandomElement(lastNames)} Street, ${getRandomElement(cities)}`;

      try {
        await prisma.student.create({
          data: {
            matricNo,
            firstName,
            lastName,
            email,
            phone,
            gender: gender as any,
            dateOfBirth,
            address,
            departmentId: department.id,
            programId: programs[Math.floor(Math.random() * programs.length)].id,
            currentLevel: level,
            enrollmentDate,
            status: 'ACTIVE',
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

  console.log(`\n✓ Successfully created ${totalCreated} students!`);
  
  // Show distribution summary
  console.log('\n  === STUDENT DISTRIBUTION BY DEPARTMENT ===');
  for (const department of depts) {
    const count = await prisma.student.count({
      where: { departmentId: department.id }
    });
    console.log(`  ${department.name}: ${count} students`);
  }

  console.log('\n  === STUDENT DISTRIBUTION BY LEVEL ===');
  for (const level of levels) {
    const count = await prisma.student.count({
      where: { currentLevel: level }
    });
    console.log(`  Level ${level}: ${count} students`);
  }

  const totalStudents = await prisma.student.count();
  console.log(`\n  Total students in database: ${totalStudents}`);
  console.log('✓ Students seeded successfully');
}

async function seedCourses() {
  console.log(`Seeding ${TOTAL_COURSES} comprehensive courses...`);
  const depts = await prisma.department.findMany();

  let totalCoursesAdded = 0;
  
  for (const dept of depts) {
    const departmentCourses = comprehensiveCoursesByDepartment[dept.name];
    
    if (departmentCourses && departmentCourses.length > 0) {
      console.log(`  Adding ${departmentCourses.length} courses for ${dept.name}...`);
      
      for (const course of departmentCourses) {
        await prisma.course.upsert({
          where: { code: course.code },
          update: {
            title: course.title,
            credits: course.credits,
            level: course.level,
            semester: course.semester,
            departmentId: dept.id,
          },
          create: {
            code: course.code,
            title: course.title,
            credits: course.credits,
            level: course.level,
            semester: course.semester,
            departmentId: dept.id,
            description: `${course.title} - ${dept.name} Department`,
          },
        });
        totalCoursesAdded++;
      }
    }
  }

  console.log(`✓ Courses seeded: ${totalCoursesAdded} courses across all departments`);
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
      let grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

      if (rawScore >= 70) grade = 'A';
      else if (rawScore >= 60) grade = 'B';
      else if (rawScore >= 50) grade = 'C';
      else if (rawScore >= 45) grade = 'D';
      else if (rawScore >= 40) grade = 'E';
      else grade = 'F';

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
    // Clear existing data (preserve manually registered applicants)
    console.log('Clearing existing data...');
    await prisma.score.deleteMany();
    await prisma.exam.deleteMany();
    await prisma.courseRegistration.deleteMany();
    await prisma.course.deleteMany();
    await prisma.student.deleteMany();
    await prisma.matricNumber.deleteMany();
    
    // Only delete admission decisions for test applicants (not real ones)
    await prisma.admissionDecision.deleteMany({
      where: {
        applicant: {
          username: {
            endsWith: '@applicant.com' // Only delete test applicants
          }
        }
      }
    });
    
    // Only delete test applicants (preserve real registrations)
    await prisma.applicant.deleteMany({
      where: {
        email: {
          endsWith: '@applicant.com' // Only delete test applicants
        }
      }
    });
    
    // Only delete test departments and users if they don't have real data
    const realApplicantsCount = await prisma.applicant.count();
    if (realApplicantsCount === 0) {
      await prisma.program.deleteMany();
      await prisma.department.deleteMany();
      await prisma.user.deleteMany();
    }
    
    console.log('✓ Existing test data cleared (real data preserved)\n');

    // Seed in order
    await seedUsers();
    await seedDepartments();
    await seedSessions();
    await seedPrograms();
    await seedApplicants();
    await seedStudents();
    await seedCourses();
    await seedCourseRegistrations();
    await seedExamsAndScores();

    // Statistics
    const stats = {
      users: await prisma.user.count(),
      departments: await prisma.department.count(),
      sessions: await prisma.session.count(),
      semesters: await prisma.semester.count(),
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
    console.log(`   Sessions: ${stats.sessions}`);
    console.log(`   Semesters: ${stats.semesters}`);
    console.log(`   Applicants: ${stats.applicants}`);
    console.log(`   Students: ${stats.students}`);
    console.log(`   Courses: ${stats.courses}`);
    console.log(`   Course Registrations: ${stats.courseRegistrations}`);
    console.log(`   Exams: ${stats.exams}`);
    console.log(`   Scores: ${stats.scores}`);
    console.log(`\n   Total Records: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);
  } catch (error) {
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
