import { useEffect, useState, useMemo } from 'react';
import Table from '../components/ui/Table';
import { barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MapPin, Users, Heart, UserCheck, Accessibility, Globe, Search } from 'lucide-react';

export default function BarangayListPage() {
  const { user } = useAuth();
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Role definitions
  const isSeniorAdmin = user?.role === 'senior_citizen_admin';
  const isSeniorStaff = user?.role === 'senior_citizen_staff';
  const isAnySenior = isSeniorAdmin || isSeniorStaff;

  const isPwdAdmin = user?.role === 'pwd_admin';
  const isPwdStaff = user?.role === 'pwd_staff';
  const isAnyPwd = isPwdAdmin || isPwdStaff;

  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isMswdoStaff = user?.role === 'mswdo_staff';
  const isAnyMswdo = isMswdoAdmin || isMswdoStaff;

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

  // Compute totals for the stats cards based on active scope
  const totals = useMemo(() => {
    return barangays.reduce(
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
  }, [barangays]);

  // Filter barangays by search query
  const filteredBarangays = useMemo(() => {
    if (!searchQuery.trim()) return barangays;
    const q = searchQuery.toLowerCase().trim();
    return barangays.filter((b) => (b.barangay_name || '').toLowerCase().includes(q));
  }, [barangays, searchQuery]);

  // Header metadata based on sector
  const headerMeta = useMemo(() => {
    if (isAnySenior) {
      return {
        badge: 'OSCA JURISDICTION',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        subtitle: 'Overview of officially registered and approved Senior Citizens (OSCA) across all 36 barangays in Bongabong.',
      };
    }
    if (isAnyPwd) {
      return {
        badge: 'PDAO / PWDO JURISDICTION',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        subtitle: 'Overview of officially registered and approved Persons with Disabilities (PDAO / PWDO) across all 36 barangays in Bongabong.',
      };
    }
    if (isAnyMswdo) {
      return {
        badge: 'MSWDO MUNICIPAL JURISDICTION',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        subtitle: 'Overview of officially approved municipal social welfare beneficiaries (Senior Citizens & PWDs) across all 36 barangays.',
      };
    }
    return {
      badge: 'DSWD JURISDICTION & COVERAGE',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-100',
      subtitle: 'Overview of officially approved beneficiaries, 4Ps households, senior citizens, PWDs, and IP classifications across barangays.',
    };
  }, [isAnySenior, isAnyPwd, isAnyMswdo]);

  // Dynamic stat cards strictly isolated by sector
  const statCards = useMemo(() => {
    if (isAnySenior) {
      const totalSeniors = totals.senior || totals.beneficiaries;
      return [
        { label: 'Total Barangays', value: barangays.length, icon: MapPin, color: 'text-green-600', iconColor: 'text-green-500' },
        { label: 'Total Senior Citizens', value: totalSeniors, icon: UserCheck, color: 'text-blue-600', iconColor: 'text-blue-500' },
        { label: 'IP Senior Citizens', value: totals.ip, icon: Globe, color: 'text-emerald-600', iconColor: 'text-emerald-500' },
        { label: 'Non-IP Senior Citizens', value: totals.nonIp, icon: Users, color: 'text-slate-600', iconColor: 'text-slate-500' },
      ];
    }

    if (isAnyPwd) {
      const totalPwds = totals.pwd || totals.beneficiaries;
      return [
        { label: 'Total Barangays', value: barangays.length, icon: MapPin, color: 'text-green-600', iconColor: 'text-green-500' },
        { label: 'Total PWD Beneficiaries', value: totalPwds, icon: Accessibility, color: 'text-purple-600', iconColor: 'text-purple-500' },
        { label: 'IP PWD Beneficiaries', value: totals.ip, icon: Globe, color: 'text-emerald-600', iconColor: 'text-emerald-500' },
        { label: 'Non-IP PWD Beneficiaries', value: totals.nonIp, icon: Users, color: 'text-slate-600', iconColor: 'text-slate-500' },
      ];
    }

    if (isAnyMswdo) {
      const municipalTotal = (totals.senior || 0) + (totals.pwd || 0);
      return [
        { label: 'Total Barangays', value: barangays.length, icon: MapPin, color: 'text-green-600', iconColor: 'text-green-500' },
        { label: 'Municipal Beneficiaries', value: municipalTotal, icon: Users, color: 'text-blue-600', iconColor: 'text-blue-500' },
        { label: 'Senior Citizens', value: totals.senior, icon: UserCheck, color: 'text-indigo-600', iconColor: 'text-indigo-500' },
        { label: 'PWD Beneficiaries', value: totals.pwd, icon: Accessibility, color: 'text-purple-600', iconColor: 'text-purple-500' },
        { label: 'IP / Non-IP', value: `${totals.ip} / ${totals.nonIp}`, icon: Globe, color: 'text-emerald-600', iconColor: 'text-emerald-500' },
      ];
    }

    // Default DSWD Admin
    return [
      { label: 'Total Barangays', value: barangays.length, icon: MapPin, color: 'text-green-600', iconColor: 'text-green-500' },
      { label: 'Approved Beneficiaries', value: totals.beneficiaries, icon: Users, color: 'text-blue-600', iconColor: 'text-blue-500' },
      { label: '4Ps Beneficiaries', value: totals.fourPs, icon: Heart, color: 'text-orange-600', iconColor: 'text-orange-500' },
      { label: 'Senior Citizens', value: totals.senior, icon: UserCheck, color: 'text-indigo-600', iconColor: 'text-indigo-500' },
      { label: 'PWD', value: totals.pwd, icon: Accessibility, color: 'text-purple-600', iconColor: 'text-purple-500' },
      { label: 'IP / Non-IP', value: `${totals.ip} / ${totals.nonIp}`, icon: Globe, color: 'text-emerald-600', iconColor: 'text-emerald-500' },
    ];
  }, [isAnySenior, isAnyPwd, isAnyMswdo, barangays.length, totals]);

  // Dynamic table columns strictly isolated by sector
  const columns = useMemo(() => {
    // ── Senior Citizen Admin / Staff Columns ──
    if (isAnySenior) {
      return [
        {
          header: 'Barangay Name',
          accessor: 'barangay_name',
          cell: (row) => (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="font-semibold text-slate-800">{row.barangay_name}</span>
            </div>
          ),
        },
        {
          header: 'Senior Citizens',
          accessor: 'senior',
          cell: (row) => {
            const count = (row.senior !== undefined && row.senior !== null ? row.senior : row.total) || 0;
            return (
              <span className="inline-flex items-center gap-1.5 font-bold text-blue-900 bg-blue-50 border border-blue-200/80 px-3 py-1 rounded-full text-sm">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                {count}
              </span>
            );
          },
        },
        {
          header: 'IP Senior Citizens',
          accessor: 'ip',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              {row.ip || 0}
            </span>
          ),
        },
        {
          header: 'Non-IP Senior Citizens',
          accessor: 'nonIp',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {row.nonIp || 0}
            </span>
          ),
        },
      ];
    }

    // ── PWD Admin / Staff Columns ──
    if (isAnyPwd) {
      return [
        {
          header: 'Barangay Name',
          accessor: 'barangay_name',
          cell: (row) => (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="font-semibold text-slate-800">{row.barangay_name}</span>
            </div>
          ),
        },
        {
          header: 'PWD Beneficiaries',
          accessor: 'pwd',
          cell: (row) => {
            const count = (row.pwd !== undefined && row.pwd !== null ? row.pwd : row.total) || 0;
            return (
              <span className="inline-flex items-center gap-1.5 font-bold text-purple-900 bg-purple-50 border border-purple-200/80 px-3 py-1 rounded-full text-sm">
                <Accessibility className="w-3.5 h-3.5 text-purple-600" />
                {count}
              </span>
            );
          },
        },
        {
          header: 'IP PWD Beneficiaries',
          accessor: 'ip',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              {row.ip || 0}
            </span>
          ),
        },
        {
          header: 'Non-IP PWD Beneficiaries',
          accessor: 'nonIp',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {row.nonIp || 0}
            </span>
          ),
        },
      ];
    }

    // ── MSWDO Admin / Staff Columns (Municipal only, 4Ps excluded) ──
    if (isAnyMswdo) {
      return [
        {
          header: 'Barangay Name',
          accessor: 'barangay_name',
          cell: (row) => (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="font-semibold text-slate-800">{row.barangay_name}</span>
            </div>
          ),
        },
        {
          header: 'Municipal Beneficiaries',
          accessor: 'total',
          cell: (row) => {
            const count = (row.senior || 0) + (row.pwd || 0);
            return (
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-sm">
                <Users className="w-3.5 h-3.5 text-slate-600" />
                {count}
              </span>
            );
          },
        },
        {
          header: 'Senior',
          accessor: 'senior',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              {row.senior || 0}
            </span>
          ),
        },
        {
          header: 'PWD',
          accessor: 'pwd',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
              <Accessibility className="w-3.5 h-3.5 text-purple-500" />
              {row.pwd || 0}
            </span>
          ),
        },
        {
          header: 'IP',
          accessor: 'ip',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              {row.ip || 0}
            </span>
          ),
        },
        {
          header: 'Non-IP',
          accessor: 'nonIp',
          cell: (row) => (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {row.nonIp || 0}
            </span>
          ),
        },
      ];
    }

    // ── Default DSWD Admin Columns ──
    return [
      {
        header: 'Barangay Name',
        accessor: 'barangay_name',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="font-semibold text-slate-800">{row.barangay_name}</span>
          </div>
        ),
      },
      {
        header: 'Total Beneficiaries',
        accessor: 'total',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-sm">
            <Users className="w-3.5 h-3.5 text-slate-600" />
            {row.total || 0}
          </span>
        ),
      },
      {
        header: '4Ps',
        accessor: 'fourPs',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 bg-orange-50 px-3 py-1 rounded-full">
            <Heart className="w-3.5 h-3.5 text-orange-500" />
            {row.fourPs || 0}
          </span>
        ),
      },
      {
        header: 'Senior',
        accessor: 'senior',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            {row.senior || 0}
          </span>
        ),
      },
      {
        header: 'PWD',
        accessor: 'pwd',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
            <Accessibility className="w-3.5 h-3.5 text-purple-500" />
            {row.pwd || 0}
          </span>
        ),
      },
      {
        header: 'IP',
        accessor: 'ip',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            {row.ip || 0}
          </span>
        ),
      },
      {
        header: 'Non-IP',
        accessor: 'nonIp',
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            {row.nonIp || 0}
          </span>
        ),
      },
    ];
  }, [isAnySenior, isAnyPwd, isAnyMswdo]);

  // Responsive grid columns class for the stat cards
  const gridColsClass = useMemo(() => {
    if (isAnySenior || isAnyPwd) {
      return 'grid-cols-2 lg:grid-cols-4';
    }
    if (isAnyMswdo) {
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
    }
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
  }, [isAnySenior, isAnyPwd, isAnyMswdo]);

  return (
    <div className="space-y-6">
      {/* Sector-tailored Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${headerMeta.badgeColor}`}>
              {headerMeta.badge}
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Barangay Directory & Demographics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {headerMeta.subtitle}
          </p>
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search barangay..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Sector-tailored Stats Cards */}
      <div className={`grid ${gridColsClass} gap-3`}>
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
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
        ) : filteredBarangays.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              {searchQuery ? `No barangays found matching "${searchQuery}"` : 'No barangays found'}
            </p>
          </div>
        ) : (
          <Table columns={columns} data={filteredBarangays} />
        )}
      </div>
    </div>
  );
}
