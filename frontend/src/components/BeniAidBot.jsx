import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bot, X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { API_URL } from '../config/api';

const DEFAULT_SUGGESTIONS = [
  'Saan makikita ang QR code ko?',
  'Requirements sa Medical Assistance',
  'Kailan ang schedule ng ayuda?',
  'Paano mag-apply ng assistance?',
  'Pwede ba representative ang kumuha?',
  'Magkano ang matatanggap na ayuda?',
  'Paano magparehistro sa system?',
  'Mga hotline at helpdesk'
];

export default function BeniAidBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Magandang araw! Ako si **BeniAid Assistant** 🤖. May maitutulong ba ako tungkol sa QR code, requirements, ayuda schedule, o application?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_SUGGESTIONS);
  const messagesEndRef = useRef(null);

  // Draggable position state
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(16, window.innerWidth - 76),
        y: Math.max(16, window.innerHeight - 76)
      };
    }
    return { x: 500, y: 500 };
  });

  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(Math.max(16, prev.x), window.innerWidth - 76),
        y: Math.min(Math.max(16, prev.y), window.innerHeight - 76)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Pointer dragging handlers
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    dragRef.current = {
      isDragging: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.hasMoved = true;
      const newX = Math.max(12, Math.min(window.innerWidth - 68, dragRef.current.posX + dx));
      const newY = Math.max(12, Math.min(window.innerHeight - 68, dragRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e) => {
    if (dragRef.current.isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (!dragRef.current.hasMoved) {
        setIsOpen((prev) => !prev);
      }
      dragRef.current.isDragging = false;
    }
  };

  const handlePointerCancel = () => {
    dragRef.current.isDragging = false;
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/bot/chat`, { message: query });
      if (res.data && res.data.success) {
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: res.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
        if (Array.isArray(res.data.suggestedQuestions) && res.data.suggestedQuestions.length > 0) {
          setSuggestedQuestions(res.data.suggestedQuestions);
        }
      } else {
        throw new Error(res.data?.message || 'Error occurred');
      }
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Paumanhin, hindi maabot ang bot server sa ngayon. Pakisubukang muli o mag-login para makipag-ugnayan sa staff.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: 'Kumusta ulit! Ako si **BeniAid Assistant** 🤖. Ano ang nais mong itanong?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    setSuggestedQuestions(DEFAULT_SUGGESTIONS);
  };

  const renderFormattedText = (text) => {
    return text.split('\n').map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <React.Fragment key={idx}>
          {renderedParts}
          {idx < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  // Compute smart coordinates for the chat window clamped to screen
  const chatWidth = typeof window !== 'undefined' ? Math.min(390, window.innerWidth - 24) : 390;
  const chatHeight = typeof window !== 'undefined' ? Math.min(560, window.innerHeight - 30) : 560;

  let chatLeft = position.x - chatWidth + 56;
  if (chatLeft < 12) chatLeft = 12;
  if (typeof window !== 'undefined' && chatLeft + chatWidth > window.innerWidth - 12) {
    chatLeft = Math.max(12, window.innerWidth - chatWidth - 12);
  }

  let chatTop = position.y - chatHeight - 12;
  if (chatTop < 12) {
    if (typeof window !== 'undefined' && position.y + 68 + chatHeight <= window.innerHeight - 12) {
      chatTop = position.y + 68;
    } else {
      chatTop = Math.max(12, (typeof window !== 'undefined' ? window.innerHeight : 600) - chatHeight - 12);
    }
  }

  return (
    <>
      {/* Floating Draggable Bot Icon Button */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
          touchAction: 'none',
        }}
        className="font-sans antialiased"
      >
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
          className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#002870] via-[#00338D] to-[#0052cc] text-white shadow-2xl hover:shadow-[#00338D]/50 cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-transform duration-150 select-none border-2 border-white/20"
          aria-label="Open BeniAid Chatbot"
          title="BeniAid Assistant (Maaaring i-drag kahit saan)"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-7 h-7 text-white pointer-events-none" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
            </span>
          </div>
        </button>
      </div>

      {/* Chat Window Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            left: `${chatLeft}px`,
            top: `${chatTop}px`,
            zIndex: 9999,
            width: `${chatWidth}px`,
            height: `${chatHeight}px`,
          }}
          className="flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans antialiased"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00338D] via-[#0047AB] to-[#002870] text-white p-3.5 flex items-center justify-between shadow-md select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 flex items-center justify-center border border-white/20 shadow-sm shrink-0">
                <img src="/beniaid-logo.png" alt="BeniAid Bot" className="w-full h-full rounded-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-wide">BeniAid Assistant</h3>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 font-semibold px-1.5 py-0.2 rounded border border-emerald-400/30">AI Bot</span>
                </div>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                  Online • Beneficiary Helpdesk
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Restart Chat"
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-[#00338D] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4 text-emerald-300" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#00338D] text-white rounded-br-xs'
                      : 'bg-white text-slate-700 border border-slate-200/90 rounded-bl-xs'
                  }`}
                >
                  <div className="break-words">{renderFormattedText(msg.text)}</div>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.sender === 'user' ? 'text-white/60' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-lg bg-[#00338D] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00338D] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#00338D] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#00338D] rounded-full animate-bounce"></span>
                  </span>
                  <span className="text-[11px] font-medium">Nagsusulat...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Questions */}
          {suggestedQuestions.length > 0 && (
            <div className="px-3 py-2 bg-slate-100/90 border-t border-slate-200/80 overflow-x-auto no-scrollbar">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Mabilisang Tanong:
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    disabled={loading}
                    className="text-[11px] bg-white hover:bg-blue-50 text-[#00338D] hover:text-[#002870] border border-blue-200 rounded-full px-2.5 py-1 text-left whitespace-nowrap transition-all shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Magtanong dito (hal. QR code, ayuda)..."
              disabled={loading}
              className="flex-1 bg-slate-100 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00338D]/30 focus:border-[#00338D] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-[#00338D] hover:bg-[#002870] disabled:bg-slate-300 text-white p-2.5 rounded-xl shadow-sm transition active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
