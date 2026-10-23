const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { Message, User, Beneficiary, Barangay } = require('../db');

const router = express.Router();
router.use(authenticate);

// Helper to get effective barangay_id for a user (checks User and Beneficiary tables)
const getUserBarangayId = async (user) => {
  if (user.barangay_id) return user.barangay_id;
  if (user.role === 'beneficiary') {
    const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
    if (ben && ben.barangay_id) return ben.barangay_id;
  }
  return null;
};

// Get list of users the current user can message
// Senior Citizen Admin & Staff -> Inter-office Admins (MSWDO, DSWD, PWD) + Senior Staff/Admin + ONLY Approved Senior Beneficiaries
// PWD Admin & Staff -> Inter-office Admins (MSWDO, DSWD, Senior) + PWD Staff/Admin + ONLY Approved PWD Beneficiaries
// DSWD Admin -> Inter-office Admins + DSWD Staff / Barangay + ONLY Approved 4Ps Beneficiaries
// MSWDO Admin & Staff -> Inter-office Admins + MSWDO Staff + ONLY Approved Municipal Beneficiaries (Senior & PWD)
// Staff / Barangay -> Admins + Staff from same barangay + ONLY Approved 4Ps Beneficiaries from same barangay
// Beneficiary -> System / Sector Admins and Barangay Staff
router.get('/contacts', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = { status: 'active' };

    if (['senior_citizen_admin', 'senior_citizen_staff'].includes(currentUser.role)) {
      // Senior Citizen Admin & Staff:
      // 1. Inter-office Admins (MSWDO Admin, DSWD Admin, PWD Admin)
      // 2. Fellow Senior Citizen Admin & Staff
      // 3. ONLY APPROVED Senior Citizen Beneficiaries
      const seniorApprovedBenUserIds = (await Beneficiary.findAll({
        where: {
          status: 'Approved',
          category: { [Op.like]: '%Senior%' },
          [Op.and]: [
            { category: { [Op.notLike]: '%4Ps%' } },
            { category: { [Op.notLike]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        // Inter-office Admins + Senior Office Colleagues
        { role: { [Op.in]: ['mswdo_admin', 'admin', 'pwd_admin', 'senior_citizen_admin', 'senior_citizen_staff'] } },
        // ONLY Approved Senior Citizen Beneficiaries
        {
          role: 'beneficiary',
          id: { [Op.in]: seniorApprovedBenUserIds },
        },
      ];
    } else if (['pwd_admin', 'pwd_staff'].includes(currentUser.role)) {
      // PWD Admin & Staff:
      // 1. Inter-office Admins (MSWDO Admin, DSWD Admin, Senior Citizen Admin)
      // 2. Fellow PWD Admin & Staff
      // 3. ONLY APPROVED PWD Beneficiaries
      const pwdApprovedBenUserIds = (await Beneficiary.findAll({
        where: {
          status: 'Approved',
          [Op.or]: [
            { category: { [Op.like]: '%PWD%' } },
            { category: { [Op.like]: '%Disabilit%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        // Inter-office Admins + PWD Office Colleagues
        { role: { [Op.in]: ['mswdo_admin', 'admin', 'senior_citizen_admin', 'pwd_admin', 'pwd_staff'] } },
        // ONLY Approved PWD Beneficiaries
        {
          role: 'beneficiary',
          id: { [Op.in]: pwdApprovedBenUserIds },
        },
      ];
    } else if (currentUser.role === 'admin') {
      // DSWD Admin:
      // 1. Inter-office Admins (MSWDO Admin, Senior Admin, PWD Admin)
      // 2. DSWD Staff & Barangay Staff
      // 3. ONLY APPROVED 4Ps Beneficiaries
      const dswdApprovedBenUserIds = (await Beneficiary.findAll({
        where: {
          status: 'Approved',
          [Op.or]: [
            { category: { [Op.like]: '%4Ps%' } },
            { category: { [Op.like]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        { role: { [Op.in]: ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'barangay'] } },
        {
          role: 'beneficiary',
          id: { [Op.in]: dswdApprovedBenUserIds },
        },
      ];
    } else if (['mswdo_admin', 'mswdo_staff'].includes(currentUser.role)) {
      // MSWDO Admin & Staff:
      // 1. Inter-office Admins (DSWD Admin, Senior Admin, PWD Admin, MSWDO Admin)
      // 2. MSWDO Staff
      // 3. ONLY APPROVED Municipal Beneficiaries (Senior Citizens and PWD)
      const mswdoApprovedBenUserIds = (await Beneficiary.findAll({
        where: {
          status: 'Approved',
          [Op.or]: [
            { category: { [Op.like]: '%Senior%' } },
            { category: { [Op.like]: '%PWD%' } },
            { category: { [Op.like]: '%Disabilit%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        { role: { [Op.in]: ['mswdo_admin', 'admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'] } },
        {
          role: 'beneficiary',
          id: { [Op.in]: mswdoApprovedBenUserIds },
        },
      ];
    } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      // DSWD / Barangay Staff from their assigned barangay
      const userBarangayId = await getUserBarangayId(currentUser);
      if (!userBarangayId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is not assigned to any barangay. Please contact the administrator.' 
        });
      }

      const approvedBeneficiaryUserIds = (await Beneficiary.findAll({
        where: {
          barangay_id: userBarangayId,
          status: 'Approved',
          [Op.or]: [
            { category: { [Op.like]: '%4Ps%' } },
            { category: { [Op.like]: '%Pantawid%' } },
          ],
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        // Admins
        { role: { [Op.in]: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'] } },
        // Staff from SAME barangay
        {
          role: { [Op.in]: ['staff', 'barangay'] },
          barangay_id: userBarangayId,
        },
        // Only APPROVED 4Ps beneficiaries from SAME barangay
        {
          role: 'beneficiary',
          id: { [Op.in]: approvedBeneficiaryUserIds },
        },
      ];
    } else if (currentUser.role === 'beneficiary') {
      // Beneficiaries can only message if their registration is Approved
      const ben = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
      if (!ben || ben.status !== 'Approved') {
        return res.json({ success: true, data: [] });
      }

      const benCategory = String(ben.category || '').toLowerCase();
      const isSeniorBen = benCategory.includes('senior') && !benCategory.includes('4ps');
      const isPwdBen = benCategory.includes('pwd') || benCategory.includes('disabilit');

      const allowedAdmins = ['admin', 'mswdo_admin'];
      if (isSeniorBen) {
        allowedAdmins.push('senior_citizen_admin', 'senior_citizen_staff');
      } else if (isPwdBen) {
        allowedAdmins.push('pwd_admin', 'pwd_staff');
      } else {
        // 4Ps or other
        allowedAdmins.push('senior_citizen_admin', 'pwd_admin');
      }

      const beneficiaryBarangayId = ben.barangay_id || currentUser.barangay_id;
      if (beneficiaryBarangayId) {
        whereClause[Op.or] = [
          { role: { [Op.in]: allowedAdmins } },
          {
            role: { [Op.in]: ['staff', 'barangay'] },
            barangay_id: beneficiaryBarangayId,
          },
        ];
      } else {
        whereClause.role = { [Op.in]: allowedAdmins };
      }
    } else {
      return res.json({ success: true, data: [] });
    }

    const contacts = await User.findAll({
      where: {
        ...whereClause,
        id: { [Op.ne]: currentUser.id },
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status', 'barangay_id'],
      include: [
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
          required: false,
        }
      ],
      order: [['role', 'ASC'], ['first_name', 'ASC']],
    });

    res.json({ success: true, data: contacts });
  } catch (error) {
    next(error);
  }
});

// Get conversations (list of unique users messaged with + last message)
// Supports ?archived=true to retrieve archived conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isArchivedView = req.query.archived === 'true';

    if (isArchivedView) {
      // Get all messages where current user archived them
      const archivedMessages = await Message.findAll({
        where: {
          [Op.or]: [
            { sender_id: userId, archived_by_sender: true },
            { receiver_id: userId, archived_by_receiver: true },
          ],
        },
        order: [['created_at', 'DESC']],
        raw: true,
      });

      // Also find partnerIds with active messages
      const activeMessages = await Message.findAll({
        where: {
          [Op.or]: [
            { sender_id: userId, archived_by_sender: false },
            { receiver_id: userId, archived_by_receiver: false },
          ],
        },
        attributes: ['sender_id', 'receiver_id'],
        raw: true,
      });
      const activePartnerIds = new Set(
        activeMessages.map((m) => (m.sender_id === userId ? m.receiver_id : m.sender_id))
      );

      // Group by partnerId - only include partners whose entire conversation is currently archived (no active unarchived messages)
      // or if they have archived messages
      const conversationMap = {};
      for (const msg of archivedMessages) {
        const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        // If the user already has an active conversation with this partner due to new messages,
        // we can still list or distinguish it
        if (!conversationMap[partnerId]) {
          conversationMap[partnerId] = {
            partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
            isArchived: true,
            hasActiveMessages: activePartnerIds.has(partnerId),
          };
        }
      }

      const partnerIds = Object.keys(conversationMap).map(Number);
      if (partnerIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const partners = await User.findAll({
        where: { id: { [Op.in]: partnerIds } },
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'barangay_id'],
        include: [
          {
            model: Barangay,
            attributes: ['id', 'barangay_name'],
            required: false,
          },
        ],
      });

      const partnerMap = {};
      for (const p of partners) {
        partnerMap[p.id] = p.toJSON ? p.toJSON() : p;
      }

      const conversations = partnerIds
        .map((pid) => ({
          ...conversationMap[pid],
          partner: partnerMap[pid] || null,
        }))
        .filter((c) => c.partner)
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      return res.json({ success: true, data: conversations });
    }

    // Active (non-archived) conversations
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId, archived_by_sender: false },
          { receiver_id: userId, archived_by_receiver: false },
        ],
      },
      order: [['created_at', 'DESC']],
      raw: true,
    });

    // Group by conversation partner
    const conversationMap = {};
    for (const msg of messages) {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!conversationMap[partnerId]) {
        conversationMap[partnerId] = {
          partnerId,
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
          isArchived: false,
        };
      }
      if (msg.receiver_id === userId && !msg.is_read && !msg.archived_by_receiver) {
        conversationMap[partnerId].unreadCount += 1;
      }
    }

    // Get partner user info
    const partnerIds = Object.keys(conversationMap).map(Number);
    if (partnerIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const partners = await User.findAll({
      where: { id: { [Op.in]: partnerIds } },
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'barangay_id'],
      include: [
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
          required: false,
        },
      ],
    });

    const partnerMap = {};
    for (const p of partners) {
      partnerMap[p.id] = p.toJSON ? p.toJSON() : p;
    }

    const conversations = partnerIds
      .map((pid) => ({
        ...conversationMap[pid],
        partner: partnerMap[pid] || null,
      }))
      .filter((c) => c.partner)
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

// Get total unread count (must be before /:partnerId)
router.get('/unread/count', async (req, res, next) => {
  try {
    const count = await Message.count({
      where: {
        receiver_id: req.user.id,
        is_read: false,
        archived_by_receiver: false,
      },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// Archive (delete) entire conversation with partner for current user
router.delete('/conversations/:partnerId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.partnerId, 10);

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Invalid partner id' });
    }

    // Archive messages where user is sender
    await Message.update(
      { archived_by_sender: true },
      {
        where: {
          sender_id: userId,
          receiver_id: partnerId,
        },
      }
    );

    // Archive messages where user is receiver
    await Message.update(
      { archived_by_receiver: true },
      {
        where: {
          sender_id: partnerId,
          receiver_id: userId,
        },
      }
    );

    res.json({
      success: true,
      message: 'Conversation has been archived successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Restore (unarchive) entire conversation with partner for current user
router.post('/conversations/:partnerId/restore', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.partnerId, 10);

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Invalid partner id' });
    }

    // Unarchive messages where user is sender
    await Message.update(
      { archived_by_sender: false },
      {
        where: {
          sender_id: userId,
          receiver_id: partnerId,
        },
      }
    );

    // Unarchive messages where user is receiver
    await Message.update(
      { archived_by_receiver: false },
      {
        where: {
          sender_id: partnerId,
          receiver_id: userId,
        },
      }
    );

    res.json({
      success: true,
      message: 'Conversation restored successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Archive (delete) a single message for current user
router.delete('/:messageId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.messageId, 10);

    const msg = await Message.findByPk(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (msg.sender_id !== userId && msg.receiver_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to archive this message' });
    }

    if (msg.sender_id === userId) {
      msg.archived_by_sender = true;
    }
    if (msg.receiver_id === userId) {
      msg.archived_by_receiver = true;
    }
    await msg.save();

    res.json({
      success: true,
      message: 'Message archived successfully',
      data: msg,
    });
  } catch (error) {
    next(error);
  }
});

// Restore (unarchive) a single message for current user
router.post('/:messageId/restore', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.messageId, 10);

    const msg = await Message.findByPk(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (msg.sender_id !== userId && msg.receiver_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (msg.sender_id === userId) {
      msg.archived_by_sender = false;
    }
    if (msg.receiver_id === userId) {
      msg.archived_by_receiver = false;
    }
    await msg.save();

    res.json({
      success: true,
      message: 'Message restored successfully',
      data: msg,
    });
  } catch (error) {
    next(error);
  }
});

// Get messages with a specific user
// Supports ?archived=true to view archived messages
router.get('/:partnerId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.partnerId, 10);
    const viewArchived = req.query.archived === 'true';

    let whereClause;
    if (viewArchived) {
      whereClause = {
        [Op.or]: [
          { sender_id: userId, receiver_id: partnerId, archived_by_sender: true },
          { sender_id: partnerId, receiver_id: userId, archived_by_receiver: true },
        ],
      };
    } else {
      whereClause = {
        [Op.or]: [
          { sender_id: userId, receiver_id: partnerId, archived_by_sender: false },
          { sender_id: partnerId, receiver_id: userId, archived_by_receiver: false },
        ],
      };
    }

    const messages = await Message.findAll({
      where: whereClause,
      order: [['created_at', 'ASC']],
    });

    // Mark messages from partner as read (only if viewing active messages)
    if (!viewArchived) {
      await Message.update(
        { is_read: true },
        {
          where: {
            sender_id: partnerId,
            receiver_id: userId,
            is_read: false,
            archived_by_receiver: false,
          },
        }
      );
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// Send a message
router.post('/', async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'Receiver and content are required' });
    }

    // Validate messaging permissions
    const currentRole = req.user.role;
    const receiver = await User.findByPk(receiver_id);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const receiverRole = receiver.role;

    // 1. Senior Citizen Admin & Staff
    if (['senior_citizen_admin', 'senior_citizen_staff'].includes(currentRole)) {
      const allowedColleagues = ['mswdo_admin', 'admin', 'pwd_admin', 'senior_citizen_admin', 'senior_citizen_staff'];
      if (allowedColleagues.includes(receiverRole)) {
        // Allowed to message inter-office admins and colleagues
      } else if (receiverRole === 'beneficiary') {
        const ben = await Beneficiary.findOne({ where: { user_id: receiver.id } });
        const cat = String(ben?.category || '').toLowerCase();
        if (!ben || ben.status !== 'Approved' || !cat.includes('senior') || cat.includes('4ps')) {
          return res.status(403).json({ success: false, message: 'Senior Citizen Admin/Staff can only message approved Senior Citizen beneficiaries.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid recipient for Senior Citizen office.' });
      }
    }
    // 2. PWD Admin & Staff
    else if (['pwd_admin', 'pwd_staff'].includes(currentRole)) {
      const allowedColleagues = ['mswdo_admin', 'admin', 'senior_citizen_admin', 'pwd_admin', 'pwd_staff'];
      if (allowedColleagues.includes(receiverRole)) {
        // Allowed to message inter-office admins and colleagues
      } else if (receiverRole === 'beneficiary') {
        const ben = await Beneficiary.findOne({ where: { user_id: receiver.id } });
        const cat = String(ben?.category || '').toLowerCase();
        if (!ben || ben.status !== 'Approved' || (!cat.includes('pwd') && !cat.includes('disabilit'))) {
          return res.status(403).json({ success: false, message: 'PWD Admin/Staff can only message approved PWD beneficiaries.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid recipient for PWD office.' });
      }
    }
    // 3. DSWD Admin (admin)
    else if (currentRole === 'admin') {
      const allowedColleagues = ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'barangay'];
      if (allowedColleagues.includes(receiverRole)) {
        // Allowed to message admins and DSWD staff
      } else if (receiverRole === 'beneficiary') {
        const ben = await Beneficiary.findOne({ where: { user_id: receiver.id } });
        if (!ben || ben.status !== 'Approved') {
          return res.status(403).json({ success: false, message: 'Admin can only message approved beneficiaries.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid recipient.' });
      }
    }
    // 4. MSWDO Admin & Staff
    else if (['mswdo_admin', 'mswdo_staff'].includes(currentRole)) {
      const allowedColleagues = ['admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_admin', 'mswdo_staff'];
      if (allowedColleagues.includes(receiverRole)) {
        // Allowed to message inter-office admins and MSWDO staff
      } else if (receiverRole === 'beneficiary') {
        const ben = await Beneficiary.findOne({ where: { user_id: receiver.id } });
        if (!ben || ben.status !== 'Approved') {
          return res.status(403).json({ success: false, message: 'Can only message approved municipal beneficiaries.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid recipient.' });
      }
    }
    // 5. Staff can message:
    // - Admin (any barangay)
    // - Other staff / barangay from SAME barangay only
    // - Beneficiaries from SAME barangay only
    else if (currentRole === 'staff' || currentRole === 'barangay') {
      const senderBarangayId = await getUserBarangayId(req.user);
      if (!senderBarangayId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is not assigned to any barangay. Please contact the administrator.' 
        });
      }

      if (['admin','mswdo_admin','senior_citizen_admin','pwd_admin'].includes(receiverRole)) {
        // Allowed
      } else if (receiverRole === 'staff' || receiverRole === 'barangay') {
        const receiverBarangayId = await getUserBarangayId(receiver);
        if (receiverBarangayId !== senderBarangayId) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only message staff from your assigned barangay.' 
          });
        }
      } else if (receiverRole === 'beneficiary') {
        const receiverBarangayId = await getUserBarangayId(receiver);
        if (receiverBarangayId !== senderBarangayId) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only message beneficiaries from your assigned barangay.' 
          });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid message recipient' });
      }
    }
    
    // 6. Beneficiary can message:
    // - Authorized Administrators and Staff
    // - Staff from their registered barangay only (Approved beneficiaries only)
    else if (currentRole === 'beneficiary') {
      const ben = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!ben || ben.status !== 'Approved') {
        return res.status(403).json({ 
          success: false, 
          message: 'Messaging is only available once your beneficiary registration is approved.' 
        });
      }

      const benCategory = String(ben.category || '').toLowerCase();
      const isSeniorBen = benCategory.includes('senior') && !benCategory.includes('4ps');
      const isPwdBen = benCategory.includes('pwd') || benCategory.includes('disabilit');

      const allowedAdmins = ['admin', 'mswdo_admin'];
      if (isSeniorBen) {
        allowedAdmins.push('senior_citizen_admin', 'senior_citizen_staff');
      } else if (isPwdBen) {
        allowedAdmins.push('pwd_admin', 'pwd_staff');
      } else {
        allowedAdmins.push('senior_citizen_admin', 'pwd_admin');
      }

      const beneficiaryBarangayId = ben.barangay_id || req.user.barangay_id;

      if (allowedAdmins.includes(receiverRole)) {
        // Allowed to message authorized Administrators and Staff
      } else if (receiverRole === 'staff' || receiverRole === 'barangay') {
        if (!beneficiaryBarangayId) {
          return res.status(403).json({ 
            success: false, 
            message: 'Your beneficiary account is not registered to a barangay. You can contact the Office Administrator.' 
          });
        }
        const receiverBarangayId = await getUserBarangayId(receiver);
        if (receiverBarangayId !== beneficiaryBarangayId) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only message staff from your registered barangay.' 
          });
        }
      } else if (receiverRole === 'beneficiary') {
        return res.status(403).json({ 
          success: false, 
          message: 'Beneficiaries cannot send messages to other beneficiaries.' 
        });
      } else {
        return res.status(403).json({ success: false, message: 'Invalid message recipient' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'You do not have permission to send messages' });
    }

    const message = await Message.create({
      sender_id: senderId,
      receiver_id: Number(receiver_id),
      content: content.trim(),
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
