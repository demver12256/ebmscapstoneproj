import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { userApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffUsersScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    try {
      setError('');
      const res = await userApi.list();
      setUsers(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load system users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchSearch = !q || fullName.includes(q) || email.includes(q) || (u.role && u.role.toLowerCase().includes(q));

    const uRole = (u.role || '').toLowerCase();
    const matchRole =
      roleFilter === 'all' ||
      uRole === roleFilter.toLowerCase() ||
      (roleFilter === 'admin' && (uRole === 'admin' || uRole === 'mswdo_admin'));
    return matchSearch && matchRole;
  });

  const getRoleStyle = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'mswdo_admin') return { bg: '#f3e8ff', text: '#7c3aed', border: '#e9d5ff', label: 'Admin' };
    if (r === 'staff') return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'Staff' };
    if (r === 'barangay') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Barangay' };
    return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: 'Beneficiary' };
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={darkMode ? '#0f172a' : '#ffffff'} />

      {/* Top Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.menuIcon, darkMode && styles.darkText]}>☰</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>User Management</Text>
            <Text style={styles.headerSub}>Staff, administrators, and field personnel directory</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadUsers} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search by name, email, or role..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChips}>
          {[
            { key: 'all', label: 'All Users' },
            { key: 'admin', label: 'Admins' },
            { key: 'staff', label: 'Staff' },
            { key: 'barangay', label: 'Barangay' },
            { key: 'beneficiary', label: 'Beneficiaries' },
          ].map((st) => {
            const isSel = roleFilter === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                onPress={() => setRoleFilter(st.key)}
                style={[styles.chip, isSel && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* User List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading user directory...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadUsers} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>No Users Found</Text>
              <Text style={styles.emptySub}>No user accounts match your criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const roleStyle = getRoleStyle(item.role);
            return (
              <View style={[styles.userCard, darkMode && styles.darkCard]}>
                <View style={styles.userRow}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>
                      {(item.first_name?.[0] || item.username?.[0] || 'U').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.userName, darkMode && styles.darkText]}>
                        {item.first_name} {item.last_name || ''}
                      </Text>
                      <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg, borderColor: roleStyle.border }]}>
                        <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                          {roleStyle.label.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.userEmail}>{item.email || item.username || 'No email'}</Text>
                    {item.Barangay?.barangay_name ? (
                      <Text style={styles.barangayTag}>📍 Barangay: {item.Barangay.barangay_name}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerDate}>Joined {formatDate(item.created_at)}</Text>
                  <View style={styles.activeTag}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeTagText}>Active</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  darkContainer: { backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  darkHeader: { backgroundColor: '#1e293b', borderBottomColor: '#334155' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: { marginRight: 12, padding: 4 },
  menuIcon: { fontSize: 24, color: '#1e293b' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 18, color: '#2563eb', fontWeight: 'bold' },
  darkText: { color: '#f8fafc' },
  filterSection: { paddingHorizontal: 16, marginVertical: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkSearchBox: { backgroundColor: '#1e293b', borderColor: '#334155' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  clearSearch: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 4 },
  statusChips: { flexDirection: 'row', gap: 6, marginTop: 10, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 90 },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#1d4ed8' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roleBadgeText: { fontSize: 9.5, fontWeight: '800' },
  userEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  barangayTag: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 3 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerDate: { fontSize: 11, color: '#94a3b8' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  activeTagText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  errorBox: { padding: 30, alignItems: 'center' },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emptySub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
});

export default StaffUsersScreen;

