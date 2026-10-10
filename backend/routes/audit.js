const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { AuditLog, User, Beneficiary, Announcement, SMSNotification, sequelize } = require('../db');
const { isConfigured } = require('../services/smsService');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/audit — Paginated audit logs with search and filtering
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search, module: qModule, start_date, end_date } = req.query;

    const where = {};
    if (qModule && qModule !== 'all') {
      where.module = qModule;
    }
    if (start_date && end_date) {
      where.timestamp = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.timestamp = { [Op.gte]: start_date };
    } else if (end_date) {
      where.timestamp = { [Op.lte]: end_date };
    }

    const userWhere = {};
    if (search) {
      where[Op.or] = [
        { action: { [Op.like]: `%${search}%` } },
        { module: { [Op.like]: `%${search}%` } },
        sequelize.where(
          sequelize.fn('concat', sequelize.col('User.first_name'), ' ', sequelize.col('User.last_name')),
          { [Op.like]: `%${search}%` }
        ),
        sequelize.where(sequelize.col('User.email'), { [Op.like]: `%${search}%` }),
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          required: false,
        },
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Compute summary stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, allModules] = await Promise.all([
      AuditLog.count({ where: { timestamp: { [Op.gte]: todayStart } } }),
      AuditLog.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('module')), 'module']],
        raw: true,
      }),
    ]);

    const moduleList = allModules.map(m => m.module).filter(Boolean);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1,
      },
      stats: {
        totalLogs: count,
        todayLogs: todayCount,
        modules: moduleList,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/system-logs — Live System Health & Diagnostics Log
router.get('/system-logs', async (req, res, next) => {
  try {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;

    // Database test latency
    let dbStatus = 'Connected';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await sequelize.authenticate();
      dbLatencyMs = Date.now() - start;
    } catch (e) {
      dbStatus = 'Disconnected / Error';
    }

    // Table counts
    const [auditCount, smsCount, userCount, benCount, annCount] = await Promise.all([
      AuditLog.count().catch(() => 0),
      SMSNotification.count().catch(() => 0),
      User.count().catch(() => 0),
      Beneficiary.count().catch(() => 0),
      Announcement.count().catch(() => 0),
    ]);

    // System automated audit events (e.g. background sweeps, announcements concluded, etc.)
    const systemEvents = await AuditLog.findAll({
      where: {
        [Op.or]: [
          { action: { [Op.like]: 'AUTO_%' } },
          { action: { [Op.like]: 'SYSTEM_%' } },
          { module: { [Op.in]: ['System', 'Announcements', 'Authentication'] } },
        ],
      },
      include: [
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email', 'role'] },
      ],
      order: [['timestamp', 'DESC']],
      limit: 30,
    });

    res.json({
      success: true,
      data: {
        server: {
          platform: process.platform,
          nodeVersion: process.version,
          uptimeSeconds,
          uptimeFormatted,
          serverTime: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'production',
          memory: {
            rss: `${(memory.rss / 1024 / 1024).toFixed(1)} MB`,
            heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(1)} MB`,
            heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          },
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          dialect: 'MySQL',
          counts: {
            audit_logs: auditCount,
            sms_notifications: smsCount,
            users: userCount,
            beneficiaries: benCount,
            announcements: annCount,
          },
        },
        services: {
          smsGateway: {
            provider: 'PhilSMS',
            configured: isConfigured(),
            status: isConfigured() ? 'Active / Connected' : 'Unconfigured (Simulation/Mock)',
          },
          scheduler: {
            name: 'Announcement & Absence Auto-Sweep',
            status: 'Running',
            interval: 'Active every 60s',
          },
        },
        systemEvents,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
