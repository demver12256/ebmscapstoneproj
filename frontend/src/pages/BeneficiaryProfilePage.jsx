import { User, Phone, MapPin, Calendar, Mail, CreditCard, IdCard, Upload } from 'lucide-react';
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
        // Clear the temporary blob URL
        setProfilePicture(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
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
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <User className="w-8 h-8 text-yellow-300" />
          <h1 className="text-3xl font-black tracking-tight">My Profile</h1>
        </div>
        <p className="text-blue-100 text-sm mt-1 max-w-2xl">
          View and manage your beneficiary profile information and uploaded avatar.
        </p>
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
              
              {beneficiary?.beneficiary_id_code && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                  <IdCard className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 font-mono">
                    {beneficiary.beneficiary_id_code}
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
    </div>
  );
}
