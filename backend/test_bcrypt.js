const bcrypt = require('bcrypt');

async function testBcrypt() {
  console.log('\n🔐 Testing bcrypt directly...\n');
  
  const password = 'password123';
  
  // Test 1: Hash and verify immediately
  console.log('Test 1: Hash and verify immediately');
  const hash1 = await bcrypt.hash(password, 10);
  console.log('Hash:', hash1);
  const verify1 = await bcrypt.compare(password, hash1);
  console.log('Verify:', verify1 ? '✅ PASSED' : '❌ FAILED');
  
  // Test 2: Use hashSync
  console.log('\nTest 2: Using hashSync');
  const hash2 = bcrypt.hashSync(password, 10);
  console.log('Hash:', hash2);
  const verify2 = bcrypt.compareSync(password, hash2);
  console.log('Verify:', verify2 ? '✅ PASSED' : '❌ FAILED');
  
  // Test 3: Different rounds
  console.log('\nTest 3: Different salt rounds');
  for (const rounds of [8, 10, 12]) {
    const hash = await bcrypt.hash(password, rounds);
    const verify = await bcrypt.compare(password, hash);
    console.log(`Rounds ${rounds}: ${verify ? '✅' : '❌'}`);
  }
  
  // Test 4: Check existing hash from database
  console.log('\nTest 4: Testing existing hash from database');
  const existingHash = '$2b$10$sO5Z9zcJezHdiGTjpzXQou45xGdlkpuyV0E0DeN8T1KL.9cjhXgbm';
  
  const passwords = [
    'password123',
    'Password123',
    'PASSWORD123',
    'password',
    '123',
    '',
    'password1234',
    'password12'
  ];
  
  for (const pwd of passwords) {
    try {
      const match = await bcrypt.compare(pwd, existingHash);
      if (match) {
        console.log(`✅ FOUND IT! Password is: "${pwd}"`);
      }
    } catch (err) {
      console.log(`Error testing "${pwd}":`, err.message);
    }
  }
  
  console.log('\n');
}

testBcrypt();
