require('dotenv').config();
const { DistributionEvent, BenefitProgram, Enrollment, Beneficiary, Barangay, sequelize } = require('./db');

async function verifyDraftDistribution() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Find a draft distribution event
    const draftEvent = await DistributionEvent.findOne({
      where: { status: 'draft' },
      include: [
        { 
          model: BenefitProgram, 
          as: 'Program',
          attributes: ['id', 'name', 'eligibility_category']
        },
        { 
          model: Barangay,
          attributes: ['id', 'barangay_name']
        }
      ]
    });
    
    if (!draftEvent) {
      console.log('❌ No draft distribution events found!\n');
      await sequelize.close();
      return;
    }
    
    console.log('📋 Draft Distribution Event Found:');
    console.log(`   ID: ${draftEvent.id}`);
    console.log(`   Title: ${draftEvent.title}`);
    console.log(`   Program: ${draftEvent.Program?.name}`);
    console.log(`   Barangay: ${draftEvent.Barangay?.barangay_name}`);
    console.log(`   Status: ${draftEvent.status}`);
    console.log(`   Amount per beneficiary: ₱${parseFloat(draftEvent.amount_per_beneficiary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
    console.log(`   Target Category: ${draftEvent.target_category || 'All'}\n`);
    
    // Get enrolled beneficiaries from the program
    console.log('🔍 Checking enrolled beneficiaries...\n');
    
    const enrollments = await Enrollment.findAll({
      where: { 
        program_id: draftEvent.program_id,
        status: 'active'
      },
      include: [{
        model: Beneficiary,
        where: { 
          barangay_id: draftEvent.barangay_id,
          status: 'Approved'
        },
        include: [{ model: Barangay, attributes: ['barangay_name'] }]
      }]
    });
    
    console.log(`✅ Found ${enrollments.length} enrolled beneficiaries\n`);
    
    if (enrollments.length > 0) {
      console.log('📊 Sample Beneficiaries (first 5):');
      enrollments.slice(0, 5).forEach((e, index) => {
        const b = e.Beneficiary;
        console.log(`   ${index + 1}. ${b.first_name} ${b.last_name}`);
        console.log(`      ID: ${b.beneficiary_id_code}`);
        console.log(`      Category: ${b.category}`);
        console.log(`      Barangay: ${b.Barangay?.barangay_name}`);
        console.log(`      Amount: ₱${parseFloat(draftEvent.amount_per_beneficiary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
        console.log('');
      });
      
      // Filter by target category if specified
      let qualifiedBeneficiaries = enrollments;
      if (draftEvent.target_category) {
        qualifiedBeneficiaries = enrollments.filter(e => 
          e.Beneficiary.category && 
          e.Beneficiary.category.toLowerCase().includes(draftEvent.target_category.toLowerCase())
        );
        console.log(`🎯 Filtered by category "${draftEvent.target_category}": ${qualifiedBeneficiaries.length} qualified\n`);
      }
      
      // Calculate total budget needed
      const totalRequired = qualifiedBeneficiaries.length * parseFloat(draftEvent.amount_per_beneficiary);
      const availableBudget = parseFloat(draftEvent.budget);
      
      console.log('💰 Budget Analysis:');
      console.log(`   Qualified Beneficiaries: ${qualifiedBeneficiaries.length}`);
      console.log(`   Amount per Beneficiary: ₱${parseFloat(draftEvent.amount_per_beneficiary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Required: ₱${totalRequired.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      console.log(`   Available Budget: ₱${availableBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      console.log(`   Budget Sufficient: ${totalRequired <= availableBudget ? '✅ YES' : '❌ NO'}`);
      
      if (totalRequired > availableBudget) {
        const deficit = totalRequired - availableBudget;
        console.log(`   Deficit: ₱${deficit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n`);
      } else {
        console.log('');
      }
      
      console.log('✅ VERIFICATION COMPLETE');
      console.log('📝 This data should now appear in the frontend when viewing this draft distribution event.\n');
    } else {
      console.log('⚠️  No enrolled beneficiaries found for this program.\n');
      console.log('💡 TIP: Run enrollment script first:');
      console.log('   node enroll_beneficiaries_to_programs.js\n');
    }
    
    await sequelize.close();
    console.log('🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyDraftDistribution();
