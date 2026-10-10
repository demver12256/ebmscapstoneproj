const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') {
  console.error('This helper installs the local CA in the Windows current-user certificate store.');
  process.exit(1);
}

const frontendRoot = path.resolve(__dirname, '..');
const certDirectory = path.join(frontendRoot, '.local-https');
const caCertificatePath = path.join(certDirectory, 'ca-cert.pem');
const caDerCertificatePath = path.join(certDirectory, 'ca-cert.cer');

if (!fs.existsSync(caCertificatePath)) {
  console.error('The local CA has not been created yet. Start the camera server once with:');
  console.error('  npm run start:camera');
  process.exit(1);
}

const caCertificate = new crypto.X509Certificate(fs.readFileSync(caCertificatePath));
fs.writeFileSync(caDerCertificatePath, caCertificate.raw);

console.log('Adding the EBMS local development CA to your Windows current-user Root store.');
const result = spawnSync('certutil.exe', [
  '-user',
  '-addstore',
  '-f',
  'Root',
  caDerCertificatePath,
], { stdio: 'inherit' });

if (result.error) {
  console.error(`Could not run certutil.exe: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('\nLocal HTTPS should now be trusted by Edge and other Windows browsers.');
console.log('Close and reopen the browser, then open the HTTPS address printed by start:camera.');
