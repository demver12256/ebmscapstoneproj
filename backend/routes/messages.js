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
// Admin -> all staff, barangay, and beneficiary users
// Staff -> admin, staff from same barangay, beneficiaries from same barangay
// Beneficiary -> system administrator, staff from their registered barangay
router.get('/contacts', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = { status: 'active' };

    if (['admin','mswdo_admin'].includes(currentUser.role)) {
      // Admin can message all staff/barangay users and only APPROVED beneficiaries
      const approvedBeneficiaryUserIds = (await Beneficiary.findAll({
        where: { status: 'Approved' },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        { role: { [Op.in]: ['staff','barangay'] } },
        { 
          role: 'beneficiary',
          id: { [Op.in]: approvedBeneficiaryUserIds }
        }
      ];
    } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      // Staff can only message:
      // 1. Admin users
      // 2. Staff / Barangay users from their SAME barangay only
      // 3. Only APPROVED beneficiaries from their SAME barangay
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
        },
        attributes: ['user_id'],
        raw: true,
      })).map((b) => b.user_id).filter(Boolean);

      whereClause[Op.or] = [
        // Admin (any barangay)
        { role: { [Op.in]: ['admin','mswdo_admin'] } },
        // Staff from the SAME barangay only
        { 
          role: { [Op.in]: ['staff','barangay'] },
          barangay_id: userBarangayId
        },
        // Only APPROVED beneficiaries from the SAME barangay
        { 
          role: 'beneficiary',
          id: { [Op.in]: approvedBeneficiaryUserIds }
        }
      ];
    } else if (currentUser.role === 'beneficiary') {
      // Beneficiaries can only message if their registration is Approved
      const ben = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
      if (!ben || ben.status !== 'Approved') {
        return res.json({ success: true, data: [] });
      }

      const beneficiaryBarangayId = ben.barangay_id || currentUser.barangay_id;

      if (beneficiaryBarangayId) {
        whereClause[Op.or] = [
          // System Administrator
          { role: { [Op.in]: ['admin','mswdo_admin'] } },
          // Staff from their registered barangay
          { 
            role: { [Op.in]: ['staff','barangay'] },
            barangay_id: beneficiaryBarangayId
          }
        ];
      } else {
        // If no barangay assigned yet, they can still contact System Admin
        whereClause.role = { [Op.in]: ['admin','mswdo_admin'] };
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

    // 1. Admin can message staff, barangay, and beneficiaries
    if (['admin','mswdo_admin'].includes(currentRole)) {
      if (!['staff', 'barangay', 'beneficiary'].includes(receiverRole)) {
        return res.status(403).json({ success: false, message: 'Admin can only message staff, barangay, and beneficiary users' });
      }
    }
    
    // 2. Staff can message:
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

      if (['admin','mswdo_admin'].includes(receiverRole)) {
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
    
    // 3. Beneficiary can message:
    // - System Administrator (role: 'admin')
    // - Staff from their registered barangay only (Approved beneficiaries only)
    else if (currentRole === 'beneficiary') {
      const ben = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!ben || ben.status !== 'Approved') {
        return res.status(403).json({ 
          success: false, 
          message: 'Messaging is only available once your beneficiary registration is approved.' 
        });
      }

      const beneficiaryBarangayId = ben.barangay_id || req.user.barangay_id;

      if (['admin','mswdo_admin'].includes(receiverRole)) {
        // Allowed to message System Administrator
      } else if (receiverRole === 'staff' || receiverRole === 'barangay') {
        if (!beneficiaryBarangayId) {
          return res.status(403).json({ 
            success: false, 
            message: 'Your beneficiary account is not registered to a barangay. You can contact the System Administrator.' 
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
