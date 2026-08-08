require('dotenv').config();
const { Beneficiary, Barangay, User, sequelize } = require('./db');
const bcrypt = require('bcrypt');

// Sample Filipino names
const firstNames = {
  male: ['Juan', 'Pedro', 'Jose', 'Antonio', 'Miguel', 'Carlos', 'Ramon', 'Luis', 'Ricardo', 'Roberto', 'Manuel', 'Eduardo', 'Fernando', 'Francisco', 'Pablo'],
  female: ['Maria', 'Ana', 'Rosa', 'Carmen', 'Lucia', 'Elena', 'Isabel', 'Sofia', 'Teresa', 'Patricia', 'Angela', 'Cristina', 'Laura', 'Gloria', 'Diana']
};

const lastNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Ramos', 'Mendoza', 'Flores', 'Gonzales', 
  'Torres', 'Rivera', 'Lopez', 'Hernandez', 'Perez', 'Martinez', 'Rodriguez', 
  'Villanueva', 'Aquino', 'Bautista', 'Castro', 'Pascual', 'Marquez', 'Valdez',
  'Santiago', 'Navarro', 'Domingo', 'Soriano', 'Mercado', 'Dela Rosa', 'Castillo', 'Morales'
];

const ipLastNames = [
  'Macliing', 'Dulag', 'Lakandula', 'Magat', 'Magsaysay', 'Panganiban', 'Sampaguita',
  'Dagohoy', 'Sikatuna', 'Humabon', 'Lapu-Lapu', 'Rajah', 'Datu', 'Bagani', 'Unyol'
];

// Categories
const categories = [
  { name: '4Ps Household Beneficiary', type: '4ps' },
  { name: 'Senior Citizens (Social Pension)', type: 'senior' },
  { name: 'Persons with Disabilities (PWD)', type: 'pwd' }
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateBeneficiaryIdCode(barangayCode, count) {
  return `BEN-${barangayCode}-${String(count).padStart(4, '0')}`;
}

function generateRFID() {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}

function generateContactNumber() {
  const prefixes = ['0917', '0918', '0919', '0920', '0921', '0922', '0923', '0924', '0925', '0926', '0927', '0928', '0929', '0930'];
  const prefix = getRandomElement(prefixes);
  const suffix = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
  return prefix + suffix;
}

async function createBeneficiaries() {
  try {
    console.log('🚀 Starting beneficiary creation...\n');

    // Get all barangays
    const barangays = await Barangay.findAll();
    console.log(`📍 Found ${barangays.length} barangays\n`);

    let totalCreated = 0;

    for (const barangay of barangays) {
      console.log(`\n🏘️  Processing Barangay: ${barangay.barangay_name}`);
      
      let barangayCount = await Beneficiary.count({ where: { barangay_id: barangay.id } });

      // For each category (4Ps, Senior, PWD)
      for (const category of categories) {
        console.log(`\n  📋 Creating ${category.type.toUpperCase()} beneficiaries...`);

        // Create 5 Non-IP beneficiaries
        for (let i = 0; i < 5; i++) {
          barangayCount++;
          const gender = Math.random() > 0.5 ? 'Male' : 'Female';
          const firstName = getRandomElement(firstNames[gender.toLowerCase()]);
          const lastName = getRandomElement(lastNames);
          const timestamp = Date.now();
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}${barangayCount}${timestamp}@example.com`;

          // Create user account
          const user = await User.create({
            email: email,
            password: await bcrypt.hash('password123', 10),
            role: 'beneficiary',
            first_name: firstName,
            last_name: lastName,
            barangay_id: barangay.id,
            is_active: true
          });

          // Create beneficiary
          const beneficiary = await Beneficiary.create({
            user_id: user.id,
            barangay_id: barangay.id,
            first_name: firstName,
            last_name: lastName,
            middle_name: getRandomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'P', 'R', 'S', 'T']),
            birthdate: new Date(1950 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            sex: gender,
            civil_status: getRandomElement(['Single', 'Married', 'Widow', 'Separated']),
            contact_number: generateContactNumber(),
            address: `Purok ${Math.floor(Math.random() * 7) + 1}, ${barangay.barangay_name}`,
            category: category.name,
            ip_classification: 'Non-IP',
            beneficiary_id_code: generateBeneficiaryIdCode(barangay.barangay_code, barangayCount),
            RFID_number: generateRFID(),
            status: 'Approved',
            application_date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_at: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_by: 1
          });

          console.log(`    ✅ Non-IP: ${beneficiary.first_name} ${beneficiary.last_name} (${category.type})`);
          totalCreated++;
        }

        // Create 5 IP beneficiaries
        for (let i = 0; i < 5; i++) {
          barangayCount++;
          const gender = Math.random() > 0.5 ? 'Male' : 'Female';
          const firstName = getRandomElement(firstNames[gender.toLowerCase()]);
          const lastName = getRandomElement(ipLastNames);
          const ipCommunity = getRandomElement([
            'Tagbanwa', 'Batak', 'Pala\'wan', 'Molbog', 'Tau\'t Bato', 
            'Ati', 'Tumandok', 'Mangyan', 'Ifugao', 'Kalinga'
          ]);
          const timestamp = Date.now();
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}${barangayCount}${timestamp}@example.com`;

          // Create user account
          const user = await User.create({
            email: email,
            password: await bcrypt.hash('password123', 10),
            role: 'beneficiary',
            first_name: firstName,
            last_name: lastName,
            barangay_id: barangay.id,
            is_active: true
          });

          // Create beneficiary
          const beneficiary = await Beneficiary.create({
            user_id: user.id,
            barangay_id: barangay.id,
            first_name: firstName,
            last_name: lastName,
            middle_name: getRandomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'P', 'R', 'S', 'T']),
            birthdate: new Date(1950 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            sex: gender,
            civil_status: getRandomElement(['Single', 'Married', 'Widow', 'Separated']),
            contact_number: generateContactNumber(),
            address: `Sitio ${getRandomElement(['Alagao', 'Bayabas', 'Bunga', 'Daan', 'Gubat'])}, ${barangay.barangay_name}`,
            category: category.name,
            ip_classification: 'IP',
            sitio: ipCommunity,
            beneficiary_id_code: generateBeneficiaryIdCode(barangay.barangay_code, barangayCount),
            RFID_number: generateRFID(),
            status: 'Approved',
            application_date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_at: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_by: 1
          });

          console.log(`    ✅ IP (${ipCommunity}): ${beneficiary.first_name} ${beneficiary.last_name} (${category.type})`);
          totalCreated++;
        }
      }

      console.log(`\n  ✨ Created 30 beneficiaries for ${barangay.barangay_name} (10 per category: 5 IP + 5 Non-IP)`);
    }

    console.log(`\n\n🎉 SUCCESS! Created ${totalCreated} beneficiaries across all barangays`);
    console.log(`📊 Breakdown per barangay: 30 beneficiaries`);
    console.log(`   • 10 x 4Ps (5 IP + 5 Non-IP)`);
    console.log(`   • 10 x Senior Citizens (5 IP + 5 Non-IP)`);
    console.log(`   • 10 x PWD (5 IP + 5 Non-IP)`);
    console.log(`\n✅ All beneficiaries are auto-approved and ready for enrollment!`);

  } catch (error) {
    console.error('❌ Error creating beneficiaries:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the script
createBeneficiaries();
