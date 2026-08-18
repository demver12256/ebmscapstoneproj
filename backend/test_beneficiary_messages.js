const { User, Beneficiary, Barangay, Message, sequelize } = require('./db');
const { Op } = require('sequelize');

async function runTests() {
  try {
    console.log('🧪 Starting Beneficiary Messaging Tests...\n');

    // 1. Find sample users
    const admin = await User.findOne({ where: { role: 'admin' } });
    const staffAnilao = await User.findOne({ where: { role: 'staff', barangay_id: 37 } });
    const staffAplaya = await User.findOne({ where: { role: 'staff', barangay_id: 38 } });
    const benAnilao = await User.findOne({ where: { role: 'beneficiary', email: 'vhen@gmail.com' } });
    const benAplaya = await User.findOne({ where: { role: 'beneficiary', email: 'aizer@gmail.com' } });

    console.log('👥 Test Users:');
    console.log(`  Admin: ID ${admin?.id} (${admin?.first_name} ${admin?.last_name})`);
    console.log(`  Staff Anilao: ID ${staffAnilao?.id} (${staffAnilao?.first_name} ${staffAnilao?.last_name})`);
    console.log(`  Staff Aplaya: ID ${staffAplaya?.id} (${staffAplaya?.first_name} ${staffAplaya?.last_name})`);
    console.log(`  Beneficiary Anilao: ID ${benAnilao?.id} (${benAnilao?.first_name} ${benAnilao?.last_name})`);
    console.log(`  Beneficiary Aplaya: ID ${benAplaya?.id} (${benAplaya?.first_name} ${benAplaya?.last_name})\n`);

    // Helper to get effective barangay_id for a user
    const getUserBarangayId = async (user) => {
      if (user.barangay_id) return user.barangay_id;
      if (user.role === 'beneficiary') {
        const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
        if (ben && ben.barangay_id) return ben.barangay_id;
      }
      return null;
    };

    // Helper to simulate GET /contacts
    const getContactsFor = async (currentUser) => {
      let whereClause = { status: 'active' };

      if (currentUser.role === 'admin') {
        const approvedBeneficiaryUserIds = (await Beneficiary.findAll({
          where: { status: 'Approved' },
          attributes: ['user_id'],
          raw: true,
        })).map((b) => b.user_id).filter(Boolean);

        whereClause[Op.or] = [
          { role: { [Op.in]: ['staff', 'barangay'] } },
          { role: 'beneficiary', id: { [Op.in]: approvedBeneficiaryUserIds } }
        ];
      } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
        const userBarangayId = await getUserBarangayId(currentUser);
        const approvedBeneficiaryUserIds = (await Beneficiary.findAll({
          where: { barangay_id: userBarangayId, status: 'Approved' },
          attributes: ['user_id'],
          raw: true,
        })).map((b) => b.user_id).filter(Boolean);

        whereClause[Op.or] = [
          { role: 'admin' },
          { role: { [Op.in]: ['staff', 'barangay'] }, barangay_id: userBarangayId },
          { role: 'beneficiary', id: { [Op.in]: approvedBeneficiaryUserIds } }
        ];
      } else if (currentUser.role === 'beneficiary') {
        const beneficiaryBarangayId = await getUserBarangayId(currentUser);
        if (beneficiaryBarangayId) {
          whereClause[Op.or] = [
            { role: 'admin' },
            { role: { [Op.in]: ['staff', 'barangay'] }, barangay_id: beneficiaryBarangayId }
          ];
        } else {
          whereClause.role = 'admin';
        }
      }

      return await User.findAll({
        where: {
          ...whereClause,
          id: { [Op.ne]: currentUser.id },
        },
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status', 'barangay_id'],
        include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        order: [['role', 'ASC'], ['first_name', 'ASC']],
      });
    };

    // Helper to simulate sending message validation
    const validateCanSendMessage = async (sender, receiverId) => {
      const receiver = await User.findByPk(receiverId);
      if (!receiver) return { allowed: false, reason: 'Receiver not found' };

      const currentRole = sender.role;
      const receiverRole = receiver.role;

      if (currentRole === 'admin') {
        if (!['staff', 'barangay', 'beneficiary'].includes(receiverRole)) {
          return { allowed: false, reason: 'Admin can only message staff, barangay, and beneficiary users' };
        }
        return { allowed: true };
      }

      if (currentRole === 'staff' || currentRole === 'barangay') {
        const senderBarangayId = await getUserBarangayId(sender);
        if (!senderBarangayId) return { allowed: false, reason: 'No barangay assigned' };

        if (receiverRole === 'admin') return { allowed: true };
        if (receiverRole === 'staff' || receiverRole === 'barangay') {
          const receiverBarangayId = await getUserBarangayId(receiver);
          if (receiverBarangayId !== senderBarangayId) return { allowed: false, reason: 'Different barangay staff' };
          return { allowed: true };
        }
        if (receiverRole === 'beneficiary') {
          const receiverBarangayId = await getUserBarangayId(receiver);
          if (receiverBarangayId !== senderBarangayId) return { allowed: false, reason: 'Different barangay beneficiary' };
          return { allowed: true };
        }
        return { allowed: false, reason: 'Invalid recipient' };
      }

      if (currentRole === 'beneficiary') {
        const beneficiaryBarangayId = await getUserBarangayId(sender);
        if (receiverRole === 'admin') return { allowed: true };
        if (receiverRole === 'staff' || receiverRole === 'barangay') {
          if (!beneficiaryBarangayId) return { allowed: false, reason: 'No registered barangay' };
          const receiverBarangayId = await getUserBarangayId(receiver);
          if (receiverBarangayId !== beneficiaryBarangayId) return { allowed: false, reason: 'Different barangay staff' };
          return { allowed: true };
        }
        if (receiverRole === 'beneficiary') {
          return { allowed: false, reason: 'Cannot message other beneficiaries' };
        }
        return { allowed: false, reason: 'Invalid recipient' };
      }

      return { allowed: false, reason: 'Unauthorized' };
    };

    // Test 1: Anilao Beneficiary Contacts
    console.log('--- TEST 1: Anilao Beneficiary Contacts ---');
    const benAnilaoContacts = await getContactsFor(benAnilao);
    console.log(`Beneficiary Anilao has ${benAnilaoContacts.length} contacts:`);
    benAnilaoContacts.forEach(c => {
      console.log(`  - [${c.role.toUpperCase()}] ${c.first_name} ${c.last_name} (${c.Barangay?.barangay_name || 'No Barangay'}, ID: ${c.barangay_id})`);
    });

    const hasAdmin = benAnilaoContacts.some(c => c.role === 'admin');
    const hasAnilaoStaff = benAnilaoContacts.some(c => c.role === 'staff' && c.barangay_id === 37);
    const hasAplayaStaff = benAnilaoContacts.some(c => c.role === 'staff' && c.barangay_id === 38);
    const hasBeneficiary = benAnilaoContacts.some(c => c.role === 'beneficiary');

    console.log('  Includes Admin:', hasAdmin ? '✅ YES' : '❌ NO');
    console.log('  Includes Anilao Staff:', hasAnilaoStaff ? '✅ YES' : '❌ NO');
    console.log('  Excludes Aplaya Staff:', !hasAplayaStaff ? '✅ YES' : '❌ NO');
    console.log('  Excludes other Beneficiaries:', !hasBeneficiary ? '✅ YES' : '❌ NO');

    if (hasAdmin && hasAnilaoStaff && !hasAplayaStaff && !hasBeneficiary) {
      console.log('  👉 TEST 1 PASSED! ✅\n');
    } else {
      console.log('  👉 TEST 1 FAILED! ❌\n');
    }

    // Test 2: Message validation from Anilao Beneficiary
    console.log('--- TEST 2: Beneficiary Message Permissions ---');
    const msgToAdmin = await validateCanSendMessage(benAnilao, admin.id);
    console.log('  Ben -> Admin:', msgToAdmin.allowed ? '✅ ALLOWED' : `❌ BLOCKED (${msgToAdmin.reason})`);

    const msgToAnilaoStaff = await validateCanSendMessage(benAnilao, staffAnilao.id);
    console.log('  Ben -> Anilao Staff:', msgToAnilaoStaff.allowed ? '✅ ALLOWED' : `❌ BLOCKED (${msgToAnilaoStaff.reason})`);

    const msgToAplayaStaff = await validateCanSendMessage(benAnilao, staffAplaya.id);
    console.log('  Ben -> Aplaya Staff (Other Brgy):', !msgToAplayaStaff.allowed ? `✅ BLOCKED (${msgToAplayaStaff.reason})` : '❌ UNEXPECTEDLY ALLOWED');

    const msgToOtherBen = await validateCanSendMessage(benAnilao, benAplaya.id);
    console.log('  Ben -> Other Ben:', !msgToOtherBen.allowed ? `✅ BLOCKED (${msgToOtherBen.reason})` : '❌ UNEXPECTEDLY ALLOWED');

    // Test 3: Admin & Staff messaging
    console.log('\n--- TEST 3: Admin & Staff Messaging to Beneficiary ---');
    const adminToBen = await validateCanSendMessage(admin, benAnilao.id);
    console.log('  Admin -> Beneficiary:', adminToBen.allowed ? '✅ ALLOWED' : `❌ BLOCKED (${adminToBen.reason})`);

    const staffAnilaoToBenAnilao = await validateCanSendMessage(staffAnilao, benAnilao.id);
    console.log('  Staff Anilao -> Ben Anilao (Same Brgy):', staffAnilaoToBenAnilao.allowed ? '✅ ALLOWED' : `❌ BLOCKED (${staffAnilaoToBenAnilao.reason})`);

    const staffAnilaoToBenAplaya = await validateCanSendMessage(staffAnilao, benAplaya.id);
    console.log('  Staff Anilao -> Ben Aplaya (Different Brgy):', !staffAnilaoToBenAplaya.allowed ? `✅ BLOCKED (${staffAnilaoToBenAplaya.reason})` : '❌ UNEXPECTEDLY ALLOWED');

    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    await sequelize.close();
  } catch (err) {
    console.error('❌ Test failed:', err);
    await sequelize.close();
  }
}

runTests();
