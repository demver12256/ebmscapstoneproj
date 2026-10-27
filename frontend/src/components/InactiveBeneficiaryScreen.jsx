import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Building2, MapPin, Phone, ShieldAlert, 
  FileText, RefreshCw, LogOut, Info, Calendar, User, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { beneficiaryApi } from '../services/api';

export default function InactiveBeneficiaryScreen({ beneficiary: initialBeneficiary = null }) {
  const { user, logout, refreshUser } = useAuth();
  const [beneficiary, setBeneficiary] = useState(initialBeneficiary);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);

  useEffect(() => {
    if (!initialBeneficiary) {
      beneficiaryApi.getMe()
        .then(res => {
          if (res.data?.success && res.data?.data) {
            setBeneficiary(res.data.data);
          }
        })
        .catch(err => {
          console.warn('[InactiveScreen] Failed to fetch beneficiary:', err);
        });
    }
  }, [initialBeneficiary]);

  const cat = String(beneficiary?.category || user?.category || '').toLowerCase();
  const is4Ps = cat.includes('4ps') || cat.includes('pantawid');
  const isSenior = cat.includes('senior');
  const isPwd = cat.includes('pwd') || cat.includes('disabilit');

  // Office & Admin mapping
  const officeConfig = is4Ps ? {
    officeName: 'DSWD Municipal Operations Office (4Ps Admin)',
    shortOffice: 'DSWD Admin (4Ps)',
    adminTitle: 'DSWD 4Ps Municipal Administrator',
    location: 'DSWD Office, Municipal Hall Compound, Bongabong, Oriental Mindoro',
    schedule: 'Lunes hanggang Biyernes, 8:00 AM – 5:00 PM',
    themeColor: 'blue',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700',
    accentText: 'text-blue-700',
    instructionTl: 'Mangyaring magsadya sa tanggapan ng DSWD Admin (4Ps Office) sa Municipal Hall upang sumunod sa mga kailangang rekisito, verification, o muling ma-reactivate ang iyong account.',
    instructionEn: 'Please proceed to the DSWD Admin (4Ps Office) at the Municipal Hall to comply with program requirements or reactivate your account.',
  } : isSenior ? {
    officeName: 'Office of Senior Citizens Affairs (OSCA / Senior Citizen Admin)',
    shortOffice: 'Senior Citizen Admin (OSCA)',
    adminTitle: 'OSCA Head / Senior Citizen Administrator',
    location: 'OSCA Center, Municipal Compound, Bongabong, Oriental Mindoro',
    schedule: 'Lunes hanggang Biyernes, 8:00 AM – 5:00 PM',
    themeColor: 'rose',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
    primaryBtn: 'bg-rose-600 hover:bg-rose-700',
    accentText: 'text-rose-700',
    instructionTl: 'Mangyaring magsadya sa tanggapan ng Senior Citizen Admin (OSCA) sa Municipal Hall upang sumunod sa mga kailangang rekisito o muling ma-reactivate ang iyong account.',
    instructionEn: 'Please proceed to the Senior Citizen Admin (OSCA Office) at the Municipal Hall to comply with requirements or reactivate your account.',
  } : isPwd ? {
    officeName: 'Persons with Disability Affairs Office (PDAO / PWD Admin)',
    shortOffice: 'PWD Admin (PDAO)',
    adminTitle: 'PDAO Head / PWD Administrator',
    location: 'PDAO Center, Ground Floor, Municipal Hall, Bongabong, Oriental Mindoro',
    schedule: 'Lunes hanggang Biyernes, 8:00 AM – 5:00 PM',
    themeColor: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-700',
    accentText: 'text-indigo-700',
    instructionTl: 'Mangyaring magsadya sa tanggapan ng PWD Admin (PDAO) sa Municipal Hall upang sumunod sa mga kailangang rekisito o muling ma-reactivate ang iyong account.',
    instructionEn: 'Please proceed to the PWD Admin (PDAO Office) at the Municipal Hall to comply with requirements or reactivate your account.',
  } : {
    officeName: 'Municipal Social Welfare and Development Office (MSWDO)',
    shortOffice: 'MSWDO Admin',
    adminTitle: 'Municipal Social Welfare Officer',
    location: 'MSWDO Office, Municipal Hall, Bongabong, Oriental Mindoro',
    schedule: 'Lunes hanggang Biyernes, 8:00 AM – 5:00 PM',
    themeColor: 'slate',
    badgeClass: 'bg-slate-100 text-slate-900 border-slate-200',
    primaryBtn: 'bg-slate-700 hover:bg-slate-800',
    accentText: 'text-slate-800',
    instructionTl: 'Mangyaring magsadya sa tanggapan ng MSWDO / Municipal Admin upang sumunod sa mga kailangang rekisito o muling ma-reactivate ang iyong account.',
    instructionEn: 'Please proceed to the MSWDO / Municipal Admin Office to comply with requirements or reactivate your account.',
  };

  const reason = beneficiary?.inactivation_reason || user?.inactive_reason;
  const beneficiaryId = beneficiary?.beneficiary_id_code || beneficiary?.household_id_number || user?.id || '—';
  const barangayName = beneficiary?.Barangay?.barangay_name || 'Bongabong';

  const handleCheckStatus = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      if (refreshUser) {
        const updatedUser = await refreshUser();
        if (updatedUser && updatedUser.status === 'active') {
          setRefreshMsg({ type: 'success', text: 'Matagumpay na na-reactivate ang iyong account! Nirere-load ang portal...' });
          setTimeout(() => {
            window.location.reload();
          }, 1200);
          return;
        }
      }

      const res = await beneficiaryApi.getMe();
      if (res.data?.success && res.data?.data) {
        const b = res.data.data;
        setBeneficiary(b);
        if (b.User?.status === 'active') {
          setRefreshMsg({ type: 'success', text: 'Matagumpay na na-reactivate ang iyong account! Nirere-load ang portal...' });
          setTimeout(() => {
            window.location.reload();
          }, 1200);
          return;
        }
      }

      setRefreshMsg({ 
        type: 'info', 
        text: 'Nananatiling INACTIVE pa rin ang iyong account. Mangyaring personal na magsadya sa tanggapan ng admin upang maisaayos ito.' 
      });
    } catch (e) {
      setRefreshMsg({ 
        type: 'error', 
        text: 'Hindi masuri ang katayuan sa ngayon. Pakisubukang muli mamaya.' 
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* ── Main Inactive Warning Card ── */}
      <div className="bg-white rounded-3xl shadow-xl border border-red-200 overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-8 sm:px-10 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <ShieldAlert className="w-9 h-9 text-amber-200" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white border border-white/25 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse"></span>
                Account Inactive
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Ang Iyong Account ay Kasalukuyang INACTIVE
              </h1>
              <p className="text-red-100 text-sm mt-1">
                Your beneficiary account has been placed on inactive status by the administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-10 space-y-6">
          {/* Main Action Callout / Instruction */}
          <div className="rounded-2xl border-2 border-red-200 bg-red-50/70 p-5 sm:p-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-red-950">
                  {officeConfig.instructionTl}
                </h2>
                <p className="text-xs sm:text-sm text-red-800 italic">
                  {officeConfig.instructionEn}
                </p>
              </div>
            </div>
          </div>

          {/* Reason Box (if provided) */}
          {reason && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900">
                <Info className="w-4 h-4 text-amber-700" />
                Puna mula sa Administrator / Inactivation Reason:
              </div>
              <p className="text-sm font-semibold bg-white/70 p-3.5 rounded-xl border border-amber-200 leading-relaxed text-slate-800">
                "{reason}"
              </p>
            </div>
          )}

          {/* Where to Proceed (Office Card) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-700" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                Saan Magsasadya (Designated Office & Administrator)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tanggapan / Office:</span>
                <p className="text-sm font-black text-slate-900">{officeConfig.officeName}</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border ${officeConfig.badgeClass} mt-1`}>
                  {officeConfig.shortOffice}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Administrator:</span>
                <p className="text-sm font-black text-slate-900">{officeConfig.adminTitle}</p>
                <p className="text-xs text-slate-500">Lokal na Pamahalaan ng Bongabong</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Lokasyon / Location:
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800">{officeConfig.location}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Oras ng Serbisyo:
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800">{officeConfig.schedule}</p>
              </div>
            </div>
          </div>

          {/* Reference Info for the Beneficiary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Iyong Impormasyon sa Talaan (Reference Information):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Pangalan:</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {user?.first_name} {user?.last_name}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Beneficiary / HH ID:</span>
                <span className="font-mono font-bold text-slate-900 block mt-0.5">
                  {beneficiaryId}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Barangay:</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {barangayName}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Kategorya:</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {beneficiary?.category || user?.category || 'Beneficiary'}
                </span>
              </div>
            </div>
          </div>

          {/* Checklist on what to bring */}
          <div className="rounded-2xl border border-slate-200 bg-amber-50/40 p-5 space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              📋 Mga Dapat Dalhin sa Tanggapan para sa Re-activation:
            </h4>
            <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 list-disc list-inside">
              <li>Isang (1) valid government-issued ID (National ID, OSCA Senior ID, PWD ID, o 4Ps ID).</li>
              <li>Ang inyong <strong>Beneficiary ID / Household Number ({beneficiaryId})</strong> para sa mabilis na paghahanap sa talaan.</li>
              <li>Anumang kulang na dokumento o patunay na hiningi ng inyong programa.</li>
            </ul>
          </div>

          {/* Refresh feedback toast */}
          {refreshMsg && (
            <div className={`p-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border ${
              refreshMsg.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : refreshMsg.type === 'info'
                ? 'bg-blue-50 text-blue-900 border-blue-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {refreshMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
              )}
              <span>{refreshMsg.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={handleCheckStatus}
              disabled={refreshing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Sinusuri ang Katayuan...' : 'I-check ang Katayuan / Refresh Status'}
            </button>

            <button
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              Mag-logout (Sign Out)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

