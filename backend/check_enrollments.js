const { Beneficiary, Enrollment, BenefitProgram, User, Barangay } = require('./db');

async function checkEnrollments() {
  try {
    console.log('\n=== Checking Enrollments ===\n');
    
    // Get all enrollments
    const enrollments = await Enrollment.findAll({
      include: [
        { 
          model: Beneficiary,
          include: [{ model: User }]
        },
        { model: BenefitProgram }
      ]
    });
    
    console.log(`Total enrollments found: ${enrollments.length}\n`);
    
    enrollments.forEach((enrollment, idx) => {
      console.log(`${idx + 1}. Enrollment ID: ${enrollment.id}`);
      console.log(`   Beneficiary: ${enrollment.Beneficiary?.first_name} ${enrollment.Beneficiary?.last_name}`);
      console.log(`   User ID: ${enrollment.Beneficiary?.user_id}`);
      console.log(`   Program: ${enrollment.BenefitProgram?.name}`);
      console.log(`   Status: ${enrollment.status}`);
      console.log(`   Date: ${enrollment.enrollment_date}\n`);
    });
    
    // Check specific beneficiary with user_id
    console.log('\n=== Checking Beneficiary Enrollments ===\n');
    
    const beneficiaries = await Beneficiary.findAll({
      where: { status: 'Approved' },
      include: [
        { model: User },
        { 
          model: Enrollment,
          as: 'Enrollments',
          include: [{ model: BenefitProgram }]
        }
      ],
      limit: 5
    });
    
    beneficiaries.forEach((ben, idx) => {
      console.log(`${idx + 1}. ${ben.first_name} ${ben.last_name}`);
      console.log(`   User ID: ${ben.user_id}`);
      console.log(`   Status: ${ben.status}`);
      console.log(`   Enrollments: ${ben.Enrollments?.length || 0}`);
      if (ben.Enrollments && ben.Enrollments.length > 0) {
        ben.Enrollments.forEach((enr) => {
          console.log(`      - ${enr.BenefitProgram?.name} (${enr.status})`);
        });
      }
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEnrollments();
