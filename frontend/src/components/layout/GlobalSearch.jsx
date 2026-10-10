import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, X, Users, Package, HandHeart, FileHeart, Megaphone, Smartphone,
  BarChart3, UserCog, MessageSquare, Home, CalendarCheck, Bell, User,
  Building2, Sparkles, ArrowRight, CornerDownLeft, Loader2, MapPin, CheckCircle
} from 'lucide-react';
import { 
  beneficiaryApi, programApi, assistanceRequestApi, interventionApi, announcementApi 
} from '../../services/api';

// Navigation pages catalogue with roles and keywords
const ALL_PAGES = [
  {
    title: 'Dashboard Overview',
    description: 'System statistics, updates and overview',
    path: '/dashboard',
    icon: Home,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay', 'beneficiary'],
    keywords: ['home', 'overview', 'summary', 'main', 'stats']
  },
  {
    title: 'Official Beneficiary Records',
    description: '4Ps, Senior Citizens, PWD records and registry',
    path: '/dashboard/beneficiaries',
    icon: Users,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['beneficiaries', 'records', 'seniors', 'pwd', '4ps', 'members', 'citizens', 'registry']
  },
  {
    title: 'Benefit Programs Module',
    description: 'Municipal & national cash and non-cash assistance programs',
    path: '/dashboard/programs',
    icon: Package,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['programs', 'benefits', 'ayuda', 'grants', 'cash', 'non-cash', 'subsidies']
  },
  {
    title: 'Distribution & Ayuda Events',
    description: 'Payout schedules, venues, and RFID release tracking',
    path: '/dashboard/distributions',
    icon: Package,
    category: 'Navigation',
    roles: ['admin', 'staff', 'barangay'],
    keywords: ['distribution', 'events', 'payout', 'ayuda', 'release', 'cash assistance', 'venues']
  },
  {
    title: 'Assistance Requests',
    description: 'Review and manage medical, hospital, burial and financial requests',
    path: '/dashboard/assistance-requests',
    icon: HandHeart,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['assistance', 'requests', 'medical', 'hospital', 'financial', 'burial', 'educational', 'aics']
  },
  {
    title: 'Interventions Management',
    description: 'Verify and audit external aid from PhilHealth, PCSO, LGU and NGOs',
    path: '/dashboard/interventions-management',
    icon: FileHeart,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['interventions', 'external aid', 'philhealth', 'pcso', 'lgu', 'other agencies', 'verification']
  },
  {
    title: 'Barangay Directory & Demographics',
    description: 'Barangay distribution counts, totals and demographics',
    path: '/dashboard/barangays',
    icon: MapPin,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin'],
    keywords: ['barangays', 'barangay list', 'demographics', 'locations', 'areas']
  },
  {
    title: 'Announcements & Broadcasts',
    description: 'Community notices, payout advisories and meeting schedules',
    path: '/dashboard/announcements',
    icon: Megaphone,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['announcements', 'broadcast', 'notices', 'alerts', 'advisories', 'news']
  },
  {
    title: 'RFID Distribution Scanner',
    description: 'Scan beneficiary smart cards for benefit claim verification',
    path: '/dashboard/rfid-scanner',
    icon: Smartphone,
    category: 'Navigation',
    roles: ['staff', 'barangay'],
    keywords: ['rfid', 'scanner', 'tap card', 'claim', 'distribution scanner']
  },
  {
    title: 'RFID Attendance Scanner',
    description: 'Scan beneficiary RFID cards for meeting and event attendance',
    path: '/dashboard/rfid-attendance',
    icon: Smartphone,
    category: 'Navigation',
    roles: ['staff', 'barangay'],
    keywords: ['attendance scanner', 'rfid attendance', 'meeting scanner']
  },
  {
    title: 'Reports & Analytics',
    description: 'Audits, disbursement summaries and downloadable reports',
    path: '/dashboard/reports',
    icon: BarChart3,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay'],
    keywords: ['reports', 'analytics', 'charts', 'exports', 'audit', 'summary']
  },
  {
    title: 'User & Staff Accounts',
    description: 'Manage staff and beneficiary user accounts and credentials',
    path: '/dashboard/users',
    icon: UserCog,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff'],
    keywords: ['users', 'accounts', 'staff', 'roles', 'credentials', 'password']
  },
  {
    title: 'Messages & Inquiries',
    description: 'Two-way chat between staff and beneficiaries',
    path: '/dashboard/messages',
    icon: MessageSquare,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay', 'beneficiary'],
    keywords: ['messages', 'chat', 'inbox', 'conversations', 'inquiries']
  },
  {
    title: 'System Notifications',
    description: 'Review alerts, approvals, and system updates',
    path: '/dashboard/notifications',
    icon: Bell,
    category: 'Navigation',
    roles: ['admin', 'mswdo_admin', 'staff', 'barangay', 'beneficiary'],
    keywords: ['notifications', 'alerts', 'updates', 'unread']
  },
  // Beneficiary-specific routes
  {
    title: 'My Profile',
    description: 'View your beneficiary information, RFID card and household details',
    path: '/dashboard/my-profile',
    icon: User,
    category: 'Navigation',
    roles: ['beneficiary'],
    keywords: ['profile', 'my info', 'rfid', 'household', 'account']
  },
  {
    title: 'Request Assistance',
    description: 'Submit an assistance request for medical, hospital or financial aid',
    path: '/dashboard/request-assistance',
    icon: HandHeart,
    category: 'Navigation',
    roles: ['beneficiary'],
    keywords: ['request assistance', 'apply aid', 'financial aid', 'medical aid']
  },
  {
    title: 'My Benefits & Grants',
    description: 'Track your approved benefits, payout history and claims',
    path: '/dashboard/my-benefits',
    icon: Package,
    category: 'Navigation',
    roles: ['beneficiary'],
    keywords: ['my benefits', 'grants', 'claimed', 'payouts', 'allowance']
  },
  {
    title: 'My Interventions',
    description: 'Report and review assistance received from other government agencies',
    path: '/dashboard/my-interventions',
    icon: FileHeart,
    category: 'Navigation',
    roles: ['beneficiary'],
    keywords: ['my interventions', 'external aid', 'philhealth', 'pcso', 'report assistance']
  },
  {
    title: 'My Attendance History',
    description: 'View attended meetings, community sessions and assemblies',
    path: '/dashboard/attendance',
    icon: CalendarCheck,
    category: 'Navigation',
    roles: ['beneficiary'],
    keywords: ['attendance', 'meetings', 'sessions', 'assemblies']
  }
];

export default function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Live entity search results
  const [beneficiaryResults, setBeneficiaryResults] = useState([]);
  const [programResults, setProgramResults] = useState([]);
  const [assistanceResults, setAssistanceResults] = useState([]);
  const [interventionResults, setInterventionResults] = useState([]);

  // Cache to avoid aggressive re-fetches
  const dataCacheRef = useRef({
    beneficiaries: null,
    programs: null,
    assistance: null,
    interventions: null,
    lastFetched: 0,
  });

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const resultsContainerRef = useRef(null);

  const isAdminOrStaff = ['admin', 'mswdo_admin', 'staff', 'barangay'].includes(user?.role);

  // Filter allowed navigation pages based on user's role
  const allowedPages = useMemo(() => {
    if (!user) return [];
    return ALL_PAGES.filter((p) => p.roles.includes(user.role));
  }, [user]);

  // Matching pages
  const matchingPages = useMemo(() => {
    if (!query.trim()) {
      // If empty query, show up to 6 recommended quick navigation pages
      return allowedPages.slice(0, 6);
    }
    const q = query.toLowerCase().trim();
    return allowedPages.filter((p) => {
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchKeywords = p.keywords.some((kw) => kw.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchKeywords;
    });
  }, [query, allowedPages]);

  // Load backend data for searching
  const loadSearchData = useCallback(async () => {
    const now = Date.now();
    // Cache for 45 seconds
    if (now - dataCacheRef.current.lastFetched < 45000 && dataCacheRef.current.beneficiaries) {
      return dataCacheRef.current;
    }

    try {
      const promises = [];

      if (isAdminOrStaff) {
        promises.push(beneficiaryApi.list().catch(() => ({ data: { data: [] } })));
        promises.push(programApi.list().catch(() => ({ data: { data: [] } })));
        promises.push(assistanceRequestApi.list().catch(() => ({ data: { data: [] } })));
        promises.push(interventionApi.getAllInterventions().catch(() => ({ data: { data: [] } })));
      } else if (user?.role === 'beneficiary') {
        promises.push(interventionApi.getMyInterventions().catch(() => ({ data: { data: [] } })));
        promises.push(announcementApi.list().catch(() => ({ data: { data: [] } })));
      }

      const results = await Promise.all(promises);

      if (isAdminOrStaff) {
        dataCacheRef.current = {
          beneficiaries: results[0]?.data?.data || [],
          programs: results[1]?.data?.data || [],
          assistance: results[2]?.data?.data || [],
          interventions: results[3]?.data?.data || [],
          lastFetched: now,
        };
      } else {
        dataCacheRef.current = {
          interventions: results[0]?.data?.data || [],
          announcements: results[1]?.data?.data || [],
          lastFetched: now,
        };
      }

      return dataCacheRef.current;
    } catch (err) {
      console.warn('Search data load failed:', err);
      return dataCacheRef.current;
    }
  }, [isAdminOrStaff, user]);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setBeneficiaryResults([]);
      setProgramResults([]);
      setAssistanceResults([]);
      setInterventionResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const q = query.toLowerCase().trim();
      const cache = await loadSearchData();

      if (isAdminOrStaff) {
        // Beneficiaries matching
        const matchedBens = (cache.beneficiaries || []).filter((b) => {
          const name = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
          const hh = (b.household_id_number || '').toLowerCase();
          const code = (b.beneficiary_id_code || '').toLowerCase();
          const rfid = (b.RFID_number || '').toLowerCase();
          const cat = (b.category || '').toLowerCase();
          const brgy = (b.Barangay?.barangay_name || '').toLowerCase();
          return name.includes(q) || hh.includes(q) || code.includes(q) || rfid.includes(q) || cat.includes(q) || brgy.includes(q);
        }).slice(0, 5);

        // Programs matching
        const matchedProgs = (cache.programs || []).filter((p) => {
          const name = (p.name || '').toLowerCase();
          const cat = (p.eligibility_category || p.category || '').toLowerCase();
          const desc = (p.description || '').toLowerCase();
          return name.includes(q) || cat.includes(q) || desc.includes(q);
        }).slice(0, 4);

        // Assistance Requests matching
        const matchedAssist = (cache.assistance || []).filter((r) => {
          const subj = (r.subject || '').toLowerCase();
          const type = (r.type || '').toLowerCase();
          const desc = (r.description || '').toLowerCase();
          const bName = `${r.Beneficiary?.first_name || ''} ${r.Beneficiary?.last_name || ''}`.toLowerCase();
          return subj.includes(q) || type.includes(q) || desc.includes(q) || bName.includes(q);
        }).slice(0, 4);

        // Interventions matching
        const matchedInterv = (cache.interventions || []).filter((i) => {
          const agency = (i.agency_name || '').toLowerCase();
          const type = (i.assistance_type || '').toLowerCase();
          const bName = `${i.Beneficiary?.first_name || ''} ${i.Beneficiary?.last_name || ''}`.toLowerCase();
          const notes = (i.description || i.staff_notes || '').toLowerCase();
          return agency.includes(q) || type.includes(q) || bName.includes(q) || notes.includes(q);
        }).slice(0, 4);

        setBeneficiaryResults(matchedBens);
        setProgramResults(matchedProgs);
        setAssistanceResults(matchedAssist);
        setInterventionResults(matchedInterv);
      } else if (user?.role === 'beneficiary') {
        const matchedInterv = (cache.interventions || []).filter((i) => {
          const agency = (i.agency_name || '').toLowerCase();
          const type = (i.assistance_type || '').toLowerCase();
          return agency.includes(q) || type.includes(q);
        }).slice(0, 4);
        setInterventionResults(matchedInterv);
      }

      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, loadSearchData, isAdminOrStaff, user]);

  // Flatten active items for keyboard navigation
  const flattenedItems = useMemo(() => {
    const list = [];
    matchingPages.forEach((p) => list.push({ type: 'page', data: p }));
    beneficiaryResults.forEach((b) => list.push({ type: 'beneficiary', data: b }));
    programResults.forEach((p) => list.push({ type: 'program', data: p }));
    assistanceResults.forEach((a) => list.push({ type: 'assistance', data: a }));
    interventionResults.forEach((i) => list.push({ type: 'intervention', data: i }));
    return list;
  }, [matchingPages, beneficiaryResults, programResults, assistanceResults, interventionResults]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flattenedItems.length]);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K & Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Item activation
  const handleSelectItem = (item) => {
    if (!item) return;
    setIsOpen(false);
    setQuery('');

    if (item.type === 'page') {
      navigate(item.data.path);
    } else if (item.type === 'beneficiary') {
      navigate('/dashboard/beneficiaries', { state: { selectedBeneficiaryId: item.data.id } });
    } else if (item.type === 'program') {
      navigate('/dashboard/programs', { state: { selectedProgramId: item.data.id } });
    } else if (item.type === 'assistance') {
      navigate('/dashboard/assistance-requests', { state: { selectedRequestId: item.data.id } });
    } else if (item.type === 'intervention') {
      if (user?.role === 'beneficiary') {
        navigate('/dashboard/my-interventions');
      } else {
        navigate('/dashboard/interventions-management', { state: { selectedInterventionId: item.data.id } });
      }
    }
  };

  // Keyboard navigation within the search input
  const handleInputKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flattenedItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flattenedItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flattenedItems[selectedIndex]) {
        handleSelectItem(flattenedItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const hasAnyResults = flattenedItems.length > 0;

  return (
    <div className="relative w-80 max-w-xs sm:max-w-md hidden sm:block" ref={dropdownRef}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4.5 w-4.5 text-blue-500 animate-spin" />
          ) : (
            <Search className="h-4.5 w-4.5 text-slate-400" />
          )}
        </span>

        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            loadSearchData();
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Search anything..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-2 text-xs font-medium text-slate-700 outline-none transition focus:bg-white focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100 shadow-2xs"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              searchInputRef.current?.focus();
            }}
            className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-3.5 top-2.5 hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-400 pointer-events-none select-none">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown Results Panel */}
      {isOpen && (
        <div 
          ref={resultsContainerRef}
          className="absolute left-0 top-full mt-2 w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fadeIn"
          style={{ boxShadow: '0 16px 48px -4px rgba(15, 23, 42, 0.18)' }}
        >
          {/* Header pill indicator */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {query ? `Search results for "${query}"` : 'Quick Navigation & Modules'}
            </span>
            <span className="text-[10px] text-slate-400">
              {flattenedItems.length} {flattenedItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Results Scroll Area */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {!hasAnyResults && !isLoading && (
              <div className="py-10 text-center px-4">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No results found for "{query}"</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Try searching for a beneficiary name, barangay, program, agency, or module.
                </p>
              </div>
            )}

            {/* 1. Pages / Modules Section */}
            {matchingPages.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Navigation Pages</span>
                  <span>{matchingPages.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {matchingPages.map((page) => {
                    const idx = flattenedItems.findIndex((it) => it.type === 'page' && it.data.path === page.path);
                    const isSelected = idx === selectedIndex;
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.path}
                        type="button"
                        onClick={() => handleSelectItem({ type: 'page', data: page })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                          isSelected ? 'bg-blue-50 text-blue-900 font-semibold ring-1 ring-blue-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{page.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{page.description}</p>
                        </div>
                        <CornerDownLeft className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600 opacity-100' : 'opacity-0'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Beneficiaries Section */}
            {beneficiaryResults.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Beneficiaries</span>
                  <span>{beneficiaryResults.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {beneficiaryResults.map((ben) => {
                    const idx = flattenedItems.findIndex((it) => it.type === 'beneficiary' && it.data.id === ben.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`ben-${ben.id}`}
                        type="button"
                        onClick={() => handleSelectItem({ type: 'beneficiary', data: ben })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                          isSelected ? 'bg-amber-50 text-amber-900 font-semibold ring-1 ring-amber-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-xs">
                          {ben.first_name?.[0] || 'B'}{ben.last_name?.[0] || ''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {ben.first_name} {ben.last_name}
                            </p>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {ben.Barangay?.barangay_name || 'Barangay'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {ben.category || 'Beneficiary'} • ID: {ben.household_id_number || ben.beneficiary_id_code || `#${ben.id}`}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Benefit Programs Section */}
            {programResults.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Benefit Programs</span>
                  <span>{programResults.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {programResults.map((prog) => {
                    const idx = flattenedItems.findIndex((it) => it.type === 'program' && it.data.id === prog.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`prog-${prog.id}`}
                        type="button"
                        onClick={() => handleSelectItem({ type: 'program', data: prog })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                          isSelected ? 'bg-purple-50 text-purple-900 font-semibold ring-1 ring-purple-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{prog.name}</p>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {prog.status || 'Active'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {prog.eligibility_category || prog.category || 'Universal'}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Assistance Requests Section */}
            {assistanceResults.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Assistance Requests</span>
                  <span>{assistanceResults.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {assistanceResults.map((req) => {
                    const idx = flattenedItems.findIndex((it) => it.type === 'assistance' && it.data.id === req.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`assist-${req.id}`}
                        type="button"
                        onClick={() => handleSelectItem({ type: 'assistance', data: req })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                          isSelected ? 'bg-rose-50 text-rose-900 font-semibold ring-1 ring-rose-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                          <HandHeart className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{req.subject || req.type}</p>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              {req.status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {req.Beneficiary ? `${req.Beneficiary.first_name} ${req.Beneficiary.last_name}` : 'Beneficiary'} • {req.type}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Interventions Section */}
            {interventionResults.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>External Interventions</span>
                  <span>{interventionResults.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {interventionResults.map((interv) => {
                    const idx = flattenedItems.findIndex((it) => it.type === 'intervention' && it.data.id === interv.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`interv-${interv.id}`}
                        type="button"
                        onClick={() => handleSelectItem({ type: 'intervention', data: interv })}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                          isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{interv.agency_name}</p>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              interv.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {interv.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {interv.assistance_type} • {interv.Beneficiary ? `${interv.Beneficiary.first_name} ${interv.Beneficiary.last_name}` : ''}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer keyboard shortcuts hint */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">↓</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">↵</kbd> select</span>
              <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">esc</kbd> close</span>
            </span>
            <span className="font-semibold text-slate-500">BeniAid Search</span>
          </div>
        </div>
      )}
    </div>
  );
}

