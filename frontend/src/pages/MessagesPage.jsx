import { useEffect, useState, useRef } from 'react';
import { messageApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, Send, Search, Users, ArrowLeft, Circle, 
  ShieldCheck, Building2, UserCheck, MessageCircle, Sparkles,
  Archive, Trash2, RotateCcw, Info, CheckCircle2, AlertTriangle
} from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('conversations'); // 'conversations' | 'contacts' | 'archived'
  const [beneficiaryStatus, setBeneficiaryStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check beneficiary approval status
  useEffect(() => {
    const checkStatus = async () => {
      if (user?.role === 'beneficiary') {
        try {
          const { beneficiaryApi } = await import('../services/api');
          const res = await beneficiaryApi.getMe();
          setBeneficiaryStatus(res.data.data?.status || 'Pending Submission');
        } catch (err) {
          console.error('Failed to fetch beneficiary status:', err);
        }
      }
    };
    checkStatus();
  }, [user]);

  // Load conversations and contacts on mount
  useEffect(() => {
    loadConversations();
    loadContacts();
  }, []);

  // Poll for new messages every 4 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (selectedPartner) {
        loadMessages(selectedPartner.id, true, isArchivedView);
      }
      loadConversations(true);
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [selectedPartner, isArchivedView]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async (silent = false) => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        messageApi.conversations(),
        messageApi.conversations({ archived: true }),
      ]);
      const list = activeRes.data.data || [];
      const archivedList = archivedRes.data.data || [];
      setConversations(list);
      setArchivedConversations(archivedList);

      // If beneficiary has no conversations yet and not in archived view, default tab to contacts
      if (user?.role === 'beneficiary' && list.length === 0 && !selectedPartner && activeTab !== 'archived') {
        setActiveTab('contacts');
      }
    } catch (err) {
      if (!silent) console.error('Failed to load conversations:', err);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await messageApi.contacts();
      setContacts(res.data.data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadMessages = async (partnerId, silent = false, archived = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await messageApi.getMessages(partnerId, archived ? { archived: true } : {});
      setMessages(res.data.data || []);
      // Notify sidebar of read status update
      window.dispatchEvent(new Event('messagesUpdated'));
    } catch (err) {
      if (!silent) console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const selectPartner = (partner, archived = false) => {
    setSelectedPartner(partner);
    setIsArchivedView(archived);
    loadMessages(partner.id, false, archived);
  };

  const handleDeleteConversation = async () => {
    if (!selectedPartner) return;
    setDeleting(true);
    try {
      await messageApi.archiveConversation(selectedPartner.id);
      showToast(`Conversation with ${selectedPartner.first_name} has been safely archived.`);
      setShowDeleteModal(false);
      setSelectedPartner(null);
      await loadConversations(true);
      window.dispatchEvent(new Event('messagesUpdated'));
    } catch (err) {
      console.error('Failed to archive conversation:', err);
      showToast('Failed to archive conversation. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreConversation = async (partnerId) => {
    setRestoring(true);
    try {
      await messageApi.restoreConversation(partnerId);
      showToast('Conversation restored to Recent Chats.');
      setIsArchivedView(false);
      setActiveTab('conversations');
      await loadConversations(true);
      if (selectedPartner && selectedPartner.id === partnerId) {
        await loadMessages(partnerId, false, false);
      }
      window.dispatchEvent(new Event('messagesUpdated'));
    } catch (err) {
      console.error('Failed to restore conversation:', err);
      showToast('Failed to restore conversation.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await messageApi.archiveMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      await loadConversations(true);
      window.dispatchEvent(new Event('messagesUpdated'));
      showToast('Message archived.', 'success');
    } catch (err) {
      console.error('Failed to archive message:', err);
      showToast('Failed to archive message.', 'error');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPartner) return;
    setSending(true);
    try {
      await messageApi.send({
        receiver_id: selectedPartner.id,
        content: newMessage.trim(),
      });
      setNewMessage('');
      if (isArchivedView) {
        setIsArchivedView(false);
        setActiveTab('conversations');
      }
      await loadMessages(selectedPartner.id, true, false);
      await loadConversations(true);
      window.dispatchEvent(new Event('messagesUpdated'));
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const getRoleBadge = (role, brgyName) => {
    if (['admin','mswdo_admin'].includes(role)) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          System Administrator
        </span>
      );
    }
    if (role === 'staff') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          <Building2 className="w-3 h-3 text-blue-600" />
          {brgyName ? `Barangay Staff • ${brgyName}` : 'Barangay Staff'}
        </span>
      );
    }
    if (role === 'barangay') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          <Building2 className="w-3 h-3 text-amber-600" />
          {brgyName ? `Barangay Official • ${brgyName}` : 'Barangay Official'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        <UserCheck className="w-3 h-3 text-emerald-600" />
        Beneficiary
      </span>
    );
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  // Filter contacts based on search
  const filteredContacts = contacts.filter((c) => {
    if (!c) return false;
    const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const role = (c.role || '').toLowerCase();
    const brgy = (c.Barangay?.barangay_name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return name.includes(term) || role.includes(term) || brgy.includes(term) || email.includes(term);
  });

  // Filter active conversation list
  const filteredConversations = conversations.filter((c) => {
    if (!c?.partner) return false;
    const name = `${c.partner.first_name || ''} ${c.partner.last_name || ''}`.toLowerCase();
    const role = (c.partner.role || '').toLowerCase();
    const brgy = (c.partner.Barangay?.barangay_name || '').toLowerCase();
    const lastMsg = (c.lastMessage || '').toLowerCase();
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return name.includes(term) || role.includes(term) || brgy.includes(term) || lastMsg.includes(term);
  });

  // Filter archived conversation list
  const filteredArchivedConversations = archivedConversations.filter((c) => {
    if (!c?.partner) return false;
    const name = `${c.partner.first_name || ''} ${c.partner.last_name || ''}`.toLowerCase();
    const role = (c.partner.role || '').toLowerCase();
    const brgy = (c.partner.Barangay?.barangay_name || '').toLowerCase();
    const lastMsg = (c.lastMessage || '').toLowerCase();
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return name.includes(term) || role.includes(term) || brgy.includes(term) || lastMsg.includes(term);
  });

  const canMessage = user && ['admin', 'mswdo_admin', 'staff', 'barangay', 'beneficiary'].includes(user.role);

  if (!canMessage) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Messaging Not Available</h2>
          <p className="text-sm text-slate-500">Please sign in to access messages.</p>
        </div>
      </div>
    );
  }

  if (user?.role === 'beneficiary' && beneficiaryStatus && beneficiaryStatus !== 'Approved') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Registration Pending Approval</h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Messaging will become available once your beneficiary registration is reviewed and approved by your Barangay Staff.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-xl border border-amber-200">
            <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
            Status: {beneficiaryStatus}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl text-xs font-medium border border-slate-700 transition-all animate-bounce">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {showDeleteModal && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-800">Burahin ang Pag-uusap (Archive)?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sigurado ka bang nais mong burahin ang chat sa pagitan mo at ni <span className="font-bold text-slate-700">{selectedPartner.first_name} {selectedPartner.last_name}</span>?
              </p>
              
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-left flex items-start gap-2.5 mt-2">
                <Info className="w-4 h-4 text-dswd-blue shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  <strong>Safe Archive Guarantee:</strong> Ang mga mensahe ay <strong>HINDI mabubura sa database</strong>. Ililipat lamang ito sa <strong>Archived</strong> tab upang manatiling malinis ang iyong Recent Chats, at maaari mo itong tingnan o i-restore anumang oras.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Kanselahin
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-rose-200 disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete & Archive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                <MessageSquare className="w-7 h-7 text-yellow-300" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Messages Portal</h1>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              {user.role === 'beneficiary'
                ? 'Direct communication line with your assigned Barangay Staff and System Administrator.'
                : ['admin','mswdo_admin'].includes(user.role)
                ? 'Communicate with Barangay Staff and Beneficiaries in real time.'
                : 'Communicate with the System Administrator, fellow Barangay Staff, and registered Beneficiaries.'}
            </p>
          </div>

          {user.role === 'beneficiary' && (
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2 text-xs text-white shrink-0">
              <span className="block text-yellow-300 font-bold uppercase tracking-wider text-[10px]">Your Direct Contacts:</span>
              <span className="font-semibold">Barangay Staff & System Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 210px)' }}>
        <div className="flex h-full">

          {/* Left Panel - Conversations / Contacts / Archived */}
          <div className={`w-full sm:w-84 md:w-96 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/50 ${selectedPartner ? 'hidden sm:flex' : 'flex'}`}>
            
            {/* Search & Tabs */}
            <div className="p-3.5 border-b border-slate-200 space-y-3 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'conversations'
                      ? "Search recent chats..."
                      : activeTab === 'contacts'
                      ? "Search contacts..."
                      : "Search archived chats..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              {/* Navigation Tabs: Recent, Contacts, Archived */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => {
                    setActiveTab('conversations');
                    if (isArchivedView) {
                      setIsArchivedView(false);
                      setSelectedPartner(null);
                    }
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'conversations'
                      ? 'bg-white text-dswd-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Recent</span>
                  {conversations.some(c => c.unreadCount > 0) && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('contacts');
                    if (isArchivedView) {
                      setIsArchivedView(false);
                      setSelectedPartner(null);
                    }
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'contacts'
                      ? 'bg-white text-dswd-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{user.role === 'beneficiary' ? 'Staff' : 'Contacts'}</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full text-slate-600 font-semibold shrink-0">
                    {contacts.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('archived');
                    setSelectedPartner(null);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'archived'
                      ? 'bg-white text-dswd-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archived</span>
                  {archivedConversations.length > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                      {archivedConversations.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {activeTab === 'contacts' ? (
                // ─── Contacts List ───
                filteredContacts.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No contacts available</p>
                    {user?.role === 'beneficiary' && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Only registered Barangay Staff and System Administrators will appear here.
                      </p>
                    )}
                  </div>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected = selectedPartner?.id === contact.id && !isArchivedView;
                    return (
                      <button
                        key={contact.id}
                        onClick={() => selectPartner(contact, false)}
                        className={`w-full text-left px-4 py-3.5 transition flex items-center gap-3.5 hover:bg-slate-100/80 ${
                          isSelected ? 'bg-blue-50/90 border-l-4 border-dswd-lightBlue' : 'bg-white'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm ${
                          ['admin','mswdo_admin'].includes(contact.role)
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                        }`}>
                          {contact.first_name[0]}{contact.last_name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {contact.first_name} {contact.last_name}
                            </span>
                          </div>
                          <div className="mt-1">
                            {getRoleBadge(contact.role, contact.Barangay?.barangay_name)}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-1">{contact.email}</p>
                        </div>
                      </button>
                    );
                  })
                )
              ) : activeTab === 'archived' ? (
                // ─── Archived Conversations List ───
                filteredArchivedConversations.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
                      <Archive className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Walang Archived Chats</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Kapag nag-delete ka ng chat, hindi ito mabubura sa database kundi ilalagay rito sa Archive para maaari mo pa ring balikan o i-restore.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredArchivedConversations.map((conv) => {
                    const isSelected = selectedPartner?.id === conv.partnerId && isArchivedView;
                    return (
                      <div
                        key={conv.partnerId}
                        onClick={() => selectPartner(conv.partner, true)}
                        className={`w-full text-left px-4 py-3.5 transition flex items-center gap-3.5 hover:bg-slate-100/80 cursor-pointer ${
                          isSelected ? 'bg-amber-50/90 border-l-4 border-amber-500' : 'bg-white'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${
                            ['admin','mswdo_admin'].includes(conv.partner.role)
                              ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                              : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                          }`}>
                            {conv.partner.first_name[0]}{conv.partner.last_name[0]}
                          </div>
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-xs">
                            <Archive className="w-2.5 h-2.5" />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {conv.partner.first_name} {conv.partner.last_name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {getRoleBadge(conv.partner.role, conv.partner.Barangay?.barangay_name)}
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md">
                              Archived
                            </span>
                          </div>
                          <p className="text-[11px] truncate mt-1 text-slate-400 italic">
                            {conv.lastMessage}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreConversation(conv.partnerId);
                          }}
                          title="Ibalik sa Recent Chats (Restore)"
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition shrink-0"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )
              ) : (
                // ─── Recent Active Conversations List ───
                filteredConversations.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-dswd-blue">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">No active conversations</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Select an official contact from the tab above to begin messaging.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('contacts')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dswd-blue text-white rounded-xl text-xs font-semibold hover:bg-blue-800 transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      View Contacts
                    </button>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = selectedPartner?.id === conv.partnerId && !isArchivedView;
                    return (
                      <button
                        key={conv.partnerId}
                        onClick={() => selectPartner(conv.partner, false)}
                        className={`w-full text-left px-4 py-3.5 transition flex items-center gap-3.5 hover:bg-slate-100/80 ${
                          isSelected ? 'bg-blue-50/90 border-l-4 border-dswd-lightBlue' : 'bg-white'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${
                            ['admin','mswdo_admin'].includes(conv.partner.role)
                              ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                              : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                          }`}>
                            {conv.partner.first_name[0]}{conv.partner.last_name[0]}
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {conv.partner.first_name} {conv.partner.last_name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                          </div>
                          <div className="mt-0.5">
                            {getRoleBadge(conv.partner.role, conv.partner.Barangay?.barangay_name)}
                          </div>
                          <p className={`text-[11px] truncate mt-1 ${conv.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                            {conv.lastMessage}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* Right Panel - Chat Area or Welcome Screen */}
          <div className={`flex-1 flex flex-col ${!selectedPartner ? 'hidden sm:flex' : 'flex'} bg-white`}>
            {selectedPartner ? (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedPartner(null)}
                      className="sm:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm ${
                      ['admin','mswdo_admin'].includes(selectedPartner.role)
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                        : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                    }`}>
                      {selectedPartner.first_name[0]}{selectedPartner.last_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">
                          {selectedPartner.first_name} {selectedPartner.last_name}
                        </h3>
                        {getRoleBadge(selectedPartner.role, selectedPartner.Barangay?.barangay_name)}
                        {isArchivedView && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            <Archive className="w-3 h-3 text-amber-600" />
                            Archived Chat
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                        <span className="text-[11px] text-slate-400 font-medium">{selectedPartner.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions: Delete Chat (Archive) or Restore */}
                  <div className="flex items-center gap-2">
                    {isArchivedView ? (
                      <button
                        onClick={() => handleRestoreConversation(selectedPartner.id)}
                        disabled={restoring}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition shadow-xs disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{restoring ? 'Restoring...' : 'Restore Chat'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        title="Delete chat (Archive)"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span className="hidden sm:inline">Delete Chat</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50/70">
                  {/* Archived Notice Banner */}
                  {isArchivedView && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Archived Conversation:</strong> Ang pag-uusap na ito ay naka-archive. Hindi ito lilitaw sa Recent Chats hangga't hindi naire-restore o nagpapadala ng bagong mensahe.
                        </span>
                      </div>
                      <button
                        onClick={() => handleRestoreConversation(selectedPartner.id)}
                        disabled={restoring}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-xs disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    </div>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-dswd-blue"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-16 max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-dswd-blue">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Start the conversation</h4>
                      <p className="text-xs text-slate-500">
                        Send a message directly to {selectedPartner.first_name}. They will be notified immediately.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      return (
                        <div key={msg.id} className={`flex group items-center gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {/* Left-side action for own messages */}
                          {isMine && !isArchivedView && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Archive this message"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <div className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm shadow-xs ${
                            isMine
                              ? 'bg-dswd-blue text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                          }`}>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                            <p className={`text-[10px] mt-1.5 ${isMine ? 'text-blue-200' : 'text-slate-400'} text-right`}>
                              {formatTime(msg.created_at || msg.createdAt)}
                            </p>
                          </div>

                          {/* Right-side action for received messages */}
                          {!isMine && !isArchivedView && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Archive this message"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <form onSubmit={handleSend} className="p-3.5 border-t border-slate-200 bg-white flex gap-2.5 items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      isArchivedView
                        ? `Magpadala ng mensahe para ma-restore at ituloy ang chat kay ${selectedPartner.first_name}...`
                        : `Type a message to ${selectedPartner.first_name}...`
                    }
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100 transition"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-5 py-2.5 bg-dswd-blue text-white rounded-xl hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-xs sm:text-sm font-bold shadow-md shadow-blue-100"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              // ─── Welcome / Quick Action Screen ───
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 text-center overflow-y-auto">
                <div className="max-w-md space-y-5">
                  <div className="w-16 h-16 bg-blue-100 text-dswd-blue rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Official Messaging Channel</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {user.role === 'beneficiary'
                        ? 'Select an authorized staff member from your registered barangay or system administrator to start messaging.'
                        : 'Select a conversation or contact from the sidebar to start messaging.'}
                    </p>
                  </div>

                  {/* Beneficiary Quick Action Contact Cards */}
                  {user.role === 'beneficiary' && contacts.length > 0 && (
                    <div className="space-y-2.5 pt-2 text-left">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Available Contacts ({contacts.length})
                      </p>
                      <div className="grid gap-2">
                        {contacts.slice(0, 4).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectPartner(c, false)}
                            className="p-3 bg-white border border-slate-200 rounded-xl hover:border-dswd-lightBlue hover:shadow-md transition flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                                ['admin','mswdo_admin'].includes(c.role)
                                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                  : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                              }`}>
                                {c.first_name[0]}{c.last_name[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-dswd-blue transition">
                                  {c.first_name} {c.last_name}
                                </p>
                                <div className="mt-0.5">
                                  {getRoleBadge(c.role, c.Barangay?.barangay_name)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-dswd-lightBlue bg-blue-50 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-dswd-blue group-hover:text-white transition">
                              Chat
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
