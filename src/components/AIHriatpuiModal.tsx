import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  User, 
  Send, 
  Loader2, 
  HelpCircle,
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  Building2,
  ChevronDown,
  ChevronUp,
  Award,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  FileSpreadsheet,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { CreatorProfile } from '../types';
import { 
  askAIHriatpui, 
  generateConversationalDocument, 
  AIHriatpuiGeneratedDoc,
  RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15 
} from '../services/aiHriatpuiService';
import { downloadFileUniversal } from '../utils/export';

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
  generatedDoc?: AIHriatpuiGeneratedDoc;
}

const QUICK_KNOWLEDGE_PROMPTS = [
  { label: 'Q1: RonPay hi engnge?', text: 'RonPay hi engnge a nih a, eng atan nge hman a nih?' },
  { label: 'Q2: Bank a ni em?', text: 'RonPay hi Bank a ni em? Pawisa a kawl em?' },
  { label: 'Q3: Kalphung & Sum luh dan', text: 'Engtin nge sum lut a kalphung a nih?' },
  { label: 'Q4: Fee a awm em?', text: 'RonPay hian payment fee a la ve em?' },
  { label: 'Q5: A him em?', text: 'RonPay hi a him em? Bank password/PIN a la em?' },
  { label: 'Q6-7: Creator & User', text: 'Creator leh User danglamna engnge? Tuin nge QR siam thei?' },
  { label: 'Q8: QR Validity & Limit', text: 'QR code te hian validity leh limit an nei em?' },
  { label: 'Q9-12: Bawm 4-te', text: 'Ralna, Khawlsak, Rikrum, leh Kumtluang Bawm te hi engte nge?' },
  { label: 'Q13: UPI Lite', text: 'RonPay hian UPI Lite a support em?' },
  { label: 'Q14: GPay vs RonPay', text: 'GPay leh RonPay danglamna engnge?' },
  { label: 'Q15: Tu siam nge?', text: 'RonPay hi tu siam nge?' },
];

const QUICK_DOC_PROMPTS = [
  { label: '📝 Creator Dilna Form', text: 'Creator Nihna Dilna Form min siam sak rawh.' },
  { label: '📜 Pawl Hriatpuina (To Whom It May Concern)', text: 'Pawl / Branch Hriatpuina Lehkha (To Whom It May Concern) min generate sak rawh.' },
  { label: '🕊️ Ralna Bawm Hriatpuina', text: 'Ralna Bawm hawn nan YMA Hriatpuina lehkha min ziak sak rawh.' },
  { label: '🤝 Khawlsak Tanpuina Form', text: 'Khawlsak Bawm atana Creator nihna dilna lehkha min siam sak rawh.' },
  { label: '🚨 Rikrum Emergency Certificate', text: 'Rikrum Bawm emergency sum khawn nan Pawl Hriatpuina min siam sak rawh.' },
];

export const AIHriatpuiModal: React.FC<AIHriatpuiModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  onApplyLetterToRegistration,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'doc_wizard' | 'qna_list'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Chibai! RonPay AI Assistant & Document Generator ka ni e.\n\n• **Q1 - Q15 Knowledge Base:** RonPay kalphung, Bank a nih loh thu, Fee, Himna, leh Category 4 hrilhfiahna ka nei thlap e.\n• **Conversational Form & Certificate Generator:** Creator nihna Dilna Form emaw Hriatpuina Lehkha (To Whom It May Concern) i duh apiang min zawt la, ka generate chhuak nghal zung zung ang!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputVal, setInputVal] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  
  // Custom Doc Builder Form
  const [isBuilderExpanded, setIsBuilderExpanded] = useState<boolean>(false);
  const [builderDocType, setBuilderDocType] = useState<'creator_application' | 'hriatpuina_cert'>('creator_application');
  const [builderApplicantName, setBuilderApplicantName] = useState<string>('');
  const [builderOrgName, setBuilderOrgName] = useState<string>('');
  const [builderLocality, setBuilderLocality] = useState<string>('');
  const [builderCategory, setBuilderCategory] = useState<string>('ralna');
  const [builderPurpose, setBuilderPurpose] = useState<string>('');
  const [builderPhone, setBuilderPhone] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

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
      const result = await askAIHriatpui(
        query,
        creatorProfile?.isApproved ? 'Creator' : 'User'
      );

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: result.answer,
        generatedDoc: result.generatedDoc,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'ai',
        text: 'Ka hre lo tlat mai... RonPay kaihhruaina leh hman dan (User Guide) chungchang chauh ka hrilhfiah thei a che. RonPay Bawm hman dan, QR Code, emaw Creator registration chungchang zawt leh zawk rawh le.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCustomDoc = () => {
    const doc = generateConversationalDocument({
      docType: builderDocType,
      applicantName: builderApplicantName.trim() || '________________ (Diltu Hming)',
      orgName: builderOrgName.trim() || '________________ (Pawl / Branch Hming)',
      locality: builderLocality.trim() || '________________ (Veng / Khua)',
      category: builderCategory,
      purpose: builderPurpose.trim() || 'Tanpuina leh rawngbawlna sum lakkhawm nan',
      applicantPhone: builderPhone.trim() || '__________ (Phone Number)',
      signatoryName: builderDocType === 'creator_application' ? (builderApplicantName.trim() || '________________ (Diltu)') : 'Branch Secretary',
      signatoryTitle: builderDocType === 'creator_application' ? 'Diltu / Representative' : 'Secretary / President',
    });

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: `📜 ${builderDocType === 'creator_application' ? 'Creator Dilna Form' : 'Hriatpuina Certificate'} siam rawh: ${builderOrgName || 'Pawl Hming'} (${builderApplicantName || 'Diltu'})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const aiMsg: ChatMessage = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: `✅ **${doc.title}** chu i details tarlan ang thlapin ka rawn generate chhuak ta e!\nPrint, Copy, emaw Download-in Creator Registration atan i hmang nghal thei ang.`,
      generatedDoc: doc,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsBuilderExpanded(false);
    setActiveTab('chat');
  };

  const handleCopyText = (text: string, docId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDocId(docId);
    setTimeout(() => setCopiedDocId(null), 2500);
  };

  const handlePrintDoc = (doc: AIHriatpuiGeneratedDoc) => {
    const event = new CustomEvent('ronpay-open-print-modal', {
      detail: {
        html: doc.htmlPreview,
        docTitle: doc.title,
      },
    });
    window.dispatchEvent(event);
  };

  const handleDownloadDoc = (doc: AIHriatpuiGeneratedDoc) => {
    downloadFileUniversal(
      `${doc.refNo.replace(/\//g, '_')}.txt`,
      doc.fullLetterText,
      'text/plain;charset=utf-8'
    );
  };

  return (
    <div 
      id="ai-hriatpui-overlay"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Compact, clean chat & form generator modal container */}
      <div 
        id="ai-hriatpui-chat-widget"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col max-h-[90vh] sm:max-h-[640px] h-[600px] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Bot className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm text-white tracking-tight">
                  RonPay AI Hriatpui
                </h3>
                <span className="text-[9.5px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                  Q1-Q15 & Doc Engine
                </span>
              </div>
              <p className="text-[10px] text-slate-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                User Guide • Conversational Form & Certificate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
        </div>

        {/* Tab Filter Bar */}
        <div className="bg-slate-900 px-3 py-1.5 flex items-center justify-between gap-1 border-b border-slate-800 text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Chat & Docs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('doc_wizard')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'doc_wizard'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Form Generator Wizard</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qna_list')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'qna_list'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Q1-Q15 Guide</span>
            </button>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/80 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                )}

                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 leading-relaxed text-xs shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs font-normal'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* RENDER EMBEDDED GENERATED DOCUMENT CARD */}
                  {msg.generatedDoc && (
                    <div className="mt-3 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/50 border border-amber-300/90 rounded-xl p-3 text-slate-900 shadow-xs space-y-2.5">
                      {/* Document Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-amber-200 pb-2">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-900 bg-amber-200/70 px-1.5 py-0.5 rounded">
                            {msg.generatedDoc.docType === 'creator_application' ? 'Creator Dilna Form' : 'Pawl Hriatpuina (Certificate)'}
                          </span>
                          <h4 className="font-black text-xs text-slate-950 pt-1 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-700" />
                            {msg.generatedDoc.title}
                          </h4>
                          <p className="text-[10px] text-slate-600 font-mono pt-0.5">
                            Ref: <strong className="text-slate-900">{msg.generatedDoc.refNo}</strong> • Date: {msg.generatedDoc.date}
                          </p>
                        </div>
                        <span className="text-[8.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> AI Verified
                        </span>
                      </div>

                      {/* Document Text Snippet */}
                      <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-[11px] font-serif text-slate-800 max-h-44 overflow-y-auto leading-relaxed shadow-inner">
                        <div className="text-center font-bold text-[11.5px] border-b border-slate-100 pb-1 mb-1.5 text-slate-900">
                          {msg.generatedDoc.orgName.toUpperCase()}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.generatedDoc.bodyText}</p>
                        <div className="mt-2 text-right text-[10px] font-sans font-bold text-slate-600">
                          {msg.generatedDoc.signatoryText}
                        </div>
                      </div>

                      {/* Action Bar for Generated Document */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.generatedDoc!.fullLetterText, msg.generatedDoc!.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10.5px] font-bold border border-slate-300 transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          {copiedDocId === msg.generatedDoc.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-600" />
                              <span>Copy Lehkha</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintDoc(msg.generatedDoc!)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-[10.5px] font-black border border-indigo-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Printer className="w-3 h-3 text-indigo-700" />
                          <span>Print / PDF Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(msg.generatedDoc!)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>

                        {onApplyLetterToRegistration && (
                          <button
                            type="button"
                            onClick={() => {
                              onApplyLetterToRegistration();
                            }}
                            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-[10.5px] font-black shadow-xs transition cursor-pointer flex items-center gap-1 ml-auto active:scale-95"
                          >
                            <FileCheck2 className="w-3 h-3" />
                            <span>Creator Reg-ah Hmang Rawh</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1.5 text-right font-medium ${
                      msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-600 text-[11px] bg-white p-3 rounded-2xl border border-slate-200 w-fit shadow-xs animate-pulse">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="font-bold">AI Hriatpui-in a chhang mek che / lehkha a buatsaih mek...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* DOC WIZARD / BUILDER TAB */}
        {activeTab === 'doc_wizard' && (
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 text-xs space-y-3">
            <div className="bg-indigo-900 text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 font-black text-sm text-amber-300">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Conversational Form & Certificate Studio</span>
              </div>
              <p className="text-[11px] text-slate-200">
                Pawl hming, diltu hming, leh thiltumte dah lut la, official document format thlapin AI-in a siam chhuak nghal ang.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">Lehkha Chi Hrang (Document Type)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBuilderDocType('creator_application')}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      builderDocType === 'creator_application'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-black text-xs">📝 Creator Dilna Form</div>
                    <div className="text-[9.5px] text-slate-500">RonPay Creator account hawn dilna lehkha</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBuilderDocType('hriatpuina_cert')}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      builderDocType === 'hriatpuina_cert'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-black text-xs">📜 Hriatpuina (To Whom It May Concern)</div>
                    <div className="text-[9.5px] text-slate-500">Pawl / Branch hriatpuina certificate</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10.5px] bg-slate-100 text-slate-600 p-2 rounded-xl">
                <span>💡 Example Form a nih avangin a ruakin a awm a, i duh ang zelin a hnuai text box-ah hian i chhu lut thei e.</span>
                {(builderApplicantName || builderPhone || builderOrgName || builderLocality || builderPurpose) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuilderApplicantName('');
                      setBuilderPhone('');
                      setBuilderOrgName('');
                      setBuilderLocality('');
                      setBuilderPurpose('');
                    }}
                    className="text-rose-600 font-bold hover:underline cursor-pointer shrink-0 ml-2"
                  >
                    Tifai Rawh (Clear)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block">Diltu Hming (Applicant Name)</label>
                  <input
                    type="text"
                    value={builderApplicantName}
                    onChange={(e) => setBuilderApplicantName(e.target.value)}
                    placeholder="Entirna: Diltu Hming"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block">Phone Number</label>
                  <input
                    type="tel"
                    value={builderPhone}
                    onChange={(e) => setBuilderPhone(e.target.value)}
                    placeholder="Entirna: 9862XXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block">Pawl / Branch / Kohhran Hming</label>
                  <input
                    type="text"
                    value={builderOrgName}
                    onChange={(e) => setBuilderOrgName(e.target.value)}
                    placeholder="Entirna: Pawl / Kohhran Hming"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block">Veng / Khua (Locality)</label>
                  <input
                    type="text"
                    value={builderLocality}
                    onChange={(e) => setBuilderLocality(e.target.value)}
                    placeholder="Entirna: Veng / Khua Hming"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Bawm Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'ralna', label: '🕊️ Ralna Bawm' },
                    { id: 'khawlsak', label: '🤝 Khawlsak Bawm' },
                    { id: 'rikrum', label: '🚨 Rikrum Bawm' },
                    { id: 'kumtluang', label: '🏛️ Kumtluang Bawm' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setBuilderCategory(cat.id)}
                      className={`p-1.5 rounded-lg border text-center font-bold text-[10.5px] transition cursor-pointer ${
                        builderCategory === cat.id
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block">Thiltum / Purpose</label>
                <input
                  type="text"
                  value={builderPurpose}
                  onChange={(e) => setBuilderPurpose(e.target.value)}
                  placeholder="Entirna: Tanpuina leh Bawm enkawl nan"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateCustomDoc}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Lehkha Siam Chhuak Rawh (Generate Document)</span>
              </button>
            </div>
          </div>
        )}

        {/* Q&A LIST TAB (Q1 to Q15 Guide) */}
        {activeTab === 'qna_list' && (
          <div className="flex-1 overflow-y-auto p-3.5 bg-slate-50 text-xs space-y-2.5">
            <div className="bg-slate-900 text-white p-3 rounded-2xl mb-2 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-amber-300">RonPay Knowledge Base (Q1 - Q15)</h4>
                <p className="text-[10px] text-slate-300">Zawhna hmeh la, chat box-ah fiah takin a chhang nghal ang.</p>
              </div>
              <Award className="w-5 h-5 text-amber-400 shrink-0" />
            </div>

            {RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15.map((item) => (
              <div
                key={item.qNo}
                className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 shadow-2xs hover:border-indigo-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-black text-indigo-700 text-[11px]">Q{item.qNo}: {item.question}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendMessage(item.question);
                    }}
                    className="text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition cursor-pointer shrink-0"
                  >
                    Chat-ah zawt rawh 💬
                  </button>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed pt-0.5">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Quick Suggestion Chips (Visible on Chat tab) */}
        {activeTab === 'chat' && (
          <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9.5px] font-bold text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-indigo-500" />
                Quick Prompts:
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('doc_wizard')}
                className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                + Form Wizard
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
              {/* Document Generation Prompts */}
              {QUICK_DOC_PROMPTS.map((prompt, idx) => (
                <button
                  key={'doc-' + idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt.text)}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-black rounded-full border border-amber-200 transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {prompt.label}
                </button>
              ))}

              {/* Knowledge Base Prompts */}
              {QUICK_KNOWLEDGE_PROMPTS.map((prompt, idx) => (
                <button
                  key={'kb-' + idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt.text)}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium rounded-full border border-slate-200 hover:border-indigo-200 transition cursor-pointer whitespace-nowrap shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar (Visible on Chat tab) */}
        {activeTab === 'chat' && (
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
              placeholder="RonPay chungchang zawt la, emaw 'Creator Dilna Form siam rawh' ti rawh..."
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
        )}
      </div>
    </div>
  );
};
