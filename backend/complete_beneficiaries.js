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

const ipCommunities = [
  'Tagbanwa', 'Batak', 'Pala\'wan', 'Molbog', 'Tau\'t Bato', 
  'Ati', 'Tumandok', 'Mangyan', 'Ifugao', 'Kalinga'
];

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

async function completeBeneficiaries() {
  try {
    console.log('🚀 Completing beneficiary creation...\n');

    const barangays = await Barangay.findAll({ order: [['barangay_name', 'ASC']] });
    console.log(`📍 Found ${barangays.length} barangays\n`);

    let totalCreated = 0;
    let globalCounter = await User.count(); // Start from existing count

    for (const barangay of barangays) {
      const currentCount = await Beneficiary.count({ where: { barangay_id: barangay.id } });
      
      if (currentCount >= 30) {
        console.log(`✅ ${barangay.barangay_name} - Already complete (${currentCount})`);
        continue;
      }
      
      console.log(`🏘️  Processing: ${barangay.barangay_name} (has ${currentCount}, need ${30 - currentCount} more)`);
      
      // Find the highest beneficiary count for this barangay
      const lastBeneficiary = await Beneficiary.findOne({
        where: { barangay_id: barangay.id },
        order: [['beneficiary_id_code', 'DESC']],
        attributes: ['beneficiary_id_code']
      });
      
      let barangayCount = 0;
      if (lastBeneficiary && lastBeneficiary.beneficiary_id_code) {
        // Extract the number from BEN-{code}-{number}
        const match = lastBeneficiary.beneficiary_id_code.match(/-(\d+)$/);
        if (match) {
          barangayCount = parseInt(match[1], 10);
        }
      }
      
      const needed = 30 - currentCount;
      
      // Distribute remaining across categories evenly
      const perCategory = Math.ceil(needed / 3);
      
      for (const category of categories) {
        const categoryCount = await Beneficiary.count({
          where: { 
            barangay_id: barangay.id,
            category: category.name
          }
        });
        
        if (categoryCount >= 10) continue;
        
        const categoryNeeded = Math.min(10 - categoryCount, perCategory);
        const ipNeeded = Math.min(5 - await Beneficiary.count({
          where: { barangay_id: barangay.id, category: category.name, ip_classification: 'IP' }
        }), Math.ceil(categoryNeeded / 2));
        const nonIpNeeded = categoryNeeded - ipNeeded;
        
        // Create Non-IP
        for (let i = 0; i < nonIpNeeded; i++) {
          barangayCount++;
          globalCounter++;
          const gender = Math.random() > 0.5 ? 'Male' : 'Female';
          const firstName = getRandomElement(firstNames[gender.toLowerCase()]);
          const lastName = getRandomElement(lastNames);
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}${globalCounter}@example.com`;

          const user = await User.create({
            email, password: await bcrypt.hash('password123', 10), role: 'beneficiary',
            first_name: firstName, last_name: lastName, barangay_id: barangay.id, is_active: true
          });

          await Beneficiary.create({
            user_id: user.id, barangay_id: barangay.id, first_name: firstName, last_name: lastName,
            middle_name: getRandomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'P', 'R', 'S', 'T']),
            birthdate: new Date(1950 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            sex: gender, civil_status: getRandomElement(['Single', 'Married', 'Widow', 'Separated']),
            contact_number: generateContactNumber(), address: `Purok ${Math.floor(Math.random() * 7) + 1}, ${barangay.barangay_name}`,
            category: category.name, ip_classification: 'Non-IP',
            beneficiary_id_code: generateBeneficiaryIdCode(barangay.barangay_code, barangayCount),
            RFID_number: generateRFID(), status: 'Approved',
            application_date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_at: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_by: 1
          });
          totalCreated++;
        }

        // Create IP
        for (let i = 0; i < ipNeeded; i++) {
          barangayCount++;
          globalCounter++;
          const gender = Math.random() > 0.5 ? 'Male' : 'Female';
          const firstName = getRandomElement(firstNames[gender.toLowerCase()]);
          const lastName = getRandomElement(ipLastNames);
          const ipCommunity = getRandomElement(ipCommunities);
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}${globalCounter}@example.com`;

          const user = await User.create({
            email, password: await bcrypt.hash('password123', 10), role: 'beneficiary',
            first_name: firstName, last_name: lastName, barangay_id: barangay.id, is_active: true
          });

          await Beneficiary.create({
            user_id: user.id, barangay_id: barangay.id, first_name: firstName, last_name: lastName,
            middle_name: getRandomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'P', 'R', 'S', 'T']),
            birthdate: new Date(1950 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            sex: gender, civil_status: getRandomElement(['Single', 'Married', 'Widow', 'Separated']),
            contact_number: generateContactNumber(), address: `Sitio ${getRandomElement(['Alagao', 'Bayabas', 'Bunga', 'Daan', 'Gubat'])}, ${barangay.barangay_name}`,
            category: category.name, ip_classification: 'IP', sitio: ipCommunity,
            beneficiary_id_code: generateBeneficiaryIdCode(barangay.barangay_code, barangayCount),
            RFID_number: generateRFID(), status: 'Approved',
            application_date: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_at: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            approved_by: 1
          });
          totalCreated++;
        }
      }

      console.log(`   ✅ Completed (created ${30 - currentCount} beneficiaries)`);
    }

    console.log(`\n\n🎉 SUCCESS! Created ${totalCreated} additional beneficiaries`);
    const finalCount = await Beneficiary.count();
    console.log(`📊 Total beneficiaries in database: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

completeBeneficiaries();
