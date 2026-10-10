# Live QR camera on a phone

The browser blocks live camera access on a plain HTTP LAN address. Start the frontend with its local HTTPS camera mode instead. Normal frontend development continues to use `http://localhost:3000` with `npm start`.

1. Stop any existing frontend server using port 3000. In the `frontend` folder on Windows, run `npm.cmd run camera` and leave that terminal running. This opens the frontend on the PC after it compiles. The app uses port 3000; if port 3001 is busy, the script selects another port for the one-time certificate download and prints its address. (`npm run start:camera` remains available too.)
2. On Windows, open a second terminal in the `frontend` folder and run `npm.cmd run trust:camera-ca`. This installs the generated local CA in the current Windows user's Root certificate store; administrator access is not required. Close and reopen Edge after installation.
3. Connect the phone and computer to the same Wi-Fi.
4. On the phone, open the `http://<computer-LAN-IP>:3001/ebms-local-ca.cer` address printed in the terminal and download the certificate.
5. Install the downloaded certificate as a **CA certificate** in the phone's security settings. On Android, this is usually under **Settings → Security/Privacy → More security settings → Encryption & credentials → Install a certificate → CA certificate**. Android may ask you to set a screen lock first.
6. Open the matching `https://<computer-LAN-IP>:3000` address printed in the terminal. Allow camera access, choose the event, and start the QR scanner.

After the QR is read, the scanner sends it to the attendance endpoint automatically. The local certificate authority and server keys are kept in the ignored `frontend/.local-https/` folder. Keep the phone and computer on the same Wi-Fi while scanning. If that folder is removed and the CA is regenerated, repeat the Windows and phone trust steps.
