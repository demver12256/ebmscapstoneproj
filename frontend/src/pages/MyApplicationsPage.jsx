import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, XCircle, Calendar, User } from 'lucide-react';
import { beneficiaryApi } from '../services/api';

export default function MyApplicationsPage() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const statusConfig = {
    Pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Under Review' },
    Approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200', label: 'Approved' },
    Rejected: { icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' },
  };

  const currentStatus = statusConfig[beneficiary?.status] || statusConfig.Pending;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Applications</h1>
        <p className="text-slate-600 mt-1">Track your application status and history</p>
      </div>

      {/* Current Application Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Beneficiary Application</h2>
            <p className="text-sm text-slate-600">Application ID: {beneficiary?.beneficiary_id_code || 'N/A'}</p>
          </div>
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${currentStatus.color}`}>
            <StatusIcon className="w-4 h-4" />
            {currentStatus.label}
          </span>
        </div>

        {/* Application Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Full Name</p>
              <p className="font-semibold text-slate-900">
                {beneficiary?.first_name} {beneficiary?.middle_name} {beneficiary?.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Category</p>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                {beneficiary?.category || 'N/A'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Barangay</p>
              <p className="font-semibold text-slate-900">{beneficiary?.Barangay?.barangay_name || 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Date Submitted</p>
              <p className="font-semibold text-slate-900">
                {beneficiary?.created_at ? new Date(beneficiary.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
            {beneficiary?.status === 'Approved' && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Date Approved</p>
                <p className="font-semibold text-slate-900">
                  {beneficiary?.approval_date ? new Date(beneficiary.approval_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Contact Number</p>
              <p className="font-semibold text-slate-900">{beneficiary?.contact_number || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Application Timeline</h3>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200"></div>
            <div className="space-y-6">
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Account Created</p>
                  <p className="text-sm text-slate-600">
                    {beneficiary?.created_at ? new Date(beneficiary.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Application Submitted</p>
                  <p className="text-sm text-slate-600">Your application has been received</p>
                </div>
              </div>

              {beneficiary?.status === 'Approved' && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Application Approved</p>
                    <p className="text-sm text-slate-600">
                      {beneficiary?.approval_date ? new Date(beneficiary.approval_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {beneficiary?.status === 'Pending' && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Under Review</p>
                    <p className="text-sm text-slate-600">Your application is being reviewed by staff</p>
                  </div>
                </div>
              )}

              {beneficiary?.status === 'Rejected' && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Application Rejected</p>
                    <p className="text-sm text-slate-600">Please contact the office for more information</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      {beneficiary?.status === 'Pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Application Under Review</p>
              <p className="text-sm text-blue-700">
                Your application is currently being reviewed by our staff. You will be notified once a decision has been made.
                This process typically takes 3-5 business days.
              </p>
            </div>
          </div>
        </div>
      )}

      {beneficiary?.status === 'Approved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 mb-1">Congratulations!</p>
              <p className="text-sm text-green-700">
                Your application has been approved. You are now an official beneficiary and can access all program benefits.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
