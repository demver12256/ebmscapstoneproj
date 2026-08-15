import { useState, useEffect } from 'react';
import { DollarSign, Calendar, CheckCircle, Clock, Package, TrendingUp, Download, AlertTriangle } from 'lucide-react';
import { beneficiaryApi } from '../services/api';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

export default function MyBenefitsPage() {
  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBeneficiaryData();
  }, []);

  const loadBeneficiaryData = async () => {
    try {
      const res = await beneficiaryApi.getMe();
      setBeneficiary(res.data.data);
    } catch (err) {
      console.error('Failed to load beneficiary data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate data before early return
  const transactions = beneficiary?.DistributionTransactions || [];
  const released = transactions.filter(t => t.status === 'released');
  const pending = transactions.filter(t => t.status === 'pending');
  
  const totalReceived = released.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalPending = pending.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  // Get unique programs from enrollments
  const enrolledPrograms = beneficiary?.Enrollments || [];

  // Pagination for transactions - MUST be before early return
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedTransactions,
    goToPage,
    startIndex,
    endIndex,
    totalItems
  } = usePagination(transactions, 10);

  // Early return AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <Package className="w-8 h-8 text-yellow-300" />
          <h1 className="text-3xl font-black tracking-tight">My Benefits Overview</h1>
        </div>
        <p className="text-blue-100 text-sm mt-1 max-w-2xl">
          View your released and pending assistance payouts, claimed benefit history, and active program enrollments.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5" />
            <p className="text-sm font-semibold">Total Received</p>
          </div>
          <p className="text-3xl font-black">₱{totalReceived.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-green-100 mt-1">All time</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            <p className="text-sm font-semibold">Pending</p>
          </div>
          <p className="text-3xl font-black">₱{totalPending.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-blue-100 mt-1">{pending.length} distribution(s)</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5" />
            <p className="text-sm font-semibold">Programs</p>
          </div>
          <p className="text-3xl font-black">{enrolledPrograms.length}</p>
          <p className="text-xs text-purple-100 mt-1">Enrolled</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" />
            <p className="text-sm font-semibold">Distributions</p>
          </div>
          <p className="text-3xl font-black">{released.length}</p>
          <p className="text-xs text-amber-100 mt-1">Received</p>
        </div>
      </div>

      {/* Enrolled Programs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Enrolled Programs</h2>
          <span className="text-sm text-slate-600">{enrolledPrograms.length} program(s)</span>
        </div>

        {enrolledPrograms.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">You are not enrolled in any programs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrolledPrograms.map((enrollment) => (
              <div key={enrollment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <h3 className="font-semibold text-slate-900">{enrollment.BenefitProgram?.name || 'N/A'}</h3>
                  <p className="text-sm text-slate-600">
                    Enrolled on {new Date(enrollment.enrollment_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  enrollment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {enrollment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benefits History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Benefits History</h2>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No benefits received yet</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Event</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">
                            {new Date(txn.Event?.distribution_date || txn.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-900 font-medium">{txn.Event?.Program?.name || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{txn.Event?.title || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-green-600">
                          ₱{parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {txn.status === 'released' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Received
                          </span>
                        ) : (txn.Event?.distribution_date && String(txn.Event.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0]) || txn.Event?.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-extrabold border border-amber-300" title="The distribution date for this event has passed without being claimed">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Unclaimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalItems}
                itemsPerPage={10}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            </div>
          </div>
        )}
      </div>

      {/* Year Summary */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-purple-900 mb-4">Year {new Date().getFullYear()} Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Total Received This Year</p>
            <p className="text-2xl font-bold text-slate-900">
              ₱{released
                .filter(t => new Date(t.released_at).getFullYear() === new Date().getFullYear())
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Distributions This Year</p>
            <p className="text-2xl font-bold text-slate-900">
              {released.filter(t => new Date(t.released_at).getFullYear() === new Date().getFullYear()).length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Average Per Distribution</p>
            <p className="text-2xl font-bold text-slate-900">
              ₱{released.length > 0 
                ? (totalReceived / released.length).toLocaleString('en-PH', { minimumFractionDigits: 2 })
                : '0.00'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
