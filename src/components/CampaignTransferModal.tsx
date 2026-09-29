import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  User, 
  CreditCard, 
  FileText,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { Campaign, CreatorProfile } from '../types';
import { saveCampaign, getStoredCreatorsList, saveStoredCreatorsList, recordAuditLog } from '../utils/storage';

interface CampaignTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  currentCreator: CreatorProfile | null;
  onTransferred: (updatedCampaign: Campaign) => void;
}

export const CampaignTransferModal: React.FC<CampaignTransferModalProps> = ({
  isOpen,
  onClose,
  campaign,
  currentCreator,
  onTransferred,
}) => {
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerPhone, setNewOfficerPhone] = useState('');
  const [designation, setDesignation] = useState('Treasurer');
  const [newUpiId, setNewUpiId] = useState('');
  const [transferReason, setTransferReason] = useState('Term inthlak / Annual Office Bearer Handover');
  const [acknowledged, setAcknowledged] = useState(false);
  const [keepOldOfficerAsCoOfficer, setKeepOldOfficerAsCoOfficer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !campaign) return null;

  const currentCreatorName = campaign.creatorName || campaign.contactPerson || currentCreator?.name || 'Current Creator';
  const currentCreatorPhone = campaign.createdBy || campaign.contactPhone || currentCreator?.phone || 'Unknown';

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = newOfficerName.trim();
    const cleanPhone = newOfficerPhone.trim().replace(/\D/g, '');
    const cleanUpi = newUpiId.trim();
    const cleanReason = transferReason.trim();

    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Hming ziah ngei tur a ni (minimum 3 characters).');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Phone number 10 digits ziah ngei tur a ni.');
      return;
    }

    if (!acknowledged) {
      setErrorMsg('Bawm enkawlna hlan chhawnna hi i pawm ngei tur a ni.');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const existingAuthorized = campaign.authorizedOfficers || [];
      const updatedAuthorized = keepOldOfficerAsCoOfficer
        ? [
            ...existingAuthorized.filter(o => o.phone.replace(/\D/g, '').slice(-10) !== currentCreatorPhone.replace(/\D/g, '').slice(-10)),
            {
              name: currentCreatorName,
              phone: currentCreatorPhone,
              role: 'Outgoing Officer / Co-Manager'
            }
          ]
        : existingAuthorized;

      const updatedCampaign: Campaign = {
        ...campaign,
        createdBy: cleanPhone,
        creatorName: `${cleanName} (${designation})`,
        contactPerson: cleanName,
        contactPhone: cleanPhone,
        upiId: cleanUpi || campaign.upiId,
        targetUpiId: cleanUpi || campaign.targetUpiId || campaign.upiId,
        authorizedOfficers: updatedAuthorized,
        transferredAt: now,
        transferredFrom: currentCreatorPhone,
        transferredTo: cleanPhone,
        transferHistory: [
          ...(campaign.transferHistory || []),
          {
            fromName: currentCreatorName,
            fromPhone: currentCreatorPhone,
            toName: `${cleanName} (${designation})`,
            toPhone: cleanPhone,
            transferredAt: now,
            reason: cleanReason
          }
        ],
        updatedAt: now
      };

      // 1. Save updated campaign locally and trigger sync to cloud
      saveCampaign(updatedCampaign);
      window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated'));

      // 2. Ensure new officer is registered in creators list for seamless login
      const creators = getStoredCreatorsList();
      const exists = creators.some(c => c.phone && c.phone.replace(/\D/g, '').slice(-10) === cleanPhone.slice(-10));
      if (!exists) {
        const newCreatorRecord: CreatorProfile = {
          id: `creator-${Date.now()}`,
          phone: cleanPhone,
          name: `${cleanName} (${designation})`,
          orgName: campaign.orgName || campaign.title,
          category: campaign.category,
          upiId: cleanUpi || campaign.upiId,
          targetUpiId: cleanUpi || campaign.targetUpiId,
          isVerified: true,
          isApproved: true,
          status: 'approved',
          approvedCategories: [campaign.category],
          createdAt: now
        };
        saveStoredCreatorsList([newCreatorRecord, ...creators]);
      } else {
        const updatedCreators = creators.map(c => {
          if (c.phone && c.phone.replace(/\D/g, '').slice(-10) === cleanPhone.slice(-10)) {
            const currentApproved = c.approvedCategories || [];
            return {
              ...c,
              approvedCategories: Array.from(new Set([...currentApproved, campaign.category]))
            };
          }
          return c;
        });
        saveStoredCreatorsList(updatedCreators);
      }

      // 3. Record Audit Log for governance and transparency
      recordAuditLog(
        'Campaign Handover / Transferred',
        `Campaign "${campaign.title}" (${campaign.id}) was handed over from ${currentCreatorName} (${currentCreatorPhone}) to ${cleanName} (${cleanPhone} - ${designation}). Reason: ${cleanReason}`,
        'campaign',
        campaign.id
      );

      onTransferred(updatedCampaign);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Handover failed. Khawngaihin check nawn rawh.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">Creator Inhlan Chhawnna</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Kum tin Office Bearer / Treasurer inthlak vanga Bawm enkawlna inhlan
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Campaign Info Pill */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bawm:</span>
            <span className="font-bold text-slate-800">{campaign.title} [{campaign.orgCode || 'QR'}]</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tun a Enkawltu (Current Creator):</span>
            <span className="font-medium text-slate-700">{currentCreatorName} ({currentCreatorPhone})</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">
              Enkawltu Thar Hming (New Officer Name) *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={newOfficerName}
                onChange={(e) => setNewOfficerName(e.target.value)}
                placeholder="e.g. Lalmuanpuia"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                Phone Number (New Officer) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={newOfficerPhone}
                  onChange={(e) => setNewOfficerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="e.g. 9862300000"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                Kovah / Designation *
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Treasurer">Treasurer</option>
                <option value="Finance Secretary">Finance Secretary</option>
                <option value="Leader / Chairman">Leader / Chairman</option>
                <option value="Secretary">Secretary</option>
                <option value="Cashier">Cashier</option>
                <option value="Committee Member">Committee Member</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">
              Sum Dawnna UPI ID Thar (Optional - A danglam chuan chhu rawh)
            </label>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={newUpiId}
                onChange={(e) => setNewUpiId(e.target.value.trim().toLowerCase())}
                placeholder={campaign.upiId || 'e.g. kohhran.treasurer@oksbi'}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              * A ngai reng i duh chuan ruak-in dah rawh: <span className="font-mono text-slate-700">{campaign.upiId}</span>
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">
              Inhlan Chhawn Chhan / Term Chhinchhiahna *
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Kum 2026-2027 Term Inthlan thar vanga inhlan"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Warning & Acknowledgment */}
          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-snug">
                He Bawm hi a chunga mi hnenah hian hlan a nih hnuah chuan amah hian <strong>Bawm enkawl theihna (Member roll, Report leh Cash entry)</strong> a nei tawh ang a, i phone number atangin enkawl theihna chu thar hnenah a in-transfer ang.
              </p>
            </div>
            <label className="flex items-center gap-2 pt-1 border-t border-amber-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={keepOldOfficerAsCoOfficer}
                onChange={(e) => setKeepOldOfficerAsCoOfficer(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="font-bold text-[11px] text-slate-800">
                Enkawltu hlui hi Co-Officer / Assistant-ah la dah ve rawh (Transition period support)
              </span>
            </label>
            <label className="flex items-center gap-2 pt-1 border-t border-amber-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="font-bold text-[11px] text-amber-950">
                A chunga mi hi ka pawm a, hlan chhawn ka remti e.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !acknowledged}
              className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hlan mek...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Inhlan Chhawng Rawh</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
