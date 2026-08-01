import { Calendar, MapPin, Copy, Bell, FileText, CheckCircle2, Clock, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ApprovedBeneficiaryDashboard({ beneficiary }) {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const handleCopy = () => {
    navigator.clipboard.writeText(beneficiary?.beneficiary_id_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get next upcoming distribution
  const upcomingDistribution = beneficiary?.DistributionTransactions
    ?.filter(txn => txn.status === 'pending')
    ?.sort((a, b) => new Date(a.Event?.distribution_date) - new Date(b.Event?.distribution_date))?.[0];

  // Calculate total benefits
  const totalBenefits = beneficiary?.DistributionTransactions
    ?.filter(txn => txn.status === 'released')
    ?.reduce((sum, txn) => sum + parseFloat(txn.amount), 0) || 0;

  const distributionsCount = beneficiary?.DistributionTransactions
    ?.filter(txn => txn.status === 'released')?.length || 0;

  const enrolledProgram = beneficiary?.Enrollments?.[0]?.BenefitProgram;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Beneficiary Dashboard</h1>
        <p className="text-slate-600">Welcome back, {beneficiary?.first_name}! Here is your application and benefit overview.</p>
        <p className="text-sm text-slate-500 mt-1">
          Date Today: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Banner - Show different message based on status */}
      {user?.status === 'inactive' ? (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-300 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-orange-900">⚠️ Unauthorized access - user inactive</p>
            {(beneficiary?.inactivation_reason || user?.inactive_reason) && (
              <p className="text-sm text-orange-700 mt-1">
                Reason: {beneficiary?.inactivation_reason || user?.inactive_reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-green-900">Congratulations! Your application has been APPROVED.</p>
            <p className="text-sm text-green-700">You are now an official beneficiary. You can now view your benefits and upcoming distributions.</p>
          </div>
        </div>
      )}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className={`text-white rounded-xl p-5 shadow-lg ${
          user?.status === 'inactive' 
            ? 'bg-gradient-to-br from-red-500 to-red-700' 
            : 'bg-gradient-to-br from-dswd-blue to-blue-700'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {user?.status === 'inactive' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <p className="text-sm font-semibold">My Status</p>
          </div>
          <h3 className="text-2xl font-black mb-1">
            {user?.status === 'inactive' ? 'INACTIVE' : 'APPROVED'}
          </h3>
          <p className="text-xs opacity-90">
            {user?.status === 'inactive' 
              ? 'Account temporarily deactivated' 
              : 'You are an official beneficiary.'}
          </p>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>Approved on</span>
            <span className="font-bold">{beneficiary?.approval_date || 'N/A'}</span>
          </div>
        </div>

        {/* Beneficiary ID Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
          <div className="absolute top-3 right-3 bg-dswd-lightBlue text-white px-2 py-0.5 rounded text-[10px] font-bold">
            OFFICIAL MEMBER
          </div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-dswd-lightBlue" />
            <p className="text-sm font-semibold text-slate-700">Beneficiary ID</p>
          </div>
          <h3 className="text-xl font-black text-slate-900">{beneficiary?.beneficiary_id_code}</h3>
          <button
            onClick={handleCopy}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-dswd-lightBlue hover:text-dswd-blue transition"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Enrolled Program Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-amber-600" />
            <p className="text-sm font-semibold text-amber-900">Enrolled Program</p>
          </div>
          {enrolledProgram ? (
            <>
              <h4 className="text-sm font-bold text-amber-900 leading-tight">{enrolledProgram.name}</h4>
              <button className="mt-3 text-xs font-semibold text-amber-700 hover:text-amber-800 transition">
                View Program Details
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-700">No program enrollment yet</p>
          )}
        </div>

        {/* Barangay Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-slate-600" />
            <p className="text-sm font-semibold text-slate-700">Barangay</p>
          </div>
          <h4 className="text-lg font-bold text-slate-900">{beneficiary?.Barangay?.barangay_name || 'N/A'}</h4>
          <p className="text-xs text-slate-600 mt-1">
            {beneficiary?.sitio ? `${beneficiary.sitio},` : ''} {beneficiary?.Barangay?.barangay_name}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Upcoming Distribution</h3>
            </div>

            {upcomingDistribution ? (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex gap-6">
                  <div className="bg-dswd-blue text-white rounded-xl p-4 text-center flex-shrink-0">
                    <p className="text-xs font-bold uppercase">
                      {new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                    <p className="text-3xl font-black">
                      {new Date(upcomingDistribution.Event?.distribution_date).getDate()}
                    </p>
                    <p className="text-xs">{new Date(upcomingDistribution.Event?.distribution_date).getFullYear()}</p>
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-lg">{upcomingDistribution.Event?.title}</h4>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Date:</span>
                        <span className="font-semibold">
                          {new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Time:</span>
                        <span className="font-semibold">8:00 AM - 4:00 PM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>Venue:</span>
                        <span className="font-semibold">{upcomingDistribution.Event?.venue || 'TBA'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>Amount:</span>
                        <span className="font-semibold text-green-600">
                          ₱{parseFloat(upcomingDistribution.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <button className="mt-4 px-4 py-2 bg-dswd-lightBlue text-white text-sm font-semibold rounded-lg hover:bg-dswd-blue transition">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No upcoming distributions scheduled</p>
                <p className="text-xs mt-1">Check back later for updates</p>
              </div>
            )}
          </div>

          {/* Application Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Application Timeline</h3>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-green-200"></div>
              
              <div className="space-y-6">
                {[
                  { label: 'Register Account', date: beneficiary?.created_at, completed: true },
                  { label: 'Submit Application', date: beneficiary?.updated_at, completed: true },
                  { label: 'Under Review', date: beneficiary?.updated_at, completed: true },
                  { label: 'Approved', date: beneficiary?.approval_date, completed: true }
                ].map((step, idx) => (
                  <div key={idx} className="relative flex gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs z-10 ${
                      step.completed ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.completed ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-semibold text-slate-900">{step.label}</p>
                      <p className="text-xs text-slate-500">
                        {step.date ? new Date(step.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Benefits Overview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Benefits Overview</h3>
              <button className="text-xs text-dswd-lightBlue hover:text-dswd-blue font-semibold">
                View All History
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 font-semibold mb-1">Total Benefits Received</p>
                <p className="text-2xl font-black text-green-900">
                  ₱{totalBenefits.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600 mt-1">Year 2026</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-black text-purple-900">{distributionsCount}</p>
                  <p className="text-xs text-purple-700 font-semibold">Distributions Received</p>
                  <p className="text-[10px] text-purple-600">This Year</p>
                </div>

                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-black text-blue-900">
                    {upcomingDistribution ? new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                  </p>
                  <p className="text-xs text-blue-700 font-semibold">Next Distribution</p>
                  <p className="text-[10px] text-blue-600">In 25 days</p>
                </div>
              </div>
            </div>
          </div>

          {/* Important Reminders */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-amber-900">Important Reminders</h3>
            </div>

            <ul className="space-y-3 text-sm text-amber-900">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">ℹ️</span>
                <span>Bring your valid ID or RFID card on distribution day.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">⏰</span>
                <span>Claiming is available only on the scheduled date.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">✓</span>
                <span>Ensure your information is updated to avoid any issues.</span>
              </li>
            </ul>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Recent Notifications</h3>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Your application has been approved!</p>
                  <p className="text-xs text-green-700">Congratulations! You are now an official beneficiary.</p>
                  <p className="text-xs text-green-600 mt-1">
                    {beneficiary?.approval_date ? new Date(beneficiary.approval_date).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
