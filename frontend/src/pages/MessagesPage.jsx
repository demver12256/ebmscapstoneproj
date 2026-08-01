import { useEffect, useState, useRef } from 'react';
import { messageApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Search, Users, ArrowLeft, Circle } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadContacts();
  }, []);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (selectedPartner) {
        loadMessages(selectedPartner.id, true);
      }
      loadConversations(true);
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [selectedPartner]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async (silent = false) => {
    try {
      const res = await messageApi.conversations();
      setConversations(res.data.data || []);
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

  const loadMessages = async (partnerId, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await messageApi.getMessages(partnerId);
      setMessages(res.data.data || []);
    } catch (err) {
      if (!silent) console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const selectPartner = (partner) => {
    setSelectedPartner(partner);
    setShowContacts(false);
    loadMessages(partner.id);
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
      await loadMessages(selectedPartner.id, true);
      await loadConversations(true);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const startNewChat = (contact) => {
    setSelectedPartner(contact);
    setShowContacts(false);
    loadMessages(contact.id);
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700',
      staff: 'bg-blue-100 text-blue-700',
      beneficiary: 'bg-green-100 text-green-700',
      barangay: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${styles[role] || 'bg-slate-100 text-slate-600'}`}>
        {role}
      </span>
    );
  };

  const formatTime = (dateStr) => {
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
  const filteredContacts = contacts.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Build conversation list with partner info
  const conversationList = conversations.map((conv) => ({
    ...conv,
    partner: conv.partner,
  }));

  // Filter conversation list too
  const filteredConversations = conversationList.filter((c) =>
    c.partner && `${c.partner.first_name} ${c.partner.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canMessage = user?.role === 'admin' || user?.role === 'staff';

  if (!canMessage) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Messaging Not Available</h2>
          <p className="text-sm text-slate-500">Messaging is only available for admin and staff accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
            <p className="text-sm text-slate-600 mt-1">
              {user.role === 'admin' ? 'Communicate with staff members.' : 'Communicate with admin, staff, and beneficiaries.'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="flex h-full">

          {/* Left Panel - Conversations */}
          <div className={`w-full sm:w-80 border-r border-slate-200 flex flex-col shrink-0 ${selectedPartner ? 'hidden sm:flex' : 'flex'}`}>
            {/* Search + New Chat */}
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                />
              </div>
              <button
                onClick={() => setShowContacts(!showContacts)}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
              >
                <Users className="w-3.5 h-3.5" />
                {showContacts ? 'Show Conversations' : 'New Message'}
              </button>
            </div>

            {/* Contact / Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {showContacts ? (
                // Contact list for new message
                filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No contacts found</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => startNewChat(contact)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 transition flex items-center gap-3"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {contact.first_name[0]}{contact.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">{contact.first_name} {contact.last_name}</span>
                          {getRoleBadge(contact.role)}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{contact.email}</p>
                      </div>
                    </button>
                  ))
                )
              ) : (
                // Conversation list
                filteredConversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No conversations yet</p>
                    <p className="text-xs text-slate-400 mt-1">Click "New Message" to start</p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.partnerId}
                      onClick={() => selectPartner(conv.partner)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition flex items-center gap-3 ${
                        selectedPartner?.id === conv.partnerId ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {conv.partner.first_name[0]}{conv.partner.last_name[0]}
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-800 truncate">{conv.partner.first_name} {conv.partner.last_name}</span>
                            {getRoleBadge(conv.partner.role)}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">{formatTime(conv.lastMessageAt)}</span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                          {conv.lastMessage}
                        </p>
                      </div>
                    </button>
                  ))
                )
              )}
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className={`flex-1 flex flex-col ${!selectedPartner ? 'hidden sm:flex' : 'flex'}`}>
            {selectedPartner ? (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 bg-white">
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="sm:hidden p-1 text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {selectedPartner.first_name[0]}{selectedPartner.last_name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">{selectedPartner.first_name} {selectedPartner.last_name}</h3>
                      {getRoleBadge(selectedPartner.role)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                      <span className="text-[11px] text-slate-500">Online</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No messages yet. Say hello! 👋</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                            isMine
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400'} text-right`}>
                              {formatTime(msg.created_at || msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              // No conversation selected
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a conversation</h3>
                  <p className="text-sm text-slate-500">Choose a contact to start messaging</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
