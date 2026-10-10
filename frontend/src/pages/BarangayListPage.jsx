import { useEffect, useState } from 'react';
import Table from '../components/ui/Table';
import { barangayApi } from '../services/api';
import { MapPin, Users, Heart, UserCheck, Accessibility, Globe } from 'lucide-react';

export default function BarangayListPage() {
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await barangayApi.list();
        setBarangays(response.data.data || []);
      } catch (err) {
        setError(err.message || 'Unable to load barangays');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Compute totals for the stats cards
  const totals = barangays.reduce(
    (acc, b) => ({
      beneficiaries: acc.beneficiaries + (b.total || 0),
      fourPs: acc.fourPs + (b.fourPs || 0),
      senior: acc.senior + (b.senior || 0),
      pwd: acc.pwd + (b.pwd || 0),
      ip: acc.ip + (b.ip || 0),
      nonIp: acc.nonIp + (b.nonIp || 0),
    }),
    { beneficiaries: 0, fourPs: 0, senior: 0, pwd: 0, ip: 0, nonIp: 0 }
  );

  const columns = [
    { header: 'Barangay Name', accessor: 'barangay_name', cell: (row) => (
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="font-semibold text-slate-800">{row.barangay_name}</span>
      </div>
    )},
    { header: 'Total Beneficiaries', accessor: 'total', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-sm">
        <Users className="w-3.5 h-3.5 text-slate-600" />
        {row.total || 0}
      </span>
    )},
    { header: '4Ps', accessor: 'fourPs', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 bg-orange-50 px-3 py-1 rounded-full">
        <Heart className="w-3.5 h-3.5 text-orange-500" />
        {row.fourPs || 0}
      </span>
    )},
    { header: 'Senior', accessor: 'senior', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
        <UserCheck className="w-3.5 h-3.5 text-blue-500" />
        {row.senior || 0}
      </span>
    )},
    { header: 'PWD', accessor: 'pwd', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
        <Accessibility className="w-3.5 h-3.5 text-purple-500" />
        {row.pwd || 0}
      </span>
    )},
    { header: 'IP', accessor: 'ip', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
        <Globe className="w-3.5 h-3.5 text-emerald-500" />
        {row.ip || 0}
      </span>
    )},
    { header: 'Non-IP', accessor: 'nonIp', cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
        {row.nonIp || 0}
      </span>
    )},
  ];

  const statCards = [
    { label: 'Total Barangays', value: barangays.length, icon: MapPin, from: 'from-green-50', to: 'to-green-100', border: 'border-green-200', color: 'text-green-600', iconColor: 'text-green-500' },
    { label: 'Approved Beneficiaries', value: totals.beneficiaries, icon: Users, from: 'from-blue-50', to: 'to-blue-100', border: 'border-blue-200', color: 'text-blue-600', iconColor: 'text-blue-500' },
    { label: '4Ps Beneficiaries', value: totals.fourPs, icon: Heart, from: 'from-orange-50', to: 'to-orange-100', border: 'border-orange-200', color: 'text-orange-600', iconColor: 'text-orange-500' },
    { label: 'Senior Citizens', value: totals.senior, icon: UserCheck, from: 'from-indigo-50', to: 'to-indigo-100', border: 'border-indigo-200', color: 'text-indigo-600', iconColor: 'text-indigo-500' },
    { label: 'PWD', value: totals.pwd, icon: Accessibility, from: 'from-purple-50', to: 'to-purple-100', border: 'border-purple-200', color: 'text-purple-600', iconColor: 'text-purple-500' },
    { label: 'IP / Non-IP', value: `${totals.ip} / ${totals.nonIp}`, icon: Globe, from: 'from-emerald-50', to: 'to-emerald-100', border: 'border-emerald-200', color: 'text-emerald-600', iconColor: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Jurisdiction & Coverage
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Barangay Directory & Demographics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of officially approved beneficiaries, 4Ps households, senior citizens, PWDs, and IP classifications across barangays.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-1.5 mb-1.5">
              <card.icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${card.color}`}>{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="text-sm text-slate-600 mt-2">Loading barangay list...</p>
          </div>
        ) : barangays.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">No barangays found</p>
          </div>
        ) : (
          <Table columns={columns} data={barangays} />
        )}
      </div>
    </div>
  );
}
