const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { Message, User } = require('../db');

const router = express.Router();
router.use(authenticate);

// Get list of users the current user can message
// Admin -> all staff and barangay users
// Staff -> admin, staff from same barangay, beneficiaries from same barangay
router.get('/contacts', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = { status: 'active' };

    if (currentUser.role === 'admin') {
      // Admin can message all staff and barangay users
      whereClause.role = { [Op.in]: ['staff', 'barangay'] };
    } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      // Staff can only message:
      // 1. Admin users
      // 2. Staff from their SAME barangay only
      // 3. Beneficiaries from their SAME barangay only
      
      if (!currentUser.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is not assigned to any barangay. Please contact the administrator.' 
        });
      }

      whereClause[Op.or] = [
        // Admin (any barangay)
        { role: 'admin' },
        // Staff from the SAME barangay only
        { 
          role: 'staff',
          barangay_id: currentUser.barangay_id
        },
        // Beneficiaries from the SAME barangay only
        { 
          role: 'beneficiary',
          barangay_id: currentUser.barangay_id
        }
      ];
    } else {
      // Beneficiaries cannot see contacts list
      return res.json({ success: true, data: [] });
    }

    const contacts = await User.findAll({
      where: {
        ...whereClause,
        id: { [Op.ne]: currentUser.id },
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status', 'barangay_id'],
      order: [['role', 'ASC'], ['first_name', 'ASC']],
    });

    res.json({ success: true, data: contacts });
  } catch (error) {
    next(error);
  }
});

// Get conversations (list of unique users messaged with + last message)
router.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all messages involving this user
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId },
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
        };
      }
      if (msg.receiver_id === userId && !msg.is_read) {
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
      attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
      raw: true,
    });

    const partnerMap = {};
    for (const p of partners) {
      partnerMap[p.id] = p;
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
      },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// Get messages with a specific user
router.get('/:partnerId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.partnerId, 10);

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId, receiver_id: partnerId },
          { sender_id: partnerId, receiver_id: userId },
        ],
      },
      order: [['created_at', 'ASC']],
    });

    // Mark messages from partner as read
    await Message.update(
      { is_read: true },
      {
        where: {
          sender_id: partnerId,
          receiver_id: userId,
          is_read: false,
        },
      }
    );

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

    // Admin can only message staff and barangay users
    if (currentRole === 'admin' && !['staff', 'barangay'].includes(receiverRole)) {
      return res.status(403).json({ success: false, message: 'Admin can only message staff and barangay users' });
    }
    
    // Staff can message:
    // 1. Admin (any barangay)
    // 2. Other staff from SAME barangay only
    // 3. Beneficiaries from SAME barangay only
    if (currentRole === 'staff' || currentRole === 'barangay') {
      if (!req.user.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is not assigned to any barangay. Please contact the administrator.' 
        });
      }

      // Can message admin
      if (receiverRole === 'admin') {
        // Allowed
      } 
      // Can only message staff from SAME barangay
      else if (receiverRole === 'staff') {
        if (receiver.barangay_id !== req.user.barangay_id) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only message staff from your assigned barangay.' 
          });
        }
      }
      // Can only message beneficiaries from SAME barangay
      else if (receiverRole === 'beneficiary') {
        if (receiver.barangay_id !== req.user.barangay_id) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only message beneficiaries from your assigned barangay.' 
          });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Invalid message recipient' });
      }
    }
    
    // Beneficiaries and other roles cannot send messages
    if (currentRole !== 'admin' && currentRole !== 'staff' && currentRole !== 'barangay') {
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
