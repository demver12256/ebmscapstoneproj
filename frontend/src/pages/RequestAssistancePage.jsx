import { useState, useEffect, useRef } from 'react';
import { assistanceRequestApi, beneficiaryApi } from '../services/api';
import { getRequirementsForType, parseAttachments } from '../utils/assistanceRequirements';
import {
  Building2, Landmark, HandHeart, HeartHandshake, Pill,
  FlaskConical, GraduationCap, Wallet, CheckCircle2, Clock,
  AlertCircle, XCircle, Check, ExternalLink, Eye, RefreshCw,
  AlertTriangle, ArrowRight, ShieldCheck, FileText,
  Paperclip, X, ChevronRight, Package
} from 'lucide-react';

const ASSISTANCE_TYPES = [
  {
    id: 'Medical Assistance',
    title: 'Medical & Medicines',
    filipinoTitle: 'Gamot at Maintenance',
    desc: 'Mga reseta, maintenance drugs, at gastusin sa botika.',
    icon: Pill,
  },
  {
    id: 'Hospital Assistance',
    title: 'Hospital Confinement',
    filipinoTitle: 'Ospital at Confinement',
    desc: 'Inpatient confinement, bayad sa doktor, o operasyon.',
    icon: Building2,
  },
  {
    id: 'Laboratory Assistance',
    title: 'Diagnostics & Lab',
    filipinoTitle: 'Laboratory at Pagsusuri',
    desc: 'X-Ray, CT Scan, ultrasound, blood chemistry, at ECG.',
    icon: FlaskConical,
  },
  {
    id: 'Educational Assistance',
    title: 'Educational Aid',
    filipinoTitle: 'Tulong Pang-edukasyon',
    desc: 'Matrikula, gamit sa paaralan, at student financial aid.',
    icon: GraduationCap,
  },
  {
    id: 'Financial Assistance',
    title: 'Financial Aid (AICS)',
    filipinoTitle: 'Pangkagipitang Ayuda',
    desc: 'Emergency cash assistance sa biglaang krisis.',
    icon: Wallet,
  },
  {
    id: 'Burial Assistance',
    title: 'Burial Assistance',
    filipinoTitle: 'Tulong sa Pagpapalibing',
    desc: 'Punerarya, kabaong, at tulong sa naulilang pamilya.',
    icon: HeartHandshake,
  },
  {
    id: 'Food & Relief Assistance',
    title: 'Food & Relief Goods',
    filipinoTitle: 'Ayuda sa Pagkain',
    desc: 'Emergency food packs at tulong relief goods.',
    icon: Package,
  },
  {
    id: 'Other',
    title: 'Other Assistance',
    filipinoTitle: 'Iba Pang Kahilingan',
    desc: 'Iba pang espesyal na tulong na hindi nakalista.',
    icon: HandHeart,
  },
];

const STATUS_CONFIG = {
  Pending: { label: 'Pending', icon: Clock, pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Under Review': { label: 'Under Review', icon: Eye, pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  Approved: { label: 'Approved', icon: CheckCircle2, pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Rejected: { label: 'Rejected', icon: XCircle, pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  Completed: { label: 'Completed', icon: ShieldCheck, pill: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function RequestAssistancePage() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('new-request'); // 'new-request' | 'my-requests'
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Beneficiary Profile Data
  const [beneficiary, setBeneficiary] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  // Filter state for "My Requests"
  const [filterAgency, setFilterAgency] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form State
  const [targetAgency, setTargetAgency] = useState('DSWD'); // 'DSWD' | 'MSWDO'
  const [selectedType, setSelectedType] = useState('Medical Assistance');
  const [priority, setPriority] = useState('Normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [recipientType, setRecipientType] = useState('self'); // 'self' | 'family'
  const [recipientName, setRecipientName] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('');
  const [requirementFiles, setRequirementFiles] = useState({}); // { [reqId]: File }
  const fileInputRefs = useRef({});

  // Notification Toast & View Modal
  const [toast, setToast] = useState(null);
  const [selectedRequestModal, setSelectedRequestModal] = useState(null);

  // Beneficiary Category details
  const benCategory = beneficiary?.category || '';
  const is4Ps = benCategory.toLowerCase().includes('4ps') || benCategory.toLowerCase().includes('pantawid');
  const isSenior = benCategory.toLowerCase().includes('senior');
  const isPwd = benCategory.toLowerCase().includes('pwd') || benCategory.toLowerCase().includes('disabilit');

  // Load Beneficiary & Requests
  useEffect(() => {
    loadData();
  }, []);

  // When beneficiary is loaded, auto-select agency if category is 4Ps
  useEffect(() => {
    if (is4Ps) {
      setTargetAgency('DSWD');
    } else if (isSenior || isPwd) {
      setTargetAgency('MSWDO');
    }
  }, [beneficiary, is4Ps, isSenior, isPwd]);

  const loadData = async () => {
    try {
      const [benRes, reqsRes] = await Promise.all([
        beneficiaryApi.getMe().catch(() => ({ data: { data: null } })),
        assistanceRequestApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      setBeneficiary(benRes.data?.data || null);
      setMyRequests(reqsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const reloadRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await assistanceRequestApi.list();
      setMyRequests(res.data?.data || []);
    } catch (err) {
      console.error('Failed to reload requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Check if current beneficiary already has a pending/under review request for selectedType in DSWD
  const sameAgencyPendingRequest = myRequests.find(
    (r) => r.type === selectedType && r.agency === 'DSWD' && ['Pending', 'Under Review'].includes(r.status)
  );

  const currentRequirements = getRequirementsForType(selectedType);

  const handleRequirementFileChange = (reqId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setToast({
        type: 'error',
        text: `Hindi suportado ang format ng "${file.name}". JPG, PNG, at PDF lamang ang pinapayagan.`,
      });
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setToast({
        type: 'error',
        text: `Masyadong malaki ang "${file.name}" (hanggang 10MB lamang bawat file).`,
      });
      e.target.value = '';
      return;
    }

    setRequirementFiles((prev) => ({
      ...prev,
      [reqId]: file,
    }));
  };

  const handleRemoveRequirementFile = (reqId) => {
    setRequirementFiles((prev) => {
      const updated = { ...prev };
      delete updated[reqId];
      return updated;
    });
    if (fileInputRefs.current[reqId]) {
      fileInputRefs.current[reqId].value = '';
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    if (!beneficiary) {
      setToast({ type: 'error', text: 'Hindi nahanap ang inyong profile. Mag-log in muli.' });
      return;
    }

    if (beneficiary.status !== 'Approved') {
      setToast({
        type: 'error',
        text: `Kasalukuyan pang ${beneficiary.status || 'Pending'} ang account. Kailangan itong maaprubahan muna.`,
      });
      return;
    }

    if (sameAgencyPendingRequest) {
      setToast({
        type: 'error',
        text: `Mayroon ka nang kasalukuyang kahilingan para sa "${selectedType}" sa DSWD na kasalukuyang ${sameAgencyPendingRequest.status}.`,
      });
      return;
    }

    if (!subject.trim()) {
      setToast({ type: 'error', text: 'Mangyaring ilagay ang pamagat o subject ng kahilingan.' });
      return;
    }

    if (!description.trim()) {
      setToast({ type: 'error', text: 'Mangyaring ilagay ang salaysay o dahilan ng kahilingan.' });
      return;
    }

    setSubmitting(true);
    try {
      let fullDescription = description.trim();

      if (recipientType === 'family') {
        const repInfo = `\n\n[BENEPISYARYO / PASYENTE]:\nPara sa Kapamilya: ${recipientName.trim() || 'N/A'}\nRelasyon: ${recipientRelation.trim() || 'N/A'}`;
        fullDescription += repInfo;
      }

      if (estimatedAmount && !isNaN(estimatedAmount)) {
        fullDescription += `\n\nTinatayang Halaga: ₱${Number(estimatedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
      }

      const formData = new FormData();
      formData.append('agency', 'DSWD');
      formData.append('type', selectedType);
      formData.append('subject', subject.trim());
      formData.append('description', fullDescription);
      formData.append('priority', priority);

      const attachedEntries = Object.entries(requirementFiles);
      if (attachedEntries.length > 0) {
        const metadata = [];
        attachedEntries.forEach(([reqId, file]) => {
          formData.append('attachments', file);
          const reqItem = currentRequirements?.requirements?.find((r) => r.id === reqId);
          metadata.push({
            reqId,
            reqName: reqItem?.filipinoName || reqItem?.name || reqId,
            originalName: file.name,
          });
        });
        formData.append('attachment_metadata', JSON.stringify(metadata));
        formData.append('attachment', attachedEntries[0][1]); // fallback
      }

      await assistanceRequestApi.create(formData);

      setToast({
        type: 'success',
        text: `Naipadala ang kahilingan sa ${targetAgency === 'DSWD' ? 'DSWD (National)' : 'MSWDO (Municipal)'}.`,
      });

      // Reset form
      setSubject('');
      setDescription('');
      setEstimatedAmount('');
      setRecipientType('self');
      setRecipientName('');
      setRecipientRelation('');
      setRequirementFiles({});
      Object.keys(fileInputRefs.current).forEach((k) => {
        if (fileInputRefs.current[k]) fileInputRefs.current[k].value = '';
      });

      await reloadRequests();
      setActiveTab('my-requests');
    } catch (err) {
      console.error('Failed to submit assistance request:', err);
      const msg = err.response?.data?.message || 'Hindi naisumite ang kahilingan. Pakisubukan muli.';
      setToast({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = myRequests.filter((req) => {
    if (filterAgency !== 'all' && req.agency !== filterAgency) return false;
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border flex items-center justify-between gap-3 shadow-lg max-w-sm transition-all ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : toast.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Minimalist Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block mb-1">
            Social Welfare Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Request Assistance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pumili ng tanggapan (DSWD o MSWDO) at magsumite ng kahilingan sa ayuda.
          </p>
        </div>

        {/* Minimalist Tab Control */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('new-request')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'new-request'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mag-apply (New Request)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-requests')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'my-requests'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Aking mga Request</span>
            {myRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                {myRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Beneficiary Mini Status Strip */}
      {beneficiary && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {beneficiary.first_name} {beneficiary.last_name}
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
              {beneficiary.category || 'Beneficiary'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {beneficiary.Barangay?.barangay_name || 'Barangay Residente'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Account:</span>
            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
              beneficiary.status === 'Approved' ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                beneficiary.status === 'Approved' ? 'bg-emerald-600' : 'bg-amber-600'
              }`} />
              {beneficiary.status || 'Pending'}
            </span>
          </div>
        </div>
      )}

      {/* Conditional Warning if Account Not Approved */}
      {beneficiary && beneficiary.status !== 'Approved' && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Pansamantalang Naka-lock:</strong> Ang inyong beneficiary registration ay kasalukuyan pang{' '}
            <em>{beneficiary.status || 'Pending'}</em>. Maaari nang mag-submit kapag na-aprubahan na ng barangay o admin.
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: NEW REQUEST FORM (MINIMALIST)                                      */}
      {/* ========================================================================= */}
      {activeTab === 'new-request' && (
        <form onSubmit={handleSubmitRequest} className="space-y-8">
          {/* SECTION 1: TARGET OFFICE - DSWD ONLY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Tanggapan (Office)
              </label>
            </div>

            {/* DSWD Only Notice */}
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    DSWD Office (Department of Social Welfare and Development)
                  </h3>
                  <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 mb-2">
                    National Agency (Pambansa)
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Lahat ng request assistance ay direktang ipapasa sa DSWD para sa review at approval. 
                    Para sa 4Ps, AICS emergency financial grant, at tulong-medikal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ASSISTANCE CATEGORY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Uri ng Tulong (Assistance Type)
              </label>
              <span className="text-[11px] text-slate-400">Piliin ang kaukulang tulong</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ASSISTANCE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                const hasCross = myRequests.some(
                  (r) => r.type === type.id && r.agency === 'DSWD' && r.status !== 'Rejected'
                );

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(type.id);
                      setRequirementFiles({});
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : hasCross
                        ? 'border-amber-200 bg-amber-50/40 text-slate-800 hover:border-amber-300'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-slate-200' : 'text-slate-500'}`} />
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : hasCross ? (
                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                             Nasa DSWD
                          </span>
                        ) : null}
                      </div>
                      <div className="font-semibold text-xs leading-tight">
                        {type.title}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        {type.filipinoTitle}
                      </div>
                    </div>

                    <p className={`text-[10px] mt-2 leading-relaxed line-clamp-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {type.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Real-Time Duplicate Warnings */}
            {sameAgencyPendingRequest && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Kasalukuyang Pinoproseso:</span>
                  Mayroon ka nang kahilingan para sa <strong>{selectedType}</strong> sa <strong>DSWD</strong> na kasalukuyang <strong>{sameAgencyPendingRequest.status}</strong>. Mangyaring hintayin muna itong maproseso bago magsumite muli.
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: DETAILS */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              3. Detalye ng Kahilingan
            </label>

            {/* Recipient & Priority Segmented Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recipient Segmented Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600 block">
                  Para kanino ang tulong?
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setRecipientType('self')}
                    className={`py-1.5 px-3 rounded-lg text-center transition-all ${
                      recipientType === 'self'
                        ? 'bg-white text-slate-900 font-semibold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aking Sarili
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('family')}
                    className={`py-1.5 px-3 rounded-lg text-center transition-all ${
                      recipientType === 'family'
                        ? 'bg-white text-slate-900 font-semibold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kapamilya / Dependent
                  </button>
                </div>
              </div>

              {/* Priority Segmented Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600 block">
                  Antas ng Pangangailangan (Priority)
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium">
                  {['Normal', 'High', 'Urgent'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                        priority === p
                          ? 'bg-white text-slate-900 font-semibold shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* If for family member */}
            {recipientType === 'family' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Pangalan ng Kapamilya / Pasyente:
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Hal. Juan Dela Cruz Jr."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Relasyon sa Benepisyaryo:
                  </label>
                  <input
                    type="text"
                    value={recipientRelation}
                    onChange={(e) => setRecipientRelation(e.target.value)}
                    placeholder="Hal. Asawa, Anak, Magulang, Kapatid"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Subject Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 block">
                Pamagat ng Kahilingan (Subject): <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Hal. Kahilingan para sa gamot sa altapresyon, Hospital bill sa Pampanga Hospital, atbp."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Estimated Amount (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 block">
                Tinatayang Halaga na Kailangan (Opsyonal):
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">₱</span>
                <input
                  type="number"
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  placeholder="Hal. 5,000"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Description Textarea */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 block">
                Paliwanag o Salaysay ng Pangangailangan: <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ilahad nang maikli ang sitwasyon at bakit kinakailangan ang tulong..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 leading-relaxed"
              />
            </div>
          </div>

          {/* SECTION 4: KADA REQUIREMENT MAY ATTACH FILE SA DULO (MAGKAKAHIWALAY) */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-700" />
                  <span>4. Mga Kinakailangang Dokumento (Attach Files Bawat Requirement)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  I-attach ang kaukulang file sa dulo ng bawat requirement (Magkakahiwalay):
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full w-fit">
                {Object.keys(requirementFiles).length} sa {currentRequirements?.requirements?.length || 0} naka-attach
              </span>
            </div>

            {/* LIST OF REQUIREMENTS WITH INDIVIDUAL ATTACH FILE BUTTON AT THE END */}
            {currentRequirements && currentRequirements.requirements?.length > 0 && (
              <div className="space-y-2">
                {currentRequirements.requirements.map((reqItem, idx) => {
                  const attachedFile = requirementFiles[reqItem.id];
                  return (
                    <div
                      key={reqItem.id || idx}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        attachedFile
                          ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50/70 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full font-bold flex items-center justify-center shrink-0 text-xs mt-0.5 ${
                            attachedFile
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {attachedFile ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {reqItem.filipinoName || reqItem.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                reqItem.mandatory
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {reqItem.tag || (reqItem.mandatory ? 'Kailangan' : 'Suporta')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            {reqItem.description}
                          </p>
                        </div>
                      </div>

                      {/* DULO: INDIVIDUAL ATTACH FILE BUTTON O ATTACHED FILE CHIP */}
                      <div className="sm:shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <input
                          ref={(el) => (fileInputRefs.current[reqItem.id] = el)}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => handleRequirementFileChange(reqItem.id, e)}
                          className="hidden"
                        />

                        {attachedFile ? (
                          <div className="flex items-center gap-2 bg-white border border-emerald-300 px-3 py-1.5 rounded-xl shadow-xs text-xs">
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span
                              className="font-semibold text-slate-900 max-w-[150px] truncate"
                              title={attachedFile.name}
                            >
                              {attachedFile.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({(attachedFile.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRequirementFile(reqItem.id)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 ml-1 transition-colors cursor-pointer"
                              title="Alisin ang kalakip na dokumento"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[reqItem.id]?.click()}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-semibold text-xs border border-slate-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                            <span>Attach File</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* POLICY GUIDANCE REMINDER */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-800">💡 Paalala:</strong> Hindi kailangang makumpleto agad ang lahat ng online attachments upang maipasa ang request. Maaaring i-submit ang application at dalhin ang pisikal na kopya ng mga dokumento sa tanggapan ng{' '}
              <span className="font-semibold text-slate-900">
                {targetAgency === 'DSWD' ? 'DSWD (National Office)' : 'MSWDO (Municipal Social Welfare)'}
              </span>{' '}
              kapag ipinatawag para sa verification at releasing.
            </div>
          </div>

          {/* MINIMALIST SUBMIT ACTION */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Ipadadala sa:{' '}
              <strong className="text-slate-900">
                {targetAgency === 'DSWD' ? 'DSWD (National Office)' : 'MSWDO (Municipal Office)'}
              </strong>{' '}
              • {selectedType}
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                (beneficiary && beneficiary.status !== 'Approved') ||
                !!sameAgencyPendingRequest
              }
              className={`px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                submitting ||
                (beneficiary && beneficiary.status !== 'Approved') ||
                !!sameAgencyPendingRequest
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ipinapadala...</span>
                </>
              ) : sameAgencyPendingRequest ? (
                <span>Kasalukuyan pang {sameAgencyPendingRequest.status}</span>
              ) : (
                <>
                  <span>Isumite sa DSWD</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY REQUESTS (MINIMALIST)                                           */}
      {/* ========================================================================= */}
      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-900">
              Listahan ng Aking mga Request ({filteredRequests.length})
            </span>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={filterAgency}
                onChange={(e) => setFilterAgency(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white focus:outline-none"
              >
                <option value="all">Lahat ng Opisina</option>
                <option value="DSWD">DSWD</option>
                <option value="MSWDO">MSWDO</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white focus:outline-none"
              >
                <option value="all">Lahat ng Status</option>
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Completed">Completed</option>
              </select>

              <button
                type="button"
                onClick={reloadRequests}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                title="I-refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* List or Empty State */}
          {loadingRequests ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
              Kinukuha ang mga kahilingan...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 border border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="font-medium text-slate-700 mb-1">Walang kahilingan para sa filter na ito.</p>
              <button
                type="button"
                onClick={() => setActiveTab('new-request')}
                className="text-slate-900 font-semibold underline mt-2 inline-block"
              >
                Magsumite ng Bagong Kahilingan →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.Pending;
                const isMswdo = req.agency === 'MSWDO';

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          #{req.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isMswdo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {isMswdo ? 'MSWDO (Municipal)' : 'DSWD (National)'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {req.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">
                          {formatDate(req.created_at)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusCfg.pill}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{req.subject}</h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                        {req.description}
                      </p>
                    </div>

                    {/* Claimable Banner */}
                    {['Approved', 'Completed'].includes(req.status) && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎉</span>
                          <div>
                            <span className="text-emerald-900 font-bold block">
                              Handa nang I-claim sa tanggapan ng {req.agency}
                            </span>
                            <span className="text-[11px] text-emerald-700 block mt-0.5">
                              Dalhin ang iyong <strong>Valid ID</strong> at <strong>RFID Card</strong>. Susuriin ng Admin ang iyong Valid ID bago i-tap ang RFID card para sa pag-release.
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded uppercase shrink-0">
                          Claimable
                        </span>
                      </div>
                    )}

                    {/* Admin Notes / Remarks Banner */}
                    {req.admin_notes && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border-l-2 border-slate-800 text-xs text-slate-700 space-y-0.5">
                        <span className="font-semibold text-slate-900 block text-[11px]">
                          Tugon mula sa Tanggapan:
                        </span>
                        <p className="whitespace-pre-wrap text-slate-600">{req.admin_notes}</p>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div>
                        {req.attachment_url && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {parseAttachments(req.attachment_url).map((att, attIdx) => (
                              <a
                                key={attIdx}
                                href={att.url?.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span className="max-w-[120px] truncate">{att.name}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedRequestModal(req)}
                        className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-0.5 text-[11px]"
                      >
                        <span>Detalye</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REQUEST DETAIL MODAL (MINIMALIST) */}
      {selectedRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl overflow-hidden border border-slate-200 text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  #{selectedRequestModal.id}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedRequestModal.agency === 'MSWDO'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {selectedRequestModal.agency === 'MSWDO' ? 'MSWDO' : 'DSWD'}
                </span>
                <span className="font-bold text-slate-900 text-sm truncate max-w-[200px]">
                  {selectedRequestModal.subject}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Tanggapan</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRequestModal.agency === 'MSWDO' ? 'MSWDO (Municipal)' : 'DSWD (National)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Katayuan (Status)</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRequestModal.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Uri ng Tulong</span>
                  <span className="font-semibold text-slate-900">{selectedRequestModal.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Petsa ng Pagsusumite</span>
                  <span className="font-semibold text-slate-900">{formatDate(selectedRequestModal.created_at)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] mb-1">Buong Salaysay</span>
                <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 whitespace-pre-wrap leading-relaxed text-slate-800">
                  {selectedRequestModal.description}
                </p>
              </div>

              {selectedRequestModal.admin_notes && (
                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Tagubilin mula sa Admin</span>
                  <p className="p-3 rounded-xl bg-slate-50 border-l-2 border-slate-900 whitespace-pre-wrap leading-relaxed text-slate-800">
                    {selectedRequestModal.admin_notes}
                  </p>
                </div>
              )}

              {/* Category requirements checklist in modal */}
              {(() => {
                const reqsConfig = getRequirementsForType(selectedRequestModal.type);
                if (!reqsConfig || !reqsConfig.requirements) return null;
                return (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
                      Mga Kinakailangang Dokumento para sa {selectedRequestModal.type}:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-700">
                      {reqsConfig.requirements.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-slate-400">•</span>
                          <span>
                            <strong>{item.filipinoName || item.name}</strong>{' '}
                            <span className="text-slate-400">({item.tag})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Uploaded Documents List */}
              {selectedRequestModal.attachment_url && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
                    Mga Kalakip na Dokumento:
                  </span>
                  <div className="space-y-1.5">
                    {parseAttachments(selectedRequestModal.attachment_url).map((att, attIdx) => (
                      <div
                        key={attIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium text-slate-900 truncate">
                            {att.name}
                          </span>
                        </div>
                        <a
                          href={att.url?.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-slate-900 hover:underline shrink-0 text-[11px] inline-flex items-center gap-1"
                        >
                          <span>Buksan</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequestModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors"
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
