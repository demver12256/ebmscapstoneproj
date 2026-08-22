import { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { dashboardApi, beneficiaryApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, FileText, Clock, AlertTriangle, 
  CheckCircle2, XCircle, Upload, Trash2, Eye, Info, Lock, User, FileCheck,
  Bell, HelpCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ApprovedBeneficiaryDashboard from '../components/ApprovedBeneficiaryDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Staff/Admin Dashboard State
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'analytics'
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [missingDocs, setMissingDocs] = useState([]);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Beneficiary Portal State
  const [beneficiary, setBeneficiary] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [category, setCategory] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [psaBirthCert, setPsaBirthCert] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [sitio, setSitio] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [sex, setSex] = useState('Male');
  const [birthdate, setBirthdate] = useState('');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [hasSchoolChildren, setHasSchoolChildren] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizen (Social Pension)',
    'Person with Disability (PWD)'
  ];

  const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'];

  const getBackendUrl = () => {
    const defaultApiUrl = 'http://localhost:5000/api';
    const envApiUrl = process.env.REACT_APP_API_URL || defaultApiUrl;
    return envApiUrl.replace('/api', '');
  };

  const backendUrl = getBackendUrl();

  const loadStaffDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: summaryRes }, 
        { data: monthlyRes }, 
        { data: appsRes }
      ] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.monthlyDistribution(),
        beneficiaryApi.listApplications()
      ]);
      setSummary(summaryRes.data);
      setMonthly(monthlyRes.data);
      setApplications(appsRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadBeneficiaryPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, barangaysRes] = await Promise.all([
        beneficiaryApi.getMe(),
        barangayApi.publicList()
      ]);
      setBarangays(barangaysRes.data.data || []);
      if (res.data?.success && res.data?.data) {
        const b = res.data.data;
        setBeneficiary(b);
        setCategory(b.category || '4Ps Household Beneficiary');
        setNationalId(b.national_id_number || '');
        setPsaBirthCert(b.psa_birth_cert_number || '');
        setContactNumber(b.contact_number || '');
        setAddress(b.address || '');
        setSitio(b.sitio || '');
        setBarangayId(b.barangay_id || '');
        setSex(b.sex || 'Male');
        setBirthdate(b.birthdate || '');
        setCivilStatus(b.civil_status || 'Single');
      }
    } catch (err) {
      setError(err.message || 'Unable to load beneficiary details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'beneficiary') {
      loadBeneficiaryPortal();
    } else {
      loadStaffDashboard();
    }
  }, [user]);

  // Auto-save profile details every time form fields change (debounced)
  useEffect(() => {
    const autoSaveTimer = setTimeout(async () => {
      if (user?.role === 'beneficiary' && beneficiary && category && (beneficiary.status === 'Pending Submission' || beneficiary.status === 'Rejected')) {
        try {
          await beneficiaryApi.updateMe({
            category,
            sex,
            birthdate,
            civil_status: civilStatus,
            address,
            sitio,
            barangay_id: barangayId,
            contact_number: contactNumber,
            national_id_number: nationalId,
            psa_birth_cert_number: psaBirthCert
          });
        } catch (err) {
          // Silent fail for auto-save - don't show error to user
          console.log('Auto-save failed:', err.message);
        }
      }
    }, 2000); // Save 2 seconds after user stops typing

    return () => clearTimeout(autoSaveTimer);
  }, [category, sex, birthdate, civilStatus, address, sitio, barangayId, contactNumber, nationalId, psaBirthCert, beneficiary, user?.role]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setProfileSaved(false);
    setActionSuccess(null);

    if (!category || !nationalId) {
      setError('Category and National ID number are required.');
      return;
    }

    try {
      setLoading(true);
      await beneficiaryApi.updateMe({
        category,
        sex,
        birthdate,
        civil_status: civilStatus,
        address,
        sitio,
        barangay_id: barangayId,
        contact_number: contactNumber,
        national_id_number: nationalId,
        psa_birth_cert_number: psaBirthCert
      });
      setProfileSaved(true);
      setActionSuccess('Application profile details saved successfully.');
      await loadBeneficiaryPortal();
    } catch (err) {
      setError(err.message || 'Failed to update profile details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setActionSuccess(null);

    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size allowed is 10 MB.');
      return;
    }

    const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      setError('Invalid file type. Only PDF, Word (DOC/DOCX), JPG, JPEG, and PNG are allowed.');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', docType);

    try {
      setUploadingDoc(docType);
      await beneficiaryApi.uploadDocument(formData);
      setActionSuccess(`${docType} uploaded successfully.`);
      await loadBeneficiaryPortal();
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleDeleteFile = async (docId) => {
    setError(null);
    setActionSuccess(null);
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      setLoading(true);
      await beneficiaryApi.deleteDocument(docId);
      setActionSuccess('Document deleted successfully.');
      await loadBeneficiaryPortal();
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    setError(null);
    setActionSuccess(null);
    try {
      setLoading(true);
      await beneficiaryApi.submitApplication({ has_school_aged_children: hasSchoolChildren });
      setActionSuccess('Your application has been successfully submitted for administrator review!');
      await loadBeneficiaryPortal();
    } catch (err) {
      setError(err.message || 'Failed to submit application. Please make sure you have selected a category.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async (appId) => {
    try {
      const res = await beneficiaryApi.reviewApplication(appId);
      if (res.data?.success) {
        setSelectedApp(prev => ({ ...prev, status: 'Under Review' }));
        loadStaffDashboard();
      }
    } catch (err) {
      setError(err.message || 'Failed to start review.');
    }
  };

  const handleApproveApplication = async (appId) => {
    if (!window.confirm('Are you sure you want to approve this application? This will issue a unique Beneficiary ID code.')) return;
    setError(null);
    try {
      const res = await beneficiaryApi.approveApplication(appId);
      if (res.data?.success) {
        alert('Application approved successfully!');
        setSelectedApp(null);
        setPreviewUrl(null);
        loadStaffDashboard();
      }
    } catch (err) {
      setError(err.message || 'Approval failed.');
    }
  };

  const handleRejectApplication = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }
    setError(null);
    try {
      const res = await beneficiaryApi.rejectApplication(selectedApp.id, {
        rejection_reason: rejectionReason,
        missing_documents: missingDocs
      });
      if (res.data?.success) {
        alert('Application rejected.');
        setSelectedApp(null);
        setPreviewUrl(null);
        setShowRejectForm(false);
        setRejectionReason('');
        setMissingDocs([]);
        loadStaffDashboard();
      }
    } catch (err) {
      setError(err.message || 'Rejection failed.');
    }
  };

  const handleToggleMissingDoc = (doc) => {
    if (missingDocs.includes(doc)) {
      setMissingDocs(prev => prev.filter(d => d !== doc));
    } else {
      setMissingDocs(prev => [...prev, doc]);
    }
  };

  const checkUploadsComplete = () => {
    if (!beneficiary) return false;
    const docs = beneficiary.Documents || [];
    const uploadedTypes = docs.map(d => d.document_type);

    const required = ['Valid Government ID / National ID'];
    if (category.includes('4Ps')) {
      required.push('PSA Birth Certificate');
      required.push('Barangay Certificate of Residency or Indigency');
      if (hasSchoolChildren) {
        required.push('Certificate of Enrollment');
      }
    } else if (category.includes('Senior')) {
      required.push('Social Pension Application Form');
    } else if (category.includes('PWD') || category.includes('Disabilit')) {
      required.push('Medical Certificate');
      required.push('PWD Application Form');
    }

    return required.every(t => uploadedTypes.includes(t));
  };

  const getRequiredFilesList = (cat) => {
    const list = [
      { name: 'Valid Government ID / National ID', required: true }
    ];
    if (cat.includes('4Ps')) {
      list.push({ name: 'PSA Birth Certificate', required: true });
      list.push({ name: 'Barangay Certificate of Residency or Indigency', required: true });
      list.push({ name: 'Certificate of Enrollment', required: hasSchoolChildren });
    } else if (cat.includes('Senior')) {
      list.push({ name: 'Social Pension Application Form', required: true });
      list.push({ name: 'OSCA ID (optional if available)', required: false });
      list.push({ name: 'PSA Birth Certificate (if needed)', required: false });
    } else if (cat.includes('PWD') || cat.includes('Disabilit')) {
      list.push({ name: 'Medical Certificate', required: true });
      list.push({ name: 'PWD Application Form', required: true });
      list.push({ name: 'PSA Birth Certificate (if needed)', required: false });
    }
    return list;
  };

  const chartData = summary
    ? [
        { name: '4Ps Program', value: summary.fourPsCount || 0, fill: '#00338D' },
        { name: 'Senior Citizens', value: summary.seniorCitizensCount || 0, fill: '#E30613' },
        { name: 'PWD Program', value: summary.pwdCount || 0, fill: '#FFD100' },
      ]
    : [];

  const totalBeneficiariesCount = summary ? (summary.fourPsCount + summary.seniorCitizensCount + summary.pwdCount) : 0;

  // -------------------------------------------------------------
  // VIEW: BENEFICIARY PORTAL
  // -------------------------------------------------------------
  if (user?.role === 'beneficiary') {
    const isSubmitted = beneficiary?.status === 'Pending Review' || beneficiary?.status === 'Under Review';
    const isApproved = beneficiary?.status === 'Approved';
    const isRejected = beneficiary?.status === 'Rejected';
    const docsUploaded = beneficiary?.Documents || [];

    console.log('[DASHBOARD] Beneficiary status check:', {
      beneficiaryStatus: beneficiary?.status,
      userStatus: user?.status,
      isApproved,
      beneficiaryId: beneficiary?.id
    });

    // If approved (regardless of active/inactive user status), show the approved dashboard
    if (isApproved) {
      return <ApprovedBeneficiaryDashboard beneficiary={beneficiary} />;
    }

    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16 px-4">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#00338D] via-[#002D87] to-[#0A192F] text-white rounded-2xl p-6 sm:p-7 shadow-sm border border-blue-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#FFD100]">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Beneficiary Application Portal</h1>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5 max-w-2xl">
                Submit verification documents, review program eligibility, and track review status in real-time.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 font-semibold">{error}</div>
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-start gap-3">
            <span className="text-lg">✅</span>
            <div className="flex-1 font-semibold">{actionSuccess}</div>
          </div>
        )}

        {/* Real-time Status Tracker */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Application Progress Tracker</h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
            {[
              { label: 'Register Account', active: true, done: true },
              { label: 'Pending Submission', active: beneficiary?.status === 'Pending Submission', done: beneficiary?.status !== 'Pending Submission' },
              { label: 'Under Review', active: beneficiary?.status === 'Pending Review' || beneficiary?.status === 'Under Review', done: isRejected },
              { label: isRejected ? 'Rejected' : 'Verification Status', active: isRejected, done: false, isFail: isRejected }
            ].map((step, idx, arr) => (
              <div key={idx} className="flex flex-1 items-center w-full md:w-auto">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold border transition ${
                    step.isFail ? 'bg-dswd-red border-dswd-red text-white shadow-lg shadow-red-200' :
                    step.done ? 'bg-dswd-green border-dswd-green text-white shadow-lg shadow-green-200' :
                    step.active ? 'bg-dswd-lightBlue border-dswd-lightBlue text-white shadow-lg shadow-blue-200' :
                    'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {step.isFail ? '❌' : step.done ? '✓' : idx + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold transition ${
                      step.isFail ? 'text-dswd-red font-bold' :
                      step.active ? 'text-dswd-lightBlue font-bold' :
                      step.done ? 'text-dswd-green font-bold' : 'text-slate-500'
                    }`}>{step.label}</p>
                    <p className="text-xs text-slate-400">{step.active ? 'Current Step' : step.done ? 'Completed' : 'Upcoming'}</p>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div className="hidden md:block flex-1 h-0.5 mx-4 bg-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>

        {isRejected && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-4">
            <div className="flex items-center gap-3 text-dswd-red font-bold">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg">Application Rejected</h3>
            </div>
            <p className="text-sm text-red-900 leading-relaxed">
              <span className="font-semibold block mb-1">Reason for Rejection:</span>
              "{beneficiary?.rejection_reason || 'Incomplete or unreadable documents'}"
            </p>
            {beneficiary?.missing_documents && (
              <div className="text-sm text-red-900">
                <span className="font-semibold block mb-1">Missing or Invalid Documents:</span>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {JSON.parse(beneficiary.missing_documents).map((doc, i) => (
                    <li key={i} className="font-semibold">{doc}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-dswd-red font-bold italic">Please update your application form details or re-upload the correct files below and resubmit.</p>
          </div>
        )}

        {isSubmitted && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 text-center">
            <Lock className="w-12 h-12 text-dswd-lightBlue mx-auto" />
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Application Locked</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Your application has been submitted and is currently <span className="font-semibold text-dswd-lightBlue">{beneficiary?.status}</span>. 
                You will be notified once a staff member reviews your application.
              </p>
            </div>
            
            <div className="border-t border-slate-100 pt-6 text-left max-w-md mx-auto space-y-4">
              <h4 className="font-semibold text-slate-800">Submitted Details Summary</h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-slate-500">Selected Category:</span>
                <span className="font-medium text-slate-800">{category}</span>
                <span className="text-slate-500">National ID Number:</span>
                <span className="font-mono font-medium text-slate-800">{nationalId}</span>
                <span className="text-slate-500">PSA Certificate No:</span>
                <span className="font-mono font-medium text-slate-800">{psaBirthCert || '—'}</span>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-800 block">Submitted Documents</span>
                <div className="divide-y divide-slate-100">
                  {docsUploaded.map((doc) => (
                    <div key={doc.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-dswd-green" />
                        <span className="font-medium text-slate-700">{doc.document_type}</span>
                      </div>
                      <a 
                        href={`${backendUrl}/${doc.file_path}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-dswd-lightBlue hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isSubmitted && !isApproved && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 text-dswd-lightBlue rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Step 1: Application Profile Details</h2>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category Selection <span className="text-red-500">*</span></label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100"
                      required
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="National ID / Government ID Number"
                    placeholder="Enter National ID no. (e.g. 1234-5678-9012)"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    required
                  />

                  <Input
                    label="PSA Birth Certificate Number (If applicable)"
                    placeholder="Enter Birth Certificate registry no."
                    value={psaBirthCert}
                    onChange={(e) => setPsaBirthCert(e.target.value)}
                  />

                  <Input
                    label="Contact Number"
                    placeholder="e.g. 09171234567"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Civil Status</label>
                    <select
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100"
                    >
                      {CIVIL_STATUSES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sex</label>
                    <div className="flex gap-4 mt-2">
                      {['Male', 'Female'].map(s => (
                        <label key={s} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            type="radio"
                            name="sex"
                            value={s}
                            checked={sex === s}
                            onChange={() => setSex(s)}
                            className="text-dswd-lightBlue focus:ring-dswd-lightBlue"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="Birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Barangay</label>
                    <select
                      value={barangayId}
                      onChange={(e) => setBarangayId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.barangay_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Sitio / Subdivision"
                    placeholder="Enter sitio/subdivision name"
                    value={sitio}
                    onChange={(e) => setSitio(e.target.value)}
                  />
                </div>

                <Input
                  label="Current Residential Address"
                  placeholder="Street, Municipality, Province"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />

                {category.includes('4Ps') && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <input
                      type="checkbox"
                      id="school-aged"
                      checked={hasSchoolChildren}
                      onChange={(e) => setHasSchoolChildren(e.target.checked)}
                      className="h-4 w-4 rounded text-dswd-lightBlue focus:ring-blue-500"
                    />
                    <label htmlFor="school-aged" className="text-sm font-semibold text-dswd-blue">
                      Do you have school-aged children? (Enables required Certificate of Enrollment upload)
                    </label>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={loading} className="px-6 py-2.5">
                    {loading ? 'Saving details...' : 'Save Profile Details'}
                  </Button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-dswd-lightBlue rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Step 2: Upload Required Documents</h2>
                  <p className="text-xs text-slate-500 mt-1">Upload required certificates in PDF, JPG, JPEG, or PNG format. Max size: 10MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getRequiredFilesList(category).map((reqDoc, idx) => {
                  const uploaded = docsUploaded.find(d => d.document_type === reqDoc.name);
                  const isInvalid = isRejected && beneficiary?.missing_documents && JSON.parse(beneficiary.missing_documents).includes(reqDoc.name);

                  return (
                    <div 
                      key={idx} 
                      className={`rounded-xl border p-5 flex flex-col justify-between h-48 transition-all ${
                        uploaded ? 'bg-emerald-50/40 border-emerald-200' :
                        isInvalid ? 'bg-red-50/50 border-red-200' :
                        'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-800 text-sm leading-tight">{reqDoc.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            reqDoc.required ? 'bg-red-100 text-dswd-red' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {reqDoc.required ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        {isInvalid && (
                          <span className="text-[10px] text-dswd-red font-bold block">❌ Flagged as missing/invalid</span>
                        )}
                      </div>

                      {uploaded ? (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <FileCheck className="w-4 h-4 text-dswd-green shrink-0" />
                            <span className="text-xs text-emerald-800 font-medium truncate flex-1">{uploaded.file_name}</span>
                          </div>
                          <div className="flex gap-2">
                            <a 
                              href={`${backendUrl}/${uploaded.file_path}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex-1 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1 shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </a>
                            <button
                              onClick={() => handleDeleteFile(uploaded.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-dswd-red shadow-sm transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <label className="cursor-pointer block text-center border-2 border-dashed border-slate-300 hover:border-dswd-lightBlue rounded-xl p-4 bg-white transition hover:shadow-inner">
                            <input
                              type="file"
                              accept="application/pdf,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx,image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, reqDoc.name)}
                              disabled={uploadingDoc === reqDoc.name}
                            />
                            {uploadingDoc === reqDoc.name ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-dswd-lightBlue"></span>
                                <span className="text-xs text-slate-500 font-bold">Uploading...</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                                <span className="text-xs font-semibold text-dswd-lightBlue block">Choose Document</span>
                              </div>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Step 3: Submit Complete Application</h3>
                <p className="text-xs text-slate-500">Ensure profile details are saved and all required uploads are complete before clicking submit.</p>
              </div>
              <Button
                onClick={handleSubmitApplication}
                disabled={loading || !beneficiary?.category}
                className="w-full md:w-auto px-8 py-3 text-sm font-bold shadow-lg"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: STAFF / ADMIN / BARANGAY DASHBOARD (Mockup designs)
  // -------------------------------------------------------------
  const recentAppsList = applications.slice(0, 5);

  return (
    <div className="space-y-8 pr-1">
      {/* Welcome Banner Card (matching DSWD blueprint welcome strip) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-dswd-blue to-dswd-lightBlue text-white p-8 md:p-10 shadow-xl flex items-center min-h-[170px]">
        <div className="space-y-3 max-w-lg z-10">
          <p className="text-xs font-extrabold uppercase tracking-widest text-dswd-yellow">System Hub</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
            WELCOME BACK, {user?.first_name || 'Admin'}! 👋
          </h1>
          <p className="text-sm text-blue-100 font-medium leading-relaxed">
            Here's what's happening today in your Barangay dashboard. Keep monitoring updates.
          </p>
        </div>
        {/* Stylized overlap DSWD graphic */}
        <svg className="absolute right-8 bottom-0 h-44 w-auto hidden md:block" viewBox="0 0 120 120" fill="none">
          <path d="M60 100C60 100 95 72 95 45C95 20 73 10 60 30C47 10 25 20 25 45C25 72 60 100 60 100Z" fill="#FFD100" opacity="0.95" />
          <path d="M60 35C48 35 38 43 38 58C38 75 60 92 60 92C60 92 82 75 82 58C82 43 72 35 60 35Z" fill="#E30613" opacity="0.95" />
          <circle cx="60" cy="53" r="10" fill="#00338D" />
          <circle cx="51" cy="65" r="7.5" fill="#00338D" />
          <circle cx="69" cy="65" r="7.5" fill="#00338D" />
        </svg>
      </div>

      {/* Metrics Row (matching 4 stats layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Beneficiaries */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{loading ? '...' : totalBeneficiariesCount}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Total Beneficiaries</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-dswd-lightBlue">
              <Users className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className="text-dswd-green">{summary?.approvedCount || 0} approved</span>
            <span className="text-slate-300">|</span>
            <span className="text-dswd-red">{summary?.rejectedCount || 0} rejected</span>
          </div>
          <svg className="w-full h-8 mt-4 text-dswd-lightBlue" viewBox="0 0 100 20" fill="none">
            <path d="M0 15 Q20 5 40 12 T80 8 T100 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {/* Card 2: Active Programs */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{loading ? '...' : summary?.totalPrograms || 0}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Active Programs</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 text-dswd-red">
              <FileText className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span>{summary?.totalDistributionEvents || 0} distribution events</span>
          </div>
          <svg className="w-full h-8 mt-4 text-dswd-lightRed" viewBox="0 0 100 20" fill="none">
            <path d="M0 18 Q20 12 40 15 T80 5 T100 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {/* Card 3: Pending Enrollments */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{loading ? '...' : summary?.pendingApplications || 0}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Pending Enrollments</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-dswd-yellow">
              <Clock className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className="text-dswd-lightBlue">{summary?.underReviewCount || 0} under review</span>
            <span className="text-slate-300">|</span>
            <button 
              onClick={() => setActiveTab('queue')}
              className="text-dswd-lightBlue hover:underline font-bold"
            >
              View details
            </button>
          </div>
          <svg className="w-full h-8 mt-4 text-dswd-lightYellow" viewBox="0 0 100 20" fill="none">
            <path d="M0 10 Q20 18 40 12 T80 15 T100 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {/* Card 4: Distributions Completed */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{loading ? '...' : summary?.completedEvents || 0}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Distributions Completed</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-dswd-green">
              <CheckCircle2 className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className="text-dswd-lightBlue">{summary?.scheduledEvents || 0} scheduled</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-500">{summary?.ongoingEvents || 0} ongoing</span>
          </div>
          <svg className="w-full h-8 mt-4 text-dswd-green" viewBox="0 0 100 20" fill="none">
            <path d="M0 15 Q20 10 40 18 T80 8 T100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {/* Card 5: Total Budget */}
        <div className="bg-amber-50 rounded-2xl p-6 shadow-sm border border-amber-200 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-extrabold text-amber-900">{loading ? '...' : `₱${(summary?.totalDistributedFunds || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              <p className="text-xs font-semibold text-amber-700 mt-1">Total Budget Distributed</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <FileText className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className="text-amber-600">₱{(summary?.totalBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total budget</span>
            <span className="text-slate-300">|</span>
            <span className="text-dswd-green">₱{(summary?.budgetRemaining || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} remaining</span>
          </div>
          <svg className="w-full h-8 mt-4 text-amber-300" viewBox="0 0 100 20" fill="none">
            <path d="M0 10 Q20 5 40 12 T80 8 T100 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* Main Split Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Enrollments & applications table */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Workspace Filter Tab Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Verification Actions</h2>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeTab === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pending Queue ({applications.length})
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monthly Charts
                </button>
              </div>
            </div>

            {activeTab === 'queue' ? (
              <div className="space-y-4">
                {loading ? (
                  <div className="py-12 text-center">
                    <span className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-dswd-lightBlue"></span>
                    <p className="text-xs text-slate-500 mt-2">Syncing database applications...</p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-700 font-bold text-sm">No applications to review</p>
                    <p className="text-xs text-slate-400 mt-1">Beneficiary applications from your barangay will show up here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <th className="pb-3.5 font-bold">Applicant Name</th>
                          <th className="pb-3.5 font-bold">Program</th>
                          <th className="pb-3.5 font-bold">Date Registered</th>
                          <th className="pb-3.5 font-bold">Verification Status</th>
                          <th className="pb-3.5 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {applications.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/50">
                            <td className="py-4 font-bold text-slate-900">{app.first_name} {app.last_name}</td>
                            <td className="py-4 font-semibold text-slate-500">{app.category || '—'}</td>
                            <td className="py-4 text-slate-400">{new Date(app.created_at).toLocaleDateString()}</td>
                            <td className="py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                app.status === 'Pending Review' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                app.status === 'Under Review' ? 'bg-blue-50 text-dswd-lightBlue border border-blue-200' :
                                app.status === 'Approved' ? 'bg-emerald-50 text-dswd-green border border-emerald-200' :
                                'bg-red-50 text-dswd-red border border-red-200'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <Button 
                                onClick={() => { setSelectedApp(app); setShowRejectForm(false); setPreviewUrl(null); }}
                                className="px-4 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg"
                              >
                                Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Charts view option */
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800">Monthly Program Distribution Trends</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <YAxis stroke="#94a3b8" tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      formatter={(value) => `₱${value?.toLocaleString()}`}
                    />
                    <Bar dataKey="total" fill="#00338D" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* DSWD Recent Enrollments Mockup list */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Recent Enrollments</h2>
              <button onClick={() => setActiveTab('queue')} className="text-xs font-bold text-dswd-lightBlue hover:underline">
                View all
              </button>
            </div>

            <div className="space-y-3">
              {recentAppsList.map((app, idx) => (
                <div key={app.id || idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50 rounded-xl transition border border-slate-100 bg-white">
                  <div className="flex items-center gap-3">
                    {/* User initials circle */}
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 uppercase">
                      {app.first_name?.[0] || 'U'}{app.last_name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{app.first_name} {app.last_name}</p>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">{app.category || 'Basic Program'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      app.status === 'Approved' ? 'bg-emerald-50 text-dswd-green' :
                      app.status === 'Rejected' ? 'bg-red-50 text-dswd-red' :
                      'bg-blue-50 text-dswd-lightBlue'
                    }`}>
                      {app.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(app.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Program Distribution Donut Chart (matching mockup) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">Program Distribution</h2>
              <select className="bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 rounded-lg px-2 py-1 outline-none">
                <option>This Month</option>
                <option>This Year</option>
              </select>
            </div>

            <div className="relative flex justify-center py-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} applications`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-2xl font-black text-slate-800">{totalBeneficiariesCount}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Apps</span>
              </div>
            </div>

            {/* Custom Legends matching Mockup design */}
            <div className="mt-6 space-y-3.5 border-t border-slate-100 pt-6">
              {chartData.map((item, idx) => {
                const total = totalBeneficiariesCount || 1;
                const percent = Math.round((item.value / total) * 100);
                return (
                  <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-slate-900 font-bold">
                      {item.value?.toLocaleString()} <span className="text-slate-400 font-medium">({percent}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barangay Guidelines / Resources Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-dswd-lightBlue" />
              Barangay Guidelines
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Review and verify applications according to MSWD guidelines. Approve to generate unique code, or reject by checking missing files.
            </p>
          </div>
        </div>
      </div>

      {/* System Summary Banner */}
      {summary && (summary.pendingApplications > 0 || summary.ongoingEvents > 0) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-dswd-lightBlue text-white rounded-xl shadow-md">
              <Bell className="w-5.5 h-5.5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 leading-tight">Action Required</h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5 leading-normal">
                {summary.pendingApplications > 0 && `${summary.pendingApplications} application(s) pending review. `}
                {summary.ongoingEvents > 0 && `${summary.ongoingEvents} distribution event(s) currently ongoing.`}
              </p>
            </div>
          </div>
          {summary.pendingApplications > 0 && (
            <button 
              onClick={() => setActiveTab('queue')}
              className="px-5 py-2.5 bg-dswd-lightBlue hover:bg-dswd-blue text-white text-xs font-bold rounded-xl transition shadow-md shrink-0"
            >
              Review Queue
            </button>
          )}
        </div>
      )}

      {/* ADMIN DETAIL MODAL FOR REVIEW */}
      {selectedApp && user?.role === 'admin' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Reviewing Application</h3>
                <p className="text-xs text-slate-500">Applicant: {selectedApp.first_name} {selectedApp.last_name}</p>
              </div>
              <button 
                onClick={() => { setSelectedApp(null); setPreviewUrl(null); }}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-3">Profile Information</h4>
                  <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-2 border border-slate-100">
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Category:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.category}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Barangay:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.Barangay?.barangay_name}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Sex:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.sex}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Birthdate:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.birthdate}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Civil Status:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.civil_status || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Contact No:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.contact_number || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">National ID:</span>
                      <span className="col-span-2 font-mono font-bold text-slate-800">{selectedApp.national_id_number}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">PSA Cert:</span>
                      <span className="col-span-2 font-mono font-bold text-slate-800">{selectedApp.psa_birth_cert_number || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Address:</span>
                      <span className="col-span-2 font-semibold text-slate-800 text-xs">{selectedApp.address || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Review Actions</h4>
                  
                  {selectedApp.status === 'Pending Review' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                      <p className="text-xs text-amber-800 font-medium mb-3">This application is still marked as Pending Review. Start reviewing to notify the beneficiary.</p>
                      <Button onClick={() => handleStartReview(selectedApp.id)} className="w-full">
                        Mark Under Review
                      </Button>
                    </div>
                  )}

                  {selectedApp.status !== 'Approved' && !showRejectForm && (
                    <div className="flex gap-4">
                      <Button 
                        onClick={() => handleApproveApplication(selectedApp.id)} 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        disabled={selectedApp.status === 'Pending Review'}
                      >
                        Approve Application
                      </Button>
                      <Button 
                        onClick={() => setShowRejectForm(true)} 
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                        disabled={selectedApp.status === 'Pending Review'}
                      >
                        Reject Application
                      </Button>
                    </div>
                  )}

                  {showRejectForm && (
                    <form onSubmit={handleRejectApplication} className="p-4 border border-red-200 bg-red-50/50 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center text-red-900 font-bold text-sm">
                        <span>Rejection Review Details</span>
                        <button type="button" onClick={() => setShowRejectForm(false)} className="text-xs text-slate-400">Cancel</button>
                      </div>

                      <Input
                        label="Reason for Rejection *"
                        placeholder="Specify details, e.g. Birth certificate is blurry"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                      />

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Flag Missing / Invalid Documents:</label>
                        <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 max-h-36 overflow-y-auto">
                          {getRequiredFilesList(selectedApp.category).map((d) => (
                            <label key={d.name} className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={missingDocs.includes(d.name)}
                                onChange={() => handleToggleMissingDoc(d.name)}
                                className="rounded text-red-600 focus:ring-red-500"
                              />
                              {d.name}
                            </label>
                          ))}
                        </div>
                      </div>

                      <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
                        Confirm Rejection
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              <div className="space-y-4 flex flex-col h-full">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-3">Submitted Documents</h4>
                  <div className="divide-y divide-slate-100 bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                    {getRequiredFilesList(selectedApp.category).map((req, i) => {
                      const file = selectedApp.Documents?.find(d => d.document_type === req.name);
                      return (
                        <div key={i} className="py-2.5 flex items-center justify-between text-sm">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block text-xs">{req.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{req.required ? 'Required' : 'Optional'}</span>
                          </div>
                          {file ? (
                            <button
                              onClick={() => {
                                const cleanPath = (file.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
                                setPreviewUrl(`${backendUrl}/${cleanPath}`);
                              }}
                              className="text-xs text-dswd-lightBlue font-bold hover:underline flex items-center gap-1 shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" /> Preview Inline
                            </button>
                          ) : (
                            <span className="text-xs text-dswd-red font-bold">❌ Missing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {previewUrl && (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-100 flex-1 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-bold text-slate-700">Inline Document Preview</span>
                      <button 
                        onClick={() => setPreviewUrl(null)} 
                        className="text-xs text-dswd-red font-bold"
                      >
                        Close Preview
                      </button>
                    </div>
                    <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-2">
                      {previewUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || previewUrl.includes('image') ? (
                        <img 
                          src={previewUrl} 
                          alt="Submitted Document" 
                          className="max-h-[320px] w-auto max-w-full object-contain rounded-lg"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <iframe 
                          src={previewUrl} 
                          title="Submitted Document PDF" 
                          className="w-full h-full min-h-[320px] rounded-lg" 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
