import { useState, useEffect } from 'react';
import { 
  FileText, Upload, Trash2, Eye, Download, CheckCircle, XCircle, Clock,
  Search, Filter, Calendar, ChevronLeft, ChevronRight, MoreVertical,
  RefreshCw, X
} from 'lucide-react';
import { beneficiaryApi } from '../services/api';

export default function MyDocumentsPage() {
  const [beneficiary, setBeneficiary] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedApplication, setSelectedApplication] = useState('All Applications');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0
  });

  useEffect(() => {
    loadBeneficiaryData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [documents, searchQuery, selectedCategory, selectedStatus, selectedApplication, dateRange]);

  useEffect(() => {
    calculateStats();
  }, [filteredDocuments]);

  const loadBeneficiaryData = async () => {
    try {
      const res = await beneficiaryApi.getMe();
      setBeneficiary(res.data.data);
      const docs = res.data.data?.BeneficiaryDocuments || [];
      setDocuments(docs);
      setFilteredDocuments(docs);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    setStats({
      total: filteredDocuments.length,
      verified: filteredDocuments.filter(d => d.verification_status === 'verified').length,
      pending: filteredDocuments.filter(d => d.verification_status === 'pending').length,
      rejected: filteredDocuments.filter(d => d.verification_status === 'rejected').length
    });
  };

  const applyFilters = () => {
    let filtered = [...documents];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(doc => 
        doc.document_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(doc => doc.document_type === selectedCategory);
    }

    // Status filter
    if (selectedStatus !== 'All Status') {
      filtered = filtered.filter(doc => doc.verification_status === selectedStatus.toLowerCase());
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(doc => {
        const docDate = new Date(doc.uploaded_at);
        return docDate >= new Date(dateRange.start) && docDate <= new Date(dateRange.end);
      });
    }

    setFilteredDocuments(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All Categories');
    setSelectedStatus('All Status');
    setSelectedApplication('All Applications');
    setDateRange({ start: '', end: '' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', 'General');
      formData.append('document_name', file.name);

      await beneficiaryApi.uploadDocument(formData);
      setSuccess('Document uploaded successfully!');
      await loadBeneficiaryData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await beneficiaryApi.deleteDocument(docId);
      setSuccess('Document deleted successfully!');
      await loadBeneficiaryData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const handleReupload = async (docId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('document', file);
        
        await beneficiaryApi.reuploadDocument(docId, formData);
        setSuccess('Document re-uploaded successfully!');
        await loadBeneficiaryData();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err.message || 'Failed to re-upload document');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
            <span>Dashboard</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 font-medium">My Documents</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">My Documents</h1>
          <p className="text-slate-600 text-sm mt-1">
            View and manage all documents you have uploaded for your assistance applications.
          </p>
        </div>
        <button
          onClick={() => document.getElementById('file-upload-input').click()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Upload className="w-4 h-4" />
          Upload New Document
        </button>
        <input
          id="file-upload-input"
          type="file"
          onChange={handleFileUpload}
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-green-700 text-sm">{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Documents</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-1">All uploaded documents</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Verified Documents</p>
              <p className="text-2xl font-bold text-slate-900">{stats.verified}</p>
              <p className="text-xs text-slate-500 mt-1">Documents approved</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Pending Verification</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-xs text-slate-500 mt-1">Under review</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Rejected Documents</p>
              <p className="text-2xl font-bold text-slate-900">{stats.rejected}</p>
              <p className="text-xs text-slate-500 mt-1">Requires action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-700 mb-1">Search Document</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by document name..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Categories</option>
              <option>Identification</option>
              <option>Supporting</option>
              <option>Medical</option>
              <option>Financial</option>
              <option>Personal Records</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Status</option>
              <option>Verified</option>
              <option>Pending</option>
              <option>Rejected</option>
            </select>
          </div>

          {/* Application Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Related Application</label>
            <select
              value={selectedApplication}
              onChange={(e) => setSelectedApplication(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Applications</option>
              <option>General Assistance</option>
              <option>Medical Assistance</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date Uploaded</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="flex justify-end mt-3">
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Document Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Related Application</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Upload Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Verified Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Remarks</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentDocuments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-600">No documents found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or upload a new document</p>
                  </td>
                </tr>
              ) : (
                currentDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {doc.document_name || 'Document'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(doc.file_size / 1024).toFixed(0) || '245'} KB
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        doc.document_type === 'Identification' ? 'bg-blue-100 text-blue-700' :
                        doc.document_type === 'Supporting' ? 'bg-purple-100 text-purple-700' :
                        doc.document_type === 'Medical' ? 'bg-green-100 text-green-700' :
                        doc.document_type === 'Financial' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {doc.document_type || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">General Assistance</p>
                      <p className="text-xs text-slate-500">APP-2026-00098</p>
                    </td>
                    <td className="px-4 py-3">
                      {doc.verification_status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      {doc.verification_status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                      {doc.verification_status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(doc.uploaded_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">
                        {doc.verified_at ? new Date(doc.verified_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        }) : '–'}
                      </p>
                      {doc.verified_at && (
                        <p className="text-xs text-slate-500">
                          {new Date(doc.verified_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`text-xs ${
                        doc.verification_status === 'verified' ? 'text-green-700' :
                        doc.verification_status === 'rejected' ? 'text-red-700' :
                        'text-slate-600'
                      }`}>
                        {doc.verification_status === 'verified' ? 'Approved' :
                         doc.verification_status === 'rejected' ? 'Blurry document. Please upload clear copy.' :
                         'For verification'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => window.open(`http://localhost:5000/${doc.file_path}`, '_blank')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`http://localhost:5000/${doc.file_path}`, '_blank')}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {doc.verification_status === 'rejected' && (
                          <button
                            onClick={() => handleReupload(doc.id)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition"
                            title="Re-upload"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredDocuments.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} documents
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">i</span>
        </div>
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Please ensure all documents are clear and complete. Incorrect or unreadable documents may cause delays in processing your application.
        </p>
      </div>
    </div>
  );
}
