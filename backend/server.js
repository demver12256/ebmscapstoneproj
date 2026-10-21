const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

const { connectDatabase, User } = require('./db');
const { Op } = require('sequelize');
const { processQueuedSms, isConfigured: isSmsConfigured } = require('./utils/smsDispatcher');
const { autoCompleteExpiredAnnouncements } = require('./utils/announcementScheduler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const barangayRoutes = require('./routes/barangays');
const beneficiaryRoutes = require('./routes/beneficiaries');
const programRoutes = require('./routes/programs');
const enrollmentRoutes = require('./routes/enrollments');
const distributionRoutes = require('./routes/distributions');
const attendanceRoutes = require('./routes/attendance');
const smsRoutes = require('./routes/sms');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const seedRoutes = require('./routes/seed');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const announcementRoutes = require('./routes/announcements');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'https://ebms.world',
  'https://www.ebms.world',
  'https://ebmscapstoneproj-production.up.railway.app', // The Railway frontend URL
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null, // Strip trailing slash if it exists
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
].filter(Boolean);

const isLocalNetworkFrontend = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['3000', '3001'].includes(url.port)) return false;

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return true;

    const octets = host.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }

    return octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      octets[0] === 127;
  } catch {
    return false;
  }
};

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin) || isLocalNetworkFrontend(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
const { initFileStorageTable, serveUploadedFileFallback } = require('./utils/fileStorage');
app.use('/uploads', cors(), express.static(path.join(__dirname, 'uploads')), serveUploadedFileFallback);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return url.includes('unread') || url.includes('popup') || url.includes('/api/reports/summary');
  },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/barangays', barangayRoutes);
app.use('/api/beneficiaries', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/beneficiaries')];
    return require('./routes/beneficiaries')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/programs', programRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/distributions', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/distributions')];
    return require('./routes/distributions')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/reports', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/reports')];
    return require('./routes/reports')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/audit', auditRoutes);
app.use('/api/messages', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/messages')];
    return require('./routes/messages')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/assistance-requests', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/assistanceRequests')];
    return require('./routes/assistanceRequests')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/medical-assistance', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/medicalAssistance')];
    return require('./routes/medicalAssistance')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/interventions', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/interventions')];
    return require('./routes/interventions')(req, res, next);
  } catch (err) {
    return next(err);
  }
});
app.use('/api/bot', (req, res, next) => {
  try {
    delete require.cache[require.resolve('./routes/bot')];
    return require('./routes/bot')(req, res, next);
  } catch (err) {
    return next(err);
  }
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).json({});
});

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to EBMS API' });
});

app.get('/api/data', (req, res) => {
  const sampleData = [
    { id: 1, name: 'Sample Item 1', description: 'This item is returned by the mobile app demo endpoint.' },
    { id: 2, name: 'Sample Item 2', description: 'The backend route /api/data is now available for the app.' },
  ];

  res.json(sampleData);
});

app.post('/api/data', (req, res) => {
  const { name, description } = req.body || {};

  if (!name || !description) {
    return res.status(400).json({ message: 'Name and description are required.' });
  }

  const createdItem = {
    id: Date.now(),
    name,
    description,
  };

  return res.status(201).json(createdItem);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const createDefaultAccounts = async () => {
  const defaultAccounts = [
    {
      first_name: 'System',
      last_name: 'Administrator',
      username: 'admin',
      email: 'admin@ebms.local',
      password: 'Admin@123',
      role: 'admin',
      status: 'active',
    },
    {
      first_name: 'MSWDO',
      last_name: 'Administrator',
      username: 'mswdo_admin',
      email: 'mswdo@ebms.local',
      password: 'Admin@123',
      role: 'mswdo_admin',
      status: 'active',
    },
    {
      first_name: 'MSWDO',
      last_name: 'Staff',
      username: 'mswdo_staff',
      email: 'mswdostaff@ebms.local',
      password: 'Admin@123',
      role: 'mswdo_staff',
      status: 'active',
    },
    {
      first_name: 'Senior Citizen',
      last_name: 'Admin',
      username: 'senior_admin',
      email: 'senioradmin@ebms.local',
      password: 'Admin@123',
      role: 'senior_citizen_admin',
      status: 'active',
    },
    {
      first_name: 'PWD',
      last_name: 'Admin',
      username: 'pwd_admin',
      email: 'pwdadmin@ebms.local',
      password: 'Admin@123',
      role: 'pwd_admin',
      status: 'active',
    },
    {
      first_name: 'Senior Citizen',
      last_name: 'Staff',
      username: 'senior_staff',
      email: 'seniorstaff@ebms.local',
      password: 'Admin@123',
      role: 'senior_citizen_staff',
      status: 'active',
    },
    {
      first_name: 'PWD',
      last_name: 'Staff',
      username: 'pwd_staff',
      email: 'pwdstaff@ebms.local',
      password: 'Admin@123',
      role: 'pwd_staff',
      status: 'active',
    },
  ];

  for (const acc of defaultAccounts) {
    try {
      const existing = await User.findOne({
        where: {
          [Op.or]: [
            { email: acc.email },
            { username: acc.username },
          ],
        },
      });

      if (!existing) {
        await User.create(acc);
        console.log(`[Default Accounts] Created ${acc.role} (${acc.username})`);
      } else {
        let needsUpdate = false;
        if (existing.role !== acc.role) {
          existing.role = acc.role;
          needsUpdate = true;
        }
        if (existing.status !== 'active') {
          existing.status = 'active';
          needsUpdate = true;
        }
        if (!existing.username) {
          existing.username = acc.username;
          needsUpdate = true;
        }
        const isMatch = await existing.comparePassword('Admin@123');
        if (!isMatch) {
          existing.password = 'Admin@123';
          needsUpdate = true;
        }
        if (needsUpdate) {
          await existing.save();
          console.log(`[Default Accounts] Synchronized credentials for ${acc.role} (${existing.username})`);
        }
      }
    } catch (err) {
      console.warn(`[Default Accounts] Could not seed/sync ${acc.username}:`, err.message);
    }
  }
};

const createDefaultAdmin = async () => {
  await createDefaultAccounts();
};

const { checkAndProcessExpiredDistributions } = require('./utils/distributionScheduler');

connectDatabase()
  .then(async () => {
    await initFileStorageTable();
    await createDefaultAdmin();
    autoCompleteExpiredAnnouncements().catch((err) => console.error('[ANNOUNCEMENTS] Auto-complete failed:', err.message));
    setInterval(() => {
      autoCompleteExpiredAnnouncements().catch((err) => console.error('[ANNOUNCEMENTS] Auto-complete failed:', err.message));
    }, 30000).unref();

    if (isSmsConfigured()) {
      processQueuedSms().catch((err) => console.error('[SMS] Queue dispatch failed:', err.message));
      setInterval(() => {
        processQueuedSms().catch((err) => console.error('[SMS] Queue dispatch failed:', err.message));
      }, 2000).unref();
    } else {
      console.warn('[SMS] PhilSMS is not configured; announcement SMS will remain queued until PHILSMS_API_TOKEN and PHILSMS_SENDER_ID are set.');
    }
    await checkAndProcessExpiredDistributions();
    setInterval(() => {
      checkAndProcessExpiredDistributions().catch(err => console.error('[SCHEDULER] Error:', err));
    }, 60000);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT} (0.0.0.0)`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${PORT} is in use. Attempting to free it automatically...`);
        try {
          // Find and kill all processes using the port (Windows)
          const result = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          const pidsToKill = new Set();
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && !isNaN(Number(pid))) {
              pidsToKill.add(pid);
            }
          });
          pidsToKill.forEach(pid => {
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
              console.log(`✅ Killed PID ${pid} — restarting...`);
            } catch (e) {
              // Ignore if already terminated
            }
          });
          // Retry listening after 1.5s
          setTimeout(() => {
            server.listen(PORT, '0.0.0.0', () => {
              console.log(`Server is running on port ${PORT} (0.0.0.0)`);
              console.log(`API available at http://localhost:${PORT}/api`);
            });
          }, 1500);
        } catch (killErr) {
          console.warn(`⚠️ Port ${PORT} busy, retrying listen in 2s...`);
          setTimeout(() => {
            server.listen(PORT, '0.0.0.0', () => {
              console.log(`Server is running on port ${PORT} (0.0.0.0)`);
              console.log(`API available at http://localhost:${PORT}/api`);
            });
          }, 2000);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

    // Graceful shutdown — releases port on Ctrl+C or process stop
    const shutdown = () => {
      console.log('\nShutting down server...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
