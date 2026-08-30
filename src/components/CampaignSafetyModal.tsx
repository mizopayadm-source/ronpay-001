import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Ban, 
  Edit3, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Info, 
  History, 
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Campaign, Transaction, CreatorProfile } from '../types';
import { 
  getCampaignFinancialStats, 
  deleteZeroBalanceCampaign, 
  voidAndCancelCampaign 
} from '../utils/campaignSafety';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

interface CampaignSafetyModalProps {
  campaign: Campaign;
  transactions?: Transaction[];
  currentUser?: CreatorProfile | null;
  initialMode?: 'auto' | 'delete' | 'void';
  onClose: () => void;
  onDeleted: (campaignId: string) => void;
  onVoided: (updated: Campaign) => void;
  onEditRequested?: (campaign: Campaign) => void;
}

export const CampaignSafetyModal: React.FC<CampaignSafetyModalProps> = ({
  campaign,
  transactions = [],
  currentUser,
  initialMode = 'auto',
  onClose,
  onDeleted,
  onVoided,
  onEditRequested
}) => {
  const stats = getCampaignFinancialStats(campaign, transactions);
  const isZeroBalance = stats.isZeroBalance;
  const isAlreadyVoided = campaign.status === 'voided' || campaign.isVoided;

  const [activeTab, setActiveTab] = useState<'void' | 'delete'>(
    initialMode === 'delete' && isZeroBalance ? 'delete' : 'void'
  );

  const [reason, setReason] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Performer Identity
  const performerName = currentUser?.name 
    ? `${currentUser.name} (${currentUser.phone})`
    : currentUser?.isAdmin 
    ? 'Admin (Platform)' 
    : 'System Administrator';
  const roleName = currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'CREATOR');

  const zeroBalancePresets = [
    'Siam sual palh (Mistake entry)',
    'Test / Demo siam chhinna',
    'Duplicate / A inang awmsa',
    'A tul tawh lo (No longer needed)',
    'Creator ngenna vanga paih bo'
  ];

  const voidPresets = [
    'Target / Goal thleng tawh',
    'Chhiatni / Project a zo fel tawh',
    'Emergency dinhmun a ziaawm tawh',
    'Creator ngenna vanga tihtawp',
    'Bawm dang nena fin / zawm',
    'Account / Settlement UPI thlak ngai'
  ];

  const handleSelectPreset = (preset: string) => {
    setSelectedPreset(preset);
    setReason(preset);
  };

  // Rule 1: Delete Zero-Balance Campaign
  const handleConfirmDelete = async () => {
    if (!isZeroBalance) {
      setErrorMessage('Safety Lock: Pawisa lut tawh Bawm chu hard delete theih a ni lo.');
      return;
    }

    const finalReason = reason.trim() || selectedPreset || 'Zero-balance Bawm siam sual paih bo';
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await deleteZeroBalanceCampaign(campaign, finalReason, performerName, roleName, transactions);
      onDeleted(campaign.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Delete hlawhtling lo. Khawngaihin try nawn rawh.');
      setIsProcessing(false);
    }
  };

  // Rule 2: Cancel & Void Campaign (Keeps financial ledger)
  const handleConfirmVoid = async () => {
    const finalReason = reason.trim() || selectedPreset;
    if (!finalReason) {
      setErrorMessage('Khawngaihin he Bawm i tihhlum/void chhan (Reason) ziak rawh.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await voidAndCancelCampaign(campaign, finalReason, performerName, roleName, transactions);
      onVoided(res.updatedCampaign);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Void hlawhtling lo. Khawngaihin try nawn rawh.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto relative">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs shrink-0 ${
              isZeroBalance ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {isZeroBalance ? <Trash2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 text-amber-700" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  {isZeroBalance ? 'Bawm Siam Sual Paih Bo (Delete)' : 'Bawm Safety Net & Management'}
                </h3>
                {isZeroBalance ? (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ₹0 Collected
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Ledger Protected
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono truncate max-w-[260px] sm:max-w-xs">
                {campaign.title} ({campaign.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-start gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Financial Summary Card */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-[11px] font-medium">Bawm Hming:</span>
            <span className="font-bold text-slate-900">{campaign.title}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-[11px] font-medium">Pawisa Lut Tawh (Collected):</span>
            <span className={`font-black text-xs sm:text-sm ${stats.totalCollected > 0 ? 'text-emerald-700 font-mono' : 'text-slate-700'}`}>
              ₹{stats.totalCollected.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-[11px] font-medium">Transactions zat:</span>
            <span className="font-bold text-slate-800">{stats.txnCount} donors / records</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-[11px] font-medium">Current Status:</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
              campaign.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
              campaign.status === 'voided' ? 'bg-rose-100 text-rose-800' :
              campaign.status === 'expired' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
            }`}>
              {campaign.status || 'Active'}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CASE 1: ZERO-BALANCE BAWM (₹0 Collected)                  */}
        {/* ========================================================= */}
        {isZeroBalance && (
          <div className="space-y-3.5 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-emerald-950 text-xs sm:text-sm">
                  1. Zero-Balance Bawm (Paih bo a him e)
                </h4>
                <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                  Tuma'n pawisa an la chhung luh loh (₹0 / 0 txns) avangin, he Bawm hi database atangin a paih bo (delete) hlen theih e.
                </p>
              </div>
            </div>

            {/* Reason Presets */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider">
                Paih bo chhan (Audit Reason):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {zeroBalancePresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer border ${
                      selectedPreset === p 
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs' 
                        : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setSelectedPreset('');
                }}
                placeholder="Or type custom reason (e.g. Test QR siam chhinna a ni e)..."
                className="w-full mt-1 p-2 bg-white border border-emerald-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
              >
                Kansel / Sut Leh
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {isProcessing ? 'Paih mek...' : 'Paih Bo Hlen Rawh (Delete)'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CASE 2: PAWISA LUT TAWH BAWM (> ₹0 / Has Transactions)    */}
        {/* ========================================================= */}
        {!isZeroBalance && (
          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs sm:text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>2. Financial Safety Lock: Hard Delete Theih A Ni Lo</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                He Bawm ah hian pawisa <b>₹{stats.totalCollected.toLocaleString('en-IN')}</b> ({stats.txnCount} transactions) a luh tawh avangin, donor receipts leh audit trail him nan <b>Hard Delete theih a ni lo</b>.
              </p>
              <p className="text-[10.5px] text-amber-800 font-medium">
                A hnuaia option pahnih te hi i hmang thei ang:
              </p>
            </div>

            {/* Option A: Edit Details */}
            <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  Option A: Edit Details (A Hming & Thuziak Siamtha Rawh)
                </p>
                <p className="text-[10.5px] text-indigo-800">
                  Hming, description, contact details leh photo siamthat nan.
                </p>
              </div>
              {onEditRequested && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditRequested(campaign);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                >
                  Edit Rawh <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Option B: Cancel & Void Campaign */}
            <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200 space-y-3">
              <div>
                <p className="font-black text-rose-950 text-xs flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  Option B: Cancel & Void Campaign (Mipui Hmuh Theih Lova Hmehhlum)
                </p>
                <p className="text-[10.5px] text-rose-800 mt-0.5">
                  Public payment & QR chhunluh a tawp anga, pawisa lut tawh leh donor records erawh audit leh accounting tan a him reng ang.
                </p>
              </div>

              {isAlreadyVoided ? (
                <div className="p-2.5 bg-white rounded-xl border border-rose-300 text-xs space-y-1">
                  <span className="font-bold text-rose-800 block">⚠️ He Bawm hi Voided / Cancelled a ni tawh:</span>
                  <p className="text-[11px] text-slate-700">Chhan: {campaign.voidReason || campaign.approvalRemarks}</p>
                  {campaign.voidedAt && (
                    <p className="text-[10px] text-slate-500">Hun: {formatDateTimeDDMMYYYY(campaign.voidedAt)} ({campaign.voidedBy || 'Admin'})</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Void Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-rose-900 uppercase tracking-wider">
                      Hmehhlum chhan (Audit Reason - Mandatory):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {voidPresets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer border ${
                            selectedPreset === p 
                              ? 'bg-rose-700 text-white border-rose-800 shadow-2xs' 
                              : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setSelectedPreset('');
                      }}
                      placeholder="Type custom reason (e.g. Chhiatni thil a zo fel tawh e)..."
                      className="w-full mt-1 p-2 bg-white border border-rose-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600"
                    />
                  </div>

                  {/* Void Action Button */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
                    >
                      Kansel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmVoid}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      {isProcessing ? 'Hmehhlum mek...' : 'Hmehhlum Rawh (Cancel & Void)'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Audit Footer Notice */}
        <div className="bg-slate-100 p-2.5 rounded-xl text-[10.5px] text-slate-500 flex items-center gap-1.5 font-medium">
          <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            <b>3. Audit Trail:</b> He action leh reason hi System Audit Log-ah <b>{performerName}</b> hmingin a in-record nghal ang.
          </span>
        </div>

      </div>
    </div>
  );
};
