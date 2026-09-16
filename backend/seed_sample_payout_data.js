const { sequelize, Beneficiary, DistributionEvent, DistributionTransaction, User, BenefitProgram, Barangay, Enrollment } = require('./db');
const bcrypt = require('bcrypt');

async function seedSampleData() {
  const transaction = await sequelize.transaction();
  try {
    console.log('Seeding 3 sample beneficiaries for Hybrid Payout Demonstration...');

    // 1. Get or pick Program and Barangay
    const program = await BenefitProgram.findOne({ order: [['id', 'ASC']] });
    const barangay = await Barangay.findOne({ order: [['id', 'ASC']] });

    if (!program || !barangay) {
      console.error('Program or Barangay not found!');
      await transaction.rollback();
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Helper: Find or create user + beneficiary
    async function createSampleBeneficiary({
      username,
      firstName,
      lastName,
      category,
      rfid,
      payoutPreference,
      payoutProvider,
      payoutAccountNo,
      payoutAccountName,
      verificationStatus,
      idCode
    }) {
      let user = await User.findOne({ where: { username } });
      if (!user) {
        user = await User.create({
          username,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          email: `${username}@sample.ph`,
          role: 'beneficiary',
          status: 'active',
          barangay_id: barangay.id
        }, { transaction });
      }

      let ben = await Beneficiary.findOne({ where: { user_id: user.id } });
      const benData = {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        middle_name: '',
        extension_name: '',
        birthdate: '1985-05-15',
        sex: 'Female',
        civil_status: 'Married',
        address: `Sitio Ilaya, ${barangay.barangay_name}`,
        barangay_id: barangay.id,
        contact_number: payoutAccountNo ? payoutAccountNo.replace(/[^0-9]/g, '') : '09170000000',
        category: category,
        RFID_number: rfid,
        beneficiary_id_code: idCode,
        payout_preference: payoutPreference,
        payout_provider: payoutProvider,
        payout_account_number: payoutAccountNo,
        payout_account_name: payoutAccountName,
        account_verification_status: verificationStatus,
        account_verified_at: verificationStatus === 'verified' ? new Date() : null
      };

      if (!ben) {
        ben = await Beneficiary.create(benData, { transaction });
      } else {
        await ben.update(benData, { transaction });
      }

      // Ensure enrolled in program
      await Enrollment.findOrCreate({
        where: {
          beneficiary_id: ben.id,
          program_id: program.id
        },
        defaults: {
          status: 'approved',
          enrollment_date: new Date()
        },
        transaction
      });

      return ben;
    }

    // ── SAMPLE 1: Maria Santos (Verified GCash) ──
    const ben1 = await createSampleBeneficiary({
      username: 'sample_maria',
      firstName: 'Maria',
      lastName: 'Santos',
      category: '4Ps Beneficiary',
      rfid: 'RFID-MS-001',
      payoutPreference: 'digital',
      payoutProvider: 'GCash',
      payoutAccountNo: '09175550101',
      payoutAccountName: 'Maria Santos',
      verificationStatus: 'verified',
      idCode: '4PS-ANL-001'
    });
    console.log(`Created/Updated Sample 1: Maria Santos (ID #${ben1.id}, Verified GCash)`);

    // ── SAMPLE 2: Pedro Reyes (Unverified Maya) ──
    const ben2 = await createSampleBeneficiary({
      username: 'sample_pedro',
      firstName: 'Pedro',
      lastName: 'Reyes',
      category: '4Ps Beneficiary',
      rfid: 'RFID-PR-002',
      payoutPreference: 'digital',
      payoutProvider: 'Maya',
      payoutAccountNo: '09185550202',
      payoutAccountName: 'Pedro M. Reyes Jr.',
      verificationStatus: 'unverified',
      idCode: '4PS-ANL-002'
    });
    console.log(`Created/Updated Sample 2: Pedro Reyes (ID #${ben2.id}, Unverified Maya)`);

    // ── SAMPLE 3: Juan Dela Cruz (Physical Cash OTC via RFID) ──
    const ben3 = await createSampleBeneficiary({
      username: 'sample_juan',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      category: '4Ps Beneficiary',
      rfid: 'RFID-JC-003',
      payoutPreference: 'cash_otc',
      payoutProvider: null,
      payoutAccountNo: null,
      payoutAccountName: null,
      verificationStatus: 'unverified',
      idCode: '4PS-ANL-003'
    });
    console.log(`Created/Updated Sample 3: Juan Dela Cruz (ID #${ben3.id}, Cash OTC / RFID)`);

    // ── SAMPLE EVENT: "Q3 4Ps Social Assistance (Hybrid Payout Demo)" ──
    let event = await DistributionEvent.findOne({
      where: { title: 'Q3 4Ps Social Assistance (Hybrid Payout Demo)' }
    });

    const eventData = {
      title: 'Q3 4Ps Social Assistance (Hybrid Payout Demo)',
      program_id: program.id,
      barangay_id: barangay.id,
      distribution_date: new Date(Date.now() + 86400000),
      venue: `${barangay.barangay_name} Covered Court`,
      budget: 15000.00,
      amount_per_beneficiary: 2500.00,
      status: 'scheduled',
      total_beneficiaries: 3,
      total_released: 0,
      total_amount_released: 0.00,
      notes: 'Hybrid Dual-Mode Payout Demo: Automated Digital Crediting via GCash/Maya and Physical Cash claiming via RFID scan.'
    };

    if (!event) {
      event = await DistributionEvent.create(eventData, { transaction });
    } else {
      await event.update(eventData, { transaction });
      await DistributionTransaction.destroy({
        where: { distribution_event_id: event.id },
        transaction
      });
    }

    // Create 3 transactions:
    const now = Date.now();
    // 1. Maria Santos -> Digital (GCash), Pending
    await DistributionTransaction.create({
      distribution_event_id: event.id,
      beneficiary_id: ben1.id,
      transaction_number: `TXN-${event.id}-${ben1.id}-${now}-1`,
      amount: 2500.00,
      retro_amount: 0.00,
      retro_periods: 0,
      status: 'pending',
      disbursement_type: 'digital',
      payout_provider: 'GCash',
      payout_reference_number: null
    }, { transaction });

    // 2. Pedro Reyes -> Cash OTC (Fallback because Maya is unverified)
    await DistributionTransaction.create({
      distribution_event_id: event.id,
      beneficiary_id: ben2.id,
      transaction_number: `TXN-${event.id}-${ben2.id}-${now}-2`,
      amount: 2500.00,
      retro_amount: 0.00,
      retro_periods: 0,
      status: 'pending',
      disbursement_type: 'cash_otc',
      payout_provider: null,
      payout_reference_number: null
    }, { transaction });

    // 3. Juan Dela Cruz -> Cash OTC, Pending
    await DistributionTransaction.create({
      distribution_event_id: event.id,
      beneficiary_id: ben3.id,
      transaction_number: `TXN-${event.id}-${ben3.id}-${now}-3`,
      amount: 2500.00,
      retro_amount: 0.00,
      retro_periods: 0,
      status: 'pending',
      disbursement_type: 'cash_otc',
      payout_provider: null,
      payout_reference_number: null
    }, { transaction });

    await transaction.commit();
    console.log(`\n✅ SUCCESSFULLY SEEDED:`);
    console.log(`- 3 Sample Beneficiaries:`);
    console.log(`  1. Maria Santos (GCash, Verified, Digital Transaction)`);
    console.log(`  2. Pedro Reyes (Maya, Unverified, Fallback to Cash OTC)`);
    console.log(`  3. Juan Dela Cruz (Cash OTC via RFID)`);
    console.log(`- 1 Distribution Event: "${event.title}" (Event ID #${event.id})`);
    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error('Error seeding sample data:', err);
    process.exit(1);
  }
}

seedSampleData();
