import { useEffect, useState } from 'react';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { userApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Users } from 'lucide-react';

const ROLES = ['staff', 'barangay', 'beneficiary'];

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
    email: '',
    password: '',
    contact_number: '',
    role: 'staff',
    barangay_id: '',
  });

  // Pre-fill form details depending on role
  useEffect(() => {
    if (currentUser?.role === 'staff') {
      setForm((prev) => ({
        ...prev,
        role: 'beneficiary',
        barangay_id: currentUser.barangay_id || '',
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        role: 'staff',
        barangay_id: '',
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
      await userApi.create({
        ...form,
        barangay_id: form.barangay_id ? Number(form.barangay_id) : null
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
      });
      await loadUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
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
    { header: 'Actions', accessor: 'id', cell: (row) => !['admin','mswdo_admin'].includes(row.role) ? (
      <button
        onClick={() => handleDelete(row.id)}
        className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
      >
        Delete
      </button>
    ) : null },
  ];

  // Filter display lists based on user role
  const displayUsers = currentUser?.role === 'staff'
    ? users // Backend already filtered it to only show their barangay's beneficiaries
    : users.filter((user) => user.role === 'staff');

  const pageTitle = currentUser?.role === 'staff' ? 'Beneficiary Accounts' : 'Staff Accounts';
  const pageDescription = currentUser?.role === 'staff' ? 'Manage beneficiary accounts in your barangay.' : 'Manage staff and user accounts.';
  const loadingLabel = currentUser?.role === 'staff' ? 'Loading beneficiary accounts...' : 'Loading staff accounts...';
  const emptyLabel = currentUser?.role === 'staff' ? 'No beneficiary accounts found' : 'No staff accounts found';

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">{pageTitle}</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">{pageDescription}</p>
        </div>
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg hover:shadow-yellow-500/20 transition transform active:scale-95 text-sm"
          >
            <UserPlus className="w-5 h-5 stroke-[3]" />
            Create Account
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border border-indigo-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Total Accounts</p>
          <p className="text-3xl font-bold text-indigo-600">{loading ? '...' : displayUsers.length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Active Accounts</p>
          <p className="text-3xl font-bold text-emerald-600">{loading ? '...' : displayUsers.filter(u => u.status === 'active').length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
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
                  {currentUser?.role === 'staff' ? 'Create Beneficiary Account' : 'Create New Account'}
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
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
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
