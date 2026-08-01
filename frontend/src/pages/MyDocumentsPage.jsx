import { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, Eye, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { beneficiaryApi } from '../services/api';

export default function MyDocumentsPage() {
  const [beneficiary, setBeneficiary] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadBeneficiaryData();
  }, []);

  const loadBeneficiaryData = async () => {
    try {
      const res = await beneficiaryApi.getMe();
      setBeneficiary(res.data.data);
      setDocuments(res.data.data?.BeneficiaryDocuments || []);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Documents</h1>
        <p className="text-slate-600 mt-1">Upload and manage your supporting documents</p>
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

      {/* Upload Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Upload New Document</h2>
        
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-purple-400 transition">
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-slate-500 mb-4">
            PDF, JPG, PNG up to 5MB
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Select File'}
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Required Documents:</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Valid Government ID</li>
            <li>• Proof of Residency (Barangay Certificate)</li>
            <li>• Category-specific documents (PWD ID, Senior Citizen ID, 4Ps ID, etc.)</li>
          </ul>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Uploaded Documents</h2>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload your first document above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {doc.document_name || doc.file_path?.split('/').pop() || 'Document'}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-slate-600">
                        {doc.document_type || 'General'}
                      </p>
                      <span className="text-xs text-slate-400">•</span>
                      <p className="text-xs text-slate-600">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {doc.verification_status === 'verified' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                  {doc.verification_status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                  {doc.verification_status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                  
                  <button
                    onClick={() => window.open(`http://localhost:5000/${doc.file_path}`, '_blank')}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Guidelines */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Document Guidelines</h3>
        <div className="space-y-2 text-sm text-slate-700">
          <p>• Ensure documents are clear and readable</p>
          <p>• File size should not exceed 5MB</p>
          <p>• Accepted formats: PDF, JPG, PNG</p>
          <p>• Upload official government-issued documents only</p>
          <p>• Documents will be verified by staff within 2-3 business days</p>
        </div>
      </div>
    </div>
  );
}
