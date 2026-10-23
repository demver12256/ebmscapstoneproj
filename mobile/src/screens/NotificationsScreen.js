import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { notificationApi } from '../services/api';

const formatDate = (dateStr) => {
  if (!dateStr) return 'Kamakailan lamang';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Kamakailan lamang';
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Kamakailan lamang';
  }
};

const getAnnouncementSource = (notif) => {
  const combined = `${notif.agency || ''} ${notif.category || ''} ${notif.target_category || ''} ${notif.title || ''} ${notif.subject || ''} ${notif.message || ''} ${notif.body || ''} ${notif.sender || ''}`.toLowerCase();

  // Check Senior / OSCA
  if (combined.includes('osca') || combined.includes('senior') || notif.agency === 'OSCA') {
    return {
      office: 'OSCA (Office of Senior Citizens Affairs)',
      agency: 'OSCA / MSWDO',
      badgeColor: '#1e40af',
      badgeBg: '#eff6ff',
      badgeBorder: '#bfdbfe',
      icon: '👴',
      sector: 'Senior Citizen',
    };
  }

  // Check PWD / PDAO
  if (combined.includes('pdao') || combined.includes('pwdo') || combined.includes('pwd') || combined.includes('disabilit') || notif.agency === 'PDAO' || notif.agency === 'PWDO') {
    return {
      office: 'PDAO (Persons with Disability Affairs Office)',
      agency: 'PDAO / MSWDO',
      badgeColor: '#c2410c',
      badgeBg: '#fff7ed',
      badgeBorder: '#fed7aa',
      icon: '♿',
      sector: 'Persons with Disabilities',
    };
  }

  // Check MSWDO
  if (combined.includes('mswdo') || notif.agency === 'MSWDO' || combined.includes('municipal') || combined.includes('lgu')) {
    return {
      office: 'MSWDO (Municipal Social Welfare & Dev. Office)',
      agency: 'MSWDO',
      badgeColor: '#7c3aed',
      badgeBg: '#f5f3ff',
      badgeBorder: '#ddd6fe',
      icon: '🏢',
      sector: 'MSWDO Municipal',
    };
  }

  // Default: DSWD
  return {
    office: 'DSWD (Dept. of Social Welfare & Dev.) / 4Ps',
    agency: 'DSWD',
    badgeColor: '#0369a1',
    badgeBg: '#f0f9ff',
    badgeBorder: '#bae6fd',
    icon: '🏛️',
    sector: 'DSWD National',
  };
};

export default function NotificationsScreen({ onBack, user, onAllRead, onReadOne }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await notificationApi.list();
      setNotifications((res.data?.data || []).filter((notification) => (
        notification.type !== 'intervention_submitted' &&
        notification.reference_type !== 'intervention_submitted'
      )));
    } catch (err) {
      console.warn('Failed to load notifications:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (onReadOne) onReadOne();
    } catch (e) {
      console.warn('Error marking notification read:', e.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onAllRead) onAllRead();
    } catch (e) {
      console.warn('Error marking all notifications read:', e.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.headerBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllBtnText}>Read All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} colors={['#1d4ed8']} />
        }
      >
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Mga Opisyal na Anunsyo at Abiso</Text>
            <Text style={styles.bannerSubTag}>DSWD • MSWDO • OSCA (Senior) • PDAO (PWD)</Text>
            <Text style={styles.bannerSub}>
              {unreadCount > 0
                ? `Mayroon kang ${unreadCount} bagong abiso tungkol sa ayuda o pagtitipon.`
                : 'Lahat ng notifications ay nabasa na.'}
            </Text>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🔔</Text>
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySub}>
              Lahat ng bagong anunsyo, payout schedules, at meeting updates ay lalabas dito.
            </Text>
          </View>
        ) : (
          notifications.map((notif, idx) => {
            const isRead = notif.is_read;
            const source = getAnnouncementSource(notif);
            const dateDisplay = formatDate(notif.created_at || notif.createdAt || notif.date || notif.timestamp);

            return (
              <TouchableOpacity
                key={notif.id || idx}
                style={[styles.notifCard, !isRead && styles.notifCardUnread]}
                onPress={() => !isRead && handleMarkAsRead(notif.id)}
                activeOpacity={0.7}
              >
                <View style={styles.notifHeader}>
                  <View style={[styles.notifIconWrap, { backgroundColor: source.badgeBg }]}>
                    <Text style={{ fontSize: 18 }}>
                      {notif.type === 'payout' ? '💰' : notif.type === 'meeting' ? '📅' : source.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, !isRead && styles.notifTitleUnread]}>
                      {notif.title || notif.subject || 'Announcement'}
                    </Text>
                    {/* Kung kanino galing ang announcement */}
                    <View style={[styles.sourceBadge, { backgroundColor: source.badgeBg, borderColor: source.badgeBorder }]}>
                      <Text style={[styles.sourceBadgeText, { color: source.badgeColor }]}>
                        {source.icon} Mula sa: {source.office}
                      </Text>
                    </View>
                    <Text style={styles.notifDate}>🕒 {dateDisplay}</Text>
                  </View>
                  {!isRead && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.notifBody}>
                  {notif.message || notif.content || notif.body}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    height: 56,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerLeft: {
    width: 70,
  },
  headerRight: {
    width: 70,
    alignItems: 'flex-end',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerBtnText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  markAllBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  markAllBtnText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  bannerSubTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  bannerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 3,
    marginBottom: 3,
  },
  sourceBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  notifCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  notifCardUnread: {
    borderColor: '#93c5fd',
    backgroundColor: '#f8faff',
    borderLeftWidth: 4,
    borderLeftColor: '#1d4ed8',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  notifTitleUnread: {
    fontWeight: '800',
    color: '#0f172a',
  },
  notifDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1d4ed8',
    marginLeft: 6,
  },
  notifBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
});
