const {
  connectDatabase,
  Beneficiary,
  Barangay,
  User,
} = require('./db');

const firstNames = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Carlos', 'Elena',
  'Miguel', 'Sofia', 'Antonio', 'Carmen', 'Ricardo', 'Teresa', 'Fernando',
  'Isabel', 'Eduardo', 'Lucia', 'Roberto', 'Patricia',
];

const lastNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Cruz', 'Bautista', 'Gonzales',
  'Lopez', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Aquino',
  'Castro', 'Rivera', 'Fernandez', 'Villanueva', 'Hernandez', 'Perez',
  'Martinez', 'Flores',
];

const categories = ['4Ps Household Beneficiaries', 'Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)'];

function randomDate(startYear, endYear) {
  const y = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
  const m = Math.floor(Math.random() * 12) + 1;
  const d = Math.floor(Math.random() * 28) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function randomPhone() {
  return `09${Math.floor(Math.random() * 90) + 10}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`;
}

async function createAnilaobeneficiaries() {
  console.log('🌱 Creating 20 dummy beneficiaries in Anilao...');

  try {
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      console.error('❌ Admin user not found');
      process.exit(1);
    }

    const barangay = await Barangay.findOne({ where: { barangay_name: 'Anilao' } });
    if (!barangay) {
      console.error('❌ Anilao barangay not found');
      process.exit(1);
    }

    console.log(`✅ Found Anilao barangay (ID: ${barangay.id})`);
    console.log(`✅ Using admin user (ID: ${admin.id})`);

    const beneficiaries = [];
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      
      beneficiaries.push({
        user_id: admin.id,
        first_name: firstName,
        last_name: lastName,
        middle_name: 'Sample',
        sex: i % 2 === 0 ? 'Male' : 'Female',
        birthdate: randomDate(1950, 2005),
        civil_status: 'Married',
        address: `Purok ${(i % 12) + 1}, Anilao`,
        barangay_id: barangay.id,
        category: categories[i % categories.length],
        RFID_number: `RFID-ANILAO-${String(i + 1).padStart(3, '0')}`,
        contact_number: randomPhone(),
        status: 'Approved',
        beneficiary_id_code: `BEN-2026-ANILAO-${String(i + 1).padStart(3, '0')}`,
        national_id_number: `NAT-ID-ANILAO-${String(i + 1).padStart(3, '0')}`,
        psa_birth_cert_number: `PSA-ANILAO-${String(i + 1).padStart(3, '0')}`,
        approval_date: randomDate(2025, 2026),
        approving_staff_id: admin.id
      });
    }

    await Beneficiary.bulkCreate(beneficiaries);
    console.log(`✅ Created 20 beneficiaries in Anilao successfully!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

connectDatabase()
  .then(() => createAnilaobeneficiaries())
  .catch((err) => {
    console.error('Connection failed:', err);
    process.exit(1);
  });
