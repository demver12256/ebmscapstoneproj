require('dotenv').config();
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');

const { connectDatabase, User } = require('./db');
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
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
].filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', cors(), express.static(path.join(__dirname, 'uploads')));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/barangays', barangayRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
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
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to EBMS API' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const createDefaultAdmin = async () => {
  const adminEmail = 'admin@ebms.local';
  await User.findOrCreate({
    where: { email: adminEmail },
    defaults: {
      first_name: 'System',
      last_name: 'Administrator',
      email: adminEmail,
      password: 'Admin@123',
      role: 'admin',
      status: 'active',
    },
  });
};

const { checkAndProcessExpiredDistributions } = require('./utils/distributionScheduler');

connectDatabase()
  .then(async () => {
    await createDefaultAdmin();
    await checkAndProcessExpiredDistributions();
    setInterval(() => {
      checkAndProcessExpiredDistributions().catch(err => console.error('[SCHEDULER] Error:', err));
    }, 60000);

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
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
            server.listen(PORT, () => {
              console.log(`Server is running on port ${PORT}`);
              console.log(`API available at http://localhost:${PORT}/api`);
            });
          }, 1500);
        } catch (killErr) {
          console.warn(`⚠️ Port ${PORT} busy, retrying listen in 2s...`);
          setTimeout(() => {
            server.listen(PORT, () => {
              console.log(`Server is running on port ${PORT}`);
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
