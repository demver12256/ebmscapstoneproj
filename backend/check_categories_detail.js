require('dotenv').config();
const { Beneficiary, BenefitProgram, Enrollment, sequelize } = require('./db');

async function checkCategoriesDetail() {
  try {
    await sequelize.authenticate();
    
    console.log('\n=== Beneficiary Categories ===\n');
    
    const beneficiaries = await Beneficiary.findAll({
      attributes: ['id', 'first_name', 'last_name', 'category', 'status', 'barangay_id'],
      order: [['id', 'ASC']]
    });
    
    console.log(`Total Beneficiaries: ${beneficiaries.length}\n`);
    
    beneficiaries.forEach((ben, index) => {
      console.log(`${index + 1}. ID: ${ben.id} | ${ben.first_name} ${ben.last_name}`);
      console.log(`   Category: ${ben.category || 'NONE'}`);
      console.log(`   Status: ${ben.status}`);
      console.log(`   Barangay ID: ${ben.barangay_id}\n`);
    });
    
    console.log('\n=== Programs ===\n');
    
    const programs = await BenefitProgram.findAll({
      attributes: ['id', 'name', 'eligibility_category', 'status', 'barangay_id'],
      order: [['id', 'ASC']]
    });
    
    programs.forEach((prog, index) => {
      console.log(`${index + 1}. ID: ${prog.id} | ${prog.name}`);
      console.log(`   Eligibility Category: ${prog.eligibility_category || 'NONE'}`);
      console.log(`   Status: ${prog.status}`);
      console.log(`   Barangay ID: ${prog.barangay_id}\n`);
    });
    
    console.log('\n=== Enrollments ===\n');
    
    const enrollments = await Enrollment.findAll({
      include: [
        { model: Beneficiary, attributes: ['id', 'first_name', 'last_name', 'category', 'status'] },
        { model: BenefitProgram, attributes: ['id', 'name', 'eligibility_category'] }
      ],
      order: [['id', 'ASC']]
    });
    
    console.log(`Total Enrollments: ${enrollments.length}\n`);
    
    enrollments.forEach((enr, index) => {
      console.log(`${index + 1}. Enrollment ID: ${enr.id}`);
      console.log(`   Beneficiary: ${enr.Beneficiary.first_name} ${enr.Beneficiary.last_name} (ID: ${enr.Beneficiary.id})`);
      console.log(`   Category: ${enr.Beneficiary.category || 'NONE'}`);
      console.log(`   Status: ${enr.Beneficiary.status}`);
      console.log(`   Program: ${enr.BenefitProgram.name} (ID: ${enr.BenefitProgram.id})`);
      console.log(`   Program Eligibility: ${enr.BenefitProgram.eligibility_category || 'NONE'}`);
      console.log(`   Enrollment Status: ${enr.status}\n`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCategoriesDetail();
