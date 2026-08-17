import { query } from '../config/database';
import { hashPassword } from '../utils/password';
import { v4 as uuidv4 } from 'uuid';

const facultyList = [
  "Dr A Pradeep",
  "Dr A Swathi",
  "Dr B Spandana",
  "Dr B Suresh Babu",
  "Dr D Gireesh",
  "Dr G Vanaja",
  "Dr K Rajesh Babu",
  "Dr Sreeja Nair",
  "Dr V Srihari",
  "Mr A Srinivasa Reddy",
  "Mr B Deepak Kumar",
  "Mr B Lalith Mohan",
  "Mr Deevan Kumar",
  "Mr I Ravi Shireesh Kumar",
  "Mr K Santhosh",
  "Mr M Satish Reddy",
  "Mr P Anil Kumar",
  "Mr P Sreenivasa Rao",
  "Mr Somnadh",
  "Mr. GVK Reddy",
  "Mrs A Anoosha",
  "Mrs A Sowjanya",
  "Mrs A Swapna",
  "Mrs Anjima Ajith",
  "Mrs D Nagasree",
  "Mrs D Sandhya Rani",
  "Mrs G Narsamma",
  "Mrs G Uma Maheshwari",
  "Mrs J Mahalaxmi",
  "Mrs M Bhavana",
  "Mrs M Shravani",
  "Mrs N Sreeja",
  "Mrs P Sulochana",
  "Mrs S Pavani Priya",
  "Mrs V V Deepika",
  "Mrs. M. Shravani",
  "Ms S Pavani Priya"
];

async function addFaculties() {
  const passwordHash = await hashPassword('Faculty123');

  // get a default department for them to be assigned to
  const result = await query('SELECT id FROM departments LIMIT 1');
  const deptId = result.rows[0].id;
  
  for (let i = 0; i < facultyList.length; i++) {
    const rawName = facultyList[i];
    // remove Dr, Mr, Mrs, Ms, Mr., Mrs.
    const cleanName = rawName.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '');
    const email = cleanName.toLowerCase().replace(/[\s\.]+/g, '') + '@sreyas.ac.in';
    const uId = uuidv4();
    const fId = uuidv4();
    const empNum = `SREYAS-FAC-${1000 + i}`;
    
    // Check if email already exists
    const check = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      console.log(`Skipping ${email} as it already exists`);
      continue;
    }

    await query(
      `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5)`,
      [uId, email, passwordHash, 'faculty', cleanName]
    );

    await query(
      `INSERT INTO faculty (id, user_id, employee_number, full_name, department_id, designation, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fId, uId, empNum, cleanName, deptId, 'assistant_professor', 'active']
    );
    console.log(`Added ${cleanName} with email ${email}`);
  }
  console.log('All faculties added successfully.');
  process.exit(0);
}

addFaculties().catch(e => {
  console.error(e);
  process.exit(1);
});
