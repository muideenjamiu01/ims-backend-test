import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Comprehensive course data for Nigerian universities
const coursesByDepartment = {
  'Computer Science': {
    maxLevel: 400,
    courses: [
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
    ]
  },
  
  'Electrical Engineering': {
    maxLevel: 500,
    courses: [
      // 100 Level
      { code: 'EEE101', title: 'Introduction to Electrical Engineering', credits: 3, level: 100, semester: 1 },
      { code: 'EEE102', title: 'Engineering Drawing', credits: 2, level: 100, semester: 1 },
      { code: 'EEE103', title: 'Workshop Practice', credits: 2, level: 100, semester: 2 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      { code: 'PHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
      { code: 'CHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
      
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
    ]
  },
  
  'Mechanical Engineering': {
    maxLevel: 500,
    courses: [
      // 100 Level
      { code: 'MEE101', title: 'Introduction to Mechanical Engineering', credits: 3, level: 100, semester: 1 },
      { code: 'MEE102', title: 'Engineering Drawing and CAD', credits: 3, level: 100, semester: 1 },
      { code: 'MEE103', title: 'Workshop Technology', credits: 2, level: 100, semester: 2 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      { code: 'PHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
      
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
    ]
  },
  
  'Civil Engineering': {
    maxLevel: 500,
    courses: [
      // 100 Level
      { code: 'CVE101', title: 'Introduction to Civil Engineering', credits: 3, level: 100, semester: 1 },
      { code: 'CVE102', title: 'Technical Drawing', credits: 2, level: 100, semester: 1 },
      { code: 'CVE103', title: 'Building Construction', credits: 3, level: 100, semester: 2 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      { code: 'PHY102', title: 'General Physics II', credits: 3, level: 100, semester: 2 },
      
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
    ]
  },
  
  'Business Administration': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'BUS101', title: 'Introduction to Business', credits: 3, level: 100, semester: 1 },
      { code: 'BUS102', title: 'Principles of Management', credits: 3, level: 100, semester: 1 },
      { code: 'BUS103', title: 'Business Mathematics', credits: 3, level: 100, semester: 2 },
      { code: 'ACC101', title: 'Financial Accounting I', credits: 3, level: 100, semester: 1 },
      { code: 'ACC102', title: 'Financial Accounting II', credits: 3, level: 100, semester: 2 },
      { code: 'ECO101', title: 'Principles of Economics I', credits: 3, level: 100, semester: 1 },
      { code: 'ECO102', title: 'Principles of Economics II', credits: 3, level: 100, semester: 2 },
      
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
    ]
  },
  
  'Economics': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'ECO101', title: 'Principles of Economics I', credits: 3, level: 100, semester: 1 },
      { code: 'ECO102', title: 'Principles of Economics II', credits: 3, level: 100, semester: 2 },
      { code: 'ECO103', title: 'Introduction to Statistics', credits: 3, level: 100, semester: 1 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'ACC101', title: 'Financial Accounting I', credits: 3, level: 100, semester: 1 },
      
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
    ]
  },
  
  'Mathematics': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'MTH103', title: 'Trigonometry', credits: 3, level: 100, semester: 1 },
      { code: 'MTH104', title: 'Vectors and Geometry', credits: 3, level: 100, semester: 2 },
      { code: 'CSC101', title: 'Introduction to Computer Science', credits: 3, level: 100, semester: 1 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      
      // 200 Level
      { code: 'MTH201', title: 'Mathematical Methods I', credits: 3, level: 200, semester: 1 },
      { code: 'MTH202', title: 'Elementary Differential Equations', credits: 3, level: 200, semester: 2 },
      { code: 'MTH203', title: 'Linear Algebra I', credits: 3, level: 200, semester: 1 },
      { code: 'MTH204', title: 'Linear Algebra II', credits: 3, level: 200, semester: 2 },
      { code: 'MTH205', title: 'Real Analysis I', credits: 3, level: 200, semester: 1 },
      { code: 'MTH206', title: 'Sets, Logic and Algebra', credits: 3, level: 200, semester: 2 },
      
      // 300 Level
      { code: 'MTH301', title: 'Abstract Algebra I', credits: 3, level: 300, semester: 1 },
      { code: 'MTH302', title: 'Abstract Algebra II', credits: 3, level: 300, semester: 2 },
      { code: 'MTH303', title: 'Complex Analysis I', credits: 3, level: 300, semester: 1 },
      { code: 'MTH304', title: 'Numerical Analysis I', credits: 3, level: 300, semester: 2 },
      { code: 'MTH305', title: 'Topology', credits: 3, level: 300, semester: 1 },
      { code: 'MTH306', title: 'Probability Theory', credits: 3, level: 300, semester: 2 },
      { code: 'MTH307', title: 'Mathematical Statistics', credits: 3, level: 300, semester: 1 },
      
      // 400 Level
      { code: 'MTH401', title: 'Functional Analysis', credits: 3, level: 400, semester: 1 },
      { code: 'MTH402', title: 'Partial Differential Equations', credits: 3, level: 400, semester: 2 },
      { code: 'MTH403', title: 'Optimization Theory', credits: 3, level: 400, semester: 1 },
      { code: 'MTH404', title: 'Mathematical Modeling', credits: 3, level: 400, semester: 2 },
      { code: 'MTH405', title: 'Differential Geometry', credits: 3, level: 400, semester: 1 },
      { code: 'MTH499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
    ]
  },
  
  'Physics': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'PHY101', title: 'General Physics I (Mechanics)', credits: 3, level: 100, semester: 1 },
      { code: 'PHY102', title: 'General Physics II (Electricity & Magnetism)', credits: 3, level: 100, semester: 2 },
      { code: 'PHY103', title: 'Experimental Physics I', credits: 2, level: 100, semester: 1 },
      { code: 'PHY104', title: 'Experimental Physics II', credits: 2, level: 100, semester: 2 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'CHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
      
      // 200 Level
      { code: 'PHY201', title: 'Thermal Physics', credits: 3, level: 200, semester: 1 },
      { code: 'PHY202', title: 'Modern Physics', credits: 3, level: 200, semester: 2 },
      { code: 'PHY203', title: 'Waves and Optics', credits: 3, level: 200, semester: 1 },
      { code: 'PHY204', title: 'Electromagnetism', credits: 3, level: 200, semester: 2 },
      { code: 'PHY205', title: 'Mathematical Methods for Physics I', credits: 3, level: 200, semester: 1 },
      { code: 'PHY206', title: 'Electronics', credits: 3, level: 200, semester: 2 },
      
      // 300 Level
      { code: 'PHY301', title: 'Quantum Mechanics I', credits: 3, level: 300, semester: 1 },
      { code: 'PHY302', title: 'Statistical Mechanics', credits: 3, level: 300, semester: 2 },
      { code: 'PHY303', title: 'Classical Mechanics', credits: 3, level: 300, semester: 1 },
      { code: 'PHY304', title: 'Solid State Physics', credits: 3, level: 300, semester: 2 },
      { code: 'PHY305', title: 'Atomic and Molecular Physics', credits: 3, level: 300, semester: 1 },
      { code: 'PHY306', title: 'Nuclear Physics', credits: 3, level: 300, semester: 2 },
      { code: 'PHY307', title: 'Computational Physics', credits: 3, level: 300, semester: 1 },
      
      // 400 Level
      { code: 'PHY401', title: 'Quantum Mechanics II', credits: 3, level: 400, semester: 1 },
      { code: 'PHY402', title: 'Particle Physics', credits: 3, level: 400, semester: 2 },
      { code: 'PHY403', title: 'Astrophysics', credits: 3, level: 400, semester: 1 },
      { code: 'PHY404', title: 'Condensed Matter Physics', credits: 3, level: 400, semester: 2 },
      { code: 'PHY405', title: 'Plasma Physics', credits: 3, level: 400, semester: 1 },
      { code: 'PHY499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
    ]
  },
  
  'Chemistry': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'CHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
      { code: 'CHE102', title: 'General Chemistry II', credits: 3, level: 100, semester: 2 },
      { code: 'CHE103', title: 'Practical Chemistry I', credits: 2, level: 100, semester: 1 },
      { code: 'CHE104', title: 'Practical Chemistry II', credits: 2, level: 100, semester: 2 },
      { code: 'MTH101', title: 'General Mathematics I', credits: 3, level: 100, semester: 1 },
      { code: 'MTH102', title: 'General Mathematics II', credits: 3, level: 100, semester: 2 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      
      // 200 Level
      { code: 'CHE201', title: 'Organic Chemistry I', credits: 3, level: 200, semester: 1 },
      { code: 'CHE202', title: 'Organic Chemistry II', credits: 3, level: 200, semester: 2 },
      { code: 'CHE203', title: 'Inorganic Chemistry I', credits: 3, level: 200, semester: 1 },
      { code: 'CHE204', title: 'Inorganic Chemistry II', credits: 3, level: 200, semester: 2 },
      { code: 'CHE205', title: 'Physical Chemistry I', credits: 3, level: 200, semester: 1 },
      { code: 'CHE206', title: 'Analytical Chemistry', credits: 3, level: 200, semester: 2 },
      
      // 300 Level
      { code: 'CHE301', title: 'Organic Chemistry III', credits: 3, level: 300, semester: 1 },
      { code: 'CHE302', title: 'Physical Chemistry II', credits: 3, level: 300, semester: 2 },
      { code: 'CHE303', title: 'Quantum Chemistry', credits: 3, level: 300, semester: 1 },
      { code: 'CHE304', title: 'Industrial Chemistry', credits: 3, level: 300, semester: 2 },
      { code: 'CHE305', title: 'Environmental Chemistry', credits: 3, level: 300, semester: 1 },
      { code: 'CHE306', title: 'Spectroscopy', credits: 3, level: 300, semester: 2 },
      { code: 'CHE307', title: 'Chemical Kinetics', credits: 3, level: 300, semester: 1 },
      
      // 400 Level
      { code: 'CHE401', title: 'Advanced Organic Chemistry', credits: 3, level: 400, semester: 1 },
      { code: 'CHE402', title: 'Polymer Chemistry', credits: 3, level: 400, semester: 2 },
      { code: 'CHE403', title: 'Biochemistry', credits: 3, level: 400, semester: 1 },
      { code: 'CHE404', title: 'Pharmaceutical Chemistry', credits: 3, level: 400, semester: 2 },
      { code: 'CHE405', title: 'Medicinal Chemistry', credits: 3, level: 400, semester: 1 },
      { code: 'CHE499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
    ]
  },
  
  'Biology': {
    maxLevel: 400,
    courses: [
      // 100 Level
      { code: 'BIO101', title: 'General Biology I', credits: 3, level: 100, semester: 1 },
      { code: 'BIO102', title: 'General Biology II', credits: 3, level: 100, semester: 2 },
      { code: 'BIO103', title: 'Practical Biology I', credits: 2, level: 100, semester: 1 },
      { code: 'BIO104', title: 'Practical Biology II', credits: 2, level: 100, semester: 2 },
      { code: 'CHE101', title: 'General Chemistry I', credits: 3, level: 100, semester: 1 },
      { code: 'CHE102', title: 'General Chemistry II', credits: 3, level: 100, semester: 2 },
      { code: 'PHY101', title: 'General Physics I', credits: 3, level: 100, semester: 1 },
      
      // 200 Level
      { code: 'BIO201', title: 'Cell Biology', credits: 3, level: 200, semester: 1 },
      { code: 'BIO202', title: 'Genetics', credits: 3, level: 200, semester: 2 },
      { code: 'BIO203', title: 'Plant Physiology', credits: 3, level: 200, semester: 1 },
      { code: 'BIO204', title: 'Animal Physiology', credits: 3, level: 200, semester: 2 },
      { code: 'BIO205', title: 'Ecology', credits: 3, level: 200, semester: 1 },
      { code: 'BIO206', title: 'Microbiology', credits: 3, level: 200, semester: 2 },
      
      // 300 Level
      { code: 'BIO301', title: 'Molecular Biology', credits: 3, level: 300, semester: 1 },
      { code: 'BIO302', title: 'Biochemistry', credits: 3, level: 300, semester: 2 },
      { code: 'BIO303', title: 'Developmental Biology', credits: 3, level: 300, semester: 1 },
      { code: 'BIO304', title: 'Evolution', credits: 3, level: 300, semester: 2 },
      { code: 'BIO305', title: 'Immunology', credits: 3, level: 300, semester: 1 },
      { code: 'BIO306', title: 'Biostatistics', credits: 3, level: 300, semester: 2 },
      { code: 'BIO307', title: 'Parasitology', credits: 3, level: 300, semester: 1 },
      
      // 400 Level
      { code: 'BIO401', title: 'Biotechnology', credits: 3, level: 400, semester: 1 },
      { code: 'BIO402', title: 'Bioinformatics', credits: 3, level: 400, semester: 2 },
      { code: 'BIO403', title: 'Conservation Biology', credits: 3, level: 400, semester: 1 },
      { code: 'BIO404', title: 'Marine Biology', credits: 3, level: 400, semester: 2 },
      { code: 'BIO405', title: 'Medical Microbiology', credits: 3, level: 400, semester: 1 },
      { code: 'BIO499', title: 'Research Project', credits: 6, level: 400, semester: 2 },
    ]
  },
};

async function seedComprehensiveCourses() {
  console.log('🌱 Starting comprehensive course seeding...\n');
  
  try {
    // Get all departments
    const departments = await prisma.department.findMany();
    
    console.log(`Found ${departments.length} departments`);
    
    let totalCoursesAdded = 0;
    
    for (const dept of departments) {
      const departmentCourses = coursesByDepartment[dept.name as keyof typeof coursesByDepartment];
      
      if (departmentCourses) {
        console.log(`\nProcessing ${dept.name} (${dept.code})...`);
        console.log(`  Max Level: ${departmentCourses.maxLevel}`);
        
        for (const course of departmentCourses.courses) {
          try {
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
                description: `${course.title} - ${dept.name}`,
              },
            });
            totalCoursesAdded++;
          } catch (error) {
            console.error(`  ❌ Error adding course ${course.code}:`, error);
          }
        }
        
        console.log(`  ✅ Added ${departmentCourses.courses.length} courses`);
      } else {
        console.log(`\n⚠️  No course data found for ${dept.name}`);
      }
    }
    
    // Get final statistics
    const stats = {
      totalCourses: await prisma.course.count(),
      by100Level: await prisma.course.count({ where: { level: 100 } }),
      by200Level: await prisma.course.count({ where: { level: 200 } }),
      by300Level: await prisma.course.count({ where: { level: 300 } }),
      by400Level: await prisma.course.count({ where: { level: 400 } }),
      by500Level: await prisma.course.count({ where: { level: 500 } }),
      firstSemester: await prisma.course.count({ where: { semester: 1 } }),
      secondSemester: await prisma.course.count({ where: { semester: 2 } }),
    };
    
    console.log('\n✅ Comprehensive course seeding completed!\n');
    console.log('📊 Course Statistics:');
    console.log(`   Total Courses: ${stats.totalCourses}`);
    console.log(`   100 Level: ${stats.by100Level}`);
    console.log(`   200 Level: ${stats.by200Level}`);
    console.log(`   300 Level: ${stats.by300Level}`);
    console.log(`   400 Level: ${stats.by400Level}`);
    console.log(`   500 Level: ${stats.by500Level} (Engineering only)`);
    console.log(`   First Semester: ${stats.firstSemester}`);
    console.log(`   Second Semester: ${stats.secondSemester}`);
    
  } catch (error) {
    console.error('❌ Error seeding courses:', error);
    throw error;
  }
}

seedComprehensiveCourses()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
