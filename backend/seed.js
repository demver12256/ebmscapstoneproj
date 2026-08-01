const {
  connectDatabase,
  sequelize,
  User,
  Barangay,
  Beneficiary,
  BenefitProgram,
  Enrollment,
  DistributionEvent,
  DistributionTransaction,
  Attendance,
  SMSNotification,
} = require('./db');

const { Op } = require('sequelize');
const programsData = require('./programs-data');

// ── Helper utilities ──────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const padId = (n) => String(n).padStart(4, '0');

const firstNames = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Carlos', 'Elena',
  'Miguel', 'Sofia', 'Antonio', 'Carmen', 'Ricardo', 'Teresa', 'Fernando',
  'Isabel', 'Eduardo', 'Lucia', 'Roberto', 'Patricia', 'Ramon', 'Gloria',
  'Alejandro', 'Margarita', 'Francisco', 'Dolores', 'Manuel', 'Consuelo',
  'Gabriel', 'Esperanza', 'Luis', 'Amelia', 'Andres', 'Josefa', 'Rafael',
  'Pilar', 'Enrique', 'Rosario', 'Joaquin', 'Mercedes', 'Daniel', 'Beatriz',
  'Arturo', 'Lourdes', 'Victor', 'Remedios', 'Alfredo', 'Cecilia',
  'Sergio', 'Felisa',
];

const lastNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Cruz', 'Bautista', 'Gonzales',
  'Lopez', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Aquino',
  'Castro', 'Rivera', 'Fernandez', 'Villanueva', 'Hernandez', 'Perez',
  'Martinez', 'Flores', 'De Leon', 'Pascual', 'Jimenez', 'Santiago',
  'Domingo', 'Salazar', 'Dizon', 'Morales', 'Magno', 'David',
  'Aguilar', 'Navarro', 'Mercado', 'Gutierrez', 'Soriano', 'Valdez',
  'Ponce', 'Manalo', 'Luna', 'Angeles', 'Dimaculangan', 'Cayetano',
  'Padilla', 'Lagman', 'Marquez', 'Corpuz', 'Ocampo', 'Enriquez',
  'Rosales', 'Tolentino',
];

const middleNames = [
  'Agoncillo', 'Buenaventura', 'Cayabyab', 'Dalisay', 'Espiritu',
  'Fajardo', 'Galang', 'Hipolito', 'Ilagan', 'Jardeleza',
];

const barangayNames = [
  'Anilao', 'Aplaya', 'Bagong Bayan I', 'Bagong Bayan II', 'Batangan',
  'Bukal', 'Camantigue', 'Carmundo', 'Cawayan', 'Dayhagan',
  'Formon', 'Hagan', 'Hagupit', 'Ipil', 'Kaligtasan',
  'Labasan', 'Labonan', 'Libertad', 'Lisap', 'Luna',
  'Malitbog', 'Mapang', 'Masaguisi', 'Mina de Oro', 'Morente',
  'Ogbot', 'Orconuma', 'Poblacion', 'Pulosahi', 'Sagana',
  'San Isidro', 'San Jose', 'San Juan', 'Sta. Cruz', 'Sigange',
  'Tawas'
];

const captainNames = [
  'Kap. Roberto Santos', 'Kap. Maria Cruz', 'Kap. Jose Reyes',
  'Kap. Ana Gonzales', 'Kap. Pedro Lopez', 'Kap. Rosa Garcia',
  'Kap. Carlos Mendoza', 'Kap. Elena Torres', 'Kap. Miguel Ramos',
  'Kap. Sofia Aquino', 'Kap. Antonio Castro', 'Kap. Carmen Rivera',
  'Kap. Ricardo Fernandez', 'Kap. Teresa Villanueva', 'Kap. Fernando Hernandez',
  'Kap. Isabel Perez', 'Kap. Eduardo Martinez', 'Kap. Lucia Flores',
  'Kap. Roberto De Leon', 'Kap. Patricia Pascual', 'Kap. Ramon Jimenez',
  'Kap. Gloria Santiago', 'Kap. Alejandro Domingo', 'Kap. Margarita Salazar',
  'Kap. Francisco Dizon', 'Kap. Dolores Morales', 'Kap. Manuel Magno',
  'Kap. Consuelo David', 'Kap. Gabriel Aguilar', 'Kap. Esperanza Navarro',
  'Kap. Luis Mercado', 'Kap. Amelia Gutierrez', 'Kap. Andres Soriano',
  'Kap. Josefa Valdez', 'Kap. Rafael Ponce', 'Kap. Pilar Manalo',
  'Kap. Enrique Luna', 'Kap. Rosario Angeles', 'Kap. Joaquin Dimaculangan',
  'Kap. Mercedes Cayetano', 'Kap. Daniel Padilla', 'Kap. Beatriz Lagman',
  'Kap. Arturo Marquez', 'Kap. Lourdes Corpuz', 'Kap. Victor Ocampo',
  'Kap. Remedios Enriquez', 'Kap. Alfredo Rosales', 'Kap. Cecilia Tolentino',
  'Kap. Sergio Buenaventura', 'Kap. Felisa Galang',
];

const programNames = [
  '4Ps – Pantawid Pamilyang Pilipino Program', 'AICS – Assistance to Individuals in Crisis',
  'KALAHI-CIDSS', 'Sustainable Livelihood Program', 'Supplemental Feeding Program',
  'Social Pension for Indigent Senior Citizens', 'DSWD Educational Assistance',
  'Emergency Shelter Assistance', 'Modified Conditional Cash Transfer',
  'Recovery and Reintegration Program', 'Disaster Response Fund',
  'Centenarian Cash Gift', 'PhilHealth Subsidy for Indigents',
  'Rice Subsidy Program', 'Scholarship Grant Fund',
  'Medical Assistance – Indigent', 'Burial Assistance Program',
  'Transportation Subsidy for PWDs', 'Women Welfare Program',
  'Youth Development Program', 'Barangay Health Workers Incentive',
  'Agricultural Livelihood Fund', 'Skills Training Program',
  'Micro-Enterprise Development', 'Food Stamp Program',
  'Calamity Assistance Fund', 'Community-Based Rehabilitation',
  'Child Development Workers Fund', 'Out-of-School Youth Program',
  'Solo Parent Cash Assistance', 'Persons with Disability Assistance',
  'Senior Citizen Aid Package', 'Street Children Rescue Program',
  'Displaced Workers Fund', 'Housing Resettlement Aid',
  'Anti-Trafficking Assistance', 'Mental Health Support Program',
  'Clean Water Access Program', 'Hygiene and Sanitation Fund',
  'Barangay Nutrition Program', 'Day Care Workers Support',
  'Gender and Development Fund', 'Technology Access Program',
  'Sports Development Grant', 'Cultural Preservation Fund',
  'Environmental Protection Aid', 'Cooperative Development Grant',
  'Fishermen Livelihood Fund', 'Farmers Cash Assistance',
  'Pandemic Response Fund',
];

const eventNames = [
  'Rice Distribution', 'Cash Aid Distribution', 'Medical Mission',
  'Feeding Program', 'Skills Training Workshop', 'Livelihood Seminar',
  'Health Check-up Day', 'Scholarship Orientation', 'Community Assembly',
  'Disaster Preparedness Drill', 'Hygiene Kit Distribution', 'Tree Planting Activity',
  'Blood Donation Drive', 'Senior Citizens Day', 'Youth Camp',
];

const civilStatuses = ['Single', 'Married', 'Widowed', 'Separated'];
const categories = ['4Ps Household Beneficiaries', 'Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)'];
const programStatuses = ['draft', 'active', 'completed', 'archived'];
const enrollmentStatuses = ['pending', 'active', 'completed', 'cancelled'];
const distStatuses = ['pending', 'completed', 'failed'];

function randomDate(startYear, endYear) {
  const y = rand(startYear, endYear);
  const m = rand(1, 12);
  const d = rand(1, 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function randomPhone() {
  return `09${rand(10, 99)}${rand(100, 999)}${rand(1000, 9999)}`;
}

// ── Main seeder ───────────────────────────────────────────────────────────────
async function seedDatabase() {
  console.log('🌱 Starting database seed...');

  // Make sure we have a user to assign beneficiaries to
  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) {
    admin = await User.create({
      first_name: 'System',
      last_name: 'Administrator',
      email: 'admin@ebms.local',
      password: 'Admin@123',
      role: 'admin',
      status: 'active'
    });
    console.log('  👑 Created default admin user for seeding.');
  }
  const adminId = admin.id;

  // ── 1. Clean existing data (order matters due to FK constraints) ──────────
  console.log('  🗑️  Clearing existing seed data...');
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await Attendance.destroy({ where: {}, force: true });
  await SMSNotification.destroy({ where: {}, force: true });
  await DistributionTransaction.destroy({ where: {}, force: true });
  await DistributionEvent.destroy({ where: {}, force: true });
  await Enrollment.destroy({ where: {}, force: true });
  await Beneficiary.destroy({ where: {}, force: true });
  await User.destroy({ where: { role: { [Op.ne]: 'admin' } }, force: true });
  await BenefitProgram.destroy({ where: {}, force: true });
  await Barangay.destroy({ where: {}, force: true });
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  // ── 2. Seed Barangays ──────────────────────────────────────────────────
  console.log(`  📍 Seeding ${barangayNames.length} barangays...`);
  const barangayRecords = [];
  for (let i = 0; i < barangayNames.length; i++) {
    barangayRecords.push({
      barangay_name: barangayNames[i],
      barangay_code: `BRG-${padId(i + 1)}`,
      captain_name: captainNames[i % captainNames.length],
      contact_number: randomPhone(),
    });
  }
  const barangays = await Barangay.bulkCreate(barangayRecords);

  // ── 3. Seed Comprehensive Benefit Programs ───────────────────────────────
  console.log(`  📋 Seeding ${programsData.length} comprehensive programs (assigned to barangays)...`);
  const programRecords = [];
  for (let pi = 0; pi < programsData.length; pi++) {
    const program = programsData[pi];
    const startDate = randomDate(2024, 2025);
    const endDate = randomDate(2026, 2027);
    programRecords.push({
      name: program.name,
      description: program.description,
      total_budget: rand(100000, 10000000),
      allocated_budget: rand(50000, 5000000),
      start_date: startDate,
      end_date: endDate,
      status: pick(programStatuses),
      barangay_id: barangays[pi % barangays.length].id,
    });
  }
  const programs = await BenefitProgram.bulkCreate(programRecords);

  // ── 4. Seed 50 Beneficiaries ──────────────────────────────────────────────
  console.log('  👤 Seeding 50 beneficiaries...');
  const beneficiaryRecords = [];
  const beneficiaryUsers = [];

  // First create user accounts for each beneficiary
  for (let i = 0; i < 50; i++) {
    const sex = pick(['Male', 'Female']);
    const firstName = firstNames[i];
    const lastName = lastNames[i];

    // Create a unique user account for each beneficiary
    const beneficiaryUser = await User.create({
      first_name: firstName,
      last_name: lastName,
      email: `beneficiary${i + 1}@ebms.local`,
      password: 'Beneficiary@123',
      role: 'beneficiary',
      status: 'active',
      barangay_id: barangays[i % barangays.length].id,
      contact_number: randomPhone()
    });
    beneficiaryUsers.push(beneficiaryUser);

    beneficiaryRecords.push({
      user_id: beneficiaryUser.id,
      first_name: firstName,
      last_name: lastName,
      middle_name: pick(middleNames),
      sex,
      birthdate: randomDate(1950, 2005),
      civil_status: pick(civilStatuses),
      address: `Purok ${rand(1, 12)}, ${barangayNames[i % barangayNames.length]}, Municipality`,
      barangay_id: barangays[i % barangays.length].id,
      category: pick(categories),
      ip_classification: pick(['IP', 'Non-IP']),
      RFID_number: `RFID-${padId(i + 1)}`,
      contact_number: randomPhone(),
      status: 'Approved',
      beneficiary_id_code: `BEN-2026-${padId(i + 1)}`,
      national_id_number: `NAT-ID-${padId(i + 1)}`,
      psa_birth_cert_number: `PSA-ID-${padId(i + 1)}`,
      approval_date: randomDate(2025, 2026),
      approving_staff_id: adminId,
      sitio: `Purok ${rand(1, 12)}`
    });
  }
  const beneficiaries = await Beneficiary.bulkCreate(beneficiaryRecords);

  // ── 5. Seed 50 Enrollments ────────────────────────────────────────────────
  console.log('  📝 Seeding 50 enrollments...');
  const enrollmentRecords = [];
  for (let i = 0; i < 50; i++) {
    enrollmentRecords.push({
      beneficiary_id: beneficiaries[i % 50].id,
      program_id: programs[i % programs.length].id,
      enrollment_date: randomDate(2024, 2026),
      status: pick(enrollmentStatuses),
    });
  }
  const enrollments = await Enrollment.bulkCreate(enrollmentRecords);

  // ── 6. Seed Distribution Events and Transactions ────────────
  console.log('  💰 Seeding distribution events and transactions...');
  const distributionEvents = [];
  for (let i = 0; i < programs.length; i++) {
    const brg = barangays[i % barangays.length];
    const program = programs[i];
    distributionEvents.push({
      title: `${program.name} Distribution - ${brg.barangay_name}`,
      program_id: program.id,
      barangay_id: brg.id,
      distribution_date: randomDate(2025, 2026),
      venue: `${brg.barangay_name} Barangay Hall`,
      budget: rand(50000, 200000),
      amount_per_beneficiary: rand(1000, 5000),
      assigned_staff_id: adminId,
      status: pick(['completed', 'ongoing', 'scheduled']),
      total_beneficiaries: 10,
      total_released: 8,
      total_amount_released: rand(8000, 40000),
    });
  }
  const events = await DistributionEvent.bulkCreate(distributionEvents);

  const distributionTransactions = [];
  for (let i = 0; i < 50; i++) {
    const month = (i % 12) + 1;
    const year = pick([2025, 2026]);
    const day = rand(1, 28);
    const event = events[i % events.length];
    const beneficiary = beneficiaries[i % beneficiaries.length];
    distributionTransactions.push({
      transaction_number: `TXN-${year}${String(month).padStart(2, '0')}-${padId(event.id)}-${padId(i + 1)}`,
      distribution_event_id: event.id,
      beneficiary_id: beneficiary.id,
      amount: event.amount_per_beneficiary || 1500,
      status: pick(['released', 'pending', 'released', 'released']),
      released_at: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 10:00:00`,
      released_by_staff_id: adminId,
      verification_method: pick(['rfid', 'qr', 'id', 'manual']),
    });
  }
  await DistributionTransaction.bulkCreate(distributionTransactions);

  // ── 7. Seed 50 Attendance records ─────────────────────────────────────────
  console.log('  📋 Seeding 50 attendance records...');
  const attendanceRecords = [];
  for (let i = 0; i < 50; i++) {
    const hour = rand(6, 16);
    const min = rand(0, 59);
    attendanceRecords.push({
      beneficiary_id: beneficiaries[i % 50].id,
      RFID_number: `RFID-${padId((i % 50) + 1)}`,
      event_name: pick(eventNames),
      attendance_date: randomDate(2025, 2026),
      time_in: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`,
      remarks: pick(['Present', 'Late arrival', 'On time', 'Early', null]),
    });
  }
  await Attendance.bulkCreate(attendanceRecords);

  // ── 8. Seed Default Staff & Beneficiary Accounts ─────────────────────────
  console.log('  🔑 Seeding default test accounts (staff@ebms.local & beneficiary@ebms.local)...');
  await User.findOrCreate({
    where: { email: 'staff@ebms.local' },
    defaults: {
      first_name: 'Barangay',
      last_name: 'Staff',
      email: 'staff@ebms.local',
      password: 'Staff@123',
      role: 'staff',
      barangay_id: barangays[0].id,
      status: 'active',
    },
  });

  await User.findOrCreate({
    where: { email: 'beneficiary@ebms.local' },
    defaults: {
      first_name: 'Sample',
      last_name: 'Beneficiary',
      email: 'beneficiary@ebms.local',
      password: 'Beneficiary@123',
      role: 'beneficiary',
      barangay_id: barangays[0].id,
      status: 'active',
    },
  });

  console.log('✅ Database seeded successfully!');
  return {
    barangays: barangayNames.length,
    programs: programsData.length,
    beneficiaries: 50,
    enrollments: 50,
    distributions: 50,
    attendance: 50,
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  connectDatabase()
    .then(() => seedDatabase())
    .then((result) => {
      console.log('Seed result:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
