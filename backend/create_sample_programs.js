require('dotenv').config();
const { BenefitProgram, Barangay, sequelize } = require('./db');

async function createPrograms() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Get all barangays
    const barangays = await Barangay.findAll();
    console.log(`📍 Found ${barangays.length} barangays\n`);
    
    if (barangays.length === 0) {
      console.log('❌ No barangays found!\n');
      await sequelize.close();
      return;
    }
    
    // Check existing programs
    const existingCount = await BenefitProgram.count();
    console.log(`📊 Found ${existingCount} existing programs\n`);
    
    if (existingCount >= 100) {
      console.log('✅ Programs already exist. Skipping creation.\n');
      console.log('💡 Run enrollment script: node enroll_beneficiaries_to_programs.js\n');
      await sequelize.close();
      return;
    }
    
    const programTemplates = [
      {
        name: 'Pantawid Pamilyang Pilipino Program (4Ps)',
        description: 'Conditional cash transfer program for the poorest of the poor families to improve health, nutrition and education',
        category: '4Ps Household Beneficiary',
        benefit_amount: 7500,
        frequency: 'monthly',
        duration_months: 12
      },
      {
        name: 'Social Pension for Indigent Senior Citizens',
        description: 'Monthly cash assistance for senior citizens who are frail, sickly, or have a disability',
        category: 'Senior Citizens (Social Pension)',
        benefit_amount: 500,
        frequency: 'monthly',
        duration_months: 12
      },
      {
        name: 'Assistance to Persons with Disabilities (PWD)',
        description: 'Financial assistance program for persons with disabilities to support their basic needs',
        category: 'Persons with Disabilities (PWD)',
        benefit_amount: 3000,
        frequency: 'quarterly',
        duration_months: 12
      }
    ];
    
    console.log('📋 Creating programs for each barangay...\n');
    
    let created = 0;
    
    for (const barangay of barangays) {
      for (const template of programTemplates) {
        await BenefitProgram.create({
          name: template.name,
          description: template.description,
          eligibility_category: template.category,
          barangay_id: barangay.id,
          benefit_type: 'Cash',
          status: 'active',
          start_date: new Date('2025-01-01'),
          end_date: new Date('2025-12-31'),
          total_budget: template.benefit_amount * 100,
          allocated_budget: template.benefit_amount * 100,
          created_by_user_id: 1
        });
        
        created++;
      }
      
      if (created % 30 === 0) {
        console.log(`   Progress: ${created} programs created`);
      }
    }
    
    console.log(`\n✅ Successfully created ${created} programs!\n`);
    console.log('📊 Programs per barangay: 3 (4Ps, Senior Citizens, PWD)\n');
    console.log('📋 Program Summary:');
    
    for (const template of programTemplates) {
      const count = await BenefitProgram.count({ where: { eligibility_category: template.category } });
      console.log(`   ${template.category}: ${count} programs`);
    }
    
    console.log('\n');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

createPrograms();
