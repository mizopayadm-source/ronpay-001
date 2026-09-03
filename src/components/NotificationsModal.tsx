import React, { useState, useMemo } from 'react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  Receipt, 
  Megaphone, 
  Trash2, 
  CreditCard,
  Building2,
  Users
} from 'lucide-react';
import { Transaction, Campaign, CreatorProfile } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/date';

export interface AppNotification {
  id: string;
  type: 'payment' | 'announcement' | 'system' | 'bawm';
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
}) => {
  const [filter, setFilter] = useState<'all' | 'payment' | 'announcement'>('all');

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

    // Default Seed Notifications
    const now = new Date();
    return [
      {
        id: 'notif-sys-camera',
        type: 'system',
        title: 'Camera & QR Scanner Update',
        message: 'Live Camera QR Scanner leh Offline Mode a in-update tawh a, Phone App leh Browser-ah rang takin UPI QR a scan theih e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
        read: false,
        tag: 'Update'
      },
      {
        id: 'notif-sys-kumtluang',
        type: 'bawm',
        title: 'Kumtluang Member Roll',
        message: 'Kumtluang Member Roll Manager-ah bial/veng member thar registration leh chhiarna dashboard a nung reng e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
        read: false,
        tag: 'Member Roll'
      },
      {
        id: 'notif-sys-security',
        type: 'announcement',
        title: 'RonPay Direct UPI & Safety',
        message: 'RonPay hmanga sum thawh leh pekna zawng zawngte hi UPI direct-in Creator account-ah 0% fee deduction-in a lut nghal zel e.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        read: true,
        tag: 'Security'
      }
    ];
  });

  // Merge recent user transactions into notifications as receipts
  const allNotifications = useMemo(() => {
    // Convert recent 10 transactions to payment notifications
    const paymentNotifs: AppNotification[] = transactions.slice(0, 10).map(tx => {
      const isRead = notifications.find(n => n.id === `tx-notif-${tx.id}`)?.read ?? false;
      return {
        id: `tx-notif-${tx.id}`,
        type: 'payment',
        title: `Pekna Hlawhtling: ₹${tx.amount.toLocaleString('en-IN')}`,
        message: `${tx.campaignTitle || 'RonPay Bawm'}-ah ₹${tx.amount.toLocaleString('en-IN')} i pe tlang fel e. Txn: ${tx.id}`,
        timestamp: tx.timestamp,
        read: isRead,
        amount: tx.amount,
        transactionId: tx.id,
        campaignId: tx.campaignId,
        tag: 'Receipt'
      };
    });

    // Combine payment notifications with system notifications
    const combined = [...paymentNotifs];
    notifications.forEach(n => {
      if (!combined.some(c => c.id === n.id)) {
        combined.push(n);
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
    if (filter === 'payment') return n.type === 'payment';
    if (filter === 'announcement') return n.type === 'announcement' || n.type === 'system' || n.type === 'bawm';
    return true;
  });

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
              <p className="text-[11.5px] text-slate-400">Pekna receipt, thuthawn leh chanchin tharte</p>
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-2.5 bg-slate-950/40 border-b border-slate-800/60 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Zawng zawng ({allNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('payment')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'payment'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Pekna ({allNotifications.filter(n => n.type === 'payment').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('announcement')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'announcement'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Chanchin ({allNotifications.filter(n => n.type !== 'payment').length})
          </button>
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-slate-800/40">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">Hriattirna thar a awm rih lo</p>
              <p className="text-xs text-slate-500">Pekna i siam emaw, thuthawn thar a awm hunah he hmunah hian a rawn lang ang.</p>
            </div>
          ) : (
            filteredNotifications.map(notif => {
              const tx = notif.transactionId ? transactions.find(t => t.id === notif.transactionId) : undefined;
              const camp = notif.campaignId ? campaigns.find(c => c.id === notif.campaignId) : undefined;

              return (
                <div 
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id)}
                  className={`pt-2.5 first:pt-0 rounded-xl p-2.5 transition flex gap-3 cursor-pointer ${
                    notif.read ? 'bg-slate-900/40 hover:bg-slate-800/40' : 'bg-slate-800/60 hover:bg-slate-800/80 border-l-3 border-amber-500'
                  }`}
                >
                  {/* Type Icon */}
                  <div className="shrink-0 mt-0.5">
                    {notif.type === 'payment' ? (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : notif.type === 'bawm' ? (
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Users className="w-4 h-4" />
                      </div>
                    ) : notif.type === 'system' ? (
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-xs sm:text-sm font-bold truncate ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                        {notif.title}
                      </h3>
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

                    {/* Quick action buttons if applicable */}
                    <div className="pt-1 flex items-center gap-2">
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
