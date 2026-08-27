import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  User, 
  Send, 
  Loader2, 
  HelpCircle,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { CreatorProfile } from '../types';
import { askAIHriatpui } from '../services/aiHriatpuiService';

interface AIHriatpuiModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile?: CreatorProfile;
  onApplyLetterToRegistration?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'Bawm category 4-te hi engnge?',
  'Creator account engtin nge hawn theih?',
  'RonPay QR code hmangin engtin nge sum chhunluh?',
  'Member Roll & Faith Promise hi engnge?',
  'Platform fee leh trial period a awm em?'
];

export const AIHriatpuiModal: React.FC<AIHriatpuiModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Chibai! RonPay User Guide AI ka ni e. RonPay hman dan, Bawm category 4-te, Creator hawn dan leh app kaihhruaina i hriat duh apiang min zawt thei e.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputVal, setInputVal] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputVal).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);

    try {
      const aiReply = await askAIHriatpui(
        query,
        creatorProfile?.isApproved ? 'Creator' : 'User'
      );

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'ai',
        text: 'Ka hre lo tlat mai... RonPay kaihhruaina leh hman dan (User Guide) chungchang chauh ka hrilhfiah thei a che. RonPay Bawm hman dan emaw Creator registration chungchang zawt leh zawk rawh le.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      id="ai-hriatpui-overlay"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Compact, clean chat box container */}
      <div 
        id="ai-hriatpui-chat-widget"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col max-h-[85vh] sm:max-h-[580px] h-[520px] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white tracking-tight">
                  AI Hriatpui
                </h3>
                <span className="text-[9px] bg-indigo-500/30 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-indigo-400/40">
                  User Guide
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                RonPay Kaihhruaina & Hman Dan
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-ai-hriatpui-btn"
            onClick={onClose}
            title="Close Assistant"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2.5 leading-relaxed text-xs shadow-2xs whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs font-normal'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[9px] mt-1 text-right font-medium ${
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  <User className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-[11px] bg-white p-2.5 rounded-2xl border border-slate-200 w-fit shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span className="font-medium">AI Hriatpui-in a chhang mek...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100 shrink-0">
          <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Zawhna tlanglawnte:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium rounded-full border border-slate-200 hover:border-indigo-200 transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
          <input
            type="text"
            id="ai-guide-chat-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="RonPay chungchang zawt rawh le..."
            disabled={isLoading}
            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />

          <button
            type="button"
            id="send-ai-guide-msg-btn"
            onClick={() => handleSendMessage()}
            disabled={!inputVal.trim() || isLoading}
            className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
