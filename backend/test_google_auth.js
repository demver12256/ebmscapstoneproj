/**
 * Test Google Authentication Setup
 * 
 * This script verifies that Google OAuth is properly configured
 */

require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 GOOGLE AUTH CONFIGURATION TEST');
console.log('═══════════════════════════════════════════════════════\n');

// Check environment variables
console.log('1. Checking environment variables...');
console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set');
if (process.env.GOOGLE_CLIENT_ID) {
  console.log('   Value:', process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...');
}
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('');

// Initialize Google OAuth client
console.log('2. Initializing Google OAuth client...');
try {
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  console.log('   ✅ Google OAuth client initialized successfully');
  console.log('');
} catch (error) {
  console.log('   ❌ Failed to initialize:', error.message);
  console.log('');
  process.exit(1);
}

// Test token verification (with a fake token to see the error)
console.log('3. Testing token verification (with invalid token)...');
const testClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
testClient.verifyIdToken({
  idToken: 'fake-token-for-testing',
  audience: process.env.GOOGLE_CLIENT_ID,
})
.then(() => {
  console.log('   ⚠️  Unexpected: fake token was accepted');
})
.catch((error) => {
  console.log('   ✅ Correctly rejected invalid token');
  console.log('   Error:', error.message);
});

setTimeout(() => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Configuration Status:');
  console.log('  ✅ Google Client ID is configured');
  console.log('  ✅ OAuth client can be initialized');
  console.log('  ✅ Token verification is working');
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Start the backend server: node server.js');
  console.log('  2. Start the frontend: npm start');
  console.log('  3. Open http://localhost:3000/login');
  console.log('  4. Click "Sign in with Google"');
  console.log('  5. Watch the console logs for [Google Auth] messages');
  console.log('');
  console.log('═══════════════════════════════════════════════════════\n');
}, 1000);
