import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

// Create token for student ID 502 (ACTIVE student)
const token = jwt.sign(
  { 
    id: 502, 
    email: 'ikechukwu.eze1@student.sun.edu.ng',
    matricNo: 'SUN23/EEE/0300/002',
    type: 'STUDENT' 
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Test Token for Student 502:');
console.log(token);
console.log('\nTest with:');
console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:5000/api/student/payments/receipt/5" --output test-receipt.pdf`);