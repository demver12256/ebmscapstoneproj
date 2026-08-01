const { connectDatabase, User, Beneficiary, Barangay } = require('./db');

async function run() {
  try {
    await connectDatabase();

    // Find or create a Barangay to link accounts to
    let barangay = await Barangay.findOne();
    if (!barangay) {
      barangay = await Barangay.create({
        barangay_name: 'Poblacion',
        barangay_code: 'BRG-0001',
        captain_name: 'Kap. Roberto Santos',
        contact_number: '09171234567'
      });
      console.log('Created default Barangay: Poblacion');
    }

    // 1. Create or Update Staff Account
    const staffEmail = 'staff@ebms.local';
    let staffUser = await User.findOne({ where: { email: staffEmail } });
    if (!staffUser) {
      staffUser = await User.create({
        first_name: 'Jane',
        last_name: 'Staff',
        email: staffEmail,
        password: 'Staff@123',
        role: 'staff',
        barangay_id: barangay.id,
        status: 'active'
      });
      console.log(`Created Staff User: ${staffEmail} / Staff@123`);
    } else {
      staffUser.barangay_id = barangay.id;
      staffUser.password = 'Staff@123';
      await staffUser.save();
      console.log(`Updated Staff User: ${staffEmail}`);
    }

    // 2. Create or Update Beneficiary Account
    const beneficiaryEmail = 'beneficiary@ebms.local';
    let beneficiaryUser = await User.findOne({ where: { email: beneficiaryEmail } });
    if (!beneficiaryUser) {
      beneficiaryUser = await User.create({
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: beneficiaryEmail,
        password: 'Beneficiary@123',
        role: 'beneficiary',
        barangay_id: barangay.id,
        status: 'active'
      });
      console.log(`Created Beneficiary User: ${beneficiaryEmail} / Beneficiary@123`);
    } else {
      beneficiaryUser.barangay_id = barangay.id;
      beneficiaryUser.password = 'Beneficiary@123';
      await beneficiaryUser.save();
      console.log(`Updated Beneficiary User: ${beneficiaryEmail}`);
    }

    // Create or Update matching Beneficiary record
    let beneficiaryRec = await Beneficiary.findOne({ where: { user_id: beneficiaryUser.id } });
    if (!beneficiaryRec) {
      await Beneficiary.create({
        user_id: beneficiaryUser.id,
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        sex: 'Male',
        birthdate: '1995-06-15',
        barangay_id: barangay.id,
        category: '4Ps Household Beneficiaries',
        contact_number: '09187654321',
        status: 'Approved',
        beneficiary_id_code: 'BEN-2026-0000',
        national_id_number: 'NAT-ID-0000',
        psa_birth_cert_number: 'PSA-ID-0000',
        approval_date: '2026-01-01',
        approving_staff_id: staffUser.id
      });
      console.log('Created associated Beneficiary database record for Juan Dela Cruz.');
    } else {
      beneficiaryRec.barangay_id = barangay.id;
      beneficiaryRec.status = 'Approved';
      beneficiaryRec.category = '4Ps Household Beneficiaries';
      beneficiaryRec.beneficiary_id_code = 'BEN-2026-0000';
      beneficiaryRec.national_id_number = 'NAT-ID-0000';
      beneficiaryRec.psa_birth_cert_number = 'PSA-ID-0000';
      beneficiaryRec.approval_date = '2026-01-01';
      beneficiaryRec.approving_staff_id = staffUser.id;
      await beneficiaryRec.save();
      console.log('Updated associated Beneficiary database record.');
    }

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating accounts:', error);
    process.exit(1);
  }
}

run();
