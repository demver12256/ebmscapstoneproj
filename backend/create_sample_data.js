require('dotenv').config();
const { sequelize, Beneficiary, BenefitProgram, DistributionEvent, DistributionTransaction, Barangay, Enrollment, User } = require('./db');

async function createSampleData() {
  try {
    console.log('🚀 Starting sample data creation...');

    // Get existing barangays and admin user
    const barangays = await Barangay.findAll();
    if (barangays.length === 0) {
      console.error('❌ No barangays found. Please seed barangays first.');
      return;
    }

    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      console.error('❌ No admin user found.');
      return;
    }

    console.log(`✅ Found ${barangays.length} barangays`);

    // ═══════════════════════════════════════════════════════════
    // 1. CREATE PROGRAMS (10 programs across different categories)
    // ═══════════════════════════════════════════════════════════
    console.log('\n📋 Creating 10 sample programs...');
    
    const programsData = [
      {
        name: 'Regular Cash Grant',
        description: 'Regular monthly cash assistance for qualified 4Ps households',
        eligibility_category: '4Ps Household Beneficiaries',
        barangay_id: barangays[0].id,
        total_budget: 500000,
        allocated_budget: 450000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Education Grant',
        description: 'Educational assistance for children of 4Ps beneficiaries',
        eligibility_category: '4Ps Household Beneficiaries',
        barangay_id: barangays[1 % barangays.length].id,
        total_budget: 300000,
        allocated_budget: 250000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Health Grant',
        description: 'Health-related assistance and medical support',
        eligibility_category: '4Ps Household Beneficiaries',
        barangay_id: barangays[2 % barangays.length].id,
        total_budget: 200000,
        allocated_budget: 180000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Social Pension for Indigent Senior Citizens (SocPen)',
        description: 'Monthly social pension for indigent senior citizens aged 60 and above',
        eligibility_category: 'Senior Citizens (Social Pension)',
        barangay_id: barangays[0].id,
        total_budget: 600000,
        allocated_budget: 550000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Medical Assistance',
        description: 'Healthcare support and medical services',
        eligibility_category: 'Senior Citizens (Social Pension)',
        barangay_id: barangays[1 % barangays.length].id,
        total_budget: 250000,
        allocated_budget: 200000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'PWD ID Registration and Renewal',
        description: 'Registration and renewal of PWD identification cards',
        eligibility_category: 'Persons with Disabilities (PWD)',
        barangay_id: barangays[2 % barangays.length].id,
        total_budget: 150000,
        allocated_budget: 120000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Assistive Devices Distribution',
        description: 'Distribution of assistive devices (wheelchairs, canes, hearing aids, crutches, etc.)',
        eligibility_category: 'Persons with Disabilities (PWD)',
        barangay_id: barangays[0].id,
        total_budget: 400000,
        allocated_budget: 350000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Livelihood Assistance',
        description: 'Income-generating livelihood programs for PWD',
        eligibility_category: 'Persons with Disabilities (PWD)',
        barangay_id: barangays[1 % barangays.length].id,
        total_budget: 300000,
        allocated_budget: 250000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'Disaster Relief Assistance',
        description: 'Emergency assistance during disasters and calamities',
        eligibility_category: '4Ps Household Beneficiaries',
        barangay_id: barangays[2 % barangays.length].id,
        total_budget: 500000,
        allocated_budget: 400000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      },
      {
        name: 'AICS (Assistance to Individuals in Crisis Situation)',
        description: 'Emergency assistance for individuals in crisis situations',
        eligibility_category: 'Senior Citizens (Social Pension)',
        barangay_id: barangays[0].id,
        total_budget: 350000,
        allocated_budget: 300000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active'
      }
    ];

    const programs = [];
    for (const programData of programsData) {
      const [program] = await BenefitProgram.findOrCreate({
        where: { name: programData.name, barangay_id: programData.barangay_id },
        defaults: programData
      });
      programs.push(program);
      console.log(`  ✓ ${program.name}`);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. CREATE BENEFICIARIES (30 beneficiaries)
    // ═══════════════════════════════════════════════════════════
    console.log('\n👥 Creating 30 sample beneficiaries...');

    const categories = [
      '4Ps Household Beneficiaries',
      'Senior Citizens (Social Pension)',
      'Persons with Disabilities (PWD)'
    ];

    const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Rosa', 'Carlos', 'Lucia', 'Miguel', 'Carmen'];
    const lastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Martinez', 'Lopez', 'Gonzales', 'Rodriguez', 'Fernandez', 'Ramos'];

    // Get current timestamp for unique IDs
    const timestamp = Date.now();
    
    const beneficiaries = [];
    for (let i = 0; i < 30; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const category = categories[i % categories.length];
      const barangay = barangays[i % barangays.length];
      const sex = i % 2 === 0 ? 'Male' : 'Female';
      const uniqueEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${timestamp}.${i}@example.com`;

      // Create user account first
      const [user] = await User.findOrCreate({
        where: { email: uniqueEmail },
        defaults: {
          first_name: firstName,
          last_name: lastName,
          email: uniqueEmail,
          password: 'Password123',
          role: 'beneficiary',
          status: 'active',
          barangay_id: barangay.id
        }
      });

      // Create beneficiary linked to user
      const uniqueBenId = `BEN-${timestamp}-${String(i + 1).padStart(4, '0')}`;
      const uniqueRFID = `RFID${timestamp}${String(i).padStart(4, '0')}`;
      
      const [beneficiary] = await Beneficiary.findOrCreate({
        where: { beneficiary_id_code: uniqueBenId },
        defaults: {
          user_id: user.id,
          first_name: firstName,
          middle_name: 'M',
          last_name: lastName,
          sex: sex,
          birthdate: new Date(1950 + (i % 50), (i % 12), (i % 28) + 1),
          civil_status: ['Single', 'Married', 'Widowed'][i % 3],
          contact_number: `09${String(100000000 + timestamp % 100000000 + i).substring(0, 9)}`,
          address: `#${i + 1} Purok ${(i % 5) + 1}, ${barangay.barangay_name}`,
          barangay_id: barangay.id,
          category: category,
          status: 'Approved',
          beneficiary_id_code: uniqueBenId,
          RFID_number: uniqueRFID,
          ip_classification: 'Non-IP',
          approval_date: new Date(2026, 0, (i % 28) + 1)
        }
      });
      beneficiaries.push(beneficiary);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ Created ${i + 1} beneficiaries...`);
      }
    }
    console.log(`  ✓ Total: ${beneficiaries.length} beneficiaries created`);

    // ═══════════════════════════════════════════════════════════
    // 3. ENROLL BENEFICIARIES TO PROGRAMS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📝 Enrolling beneficiaries to programs...');

    let enrollmentCount = 0;
    for (const beneficiary of beneficiaries) {
      // Find matching programs for this beneficiary's category
      const matchingPrograms = programs.filter(p => 
        p.eligibility_category === beneficiary.category
      );

      // Enroll in ALL matching programs (not just 1-3)
      for (const program of matchingPrograms) {
        const [enrollment, created] = await Enrollment.findOrCreate({
          where: {
            beneficiary_id: beneficiary.id,
            program_id: program.id
          },
          defaults: {
            beneficiary_id: beneficiary.id,
            program_id: program.id,
            enrollment_date: new Date(2026, 0, Math.floor(Math.random() * 30) + 1),
            status: 'active'
          }
        });
        if (created) enrollmentCount++;
      }
    }
    console.log(`  ✓ Created ${enrollmentCount} enrollments`);

    // ═══════════════════════════════════════════════════════════
    // 4. CREATE DISTRIBUTION EVENTS (10 events)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🎯 Creating 10 distribution events...');

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const statuses = ['completed', 'completed', 'completed', 'ongoing', 'scheduled', 'scheduled', 'completed', 'completed', 'scheduled', 'completed'];

    const events = [];
    for (let i = 0; i < 10; i++) {
      const program = programs[i % programs.length];
      const month = i % 10;
      const day = (i % 28) + 1;
      
      const event = await DistributionEvent.create({
        title: `${program.name} - ${months[month]} 2026`,
        program_id: program.id,
        barangay_id: program.barangay_id,
        distribution_date: new Date(2026, month, day),
        venue: `${barangays[program.barangay_id - 1]?.barangay_name || 'Barangay'} Hall`,
        budget: (i + 1) * 50000,
        amount_per_beneficiary: 3000 + (i * 500),
        assigned_staff_id: admin.id,
        status: statuses[i],
        total_beneficiaries: Math.floor(Math.random() * 20) + 10,
        total_released: statuses[i] === 'completed' ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 5),
        total_amount_released: statuses[i] === 'completed' ? ((Math.floor(Math.random() * 20) + 10) * (3000 + (i * 500))) : ((Math.floor(Math.random() * 5)) * (3000 + (i * 500))),
        notes: `Distribution event for ${program.name}`,
        published_at: new Date(2026, month, day - 7),
        started_at: statuses[i] !== 'scheduled' ? new Date(2026, month, day) : null,
        completed_at: statuses[i] === 'completed' ? new Date(2026, month, day, 17, 0) : null
      });
      events.push(event);
      console.log(`  ✓ ${event.title} - ${event.status}`);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. CREATE DISTRIBUTION TRANSACTIONS
    // ═══════════════════════════════════════════════════════════
    console.log('\n💰 Creating distribution transactions...');

    let transactionCount = 0;
    for (const event of events) {
      // Get enrolled beneficiaries for this program
      const enrollments = await Enrollment.findAll({
        where: { program_id: event.program_id, status: 'active' },
        include: [{ model: Beneficiary, as: 'Beneficiary' }]
      });

      // Create transactions for ALL enrolled beneficiaries
      const numTransactions = Math.min(enrollments.length, event.total_beneficiaries);
      
      for (let i = 0; i < numTransactions; i++) {
        const enrollment = enrollments[i];
        const shouldRelease = i < event.total_released;
        
        const [transaction, created] = await DistributionTransaction.findOrCreate({
          where: {
            transaction_number: `TXN-${event.id}-${String(i + 1).padStart(4, '0')}`
          },
          defaults: {
            transaction_number: `TXN-${event.id}-${String(i + 1).padStart(4, '0')}`,
            distribution_event_id: event.id,
            beneficiary_id: enrollment.beneficiary_id,
            amount: event.amount_per_beneficiary,
            status: shouldRelease ? 'released' : 'pending',
            released_at: shouldRelease ? event.distribution_date : null,
            released_by_staff_id: shouldRelease ? admin.id : null,
            verification_method: shouldRelease ? ['rfid', 'qr', 'id'][i % 3] : null,
            notes: shouldRelease ? 'Successfully released' : 'Pending release'
          }
        });
        if (created) transactionCount++;
      }
      
      console.log(`  ✓ Event ${event.id}: ${numTransactions} transactions`);
    }
    console.log(`  ✓ Total transactions: ${transactionCount}`);

    // ═══════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ SAMPLE DATA CREATION COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📋 Programs: ${programs.length}`);
    console.log(`👥 Beneficiaries: ${beneficiaries.length}`);
    console.log(`📝 Enrollments: ${enrollmentCount}`);
    console.log(`🎯 Distribution Events: ${events.length}`);
    console.log(`💰 Transactions: ${transactionCount}`);
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  }
}

// Run the script
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    await createSampleData();
    
    console.log('🎉 All done!');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
