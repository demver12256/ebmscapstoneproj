import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

const DswdShieldIcon = () => (
  <Image
    source={require('../assets/dswd-logo.jpg')}
    style={styles.brandLogo}
    resizeMode="contain"
  />
);

const HeartEmblem = () => (
  <View style={styles.heartCircle}>
    <View style={styles.heartShape}>
      <Text style={styles.heartEmoji}>❤️</Text>
    </View>
  </View>
);

const SidebarDrawer = ({
  visible,
  onClose,
  currentRoute = 'dashboard',
  onSelectRoute,
  user,
  unreadNotifCount = 0,
  unreadMessageCount = 0,
  onLogout,
}) => {
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  // Handle hardware back press on Android
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible, onClose]);

  const handleSelect = (routeKey) => {
    if (onSelectRoute) {
      onSelectRoute(routeKey);
    }
    onClose();
  };

  if (!mounted && !visible) return null;

  const isStaff = user && ['admin', 'staff', 'mswdo_admin', 'barangay'].includes(user.role);

  const mainNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { key: 'attendance', label: 'My Attendance', icon: '📅' },
    { key: 'assistance', label: 'My Assistance', icon: '🤲' },
    { key: 'interventions', label: 'My Interventions', icon: '♥' },
    { key: 'requestAssistance', label: 'Request Assistance', icon: '📄' },
    { key: 'messages', label: 'Messages', icon: '💬', badge: unreadMessageCount },
    { key: 'notifications', label: 'Notifications', icon: '🔔', badge: unreadNotifCount },
  ];

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {/* Dark backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sliding Sidebar Panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.drawerContent}>
              {/* Header: DSWD Logo + Title + Close Button */}
              <View style={styles.header}>
                <View style={styles.brandRow}>
                  <DswdShieldIcon />
                  <View style={styles.brandTextWrap}>
                    <Text style={styles.brandTitle}>BeniAid</Text>
                    <Text style={styles.brandSubtitle}>BENEFICIARY SYSTEM</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable Nav List */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* MAIN Section */}
                <Text style={styles.sectionHeader}>MAIN</Text>
                <View style={styles.navGroup}>
                  {mainNavItems.map((item) => {
                    const isActive = currentRoute === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                        onPress={() => handleSelect(item.key)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.navIcon, isActive && styles.navIconActive]}>
                          {item.icon}
                        </Text>
                        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                          {item.label}
                        </Text>
                        {Boolean(item.badge) && item.badge > 0 && (
                          <View style={styles.badgeWrap}>
                            <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Management Section (Admin / Staff) */}
                {isStaff && (
                  <>
                    <Text style={[styles.sectionHeader, { marginTop: 18 }]}>MANAGEMENT</Text>
                    <View style={styles.navGroup}>
                      <TouchableOpacity
                        style={[styles.navItem, currentRoute === 'beneficiaryList' && styles.navItemActive]}
                        onPress={() => handleSelect('beneficiaryList')}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.navIcon, currentRoute === 'beneficiaryList' && styles.navIconActive]}>
                          👥
                        </Text>
                        <Text style={[styles.navLabel, currentRoute === 'beneficiaryList' && styles.navLabelActive]}>
                          Beneficiary List
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Bottom Slogan Card */}
                <View style={styles.sloganCard}>
                  <HeartEmblem />
                  <Text style={styles.sloganText}>
                    Maagap at Mapagkalingang{'\n'}Serbisyo!
                  </Text>
                  {/* Tricolor stripe */}
                  <View style={styles.tricolorBar}>
                    <View style={[styles.tricolorSegment, { backgroundColor: '#00338D' }]} />
                    <View style={[styles.tricolorSegment, { backgroundColor: '#E30613' }]} />
                    <View style={[styles.tricolorSegment, { backgroundColor: '#FFD100' }]} />
                  </View>
                </View>

                {/* User quick info & logout */}
                {user && (
                  <View style={styles.userFooter}>
                    <View style={styles.userInfoRow}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {(user.first_name?.[0] || 'U').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userMeta}>
                        <Text style={styles.userName} numberOfLines={1}>
                          {user.first_name} {user.last_name}
                        </Text>
                        <Text style={styles.userRole}>
                          {(user.role || 'beneficiary').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {onLogout && (
                      <TouchableOpacity
                        style={styles.drawerLogoutBtn}
                        onPress={() => {
                          onClose();
                          onLogout();
                        }}
                      >
                        <Text style={styles.drawerLogoutText}>🚪 Sign Out</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 25,
    zIndex: 100000,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  drawerContent: {
    flex: 1,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldWrap: {
    width: 38,
    height: 42,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  brandLogo: {
    width: 42,
    height: 42,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  shieldTop: {
    width: 36,
    height: 38,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#00338D',
  },
  shieldBlueHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#00338D',
  },
  shieldRedHalf: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#E30613',
  },
  shieldEmblem: {
    position: 'absolute',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldYellowCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFD100',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00338D',
  },
  shieldInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E30613',
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00338D',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  brandSubtitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 10,
    textTransform: 'uppercase',
  },
  navGroup: {
    marginBottom: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#1d4ed8',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  navIcon: {
    fontSize: 18,
    marginRight: 14,
    color: '#64748b',
  },
  navIconActive: {
    color: '#ffffff',
  },
  navLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#334155',
  },
  navLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badgeWrap: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  sloganCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef08a',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 16,
    shadowColor: '#ca8a04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heartCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fde047',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heartShape: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 30,
  },
  sloganText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  tricolorBar: {
    flexDirection: 'row',
    width: 48,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tricolorSegment: {
    flex: 1,
    height: '100%',
  },
  userFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    marginTop: 6,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: 14,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  userRole: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  drawerLogoutBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  drawerLogoutText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12.5,
  },
});

export default SidebarDrawer;
