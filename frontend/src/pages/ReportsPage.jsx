import { useState, useEffect } from 'react';
import { FileText, Calendar, Filter, X, Download, FileSpreadsheet, Printer, Eye, CheckCircle, AlertCircle, TrendingUp, Users } from 'lucide-react';
import { reportsApi, programApi, barangayApi, beneficiaryApi, distributionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── CSV Download Helper ───────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─── Beneficiaries Modal ───────────────────────────────────────────
function BeneficiariesModal({ distribution, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, released, pending

  useEffect(() => {
    if (!distribution) return;
    
    const loadTransactions = async () => {
      try {
        const res = await distributionApi.getTransactions(distribution.id);
        setTransactions(res.data.data || []);
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadTransactions();
  }, [distribution]);

  if (!distribution) return null;

  const filteredTransactions = transactions.filter(txn => {
    if (filter === 'all') return true;
    return txn.status === filter;
  });

  const releasedCount = transactions.filter(t => t.status === 'released').length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Beneficiaries List
            </h2>
            <p className="text-sm text-slate-600 mt-1">{distribution.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-slate-900">{transactions.length}</div>
            <div className="text-xs text-slate-600 mt-1">Total Beneficiaries</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-green-700">{releasedCount}</div>
            <div className="text-xs text-green-600 mt-1">Released (Claimed)</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-xs text-amber-600 mt-1">Pending (Not Claimed)</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-200 bg-white">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            onClick={() => setFilter('released')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'released'
                ? 'bg-green-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Released ({releasedCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-96 p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-slate-500">Loading beneficiaries...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No beneficiaries found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((txn, idx) => (
                <div
                  key={txn.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    txn.status === 'released'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-sm font-semibold text-slate-700 shadow-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {txn.Beneficiary?.first_name} {txn.Beneficiary?.middle_name || ''} {txn.Beneficiary?.last_name}
                      </div>
                      <div className="text-xs text-slate-600">
                        {txn.Beneficiary?.beneficiary_id_code || txn.transaction_number}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900">
                      ₱{parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {txn.status === 'released' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Claimed</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs text-amber-600 font-medium">Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Distribution Detail Modal ─────────────────────────────────────
function DistributionDetailModal({ distribution, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!distribution) return;
    reportsApi.getDistributionDetail(distribution.id)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [distribution]);

  if (!distribution) return null;

  const formatCurrency = (v) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{distribution.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{distribution.distribution_id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Program', value: distribution.program },
                { label: 'Barangay', value: distribution.barangay },
                { label: 'Date', value: distribution.date ? new Date(distribution.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'Status', value: distribution.status, badge: true },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{item.label}</div>
                  {item.badge ? (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      distribution.status === 'completed' ? 'bg-green-100 text-green-700' :
                      distribution.status === 'ongoing' ? 'bg-yellow-100 text-yellow-700' :
                      distribution.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{distribution.status}</span>
                  ) : (
                    <div className="text-base font-semibold text-slate-900">{item.value || '—'}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{distribution.beneficiaries || 0}</div>
                <div className="text-xs text-blue-600 mt-1">Total Beneficiaries</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">{detail?.total_released || 0}</div>
                <div className="text-xs text-emerald-600 mt-1">Released</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-amber-700">{formatCurrency(distribution.amount)}</div>
                <div className="text-xs text-amber-600 mt-1">Amount Distributed</div>
              </div>
            </div>

            {/* Transactions Preview */}
            {detail?.Transactions?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Transactions ({detail.Transactions.length} shown)</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Beneficiary</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.Transactions.slice(0, 10).map((txn, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-800">
                            {txn.Beneficiary ? `${txn.Beneficiary.first_name} ${txn.Beneficiary.last_name}` : 'Unknown'}
                          </td>
                          <td className="px-4 py-2 text-slate-600 text-xs">{txn.Beneficiary?.category || '—'}</td>
                          <td className="px-4 py-2 text-slate-800">{formatCurrency(txn.amount)}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              txn.status === 'released' ? 'bg-green-100 text-green-700' :
                              txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>{txn.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail.Transactions.length > 10 && (
                  <p className="text-xs text-slate-500 text-center mt-2">Showing 10 of {detail.Transactions.length} transactions</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Report Page ──────────────────────────────────────────────
export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [reportType, setReportType] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Data states
  const [summary, setSummary] = useState({});
  const [programs, setPrograms] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [distributionStatus, setDistributionStatus] = useState([]);
  const [monthlyAid, setMonthlyAid] = useState([]);

  // Dynamic table data (switches based on reportType)
  const [tableData, setTableData] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [selectedDist, setSelectedDist] = useState(null);
  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── Auto-reload on filter / pagination change ──────────────────
  useEffect(() => {
    loadFiltersData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch table data whenever any filter, reportType, or page changes
  useEffect(() => {
    loadReportData(reportType, programFilter, barangayFilter, dateRange, currentPage, itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, programFilter, barangayFilter, dateRange.start, dateRange.end, currentPage, itemsPerPage]);

  const loadFiltersData = async () => {
    try {
      const [programsRes, barangaysRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
      ]);
      setPrograms(programsRes.data.data || []);
      setBarangays(barangaysRes.data.data || []);
    } catch (err) {
      console.error('Failed to load filter data:', err);
    }
  };

  // Accept params explicitly to avoid stale-closure issues
  const loadReportData = async (
    rType = reportType,
    pFilter = programFilter,
    bFilter = barangayFilter,
    dRange = dateRange,
    page = currentPage,
    limit = itemsPerPage
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (pFilter) params.program_id = pFilter;
      if (bFilter) params.barangay_id = bFilter;
      if (dRange.start) params.start_date = dRange.start;
      if (dRange.end) params.end_date = dRange.end;

      // Always load summary + charts
      const [summaryRes, statusRes, monthlyRes] = await Promise.all([
        reportsApi.summary(),
        reportsApi.distributionStatus(),
        reportsApi.monthlyAid(),
      ]);
      setSummary(summaryRes.data.data || {});
      setDistributionStatus(statusRes.data.data || []);
      setMonthlyAid(monthlyRes.data.data || []);

      // Fetch table data based on selected report type with fallback
      if (rType === 'beneficiary') {
        let benList = [];
        try {
          const res = await reportsApi.getTableBeneficiaries(params);
          benList = res.data.data || [];
          setTableTotal(res.data.pagination?.total || benList.length);
          setTotalPages(res.data.pagination?.totalPages || 1);
        } catch (e) {
          // Fallback if backend server hasn't restarted yet
          const res = await beneficiaryApi.list();
          let allData = res.data.data || [];
          if (bFilter) allData = allData.filter(b => String(b.barangay_id) === String(bFilter));
          const startIdx = (page - 1) * limit;
          benList = allData.slice(startIdx, startIdx + limit).map(b => ({
            id: b.id,
            first_name: b.first_name,
            last_name: b.last_name,
            category: b.category,
            barangay_name: b.Barangay?.barangay_name || 'N/A',
            status: b.status,
            created_at: b.createdAt,
          }));
          setTableTotal(allData.length);
          setTotalPages(Math.ceil(allData.length / limit) || 1);
        }
        setTableData(benList);
      } else if (rType === 'program') {
        let progList = [];
        try {
          const res = await reportsApi.getTablePrograms(params);
          progList = res.data.data || [];
          setTableTotal(res.data.pagination?.total || progList.length);
          setTotalPages(res.data.pagination?.totalPages || 1);
        } catch (e) {
          // Fallback if backend server hasn't restarted yet
          const res = await programApi.list();
          let allData = res.data.data || [];
          if (bFilter) allData = allData.filter(p => String(p.barangay_id) === String(bFilter));
          const startIdx = (page - 1) * limit;
          progList = allData.slice(startIdx, startIdx + limit).map(p => ({
            id: p.id,
            name: p.name,
            category: p.eligibility_category || p.category,
            barangay_name: p.Barangay?.barangay_name || 'All Barangays',
            status: p.status,
            enrollment_count: p.Enrollments?.length || 0,
            budget: p.budget,
          }));
          setTableTotal(allData.length);
          setTotalPages(Math.ceil(allData.length / limit) || 1);
        }
        setTableData(progList);
      } else if (rType === 'enrollment') {
        let enrollList = [];
        try {
          const res = await reportsApi.getTableEnrollments(params);
          enrollList = res.data.data || [];
          setTableTotal(res.data.pagination?.total || enrollList.length);
          setTotalPages(res.data.pagination?.totalPages || 1);
        } catch (e) {
          // Fallback if backend server hasn't restarted yet
          const res = await beneficiaryApi.listApplications();
          let allData = (res.data.data || []).filter(a => a.status === 'Approved');
          if (bFilter) allData = allData.filter(a => String(a.barangay_id) === String(bFilter));
          const startIdx = (page - 1) * limit;
          enrollList = allData.slice(startIdx, startIdx + limit).map(en => ({
            id: en.id,
            beneficiary_name: `${en.first_name || ''} ${en.last_name || ''}`.trim(),
            category: en.category,
            barangay_name: en.Barangay?.barangay_name || 'N/A',
            program_name: en.program_name || 'General Aid',
            status: 'active',
            created_at: en.createdAt,
          }));
          setTableTotal(allData.length);
          setTotalPages(Math.ceil(allData.length / limit) || 1);
        }
        setTableData(enrollList);
      } else {
        // Default: distribution (also used for 'distribution' type and 'all')
        const distRes = await reportsApi.recentDistributions(params);
        setTableData(distRes.data.data || []);
        setTableTotal(distRes.data.pagination?.total || 0);
        setTotalPages(distRes.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Load report data error:', err);
      setError(err?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setReportType('');
    setProgramFilter('');
    setBarangayFilter('');
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  // ── Table Configuration per Report Type ─────────────────────────
  const getTableConfig = () => {
    switch (reportType) {
      case 'beneficiary':
        return {
          title: 'Beneficiary List',
          exportType: 'beneficiaries',
          emptyMsg: 'No beneficiaries found matching the filters',
          columns: ['ID', 'Full Name', 'Category', 'Barangay', 'Status', 'Date Registered'],
          renderRow: (row) => (
            <>
              <td className="px-6 py-4 text-sm text-slate-500 font-mono">{row.id}</td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.first_name} {row.last_name}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.category || '—'}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.barangay_name || row.Barangay?.barangay_name || '—'}</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{row.status}</span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
            </>
          ),
        };
      case 'program':
        return {
          title: 'Program Report',
          exportType: 'programs',
          emptyMsg: 'No programs found matching the filters',
          columns: ['Program Name', 'Category', 'Barangay', 'Status', 'Active Enrollments', 'Budget'],
          renderRow: (row) => (
            <>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.eligibility_category || row.category || '—'}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.barangay_name || row.Barangay?.barangay_name || '—'}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  row.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>{row.status}</span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-900 text-center">{row.enrollment_count ?? row.Enrollments?.length ?? 0}</td>
              <td className="px-6 py-4 text-sm text-slate-900 font-medium">{formatCurrency(row.budget)}</td>
            </>
          ),
        };
      case 'enrollment':
        return {
          title: 'Enrollment Report',
          exportType: 'enrollments',
          emptyMsg: 'No enrollments found matching the filters',
          columns: ['ID', 'Beneficiary Name', 'Category', 'Barangay', 'Program', 'Status', 'Date Enrolled'],
          renderRow: (row) => (
            <>
              <td className="px-6 py-4 text-sm text-slate-500 font-mono">{row.id}</td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.beneficiary_name || `${row.Beneficiary?.first_name || ''} ${row.Beneficiary?.last_name || ''}`.trim()}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.category || row.Beneficiary?.category || '—'}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.barangay_name || row.Beneficiary?.Barangay?.barangay_name || '—'}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.program_name || row.BenefitProgram?.name || '—'}</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">{row.status}</span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
            </>
          ),
        };
      default: // '' or 'distribution'
        return {
          title: reportType === 'distribution' ? 'Distribution Report' : 'Recent Distributions',
          exportType: 'distributions',
          emptyMsg: 'No distributions found matching the filters',
          columns: ['ID', 'Distribution Title', 'Program', 'Barangay', 'Date', 'Beneficiaries', 'Amount', 'Status', 'Action'],
          renderRow: (row) => (
            <>
              <td className="px-6 py-4 text-sm text-slate-500 font-mono">{row.distribution_id}</td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.title}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.program}</td>
              <td className="px-6 py-4 text-sm text-slate-700">{row.barangay}</td>
              <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                {row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-slate-900">
                {row.released_count !== undefined ? (
                  <div className="space-y-2">
                    {/* Summary */}
                    <button
                      onClick={() => {
                        setSelectedDistribution(row);
                        setShowBeneficiariesModal(true);
                      }}
                      className="hover:bg-blue-50 rounded-lg p-2 transition-colors cursor-pointer group w-full"
                    >
                      <div className="font-semibold text-blue-600 group-hover:text-blue-700">{row.released_count}/{row.beneficiaries}</div>
                      <div className="text-xs text-slate-500">{row.pending_count} pending</div>
                    </button>
                    
                    {/* Pending beneficiaries preview */}
                    {row.pending_beneficiaries && row.pending_beneficiaries.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-xs font-semibold text-amber-700 mb-1">Pending:</div>
                        <div className="space-y-1">
                          {row.pending_beneficiaries.slice(0, 3).map((ben, idx) => (
                            <div key={idx} className="text-xs text-slate-700 flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-semibold text-amber-700">
                                {idx + 1}
                              </span>
                              <span className="truncate">{ben.name}</span>
                            </div>
                          ))}
                          {row.pending_beneficiaries.length > 3 && (
                            <div className="text-xs text-amber-600 font-medium">
                              +{row.pending_beneficiaries.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  row.beneficiaries
                )}
              </td>
              <td className="px-6 py-4 text-sm text-slate-900 font-medium whitespace-nowrap">{formatCurrency(row.amount)}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(row.status)}`}>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <button onClick={() => setSelectedDist(row)} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors">
                  <Eye className="w-4 h-4" /> View
                </button>
              </td>
            </>
          ),
        };
    }
  };

  // ── Export Helpers ──────────────────────────────────────────────
  const getExportParams = () => {
    const params = {};
    if (programFilter) params.program_id = programFilter;
    if (barangayFilter) params.barangay_id = barangayFilter;
    if (dateRange.start) params.start_date = dateRange.start;
    if (dateRange.end) params.end_date = dateRange.end;
    return params;
  };

function generateClientCSV(headers, rowsData) {
  const csvEscape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.join(',');
  const dataLines = rowsData.map(row => row.map(csvEscape).join(','));
  const csvString = [headerLine, ...dataLines].join('\n');
  return new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
}

  const handleExportCSV = async (type) => {
    setExportLoading(type);
    try {
      const params = getExportParams();
      let blob, filename;

      try {
        if (type === 'beneficiaries') {
          const res = await reportsApi.exportBeneficiaries(params);
          blob = res.data;
          filename = 'beneficiary-list.csv';
        } else if (type === 'distributions') {
          const res = await reportsApi.exportDistributions(params);
          blob = res.data;
          filename = 'distribution-report.csv';
        } else if (type === 'programs') {
          const res = await reportsApi.exportPrograms(params);
          blob = res.data;
          filename = 'program-report.csv';
        } else if (type === 'enrollments') {
          const res = await reportsApi.exportEnrollments(params);
          blob = res.data;
          filename = 'enrollment-report.csv';
        }
      } catch (backendErr) {
        // Fallback to client-side CSV generation if backend endpoint returns 404
        console.warn('Backend export endpoint returned error, using client-side fallback:', backendErr);
        if (type === 'beneficiaries') {
          filename = 'beneficiary-list.csv';
          const res = await beneficiaryApi.list();
          let list = res.data.data || [];
          if (barangayFilter) list = list.filter(b => String(b.barangay_id) === String(barangayFilter));
          const headers = ['ID', 'First Name', 'Last Name', 'Category', 'Barangay', 'Status', 'Date Registered'];
          const rows = list.map(b => [
            b.id, b.first_name, b.last_name, b.category || '', b.Barangay?.barangay_name || '', b.status, b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US') : ''
          ]);
          blob = generateClientCSV(headers, rows);
        } else if (type === 'distributions') {
          filename = 'distribution-report.csv';
          const res = await reportsApi.recentDistributions({ limit: 1000, ...params });
          const list = res.data.data || [];
          const headers = ['Distribution ID', 'Title', 'Program', 'Barangay', 'Date', 'Beneficiaries', 'Amount Released', 'Status'];
          const rows = list.map(d => [
            d.distribution_id || '', d.title || '', d.program || '', d.barangay || '', d.date ? new Date(d.date).toLocaleDateString('en-US') : '', d.beneficiaries || 0, d.amount || 0, d.status || ''
          ]);
          blob = generateClientCSV(headers, rows);
        } else if (type === 'programs') {
          filename = 'program-report.csv';
          const res = await programApi.list();
          let list = res.data.data || [];
          if (barangayFilter) list = list.filter(p => String(p.barangay_id) === String(barangayFilter));
          const headers = ['Program Name', 'Category', 'Barangay', 'Status', 'Active Enrollments', 'Budget'];
          const rows = list.map(p => [
            p.name, p.eligibility_category || p.category || '', p.Barangay?.barangay_name || '', p.status, p.Enrollments?.length || 0, p.budget || 0
          ]);
          blob = generateClientCSV(headers, rows);
        } else if (type === 'enrollments') {
          filename = 'enrollment-report.csv';
          const res = await beneficiaryApi.listApplications();
          let list = (res.data.data || []).filter(a => a.status === 'Approved');
          if (barangayFilter) list = list.filter(a => String(a.barangay_id) === String(barangayFilter));
          const headers = ['Enrollment ID', 'Beneficiary Name', 'Category', 'Barangay', 'Program', 'Status', 'Date Enrolled'];
          const rows = list.map(e => [
            e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim(), e.category || '', e.Barangay?.barangay_name || '', e.program_name || 'General Aid', 'active', e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-US') : ''
          ]);
          blob = generateClientCSV(headers, rows);
        }
      }

      if (blob && filename) {
        downloadBlob(blob, filename);
        showSuccess(`✅ ${filename} downloaded successfully!`);
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export report: ' + (err?.message || 'Unknown error'));
    } finally {
      setExportLoading('');
    }
  };

  const handlePrint = () => {
    const printContent = buildPrintHTML();
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const buildPrintHTML = () => {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const totalBeneficiaries = (summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0);
    const formatCur = (v) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v || 0);
    const cfg = getTableConfig();

    let tableHeaders = '';
    let rowsHTML = '';

    if (reportType === 'beneficiary') {
      tableHeaders = '<th>ID</th><th>Full Name</th><th>Category</th><th>Barangay</th><th>Status</th><th>Date Registered</th>';
      rowsHTML = tableData.map(b => `
        <tr>
          <td>${b.id || ''}</td>
          <td>${b.first_name || ''} ${b.last_name || ''}</td>
          <td>${b.category || '—'}</td>
          <td>${b.barangay_name || '—'}</td>
          <td>${b.status || ''}</td>
          <td>${b.created_at ? new Date(b.created_at).toLocaleDateString('en-US') : '—'}</td>
        </tr>`).join('');
    } else if (reportType === 'program') {
      tableHeaders = '<th>Program Name</th><th>Category</th><th>Barangay</th><th>Status</th><th>Active Enrollments</th><th>Budget</th>';
      rowsHTML = tableData.map(p => `
        <tr>
          <td>${p.name || ''}</td>
          <td>${p.category || '—'}</td>
          <td>${p.barangay_name || '—'}</td>
          <td>${p.status || ''}</td>
          <td>${p.enrollment_count || 0}</td>
          <td>${formatCur(p.budget)}</td>
        </tr>`).join('');
    } else if (reportType === 'enrollment') {
      tableHeaders = '<th>ID</th><th>Beneficiary Name</th><th>Category</th><th>Barangay</th><th>Program</th><th>Status</th><th>Date Enrolled</th>';
      rowsHTML = tableData.map(e => `
        <tr>
          <td>${e.id || ''}</td>
          <td>${e.beneficiary_name || ''}</td>
          <td>${e.category || '—'}</td>
          <td>${e.barangay_name || '—'}</td>
          <td>${e.program_name || '—'}</td>
          <td>${e.status || ''}</td>
          <td>${e.created_at ? new Date(e.created_at).toLocaleDateString('en-US') : '—'}</td>
        </tr>`).join('');
    } else {
      tableHeaders = '<th>ID</th><th>Title</th><th>Program</th><th>Barangay</th><th>Date</th><th>Beneficiaries</th><th>Amount</th><th>Status</th>';
      rowsHTML = tableData.map(d => `
        <tr>
          <td>${d.distribution_id || ''}</td>
          <td>${d.title || ''}</td>
          <td>${d.program || ''}</td>
          <td>${d.barangay || ''}</td>
          <td>${d.date ? new Date(d.date).toLocaleDateString('en-US') : ''}</td>
          <td>${d.beneficiaries || 0}</td>
          <td>${formatCur(d.amount)}</td>
          <td>${d.status || ''}</td>
        </tr>`).join('');
    }

    return `<!DOCTYPE html>
<html>
<head>
  <title>DSWD EBMS Report - ${now}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e3a8a; padding-bottom: 16px; }
    .header h1 { font-size: 18px; font-weight: bold; color: #1e3a8a; }
    .header p { font-size: 11px; color: #555; margin-top: 4px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; }
    .stat-box .value { font-size: 20px; font-weight: bold; color: #1e3a8a; }
    .stat-box .label { font-size: 10px; color: #666; margin-top: 2px; }
    h2 { font-size: 13px; font-weight: bold; margin: 16px 0 8px; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #1e3a8a; color: white; }
    thead th { padding: 6px 8px; text-align: left; font-weight: 600; }
    tbody tr:nth-child(even) { background: #f0f4ff; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>DSWD Electronic Beneficiary Management System</h1>
    <p>Official Report &mdash; Generated: ${now}</p>
    ${programFilter ? `<p>Program Filter: ${programs.find(p => String(p.id) === String(programFilter))?.name || ''}</p>` : ''}
    ${barangayFilter ? `<p>Barangay Filter: ${barangays.find(b => String(b.id) === String(barangayFilter))?.barangay_name || ''}</p>` : ''}
    ${dateRange.start || dateRange.end ? `<p>Date Range: ${dateRange.start || '—'} to ${dateRange.end || '—'}</p>` : ''}
  </div>
  <div class="stats">
    <div class="stat-box"><div class="value">${totalBeneficiaries}</div><div class="label">Total Beneficiaries</div></div>
    <div class="stat-box"><div class="value">${summary.totalPrograms || 0}</div><div class="label">Active Programs</div></div>
    <div class="stat-box"><div class="value">${summary.pendingApplications || 0}</div><div class="label">Pending Enrollments</div></div>
    <div class="stat-box"><div class="value">${summary.completedEvents || 0}</div><div class="label">Completed Distributions</div></div>
    <div class="stat-box"><div class="value">${formatCur(summary.totalDistributedFunds)}</div><div class="label">Total Budget Distributed</div></div>
  </div>
  <h2>${cfg.title}</h2>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${rowsHTML || `<tr><td colSpan="8" style="text-align:center;padding:20px;">${cfg.emptyMsg}</td></tr>`}</tbody>
  </table>
  <div class="footer">DSWD EBMS &copy; ${new Date().getFullYear()} &mdash; Confidential &mdash; Page 1</div>
</body>
</html>`;
  };

  // ── Charts ──────────────────────────────────────────────────────
  const getProgramChartData = () => {
    const data = [
      { name: '4Ps Program', count: summary.fourPsCount || 0 },
      { name: 'Senior Citizens', count: summary.seniorCitizensCount || 0 },
      { name: 'PWD Program', count: summary.pwdCount || 0 },
    ];
    const total = data.reduce((sum, p) => sum + p.count, 0);
    return data.map(p => ({ ...p, percentage: total > 0 ? ((p.count / total) * 100).toFixed(1) : 0 }));
  };

  const getStatusChartData = () => {
    const total = distributionStatus.reduce((sum, s) => sum + s.count, 0);
    return distributionStatus.map(s => ({
      status: s.status, count: s.count,
      percentage: total > 0 ? ((s.count / total) * 100).toFixed(1) : 0,
    }));
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'ongoing': return 'bg-yellow-100 text-yellow-700';
      case 'draft': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const goToPage = (page) => setCurrentPage(page);
  const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
  const goToPreviousPage = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

  // ── Available report definitions ──────────────────────────────
  const availableReports = [
    { icon: '👥', title: 'Beneficiary List', desc: 'Export list of all approved beneficiaries', color: 'bg-blue-50 hover:bg-blue-100 border-blue-200', exportType: 'beneficiaries', fileName: 'beneficiary-list.csv' },
    { icon: '📊', title: 'Distribution Report', desc: 'Summary of all distribution events', color: 'bg-green-50 hover:bg-green-100 border-green-200', exportType: 'distributions', fileName: 'distribution-report.csv' },
    { icon: '📝', title: 'Program Report', desc: 'Overview of benefit programs', color: 'bg-purple-50 hover:bg-purple-100 border-purple-200', exportType: 'programs', fileName: 'program-report.csv' },
    { icon: '📋', title: 'Enrollment Report', desc: 'Active enrollments per program', color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200', exportType: 'enrollments', fileName: 'enrollment-report.csv' },
  ];

  const totalBeneficiaries = (summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate and download accurate reports for monitoring, transparency, and decision-making
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            Filters apply to exports & table below
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white appearance-none cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%233B82F6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2.5rem' }}
            >
              <option value="">All Reports</option>
              <option value="beneficiary">Beneficiary Reports</option>
              <option value="distribution">Distribution Reports</option>
              <option value="program">Program Reports</option>
              <option value="enrollment">Enrollment Reports</option>
            </select>
          </div>

          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Program</label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white appearance-none cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%233B82F6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2.5rem' }}
            >
              <option value="">All Programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Barangay */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Barangay</label>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white appearance-none cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%233B82F6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2.5rem' }}
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => <option key={b.id} value={b.id}>{b.barangay_name}</option>)}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-0"
              />
              <span className="text-slate-400 flex-shrink-0">–</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-0"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Apply Filters
          </button>
          <button
            onClick={resetFilters}
            className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { icon: '👥', label: 'Total Beneficiaries', value: totalBeneficiaries, sub: 'All Programs', color: 'bg-blue-50', iconColor: 'bg-blue-100', Icon: null },
          { icon: '📋', label: 'Active Programs', value: summary.totalPrograms || 0, sub: 'All Programs', color: 'bg-white', iconColor: 'bg-red-100' },
          { icon: '⏳', label: 'Pending Enrollments', value: summary.pendingApplications || 0, sub: 'Awaiting Review', color: 'bg-white', iconColor: 'bg-amber-100' },
          { icon: '✅', label: 'Distributions Done', value: summary.completedEvents || 0, sub: 'All Events', color: 'bg-white', iconColor: 'bg-emerald-100' },
          { icon: '💰', label: 'Budget Distributed', value: formatCurrency(summary.totalDistributedFunds), sub: 'All Time', color: 'bg-amber-50', iconColor: 'bg-amber-100', small: true },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} rounded-xl border border-slate-200 p-5 shadow-sm`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 ${stat.iconColor} rounded-lg text-lg`}>{stat.icon}</div>
            </div>
            <div className={`font-bold text-slate-900 ${stat.small ? 'text-xl' : 'text-3xl'}`}>{stat.value}</div>
            <div className="text-sm text-slate-600 mt-1">{stat.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Program Distribution Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Program Distribution</h3>
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-4">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {(() => {
                  const data = getProgramChartData();
                  const total = data.reduce((sum, item) => sum + item.count, 0);
                  let currentAngle = 0;
                  const colors = ['#00338D', '#E30613', '#FFD100'];
                  return data.map((item, idx) => {
                    const percentage = total > 0 ? (item.count / total) : 0;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle = endAngle;
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    const outerRadius = 90, innerRadius = 60;
                    const x1 = 100 + outerRadius * Math.cos(startRad);
                    const y1 = 100 + outerRadius * Math.sin(startRad);
                    const x2 = 100 + outerRadius * Math.cos(endRad);
                    const y2 = 100 + outerRadius * Math.sin(endRad);
                    const x3 = 100 + innerRadius * Math.cos(endRad);
                    const y3 = 100 + innerRadius * Math.sin(endRad);
                    const x4 = 100 + innerRadius * Math.cos(startRad);
                    const y4 = 100 + innerRadius * Math.sin(startRad);
                    const largeArc = angle > 180 ? 1 : 0;
                    const pathData = [`M ${x1} ${y1}`, `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`, `L ${x3} ${y3}`, `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`, 'Z'].join(' ');
                    return percentage > 0 ? <path key={idx} d={pathData} fill={colors[idx % colors.length]} className="hover:opacity-80 transition-opacity" /> : null;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-slate-900">{getProgramChartData().reduce((s, i) => s + i.count, 0)}</div>
                <div className="text-sm text-slate-500">Total</div>
              </div>
            </div>
            <div className="w-full space-y-2">
              {getProgramChartData().map((item, idx) => {
                const colors = ['bg-[#00338D]', 'bg-[#E30613]', 'bg-[#FFD100]'];
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} flex-shrink-0`} />
                      <span className="text-slate-700 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-slate-900 font-semibold">{item.count}</span>
                      <span className="text-slate-500">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Aid Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Monthly Aid Distribution</h3>
          <div className="h-64 relative">
            <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-slate-500">
              {(() => {
                const maxValue = Math.max(...monthlyAid.map(m => parseFloat(m.total || 0)), 1);
                return [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map((val, idx) => (
                  <div key={idx} className="text-right pr-2">₱{(val / 1000).toFixed(0)}K</div>
                ));
              })()}
            </div>
            <div className="absolute left-16 right-0 top-0 bottom-0">
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map(idx => <div key={idx} className="border-t border-slate-100" />)}
              </div>
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-8">
                {monthlyAid.length > 0 ? monthlyAid.map((item, idx) => {
                  const maxValue = Math.max(...monthlyAid.map(m => parseFloat(m.total || 0)), 1);
                  const height = ((parseFloat(item.total || 0) / maxValue) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div className="relative flex-1 w-full flex items-end justify-center">
                        <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-500 relative group-hover:shadow-lg"
                          style={{ height: `${height}%`, minHeight: height > 0 ? '8px' : '0' }}>
                          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {formatCurrency(item.total)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 mt-2 font-medium">{item.month}</div>
                    </div>
                  );
                }) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No data available</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Status Donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Distribution Status</h3>
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-4">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {(() => {
                  const data = getStatusChartData();
                  const total = data.reduce((sum, item) => sum + item.count, 0);
                  let currentAngle = 0;
                  const colorMap = { 'Completed': '#10B981', 'Ongoing': '#F59E0B', 'Scheduled': '#3B82F6', 'Cancelled': '#94A3B8' };
                  return data.map((item, idx) => {
                    const percentage = total > 0 ? (item.count / total) : 0;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle = endAngle;
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    const outerRadius = 90, innerRadius = 60;
                    const x1 = 100 + outerRadius * Math.cos(startRad);
                    const y1 = 100 + outerRadius * Math.sin(startRad);
                    const x2 = 100 + outerRadius * Math.cos(endRad);
                    const y2 = 100 + outerRadius * Math.sin(endRad);
                    const x3 = 100 + innerRadius * Math.cos(endRad);
                    const y3 = 100 + innerRadius * Math.sin(endRad);
                    const x4 = 100 + innerRadius * Math.cos(startRad);
                    const y4 = 100 + innerRadius * Math.sin(startRad);
                    const largeArc = angle > 180 ? 1 : 0;
                    const pathData = [`M ${x1} ${y1}`, `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`, `L ${x3} ${y3}`, `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`, 'Z'].join(' ');
                    return percentage > 0 ? <path key={idx} d={pathData} fill={colorMap[item.status] || '#94A3B8'} className="hover:opacity-80 transition-opacity" /> : null;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-slate-900">{getStatusChartData().reduce((s, i) => s + i.count, 0)}</div>
                <div className="text-sm text-slate-500">Events</div>
              </div>
            </div>
            <div className="w-full space-y-2">
              {getStatusChartData().map((item, idx) => {
                const colorMap = { 'Completed': 'bg-green-500', 'Ongoing': 'bg-yellow-500', 'Scheduled': 'bg-blue-500', 'Cancelled': 'bg-slate-400' };
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colorMap[item.status] || 'bg-slate-400'}`} />
                      <span className="text-slate-700">{item.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-semibold">{item.count}</span>
                      <span className="text-slate-500">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Data Table — switches by Report Type */}
      {(() => {
        const cfg = getTableConfig();
        const colCount = cfg.columns.length;
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Table Header */}
            <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{cfg.title}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Showing {tableData.length} of {tableTotal} records
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <button
                  onClick={() => handleExportCSV(cfg.exportType)}
                  disabled={exportLoading === cfg.exportType}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-60"
                >
                  {exportLoading === cfg.exportType ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export CSV
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {cfg.columns.map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={colCount} className="px-6 py-8 text-center text-slate-500">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="mt-2 text-sm">Loading...</p>
                      </td>
                    </tr>
                  ) : tableData.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="px-6 py-10 text-center text-slate-500">
                        <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        {cfg.emptyMsg}
                      </td>
                    </tr>
                  ) : (
                    tableData.map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                        {cfg.renderRow(row)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && tableTotal > 0 && (
              <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-slate-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, tableTotal)} of {tableTotal} entries
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={goToPreviousPage} disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${currentPage === 1 ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages = [];
                      const maxVisible = 5;
                      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
                      if (start > 1) { pages.push(<button key={1} onClick={() => goToPage(1)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">1</button>); if (start > 2) pages.push(<span key="e1" className="px-2 text-slate-400">...</span>); }
                      for (let i = start; i <= end; i++) {
                        pages.push(<button key={i} onClick={() => goToPage(i)} className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${currentPage === i ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{i}</button>);
                      }
                      if (end < totalPages) { if (end < totalPages - 1) pages.push(<span key="e2" className="px-2 text-slate-400">...</span>); pages.push(<button key={totalPages} onClick={() => goToPage(totalPages)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">{totalPages}</button>); }
                      return pages;
                    })()}
                  </div>
                  <button onClick={goToNextPage} disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${currentPage === totalPages ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Available Reports & Quick Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Reports */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Available Reports</h3>
          <p className="text-sm text-slate-600 mb-5">Click to download a CSV report with current filters applied</p>
          <div className="space-y-3">
            {availableReports.map((report, idx) => (
              <button
                key={idx}
                onClick={() => handleExportCSV(report.exportType)}
                disabled={exportLoading === report.exportType}
                className={`w-full border ${report.color} rounded-xl p-4 transition-all text-left flex items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="text-2xl">{report.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{report.title}</div>
                  <div className="text-sm text-slate-600">{report.desc}</div>
                </div>
                {exportLoading === report.exportType ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-500" />
                ) : (
                  <Download className="w-5 h-5 text-slate-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Export */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Quick Export</h3>
          <p className="text-sm text-slate-600 mb-5">Export current distribution data to your preferred format</p>
          <div className="grid grid-cols-2 gap-3">
            {/* PDF-style Print */}
            <button
              onClick={handlePrint}
              className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl p-5 transition-colors text-left flex flex-col items-center justify-center gap-2"
            >
              <FileText className="w-8 h-8 text-red-600" />
              <div className="font-semibold text-slate-900 text-sm text-center">Export as PDF</div>
              <div className="text-xs text-slate-600 text-center">Print to PDF / Save</div>
            </button>

            {/* Excel (CSV) */}
            <button
              onClick={() => handleExportCSV('distributions')}
              disabled={exportLoading === 'distributions'}
              className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl p-5 transition-colors text-left flex flex-col items-center justify-center gap-2 disabled:opacity-60"
            >
              {exportLoading === 'distributions' ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              ) : (
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
              )}
              <div className="font-semibold text-slate-900 text-sm text-center">Export as Excel</div>
              <div className="text-xs text-slate-600 text-center">Download CSV file</div>
            </button>

            {/* Beneficiary CSV */}
            <button
              onClick={() => handleExportCSV('beneficiaries')}
              disabled={exportLoading === 'beneficiaries'}
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl p-5 transition-colors text-left flex flex-col items-center justify-center gap-2 disabled:opacity-60"
            >
              {exportLoading === 'beneficiaries' ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              ) : (
                <Download className="w-8 h-8 text-blue-600" />
              )}
              <div className="font-semibold text-slate-900 text-sm text-center">Beneficiary CSV</div>
              <div className="text-xs text-slate-600 text-center">Download beneficiary list</div>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-5 transition-colors text-left flex flex-col items-center justify-center gap-2"
            >
              <Printer className="w-8 h-8 text-slate-600" />
              <div className="font-semibold text-slate-900 text-sm text-center">Print Report</div>
              <div className="text-xs text-slate-600 text-center">Open print preview</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-slate-500">
        © 2026 DSWD Beneficiary Management System. All rights reserved. | Version 1.0.0
      </div>

      {/* Distribution Detail Modal */}
      {selectedDist && (
        <DistributionDetailModal
          distribution={selectedDist}
          onClose={() => setSelectedDist(null)}
        />
      )}

      {/* Beneficiaries Modal */}
      {showBeneficiariesModal && selectedDistribution && (
        <BeneficiariesModal
          distribution={selectedDistribution}
          onClose={() => {
            setShowBeneficiariesModal(false);
            setSelectedDistribution(null);
          }}
        />
      )}
    </div>
  );
}
