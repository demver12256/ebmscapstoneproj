import { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import Table from '../components/ui/Table';
import { beneficiaryApi } from '../services/api';

export default function BeneficiaryRfidPage() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [rfidNumber, setRfidNumber] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, []);

  const fetchBeneficiaries = async () => {
    setLoading(true);
    try {
      const response = await beneficiaryApi.list();
      setBeneficiaries(response.data.data || []);
    } catch (err) {
      console.error('Failed to load beneficiaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRfid = async (e) => {
    e.preventDefault();
    
    if (!rfidNumber.trim()) {
      setError('Please enter an RFID number');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if RFID already exists
      const existingBeneficiary = beneficiaries.find(
        (b) => b.RFID_number === rfidNumber.trim() && b.id !== selectedBeneficiary.id
      );

      if (existingBeneficiary) {
        setError(`RFID ${rfidNumber.trim()} is already assigned to another beneficiary`);
        setLoading(false);
        return;
      }

      // Update beneficiary with new RFID
      await beneficiaryApi.update(selectedBeneficiary.id, {
        RFID_number: rfidNumber.trim()
      });

      setSuccess(`✓ RFID registered successfully!`);
      
      // Update local state
      setBeneficiaries(
        beneficiaries.map((b) =>
          b.id === selectedBeneficiary.id
            ? { ...b, RFID_number: rfidNumber.trim() }
            : b
        )
      );

      setSelectedBeneficiary({
        ...selectedBeneficiary,
        RFID_number: rfidNumber.trim()
      });

      setRfidNumber('');

      setTimeout(() => {
        setSuccess(null);
        setSelectedBeneficiary(null);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to register RFID');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'Beneficiary ID',
      accessor: 'beneficiary_id_code',
      cell: (row) => (
        <span className="font-mono font-bold text-slate-800">{row.beneficiary_id_code || '—'}</span>
      )
    },
    {
      header: 'Full Name',
      accessor: 'first_name',
      cell: (row) => `${row.first_name} ${row.last_name}`
    },
    {
      header: 'Category',
      accessor: 'category',
      cell: (row) => (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          row.category?.includes('4Ps') ? 'bg-blue-100 text-blue-800' :
          row.category?.includes('Senior') ? 'bg-red-100 text-red-800' :
          row.category?.includes('PWD') || row.category?.includes('Disabilit') ? 'bg-amber-100 text-amber-800' :
          'bg-slate-100 text-slate-800'
        }`}>
          {row.category}
        </span>
      )
    },
    {
      header: 'Barangay',
      accessor: 'barangay_id',
      cell: (row) => row.Barangay?.barangay_name || '—'
    },
    {
      header: 'RFID',
      accessor: 'RFID_number',
      cell: (row) => (
        <span className={`font-mono text-xs px-2 py-1 rounded ${
          row.RFID_number 
            ? 'bg-green-100 text-green-800 font-semibold' 
            : 'bg-yellow-100 text-yellow-800 font-semibold'
        }`}>
          {row.RFID_number || 'Not Registered'}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'id',
      cell: (row) => (
        <button
          onClick={() => {
            setSelectedBeneficiary(row);
            setRfidNumber(row.RFID_number || '');
            setError(null);
            setSuccess(null);
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
        >
          {row.RFID_number ? 'Edit' : 'Register'}
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <Smartphone className="w-8 h-8 text-yellow-300" />
          <h1 className="text-3xl font-black tracking-tight">RFID Registration</h1>
        </div>
        <p className="text-blue-100 text-sm mt-1 max-w-2xl">
          Assign RFID cards to beneficiaries for automated event attendance tracking and benefit releases.
        </p>
      </div>

      {/* Beneficiaries Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        {loading && !beneficiaries.length ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-600 mt-2">Loading beneficiaries...</p>
          </div>
        ) : beneficiaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600">No beneficiaries found</p>
          </div>
        ) : (
          <Table columns={columns} data={beneficiaries} itemsPerPage={10} />
        )}
      </div>

      {/* Modal */}
      {selectedBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">RFID Registration</h2>
              <button
                onClick={() => {
                  setSelectedBeneficiary(null);
                  setRfidNumber('');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Beneficiary Information */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">
                    {selectedBeneficiary.category?.toLowerCase().includes('4ps') ? '4Ps Household Number' : 'Beneficiary ID'}
                  </p>
                  <p className="text-lg font-bold text-slate-900 font-mono">{selectedBeneficiary.household_id_number || selectedBeneficiary.beneficiary_id_code || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Full Name</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedBeneficiary.first_name} {selectedBeneficiary.last_name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Category</p>
                    <p className="text-sm text-slate-700">{selectedBeneficiary.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Barangay</p>
                    <p className="text-sm text-slate-700">{selectedBeneficiary.Barangay?.barangay_name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Contact</p>
                  <p className="text-sm text-slate-700">{selectedBeneficiary.contact_number || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">IP Classification</p>
                  <p className="text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedBeneficiary.ip_classification === 'IP'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {selectedBeneficiary.ip_classification || 'Non-IP'}
                    </span>
                  </p>
                </div>
              </div>

              {/* RFID Registration Form */}
              <form onSubmit={handleRegisterRfid} className="space-y-3 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {selectedBeneficiary.RFID_number ? 'Update RFID Number' : 'Register RFID Number'}
                  </label>
                  <input
                    type="text"
                    value={rfidNumber}
                    onChange={(e) => setRfidNumber(e.target.value)}
                    placeholder="Enter RFID number (e.g., RFID-0001)"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                    autoFocus
                  />
                </div>

                {selectedBeneficiary.RFID_number && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Current RFID:</span> {selectedBeneficiary.RFID_number}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save RFID'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBeneficiary(null);
                      setRfidNumber('');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
