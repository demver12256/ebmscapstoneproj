const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { AssistanceRequest, Beneficiary, User, Barangay, Notification, SMSNotification, AuditLog } = require('../db');

// Configure multer storage for assistance request attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/documents/assistance');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'assist-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and WEBP are allowed.'));
    }
  },
});

const router = express.Router();
router.use(authenticate);

// Helper to get effective barangay_id for a user
const getUserBarangayId = async (user) => {
  if (user.barangay_id) return user.barangay_id;
  if (user.role === 'beneficiary') {
    const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
    if (ben && ben.barangay_id) return ben.barangay_id;
  }
  return null;
};

// GET /api/assistance-requests/stats — Summary counts by status
router.get('/stats', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = {};

    if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      const brgyId = await getUserBarangayId(currentUser);
      if (brgyId) whereClause.barangay_id = brgyId;
    } else if (currentUser.role === 'beneficiary') {
      const ben = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
      if (ben) {
        whereClause[Op.or] = [{ user_id: currentUser.id }, { beneficiary_id: ben.id }];
      } else {
        whereClause.user_id = currentUser.id;
      }
    } else if (currentUser.role === 'mswdo_admin') {
      // MSWDO Admin strictly accesses requests directed to MSWDO
      whereClause.agency = 'MSWDO';
    } else if (currentUser.role === 'admin') {
      whereClause.agency = 'DSWD';
    }

    const statuses = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'];
    const counts = {};
    for (const status of statuses) {
      counts[status] = await AssistanceRequest.count({ where: { ...whereClause, status } });
    }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: counts });
  } catch (error) {
    next(error);
  }
});

// GET /api/assistance-requests — List requests
router.get('/', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = {};

    if (currentUser.role === 'beneficiary') {
      // Beneficiary sees only their own requests
      const ben = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
      if (ben) {
        whereClause[Op.or] = [{ user_id: currentUser.id }, { beneficiary_id: ben.id }];
      } else {
        whereClause.user_id = currentUser.id;
      }
    } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      // Staff sees requests from their barangay only
      const brgyId = await getUserBarangayId(currentUser);
      if (brgyId) {
        whereClause.barangay_id = brgyId;
      } else {
        return res.json({ success: true, data: [] });
      }
    } else if (currentUser.role === 'mswdo_admin') {
      // MSWDO Admin strictly accesses requests directed to MSWDO
      whereClause.agency = 'MSWDO';
    } else if (currentUser.role === 'admin') {
      whereClause.agency = 'DSWD';
    }

    // Apply filters from query params
    if (req.query.status && req.query.status !== 'all') {
      whereClause.status = req.query.status;
    }
    if (req.query.type && req.query.type !== 'all') {
      whereClause.type = req.query.type;
    }
    if (req.query.priority && req.query.priority !== 'all') {
      whereClause.priority = req.query.priority;
    }

    const requests = await AssistanceRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'first_name', 'last_name', 'category', 'profile_picture'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
        },
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
        },
        {
          model: User,
          as: 'Reviewer',
          attributes: ['id', 'first_name', 'last_name', 'role'],
        },
      ],
      order: [
        ['status', 'ASC'],
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistance-requests — Beneficiary or Admin/MSWDO creates a new request
router.post('/', upload.any(), async (req, res, next) => {
  try {
    const currentUser = req.user;

    if (!['beneficiary', 'admin', 'mswdo_admin'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to submit assistance requests.' });
    }

    let targetBeneficiary = null;
    let targetAgency = req.body.agency || 'DSWD';

    if (currentUser.role === 'beneficiary') {
      targetBeneficiary = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
      if (!targetBeneficiary || targetBeneficiary.status !== 'Approved') {
        return res.status(403).json({ success: false, message: 'Your beneficiary registration must be approved first.' });
      }
    } else {
      // Admin / MSWDO Admin creating request on behalf of a beneficiary
      if (!req.body.beneficiary_id) {
        return res.status(400).json({ success: false, message: 'beneficiary_id is required.' });
      }
      targetBeneficiary = await Beneficiary.findByPk(req.body.beneficiary_id);
      if (!targetBeneficiary) {
        return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
      }
      if (currentUser.role === 'mswdo_admin') {
        targetAgency = 'MSWDO';
        const { isMswdoCategory } = require('../utils/roles');
        if (!isMswdoCategory(targetBeneficiary.category)) {
          return res.status(403).json({ success: false, message: 'MSWDO Admin can only create assistance requests for Senior Citizens and PWDs.' });
        }
      } else if (currentUser.role === 'admin') {
        targetAgency = req.body.agency || 'DSWD';
      }
    }

    const { type, subject, description, priority } = req.body;

    if (!type || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Type, subject, and description are required.' });
    }

    // CROSS-AGENCY EXCLUSIVITY RULE:
    // If a beneficiary already requested this assistance type from the other agency (DSWD vs MSWDO),
    // they are not allowed to request the same assistance type at the other agency (vice versa).
    const otherAgency = targetAgency === 'DSWD' ? 'MSWDO' : 'DSWD';
    const existingCrossRequest = await AssistanceRequest.findOne({
      where: {
        beneficiary_id: targetBeneficiary.id,
        type,
        agency: otherAgency,
        status: { [Op.in]: ['Pending', 'Under Review', 'Approved', 'Completed'] },
      },
    });

    if (existingCrossRequest) {
      return res.status(409).json({
        success: false,
        message: `Hindi pinapayagan ang duplicate request: Nakapag-request ka na ng "${type}" sa ${otherAgency} (Status: ${existingCrossRequest.status}). Bawal mag-request ng parehong uri ng tulong sa DSWD at MSWDO nang sabay o magkasunod.`,
      });
    }

    // Also block duplicate if exact same type is currently Pending or Under Review in the same agency
    const existingSameRequest = await AssistanceRequest.findOne({
      where: {
        beneficiary_id: targetBeneficiary.id,
        type,
        agency: targetAgency,
        status: { [Op.in]: ['Pending', 'Under Review'] },
      },
    });

    if (existingSameRequest) {
      return res.status(409).json({
        success: false,
        message: `Mayroon ka nang kasalukuyang kahilingan para sa "${type}" sa ${targetAgency} na kasalukuyang ${existingSameRequest.status}. Mangyaring hintayin muna itong maproseso.`,
      });
    }

    let attachmentUrl = null;
    let attachmentMetadata = [];
    if (req.body.attachment_metadata) {
      try {
        attachmentMetadata = JSON.parse(req.body.attachment_metadata);
      } catch (e) {}
    }

    const uploadedFiles = (req.files && req.files.length > 0)
      ? req.files
      : (req.file ? [req.file] : []);

    if (uploadedFiles.length === 1 && (!attachmentMetadata || attachmentMetadata.length === 0)) {
      attachmentUrl = `/uploads/documents/assistance/${uploadedFiles[0].filename}`;
    } else if (uploadedFiles.length > 0) {
      attachmentUrl = JSON.stringify(
        uploadedFiles.map((f, i) => {
          const meta = Array.isArray(attachmentMetadata)
            ? (attachmentMetadata.find((m) => m.originalName === f.originalname) || attachmentMetadata[i] || {})
            : {};
          return {
            requirementId: meta.reqId || null,
            requirementName: meta.reqName || null,
            name: f.originalname,
            url: `/uploads/documents/assistance/${f.filename}`,
            size: f.size,
            mimetype: f.mimetype,
          };
        })
      );
    } else if (req.body.attachment_url) {
      attachmentUrl = req.body.attachment_url;
    }

    const request = await AssistanceRequest.create({
      beneficiary_id: targetBeneficiary.id,
      user_id: currentUser.id,
      barangay_id: targetBeneficiary.barangay_id,
      agency: targetAgency,
      type,
      subject: subject.trim(),
      description: description.trim(),
      priority: priority || 'Normal',
      status: req.body.status || 'Pending',
      attachment_url: attachmentUrl,
      admin_notes: req.body.admin_notes || null,
    });

    // Automatically dispatch submission confirmation notification to beneficiary
    try {
      const recipientUserId = targetBeneficiary.user_id || currentUser.id;
      if (recipientUserId) {
        await Notification.create({
          user_id: recipientUserId,
          title: `Kahilingan sa Ayuda: ${type} (${targetAgency})`,
          message: `Ang iyong kahilingan para sa ${type} sa tanggapan ng ${targetAgency} (#${request.id}) ay matagumpay na naisumite at kasalukuyang nasa katayuang "Pending". Maaari mo itong subaybayan sa My Benefits page.`,
          type: 'system',
          reference_id: request.id,
          reference_type: 'assistance_request',
          is_read: false,
        });
      }
    } catch (notifErr) {
      console.error('Failed to create assistance submission notification:', notifErr);
    }

    res.status(201).json({ success: true, data: request, message: `Assistance request submitted successfully to ${targetAgency}.` });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/assistance-requests/:id/status — Admin/Staff updates request status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const currentUser = req.user;

    if (!['admin', 'mswdo_admin'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Tanging DSWD o MSWDO Admin lamang ang may karapatang mag-apruba o magbago ng status ng assistance request.',
      });
    }

    const request = await AssistanceRequest.findByPk(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // MSWDO Admin can only manage requests directed to MSWDO
    if (currentUser.role === 'mswdo_admin') {
      if (request.agency !== 'MSWDO') {
        return res.status(403).json({ success: false, message: 'Access denied: MSWDO Admin can only update assistance requests directed to MSWDO.' });
      }
    }
    // DSWD Admin can only manage requests directed to DSWD
    if (currentUser.role === 'admin') {
      if (request.agency === 'MSWDO') {
        return res.status(403).json({ success: false, message: 'Access denied: DSWD Admin cannot update assistance requests directed to MSWDO.' });
      }
    }

    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const validStatuses = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    // Kapag in-approve ng Admin, gawing Completed (Ready to Claim) na ito
    const finalStatus = status === 'Approved' ? 'Completed' : status;

    request.status = finalStatus;
    if (admin_notes !== undefined) {
      request.admin_notes = admin_notes;
    }
    request.reviewed_by = currentUser.id;
    request.reviewed_at = new Date();
    await request.save();

    // Reload with associations
    const updated = await AssistanceRequest.findByPk(request.id, {
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'user_id', 'first_name', 'last_name', 'contact_number', 'category'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
        },
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
        },
        {
          model: User,
          as: 'Reviewer',
          attributes: ['id', 'first_name', 'last_name', 'role'],
        },
      ],
    });

    // Automatically dispatch status update notification & SMS to beneficiary
    try {
      const recipientUserId = updated.Beneficiary?.user_id || updated.user_id;
      let statusLabel = finalStatus;
      let statusDesc = `Ang katayuan ng iyong kahilingan (#${request.id}) ay na-update sa "${finalStatus}".`;

      if (finalStatus === 'Under Review') {
        statusLabel = 'Sinusuri (Under Review)';
        statusDesc = `Ang iyong kahilingan para sa ${request.type} sa tanggapan ng ${request.agency} (#${request.id}) ay kasalukuyan nang sinusuri at bini-beripika ng mga opisyal.`;
      } else if (finalStatus === 'Completed' || status === 'Approved') {
        statusLabel = 'Na-aprubahan at Handa nang I-claim (Completed)';
        statusDesc = `🎉 Magandang balita! Ang iyong kahilingan para sa ${request.type} sa ${request.agency} (#${request.id}) ay NA-APRUBAHAN at COMPLETED na! Maaari mo na itong i-claim o tanggapin ang tulong sa tanggapan ng ${request.agency} o sa nakatakdang payout.`;
      } else if (finalStatus === 'Rejected') {
        statusLabel = 'Hindi Naaprubahan (Rejected)';
        statusDesc = `Ipinapaalam na ang iyong kahilingan para sa ${request.type} sa ${request.agency} (#${request.id}) ay hindi naaprubahan.`;
      }

      const fullMessage = admin_notes
        ? `${statusDesc} Paalala mula sa tanggapan: "${admin_notes}". Subaybayan sa My Benefits.`
        : `${statusDesc} Maaari mo itong subaybayan sa My Benefits page.`;

      if (recipientUserId) {
        await Notification.create({
          user_id: recipientUserId,
          title: `Update sa Ayuda: ${request.type} - ${statusLabel}`,
          message: fullMessage,
          type: 'system',
          reference_id: request.id,
          reference_type: 'assistance_request',
          is_read: false,
        });
      }

      // SMS Notification if contact number exists
      const contactNo = updated.Beneficiary?.contact_number;
      if (contactNo && updated.beneficiary_id) {
        await SMSNotification.create({
          beneficiary_id: updated.beneficiary_id,
          message: `EBMS Ayuda Alert: Ang iyong ${request.type} sa ${request.agency} (#${request.id}) ay "${status}". ${admin_notes ? `Paalala: ${admin_notes}` : ''}`.trim(),
          status: 'queued',
        });
      }
    } catch (notifErr) {
      console.error('Failed to send assistance status update notification:', notifErr);
    }

    return res.json({
      success: true,
      message: `Assistance request status updated to ${finalStatus}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistance-requests/claim-rfid — Claim assistance request using Beneficiary RFID Card
router.post('/claim-rfid', async (req, res, next) => {
  try {
    const currentUser = req.user;
    if (!['admin', 'mswdo_admin'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Tanging DSWD o MSWDO Admin lamang ang may karapatang mag-release ng tulong gamit ang RFID scanner.',
      });
    }

    const { rfid_number, request_id, valid_id_verified } = req.body;
    const cleanRfid = String(rfid_number || '').trim();

    if (!cleanRfid) {
      return res.status(400).json({ success: false, message: 'RFID number is required.' });
    }

    if (!valid_id_verified) {
      return res.status(400).json({
        success: false,
        message: 'Pakiusap suriin at i-beripika muna ang Valid ID ng benepisyaryo bago i-tap ang RFID.',
      });
    }

    // Find beneficiary by RFID
    const beneficiary = await Beneficiary.findOne({
      where: { RFID_number: cleanRfid },
      include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: `Hindi nahanap ang benepisyaryo na may RFID number: ${cleanRfid}. Siguraduhing nakarehistro ang RFID card.`,
      });
    }

    // Find assistance request(s) eligible for claim for this beneficiary
    let queryWhere = {
      beneficiary_id: beneficiary.id,
      status: 'Completed',
      claimed_at: null,
    };

    // If specific request_id provided
    if (request_id) {
      queryWhere.id = request_id;
    }

    // Agency scoping
    if (currentUser.role === 'mswdo_admin') {
      queryWhere.agency = 'MSWDO';
    } else if (currentUser.role === 'admin') {
      queryWhere.agency = 'DSWD';
    }

    const assistanceReq = await AssistanceRequest.findOne({
      where: queryWhere,
      order: [['created_at', 'DESC']],
    });

    if (!assistanceReq) {
      // Check if already claimed
      const alreadyClaimed = await AssistanceRequest.findOne({
        where: {
          beneficiary_id: beneficiary.id,
          claimed_at: { [Op.ne]: null },
          ...(request_id ? { id: request_id } : {}),
        },
      });

      if (alreadyClaimed) {
        return res.status(400).json({
          success: false,
          message: `Ang assistance request para kay ${beneficiary.first_name} ${beneficiary.last_name} (#${alreadyClaimed.id} - ${alreadyClaimed.type}) ay NA-CLAIM NA noong ${new Date(alreadyClaimed.claimed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
        });
      }

      return res.status(404).json({
        success: false,
        message: `Walang nakitang na-aprubahang assistance request para kay ${beneficiary.first_name} ${beneficiary.last_name} na handa nang i-claim sa tanggapan ng ${currentUser.role === 'mswdo_admin' ? 'MSWDO' : 'DSWD'}.`,
      });
    }

    // Mark as Claimed
    assistanceReq.claimed_at = new Date();
    assistanceReq.claimed_by = currentUser.id;
    assistanceReq.rfid_scanned = cleanRfid;
    assistanceReq.valid_id_verified = true;
    await assistanceReq.save();

    // Create Audit Log
    try {
      await AuditLog.create({
        user_id: currentUser.id,
        action: `Assistance Request #${assistanceReq.id} (${assistanceReq.type}) claimed via RFID tap for beneficiary ${beneficiary.first_name} ${beneficiary.last_name} with Valid ID verified.`,
        module: 'Assistance Management',
      });
    } catch (e) {}

    // Send Notification to beneficiary
    try {
      if (beneficiary.user_id) {
        await Notification.create({
          user_id: beneficiary.user_id,
          title: `✅ Assistance Request Claimed: ${assistanceReq.type}`,
          message: `Matagumpay mong na-claim ang iyong ${assistanceReq.type} sa ${assistanceReq.agency} (#${assistanceReq.id}) gamit ang iyong RFID card matapos ma-beripika ang iyong Valid ID.`,
          type: 'system',
          reference_id: assistanceReq.id,
          reference_type: 'assistance_request',
          is_read: false,
        });
      }
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Assistance request is claimed!',
      data: {
        request: assistanceReq,
        beneficiary: {
          id: beneficiary.id,
          name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          category: beneficiary.category,
          barangay: beneficiary.Barangay?.barangay_name,
          rfid: cleanRfid,
        },
        claimed_at: assistanceReq.claimed_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
