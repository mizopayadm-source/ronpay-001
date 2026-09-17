import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  Users, 
  X, 
  FileText, 
  Info, 
  ArrowRight,
  Eye,
  Check,
  RefreshCw,
  Phone,
  UserCheck
} from 'lucide-react';
import { Campaign, MemberRecord } from '../types';
import { 
  downloadSampleExcelTemplate, 
  downloadSampleCsvTemplate, 
  parseExcelOrCsvFile, 
  parsePastedText,
  convertToMemberRecords,
  ParsedMemberRow,
  ImportValidationResult 
} from '../utils/excelMemberImporter';
import { addBatchMembers, getMembers } from '../utils/storage';

interface KumtluangExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  selectedCampaignId?: string;
  initialMode?: 'file' | 'paste';
  onImportComplete?: (savedMembers: MemberRecord[]) => void;
}

export const KumtluangExcelImportModal: React.FC<KumtluangExcelImportModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  selectedCampaignId,
  initialMode = 'file',
  onImportComplete
}) => {
  // Target Bawm Selection
  const kumtluangCamps = campaigns.filter(c => c.category === 'kumtluang');
  const initialCamp = kumtluangCamps.find(c => c.id === selectedCampaignId) || kumtluangCamps[0];
  
  const [targetCampId, setTargetCampId] = useState<string>(initialCamp?.id || '');
  const [activeInputMode, setActiveInputMode] = useState<'file' | 'paste'>(initialMode);
  const [showSampleVisual, setShowSampleVisual] = useState<boolean>(false);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveInputMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Parsing & File state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMemberRow[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  
  // Options
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentCamp = kumtluangCamps.find(c => c.id === targetCampId) || initialCamp;
  const currentPrefix = (currentCamp?.orgCode || currentCamp?.orgName?.slice(0, 3) || 'BET').toUpperCase();

  // Handle Excel/CSV file selection
  const handleFileChange = async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setValidationError(null);
    setSelectedFileName(file.name);
    setSaveSuccessMessage(null);

    try {
      const result: ImportValidationResult = await parseExcelOrCsvFile(file);
      if (!result.success) {
        setValidationError(result.errorMessage || 'Excel file format a inmil lo.');
        setParsedRows([]);
      } else {
        setParsedRows(result.rows);
        setValidationError(null);
      }
    } catch (err: any) {
      setValidationError(err?.message || 'File chhiar a theih loh.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Parse pasted text
  const handleParseText = () => {
    if (!pastedText.trim()) return;
    setIsProcessing(true);
    setValidationError(null);
    setSaveSuccessMessage(null);

    const result = parsePastedText(pastedText);
    if (!result.success) {
      setValidationError(result.errorMessage || 'Text format a inmil lo.');
      setParsedRows([]);
    } else {
      setParsedRows(result.rows);
      setValidationError(null);
    }
    setIsProcessing(false);
  };

  // Save parsed members
  const handleConfirmSave = () => {
    if (!currentCamp || parsedRows.length === 0) return;
    setIsSaving(true);

    try {
      const existing = getMembers(currentCamp.id);
      const readyMembers = convertToMemberRecords(
        parsedRows,
        currentCamp.id,
        currentPrefix,
        existing
      );

      const res = addBatchMembers(readyMembers, overwriteDuplicates);
      setSaveSuccessMessage(
        `Members ${readyMembers.length} (Thar: ${res.added}, Update: ${res.updated}) chu "${currentCamp.title}" hnuaiah hlawhtling takin vawn fel a ni ta!`
      );

      if (onImportComplete) {
        onImportComplete(readyMembers);
      }

      // Reset preview after 2.5 seconds
      setTimeout(() => {
        setParsedRows([]);
        setSelectedFileName(null);
        setPastedText('');
      }, 2500);
    } catch (err: any) {
      setValidationError(`Data vawn luh laia buaina: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setSelectedFileName(null);
    setValidationError(null);
    setPastedText('');
    setSaveSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="kumtluang-excel-import-modal"
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in duration-200"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Excel aṭanga Member Lakluh
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-emerald-100">
                  Bulk Import
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Kumtluang Bawm-ah Excel (.xlsx) / CSV hmangin member list luh zung zung rawh le
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Campaign Selector & Quick Action Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Member Dah Luhna Tur Kumtluang Bawm:
            </label>
            <select
              value={targetCampId}
              onChange={(e) => {
                setTargetCampId(e.target.value);
                setSaveSuccessMessage(null);
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
            >
              {kumtluangCamps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.orgName || 'Kumtluang'} • Prefix: {c.orgCode || 'BET'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => downloadSampleExcelTemplate(currentPrefix)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="Download formatted sample Excel sheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sample Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSampleVisual(!showSampleVisual)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                showSampleVisual 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showSampleVisual ? 'Format Thup' : 'Format Enna'}</span>
            </button>
          </div>
        </div>

        {/* Sample Visual Card Preview (Collapsible) */}
        {showSampleVisual && (
          <div className="bg-indigo-50/70 border-b border-indigo-200 p-3.5 sm:p-4 text-xs animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-indigo-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Info className="w-4 h-4 text-indigo-600" />
                Excel Column Format Enna (Sample Preview)
              </span>
              <span className="text-[10.5px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200">
                Sl No / Roll No chhut a ngai lo • System-in auto-in a pe ang
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-indigo-200 bg-white shadow-2xs">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200 text-emerald-800">1. Hming (Name) *</th>
                    <th className="p-2 border-r border-slate-200 text-slate-700">2. Pa Hming</th>
                    <th className="p-2 border-r border-slate-200 text-slate-700">3. Phone Number</th>
                    <th className="p-2 border-r border-slate-200 text-slate-700">4. Bial / Section</th>
                    <th className="p-2 border-r border-slate-200 text-slate-700">5. Chhungkua</th>
                    <th className="p-2 text-slate-700">6. Thla Tin (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr>
                    <td className="p-2 border-r border-slate-100 font-bold text-slate-900">Lalrintluanga</td>
                    <td className="p-2 border-r border-slate-100">C. Lalthanga</td>
                    <td className="p-2 border-r border-slate-100 font-mono">9862300001</td>
                    <td className="p-2 border-r border-slate-100">Bethel Section</td>
                    <td className="p-2 border-r border-slate-100 text-[10.5px]">Lalthanpuii (Nupui), Lalruatfela (Fa)</td>
                    <td className="p-2 font-mono font-bold text-emerald-700">500</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 border-r border-slate-100 font-bold text-slate-900">Pi Zodingliani</td>
                    <td className="p-2 border-r border-slate-100">R. Kapmawia</td>
                    <td className="p-2 border-r border-slate-100 font-mono">9436100002</td>
                    <td className="p-2 border-r border-slate-100">Hmar Bial</td>
                    <td className="p-2 border-r border-slate-100 text-[10.5px]">Lalbiakdiki (Fa)</td>
                    <td className="p-2 font-mono font-bold text-emerald-700">1000</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-100 font-bold text-slate-900">Pu C. Laldinpuia</td>
                    <td className="p-2 border-r border-slate-100">Chhawnkima</td>
                    <td className="p-2 border-r border-slate-100 font-mono">9862500003</td>
                    <td className="p-2 border-r border-slate-100">Venglao Section</td>
                    <td className="p-2 border-r border-slate-100 text-slate-400 italic">—</td>
                    <td className="p-2 text-slate-400 italic">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-indigo-800 flex items-center justify-between">
              <span>💡 Column hming hi English (`Name`, `Phone`, `Section`) emaw Mizo ṭawng (`Hming`, `Bial`, `Chhungkua`) pawh hmang la a hre thiam vek ang.</span>
              <button
                type="button"
                onClick={() => downloadSampleCsvTemplate(currentPrefix)}
                className="text-indigo-900 underline font-bold hover:text-indigo-700 cursor-pointer ml-2"
              >
                CSV version download duhte tan
              </button>
            </div>
          </div>
        )}

        {/* Tab Selection: File vs Paste */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              type="button"
              onClick={() => setActiveInputMode('file')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeInputMode === 'file'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Excel / CSV File Upload (Drag & Drop)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputMode('paste')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeInputMode === 'paste'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Quick Paste (WhatsApp / Text)</span>
            </button>
          </div>

          {/* Mode 1: File Upload / Drag & Drop */}
          {activeInputMode === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 transition rounded-2xl p-6 text-center cursor-pointer space-y-2 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition shadow-2xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  {selectedFileName ? (
                    <span className="text-emerald-700 font-extrabold flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> {selectedFileName}
                    </span>
                  ) : (
                    'Click hetah hmet rawh emaw Excel File rawn hnuk lut (Drag & Drop) rawh le'
                  )}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Supports Microsoft Excel (.xlsx, .xls) leh Comma Separated (.csv)
                </p>
              </div>
            </div>
          )}

          {/* Mode 2: Quick Paste */}
          {activeInputMode === 'paste' && (
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp emaw Notes aṭanga Member list copy rawn paste rawh:</span>
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Line khatah member pakhat zel: <code>Hming, Pa Hming, Phone (digit 10), Section</code> tiin comma (,), tab emaw pipe (|) hmangin i rawn paste thei e.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPastedText(
                      `Lalrintluanga, C. Lalthanga, 9862300001, Bethel Section\n` +
                      `Pi Zodingliani, R. Kapmawia, 9436100002, Hmar Bial\n` +
                      `Pu C. Laldinpuia, Chhawnkima, 9862500003, Venglao\n` +
                      `Vanlalrema, Lalremsanga, 9774200004, Vengthlang`
                    );
                  }}
                  className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition self-start sm:self-auto cursor-pointer"
                >
                  📝 Fill Sample Text
                </button>
              </div>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Hming, Pa Hming, Phone Number, Section\nLalrintluanga, C. Lalthanga, 9862300001, Bethel Section\nPi Zodingliani, R. Kapmawia, 9436100002, Hmar Bial\nPu C. Laldinpuia, Chhawnkima, 9862500003, Venglao`}
                rows={6}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="text-[10.5px] text-emerald-800 font-medium">
                  💡 Phone number aṭangin tawp digit 4 leh Pa Hming te a in-extract nghal vek ang.
                </span>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={!pastedText.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 shrink-0 self-end sm:self-auto"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Parse Member List &rarr;</span>
                </button>
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-950">{validationError}</p>
                  <p className="text-[11px] text-rose-800">
                    Khawngaihin Sample Excel Template hi download la, a column hming awmsa (`Hming`, `Pa Hming`, `Phone`, `Bial`) ang chiah hian i list rawn dah lut rawh le.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => downloadSampleExcelTemplate(currentPrefix)}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sample Template Download Rawh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSampleVisual(true)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Format Enna Hawng Rawh</span>
                </button>
              </div>
            </div>
          )}

          {/* Save Success Message */}
          {saveSuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="font-bold">{saveSuccessMessage}</div>
            </div>
          )}

          {/* Parsed Results Live Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                    Members {parsedRows.length} hmuh a ni e (Fiah Fel):
                  </span>
                  <span className="text-[10.5px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200">
                    Prefix: {currentPrefix}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteDuplicates}
                      onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Duplicate awm chuan update rawh</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[260px] overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 text-slate-800 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-2 border-r border-slate-200">#</th>
                      <th className="p-2 border-r border-slate-200">Auto Roll ID</th>
                      <th className="p-2 border-r border-slate-200">Hming</th>
                      <th className="p-2 border-r border-slate-200">Pa Hming</th>
                      <th className="p-2 border-r border-slate-200">Phone</th>
                      <th className="p-2 border-r border-slate-200">Section</th>
                      <th className="p-2 border-r border-slate-200">Dependents</th>
                      <th className="p-2">Target (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 border-r border-slate-100 text-slate-400 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-100 font-mono font-bold text-emerald-700">
                          {currentPrefix}-{String(idx + 1).padStart(3, '0')}
                        </td>
                        <td className="p-2 border-r border-slate-100 font-bold text-slate-900">
                          {row.name}
                        </td>
                        <td className="p-2 border-r border-slate-100 text-slate-600">
                          {row.fatherName || '—'}
                        </td>
                        <td className="p-2 border-r border-slate-100 font-mono text-slate-700">
                          {row.phone || '—'}
                        </td>
                        <td className="p-2 border-r border-slate-100 text-slate-600">
                          {row.section || '—'}
                        </td>
                        <td className="p-2 border-r border-slate-100 text-[10px] text-slate-500 max-w-[150px] truncate" title={row.dependentsRaw}>
                          {row.dependentsRaw || '—'}
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-800">
                          {row.pledgeAmount ? `₹${row.pledgeAmount}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center italic">
                  Row 50 chiah preview a ni a, total members {parsedRows.length} a lut vek dawn e.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            {parsedRows.length > 0 ? (
              <span className="text-emerald-700 font-bold">
                ✓ Ready to save {parsedRows.length} members
              </span>
            ) : (
              'Excel upload zawhah a chunga button hian a vawng fel nghal ang.'
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
            >
              Kharna (Close)
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={parsedRows.length === 0 || isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Vawn fel mek...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Save All ({parsedRows.length} Members)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
