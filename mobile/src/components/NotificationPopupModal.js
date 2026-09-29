import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (e) {
    return String(dateVal);
  }
};

export default function NotificationPopupModal({
  visible,
  items = [],
  currentIndex = 0,
  onClose,
  onPrev,
  onNext,
  onMarkAsRead,
  onUpdatePayout,
}) {
  if (!visible || !items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  if (!currentItem) return null;

  const isAnnouncement = currentItem?.popupType === 'announcement';
  const isAbsence =
    !isAnnouncement &&
    (currentItem?.reference_type === 'announcement_absence' ||
      currentItem?.type === 'announcement_absence' ||
      currentItem?.title?.toLowerCase().includes('absent') ||
      currentItem?.title?.toLowerCase().includes('hindi naka-attend'));

  const isProgram =
    !isAnnouncement &&
    !isAbsence &&
    (currentItem?.type === 'program' ||
      currentItem?.reference_type === 'BenefitProgram');

  const isDistribution =
    !isAnnouncement &&
    !isAbsence &&
    (currentItem?.type === 'distribution' ||
      currentItem?.reference_type === 'DistributionEvent');

  const isUnclaimed =
    !isAbsence && currentItem?.title?.toLowerCase().includes('unclaimed');

  const isPayoutVerified =
    !isAnnouncement &&
    (currentItem?.reference_type === 'payout_verified' ||
      currentItem?.title?.toLowerCase().includes('na-aprubahan ang iyong digital payout'));

  const isPayoutRejected =
    !isAnnouncement &&
    (currentItem?.reference_type === 'payout_rejected' ||
      currentItem?.title?.toLowerCase().includes('may puna sa iyong payout') ||
      currentItem?.title?.toLowerCase().includes('hindi na-aprubahan'));

  // Header background colors
  const headerBgColor = isAbsence
    ? '#881337'
    : isPayoutVerified
    ? '#064e3b'
    : isPayoutRejected
    ? '#881337'
    : isUnclaimed
    ? '#78350f'
    : '#002855';

  const iconBgColor = isAbsence
    ? '#f43f5e'
    : isPayoutVerified
    ? '#34d399'
    : isPayoutRejected
    ? '#fb7185'
    : isUnclaimed
    ? '#fbbf24'
    : isProgram
    ? '#c084fc'
    : isDistribution
    ? '#34d399'
    : '#facc15';

  const iconEmoji = isAbsence
    ? '⚠️'
    : isPayoutVerified
    ? '🛡️'
    : isPayoutRejected
    ? '⚠️'
    : isUnclaimed
    ? '⚠️'
    : isProgram
    ? '🎓'
    : isDistribution
    ? '🎁'
    : '📢';

  const kickerText = isAbsence
    ? '⚠️ PAUNAWA SA HINDI PAGDALO / NOTICE OF ABSENCE'
    : isPayoutVerified
    ? '✅ DIGITAL PAYOUT VERIFIED & ACTIVE'
    : isPayoutRejected
    ? '⚠️ PAYOUT ACCOUNT REVIEW REQUIRED'
    : isUnclaimed
    ? 'NOTICE OF UNCLAIMED BENEFIT'
    : isProgram
    ? 'PROGRAM ENROLLMENT NOTIFICATION'
    : isDistribution
    ? 'NEW BENEFIT DISTRIBUTION'
    : 'IMPORTANT ANNOUNCEMENT';

  const dateStr = formatDate(
    currentItem?.created_at || currentItem?.createdAt || Date.now()
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Header Banner */}
          <View style={[styles.headerBanner, { backgroundColor: headerBgColor }]}>
            {/* Close Button Top Right */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={[styles.iconWrap, { backgroundColor: iconBgColor }]}>
                <Text style={styles.iconEmoji}>{iconEmoji}</Text>
              </View>
              <View style={styles.headerTitles}>
                <Text style={styles.kickerText}>{kickerText}</Text>
                <Text style={styles.titleText}>{currentItem?.title || 'Notification'}</Text>
              </View>
            </View>
          </View>

          {/* Modal Body */}
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Pill / Badge & Date Row */}
            <View style={styles.badgeRow}>
              {isAbsence ? (
                <View style={[styles.pillBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#991b1b' }]}>❌ ABSENT / HINDI NAKADALO</Text>
                </View>
              ) : isPayoutVerified ? (
                <View style={[styles.pillBadge, { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#065f46' }]}>✅ PAYOUT APPROVED & VERIFIED</Text>
                </View>
              ) : isPayoutRejected ? (
                <View style={[styles.pillBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#991b1b' }]}>❌ ACTION REQUIRED: UPDATE ACCOUNT</Text>
                </View>
              ) : isUnclaimed ? (
                <View style={[styles.pillBadge, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#92400e' }]}>⚠️ UNCLAIMED BENEFIT</Text>
                </View>
              ) : isProgram ? (
                <View style={[styles.pillBadge, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#6b21a8' }]}>🎓 PROGRAM ENROLLMENT</Text>
                </View>
              ) : isDistribution ? (
                <View style={[styles.pillBadge, { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#065f46' }]}>💰 PAYOUT SCHEDULED</Text>
                </View>
              ) : currentItem?.priority === 'Urgent' ? (
                <View style={[styles.pillBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#991b1b' }]}>🔴 URGENT</Text>
                </View>
              ) : currentItem?.priority === 'High' ? (
                <View style={[styles.pillBadge, { backgroundColor: '#ffedd5', borderColor: '#fed7aa' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#9a3412' }]}>🟠 HIGH PRIORITY</Text>
                </View>
              ) : (
                <View style={[styles.pillBadge, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#1d4ed8' }]}>📢 EVENT ANNOUNCEMENT</Text>
                </View>
              )}

              {dateStr ? (
                <>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </>
              ) : null}
            </View>

            {/* Message Box */}
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>
                {currentItem?.message || currentItem?.content || currentItem?.description || 'Walang karagdagang detalye.'}
              </Text>
            </View>

            {/* Absence Guidance Notice */}
            {isAbsence && (
              <View style={styles.absenceBox}>
                <Text style={styles.absenceTitle}>⚠️ Paalala ukol sa Attendance at Compliance:</Text>
                <Text style={styles.absenceText}>
                  Ang hindi pagdalo sa mga itinakdang opisyal na aktibidad o oryentasyon ng munisipyo ay naitala sa inyong record bilang Absent. Kung ikaw ay may balidong dahilan (tulad ng emerhensiya o medikal), mangyaring makipag-ugnayan agad sa inyong Barangay Staff o sa Tanggapan ng DSWD/MSWDO.
                </Text>
              </View>
            )}

            {/* Schedule & Venue Details if applicable */}
            {(currentItem?.event_date || currentItem?.venue || isAnnouncement) && (
              <View style={styles.scheduleBox}>
                {currentItem?.event_date ? (
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>📅 Schedule:</Text>
                    <Text style={styles.scheduleValue}>
                      {currentItem.event_date}{' '}
                      {currentItem?.event_time ? `at ${currentItem.event_time}` : ''}
                      {currentItem?.end_time ? ` - ${currentItem.end_time}` : ''}
                    </Text>
                  </View>
                ) : null}
                {currentItem?.venue ? (
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>📍 Venue:</Text>
                    <Text style={styles.scheduleValue}>{currentItem.venue}</Text>
                  </View>
                ) : null}
                {isAnnouncement && (
                  <View style={[styles.scheduleRow, { paddingTop: 4, borderTopWidth: 1, borderColor: '#fde68a' }]}>
                    <Text style={[styles.scheduleValue, { fontWeight: '700', color: '#78350f' }]}>
                      💳 Instruction: Bring your RFID card for your Attendance.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Pagination Controls if multiple unread items */}
            {items.length > 1 && (
              <View style={styles.paginationRow}>
                <Text style={styles.paginationText}>
                  Unread Notification {currentIndex + 1} of {items.length}
                </Text>
                <View style={styles.paginationBtns}>
                  <TouchableOpacity
                    disabled={currentIndex === 0}
                    onPress={onPrev}
                    style={[styles.pageBtn, currentIndex === 0 && styles.pageBtnDisabled]}
                  >
                    <Text style={[styles.pageBtnText, currentIndex === 0 && styles.pageBtnTextDisabled]}>
                      Prev
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={currentIndex === items.length - 1}
                    onPress={onNext}
                    style={[styles.pageBtn, currentIndex === items.length - 1 && styles.pageBtnDisabled]}
                  >
                    <Text style={[styles.pageBtnText, currentIndex === items.length - 1 && styles.pageBtnTextDisabled]}>
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal Footer Buttons */}
          <View style={styles.footerRow}>
            {isPayoutRejected && onUpdatePayout && (
              <TouchableOpacity
                onPress={onUpdatePayout}
                style={styles.payoutUpdateBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.payoutUpdateBtnText}>✏️ I-update ang Account</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeForNowBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.closeForNowText}>Close for Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onMarkAsRead(currentItem)}
              style={[
                styles.confirmBtn,
                { backgroundColor: isAbsence ? '#e11d48' : '#0038A8' },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>
                ✓ {isAbsence ? 'Naintindihan Ko / Nabasa Ko Na' : 'Salamat / Nabasa Ko Na'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  headerBanner: {
    padding: 20,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 36,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconEmoji: {
    fontSize: 22,
  },
  headerTitles: {
    flex: 1,
  },
  kickerText: {
    color: '#fde047',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  bodyScroll: {
    maxHeight: 380,
  },
  bodyContent: {
    padding: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 6,
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dotSeparator: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  dateText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  messageText: {
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  absenceBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  absenceTitle: {
    color: '#9f1239',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  absenceText: {
    color: '#9f1239',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  scheduleBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  scheduleLabel: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleValue: {
    color: '#78350f',
    fontSize: 12,
    fontWeight: '600',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 6,
  },
  paginationText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  paginationBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  footerRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },
  payoutUpdateBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  payoutUpdateBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  closeForNowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  closeForNowText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#002855',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
