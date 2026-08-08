require('dotenv').config();
const { Beneficiary, BenefitProgram, Enrollment, sequelize } = require('./db');

async function enrollBeneficiaries() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Get all benefit programs
    const programs = await BenefitProgram.findAll();
    console.log(`📊 Found ${programs.length} benefit programs\n`);
    
    if (programs.length === 0) {
      console.log('❌ No programs found! Please create programs first.\n');
      console.log('💡 Tip: Run seed.js or create programs via admin panel\n');
      await sequelize.close();
      return;
    }
    
    // Show available programs
    console.log('Available Programs:');
    programs.forEach(p => {
      console.log(`  - ${p.program_name} (${p.category || 'No category'})`);
    });
    console.log('\n');
    
    // Get all approved beneficiaries
    const beneficiaries = await Beneficiary.findAll({
      where: { status: 'Approved' }
    });
    
    console.log(`📊 Found ${beneficiaries.length} approved beneficiaries\n`);
    console.log('🔄 Starting enrollment process...\n');
    
    let enrolled = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const beneficiary of beneficiaries) {
      try {
        // Find matching program(s) for this beneficiary's category
        let matchingPrograms = [];
        
        // Match by category keywords
        if (beneficiary.category?.includes('4Ps')) {
          matchingPrograms = programs.filter(p => 
            p.eligibility_category?.includes('4Ps') || 
            p.name?.toLowerCase().includes('4ps') ||
            p.name?.toLowerCase().includes('pantawid')
          );
        } else if (beneficiary.category?.includes('Senior')) {
          matchingPrograms = programs.filter(p => 
            p.eligibility_category?.includes('Senior') || 
            p.name?.toLowerCase().includes('senior') ||
            p.name?.toLowerCase().includes('pension')
          );
        } else if (beneficiary.category?.includes('PWD') || beneficiary.category?.includes('Disabilit')) {
          matchingPrograms = programs.filter(p => 
            p.eligibility_category?.includes('PWD') || 
            p.eligibility_category?.includes('Disabilit') ||
            p.name?.toLowerCase().includes('pwd') ||
            p.name?.toLowerCase().includes('disability')
          );
        }
        
        // If no category match, try to match any active program
        if (matchingPrograms.length === 0) {
          matchingPrograms = programs.filter(p => p.status === 'active');
        }
        
        if (matchingPrograms.length === 0) {
          console.log(`⚠️  No matching program for ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.category})`);
          skipped++;
          continue;
        }
        
        // Enroll in the first matching program
        const program = matchingPrograms[0];
        
        // Check if already enrolled
        const existingEnrollment = await Enrollment.findOne({
          where: {
            beneficiary_id: beneficiary.id,
            program_id: program.id
          }
        });
        
        if (existingEnrollment) {
          skipped++;
          continue;
        }
        
        // Create enrollment
        await Enrollment.create({
          beneficiary_id: beneficiary.id,
          program_id: program.id,
          enrollment_date: new Date(),
          status: 'active'
        });
        
        enrolled++;
        
        if (enrolled % 100 === 0) {
          console.log(`   Progress: ${enrolled} enrolled, ${skipped} skipped`);
        }
        
      } catch (err) {
        console.error(`❌ Error enrolling ${beneficiary.first_name} ${beneficiary.last_name}:`, err.message);
        errors++;
      }
    }
    
    console.log('\n✅ Enrollment complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Enrolled: ${enrolled}`);
    console.log(`   ⏭️  Skipped (already enrolled): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total processed: ${beneficiaries.length}\n`);
    
    // Verify enrollments by category
    console.log('📊 Enrollments by Category:\n');
    
    const categories = [
      '4Ps Household Beneficiary',
      'Senior Citizens (Social Pension)',
      'Persons with Disabilities (PWD)'
    ];
    
    for (const category of categories) {
      const beneficiariesInCategory = await Beneficiary.count({
        where: { category, status: 'Approved' }
      });
      
      const enrollmentsInCategory = await Enrollment.count({
        include: [{
          model: Beneficiary,
          where: { category, status: 'Approved' }
        }]
      });
      
      console.log(`${category}:`);
      console.log(`   Beneficiaries: ${beneficiariesInCategory}`);
      console.log(`   Enrollments: ${enrollmentsInCategory}`);
      console.log(`   Coverage: ${((enrollmentsInCategory / beneficiariesInCategory) * 100).toFixed(1)}%\n`);
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

enrollBeneficiaries();
