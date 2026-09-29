import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { messageApi } from '../services/api';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function MessagesScreen({ onBack, user }) {
  const [activeTab, setActiveTab] = useState('conversations'); // conversations | contacts
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const pollTimer = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [convRes, contRes] = await Promise.all([
        messageApi.conversations().catch(() => ({ data: { data: [] } })),
        messageApi.contacts().catch(() => ({ data: { data: [] } })),
      ]);
      setConversations(convRes.data?.data || []);
      setContacts(contRes.data?.data || []);
    } catch (err) {
      console.warn('Failed to load messages data:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load chat messages when partner selected
  const openChat = async (partner) => {
    setSelectedPartner(partner);
    try {
      const res = await messageApi.getMessages(partner.id);
      setMessages(res.data?.data || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.warn('Error fetching messages:', err?.message);
    }
  };

  // Poll for new messages when in active chat
  useEffect(() => {
    if (selectedPartner) {
      pollTimer.current = setInterval(async () => {
        try {
          const res = await messageApi.getMessages(selectedPartner.id);
          setMessages(res.data?.data || []);
        } catch {}
      }, 4000);

      return () => clearInterval(pollTimer.current);
    }
  }, [selectedPartner]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedPartner) return;
    const textToSend = inputText.trim();
    setInputText('');

    try {
      setSending(true);
      await messageApi.send({
        receiver_id: selectedPartner.id,
        content: textToSend,
      });

      // Refresh chat
      const res = await messageApi.getMessages(selectedPartner.id);
      setMessages(res.data?.data || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Send Error', err.response?.data?.message || err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // If in active chat with someone
  if (selectedPartner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        {/* Chat Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedPartner(null)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.chatPartnerInfo}>
            <Text style={styles.chatPartnerName}>
              {selectedPartner.first_name} {selectedPartner.last_name}
            </Text>
            <Text style={styles.chatPartnerRole}>
              {(selectedPartner.role || 'Staff').toUpperCase()}
            </Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Messages list */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChatBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
                <Text style={styles.emptyChatTitle}>Start a Conversation</Text>
                <Text style={styles.emptyChatSub}>
                  Send an official inquiry or assistance query to {selectedPartner.first_name}.
                </Text>
              </View>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <View
                    key={m.id || idx}
                    style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                      ]}
                    >
                      <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                        {m.message || m.content}
                      </Text>
                      <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                        {formatTime(m.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.chatInputBar}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor="#94a3b8"
              multiline={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>➤</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversation List & Contacts Directory View
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.headerBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={loadData} style={styles.headerRefreshBtn}>
            <Text style={styles.headerRefreshText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Switcher */}
      <View style={styles.subHeader}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'conversations' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('conversations')}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === 'conversations' && styles.segmentBtnTextActive,
            ]}
          >
            💬 Conversations ({conversations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'contacts' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text style={[styles.segmentBtnText, activeTab === 'contacts' && styles.segmentBtnTextActive]}>
            👥 Staff Directory ({contacts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : activeTab === 'conversations' ? (
        <ScrollView contentContainerStyle={styles.scrollList}>
          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>💬</Text>
              <Text style={styles.emptyTitle}>No Active Conversations</Text>
              <Text style={styles.emptySub}>
                Pindutin ang "Staff Directory" sa itaas upang magpadala ng mensahe sa DSWD Admin o Barangay Focal Person.
              </Text>
            </View>
          ) : (
            conversations.map((c, idx) => {
              const partner = c.User || c.partner || {};
              const unread = c.unread_count || 0;

              return (
                <TouchableOpacity
                  key={c.partner_id || idx}
                  style={styles.convCard}
                  onPress={() => openChat(partner)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(partner.first_name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.convHeaderRow}>
                      <Text style={styles.convName}>
                        {partner.first_name} {partner.last_name}
                      </Text>
                      <Text style={styles.convDate}>{formatDate(c.last_message_at)}</Text>
                    </View>
                    <Text style={styles.convRole}>{(partner.role || 'Staff').toUpperCase()}</Text>
                    <Text style={styles.convLastMsg} numberOfLines={1}>
                      {c.last_message || 'Tap to view conversation...'}
                    </Text>
                  </View>
                  {unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>👥</Text>
              <Text style={styles.emptyTitle}>No Contacts Available</Text>
              <Text style={styles.emptySub}>
                Walang nakatalagang admin o staff sa kasalukuyan para sa inyong barangay.
              </Text>
            </View>
          ) : (
            contacts.map((contact, idx) => (
              <TouchableOpacity
                key={contact.id || idx}
                style={styles.contactCard}
                onPress={() => openChat(contact)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: '#1d4ed8' }]}>
                  <Text style={styles.avatarText}>
                    {(contact.first_name || 'S')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convName}>
                    {contact.first_name} {contact.last_name}
                  </Text>
                  <Text style={styles.convRole}>
                    {(contact.role || 'Staff').toUpperCase()} {contact.Barangay ? `• ${contact.Barangay.barangay_name}` : ''}
                  </Text>
                </View>
                <View style={styles.chatNowBtn}>
                  <Text style={styles.chatNowBtnText}>Chat 💬</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    height: 56,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerLeft: {
    width: 60,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerBtnText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  headerRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRefreshText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#1d4ed8',
  },
  scrollList: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00338D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  convHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  convRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 1,
  },
  convLastMsg: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  convDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  unreadBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  chatNowBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  chatNowBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  // Chat View
  chatPartnerInfo: {
    alignItems: 'center',
  },
  chatPartnerName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  chatPartnerRole: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyChatBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptyChatSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMe: {
    backgroundColor: '#1d4ed8',
    borderBottomRightRadius: 2,
  },
  messageBubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  messageTime: {
    fontSize: 9,
    color: '#94a3b8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageTimeMe: {
    color: '#bfdbfe',
  },
  chatInputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
