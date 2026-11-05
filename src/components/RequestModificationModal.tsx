import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Clock, 
  ShieldAlert, 
  FileText,
  UserCheck,
  Calendar
} from 'lucide-react';
import { ModificationRequest, CreatorProfile } from '../types';
import { saveModificationRequest } from '../utils/storage';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

export interface LockedRecordInfo {
  recordId: string;
  recordType: 'TRANSACTION' | 'EXPENSE';
  campaignId: string;
  campaignTitle?: string;
  amount: number;
  title: string;
  isLocked: boolean;
  lockedBy?: string;
  auditDate?: string;
  auditPeriod?: string;
}

interface RequestModificationModalProps {
  isOpen: boolean;
  record: LockedRecordInfo | null;
  creatorProfile?: CreatorProfile | null;
  onClose: () => void;
  onSubmitted?: (request: ModificationRequest) => void;
}

export const RequestModificationModal: React.FC<RequestModificationModalProps> = ({
  isOpen,
  record,
  creatorProfile,
  onClose,
  onSubmitted
}) => {
  const [requestedAction, setRequestedAction] = useState<'EDIT' | 'DELETE'>('EDIT');
  const [reasonNote, setReasonNote] = useState<string>('');
  const [requesterName, setRequesterName] = useState<string>(creatorProfile?.name || '');
  const [requesterPhone, setRequesterPhone] = useState<string>(creatorProfile?.phone || creatorProfile?.phoneNumber || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRequest, setSuccessRequest] = useState<ModificationRequest | null>(null);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reasonNote.trim();
    if (trimmedReason.length < 8) {
      setErrorMessage('Khawngaihin tih danglam chhan (Reason Note) chiang takin ziak rawh (A tlem berah hawrawp 8 a ni tur a ni).');
      return;
    }

    if (!requesterName.trim()) {
      setErrorMessage('Diltu hming (Requester Name) ziah tel a ngai e.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const newRequest: ModificationRequest = {
        id: `MOD_REQ_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        recordId: record.recordId,
        record_id: record.recordId,
        recordType: record.recordType,
        record_type: record.recordType,
        campaignId: record.campaignId,
        campaign_id: record.campaignId,
        campaignTitle: record.campaignTitle || '',
        campaign_title: record.campaignTitle || '',
        requestedBy: requesterName.trim(),
        requested_by: requesterName.trim(),
        requested_by_phone: requesterPhone.trim(),
        requestedAction: requestedAction,
        requested_action: requestedAction,
        reasonNote: trimmedReason,
        reason_note: trimmedReason,
        status: 'pending',
        record_summary: {
          amount: record.amount,
          title: record.title,
          audit_period: record.auditPeriod
        },
        createdAt: nowIso,
        created_at: nowIso,
        updatedAt: nowIso,
        updated_at: nowIso
      };

      saveModificationRequest(newRequest);
      setSuccessRequest(newRequest);
      if (onSubmitted) {
        onSubmitted(newRequest);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Request thehluh theih a ni rih lo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setReasonNote('');
    setErrorMessage(null);
    setSuccessRequest(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/40 flex items-center justify-center border border-amber-300/40 shadow-inner">
              <Lock className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight">Audit Locked Record</h3>
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-400/40">
                  Maker-Checker
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Modification Request thehluhna (Admin Approval Required)
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/90 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {successRequest ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-black text-slate-900">
                Modification Request Thehluh Fel A Ni E!
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                He record tih danglamna dilna hi <span className="font-bold text-slate-800">Admin Approval Console</span>-ah thehluh a ni a. Admin-in a approve hunah record hi temporary unlock a ni ang a, audit log-ah record thlap a ni ang.
              </p>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-left text-xs font-mono text-slate-700 space-y-1">
                <div><span className="text-slate-400">Request ID:</span> {successRequest.id}</div>
                <div><span className="text-slate-400">Record ID:</span> {successRequest.record_id}</div>
                <div><span className="text-slate-400">Action:</span> {successRequest.requested_action}</div>
                <div><span className="text-slate-400">Status:</span> <span className="text-amber-700 font-bold uppercase">Pending Admin Review</span></div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow transition"
                >
                  Kharchhunzawn Rawh
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Record Summary Box */}
              <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                    Record Lock Status
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 border border-amber-300">
                    🔒 LOCKED
                  </span>
                </div>
                <div className="text-xs text-slate-700 space-y-1 font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Record:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]">{record.title}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Pawisa Zat:</span>
                    <span className="font-black text-amber-900 text-sm">₹{Number(record.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Record ID:</span>
                    <span className="font-mono text-[11px] text-slate-600">{record.recordId}</span>
                  </div>
                  {record.lockedBy && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Auditor Lock-tu:</span>
                      <span className="font-semibold text-slate-800">{record.lockedBy}</span>
                    </div>
                  )}
                  {record.auditPeriod && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Audit Period:</span>
                      <span className="font-semibold text-slate-800">{record.auditPeriod}</span>
                    </div>
                  )}
                  {record.auditDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Audited On:</span>
                      <span className="text-slate-600">{formatDateDDMMYYYY(record.auditDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explanatory Banner */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  Sum Endiktu (Auditor)-in a audit fel hnu record a nih avangin direct-in edit emaw delete theih a ni lo. Tih danglam chhan (Note) ziak lut la, Admin-in a pawmpui hnuah record hi temporary-in a unlock ang.
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Thiltih Duh (Requested Action)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestedAction('EDIT')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        requestedAction === 'EDIT'
                          ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Siamthat (Edit)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestedAction('DELETE')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        requestedAction === 'DELETE'
                          ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Paih Fai (Delete)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tih Danglam Chhan Note (Reason for Modification) *
                  </label>
                  <textarea
                    required
                    value={reasonNote}
                    onChange={e => setReasonNote(e.target.value)}
                    rows={3}
                    placeholder="Entirnan: Voucher number thil tihsual siamthat a ngai / Pawisa zat entry dik lo siamrem nan..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-400">
                    Admin-in request a lo check theih nan note fiah tak ziak lut rawh.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Diltu Hming (Requester)
                    </label>
                    <input
                      type="text"
                      value={requesterName}
                      onChange={e => setRequesterName(e.target.value)}
                      placeholder="I Hming"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={requesterPhone}
                      onChange={e => setRequesterPhone(e.target.value)}
                      placeholder="10 digit phone number"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Thulh Leh Rawh
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Thehlut mek...' : 'Request Thehlut Rawh'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
