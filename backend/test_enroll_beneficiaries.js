const { Beneficiary, BenefitProgram, Enrollment } = require('./db');

async function enrollBeneficiaries() {
  try {
    console.log('\n=== Enrolling Beneficiaries to Programs ===\n');
    
    // Get all approved beneficiaries
    const beneficiaries = await Beneficiary.findAll({
      where: { status: 'Approved' }
    });
    
    console.log(`Found ${beneficiaries.length} approved beneficiaries\n`);
    
    // Get all active programs
    const programs = await BenefitProgram.findAll({
      where: { status: 'active' }
    });
    
    console.log(`Found ${programs.length} active programs\n`);
    
    if (programs.length === 0) {
      console.log('No active programs found. Create some programs first.');
      process.exit(0);
    }
    
    // Enroll each beneficiary to matching programs
    for (const beneficiary of beneficiaries) {
      console.log(`\nProcessing: ${beneficiary.first_name} ${beneficiary.last_name}`);
      console.log(`  Category: ${beneficiary.category}`);
      console.log(`  Barangay: ${beneficiary.barangay_id}`);
      
      // Find matching programs
      const matchingPrograms = programs.filter(p => {
        const categoryMatch = p.eligibility_category?.toLowerCase().includes(beneficiary.category?.toLowerCase()) ||
                             beneficiary.category?.toLowerCase().includes(p.eligibility_category?.toLowerCase());
        const barangayMatch = p.barangay_id === beneficiary.barangay_id;
        return categoryMatch && barangayMatch;
      });
      
      console.log(`  Matching programs: ${matchingPrograms.length}`);
      
      for (const program of matchingPrograms) {
        // Check if already enrolled
        const existingEnrollment = await Enrollment.findOne({
          where: {
            beneficiary_id: beneficiary.id,
            program_id: program.id
          }
        });
        
        if (existingEnrollment) {
          console.log(`    ✓ Already enrolled in: ${program.name}`);
        } else {
          // Create enrollment
          await Enrollment.create({
            beneficiary_id: beneficiary.id,
            program_id: program.id,
            enrollment_date: new Date().toISOString().split('T')[0],
            status: 'active'
          });
          console.log(`    ✅ Enrolled in: ${program.name}`);
        }
      }
    }
    
    console.log('\n✅ Enrollment complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

enrollBeneficiaries();
