const fetch = globalThis.fetch || require('node-fetch');

async function testAllCategories() {
  console.log('--- TESTING ALL 5 DSWD ASSISTANCE CATEGORIES ---');

  // 1. Admin login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@ebms.local',
      password: 'Admin@123',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token;

  if (!token) {
    console.error('❌ Admin login failed:', loginData);
    process.exit(1);
  }
  console.log('✅ Admin login successful');

  const categoriesToTest = [
    {
      category: 'Medical Assistance',
      payload: { category: 'Medical Assistance', applicant_relationship: 'Mother', pharmacy_name: 'Oriental 21 Pharmacy' },
    },
    {
      category: 'Hospital Assistance',
      payload: { category: 'Hospital Assistance', applicant_relationship: 'Son', hospital_confinement_status: 'currently_confined' },
    },
    {
      category: 'Educational Assistance',
      payload: { category: 'Educational Assistance', applicant_relationship: 'Mother' },
    },
    {
      category: 'Financial Assistance',
      payload: { category: 'Financial Assistance', applicant_relationship: 'Self' },
    },
    {
      category: 'Burial Assistance',
      payload: { category: 'Burial Assistance', applicant_relationship: 'Sibling' },
    },
  ];

  for (const item of categoriesToTest) {
    const res = await fetch('http://localhost:5000/api/medical-assistance/requirements-matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(item.payload),
    });
    const data = await res.json();
    console.log(`\n📌 Category: [${item.category}]`);
    console.log(`   Requirements (${data.data?.length || 0}):`, (data.data || []).map(d => `${d.name} [${d.code}]`));
    if (!data.data || data.data.length === 0) {
      console.error(`❌ FAILED for category: ${item.category}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 ALL 5 DSWD ASSISTANCE CATEGORIES VALIDATED SUCCESSFULLY!');
}

testAllCategories().catch(console.error);
