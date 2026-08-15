const { Op } = require('sequelize');
const {
  DistributionEvent,
  DistributionTransaction,
  Beneficiary,
  Notification,
  AuditLog,
} = require('../db');

/**
 * Checks all distribution events whose distribution_date has passed (< today).
 * For any event that is not completed or archived:
 * - Updates the event status to 'completed'
 * - Creates 'Unclaimed Benefit Notice' notifications for any beneficiaries with pending transactions for that event.
 */
async function checkAndProcessExpiredDistributions() {
  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // 1. Find all events whose distribution_date is strictly less than today's date and not yet completed
    const expiredEvents = await DistributionEvent.findAll({
      where: {
        distribution_date: { [Op.lt]: todayStr },
        status: { [Op.notIn]: ['completed', 'archived'] },
      },
    });

    for (const event of expiredEvents) {
      console.log(`[AUTO-EXPIRE] Processing event ID ${event.id}: "${event.title}" (Date: ${event.distribution_date})`);

      await event.update({
        status: 'completed',
        completed_at: event.completed_at || new Date(),
      });

      const pendingTransactions = await DistributionTransaction.findAll({
        where: { distribution_event_id: event.id, status: 'pending' },
        include: [
          {
            model: Beneficiary,
            attributes: ['id', 'user_id', 'first_name', 'last_name'],
          },
        ],
      });

      let notifiedCount = 0;
      for (const txn of pendingTransactions) {
        if (txn.Beneficiary && txn.Beneficiary.user_id) {
          const existingNotif = await Notification.findOne({
            where: {
              user_id: txn.Beneficiary.user_id,
              reference_id: event.id,
              type: 'distribution',
              title: { [Op.like]: '%Unclaimed Benefit Notice%' },
            },
          });

          if (!existingNotif) {
            const amountStr = parseFloat(txn.amount || 0).toLocaleString('en-PH', {
              minimumFractionDigits: 2,
            });
            await Notification.create({
              user_id: txn.Beneficiary.user_id,
              title: `Unclaimed Benefit Notice: ${event.title}`,
              message: `Dear ${txn.Beneficiary.first_name}, you have an unclaimed benefit of ₱${amountStr} for "${event.title}". The distribution session has ended. Please visit your Barangay office or contact staff for assistance.`,
              type: 'distribution',
              reference_id: event.id,
              reference_type: 'distribution_event',
              is_read: false,
            });
            notifiedCount++;
          }
        }
      }

      await AuditLog.create({
        user_id: event.assigned_staff_id || 1,
        action: `Distribution event "${event.title}" auto-completed due to expired distribution date (${event.distribution_date}) - ${notifiedCount} unclaimed notification(s) sent`,
        module: 'distributions',
        details: JSON.stringify({
          event_id: event.id,
          distribution_date: event.distribution_date,
          unclaimed_notifications_sent: notifiedCount,
          auto_expired: true,
        }),
      });

      console.log(
        `[AUTO-EXPIRE] Event ID ${event.id} marked as completed. Sent ${notifiedCount} unclaimed notice(s).`
      );
    }

    // 2. Cleanup: Automatically mark old "Upcoming Benefit Distribution" notifications as read for any completed/past events
    const completedOrPastEvents = await DistributionEvent.findAll({
      where: {
        [Op.or]: [
          { status: { [Op.in]: ['completed', 'archived'] } },
          { distribution_date: { [Op.lt]: todayStr } }
        ]
      },
      attributes: ['id']
    });

    const completedIds = completedOrPastEvents.map(e => e.id);
    if (completedIds.length > 0) {
      const [updatedCount] = await Notification.update(
        { is_read: true },
        {
          where: {
            reference_id: completedIds,
            title: { [Op.like]: '%Upcoming%' },
            is_read: false,
          },
        }
      );
      if (updatedCount > 0) {
        console.log(`[AUTO-EXPIRE] Auto-marked ${updatedCount} outdated 'Upcoming' notification(s) as read for completed events.`);
      }
    }
  } catch (error) {
    console.error('[AUTO-EXPIRE] Error in checkAndProcessExpiredDistributions:', error);
  }
}

module.exports = {
  checkAndProcessExpiredDistributions,
};
