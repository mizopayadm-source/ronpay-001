import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  CheckCircle2, 
  XCircle,
  Clock, 
  Sparkles, 
  ShieldCheck, 
  Receipt, 
  Megaphone, 
  Trash2, 
  Building2,
  Users,
  Banknote,
  Lock,
  ExternalLink,
  Shield,
  Layers,
  User,
  AlertCircle,
  Check
} from 'lucide-react';
import { Transaction, Campaign, CreatorProfile } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { 
  approveCashTransaction, 
  rejectCashTransaction, 
  canApproveCashPayment, 
  isCampaignCreator, 
  getStoredUserPaidTxIds 
} from '../utils/storage';
import { getUserRole } from '../utils/rbac';
import { BiometricAuthModal } from './BiometricAuthModal';

export interface AppNotification {
  id: string;
  type: 'payment' | 'announcement' | 'system' | 'bawm' | 'personal' | 'general' | 'campaign_review' | 'cash_approval';
  categoryScope: 'general' | 'personal'; // 'general' = Common (Tlangpui), 'personal' = Private (Ta Bik)
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  amount?: number;
  transactionId?: string;
  campaignId?: string;
  campaign?: Campaign;
  transaction?: Transaction;
  tag?: string;
  canApproveCash?: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  campaigns?: Campaign[];
  creatorProfile?: CreatorProfile | null;
  onOpenReceipt?: (tx: Transaction) => void;
  onNavigateToCampaign?: (campaign: Campaign) => void;
  onOpenCampaignReview?: (campaign: Campaign) => void;
  onOpenMemberRoll?: () => void;
  onUnreadCountChange?: (count: number) => void;
  onTransactionUpdated?: (tx: Transaction) => void;
}

const STORAGE_KEY = 'ronpay_notifications_v2';

const formatRupees = (val?: number | string | null): string => {
  if (val === undefined || val === null || val === '') return '0';
  const num = Number(val);
  return isNaN(num) ? '0' : num.toLocaleString('en-IN');
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  transactions = [],
  campaigns = [],
  creatorProfile,
  onOpenReceipt,
  onNavigateToCampaign,
  onOpenCampaignReview,
  onOpenMemberRoll,
  onUnreadCountChange,
  onTransactionUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'common' | 'private'>('all');
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Cash pawisa dawn a ni lo');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Determine current user's role hierarchy & permissions
  const userRole = useMemo(() => getUserRole(creatorProfile), [creatorProfile]);
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || !!creatorProfile?.isAdmin;
  const isModerator = userRole === 'MODERATOR';
  const isCreator = userRole === 'CREATOR' || (!!creatorProfile?.isApproved && !isAdmin && !isModerator);
  const isGeneralMember = !isAdmin && !isModerator && !isCreator;

  // Stored read-states
  const [readStateMap, setReadStateMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const map: Record<string, boolean> = {};
          parsed.forEach((item: any) => {
            if (item && item.id) map[item.id] = !!item.read;
          });
          return map;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  // Biometric Guard for Cash Approval / Rejection in Notifications
  const [isBiometricOpen, setIsBiometricOpen] = useState<boolean>(false);
  const [pendingBiometricAction, setPendingBiometricAction] = useState<'approve' | 'reject'>('approve');
  const [pendingBiometricTx, setPendingBiometricTx] = useState<Transaction | null>(null);
  const [pendingRejectReason, setPendingRejectReason] = useState<string>('Cash pawisa dawn a ni lo');

  // Handle cash approval
  const handleApproveCashInNotif = (tx: Transaction) => {
    const auth = canApproveCashPayment(tx, campaigns, creatorProfile);
    if (!auth.allowed) {
      setToastMessage(`⚠️ ${auth.reason || 'He cash pekna hi approve phalna i nei lo.'}`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    setPendingBiometricTx(tx);
    setPendingBiometricAction('approve');
    setIsBiometricOpen(true);
  };

  // Handle cash rejection
  const handleRejectCashInNotif = (tx: Transaction, reason?: string) => {
    const auth = canApproveCashPayment(tx, campaigns, creatorProfile);
    if (!auth.allowed) {
      setToastMessage(`⚠️ ${auth.reason || 'He cash pekna hi hnawl phalna i nei lo.'}`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    setPendingBiometricTx(tx);
    setPendingRejectReason(reason || 'Cash pawisa dawn a ni lo');
    setPendingBiometricAction('reject');
    setIsBiometricOpen(true);
  };

  const handleBiometricSuccess = () => {
    setIsBiometricOpen(false);
    if (!pendingBiometricTx) return;

    const verifier = creatorProfile?.name || (isAdmin ? 'Admin' : 'Bawm Creator');

    if (pendingBiometricAction === 'approve') {
      const updated = approveCashTransaction(pendingBiometricTx.id, verifier, creatorProfile, campaigns);
      if (updated) {
        onTransactionUpdated?.(updated);
        setToastMessage(`Txn ${updated.id} chu hlawhtling takin pawm (Approved) a ni ta e!`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setToastMessage(`⚠️ Pawm theih a ni lo.`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } else {
      const updated = rejectCashTransaction(pendingBiometricTx.id, verifier, pendingRejectReason, creatorProfile, campaigns);
      if (updated) {
        onTransactionUpdated?.(updated);
        setRejectingTxId(null);
        setToastMessage(`Txn ${updated.id} chu hnawl (Rejected) a ni.`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    }

    setPendingBiometricTx(null);
  };

  // Build role-scoped notifications
  const allNotifications = useMemo(() => {
    const list: AppNotification[] = [];

    // =========================================================================
    // 1. COMMON / GENERAL (Tlangpui) - Available to all users
    // =========================================================================
    const commonItems: AppNotification[] = [
      {
        id: 'common-camera-scanner',
        type: 'general',
        categoryScope: 'general',
        title: 'Camera & Live QR Scanner Update',
        message: 'Phone camera hmangin direct QR scan theih reng a ni a, gallery file select leh offline sync support a awm bawk e.',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        read: readStateMap['common-camera-scanner'] ?? false,
        tag: 'Common Update'
      },
      {
        id: 'common-upi-zerofee',
        type: 'general',
        categoryScope: 'general',
        title: 'RonPay Direct UPI Protocol & 0% Fee',
        message: 'RonPay hmanga thawh leh pekna zawng zawng hi UPI direct-in Creator account-ah 0% fee deduction-in a lut nghal zel e.',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        read: readStateMap['common-upi-zerofee'] ?? true,
        tag: 'General Notice'
      },
      {
        id: 'common-kumtluang-roll',
        type: 'general',
        categoryScope: 'general',
        title: 'Kumtluang Member Roll Dashboard',
        message: 'Kumtluang Member Roll Manager hmangin khawtlang, kohhran leh pawl hrang hrang member roll awlsam takin a enkawl theih e.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        read: readStateMap['common-kumtluang-roll'] ?? true,
        tag: 'System Update'
      },
      {
        id: 'common-offline-cache',
        type: 'general',
        categoryScope: 'general',
        title: 'Offline Mode & Local Storage Cache',
        message: 'Internet connection a chhiat pawhin i transaction data leh saved QRs te i phone/browser storage-ah a him reng.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        read: readStateMap['common-offline-cache'] ?? true,
        tag: 'General Notice'
      }
    ];

    list.push(...commonItems);

    // =========================================================================
    // 2. PRIVATE (Mimal / Ta Bik) - STRICT ROLE ISOLATION
    // =========================================================================

    // -------------------------------------------------------------------------
    // A. CREATOR: "ama bawm chhung a mi poisa pek lo kal te"
    // -------------------------------------------------------------------------
    if (isCreator && creatorProfile) {
      // Find all campaigns created by this creator
      const myCampaigns = campaigns.filter(c => isCampaignCreator(c, creatorProfile));
      const myCampaignIds = new Set(myCampaigns.map(c => String(c.id).toLowerCase().trim()));
      const myCampaignTitles = new Set(myCampaigns.map(c => (c.title || '').toLowerCase().trim()));

      // Incoming transactions specifically for this creator's campaigns
      transactions.forEach(tx => {
        const txCampId = String(tx.campaignId || '').toLowerCase().trim();
        const txCampTitle = String(tx.campaignTitle || '').toLowerCase().trim();
        const isForMyCampaign = (txCampId && myCampaignIds.has(txCampId)) || (txCampTitle && myCampaignTitles.has(txCampTitle));

        if (isForMyCampaign) {
          const isRead = readStateMap[`creator-tx-${tx.id}`] ?? false;

          if (tx.paymentMethod === 'cash') {
            if (tx.status === 'pending_verification') {
              list.push({
                id: `creator-tx-${tx.id}`,
                type: 'cash_approval',
                categoryScope: 'personal',
                title: `Cash Fiah Ngai: ₹${formatRupees(tx.amount)}`,
                message: `"${tx.campaignTitle || 'I Bawm'}"-ah ${tx.donorName || 'Petu'} in ₹${formatRupees(tx.amount)} cash a thehlut a, pawisa i dawn fel tawh chuan lo pawm (Approve) rawh le. (Token: ${tx.id})`,
                timestamp: tx.timestamp,
                read: isRead,
                amount: tx.amount,
                transactionId: tx.id,
                campaignId: tx.campaignId,
                transaction: tx,
                tag: 'Cash Fiah Ngai',
                canApproveCash: true // Creator's own campaign!
              });
            } else if (tx.status === 'completed') {
              list.push({
                id: `creator-tx-${tx.id}`,
                type: 'payment',
                categoryScope: 'personal',
                title: `Cash Dawn Fel: ₹${formatRupees(tx.amount)}`,
                message: `"${tx.campaignTitle || 'I Bawm'}"-ah ${tx.donorName || 'Petu'} cash pek ₹${formatRupees(tx.amount)} chu ${tx.verifiedBy || 'Creator'}-in a dawng fel ta e.`,
                timestamp: tx.verifiedAt || tx.timestamp,
                read: isRead,
                amount: tx.amount,
                transactionId: tx.id,
                campaignId: tx.campaignId,
                transaction: tx,
                tag: 'Cash Dawng Fel'
              });
            } else if (tx.status === 'rejected') {
              list.push({
                id: `creator-tx-${tx.id}`,
                type: 'personal',
                categoryScope: 'personal',
                title: `Cash Hnawl A Ni: ₹${formatRupees(tx.amount)}`,
                message: `"${tx.campaignTitle || 'I Bawm'}"-a ${tx.donorName || 'Petu'} cash pek ₹${formatRupees(tx.amount)} chu hnawl a ni. ${tx.rejectionReason ? `(Chhan: ${tx.rejectionReason})` : ''}`,
                timestamp: tx.rejectedAt || tx.timestamp,
                read: isRead,
                amount: tx.amount,
                transactionId: tx.id,
                campaignId: tx.campaignId,
                transaction: tx,
                tag: 'Cash Hnawl'
              });
            }
          } else {
            // Online UPI payment to creator's campaign
            list.push({
              id: `creator-tx-${tx.id}`,
              type: 'payment',
              categoryScope: 'personal',
              title: `UPI Thawhlawm Lo Lut: ₹${formatRupees(tx.amount)}`,
              message: `"${tx.campaignTitle || 'I Bawm'}"-ah ${tx.isAnonymous ? 'Anonymous' : (tx.donorName || 'Petu')} hnen atangin ₹${formatRupees(tx.amount)} UPI direct payment a lo lut e. (Txn: ${tx.id})`,
              timestamp: tx.timestamp,
              read: isRead,
              amount: tx.amount,
              transactionId: tx.id,
              campaignId: tx.campaignId,
              transaction: tx,
              tag: 'UPI Bawm Lut'
            });
          }
        }
      });

      // Creator account profile notification
      list.push({
        id: 'creator-profile-status',
        type: 'personal',
        categoryScope: 'personal',
        title: `Creator Status: ${creatorProfile.name}`,
        message: `I Creator Profile hi approved a ni a, Bawm ${myCampaigns.length} i nei e. Ama bawm siam a mi cash chauh i approve thei tih hria ang che.`,
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        read: readStateMap['creator-profile-status'] ?? true,
        tag: 'Creator Profile'
      });
    }

    // -------------------------------------------------------------------------
    // B. MODERATOR: "Moderator in Creator new Campaign lo kal tea hran theuhin anmahni ta tur theuh a lo kal bawk tur a ni"
    // -------------------------------------------------------------------------
    if (isModerator) {
      // Find Creator new campaigns (especially pending ones, or recently added)
      const pendingReviewCampaigns = campaigns.filter(c => !c.isApproved || c.status === 'pending' || c.status === 'pending_approval');
      const allCreatorCampaigns = campaigns.slice(0, 10);

      // Pending campaign reviews for Moderator
      pendingReviewCampaigns.forEach(camp => {
        const isRead = readStateMap[`mod-review-${camp.id}`] ?? false;
        list.push({
          id: `mod-review-${camp.id}`,
          type: 'campaign_review',
          categoryScope: 'personal',
          title: `Creator Campaign Thar Endik Tur: "${camp.title}"`,
          message: `Creator ${camp.creatorName || camp.createdBy || 'Creator'} (${camp.orgName || 'Pawl'}) in ${camp.category} bawm thar "${camp.title}" a thehlut a. Moderator i nih angin endik (Review) a pawm/hnawl tur a ni e.${camp.targetAmount ? ` Target: ₹${formatRupees(camp.targetAmount)}.` : ''}`,
          timestamp: camp.createdAt || new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          read: isRead,
          campaignId: camp.id,
          campaign: camp,
          tag: 'Moderator Review'
        });
      });

      // Show recently registered creator campaigns
      if (pendingReviewCampaigns.length === 0 && allCreatorCampaigns.length > 0) {
        allCreatorCampaigns.slice(0, 3).forEach(camp => {
          list.push({
            id: `mod-recent-${camp.id}`,
            type: 'campaign_review',
            categoryScope: 'personal',
            title: `Creator Campaign: "${camp.title}"`,
            message: `Creator ${camp.creatorName || camp.createdBy} bawm "${camp.title}" hi Moderator queue-ah audit fel a ni tawh e.`,
            timestamp: camp.createdAt || new Date(Date.now() - 1000 * 60 * 300).toISOString(),
            read: readStateMap[`mod-recent-${camp.id}`] ?? true,
            campaignId: camp.id,
            campaign: camp,
            tag: 'Moderated Campaign'
          });
        });
      }

      // Moderator Role Guidance
      list.push({
        id: 'mod-role-guidance',
        type: 'personal',
        categoryScope: 'personal',
        title: 'Moderator Desk: Campaign Content Clearance',
        message: 'Moderator chuan Creator campaign thar lo lut leh content endikna i nei a. Cash pawisa approve phalna erawh Creator (ama bawm) leh Admin chauhin an nei a ni.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: readStateMap['mod-role-guidance'] ?? false,
        tag: 'Moderator Desk'
      });
    }

    // -------------------------------------------------------------------------
    // C. ADMIN / SUPER ADMIN: "Chutiangin Admin / Super Admin pawh a hran vek in a awm ang, chumi tur chuan thliar fai rawh"
    // -------------------------------------------------------------------------
    if (isAdmin) {
      // 1. All pending cash transactions across the platform
      const pendingCashTxs = transactions.filter(t => t.paymentMethod === 'cash' && t.status === 'pending_verification');
      pendingCashTxs.forEach(tx => {
        const isRead = readStateMap[`admin-cash-${tx.id}`] ?? false;
        list.push({
          id: `admin-cash-${tx.id}`,
          type: 'cash_approval',
          categoryScope: 'personal',
          title: `Admin Cash Clearance: ₹${formatRupees(tx.amount)}`,
          message: `"${tx.campaignTitle || tx.campaignId}"-ah ${tx.donorName || 'Petu'} cash thehluh ₹${formatRupees(tx.amount)} hi verification nghah mek a ni. Admin i nih angin he cash payment hi i approve / hnawl thei e. (Token: ${tx.id})`,
          timestamp: tx.timestamp,
          read: isRead,
          amount: tx.amount,
          transactionId: tx.id,
          campaignId: tx.campaignId,
          transaction: tx,
          tag: 'Admin Cash Action',
          canApproveCash: true // Admin has global approval authority
        });
      });

      // 2. Pending Creator New Campaigns requiring clearance
      const pendingCampaigns = campaigns.filter(c => !c.isApproved || c.status === 'pending' || c.status === 'pending_approval');
      pendingCampaigns.forEach(camp => {
        const isRead = readStateMap[`admin-camp-${camp.id}`] ?? false;
        list.push({
          id: `admin-camp-${camp.id}`,
          type: 'campaign_review',
          categoryScope: 'personal',
          title: `Admin Campaign Review: "${camp.title}"`,
          message: `Creator ${camp.creatorName || camp.createdBy || 'Creator'} (${camp.orgName || 'Pawl'}) thehluh "${camp.title}" approval nghah mek a ni. Admin clearance pek a ngai e.`,
          timestamp: camp.createdAt || new Date(Date.now() - 1000 * 60 * 100).toISOString(),
          read: isRead,
          campaignId: camp.id,
          campaign: camp,
          tag: 'Admin Review'
        });
      });

      // 3. Platform Ledger & Reserve status
      list.push({
        id: 'admin-system-ledger',
        type: 'personal',
        categoryScope: 'personal',
        title: userRole === 'SUPER_ADMIN' ? '👑 Super Admin Master Ledger' : '🛡️ Admin Master Ledger',
        message: `Platform-ah transactions ${transactions.length} leh campaigns ${campaigns.length} a awm mek e. Cash verification leh creator registration te fiah reng a ni.`,
        timestamp: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
        read: readStateMap['admin-system-ledger'] ?? true,
        tag: 'Platform Ledger'
      });
    }

    // -------------------------------------------------------------------------
    // D. GENERAL MEMBER / DONOR / GUEST: User's personal contributions
    // -------------------------------------------------------------------------
    if (isGeneralMember) {
      const userPaidIds = new Set(getStoredUserPaidTxIds().map(id => String(id).toLowerCase().trim()));
      const userTxs = transactions.filter(tx => {
        const idMatch = userPaidIds.has(String(tx.id).toLowerCase().trim());
        const nameMatch = creatorProfile?.name && tx.donorName && tx.donorName.toLowerCase().trim() === creatorProfile.name.toLowerCase().trim();
        const phoneMatch = creatorProfile?.phone && tx.donorPhone && tx.donorPhone === creatorProfile.phone;
        return idMatch || nameMatch || phoneMatch;
      });

      // If user contributed, show personal receipts
      userTxs.forEach(tx => {
        const isRead = readStateMap[`user-tx-${tx.id}`] ?? false;
        if (tx.paymentMethod === 'cash') {
          if (tx.status === 'pending_verification') {
            list.push({
              id: `user-tx-${tx.id}`,
              type: 'personal',
              categoryScope: 'personal',
              title: `Cash Fiah Mek: ₹${formatRupees(tx.amount)}`,
              message: `"${tx.campaignTitle || 'RonPay Bawm'}"-ah ₹${formatRupees(tx.amount)} cash i thehlut a. Bawm Siamtu emaw Admin-in an lo enfiah a, official receipt an pe thuai ang che. (Token: ${tx.id})`,
              timestamp: tx.timestamp,
              read: isRead,
              amount: tx.amount,
              transactionId: tx.id,
              campaignId: tx.campaignId,
              transaction: tx,
              tag: 'Cash Fiah Mek',
              canApproveCash: false // Member CANNOT approve!
            });
          } else if (tx.status === 'completed') {
            list.push({
              id: `user-tx-${tx.id}`,
              type: 'payment',
              categoryScope: 'personal',
              title: `Cash Dawn Fel: ₹${formatRupees(tx.amount)}`,
              message: `"${tx.campaignTitle || 'RonPay Bawm'}"-a i cash pek ₹${formatRupees(tx.amount)} chu ${tx.verifiedBy || 'Creator'}-in a dawng fel ta e.`,
              timestamp: tx.verifiedAt || tx.timestamp,
              read: isRead,
              amount: tx.amount,
              transactionId: tx.id,
              campaignId: tx.campaignId,
              transaction: tx,
              tag: 'Cash Dawn Fel'
            });
          } else if (tx.status === 'rejected') {
            list.push({
              id: `user-tx-${tx.id}`,
              type: 'personal',
              categoryScope: 'personal',
              title: `Cash Hnawl A Ni: ₹${formatRupees(tx.amount)}`,
              message: `"${tx.campaignTitle || 'RonPay Bawm'}"-a i cash pek ₹${formatRupees(tx.amount)} chu hnawl a ni. ${tx.rejectionReason ? `Chhan: ${tx.rejectionReason}` : ''}`,
              timestamp: tx.rejectedAt || tx.timestamp,
              read: isRead,
              amount: tx.amount,
              transactionId: tx.id,
              campaignId: tx.campaignId,
              transaction: tx,
              tag: 'Cash Hnawl'
            });
          }
        } else {
          // Online UPI
          list.push({
            id: `user-tx-${tx.id}`,
            type: 'payment',
            categoryScope: 'personal',
            title: `UPI Pekna Hlawhtling: ₹${formatRupees(tx.amount)}`,
            message: `"${tx.campaignTitle || 'RonPay Bawm'}"-ah ₹${formatRupees(tx.amount)} i pe tlang fel e. Txn: ${tx.id}`,
            timestamp: tx.timestamp,
            read: isRead,
            amount: tx.amount,
            transactionId: tx.id,
            campaignId: tx.campaignId,
            transaction: tx,
            tag: 'UPI Receipt'
          });
        }
      });

      // Member welcome note
      list.push({
        id: 'member-welcome-note',
        type: 'personal',
        categoryScope: 'personal',
        title: 'RonPay Mimal Thawhlawm Sulhnu',
        message: 'Bawm hrang hrang i thawhna receipt leh cash status te hetah hian i hmu zel thei ang. Cash payment hi bawm siamtu leh admin chauhin an approve thei a ni.',
        timestamp: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
        read: readStateMap['member-welcome-note'] ?? true,
        tag: 'Mimal Note'
      });
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [campaigns, transactions, creatorProfile, userRole, isAdmin, isModerator, isCreator, isGeneralMember, readStateMap]);

  // Synchronize unread count back to the Bell icon in Header
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  if (!isOpen) return null;

  // Mark a single notification as read
  const handleMarkAsRead = (id: string) => {
    const nextMap = { ...readStateMap, [id]: true };
    setReadStateMap(nextMap);
    try {
      const stored = Object.keys(nextMap).map(k => ({ id: k, read: nextMap[k] }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.error(e);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = () => {
    const nextMap = { ...readStateMap };
    allNotifications.forEach(n => {
      nextMap[n.id] = true;
    });
    setReadStateMap(nextMap);
    try {
      const stored = Object.keys(nextMap).map(k => ({ id: k, read: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.error(e);
    }
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
  };

  // Clear all
  const handleClearNotifications = () => {
    const nextMap: Record<string, boolean> = {};
    allNotifications.forEach(n => {
      nextMap[n.id] = true;
    });
    setReadStateMap(nextMap);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
  };

  // Filtered notifications
  const filteredNotifications = allNotifications.filter(n => {
    if (activeTab === 'common') {
      return n.categoryScope === 'general';
    }
    if (activeTab === 'private') {
      return n.categoryScope === 'personal';
    }
    return true;
  });

  const commonCount = allNotifications.filter(n => n.categoryScope === 'general').length;
  const privateCount = allNotifications.filter(n => n.categoryScope === 'personal').length;
  const commonUnread = allNotifications.filter(n => n.categoryScope === 'general' && !n.read).length;
  const privateUnread = allNotifications.filter(n => n.categoryScope === 'personal' && !n.read).length;

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
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
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
              
              {/* Role Scope Indicator */}
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                <span>Scope:</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] border ${
                  isAdmin 
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : isModerator
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : isCreator
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {isAdmin 
                    ? '👑 Admin Scope' 
                    : isModerator 
                    ? '⚖️ Moderator Scope' 
                    : isCreator 
                    ? `🏷️ Creator (${creatorProfile?.name || 'Bawm Siamtu'})` 
                    : '👤 Member / Donor Scope'}
                </span>
              </div>
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

        {/* Tab Selector: ALL | COMMON (Tlangpui) | PRIVATE (Mimal / Ta Bik) */}
        <div className="flex items-center gap-1 p-2 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 px-2 rounded-xl font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-800 text-amber-400 border border-amber-400/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All ({allNotifications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('common')}
            className={`flex-1 py-2 px-2 rounded-xl font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'common'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-sky-400" />
            <span>Common ({commonCount})</span>
            {commonUnread > 0 && (
              <span className="w-2 h-2 rounded-full bg-sky-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('private')}
            className={`flex-1 py-2 px-2 rounded-xl font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'private'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {isCreator ? (
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
            ) : isModerator ? (
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            ) : isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Private ({privateCount})</span>
            {privateUnread > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {/* Action Feedback Toast */}
          {toastMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-between animate-fadeIn">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Role Header Context Banner in Private Tab */}
          {activeTab === 'private' && (
            <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                {isCreator ? (
                  <><b>Creator Private Box:</b> I bawm siam a mi pawisa lo kal te chauh a lang a, i bawm a mi chauh i approve thei.</>
                ) : isModerator ? (
                  <><b>Moderator Private Box:</b> Creator new Campaign thehluh lo kal te endik a review na a ni e.</>
                ) : isAdmin ? (
                  <><b>Admin Private Box:</b> Platform pumpui a Cash approvals leh Campaign clearance turte a lang vek e.</>
                ) : (
                  <><b>Mimal Box:</b> I pawisa thehluh receipt leh cash confirmation status te hetah hian a lang.</>
                )}
              </p>
            </div>
          )}

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">Hriattirna a awm rih lo</p>
              <p className="text-xs text-slate-500">
                {activeTab === 'common' 
                  ? 'Common / Tlangpui hriattirna thar a awm lo.' 
                  : activeTab === 'private'
                  ? 'I role tana Private hriattirna a la awm lo.'
                  : 'Hriattirna thar a la awm lo e.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notif => {
              const isCommon = notif.categoryScope === 'general';
              const tx = notif.transaction;
              const camp = notif.campaign || (notif.campaignId ? campaigns.find(c => c.id === notif.campaignId) : undefined);
              const isPendingCash = tx && tx.paymentMethod === 'cash' && tx.status === 'pending_verification';
              const canApprove = notif.canApproveCash && tx;

              return (
                <div 
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id)}
                  className={`rounded-2xl p-3.5 transition flex gap-3 cursor-pointer ${
                    isPendingCash && canApprove
                      ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/70 shadow-lg'
                      : notif.read
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 border border-slate-800/60'
                      : 'bg-slate-800/60 hover:bg-slate-800/80 border-l-4 border-l-amber-500 border border-slate-700/60'
                  }`}
                >
                  {/* Left Icon */}
                  <div className="shrink-0 mt-0.5">
                    {isPendingCash ? (
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black animate-pulse shadow-sm">
                        <Clock className="w-5 h-5 text-slate-950" />
                      </div>
                    ) : notif.type === 'campaign_review' ? (
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                        <Shield className="w-5 h-5" />
                      </div>
                    ) : isCommon ? (
                      <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                        <Megaphone className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                        <Receipt className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className={`text-xs sm:text-sm font-bold truncate ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h3>

                        {/* Common vs Private Badge */}
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                          isCommon
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {isCommon ? 'COMMON' : 'PRIVATE'}
                        </span>

                        {notif.tag && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-semibold text-slate-400">
                            {notif.tag}
                          </span>
                        )}
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

                    <p className="text-[11.5px] text-slate-300 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    {/* CASH APPROVAL INTERACTION PANEL (ONLY FOR PERMITTED CREATOR OR ADMIN) */}
                    {isPendingCash && tx && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/40 space-y-2 bg-slate-950/70 p-3 rounded-xl border border-amber-500/30">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-amber-400 flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5" /> Cash Amount:
                          </span>
                          <span className="font-black text-emerald-400 text-sm">
                            ₹{formatRupees(tx.amount)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 flex justify-between gap-2">
                          <span className="truncate">Petu: <b className="text-white">{tx.donorName}</b></span>
                          <span className="truncate">Bawm: <b className="text-indigo-300">{tx.campaignTitle || tx.campaignId}</b></span>
                        </div>

                        {canApprove ? (
                          // Authorized Creator or Admin Approval Panel
                          rejectingTxId === tx.id ? (
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
                                {isAdmin ? 'Admin Approve Cash' : 'Pawisa Ka Dawng Fel (Approve)'}
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
                          )
                        ) : (
                          // Non-authorized viewers (e.g. Donor)
                          <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-[11px] text-amber-300/90 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Bawm Siamtu / Admin verification nghah mek a ni. (Token: {tx.id})</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODERATOR / ADMIN CAMPAIGN REVIEW BUTTON */}
                    {notif.type === 'campaign_review' && camp && (
                      <div className="pt-1 flex items-center gap-2">
                        {onOpenCampaignReview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notif.id);
                              onClose();
                              onOpenCampaignReview(camp);
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Endik Rawh (Review Campaign)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* GENERAL QUICK ACTION BUTTONS */}
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

                      {camp && onNavigateToCampaign && notif.type !== 'campaign_review' && (
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

                      {notif.id === 'common-kumtluang-roll' && onOpenMemberRoll && (
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
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
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
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition cursor-pointer text-xs"
          >
            Kharna
          </button>
        </div>

        {/* Biometric Verification Guard */}
        <BiometricAuthModal
          isOpen={isBiometricOpen}
          target="admin_action"
          actionType={pendingBiometricAction}
          title={pendingBiometricAction === 'reject' ? 'Cash Rejection Authorization' : 'Cash Approval Clearance'}
          subtitle={`Cash payment ₹${Number(pendingBiometricTx?.amount || 0).toLocaleString('en-IN')} (${pendingBiometricTx?.id || ''}) hi ${pendingBiometricAction === 'reject' ? 'hnawl (reject)' : 'pawm (approve)'} tur hian Biometric verify rawh le.`}
          userName={creatorProfile?.name || (isAdmin ? 'Admin' : 'Bawm Creator')}
          userPhone={creatorProfile?.phone}
          expectedPin={creatorProfile?.pin || creatorProfile?.password}
          onClose={() => {
            setIsBiometricOpen(false);
            setPendingBiometricTx(null);
          }}
          onSuccess={handleBiometricSuccess}
        />
      </div>
    </div>
  );
};
