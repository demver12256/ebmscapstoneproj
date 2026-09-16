import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { medicalAssistanceApi, beneficiaryApi } from '../services/api';
import {
  Stethoscope, Pill, FlaskConical, Building2, CheckCircle2, XCircle,
  AlertCircle, Upload, Eye, RefreshCw, FileText, ArrowRight, ArrowLeft,
  Clock, ShieldAlert, ShieldCheck, HelpCircle, Check, X, FileCheck,
  ChevronRight, Calendar, User, Phone, MapPin, DollarSign, Download,
  ExternalLink, Sparkles, Plus, AlertTriangle, GraduationCap, Wallet, HeartHandshake, HandHeart
} from 'lucide-react';

const CATEGORY_GROUPS = [
  { id: 'all', label: 'All Programs (6)' },
  { id: 'medical', label: '🏥 Health & Medical (3)' },
  { id: 'social', label: '🤝 Social & Crisis (3)' },
];

const CATEGORIES = [
  // ── HEALTH & MEDICAL ASSISTANCE ──
  {
    id: 'Medicines Assistance',
    group: 'medical',
    groupLabel: 'Health & Medical Assistance',
    title: 'Medicines Assistance',
    description: 'Prescription medicines, maintenance drugs, and official drugstore price quotations (Oriental 21 Pharmacy, Generika Drugstore, etc.).',
    icon: Pill,
    color: 'from-blue-600 to-indigo-700',
    border: 'border-blue-500',
    bg: 'bg-blue-50/50',
    badge: 'Prescriptions & Pharmacy',
  },
  {
    id: 'Laboratory Assistance',
    group: 'medical',
    groupLabel: 'Health & Medical Assistance',
    title: 'Laboratory Assistance',
    description: 'Diagnostic laboratory procedures, blood chemistry, X-Ray, CT Scan, MRI, Ultrasound, and clinical laboratory examinations.',
    icon: FlaskConical,
    color: 'from-cyan-600 to-teal-700',
    border: 'border-cyan-500',
    bg: 'bg-cyan-50/50',
    badge: 'Diagnostics & Lab Tests',
  },
  {
    id: 'Hospital Bill Assistance',
    group: 'medical',
    groupLabel: 'Health & Medical Assistance',
    title: 'Hospital Bill Assistance',
    description: 'Inpatient confinement expenses, surgical/operating room charges, bills marked "UP TO PRESENT", or promissory discharge balances.',
    icon: Building2,
    color: 'from-rose-600 to-red-700',
    border: 'border-rose-500',
    bg: 'bg-rose-50/50',
    badge: 'Inpatient & Confinement',
  },

  // ── SOCIAL & CRISIS ASSISTANCE ──
  {
    id: 'Educational Assistance',
    group: 'social',
    groupLabel: 'Social & Crisis Assistance',
    title: 'Educational Assistance',
    description: 'Tuition fees, matriculation fees, school enrollment certification, academic supplies, and student financial aid.',
    icon: GraduationCap,
    color: 'from-amber-600 to-orange-700',
    border: 'border-amber-500',
    bg: 'bg-amber-50/50',
    badge: 'Tuition & School Expenses',
  },
  {
    id: 'Financial Assistance',
    group: 'social',
    groupLabel: 'Social & Crisis Assistance',
    title: 'Financial Assistance',
    description: 'Emergency cash grant aid (AICS) for individuals and families facing severe economic distress or sudden crisis situations.',
    icon: Wallet,
    color: 'from-emerald-600 to-teal-700',
    border: 'border-emerald-500',
    bg: 'bg-emerald-50/50',
    badge: 'Emergency Cash Grant',
  },
  {
    id: 'Burial Assistance',
    group: 'social',
    groupLabel: 'Social & Crisis Assistance',
    title: 'Burial Assistance',
    description: 'Funeral service costs, casket expenses, mortuary fees, and bereavement financial assistance for grieving families.',
    icon: HeartHandshake,
    color: 'from-purple-600 to-violet-800',
    border: 'border-purple-500',
    bg: 'bg-purple-50/50',
    badge: 'Funeral & Memorial Aid',
  },
];

const IMMEDIATE_FAMILY = ['Mother', 'Father', 'Son', 'Daughter', 'Sibling'];
const NON_IMMEDIATE_RELATIONS = ['Common-Law Partner', 'Aunt / Uncle', 'Cousin', 'Grandparent', 'Authorized Representative'];

const STATUS_CONFIG = {
  Draft: { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: FileText, label: 'Draft' },
  Incomplete: { bg: 'bg-amber-100 text-amber-900 border-amber-300', icon: AlertCircle, label: 'Incomplete' },
  'Pending Review': { bg: 'bg-blue-100 text-blue-900 border-blue-300', icon: Clock, label: 'Pending Review' },
  'Under Verification': { bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: RefreshCw, label: 'Under Verification' },
  Approved: { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: CheckCircle2, label: 'Approved' },
  Rejected: { bg: 'bg-rose-100 text-rose-900 border-rose-300', icon: XCircle, label: 'Rejected' },
  'For Additional Requirements': { bg: 'bg-orange-100 text-orange-900 border-orange-300', icon: AlertTriangle, label: 'For Additional Requirements' },
  Released: { bg: 'bg-purple-100 text-purple-900 border-purple-300', icon: ShieldCheck, label: 'Assistance Released' },
  Archived: { bg: 'bg-slate-200 text-slate-700 border-slate-400', icon: FileText, label: 'Archived' },
};

export default function MedicalAssistancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-applications'); // 'my-applications' | 'apply'
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [beneficiary, setBeneficiary] = useState(null);

  // Form State
  const [currentAppId, setCurrentAppId] = useState(null);
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('Medicines Assistance');
  const [targetAgency, setTargetAgency] = useState('DSWD'); // 'DSWD' | 'MSWDO'
  
  // Patient details
  const [patientName, setPatientName] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientDob, setPatientDob] = useState('');
  const [patientContact, setPatientContact] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [hospitalClinic, setHospitalClinic] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [attendingPhysician, setAttendingPhysician] = useState('');

  // Educational fields
  const [educationLevel, setEducationLevel] = useState('College / University');
  const [schoolName, setSchoolName] = useState('');
  const [courseOrYear, setCourseOrYear] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');

  // Financial fields
  const [financialCrisisType, setFinancialCrisisType] = useState('Emergency Family Crisis');
  const [financialReason, setFinancialReason] = useState('');
  const [sourceOfLivelihood, setSourceOfLivelihood] = useState('');

  // Burial fields
  const [deceasedName, setDeceasedName] = useState('');
  const [dateOfPassing, setDateOfPassing] = useState('');
  const [funeralHomeName, setFuneralHomeName] = useState('');
  const [causeOfDeath, setCauseOfDeath] = useState('');

  // Representative / Relationship details
  const [applicantRelationship, setApplicantRelationship] = useState('Mother');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeContact, setRepresentativeContact] = useState('');

  // Category specific situational details
  const [hasDistrictReferral, setHasDistrictReferral] = useState(false);
  const [pharmacyName, setPharmacyName] = useState('Oriental 21 Pharmacy');
  const [labProcedureName, setLabProcedureName] = useState('');
  const [labRequiresPayment, setLabRequiresPayment] = useState(true);
  const [labGuaranteeLetterFacility, setLabGuaranteeLetterFacility] = useState(false);
  const [hospitalConfinementStatus, setHospitalConfinementStatus] = useState('currently_confined');
  const [hadSurgicalOperation, setHadSurgicalOperation] = useState(false);
  const [totalAmountRequested, setTotalAmountRequested] = useState('');

  // Dynamic Requirements and Uploaded Documents
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  
  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);

  // File upload input ref
  const fileInputRef = useRef(null);
  const [uploadingDocCode, setUploadingDocCode] = useState(null);
  const [uploadingDocName, setUploadingDocName] = useState('');

  const [notificationMsg, setNotificationMsg] = useState(null);

  const isImmediate = IMMEDIATE_FAMILY.includes(applicantRelationship);

  // Load initial beneficiary and applications
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [benRes, appsRes] = await Promise.all([
        beneficiaryApi.getMe().catch(() => ({ data: { data: null } })),
        medicalAssistanceApi.getMyApplications().catch(() => ({ data: { data: [] } })),
      ]);

      const benData = benRes.data?.data;
      setBeneficiary(benData);
      if (benData) {
        setPatientName(`${benData.first_name || ''} ${benData.last_name || ''}`.trim());
        setPatientContact(benData.contact_number || '');
        setPatientAddress(benData.address || '');
        setRepresentativeName(`${benData.first_name || ''} ${benData.last_name || ''}`.trim());
        setRepresentativeContact(benData.contact_number || '');
      }

      const apps = appsRes.data?.data || [];
      setMyApplications(apps);

      // If user has a draft or in-progress application, load it
      const activeDraft = apps.find(a => ['Draft', 'Incomplete', 'For Additional Requirements'].includes(a.status));
      if (activeDraft) {
        populateFormFromApp(activeDraft);
      } else {
        // Compute requirements for initial default form
        refreshRequirementsMatrix({
          category: 'Medicines Assistance',
          applicant_relationship: 'Mother',
          pharmacy_name: 'Oriental 21 Pharmacy',
          has_district_referral: false,
        });
      }
    } catch (err) {
      console.error('Error loading medical assistance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const populateFormFromApp = (app) => {
    setCurrentAppId(app.id);
    setSelectedCategory(app.category);
    setTargetAgency(app.agency || 'DSWD');
    setPatientName(app.patient_name || '');
    setPatientGender(app.patient_gender || 'Male');
    setPatientDob(app.patient_dob || '');
    setPatientContact(app.patient_contact || '');
    setPatientAddress(app.patient_address || '');
    setHospitalClinic(app.hospital_or_clinic_name || '');
    setDiagnosis(app.diagnosis || '');
    setAttendingPhysician(app.attending_physician || '');
    setApplicantRelationship(app.applicant_relationship || 'Mother');
    setRepresentativeName(app.representative_name || '');
    setRepresentativeContact(app.representative_contact || '');
    setHasDistrictReferral(Boolean(app.has_district_referral));
    setPharmacyName(app.pharmacy_name || 'Oriental 21 Pharmacy');
    setLabProcedureName(app.lab_procedure_name || '');
    setLabRequiresPayment(app.lab_requires_payment !== false);
    setLabGuaranteeLetterFacility(Boolean(app.lab_guarantee_letter_facility));
    setHospitalConfinementStatus(app.hospital_confinement_status || 'currently_confined');
    setHadSurgicalOperation(Boolean(app.had_surgical_operation));
    setTotalAmountRequested(app.total_amount_requested || '');
    setUploadedDocs(app.Documents || []);
    setRequiredDocs(app.required_documents || []);
  };

  // Re-compute requirements whenever situation options change
  const refreshRequirementsMatrix = async (payloadOverride = null) => {
    try {
      const payload = payloadOverride || {
        category: selectedCategory,
        applicant_relationship: applicantRelationship,
        has_district_referral: hasDistrictReferral,
        pharmacy_name: pharmacyName,
        lab_requires_payment: labRequiresPayment,
        lab_guarantee_letter_facility: labGuaranteeLetterFacility,
        hospital_confinement_status: hospitalConfinementStatus,
        had_surgical_operation: hadSurgicalOperation,
      };

      const res = await medicalAssistanceApi.getRequirementsMatrix(payload);
      setRequiredDocs(res.data.data || []);
    } catch (err) {
      console.error('Failed to get requirements matrix:', err);
    }
  };

  useEffect(() => {
    refreshRequirementsMatrix();
  }, [
    selectedCategory,
    applicantRelationship,
    hasDistrictReferral,
    pharmacyName,
    labRequiresPayment,
    labGuaranteeLetterFacility,
    hospitalConfinementStatus,
    hadSurgicalOperation,
  ]);

  // Handle Save / Update Draft
  const handleSaveDraft = async (silent = false) => {
    setActionLoading(true);
    try {
      let finalName = patientName.trim();
      let finalFacility = hospitalClinic.trim();
      let finalDiagnosis = diagnosis.trim();
      let finalPhysician = attendingPhysician.trim();

      if (selectedCategory === 'Educational Assistance') {
        finalName = patientName.trim();
        finalFacility = schoolName.trim();
        finalDiagnosis = `Academic Level: ${educationLevel}${courseOrYear ? ` | Course/Year: ${courseOrYear}` : ''}`;
        finalPhysician = studentIdNumber.trim() ? `Student ID/LRN: ${studentIdNumber.trim()}` : 'Student';
      } else if (selectedCategory === 'Financial Assistance') {
        finalName = patientName.trim();
        finalFacility = financialCrisisType;
        finalDiagnosis = financialReason.trim() || 'Emergency Financial Assistance (AICS)';
        finalPhysician = sourceOfLivelihood.trim() ? `Livelihood: ${sourceOfLivelihood.trim()}` : 'Claimant';
      } else if (selectedCategory === 'Burial Assistance') {
        finalName = (deceasedName || patientName).trim();
        finalFacility = funeralHomeName.trim() || 'Funeral / Mortuary';
        finalDiagnosis = `Date of Passing: ${dateOfPassing || 'N/A'}${causeOfDeath ? ` | Cause: ${causeOfDeath}` : ''}`;
        finalPhysician = 'Funeral Service';
      }

      const payload = {
        id: currentAppId,
        category: selectedCategory,
        patient_name: finalName,
        patient_gender: patientGender,
        patient_dob: patientDob || null,
        patient_contact: patientContact.trim(),
        patient_address: patientAddress.trim(),
        hospital_or_clinic_name: finalFacility,
        diagnosis: finalDiagnosis,
        attending_physician: finalPhysician,
        applicant_relationship: applicantRelationship,
        representative_name: representativeName.trim(),
        representative_contact: representativeContact.trim(),
        has_district_referral: hasDistrictReferral,
        pharmacy_name: pharmacyName,
        lab_procedure_name: labProcedureName.trim(),
        lab_requires_payment: labRequiresPayment,
        lab_guarantee_letter_facility: labGuaranteeLetterFacility,
        hospital_confinement_status: hospitalConfinementStatus,
        had_surgical_operation: hadSurgicalOperation,
        total_amount_requested: parseFloat(totalAmountRequested) || 0,
        agency: targetAgency,
      };

      const res = await medicalAssistanceApi.saveDraft(payload);
      const updated = res.data.data;
      setCurrentAppId(updated.id);
      setUploadedDocs(updated.Documents || []);
      setRequiredDocs(updated.required_documents || []);

      if (!silent) {
        setNotificationMsg({ type: 'success', text: 'Application draft saved successfully!' });
      }
      refreshMyApplications();
      return updated;
    } catch (err) {
      console.error('Failed to save draft:', err);
      if (!silent) {
        setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save application draft.' });
      }
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const refreshMyApplications = async () => {
    try {
      const res = await medicalAssistanceApi.getMyApplications();
      setMyApplications(res.data.data || []);
    } catch (e) {
      console.error('Error refreshing my applications:', e);
    }
  };

  // Trigger File Upload Dialog
  const triggerUpload = (code, name) => {
    setUploadingDocCode(code);
    setUploadingDocName(name);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Upload file handler
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocCode) return;

    // First ensure draft is saved so we have an application_id
    let appId = currentAppId;
    if (!appId) {
      const saved = await handleSaveDraft(true);
      if (!saved) {
        setNotificationMsg({ type: 'error', text: 'Please fill in required patient information before uploading files.' });
        return;
      }
      appId = saved.id;
    }

    setActionLoading(true);
    setNotificationMsg(null);
    try {
      const formData = new FormData();
      formData.append('application_id', appId);
      formData.append('document_code', uploadingDocCode);
      formData.append('document_name', uploadingDocName);
      formData.append('file', file);

      await medicalAssistanceApi.uploadDocument(formData);

      // Re-fetch current application details
      const appRes = await medicalAssistanceApi.getMyApplication(appId);
      populateFormFromApp(appRes.data.data);
      setNotificationMsg({ type: 'success', text: `Document "${uploadingDocName}" uploaded successfully!` });
      refreshMyApplications();
    } catch (err) {
      console.error('Error uploading document:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to upload document file.' });
    } finally {
      setActionLoading(false);
      setUploadingDocCode(null);
      setUploadingDocName('');
    }
  };

  // Delete document handler
  const handleDeleteDoc = async (docId, docName) => {
    if (!window.confirm(`Are you sure you want to remove "${docName}"?`)) return;
    setActionLoading(true);
    try {
      await medicalAssistanceApi.deleteDocument(docId);
      const appRes = await medicalAssistanceApi.getMyApplication(currentAppId);
      populateFormFromApp(appRes.data.data);
      setNotificationMsg({ type: 'info', text: `Removed "${docName}".` });
      refreshMyApplications();
    } catch (err) {
      console.error('Error deleting doc:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to remove document.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Final Application Submission Handler
  const handleSubmitApplication = async () => {
    if (!currentAppId) {
      setNotificationMsg({ type: 'error', text: 'Please save draft and upload all required documents first.' });
      return;
    }

    // Check completeness
    const uploadedCodes = uploadedDocs.map(d => d.document_code);
    const missing = requiredDocs.filter(r => !uploadedCodes.includes(r.code));

    if (missing.length > 0) {
      setNotificationMsg({
        type: 'error',
        text: `Cannot submit. Missing ${missing.length} mandatory document(s): ${missing.map(m => m.name).join(', ')}`,
      });
      return;
    }

    if (!window.confirm('Are you ready to submit your DSWD Medical Assistance application for official verification?')) {
      return;
    }

    setActionLoading(true);
    try {
      await medicalAssistanceApi.submitApplication(currentAppId);
      setNotificationMsg({
        type: 'success',
        text: '🎉 Application submitted successfully! It is now under Pending Review by DSWD staff.',
      });
      await refreshMyApplications();
      setActiveTab('my-applications');
    } catch (err) {
      console.error('Submission failed:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit application.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate checklist progress
  const uploadedCodes = uploadedDocs.map(d => d.document_code);
  const completedCount = requiredDocs.filter(r => uploadedCodes.includes(r.code)).length;
  const totalCount = requiredDocs.length;
  const isComplete = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-2xl p-8 border border-white/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              Official DSWD Assistance Programs
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <HandHeart className="w-9 h-9 text-yellow-300" />
              DSWD Assistance Program
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
              Provides targeted financial grants and guarantee letter assistance for Medical, Hospital, Educational, Financial, and Burial assistance with live document checklist validation.
            </p>
          </div>

          <div className="flex sm:flex-col gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('apply')}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                activeTab === 'apply'
                  ? 'bg-blue-500 text-white shadow-blue-500/25 ring-2 ring-blue-400/50'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-md'
              }`}
            >
              <Plus className="w-4 h-4" />
              New Application
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('my-applications');
                refreshMyApplications();
              }}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                activeTab === 'my-applications'
                  ? 'bg-blue-500 text-white shadow-blue-500/25 ring-2 ring-blue-400/50'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-md'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              My Applications ({myApplications.length})
            </button>
          </div>
        </div>
      </div>

      {/* Global Notification Toast */}
      {notificationMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg transition-all animate-fadeIn ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : notificationMsg.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {notificationMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : notificationMsg.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{notificationMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: APPLY FOR MEDICAL ASSISTANCE */}
      {/* ========================================================================= */}
      {activeTab === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Application Form (Left 8 Cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Step 1: Program Category Selection */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      1
                    </span>
                    Select Assistance Category
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Choose the specific assistance category needed. The required documents and rules will automatically adjust.
                  </p>
                </div>

                {/* Category Group Filter Switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start sm:self-auto">
                  {CATEGORY_GROUPS.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setSelectedCategoryGroup(grp.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategoryGroup === grp.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Office / Agency Selector */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                  Target Office / Kaninong Tanggapan Ipapadala ang Request:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetAgency('DSWD')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      targetAgency === 'DSWD'
                        ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-1 ring-blue-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                        🏛️ DSWD Office (National)
                      </span>
                      {targetAgency === 'DSWD' && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Department of Social Welfare and Development — handled directly by DSWD Admin (National AICS, 4Ps, Crisis assistance).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAgency('MSWDO')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      targetAgency === 'MSWDO'
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                        🏢 MSWDO Office (Municipal)
                      </span>
                      {targetAgency === 'MSWDO' && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Municipal Social Welfare and Development Office — handled directly by MSWDO Admin (Senior Citizens, PWD, Municipal aid).
                    </p>
                  </button>
                </div>
              </div>

              {/* Categorized Display */}
              {selectedCategoryGroup === 'all' ? (
                <div className="space-y-6">
                  {/* Category Group 1: Health & Medical Assistance */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/70 w-fit">
                      <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                      Category 1: Health & Medical Assistance (3 Programs)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {CATEGORIES.filter((c) => c.group === 'medical').map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`relative p-5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col justify-between ${
                              isSelected
                                ? `${cat.border} ${cat.bg} shadow-md ring-2 ring-blue-500/20`
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                            <div>
                              <div
                                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} text-white flex items-center justify-center shadow-md mb-3`}
                              >
                                <Icon className="w-6 h-6" />
                              </div>
                              <h3 className="font-bold text-slate-900 text-base">{cat.title}</h3>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                                {cat.description}
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                                {cat.badge}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Group 2: Social & Crisis Assistance */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/70 w-fit">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                      Category 2: Social & Crisis Assistance (3 Programs)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {CATEGORIES.filter((c) => c.group === 'social').map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`relative p-5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col justify-between ${
                              isSelected
                                ? `${cat.border} ${cat.bg} shadow-md ring-2 ring-blue-500/20`
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                            <div>
                              <div
                                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} text-white flex items-center justify-center shadow-md mb-3`}
                              >
                                <Icon className="w-6 h-6" />
                              </div>
                              <h3 className="font-bold text-slate-900 text-base">{cat.title}</h3>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                                {cat.description}
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                {cat.badge}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {CATEGORIES.filter((c) => c.group === selectedCategoryGroup).map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`relative p-5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${cat.border} ${cat.bg} shadow-md ring-2 ring-blue-500/20`
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <div>
                          <div
                            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} text-white flex items-center justify-center shadow-md mb-3`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <h3 className="font-bold text-slate-900 text-base">{cat.title}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                            {cat.description}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                            {cat.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Beneficiary & Representative Validation */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    2
                  </span>
                  Applicant & Representative Validation
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Who is processing this assistance request? Immediate family members are prioritized.
                </p>
              </div>

              {/* Relationship Picker */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">
                  Relationship to Patient <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {IMMEDIATE_FAMILY.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => setApplicantRelationship(rel)}
                      className={`px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                        applicantRelationship === rel
                          ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <span className="text-xs text-slate-500 font-medium block mb-2">
                    Non-Immediate Family Members or Representatives:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {NON_IMMEDIATE_RELATIONS.map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setApplicantRelationship(rel)}
                        className={`px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                          applicantRelationship === rel
                            ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        {rel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strict Validation Notice if Non-Immediate Family */}
              {!isImmediate ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                    <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                    Special Representative Validation Required
                  </div>
                  <p className="text-xs leading-relaxed text-amber-900/90">
                    Since you are processing as a <strong>{applicantRelationship}</strong> (not an immediate family member such as Mother, Father, Son, Daughter, or Sibling), the DSWD rules mandate additional verification documents:
                  </p>
                  <ul className="text-xs space-y-1 pl-4 list-disc font-medium text-amber-950">
                    <li>One (1) photocopy of the Patient's or Partner's ID containing three (3) specimen signatures.</li>
                    <li>Authorization Letter signed by the Patient or Partner.</li>
                    <li>
                      <strong>Barangay Certification</strong> confirming you live with the patient as common-law partner or are officially authorized to represent them.
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    <strong>Immediate Family Verified ({applicantRelationship}):</strong> You only need to submit your valid ID (back-to-back) along with the clinical documents.
                  </p>
                </div>
              )}

              {/* Representative Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Representative / Applicant Full Name
                  </label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Representative Contact Number
                  </label>
                  <input
                    type="text"
                    value={representativeContact}
                    onChange={(e) => setRepresentativeContact(e.target.value)}
                    placeholder="09171234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Dynamic Category-Specific Information */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-6">
              {/* 1. MEDICINES ASSISTANCE FORM */}
              {(selectedCategory === 'Medicines Assistance' || selectedCategory === 'Medical Assistance') && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Patient & Prescription Information
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter patient clinical details, medical diagnosis, and authorized pharmacy for medicine price quotations.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Full name as indicated on Medical Certificate"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hospital, Clinic, or Health Center Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={hospitalClinic}
                        onChange={(e) => setHospitalClinic(e.target.value)}
                        placeholder="e.g. Western Visayas Medical Center"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Attending Physician / Doctor
                      </label>
                      <input
                        type="text"
                        value={attendingPhysician}
                        onChange={(e) => setAttendingPhysician(e.target.value)}
                        placeholder="e.g. Dr. Maria Santos, MD"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medical Diagnosis / Indication <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter medical diagnosis or illness details from the Medical Certificate"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Authorized Pharmacy / Drugstore for Quotation <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    >
                      <option value="Oriental 21 Pharmacy">Oriental 21 Pharmacy</option>
                      <option value="Generika Drugstore">Generika Drugstore</option>
                      <option value="Mercury Drug">Mercury Drug</option>
                      <option value="Other Authorized Local Pharmacy">Other Authorized Local Pharmacy</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Price quotation must come from an authorized pharmacy and be officially itemized.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Estimated Prescription Cost / Amount Requested (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmountRequested}
                        onChange={(e) => setTotalAmountRequested(e.target.value)}
                        placeholder="e.g. 12500"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasDistrictReferral}
                          onChange={(e) => setHasDistrictReferral(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Office requested a <strong>Referral Letter from the 2nd District</strong>
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* 2. LABORATORY ASSISTANCE FORM */}
              {selectedCategory === 'Laboratory Assistance' && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Patient & Diagnostic Laboratory Information
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter patient clinical details, diagnostic procedure requested, and laboratory facility.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Full name as indicated on Medical Certificate"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hospital, Clinic, or Diagnostic Center <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={hospitalClinic}
                        onChange={(e) => setHospitalClinic(e.target.value)}
                        placeholder="e.g. Western Visayas Medical Center"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Attending Physician / Doctor
                      </label>
                      <input
                        type="text"
                        value={attendingPhysician}
                        onChange={(e) => setAttendingPhysician(e.target.value)}
                        placeholder="e.g. Dr. Maria Santos, MD"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Diagnostic Procedure or Test Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={labProcedureName}
                      onChange={(e) => setLabProcedureName(e.target.value)}
                      placeholder="e.g. MRI Lumbar Spine, CT Scan Cranial, Blood Chemistry, Ultrasound, Biopsy"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medical Diagnosis / Clinical Indication <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter physician's diagnosis or reason for laboratory procedure"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={labRequiresPayment}
                        onChange={(e) => setLabRequiresPayment(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">Requires Price Quotation</span>
                        <span className="text-slate-500">Diagnostic facility requires a fee breakdown or quotation.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={labGuaranteeLetterFacility}
                        onChange={(e) => setLabGuaranteeLetterFacility(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">Facility Accepts Guarantee Letter (GL)</span>
                        <span className="text-slate-500">Attach facility acceptance letter for DSWD Guarantee Letter.</span>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Estimated Laboratory Cost / Amount Requested (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmountRequested}
                        onChange={(e) => setTotalAmountRequested(e.target.value)}
                        placeholder="e.g. 18000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasDistrictReferral}
                          onChange={(e) => setHasDistrictReferral(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Office requested a <strong>Referral Letter from the 2nd District</strong>
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* 3. HOSPITAL BILL ASSISTANCE FORM */}
              {(selectedCategory === 'Hospital Bill Assistance' || selectedCategory === 'Hospital Assistance') && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Patient & Hospital Confinement Details
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter patient confinement status, hospital billing records, and clinical information.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Full name as indicated on Medical Certificate"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hospital or Medical Center Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={hospitalClinic}
                        onChange={(e) => setHospitalClinic(e.target.value)}
                        placeholder="e.g. Western Visayas Medical Center"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Attending Physician / Doctor
                      </label>
                      <input
                        type="text"
                        value={attendingPhysician}
                        onChange={(e) => setAttendingPhysician(e.target.value)}
                        placeholder="e.g. Dr. Maria Santos, MD"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medical Diagnosis / Reason for Confinement <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter primary medical diagnosis or condition from hospital records"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hospital Confinement Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={hospitalConfinementStatus}
                      onChange={(e) => setHospitalConfinementStatus(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    >
                      <option value="currently_confined">
                        Currently Confined (Hospital records marked "UP TO PRESENT")
                      </option>
                      <option value="discharged_with_balance">
                        Discharged with Balance (Signed Promissory Note + Certificate of Balance)
                      </option>
                      <option value="discharged_outstanding">
                        Discharged with Outstanding Balance (Certificate of Balance)
                      </option>
                      <option value="general_billing">Standard Inpatient Hospital Bill</option>
                    </select>
                  </div>

                  {hospitalConfinementStatus === 'currently_confined' && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold">Patient is currently confined in the hospital.</p>
                        <p className="text-blue-800/90 leading-relaxed">
                          Final bill and discharge documents may not yet be available. Submit all available hospital billing records marked as <strong>UP TO PRESENT</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer bg-slate-50/50">
                    <input
                      type="checkbox"
                      checked={hadSurgicalOperation}
                      onChange={(e) => setHadSurgicalOperation(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 block">
                        Patient Underwent Operation or Surgical Procedure
                      </span>
                      <span className="text-slate-500">
                        Check this if patient had surgery, operation, or major procedure. An <strong>Original Clinical Abstract</strong> will be required.
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Estimated Hospital Bill Balance / Amount Requested (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmountRequested}
                        onChange={(e) => setTotalAmountRequested(e.target.value)}
                        placeholder="e.g. 35000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasDistrictReferral}
                          onChange={(e) => setHasDistrictReferral(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Office requested a <strong>Referral Letter from the 2nd District</strong>
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* 4. EDUCATIONAL ASSISTANCE FORM */}
              {selectedCategory === 'Educational Assistance' && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Student & Academic Information
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter student details, school or university, academic level, and tuition breakdown.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Student Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Full name of the enrolled student"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        School / College / University Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="e.g. Western Visayas State University"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Academic Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={educationLevel}
                        onChange={(e) => setEducationLevel(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Elementary">Elementary School</option>
                        <option value="Junior High School">Junior High School</option>
                        <option value="Senior High School">Senior High School</option>
                        <option value="College / University">College / University</option>
                        <option value="Vocational / Technical (TESDA)">Vocational / Technical (TESDA)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Course / Degree Program & Year Level or Grade <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={courseOrYear}
                        onChange={(e) => setCourseOrYear(e.target.value)}
                        placeholder="e.g. BS Information Technology - 3rd Year (or Grade 11)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Student ID Number or LRN (Learner Reference Number)
                      </label>
                      <input
                        type="text"
                        value={studentIdNumber}
                        onChange={(e) => setStudentIdNumber(e.target.value)}
                        placeholder="e.g. 2023-01452 or 12-digit LRN"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tuition / Educational Expense Amount Requested (₱) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmountRequested}
                      onChange={(e) => setTotalAmountRequested(e.target.value)}
                      placeholder="e.g. 10000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Must match the remaining tuition or school assessment fee breakdown indicated on your Statement of Account.
                    </p>
                  </div>
                </>
              )}

              {/* 5. FINANCIAL ASSISTANCE FORM */}
              {selectedCategory === 'Financial Assistance' && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Beneficiary & Emergency Crisis Information
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter beneficiary details, type of emergency crisis, and reason for financial grant.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Beneficiary / Claimant Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Full name of beneficiary in need of emergency assistance"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Crisis / Assistance Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={financialCrisisType}
                        onChange={(e) => setFinancialCrisisType(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Emergency Family Crisis">Emergency Family Crisis (AICS)</option>
                        <option value="Sudden Loss of Income / Breadwinner">Sudden Loss of Income / Breadwinner</option>
                        <option value="Disaster / Calamity / Fire Affected">Disaster / Calamity / Fire Affected</option>
                        <option value="Transportation / Stranded Individual">Transportation / Stranded Individual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Current Source of Livelihood / Occupation
                      </label>
                      <input
                        type="text"
                        value={sourceOfLivelihood}
                        onChange={(e) => setSourceOfLivelihood(e.target.value)}
                        placeholder="e.g. Tricycle Driver, Daily Wage Worker, Informal Sector, Unemployed"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason for Financial Assistance / Circumstances of Crisis <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={financialReason}
                      onChange={(e) => setFinancialReason(e.target.value)}
                      placeholder="Briefly explain the emergency situation and how this cash aid will be utilized for immediate family relief"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Financial Aid Amount Requested (₱) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmountRequested}
                      onChange={(e) => setTotalAmountRequested(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </>
              )}

              {/* 6. BURIAL ASSISTANCE FORM */}
              {selectedCategory === 'Burial Assistance' && (
                <>
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm">
                        3
                      </span>
                      Deceased & Funeral Information
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Enter details of the deceased family member and funeral / mortuary provider.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Name of the Deceased <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={deceasedName}
                        onChange={(e) => setDeceasedName(e.target.value)}
                        placeholder="Full name of deceased family member"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date of Passing <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={dateOfPassing}
                        onChange={(e) => setDateOfPassing(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cause of Death / Place of Passing
                      </label>
                      <input
                        type="text"
                        value={causeOfDeath}
                        onChange={(e) => setCauseOfDeath(e.target.value)}
                        placeholder="e.g. Acute Myocardial Infarction / Residence"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Funeral Home / Mortuary / Cemetery Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={funeralHomeName}
                        onChange={(e) => setFuneralHomeName(e.target.value)}
                        placeholder="e.g. St. Peter Funeral Homes"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Funeral & Burial Expense Amount Requested (₱) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAmountRequested}
                        onChange={(e) => setTotalAmountRequested(e.target.value)}
                        placeholder="e.g. 15000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Step 4: Document Upload Cards */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      4
                    </span>
                    Document Uploads ({completedCount}/{totalCount})
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Upload clear photos or scanned copies (JPG, PNG, PDF up to 10MB).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  Save Draft
                </button>
              </div>

              {/* Document Cards List */}
              <div className="space-y-3.5">
                {requiredDocs.map((req, idx) => {
                  const uploaded = uploadedDocs.find(d => d.document_code === req.code);
                  const isUploaded = Boolean(uploaded);

                  return (
                    <div
                      key={req.code}
                      className={`p-4 rounded-2xl border transition-all ${
                        isUploaded
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                isUploaded
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isUploaded ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900">{req.name}</h4>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {req.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 pl-7">{req.description}</p>
                          {uploaded && (
                            <div className="text-[11px] text-slate-500 pl-7 flex items-center gap-2 pt-1">
                              <span className="font-medium text-slate-700">{uploaded.file_name}</span>
                              <span>•</span>
                              <span>{(uploaded.file_size / 1024).toFixed(0)} KB</span>
                              <span>•</span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                  uploaded.status === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : uploaded.status === 'Rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {uploaded.status}
                              </span>
                            </div>
                          )}
                          {uploaded?.remarks && (
                            <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg ml-7 mt-1 border border-rose-200">
                              Reviewer remarks: {uploaded.remarks}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 sm:self-center pl-7 sm:pl-0">
                          {isUploaded ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(uploaded)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerUpload(req.code, req.name)}
                                className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(uploaded.id, req.name)}
                                className="p-1.5 rounded-xl hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => triggerUpload(req.code, req.name)}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Checklist & Submission Guardrail (Right 4 Cols) */}
          <div className="lg:col-span-4 sticky top-20 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200/90 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                  Requirements Checklist
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    isComplete
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isComplete ? 'READY TO SUBMIT' : 'INCOMPLETE'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Document Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isComplete ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {completedCount} of {totalCount} mandatory documents uploaded.
                </p>
              </div>

              {/* Live Checklist Items */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {requiredDocs.map((req) => {
                  const uploaded = uploadedDocs.find(d => d.document_code === req.code);
                  const isUploaded = Boolean(uploaded);

                  return (
                    <div
                      key={req.code}
                      className={`flex items-start gap-2.5 p-2 rounded-xl text-xs ${
                        isUploaded
                          ? 'bg-emerald-50/50 text-emerald-900 font-medium'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {isUploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-snug">{req.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Submission Button Guardrail */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                {!isComplete ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      Submission Locked
                    </p>
                    <p className="text-[11px] text-amber-800">
                      The beneficiary cannot submit the final application until all required documents are uploaded.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <p className="font-semibold flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      All Requirements Satisfied
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      All required documents have been uploaded and verified for submission.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={!isComplete || actionLoading}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    isComplete && !actionLoading
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actionLoading ? 'Processing...' : 'Submit Application'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY MEDICAL APPLICATIONS HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'my-applications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Submitted Applications</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Track verification progress, review feedback, or provide additional requirements requested by staff.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : myApplications.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Applications Submitted Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                You haven't submitted any assistance applications yet. Click below to apply for Medical, Hospital, Educational, Financial, or Burial assistance.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('apply')}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md"
              >
                + Start New Application
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myApplications.map((app) => {
                const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.Draft;
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:border-blue-300 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                            {app.application_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bg}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusCfg.label}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{app.category}</h3>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Requested Amount</span>
                        <span className="text-lg font-black text-slate-900">
                          ₱{Number(app.total_amount_requested || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Patient & Hospital Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 bg-slate-50/60 p-3.5 rounded-2xl">
                      <div>
                        <span className="font-semibold text-slate-500 block mb-0.5">Patient Name</span>
                        <span className="font-bold text-slate-900">{app.patient_name}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500 block mb-0.5">Facility / Provider</span>
                        <span className="font-bold text-slate-900">{app.hospital_or_clinic_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500 block mb-0.5">Representative</span>
                        <span className="font-bold text-slate-900">
                          {app.representative_name || 'Self'} ({app.applicant_relationship})
                        </span>
                      </div>
                    </div>

                    {/* Additional Requirements or Rejection Alerts */}
                    {app.status === 'For Additional Requirements' && (
                      <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs text-orange-900">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          Action Required: Additional Documents Requested
                        </div>
                        <p className="text-xs text-orange-900/90 leading-relaxed">
                          {app.additional_requirements_notes}
                        </p>
                      </div>
                    )}

                    {(app.status === 'Approved' || app.status === 'Released') && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Application {app.status === 'Released' ? 'Grant Released' : 'Approved'}
                          </div>
                          <p className="text-xs text-emerald-900/90 leading-relaxed">
                            Approved grant: <strong>₱{Number(app.approved_amount || app.total_amount_requested || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                            {app.assistance_type_granted && ` (${app.assistance_type_granted})`}.
                          </p>
                          {app.staff_remarks && (
                            <p className="text-xs text-slate-600 italic">Notes: {app.staff_remarks}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/my-benefits')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0 transition"
                        >
                          <HandHeart className="w-3.5 h-3.5" />
                          View in My Assistance
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {app.status === 'Rejected' && (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          Application Rejected
                        </div>
                        <p className="text-xs text-rose-900/90 leading-relaxed">
                          Reason: {app.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Document checklist summary pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-slate-500">Submitted Documents:</span>
                      {(app.Documents || []).map((doc) => (
                        <span
                          key={doc.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          {doc.document_name}
                        </span>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
                      <span>
                        Submitted: {app.created_at || app.createdAt ? new Date(app.created_at || app.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          populateFormFromApp(app);
                          setActiveTab('apply');
                        }}
                        className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                      >
                        View / Edit Application
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE DOCUMENT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{previewDoc.document_name}</h3>
                <p className="text-xs text-slate-500">{previewDoc.file_name} • {(previewDoc.file_size / 1024).toFixed(0)} KB</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`http://localhost:5000/${previewDoc.file_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
              {previewDoc.mime_type?.includes('pdf') || previewDoc.file_name?.endsWith('.pdf') ? (
                <iframe
                  src={`http://localhost:5000/${previewDoc.file_path}`}
                  title={previewDoc.document_name}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={`http://localhost:5000/${previewDoc.file_path}`}
                  alt={previewDoc.document_name}
                  className="max-h-[65vh] object-contain rounded-xl shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
