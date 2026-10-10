const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const forge = require('node-forge');
const selfsigned = require('selfsigned');

const frontendRoot = path.resolve(__dirname, '..');
const certDirectory = path.join(frontendRoot, '.local-https');
const caCertificatePath = path.join(certDirectory, 'ca-cert.pem');
const caPrivateKeyPath = path.join(certDirectory, 'ca-key.pem');
const serverCertificatePath = path.join(certDirectory, 'server-cert.pem');
const serverPrivateKeyPath = path.join(certDirectory, 'server-key.pem');
const appPort = 3000;
let caDownloadPort;

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || parts[0] === 192 && parts[1] === 168
    || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function getHostAddresses() {
  const addresses = new Set(['localhost', '127.0.0.1']);
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const network of interfaces || []) {
      if ((network.family === 'IPv4' || network.family === 4)
        && !network.internal
        && isPrivateIPv4(network.address)) {
        addresses.add(network.address);
      }
    }
  }
  return [...addresses];
}

function ensureCertificateDirectory() {
  fs.mkdirSync(certDirectory, { recursive: true });
}

function ensureCertificateAuthority() {
  const caFilesExist = fs.existsSync(caCertificatePath) && fs.existsSync(caPrivateKeyPath);
  if (caFilesExist) {
    try {
      const certificate = forge.pki.certificateFromPem(fs.readFileSync(caCertificatePath, 'utf8'));
      const privateKey = forge.pki.privateKeyFromPem(fs.readFileSync(caPrivateKeyPath, 'utf8'));
      const privateKeyPublicPart = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
      const certificatePublicKey = forge.pki.publicKeyToPem(certificate.publicKey);
      if (certificatePublicKey === forge.pki.publicKeyToPem(privateKeyPublicPart)) {
        return { certificate, privateKey };
      }
    } catch (error) {
      // Replace a partial or unreadable local CA below.
    }
  }

  const pems = selfsigned.generate([
    { name: 'commonName', value: 'EBMS Local Development CA' },
    { name: 'organizationName', value: 'EBMS Local Development' },
  ], {
    keySize: 2048,
    days: 3650,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    ],
  });

  fs.writeFileSync(caCertificatePath, pems.cert, 'utf8');
  fs.writeFileSync(caPrivateKeyPath, pems.private, 'utf8');
  return {
    certificate: forge.pki.certificateFromPem(pems.cert),
    privateKey: forge.pki.privateKeyFromPem(pems.private),
  };
}

function createServerCertificate(ca, hostAddresses) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = `01${forge.util.bytesToHex(forge.random.getBytesSync(16))}`;
  certificate.validity.notBefore = new Date(Date.now() - 5 * 60 * 1000);
  certificate.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  certificate.setSubject([
    { name: 'commonName', value: 'EBMS Local Development Server' },
    { name: 'organizationName', value: 'EBMS Local Development' },
  ]);
  certificate.setIssuer(ca.certificate.subject.attributes);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: hostAddresses.map((host) => ({
        type: host === 'localhost' ? 2 : 7,
        ...(host === 'localhost' ? { value: host } : { ip: host }),
      })),
    },
  ]);
  certificate.sign(ca.privateKey, forge.md.sha256.create());

  fs.writeFileSync(serverCertificatePath, forge.pki.certificateToPem(certificate), 'utf8');
  fs.writeFileSync(serverPrivateKeyPath, forge.pki.privateKeyToPem(keys.privateKey), 'utf8');
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') return resolve(false);
      reject(error);
    });
    server.listen(port, '0.0.0.0', () => server.close((error) => error ? reject(error) : resolve(true)));
  });
}

async function findAvailablePort(startingPort, reservedPorts = new Set()) {
  for (let port = startingPort; port < startingPort + 30; port += 1) {
    if (!reservedPorts.has(port) && await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting at ${startingPort}.`);
}

async function main() {
  if (!await isPortAvailable(appPort)) {
    throw new Error('Port 3000 is already in use. Stop the existing frontend server, then run npm run start:camera again.');
  }
  caDownloadPort = await findAvailablePort(3001, new Set([appPort]));
  ensureCertificateDirectory();

  const hosts = getHostAddresses();
  const ca = ensureCertificateAuthority();
  createServerCertificate(ca, hosts);

  const caDer = new crypto.X509Certificate(fs.readFileSync(caCertificatePath)).raw;
  const caServer = http.createServer((request, response) => {
    if (request.url !== '/ebms-local-ca.cer') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'application/pkix-cert',
      'Content-Disposition': 'attachment; filename="ebms-local-ca.cer"',
      'Content-Length': caDer.length,
    });
    response.end(caDer);
  });

  await new Promise((resolve, reject) => {
    caServer.once('error', reject);
    caServer.listen(caDownloadPort, '0.0.0.0', resolve);
  });

  console.log('\nEBMS local HTTPS camera mode is starting.');
  if (caDownloadPort !== 3001) {
    console.log(`Certificate download port 3001 was busy; using port ${caDownloadPort} for the one-time CA download.`);
  }
  console.log('On Android, download and install the CA certificate once:');
  for (const host of hosts.filter((address) => address !== 'localhost' && address !== '127.0.0.1')) {
    console.log(`  http://${host}:${caDownloadPort}/ebms-local-ca.cer`);
  }
  console.log('Then open the secure frontend address on the same Wi-Fi:');
  for (const host of hosts) {
    console.log(`  https://${host}:${appPort}`);
  }
  console.log('\nKeep this terminal open while using the scanner. Press Ctrl+C to stop.\n');
  if (hosts.length === 2) {
    console.log('No private LAN IPv4 address was detected. Connect this computer to the same Wi-Fi as the phone and restart this command.');
  }

  const child = spawn(process.execPath, [require.resolve('react-scripts/scripts/start')], {
    cwd: frontendRoot,
    env: {
      ...process.env,
      BROWSER: 'default',
      HOST: '0.0.0.0',
      PORT: String(appPort),
      HTTPS: 'true',
      SSL_CRT_FILE: serverCertificatePath,
      SSL_KEY_FILE: serverPrivateKeyPath,
    },
    stdio: 'inherit',
  });

  let shuttingDown = false;
  const stop = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (child.exitCode === null && !child.killed) child.kill();
    caServer.close();
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.once('error', (error) => {
    console.error('Could not start the React development server:', error.message);
    stop();
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    caServer.close();
    process.exitCode = signal ? 0 : code || 0;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
