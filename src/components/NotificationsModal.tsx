import React, { useState, useMemo } from 'react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  CheckCircle2, 
  XCircle,
  ArrowRight, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  Receipt, 
  Megaphone, 
  Trash2, 
  CreditCard,
  Building2,
  Users,
  Banknote
} from 'lucide-react';
import { Transaction, Campaign, CreatorProfile } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { approveCashTransaction, rejectCashTransaction } from '../utils/storage';

export interface AppNotification {
  id: string;
  type: 'payment' | 'announcement' | 'system' | 'bawm' | 'personal' | 'general';
  categoryScope?: 'general' | 'personal';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  amount?: number;
  transactionId?: string;
  campaignId?: string;
  tag?: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  campaigns?: Campaign[];
  creatorProfile?: CreatorProfile | null;
  onOpenReceipt?: (tx: Transaction) => void;
  onNavigateToCampaign?: (campaign: Campaign) => void;
  onOpenMemberRoll?: () => void;
  onUnreadCountChange?: (count: number) => void;
  onTransactionUpdated?: (tx: Transaction) => void;
}

const STORAGE_KEY = 'ronpay_notifications_v2';

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  transactions = [],
  campaigns = [],
  creatorProfile,
  onOpenReceipt,
  onNavigateToCampaign,
  onOpenMemberRoll,
  onUnreadCountChange,
  onTransactionUpdated,
}) => {
  const [filter, setFilter] = useState<'all' | 'general' | 'personal'>('all');
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Cash pawisa dawn a ni lo');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pendingCashList = useMemo(() => {
    return transactions.filter(t => t.paymentMethod === 'cash' && t.status === 'pending_verification');
  }, [transactions]);

  const handleApproveCashInNotif = (tx: Transaction) => {
    const verifier = creatorProfile?.name || 'Bawm Creator';
    const updated = approveCashTransaction(tx.id, verifier);
    if (updated) {
      onTransactionUpdated?.(updated);
      setToastMessage(`Txn ${updated.id} chu hlawhtling takin pawm (Approved) a ni ta e!`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleRejectCashInNotif = (tx: Transaction, reason?: string) => {
    const verifier = creatorProfile?.name || 'Bawm Creator';
    const updated = rejectCashTransaction(tx.id, verifier, reason || 'Cash pawisa dawn a ni lo');
    if (updated) {
      onTransactionUpdated?.(updated);
      setRejectingTxId(null);
      setToastMessage(`Txn ${updated.id} chu hnawl (Rejected) a ni.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Load custom/system notifications with saved state
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }

    // Default Seed Notifications with General + Personal classifications
    const now = new Date();
    return [
      {
        id: 'notif-sys-camera',
        type: 'general',
        categoryScope: 'general',
        title: 'Camera & QR Scanner Update',
        message: 'Live Camera QR Scanner leh Offline Mode a in-update tawh a, Phone App leh Browser-ah rang takin UPI QR a scan theih e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
        read: false,
        tag: 'General'
      },
      {
        id: 'notif-sys-kumtluang',
        type: 'general',
        categoryScope: 'general',
        title: 'Kumtluang Member Roll Manager',
        message: 'Kumtluang Member Roll Manager-ah bial/veng member thar registration leh chhiarna dashboard a nung reng e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
        read: false,
        tag: 'General'
      },
      {
        id: 'notif-sys-security',
        type: 'general',
        categoryScope: 'general',
        title: 'RonPay Direct UPI Protocol & 0% Fee',
        message: 'RonPay hmanga sum thawh leh pekna zawng zawngte hi UPI direct-in Creator account-ah 0% fee deduction-in a lut nghal zel e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        read: true,
        tag: 'General'
      }
    ];
  });

  // Merge recent user transactions into notifications as personal notifications
  const allNotifications = useMemo(() => {
    const personalNotifs: AppNotification[] = [];

    // Convert transactions to personal notifications
    transactions.slice(0, 15).forEach(tx => {
      const isRead = notifications.find(n => n.id === `tx-notif-${tx.id}`)?.read ?? false;
      const isCash = tx.paymentMethod === 'cash';

      if (isCash) {
        if (tx.status === 'pending_verification') {
          personalNotifs.push({
            id: `tx-notif-${tx.id}`,
            type: 'personal',
            categoryScope: 'personal',
            title: `Cash Fiah Mek: ₹${tx.amount.toLocaleString('en-IN')}`,
            message: `${tx.campaignTitle || 'RonPay Bawm'}-ah ₹${tx.amount.toLocaleString('en-IN')} cash i thehlut a, Creator/Admin-in a lo enfiah mek e. (Token: ${tx.id})`,
            timestamp: tx.timestamp,
            read: isRead,
            amount: tx.amount,
            transactionId: tx.id,
            campaignId: tx.campaignId,
            tag: 'Cash Fiah Mek'
          });
        } else if (tx.status === 'completed') {
          personalNotifs.push({
            id: `tx-notif-${tx.id}`,
            type: 'personal',
            categoryScope: 'personal',
            title: `Cash Dawn Fel: ₹${tx.amount.toLocaleString('en-IN')}`,
            message: `${tx.campaignTitle || 'RonPay Bawm'}-ah ₹${tx.amount.toLocaleString('en-IN')} cash pek chu ${tx.verifiedBy || 'Creator/Admin'}-in a dawng fel ta e.`,
            timestamp: tx.verifiedAt || tx.timestamp,
            read: isRead,
            amount: tx.amount,
            transactionId: tx.id,
            campaignId: tx.campaignId,
            tag: 'Cash Dawng Fel'
          });
        } else if (tx.status === 'rejected') {
          personalNotifs.push({
            id: `tx-notif-${tx.id}`,
            type: 'personal',
            categoryScope: 'personal',
            title: `Cash Hnawl A Ni: ₹${tx.amount.toLocaleString('en-IN')}`,
            message: `${tx.campaignTitle || 'RonPay Bawm'}-ah ₹${tx.amount.toLocaleString('en-IN')} cash pek chu hnawl a ni. ${tx.rejectionReason ? `Chhan: ${tx.rejectionReason}` : ''}`,
            timestamp: tx.rejectedAt || tx.timestamp,
            read: isRead,
            amount: tx.amount,
            transactionId: tx.id,
            campaignId: tx.campaignId,
            tag: 'Cash Hnawl'
          });
        }
      } else {
        // Online UPI payment
        personalNotifs.push({
          id: `tx-notif-${tx.id}`,
          type: 'personal',
          categoryScope: 'personal',
          title: `Online UPI Pekna Fel: ₹${tx.amount.toLocaleString('en-IN')}`,
          message: `${tx.campaignTitle || 'RonPay Bawm'}-ah ₹${tx.amount.toLocaleString('en-IN')} i pe tlang fel e. Txn: ${tx.id}`,
          timestamp: tx.timestamp,
          read: isRead,
          amount: tx.amount,
          transactionId: tx.id,
          campaignId: tx.campaignId,
          tag: 'UPI Receipt'
        });
      }
    });

    // Combine personal notifications with general/system notifications
    const combined = [...personalNotifs];
    notifications.forEach(n => {
      if (!combined.some(c => c.id === n.id)) {
        // Ensure categoryScope is assigned
        const withScope: AppNotification = {
          ...n,
          categoryScope: n.categoryScope || (n.type === 'personal' || n.type === 'payment' ? 'personal' : 'general')
        };
        combined.push(withScope);
      }
    });

    // Sort newest first
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, notifications]);

  // Sync unread count back to parent header
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  React.useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  if (!isOpen) return null;

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    // If it's a tx-notif not yet in local state, save it
    if (!updated.some(n => n.id === id)) {
      const notif = allNotifications.find(n => n.id === id);
      if (notif) {
        updated.push({ ...notif, read: true });
      }
    }
    setNotifications(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = () => {
    const updated = allNotifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
  };

  const filteredNotifications = allNotifications.filter(n => {
    if (filter === 'general') {
      return n.categoryScope === 'general' || n.type === 'general' || n.type === 'system' || n.type === 'announcement' || n.type === 'bawm';
    }
    if (filter === 'personal') {
      return n.categoryScope === 'personal' || n.type === 'personal' || n.type === 'payment';
    }
    return true;
  });

  const generalCount = allNotifications.filter(n => n.categoryScope === 'general' || n.type === 'general' || n.type === 'system' || n.type === 'announcement' || n.type === 'bawm').length;
  const personalCount = allNotifications.filter(n => n.categoryScope === 'personal' || n.type === 'personal' || n.type === 'payment').length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">Hriattirna (Notifications)</h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black text-white">
                    {unreadCount} thar
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-400">General & Personal information, receipts leh updates</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                title="Chhiar vek tawh angin dah rawh"
                className="p-1.5 text-xs text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition flex items-center gap-1 cursor-pointer font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Chhiar vek</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs: All, General, Personal */}
        <div className="flex items-center gap-1 p-2 bg-slate-950/40 border-b border-slate-800/60 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-center transition cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            All ({allNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('general')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'general'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            General ({generalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('personal')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'personal'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Personal ({personalCount})
          </button>
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {/* Toast Message */}
          {toastMessage && (
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-between animate-fadeIn mb-2">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Pending Cash Approvals Queue Alert */}
          {pendingCashList.length > 0 && (
            <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/90 border-2 border-amber-500/50 rounded-2xl p-3.5 space-y-2 text-xs shadow-md animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs animate-pulse">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>💰 Cash Fiah Ngai ({pendingCashList.length}) A Awm!</span>
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Bawm Siamtu / Admin tan pawisa i dawn fel tawh chuan lo pawm (Approve) rawh le.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilter('personal')}
                  className="px-2 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-[10px] font-black rounded-lg cursor-pointer transition shrink-0"
                >
                  En Rawh
                </button>
              </div>
            </div>
          )}

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">Hriattirna a awm rih lo</p>
              <p className="text-xs text-slate-500">I thlan category-ah hian hriattirna thar a la awm lo e.</p>
            </div>
          ) : (
            filteredNotifications.map(notif => {
              const tx = notif.transactionId ? transactions.find(t => t.id === notif.transactionId) : undefined;
              const camp = notif.campaignId ? campaigns.find(c => c.id === notif.campaignId) : undefined;
              const isPersonal = notif.categoryScope === 'personal' || notif.type === 'personal' || notif.type === 'payment';
              const isPendingCash = tx && tx.paymentMethod === 'cash' && tx.status === 'pending_verification';

              return (
                <div 
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id)}
                  className={`rounded-2xl p-3 transition flex gap-3 cursor-pointer ${
                    isPendingCash
                      ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/60 shadow-md'
                      : notif.read
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 border border-slate-800/60'
                      : 'bg-slate-800/60 hover:bg-slate-800/80 border-l-4 border-l-amber-500 border border-slate-700/60'
                  }`}
                >
                  {/* Type Icon */}
                  <div className="shrink-0 mt-0.5">
                    {isPendingCash ? (
                      <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black animate-pulse shadow-xs">
                        <Clock className="w-4 h-4 text-slate-950" />
                      </div>
                    ) : isPersonal ? (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Receipt className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className={`text-xs sm:text-sm font-bold truncate ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h3>
                        {/* General / Personal badge */}
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                          isPendingCash
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : isPersonal 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        }`}>
                          {isPendingCash ? 'ACTION REQUIRED' : isPersonal ? 'Personal' : 'General'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
                        )}
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDateTimeDDMMYYYY(notif.timestamp)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11.5px] text-slate-400 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    {/* DIRECT APPROVAL / REJECTION PANEL FOR CREATORS & ADMINS */}
                    {isPendingCash && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/40 space-y-2 bg-slate-950/70 p-3 rounded-xl border border-amber-500/30">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Cash Pawisa Dawng Fel Rawh:
                          </span>
                          <span className="font-black text-emerald-400 text-sm">
                            ₹{tx.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 flex justify-between gap-2">
                          <span className="truncate">Petu: <b className="text-white">{tx.donorName}</b></span>
                          <span className="truncate">Bawm: <b className="text-indigo-300">{tx.campaignTitle || tx.campaignId}</b></span>
                        </div>

                        {rejectingTxId === tx.id ? (
                          <div className="space-y-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] text-rose-300 font-bold block">
                              Hnawlna Chhan (Rejection Reason):
                            </label>
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Cash a lo thleng lo / a dik lo..."
                              className="w-full bg-slate-900 border border-rose-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                            <div className="flex gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleRejectCashInNotif(tx, rejectReason)}
                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer transition shadow-xs"
                              >
                                Hnawlna Nemnghet Rawh
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingTxId(null)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                              >
                                Sut
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveCashInNotif(tx);
                              }}
                              className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm active:scale-[0.98]"
                            >
                              <CheckCircle2 className="w-4 h-4 text-slate-950" />
                              Pawisa Ka Dawng Fel (Approve)
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectingTxId(tx.id);
                              }}
                              className="py-2 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Hnawl
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick action buttons if applicable */}
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      {tx && onOpenReceipt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                            onClose();
                            onOpenReceipt(tx);
                          }}
                          className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10.5px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                        >
                          <Receipt className="w-3 h-3" /> Receipt Enna
                        </button>
                      )}

                      {camp && onNavigateToCampaign && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                            onClose();
                            onNavigateToCampaign(camp);
                          }}
                          className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-[10.5px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                        >
                          <Building2 className="w-3 h-3" /> Bawm Hawng Rawh
                        </button>
                      )}

                      {notif.type === 'bawm' && onOpenMemberRoll && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                            onClose();
                            onOpenMemberRoll();
                          }}
                          className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10.5px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                        >
                          <Users className="w-3 h-3" /> Member Roll Hawng Rawh
                        </button>
                      )}

                      {notif.tag && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9.5px] font-semibold text-slate-400">
                          {notif.tag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={handleClearNotifications}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-400 transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Paihfai vek rawh
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition cursor-pointer text-xs"
          >
            Kharna
          </button>
        </div>
      </div>
    </div>
  );
};
