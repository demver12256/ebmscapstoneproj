import { User, Phone, MapPin, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { beneficiaryApi } from '../services/api';

export default function BeneficiaryProfilePage() {
  const { user } = useAuth();
  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-600">View and manage your beneficiary profile information</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-gradient-to-br from-dswd-blue to-dswd-lightBlue rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {beneficiary?.first_name?.[0]}{beneficiary?.last_name?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {beneficiary?.first_name} {beneficiary?.middle_name} {beneficiary?.last_name}
            </h2>
            <p className="text-slate-600">{beneficiary?.category}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                beneficiary?.status === 'Approved' ? 'bg-green-100 text-green-700' :
                beneficiary?.status === 'Under Review' ? 'bg-yellow-100 text-yellow-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {beneficiary?.status}
              </span>
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
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Contact Number</p>
                <p className="font-semibold">{beneficiary?.contact_number || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-semibold">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-500">Address</p>
                <p className="font-semibold">{beneficiary?.address || 'Not provided'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
