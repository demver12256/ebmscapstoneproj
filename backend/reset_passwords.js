const bcrypt = require('bcrypt');
const { connectDatabase, User } = require('./db');

async function run() {
  try {
    await connectDatabase();

    // Reset Admin
    let admin = await User.findOne({ where: { email: 'admin@ebms.local' } });
    if (admin) {
      admin.password = 'Admin@123';
      await admin.save();
      console.log('Successfully reset password for admin@ebms.local to: Admin@123');
    } else {
      // Create admin if not exists
      await User.create({
        first_name: 'System',
        last_name: 'Administrator',
        email: 'admin@ebms.local',
        password: 'Admin@123',
        role: 'admin',
        status: 'active'
      });
      console.log('Created and hashed password for admin@ebms.local to: Admin@123');
    }

    // Reset Staff
    let staff = await User.findOne({ where: { email: 'staff@ebms.local' } });
    if (staff) {
      staff.password = 'Staff@123';
      await staff.save();
      console.log('Successfully reset password for staff@ebms.local to: Staff@123');
    }

    // Reset Beneficiary
    let beneficiary = await User.findOne({ where: { email: 'beneficiary@ebms.local' } });
    if (beneficiary) {
      beneficiary.password = 'Beneficiary@123';
      await beneficiary.save();
      console.log('Successfully reset password for beneficiary@ebms.local to: Beneficiary@123');
    }

    console.log('Password reset complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

run();
