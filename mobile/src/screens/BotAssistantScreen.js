import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { botApi } from '../services/api';

const DEFAULT_QUESTIONS = [
  'Saan makikita ang QR code ko?',
  'Requirements sa Medical Assistance',
  'Kailan ang schedule ng ayuda?',
  'Paano mag-apply ng assistance?',
  'Pwede ba representative ang kumuha?',
  'Magkano ang matatanggap na ayuda?',
  'Paano magparehistro sa system?',
  'Hotline at helpdesk numbers',
];

export default function BotAssistantScreen({ onBack, darkMode = false, user }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Magandang araw! Ako si BeniAid Assistant 🤖. Paano kita matutulungan ngayon? Pwede kang magtanong ukol sa QR Code, requirements, ayuda schedule, o application.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_QUESTIONS);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const handleSend = async (customText) => {
    const query = (customText || inputText).trim();
    if (!query || loading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInputText('');
    setLoading(true);

    try {
      const response = await botApi.chat(query);
      if (response.data && response.data.success) {
        const botReply = {
          id: Date.now() + 1,
          sender: 'bot',
          text: response.data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botReply]);
        if (Array.isArray(response.data.suggestedQuestions) && response.data.suggestedQuestions.length > 0) {
          setSuggestedQuestions(response.data.suggestedQuestions);
        }
      } else {
        throw new Error(response.data?.message || 'Error occurred');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Paumanhin, hindi maabot ang server sa ngayon. Pakisubukang muli o mag-mensahe sa Admin.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: 'Kumusta! Ako si BeniAid Assistant 🤖. Ano ang nais mong itanong?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setSuggestedQuestions(DEFAULT_QUESTIONS);
  };

  const cleanText = (txt) => {
    if (!txt) return '';
    // Strip markdown bold asterisks for clean mobile text
    return txt.replace(/\*\*/g, '');
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={darkMode ? '#0F172A' : '#00338D'} />

      {/* Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>‹ Bumalik</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>BeniAid Assistant 🤖</Text>
          <Text style={styles.headerSubtitle}>Online • EBMS Helpdesk</Text>
        </View>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>🔄 Reset</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((item) => {
            const isUser = item.sender === 'user';
            return (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userRow : styles.botRow,
                ]}
              >
                {!isUser && (
                  <View style={styles.botAvatar}>
                    <Text style={styles.botAvatarText}>🤖</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? styles.userBubble
                      : [styles.botBubble, darkMode && styles.darkBotBubble],
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser
                        ? styles.userText
                        : [styles.botText, darkMode && styles.darkBotText],
                    ]}
                  >
                    {cleanText(item.text)}
                  </Text>
                  <Text
                    style={[
                      styles.timestampText,
                      isUser ? styles.userTime : styles.botTime,
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={[styles.messageRow, styles.botRow]}>
              <View style={styles.botAvatar}>
                <Text style={styles.botAvatarText}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.botBubble, darkMode && styles.darkBotBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color="#00338D" />
                <Text style={[styles.botText, { marginLeft: 8, fontSize: 12 }]}>Nagsusulat...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestion Chips */}
        {suggestedQuestions.length > 0 && (
          <View style={[styles.suggestionsWrap, darkMode && styles.darkSuggestionsWrap]}>
            <Text style={[styles.suggestionHeader, darkMode && styles.darkSuggestionHeader]}>
              💡 Mabilisang Tanong:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
              {suggestedQuestions.map((q, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.suggestionChip, darkMode && styles.darkSuggestionChip]}
                  onPress={() => handleSend(q)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestionText, darkMode && styles.darkSuggestionText]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Input */}
        <View style={[styles.inputBar, darkMode && styles.darkInputBar]}>
          <TextInput
            style={[styles.textInput, darkMode && styles.darkTextInput]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Magtanong dito (hal. QR code, ayuda)..."
            placeholderTextColor={darkMode ? '#94A3B8' : '#94A3B8'}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  darkContainer: {
    backgroundColor: '#0F172A',
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00338D',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  darkHeader: {
    backgroundColor: '#1E293B',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#93C5FD',
    fontSize: 11,
    marginTop: 2,
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00338D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  botAvatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#00338D',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  darkBotBubble: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#1E293B',
  },
  darkBotText: {
    color: '#E2E8F0',
  },
  timestampText: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
  },
  userTime: {
    color: '#BFDBFE',
  },
  botTime: {
    color: '#94A3B8',
  },
  suggestionsWrap: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  darkSuggestionsWrap: {
    backgroundColor: '#1E293B',
    borderTopColor: '#334155',
  },
  suggestionHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  darkSuggestionHeader: {
    color: '#94A3B8',
  },
  suggestionsScroll: {
    flexDirection: 'row',
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  darkSuggestionChip: {
    backgroundColor: '#0F172A',
    borderColor: '#1E40AF',
  },
  suggestionText: {
    fontSize: 11,
    color: '#00338D',
    fontWeight: '500',
  },
  darkSuggestionText: {
    color: '#93C5FD',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  darkInputBar: {
    backgroundColor: '#0F172A',
    borderTopColor: '#1E293B',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  darkTextInput: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00338D',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

