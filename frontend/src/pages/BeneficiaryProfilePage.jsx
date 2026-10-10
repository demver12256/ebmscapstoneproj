import { User, Phone, MapPin, Calendar, Mail, CreditCard, IdCard, Upload, QrCode, Printer, X, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { beneficiaryApi } from '../services/api';

export default function BeneficiaryProfilePage() {
  const { user } = useAuth();
  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await beneficiaryApi.getMe();
      setBeneficiary(res.data.data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPG, JPEG, and PNG are allowed.');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5 MB.');
      return;
    }

    setUploadingPicture(true);

    try {
      const formData = new FormData();
      formData.append('profile_picture', file);

      const res = await beneficiaryApi.uploadProfilePicture(formData);
      if (res.data?.success) {
        setSuccess('Profile picture updated successfully!');
        // Reload profile to get the updated picture from server
        await loadProfile();
      }
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handlePrintQrPass = () => {
    if (!beneficiary) return;
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) {
      window.print();
      return;
    }
    const fullName = `${beneficiary.first_name} ${beneficiary.middle_name ? beneficiary.middle_name + ' ' : ''}${beneficiary.last_name}`.trim();
    const idVal = beneficiary.household_id_number || beneficiary.beneficiary_id_code;
    const qrPayload = beneficiary.qr_code || (beneficiary.qr_token ? `EBMS-QR:${beneficiary.qr_token}` : idVal);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Digital QR Pass - ${fullName}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #1e293b; margin: 0; padding: 20px; }
            .card { max-width: 380px; margin: 0 auto; border: 2px solid #0038A8; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
            .republic { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin: 0; }
            .agency { font-size: 13px; font-weight: 800; color: #002B49; text-transform: uppercase; margin: 4px 0; }
            .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; margin-top: 4px; }
            .name { font-size: 18px; font-weight: 900; color: #0f172a; margin: 10px 0 2px 0; text-transform: uppercase; }
            .id-code { font-family: monospace; font-size: 13px; font-weight: 700; color: #0038A8; margin: 0 0 6px 0; }
            .category { display: inline-block; background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-bottom: 6px; }
            .barangay { font-size: 12px; color: #475569; margin: 0 0 14px 0; }
            .qr-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; display: inline-block; margin-bottom: 12px; }
            .qr-box img { width: 180px; height: 180px; display: block; margin: 0 auto; }
            .token { font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; margin: 6px 0 0 0; }
            .instructions { font-size: 11px; color: #334155; font-weight: 600; margin: 4px 0 12px 0; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p class="republic">Republic of the Philippines</p>
              <h2 class="agency">DSWD / MSWDO Bongabong</h2>
              <div class="badge">Temporary Digital ID • Claim Pass</div>
            </div>
            <div class="name">${fullName}</div>
            <div class="id-code">${idVal}</div>
            <div class="category">${beneficiary.category}</div>
            <div class="barangay">Barangay ${beneficiary.Barangay?.barangay_name || beneficiary.barangay_name || ''}</div>
            <div class="qr-box">
              <img src="${beneficiary.qr_image_url || ''}" alt="QR Pass" />
              <div class="token">${qrPayload}</div>
            </div>
            <div class="instructions">Ipakita ang QR code na ito para sa payout verification at attendance.</div>
            <div class="footer">
              <span>RFID: ${beneficiary.RFID_number || 'Walang RFID Card'}</span>
              <span>Issued: ${new Date(beneficiary.qr_generated_at || Date.now()).toLocaleDateString('en-PH')}</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getBackendUrl = () => {
    const defaultApiUrl = 'http://localhost:5000/api';
    const envApiUrl = process.env.REACT_APP_API_URL || defaultApiUrl;
    return envApiUrl.replace('/api', '');
  };

  const backendUrl = getBackendUrl();

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Account Settings
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            My Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View and manage your beneficiary profile information and uploaded avatar.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="flex items-start gap-6">
          <div className="relative">
            {beneficiary?.profile_picture ? (
              <img
                src={`${backendUrl}/${beneficiary.profile_picture}`}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-dswd-blue to-dswd-lightBlue rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
                {beneficiary?.first_name?.[0]}{beneficiary?.last_name?.[0]}
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-lg cursor-pointer hover:bg-slate-50 transition border border-slate-200">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={handleProfilePictureChange}
                disabled={uploadingPicture}
              />
              {uploadingPicture ? (
                <div className="w-5 h-5 border-2 border-dswd-blue border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-dswd-blue" />
              )}
            </label>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {beneficiary?.first_name} {beneficiary?.middle_name} {beneficiary?.last_name}
            </h2>
            <p className="text-slate-600 text-sm">{beneficiary?.category}</p>
            
            {/* Beneficiary ID and RFID */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                beneficiary?.status === 'Approved' ? 'bg-green-100 text-green-700' :
                beneficiary?.status === 'Under Review' ? 'bg-yellow-100 text-yellow-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {beneficiary?.status}
              </span>
              
              {(beneficiary?.household_id_number || beneficiary?.beneficiary_id_code) && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                  <IdCard className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 font-mono">
                    {beneficiary?.category?.toLowerCase().includes('4ps') ? '4Ps HH: ' : 'ID: '}
                    {beneficiary.household_id_number || beneficiary.beneficiary_id_code}
                  </span>
                </div>
              )}
              
              {beneficiary?.RFID_number && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-bold text-purple-700 font-mono">
                    {beneficiary.RFID_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Digital QR Pass / Temporary ID Banner */}
        {beneficiary?.status === 'Approved' && (
          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-emerald-950">Digital ID & QR Pass</h4>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    Active Backup
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {beneficiary?.RFID_number 
                    ? 'Maaari ring gamitin bilang alternatibong pagkakakilanlan.' 
                    : 'Pansamantalang ID sa mga payout at attendance habang wala pang physical RFID card.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <QrCode className="w-4 h-4" />
              Tingnan ang QR ID Pass
            </button>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Personal Information</h3>
            
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Birthdate</p>
                <p className="font-semibold">{beneficiary?.birthdate}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Sex</p>
                <p className="font-semibold">{beneficiary?.sex}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Civil Status</p>
                <p className="font-semibold">{beneficiary?.civil_status}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Contact Information</h3>
            
            <div className="flex items-center gap-3 text-sm">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Username</p>
                <p className="font-semibold">{user?.username || '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Contact Number</p>
                <p className="font-semibold">{beneficiary?.contact_number || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Email Address</p>
                <p className="font-semibold">{user?.email || 'None (Opsyonal)'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Address</p>
                <p className="font-semibold">
                  {beneficiary?.sitio ? `${beneficiary.sitio}, ` : ''}
                  {beneficiary?.Barangay?.barangay_name ? `Barangay ${beneficiary.Barangay.barangay_name}, ` : ''}
                  Bongabong, Oriental Mindoro
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DIGITAL QR PASS MODAL */}
      {showQrModal && beneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <QrCode className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Digital QR Pass / Temporary ID</h3>
                  <p className="text-xs text-blue-200">Official Municipal Beneficiary Claim Pass</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* PRINTABLE ID PASS CONTAINER */}
              <div id="printable-qr-pass" className="bg-gradient-to-b from-white to-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                {/* ID Card Header */}
                <div className="border-b border-slate-200 pb-3 text-center space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Republic of the Philippines</p>
                  <h4 className="font-black text-sm text-blue-950 uppercase tracking-wide">
                    DSWD / MSWDO Bongabong
                  </h4>
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider mt-1">
                    Temporary Digital ID • Claim Pass
                  </div>
                </div>

                {/* Beneficiary Details Row */}
                <div className="flex items-start gap-4">
                  {/* Photo or Avatar */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border-2 border-blue-200 shrink-0 flex items-center justify-center shadow-xs">
                    {beneficiary.profile_picture ? (
                      <img
                        src={`${backendUrl}/${beneficiary.profile_picture}`}
                        alt={beneficiary.first_name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <User className="w-10 h-10 text-slate-400" />
                    )}
                  </div>

                  {/* Info Text */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="font-extrabold text-base text-slate-900 leading-tight truncate">
                      {beneficiary.first_name} {beneficiary.middle_name ? beneficiary.middle_name + ' ' : ''}{beneficiary.last_name}
                    </h3>
                    <p className="text-xs font-mono font-bold text-blue-700">
                      {beneficiary.category?.toLowerCase().includes('4ps') ? 'HH No: ' : 'ID: '}
                      {beneficiary.household_id_number || beneficiary.beneficiary_id_code}
                    </p>
                    <div className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                      {beneficiary.category}
                    </div>
                    <p className="text-xs text-slate-600 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      Brgy. {beneficiary.Barangay?.barangay_name || beneficiary.barangay_name || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center py-4 px-2 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="p-3 bg-white rounded-lg shadow-inner border border-slate-100 flex items-center justify-center">
                    <QRCodeSVG
                      value={beneficiary.qr_code || `EBMS-QR:${beneficiary.qr_token || ''}`}
                      size={180}
                      level="H"
                      includeMargin={false}
                      fgColor="#002B49"
                    />
                  </div>
                  <div className="text-center space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Security Token: {beneficiary.qr_token?.slice(0, 16)}...
                    </span>
                    <p className="text-[11px] font-semibold text-slate-700">
                      I-scan ang QR code na ito para sa payout verification & attendance
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <div>
                    RFID Card: <strong className="text-slate-800">{beneficiary.RFID_number || 'Walang RFID (Temporary QR Active)'}</strong>
                  </div>
                  <div>
                    Issued: <strong className="text-slate-800">{new Date(beneficiary.qr_generated_at || Date.now()).toLocaleDateString('en-PH')}</strong>
                  </div>
                </div>
              </div>

              {/* Security Advisory */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Ipakita ang QR code na ito sa staff tuwing may payout o pagpupulong habang hinihintay ang physical RFID card.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handlePrintQrPass}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                I-print ang Pass
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
