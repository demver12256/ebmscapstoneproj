import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

const TABS = [
  { key: 'dashboard',     icon: '🏠',  label: 'Home'       },
  { key: 'attendance',    icon: '📅',  label: 'Attendance' },
  { key: 'assistance',    icon: '🤲',  label: 'Assistance' },
  { key: 'messages',      icon: '💬',  label: 'Messages'   },
  { key: 'notifications', icon: '🔔',  label: 'Alerts'     },
];

const BottomNavBar = ({
  currentNav = 'dashboard',
  onSelectNav,
  unreadMessageCount = 0,
  unreadNotifCount = 0,
}) => {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        // Map requestAssistance to assistance tab as active
        const isActive =
          currentNav === tab.key ||
          (tab.key === 'assistance' && currentNav === 'requestAssistance');

        const badge =
          tab.key === 'messages'
            ? unreadMessageCount
            : tab.key === 'notifications'
            ? unreadNotifCount
            : 0;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onSelectNav && onSelectNav(tab.key)}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.activeTopBar} />}
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, isActive && styles.iconActive]}>
                {tab.icon}
              </Text>
              {Boolean(badge) && badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 9 ? '9+' : badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 16,
    height: Platform.OS === 'ios' ? 68 : 58,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 6,
  },
  activeTopBar: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#2563eb',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  icon: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});

export default BottomNavBar;
