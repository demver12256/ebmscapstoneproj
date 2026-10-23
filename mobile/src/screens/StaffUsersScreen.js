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
  Modal,
  Alert,
} from 'react-native';
import { userApi, barangayApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffUsersScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [users, setUsers] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTab, setAccountTab] = useState('beneficiaries'); // 'beneficiaries' | 'staff' | 'all'

  // Create Account Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const isAdminRole = ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin'].includes(user?.role);
  const isSeniorRole = ['senior_citizen_admin', 'senior_citizen_staff'].includes(user?.role);
  const isPwdRole = ['pwd_admin', 'pwd_staff'].includes(user?.role);
  const isMswdoRole = ['mswdo_admin', 'mswdo_staff'].includes(user?.role);
  const isDswdRole = ['admin', 'staff', 'barangay'].includes(user?.role);

  const allowedCategories = isSeniorRole
    ? ['Senior Citizens (Social Pension)']
    : isPwdRole
    ? ['Persons with Disabilities (PWD)']
    : isMswdoRole
    ? ['Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)']
    : ['4Ps Household Beneficiary'];

  const allowedStaffRoles =
    user?.role === 'senior_citizen_admin'
      ? [{ value: 'senior_citizen_staff', label: 'Senior Citizen Staff (OSCA)' }]
      : user?.role === 'pwd_admin'
      ? [{ value: 'pwd_staff', label: 'PWD Staff (PDAO)' }]
      : user?.role === 'mswdo_admin'
      ? [
          { value: 'mswdo_staff', label: 'MSWDO Staff' },
          { value: 'senior_citizen_staff', label: 'Senior Citizen Staff (OSCA)' },
          { value: 'pwd_staff', label: 'PWD Staff (PDAO)' },
        ]
      : [
          { value: 'staff', label: 'DSWD / Barangay Staff' },
          { value: 'barangay', label: 'Barangay Officer' },
        ];

  const [form, setForm] = useState({
    account_type: 'beneficiary', // 'beneficiary' | 'staff'
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    contact_number: '',
    role: 'beneficiary',
    category: allowedCategories[0],
    barangay_id: user?.barangay_id ? Number(user.barangay_id) : '',
  });

  const loadUsers = useCallback(async () => {
    try {
      setError('');
      const [userRes, brgyRes] = await Promise.all([
        userApi.list(),
        barangayApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      setUsers(userRes.data?.data || []);
      setBarangays(brgyRes.data?.data || []);
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

  const beneficiaryAccounts = users.filter((u) => u.role === 'beneficiary');
  const staffAccounts = users.filter((u) => u.role !== 'beneficiary');

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const cat = (u.Beneficiary?.category || '').toLowerCase();
    const matchSearch =
      !q || fullName.includes(q) || email.includes(q) || cat.includes(q) || (u.role && u.role.toLowerCase().includes(q));

    if (accountTab === 'beneficiaries') return matchSearch && u.role === 'beneficiary';
    if (accountTab === 'staff') return matchSearch && u.role !== 'beneficiary';
    return matchSearch;
  });

  const getRoleStyle = (item) => {
    const r = (item.role || '').toLowerCase();
    if (r === 'admin') return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'DSWD Admin' };
    if (r === 'mswdo_admin') return { bg: '#f3e8ff', text: '#7c3aed', border: '#e9d5ff', label: 'MSWDO Admin' };
    if (r === 'senior_citizen_admin') return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'Senior Admin (OSCA)' };
    if (r === 'pwd_admin') return { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4', label: 'PWD Admin (PDAO)' };
    if (r === 'mswdo_staff') return { bg: '#f3e8ff', text: '#6d28d9', border: '#ddd6fe', label: 'MSWDO Staff' };
    if (r === 'senior_citizen_staff') return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa', label: 'Senior Staff (OSCA)' };
    if (r === 'pwd_staff') return { bg: '#cffafe', text: '#0e7490', border: '#a5f3fc', label: 'PWD Staff (PDAO)' };
    if (r === 'staff') return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'DSWD / Brgy Staff' };
    if (r === 'barangay') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Barangay Officer' };

    const cat = (item.Beneficiary?.category || '').toLowerCase();
    if (cat.includes('senior')) {
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: '👴 Senior Beneficiary' };
    }
    if (cat.includes('pwd') || cat.includes('disabil')) {
      return { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4', label: '♿ PWD Beneficiary' };
    }
    if (cat.includes('4ps')) {
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: '👨‍👩‍👧 4Ps Beneficiary' };
    }
    return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: 'Beneficiary' };
  };

  const handleOpenCreate = () => {
    const defaultBrgy = user?.barangay_id
      ? Number(user.barangay_id)
      : barangays[0]
      ? Number(barangays[0].id)
      : '';
    setForm({
      account_type: 'beneficiary',
      first_name: '',
      last_name: '',
      username: '',
      email: '',
      password: '',
      contact_number: '',
      role: 'beneficiary',
      category: allowedCategories[0],
      barangay_id: defaultBrgy,
    });
    setCreateModalVisible(true);
  };

  const handleCreateUser = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.password.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Pakilagay ang First Name, Last Name, at Password.');
      return;
    }
    if (!form.username.trim() && !form.email.trim()) {
      Alert.alert('Kulang na Impormasyon', 'Pakilagay ang Username o Email Address.');
      return;
    }
    try {
      setCreating(true);
      const isBen = form.account_type === 'beneficiary';
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim() || form.email.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        contact_number: form.contact_number.trim() || undefined,
        role: isBen ? 'beneficiary' : form.role,
        category: isBen ? form.category : undefined,
        barangay_id: form.barangay_id ? Number(form.barangay_id) : undefined,
      };
      await userApi.create(payload);
      Alert.alert('Tagumpay', 'Matagumpay na nalikha ang bagong user account!');
      setCreateModalVisible(false);
      loadUsers();
    } catch (err) {
      Alert.alert('Create Failed', err?.response?.data?.message || err.message || 'Hindi nalikha ang account.');
    } finally {
      setCreating(false);
    }
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
            <Text style={styles.headerSub}>
              {isSeniorRole
                ? 'Senior Citizen (OSCA) Accounts Directory'
                : isPwdRole
                ? 'PWD (PDAO) Accounts Directory'
                : isMswdoRole
                ? 'MSWDO (Senior & PWD) Accounts Directory'
                : 'DSWD (4Ps & Staff) Accounts Directory'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={handleOpenCreate} style={styles.createBtn}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadUsers} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Segmented Tabs */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search by name, username, email, or sector..."
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
            { key: 'beneficiaries', label: `👥 Beneficiaries (${beneficiaryAccounts.length})` },
            { key: 'staff', label: `🛡️ Staff & Admins (${staffAccounts.length})` },
            { key: 'all', label: `All (${users.length})` },
          ].map((st) => {
            const isSel = accountTab === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                onPress={() => setAccountTab(st.key)}
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
              <Text style={styles.emptySub}>No user accounts match your sector filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const roleStyle = getRoleStyle(item);
            const brgyName =
              item.Barangay?.barangay_name ||
              item.Beneficiary?.Barangay?.barangay_name ||
              '';
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
                      <Text style={[styles.userName, darkMode && styles.darkText]} numberOfLines={1}>
                        {item.first_name} {item.last_name || ''}
                      </Text>
                      <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg, borderColor: roleStyle.border }]}>
                        <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                          {roleStyle.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.userEmail}>
                      @{item.username || 'user'} {item.email ? `• ${item.email}` : ''}
                    </Text>
                    {brgyName ? (
                      <Text style={styles.barangayTag}>📍 Barangay {brgyName}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerDate}>
                    {item.Beneficiary?.beneficiary_id_code
                      ? `ID: ${item.Beneficiary.beneficiary_id_code}`
                      : `Joined ${formatDate(item.created_at)}`}
                  </Text>
                  <View style={styles.activeTag}>
                    <View style={[styles.activeDot, item.is_active === false && { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.activeTagText, item.is_active === false && { color: '#dc2626' }]}>
                      {item.is_active === false ? 'Inactive' : 'Active'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Create User Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create User Account</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeModalBtn}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
              {isAdminRole && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>URI NG ACCOUNT</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.typeBtn, form.account_type === 'beneficiary' && styles.typeBtnActive]}
                      onPress={() => setForm({ ...form, account_type: 'beneficiary', role: 'beneficiary' })}
                    >
                      <Text style={[styles.typeBtnText, form.account_type === 'beneficiary' && styles.typeBtnTextActive]}>
                        👥 Beneficiary
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeBtn, form.account_type === 'staff' && styles.typeBtnActive]}
                      onPress={() =>
                        setForm({
                          ...form,
                          account_type: 'staff',
                          role: allowedStaffRoles[0]?.value || 'staff',
                        })
                      }
                    >
                      <Text style={[styles.typeBtnText, form.account_type === 'staff' && styles.typeBtnTextActive]}>
                        🛡️ Staff Account
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {form.account_type === 'beneficiary' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>SECTOR / KATEGORYA NG BENEPISYARYO</Text>
                  {allowedCategories.map((cat) => {
                    const isSel = form.category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.selectOption, isSel && styles.selectOptionActive]}
                        onPress={() => setForm({ ...form, category: cat })}
                      >
                        <Text style={[styles.selectOptionText, isSel && styles.selectOptionTextActive]}>
                          {isSel ? '🔘 ' : '⚪ '} {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>STAFF ROLE</Text>
                  {allowedStaffRoles.map((sr) => {
                    const isSel = form.role === sr.value;
                    return (
                      <TouchableOpacity
                        key={sr.value}
                        style={[styles.selectOption, isSel && styles.selectOptionActive]}
                        onPress={() => setForm({ ...form, role: sr.value })}
                      >
                        <Text style={[styles.selectOptionText, isSel && styles.selectOptionTextActive]}>
                          {isSel ? '🔘 ' : '⚪ '} {sr.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>FIRST NAME *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.first_name}
                    onChangeText={(v) => setForm({ ...form, first_name: v })}
                    placeholder="Juan"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>LAST NAME *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.last_name}
                    onChangeText={(v) => setForm({ ...form, last_name: v })}
                    placeholder="Dela Cruz"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>USERNAME *</Text>
                <TextInput
                  style={styles.input}
                  value={form.username}
                  onChangeText={(v) => setForm({ ...form, username: v })}
                  autoCapitalize="none"
                  placeholder="juandelacruz"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(v) => setForm({ ...form, email: v })}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="juan@example.com"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CONTACT NUMBER</Text>
                <TextInput
                  style={styles.input}
                  value={form.contact_number}
                  onChangeText={(v) => setForm({ ...form, contact_number: v })}
                  keyboardType="phone-pad"
                  placeholder="09123456789"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PASSWORD *</Text>
                <TextInput
                  style={styles.input}
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
                  secureTextEntry
                  placeholder="Minimum 6 characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>BARANGAY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {barangays.map((b) => {
                    const isSel = Number(form.barangay_id) === Number(b.id);
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.brgyChip, isSel && styles.brgyChipActive]}
                        onPress={() => setForm({ ...form, barangay_id: Number(b.id) })}
                      >
                        <Text style={[styles.brgyChipText, isSel && styles.brgyChipTextActive]}>
                          {b.barangay_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>✓ Create Account</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  menuBtn: { marginRight: 12, padding: 4 },
  menuIcon: { fontSize: 24, color: '#1e293b' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  createBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6, borderWidth: 1 },
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
  footerDate: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  closeModalBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  typeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  typeBtnText: { fontSize: 12.5, fontWeight: '700', color: '#64748b' },
  typeBtnTextActive: { color: '#1d4ed8' },
  selectOption: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  selectOptionActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  selectOptionText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  selectOptionTextActive: { color: '#1d4ed8', fontWeight: '800' },
  brgyChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 6,
    backgroundColor: '#f8fafc',
  },
  brgyChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  brgyChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  brgyChipTextActive: { color: '#ffffff', fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});

export default StaffUsersScreen;
