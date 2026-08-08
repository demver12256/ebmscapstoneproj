const {BenefitProgram} = require('./db');

BenefitProgram.findAll().then(programs => {
  console.log('\nTotal programs:', programs.length);
  programs.forEach(p => {
    console.log(`- ${p.name} (Status: ${p.status}, Barangay: ${p.barangay_id})`);
  });
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
