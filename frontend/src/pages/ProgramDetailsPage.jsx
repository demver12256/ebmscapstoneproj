import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { programApi, beneficiaryApi } from '../services/api';
import { 
  ArrowLeft, Users, UserPlus, Calendar, MapPin, DollarSign, 
  CheckCircle, XCircle, Search, Filter, X 
} from 'lucide-react';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

export default function ProgramDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [program, setProgram] = useState(null);
  const [enrolledBeneficiaries, setEnrolledBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Enroll modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [eligibleBeneficiaries, setEligibleBeneficiaries] = useState([]);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Pagination for enrolled beneficiaries
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedEnrolled,
    goToPage,
    startIndex,
    endIndex,
    totalItems
  } = usePagination(enrolledBeneficiaries, 10);

  useEffect(() => {
    loadProgramDetails();
  }, [id]);

  const loadProgramDetails = async () => {
    setLoading(true);
    try {
      const [programRes, enrolledRes] = await Promise.all([
        programApi.get(id),
        programApi.getEnrolledBeneficiaries(id)
      ]);
      
      setProgram(programRes.data.data);
      setEnrolledBeneficiaries(enrolledRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load program details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEnrollModal = async () => {
    if (!program) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get all approved beneficiaries from program's barangay
      const beneficiariesRes = await beneficiaryApi.list();
      const allBeneficiaries = beneficiariesRes.data.data || [];
      
      // Get currently enrolled beneficiary IDs
      const enrolledIds = new Set(enrolledBeneficiaries.map(e => e.id));
      
      // Filter eligible beneficiaries:
      // 1. Must be Approved
      // 2. Must be from same barangay as program
      // 3. Must match program category (if specified)
      // 4. Must NOT be already enrolled
      const eligible = allBeneficiaries.filter(b => {
        if (b.status !== 'Approved') return false;
        if (b.barangay_id !== program.barangay_id) return false;
        if (enrolledIds.has(b.id)) return false;
        
        // Check category match - make it more flexible
        if (program.eligibility_category) {
          if (!b.category) return false;
          
          // Try exact match first
          if (b.category === program.eligibility_category) return true;
          
          // Try partial match (case insensitive)
          const progCat = program.eligibility_category.toLowerCase();
          const benCat = b.category.toLowerCase();
          
          // Check if they contain common keywords
          if (progCat.includes('4ps') && benCat.includes('4ps')) return true;
          if (progCat.includes('senior') && benCat.includes('senior')) return true;
          if ((progCat.includes('pwd') || progCat.includes('disabilit')) && 
              (benCat.includes('pwd') || benCat.includes('disabilit'))) return true;
          
          return false;
        }
        
        return true;
      });
      
      setEligibleBeneficiaries(eligible);
      setSelectedBeneficiaries([]);
      setShowEnrollModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load eligible beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (beneficiaryId) => {
    setSelectedBeneficiaries(prev => {
      if (prev.includes(beneficiaryId)) {
        return prev.filter(id => id !== beneficiaryId);
      } else {
        return [...prev, beneficiaryId];
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredBeneficiaries();
    const allIds = filtered.map(b => b.id);
    setSelectedBeneficiaries(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedBeneficiaries([]);
  };

  const handleEnrollSelected = async () => {
    if (selectedBeneficiaries.length === 0) {
      setError('Please select at least one beneficiary to enroll');
      return;
    }

    setEnrolling(true);
    setError(null);
    
    try {
      console.log('Selected beneficiaries:', selectedBeneficiaries);
      console.log('Selected beneficiaries type:', typeof selectedBeneficiaries[0]);
      console.log('Payload being sent:', { beneficiary_ids: selectedBeneficiaries });
      
      const response = await programApi.enrollBeneficiaries(id, {
        beneficiary_ids: selectedBeneficiaries
      });
      console.log('Enrollment response:', response);
      
      setSuccess(`Successfully enrolled ${selectedBeneficiaries.length} beneficiary(ies)`);
      setShowEnrollModal(false);
      setSelectedBeneficiaries([]);
      await loadProgramDetails();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Full error object:', err);
      console.error('Error response:', err?.response);
      console.error('Error response data:', err?.response?.data);
      console.error('Error message:', err?.message);
      
      // Get the actual backend error message
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to enroll beneficiaries';
      console.log('Displaying error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setEnrolling(false);
    }
  };

  const getFilteredBeneficiaries = () => {
    if (!searchQuery) return eligibleBeneficiaries;
    
    const query = searchQuery.toLowerCase();
    return eligibleBeneficiaries.filter(b => 
      `${b.first_name} ${b.last_name}`.toLowerCase().includes(query) ||
      b.beneficiary_id_code?.toLowerCase().includes(query) ||
      b.category?.toLowerCase().includes(query)
    );
  };

  if (loading && !program) {
    return <div className="p-8">Loading...</div>;
  }

  if (error && !program) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const filteredEligible = getFilteredBeneficiaries();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/programs')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{program?.name}</h1>
            <p className="text-slate-600">{program?.Barangay?.barangay_name}</p>
          </div>
        </div>
        
        <button
          onClick={handleOpenEnrollModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
        >
          <UserPlus className="w-4 h-4" />
          Enroll Beneficiaries
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {success}
        </div>
      )}

      {/* Program Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Program Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Category</p>
            <p className="font-semibold">{program?.eligibility_category || 'All Categories'}</p>
          </div>
          
          <div>
            <p className="text-sm text-slate-500 mb-1">Status</p>
            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
              program?.status === 'active' ? 'bg-green-100 text-green-700' :
              program?.status === 'draft' ? 'bg-slate-100 text-slate-700' :
              'bg-red-100 text-red-700'
            }`}>
              {program?.status}
            </span>
          </div>
          
          <div>
            <p className="text-sm text-slate-500 mb-1">Total Enrolled</p>
            <p className="font-semibold text-2xl text-purple-600">{enrolledBeneficiaries.length}</p>
          </div>
        </div>

        {program?.description && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-1">Description</p>
            <p className="text-slate-700">{program.description}</p>
          </div>
        )}
      </div>

      {/* Enrolled Beneficiaries */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Enrolled Beneficiaries</h2>
        </div>

        {enrolledBeneficiaries.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No beneficiaries enrolled yet</p>
            <p className="text-sm mt-1">Click "Enroll Beneficiaries" to add members to this program</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Beneficiary</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Enrolled Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedEnrolled.map((beneficiary) => (
                    <tr key={beneficiary.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">
                          {beneficiary.first_name} {beneficiary.last_name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono">{beneficiary.beneficiary_id_code}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{beneficiary.category}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{beneficiary.enrollment_date || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                          {beneficiary.enrollment_status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 px-2">
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

      {/* Enroll Beneficiaries Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Enroll Beneficiaries</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Select qualified beneficiaries to enroll in this program
                </p>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search and Actions */}
            <div className="p-6 border-b border-slate-200 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-600">
                  {filteredEligible.length} eligible beneficiary(ies) found
                </p>
                <p className="font-semibold text-purple-600">
                  {selectedBeneficiaries.length} selected
                </p>
              </div>
            </div>

            {/* Beneficiaries List */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredEligible.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No eligible beneficiaries found</p>
                  <p className="text-sm mt-1">
                    All qualified beneficiaries may already be enrolled
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEligible.map((beneficiary) => (
                    <label
                      key={beneficiary.id}
                      className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                        selectedBeneficiaries.includes(beneficiary.id)
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBeneficiaries.includes(beneficiary.id)}
                        onChange={() => handleToggleSelect(beneficiary.id)}
                        className="w-5 h-5 text-purple-600 rounded"
                      />
                      
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {beneficiary.first_name} {beneficiary.last_name}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                          <span className="font-mono">{beneficiary.beneficiary_id_code}</span>
                          <span>•</span>
                          <span>{beneficiary.category}</span>
                        </div>
                      </div>

                      {selectedBeneficiaries.includes(beneficiary.id) && (
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-6 py-2 text-slate-700 font-semibold hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollSelected}
                disabled={selectedBeneficiaries.length === 0 || enrolling}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {enrolling ? 'Enrolling...' : `Enroll ${selectedBeneficiaries.length} Selected`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
