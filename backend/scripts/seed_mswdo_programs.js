const { BenefitProgram, Beneficiary, Enrollment, Barangay, DistributionEvent, DistributionTransaction, User } = require('../db');
const { isNonCashProgram, getNonCashDetails } = require('../utils/nonCashPrograms');

async function seedMswdoPrograms() {
  console.log('--- Starting MSWDO Programs & Distribution Flow Seeding ---');

  // 1. Verify MSWDO Admin user
  let mswdoUser = await User.findOne({ where: { role: 'mswdo_admin' } });
  if (!mswdoUser) {
    console.log('MSWDO admin user not found, checking ID 4217...');
    mswdoUser = await User.findByPk(4217);
  }
  if (!mswdoUser) {
    throw new Error('MSWDO Admin user could not be found');
  }
  console.log(`MSWDO Admin found: ID ${mswdoUser.id} (${mswdoUser.email})`);

  // Target barangays with approved beneficiaries: Anilao (37) and Aplaya (38)
  const targetBarangays = [
    { id: 37, name: 'Anilao', codePrefix: 'ANL' },
    { id: 38, name: 'Aplaya', codePrefix: 'APL' }
  ];

  const programTemplates = [
    {
      name: 'MSWDO Local Senior Citizen Financial Allowance',
      description: 'Lokal na tulong pinansyal at regular na dagdag pensyon mula sa 1% LGU Senior budget para sa mga kwalipikadong nakatatanda.',
      eligibility_category: 'Senior Citizens (Social Pension)',
      benefit_type: 'Cash',
      total_budget: 150000.00,
      allocated_budget: 1500.00,
      codeSuffix: 'SOCPEN',
    },
    {
      name: 'MSWDO Senior Maintenance Medicine & Health Subsidy',
      description: 'Libreng buwanang maintenance medicines (hypertension, diabetes), bitamina, at geriatric vaccines katuwang ang Municipal Health Office.',
      eligibility_category: 'Senior Citizens (Social Pension)',
      benefit_type: 'In-Kind',
      total_budget: 100000.00,
      allocated_budget: 0.00,
      codeSuffix: 'MEDS',
    },
    {
      name: 'OSCA Free Assistive Mobility Devices (Wheelchairs & Canes)',
      description: 'Libreng pamamahagi ng mobility devices tulad ng wheelchairs, walking canes, at quad canes para sa mga senior citizens.',
      eligibility_category: 'Senior Citizens (Social Pension)',
      benefit_type: 'In-Kind',
      total_budget: 80000.00,
      allocated_budget: 0.00,
      codeSuffix: 'DEVICES',
    },
    {
      name: 'MSWDO Local PWD Monthly Financial Allowance',
      description: 'Buwanang tulong pinansyal mula sa 1% LGU budget para sa mga kwalipikadong indigent na may kapansanan upang maibsan ang gastusin sa araw-araw.',
      eligibility_category: 'Persons with Disabilities (PWD)',
      benefit_type: 'Cash',
      total_budget: 120000.00,
      allocated_budget: 1000.00,
      codeSuffix: 'PWD-CASH',
    },
    {
      name: 'PWD Inclusive Skills & Vocational Training Program',
      description: 'Libreng vocational skills training, livelihood starter kits, at TESDA accreditation facilitation para sa mga PWDs.',
      eligibility_category: 'Persons with Disabilities (PWD)',
      benefit_type: 'Service',
      total_budget: 75000.00,
      allocated_budget: 0.00,
      codeSuffix: 'PWD-SKILLS',
    },
    {
      name: 'PDAO / PWD ID & Purchase Booklet Issuance',
      description: 'Opisyal na pagpaparehistro ng PWD, pag-isyu ng RFID/digital ID, at purchase booklets para sa 20% discount at VAT exemption.',
      eligibility_category: 'Persons with Disabilities (PWD)',
      benefit_type: 'Service',
      total_budget: 40000.00,
      allocated_budget: 0.00,
      codeSuffix: 'PWD-ID',
    },
  ];

  const createdPrograms = [];

  for (const brgy of targetBarangays) {
    for (const tpl of programTemplates) {
      const code = `MSW-${brgy.codePrefix}-${tpl.codeSuffix}`;
      let prog = await BenefitProgram.findOne({ where: { code } });
      if (!prog) {
        prog = await BenefitProgram.create({
          name: tpl.name,
          code,
          description: tpl.description,
          eligibility_category: tpl.eligibility_category,
          benefit_type: tpl.benefit_type,
          status: 'active',
          total_budget: tpl.total_budget,
          allocated_budget: tpl.allocated_budget,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          barangay_id: brgy.id,
          agency: 'MSWDO',
          created_by: mswdoUser.id,
        });
        console.log(`Created MSWDO Program: [${code}] ${tpl.name} for Barangay ${brgy.name}`);
      } else {
        await prog.update({
          agency: 'MSWDO',
          created_by: mswdoUser.id,
          status: 'active',
          benefit_type: tpl.benefit_type,
        });
        console.log(`Updated existing MSWDO Program: [${code}] ${tpl.name}`);
      }
      createdPrograms.push(prog);
    }
  }

  // 2. Auto-Enroll eligible approved beneficiaries into their matching programs
  console.log('\n--- Enrolling Beneficiaries into MSWDO Programs ---');
  const allBeneficiaries = await Beneficiary.findAll({
    where: { status: 'Approved' },
  });

  let enrollmentCount = 0;
  for (const ben of allBeneficiaries) {
    const isSenior = ben.category && ben.category.toLowerCase().includes('senior');
    const isPwd = ben.category && (ben.category.toLowerCase().includes('pwd') || ben.category.toLowerCase().includes('disabilit'));

    // Find programs matching beneficiary barangay and category
    const eligiblePrograms = createdPrograms.filter(p => {
      if (p.barangay_id !== ben.barangay_id) return false;
      if (isSenior && p.eligibility_category.toLowerCase().includes('senior')) return true;
      if (isPwd && p.eligibility_category.toLowerCase().includes('pwd')) return true;
      return false;
    });

    for (const prog of eligiblePrograms) {
      const existing = await Enrollment.findOne({
        where: { program_id: prog.id, beneficiary_id: ben.id },
      });
      if (!existing) {
        await Enrollment.create({
          program_id: prog.id,
          beneficiary_id: ben.id,
          enrollment_date: '2026-01-15',
          status: 'active',
        });
        console.log(`Enrolled ${ben.first_name} ${ben.last_name} (${ben.category}) into [${prog.code}] ${prog.name}`);
        enrollmentCount++;
      }
    }
  }
  console.log(`Total new enrollments created: ${enrollmentCount}`);

  // 3. Create sample MSWDO Distribution Events to establish the full distribution flow
  console.log('\n--- Creating Sample MSWDO Distribution Events ---');

  // Find Senior Cash Program in Anilao (37)
  const seniorCashProg = createdPrograms.find(p => p.barangay_id === 37 && p.code === 'MSW-ANL-SOCPEN');
  // Find Senior In-Kind Medicine Program in Anilao (37)
  const seniorMedsProg = createdPrograms.find(p => p.barangay_id === 37 && p.code === 'MSW-ANL-MEDS');
  // Find PWD Cash Program in Aplaya (38)
  const pwdCashProg = createdPrograms.find(p => p.barangay_id === 38 && p.code === 'MSW-APL-PWD-CASH');

  // Staff in Anilao (106) and Aplaya (108)
  const staffAnilao = 106;
  const staffAplaya = 108;

  // Event 1: Completed / Released Cash Distribution for Anilao Senior Citizens
  let dist1 = await DistributionEvent.findOne({ where: { title: 'MSWDO Q3 Senior Social Pension Payout - Anilao' } });
  if (!dist1 && seniorCashProg) {
    dist1 = await DistributionEvent.create({
      title: 'MSWDO Q3 Senior Social Pension Payout - Anilao',
      program_id: seniorCashProg.id,
      barangay_id: 37,
      distribution_date: '2026-09-06',
      venue: 'Anilao Barangay Multi-Purpose Hall',
      amount_per_beneficiary: 1500.00,
      budget: 1500.00,
      benefit_type: 'Cash',
      item_name: null,
      item_quantity: 1,
      item_unit: null,
      agency: 'MSWDO',
      created_by: mswdoUser.id,
      assigned_staff_id: staffAnilao,
      status: 'completed',
      total_beneficiaries: 1,
      total_released: 1,
      total_amount_released: 1500.00,
      published_at: new Date('2026-09-05T08:00:00Z'),
      started_at: new Date('2026-09-06T09:00:00Z'),
      completed_at: new Date('2026-09-06T12:00:00Z'),
      notes: 'Official MSWDO municipal social pension payout. 100% attendance released.',
    });

    // Find enrolled senior in Anilao (Silwen Galos)
    const silwen = await Beneficiary.findOne({ where: { first_name: 'Silwen', last_name: 'Galos' } });
    if (silwen) {
      await DistributionTransaction.create({
        distribution_event_id: dist1.id,
        beneficiary_id: silwen.id,
        transaction_number: `TXN-MSW-20260906-${dist1.id}-0001`,
        amount: 1500.00,
        retro_amount: 0.00,
        status: 'released',
        release_date: new Date('2026-09-06T09:30:00Z'),
        released_by: staffAnilao,
        release_notes: 'Claimed in person with Senior Citizen ID verification.',
        item_received: 'Cash Payout ₱1,500.00',
        item_quantity: 1,
      });
      console.log(`Created completed cash distribution & transaction for Silwen Galos in Event #${dist1.id}`);
    }
  }

  // Event 2: Scheduled In-Kind Medicine & Health Subsidy Distribution in Anilao
  let dist2 = await DistributionEvent.findOne({ where: { title: 'MSWDO Senior Maintenance Medicine Distribution - Anilao' } });
  if (!dist2 && seniorMedsProg) {
    dist2 = await DistributionEvent.create({
      title: 'MSWDO Senior Maintenance Medicine Distribution - Anilao',
      program_id: seniorMedsProg.id,
      barangay_id: 37,
      distribution_date: '2026-09-15',
      venue: 'Anilao Health Center & Gymnasium',
      amount_per_beneficiary: 0.00,
      budget: 0.00,
      benefit_type: 'In-Kind',
      item_name: 'Monthly Maintenance Medicine Package (Hypertension & Diabetes)',
      item_quantity: 1,
      item_unit: 'package',
      agency: 'MSWDO',
      created_by: mswdoUser.id,
      assigned_staff_id: staffAnilao,
      status: 'scheduled',
      total_beneficiaries: 1,
      total_released: 0,
      total_amount_released: 0.00,
      published_at: new Date('2026-09-06T14:00:00Z'),
      notes: 'Libreng maintenance medicines at blood pressure screening katuwang ang Municipal Health Office.',
    });

    const silwen = await Beneficiary.findOne({ where: { first_name: 'Silwen', last_name: 'Galos' } });
    if (silwen) {
      await DistributionTransaction.create({
        distribution_event_id: dist2.id,
        beneficiary_id: silwen.id,
        transaction_number: `TXN-MSW-20260915-${dist2.id}-0001`,
        amount: 0.00,
        retro_amount: 0.00,
        status: 'pending',
        item_received: 'Monthly Maintenance Medicine Package (Hypertension & Diabetes)',
        item_quantity: 1,
      });
      console.log(`Created scheduled in-kind distribution & pending transaction for Silwen Galos in Event #${dist2.id}`);
    }
  }

  // Event 3: Scheduled PWD Monthly Financial Allowance in Aplaya (38)
  let dist3 = await DistributionEvent.findOne({ where: { title: 'MSWDO Local PWD Monthly Allowance Payout - Aplaya' } });
  if (!dist3 && pwdCashProg) {
    dist3 = await DistributionEvent.create({
      title: 'MSWDO Local PWD Monthly Allowance Payout - Aplaya',
      program_id: pwdCashProg.id,
      barangay_id: 38,
      distribution_date: '2026-09-18',
      venue: 'Aplaya Barangay Covered Court',
      amount_per_beneficiary: 1000.00,
      budget: 1000.00,
      benefit_type: 'Cash',
      item_name: null,
      item_quantity: 1,
      item_unit: null,
      agency: 'MSWDO',
      created_by: mswdoUser.id,
      assigned_staff_id: staffAplaya,
      status: 'scheduled',
      total_beneficiaries: 1,
      total_released: 0,
      total_amount_released: 0.00,
      published_at: new Date('2026-09-06T15:00:00Z'),
      notes: '1% Municipal PWD budget financial allowance for indigent PWDs in Aplaya.',
    });

    const aizer = await Beneficiary.findOne({ where: { first_name: 'Aizer', last_name: 'Cuasay' } });
    if (aizer) {
      await DistributionTransaction.create({
        distribution_event_id: dist3.id,
        beneficiary_id: aizer.id,
        transaction_number: `TXN-MSW-20260918-${dist3.id}-0001`,
        amount: 1000.00,
        retro_amount: 0.00,
        status: 'pending',
        item_received: 'Cash Allowance ₱1,000.00',
        item_quantity: 1,
      });
      console.log(`Created scheduled PWD distribution & pending transaction for Aizer Cuasay in Event #${dist3.id}`);
    }
  }

  console.log('\n--- MSWDO Programs and Distributions Successfully Seeded! ---');
}

seedMswdoPrograms()
  .then(() => {
    console.log('Seeding script completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding script failed:', err);
    process.exit(1);
  });
