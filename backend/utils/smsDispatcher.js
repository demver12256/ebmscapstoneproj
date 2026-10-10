const { SMSNotification, Beneficiary, User, AnnouncementRecipient } = require('../db');
const { isConfigured, sendSms } = require('../services/smsService');

let dispatchInProgress = false;

async function sendNotification(notification) {
  try {
    let phoneNumber = notification.phone_number;
    if (!phoneNumber) {
      const beneficiary = await Beneficiary.findByPk(notification.beneficiary_id);
      phoneNumber = beneficiary?.contact_number;
      if (!phoneNumber && beneficiary?.user_id) {
        const user = await User.findByPk(beneficiary.user_id);
        phoneNumber = user?.contact_number;
      }
    }

    if (!phoneNumber) throw new Error('Beneficiary has no mobile number on file.');
    const delivery = await sendSms(phoneNumber, notification.message);
    await notification.update({
      phone_number: phoneNumber,
      status: 'sent',
      sent_at: new Date(),
      provider_message_id: delivery.providerMessageId,
      failure_reason: null,
    });
    if (notification.announcement_id && notification.notification_type === 'announcement') {
      await AnnouncementRecipient.update(
        { sms_sent: true },
        {
          where: {
            announcement_id: notification.announcement_id,
            beneficiary_id: notification.beneficiary_id,
          },
        }
      );
    }
  } catch (error) {
    await notification.update({
      status: 'failed',
      failure_reason: String(error.message || 'SMS delivery failed').slice(0, 1000),
    });
    if (notification.announcement_id && notification.notification_type === 'announcement') {
      await AnnouncementRecipient.update(
        { sms_sent: false },
        {
          where: {
            announcement_id: notification.announcement_id,
            beneficiary_id: notification.beneficiary_id,
          },
        }
      );
    }
    console.error(`[SMS] Notification ${notification.id} failed: ${error.message}`);
  }
}

async function processQueuedSms() {
  if (!isConfigured() || dispatchInProgress) return;
  dispatchInProgress = true;
  try {
    const batchSize = Math.max(1, Math.min(25, Number.parseInt(process.env.PHILSMS_BATCH_SIZE, 10) || 5));
    const queued = await SMSNotification.findAll({
      where: { status: 'queued' },
      order: [['createdAt', 'ASC']],
      limit: batchSize,
    });
    await Promise.all(queued.map(sendNotification));
  } finally {
    dispatchInProgress = false;
  }
}

module.exports = { processQueuedSms, sendNotification, isConfigured };
