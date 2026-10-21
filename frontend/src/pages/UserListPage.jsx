import { useEffect, useState } from 'react';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { userApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Users } from 'lucide-react';

const ROLES = [
  { value: 'mswdo_staff', label: 'MSWDO Staff' },
  { value: 'staff', label: 'DSWD Staff' },
  { value: 'senior_citizen_admin', label: 'Senior Citizen Admin (OSCA)' },
  { value: 'pwd_admin', label: 'PWD Admin (PDAO)' },
  { value: 'barangay', label: 'Barangay' },
  { value: 'beneficiary', label: 'Beneficiary' },
];
const BENEFICIARY_CATEGORY_OPTIONS = [
  { value: '4Ps Household Beneficiaries', label: '4Ps Household Beneficiaries' },
  { value: 'Senior Citizens (Social Pension)', label: 'Senior Citizens (Social Pension)' },
  { value: 'Persons with Disabilities (PWD)', label: 'Persons with Disabilities (PWD)' },
];

const getRequiredDocuments = (category) => {
  const base = [{ name: 'Valid Government ID / National ID', required: true }];
  if (!category) return base;
  if (category.includes('4Ps')) {
    return [
      ...base,
      { name: 'PSA Birth Certificate', required: true },
      { name: 'Barangay Certificate of Residency or Indigency', required: true },
      { name: 'Certificate of Enrollment (if applicable)', required: false },
    ];
  }
  if (category.includes('Senior')) {
    return [
      ...base,
      { name: 'Social Pension Application Form', required: true },
      { name: 'OSCA ID or Senior Citizen Card (if available)', required: false },
      { name: 'PSA Birth Certificate (if needed)', required: false },
    ];
  }
  return [
    ...base,
    { name: 'Medical Certificate', required: true },
    { name: 'PWD Application Form', required: true },
    { name: 'PSA Birth Certificate (if needed)', required: false },
  ];
};

export default function UserListPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    contact_number: '',
    role: 'staff',
    barangay_id: '',
    category: '',
    household_id_number: '',
  });

  // Pre-fill form details depending on role
  useEffect(() => {
    if (currentUser?.role === 'senior_citizen_admin') {
      setForm((prev) => ({
        ...prev,
        role: 'senior_citizen_staff',
        barangay_id: '',
      }));
    } else if (currentUser?.role === 'pwd_admin') {
      setForm((prev) => ({
        ...prev,
        role: 'pwd_staff',
        barangay_id: '',
      }));
    } else if (currentUser?.role === 'mswdo_admin') {
      setForm((prev) => ({
        ...prev,
        role: 'mswdo_staff',
        barangay_id: '',
      }));
    } else if (['staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(currentUser?.role)) {
      setForm((prev) => ({
        ...prev,
        role: 'beneficiary',
        barangay_id: currentUser.barangay_id || '',
        category: prev.category || '',
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        role: 'staff',
        barangay_id: '',
        category: prev.category || '',
      }));
    }
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.list();
      setUsers(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const loadBarangays = async () => {
      try {
        const response = await barangayApi.list();
        setBarangays(response.data.data || []);
      } catch (err) {
        console.error('Failed to load barangays:', err);
      }
    };
    loadBarangays();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const is4Ps = form.role === 'beneficiary' && form.category && form.category.toLowerCase().includes('4ps');

      await userApi.create({
        ...form,
        barangay_id: form.barangay_id ? Number(form.barangay_id) : null,
        category: form.role === 'beneficiary' ? form.category : undefined,
        household_id_number: is4Ps ? form.household_id_number.trim() : undefined,
      });
      setShowModal(false);
      setForm({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        contact_number: '',
        role: currentUser?.role === 'staff' ? 'beneficiary' : 'staff',
        barangay_id: currentUser?.role === 'staff' ? currentUser.barangay_id || '' : '',
        category: '',
        household_id_number: '',
      });
      await loadUsers();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await userApi.remove(id);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const columns = [
    { header: 'Name', accessor: 'first_name', cell: (row) => `${row.first_name} ${row.last_name}` },
    { header: 'Username', accessor: 'username', cell: (row) => row.username || '—' },
    { header: 'Email', accessor: 'email', cell: (row) => row.email || '—' },
    { header: 'Role', accessor: 'role', cell: (row) => (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
        ['admin','mswdo_admin'].includes(row.role) ? 'bg-purple-100 text-purple-800' :
        row.role === 'senior_citizen_admin' ? 'bg-rose-100 text-rose-800 font-bold' :
        row.role === 'senior_citizen_staff' ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' :
        row.role === 'pwd_admin' ? 'bg-blue-100 text-blue-800 font-bold' :
        row.role === 'pwd_staff' ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold' :
        row.role === 'mswdo_staff' ? 'bg-indigo-100 text-indigo-800 font-bold' :
        row.role === 'staff' ? 'bg-blue-100 text-blue-800' :
        row.role === 'barangay' ? 'bg-green-100 text-green-800' :
        'bg-slate-100 text-slate-700'
      }`}>{row.role}</span>
    )},
    { header: 'Barangay', accessor: 'barangay_id', cell: (row) => {
      const brgy = barangays.find((b) => b.id === row.barangay_id);
      return brgy ? brgy.barangay_name : '—';
    }},
    { header: 'Contact', accessor: 'contact_number', cell: (row) => row.contact_number || '—' },
    { header: 'Status', accessor: 'status', cell: (row) => (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
        row.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}>{row.status}</span>
    )},
    { header: 'Actions', accessor: 'id', cell: (row) => !['admin','mswdo_admin','senior_citizen_admin','pwd_admin'].includes(row.role) ? (
      <button
        onClick={() => handleDelete(row.id)}
        className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
      >
        Delete
      </button>
    ) : null },
  ];

  // Filter display lists based on user role
  const isSeniorAdmin = currentUser?.role === 'senior_citizen_admin';
  const isPwdAdmin = currentUser?.role === 'pwd_admin';
  const isMswdoAdmin = currentUser?.role === 'mswdo_admin';
  const isStaffView = ['staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(currentUser?.role);
  const displayUsers = isStaffView
    ? users
    : users.filter((user) => user.role !== 'beneficiary');

  const pageTitle = isStaffView 
    ? 'Beneficiary Accounts' 
    : isSeniorAdmin
      ? 'Senior Citizen (OSCA) Staff Accounts'
      : isPwdAdmin
        ? 'PWD (PDAO) Staff Accounts'
        : isMswdoAdmin
          ? 'MSWDO Staff Accounts'
          : 'Staff Accounts';

  const pageDescription = isStaffView 
    ? 'Manage beneficiary accounts.' 
    : isSeniorAdmin
      ? 'Manage OSCA senior staff accounts.'
      : isPwdAdmin
        ? 'Manage PDAO disability staff accounts.'
        : isMswdoAdmin
          ? 'Manage MSWDO staff and municipal accounts.'
          : 'Manage DSWD staff and user accounts.';

  const loadingLabel = isStaffView ? 'Loading beneficiary accounts...' : 'Loading staff accounts...';
  const emptyLabel = isStaffView ? 'No beneficiary accounts found' : 'No staff accounts found';

  const availableRoles = isSeniorAdmin
    ? [{ value: 'senior_citizen_staff', label: 'Senior Citizen Staff (OSCA)' }]
    : isPwdAdmin
      ? [{ value: 'pwd_staff', label: 'PWD Staff (PDAO)' }]
      : isMswdoAdmin
        ? [
            { value: 'mswdo_staff', label: 'MSWDO Staff' },
            { value: 'senior_citizen_admin', label: 'Senior Citizen Admin (OSCA)' },
            { value: 'pwd_admin', label: 'PWD Admin (PDAO)' },
          ]
        : [
            { value: 'staff', label: 'DSWD Staff' },
            { value: 'barangay', label: 'Barangay Staff' },
          ];

  return (
    <div className="space-y-6">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Access Control
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {pageDescription}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Accounts</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{loading ? '...' : displayUsers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Active Accounts</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">{loading ? '...' : displayUsers.filter(u => u.status === 'active').length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-slate-600 mt-2">{loadingLabel}</p>
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">{emptyLabel}</p>
          </div>
        ) : (
          <Table columns={columns} data={displayUsers} />
        )}
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <UserPlus className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {isStaffView ? 'Create Beneficiary Account' : (currentUser?.role === 'mswdo_admin' ? 'Create MSWDO Staff Account' : 'Create Staff Account')}
                </h2>
                <p className="text-xs text-slate-500">
                  {currentUser?.role === 'staff'
                    ? 'Fill in the details to create a beneficiary account in your barangay.'
                    : 'Fill in the details to create a new staff account.'}
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3" autoComplete="off">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" name="first_name" value={form.first_name} onChange={handleChange} required autoComplete="off" />
                <Input label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} required autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Username" name="username" value={form.username} onChange={handleChange} placeholder="e.g. jdelacruz" required autoComplete="off" />
                <Input label="Email Address (Optional)" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Optional" autoComplete="new-password" />
              </div>
              <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="new-password" />
              <Input label="Contact Number" name="contact_number" value={form.contact_number} onChange={handleChange} autoComplete="off" />

              {(form.role === 'beneficiary' || isStaffView) && (
                <>
                  <label className="block text-sm font-semibold text-slate-700">
                    Beneficiary Category
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      required={form.role === 'beneficiary'}
                    >
                      <option value="">Select category</option>
                      {BENEFICIARY_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  {form.category && form.category.toLowerCase().includes('4ps') && (
                    <Input
                      label="Household Number"
                      name="household_id_number"
                      value={form.household_id_number}
                      onChange={handleChange}
                      placeholder="e.g. HH-2024-001"
                      required
                      autoComplete="off"
                    />
                  )}

                  {form.category && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 mb-2">Required documents</p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {getRequiredDocuments(form.category).map((doc) => (
                          <li key={doc.name} className="flex items-start gap-2">
                            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${doc.required ? 'bg-indigo-600' : 'bg-slate-400'}`}></span>
                            <span>{doc.name}{doc.required ? '' : ' (optional)'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              
              {currentUser && ['admin','mswdo_admin'].includes(currentUser.role) && (
                <>
                  <label className="block text-sm font-semibold text-slate-700">
                    Barangay
                    <select
                      name="barangay_id"
                      value={form.barangay_id}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.id}>{b.barangay_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Role
                    <select
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    >
                      {availableRoles.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
                  {submitting ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
