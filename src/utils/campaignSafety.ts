import { Campaign, Transaction, AuditLog } from '../types';
import { 
  getStoredTransactions, 
  getStoredCampaigns, 
  saveCampaign, 
  deleteStoredCampaign, 
  recordAuditLog,
  getStoredAuditLogs 
} from './storage';
import { syncCampaignToFirestore, deleteCampaignFromFirestore } from '../services/firestoreSync';

export interface CampaignFinancialStats {
  totalCollected: number;
  txnCount: number;
  hasTransactions: boolean;
  isZeroBalance: boolean;
  canHardDelete: boolean;
  matchingTransactions: Transaction[];
}

/**
 * Calculate live financial stats for a given campaign
 */
export function getCampaignFinancialStats(
  campaign: Campaign | { id: string; title?: string },
  allTransactions?: Transaction[]
): CampaignFinancialStats {
  const txList = allTransactions || getStoredTransactions();
  if (!campaign || !campaign.id) {
    return {
      totalCollected: 0,
      txnCount: 0,
      hasTransactions: false,
      isZeroBalance: true,
      canHardDelete: true,
      matchingTransactions: []
    };
  }

  const matching = txList.filter(t => 
    t.campaignId === campaign.id || 
    (campaign.title && t.campaignTitle === campaign.title)
  );

  // Count valid non-rejected/non-failed transactions
  const validTxns = matching.filter(t => t.status !== 'failed' && t.status !== 'rejected');
  const totalCollected = validTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const txnCount = matching.length;
  const hasTransactions = txnCount > 0 || totalCollected > 0;
  const isZeroBalance = totalCollected === 0 && txnCount === 0;

  return {
    totalCollected,
    txnCount,
    hasTransactions,
    isZeroBalance,
    canHardDelete: isZeroBalance,
    matchingTransactions: matching
  };
}

/**
 * Check if a campaign can be safely hard-deleted (Zero-Balance rule)
 */
export function canHardDeleteCampaign(
  campaign: Campaign,
  transactions?: Transaction[]
): boolean {
  if (!campaign) return false;
  // If already voided, retain the ledger record
  if (campaign.status === 'voided' || campaign.isVoided) return false;
  const stats = getCampaignFinancialStats(campaign, transactions);
  return stats.canHardDelete;
}

/**
 * Rule 1: Delete Zero-Balance Campaign (₹0 Collected)
 * Removes the campaign from system and Firestore, and records full audit trail.
 */
export async function deleteZeroBalanceCampaign(
  campaign: Campaign,
  reason: string,
  performedBy: string = 'Admin',
  roleName: string = 'ADMIN',
  allTransactions?: Transaction[]
): Promise<{ success: boolean; message: string; auditLog?: AuditLog }> {
  const stats = getCampaignFinancialStats(campaign, allTransactions);

  if (!stats.canHardDelete) {
    throw new Error(
      `Financial Safety Lock: He Bawm ah hian pawisa ₹${stats.totalCollected.toLocaleString('en-IN')} (${stats.txnCount} txns) a luh tawh avangin hard delete theih a ni lo. 'Cancel & Void' option hmang rawh.`
    );
  }

  const sanitizedReason = reason?.trim() || 'Zero-balance Bawm siam sual / tul loh vanga paih bo';

  // 1. Delete locally and sync
  deleteStoredCampaign(campaign.id);

  // 2. Direct delete from Firestore
  try {
    await deleteCampaignFromFirestore(campaign.id);
  } catch (err) {
    console.warn('[SafetyNet] Firestore delete note:', err);
  }

  // 3. Direct delete on backend server if reachable
  if (typeof fetch !== 'undefined') {
    fetch(`/api/campaigns/${campaign.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: sanitizedReason, performedBy })
    }).catch(() => {});
  }

  // 4. Record Audit Trail with Reason
  const log = recordAuditLog(
    'CAMPAIGN_DELETED_ZERO_BALANCE',
    `Paih bo (Deleted) zero-balance Bawm '${campaign.title}' (${campaign.id}). Collected: ₹0 (0 txns). Chhan/Reason: "${sanitizedReason}". Performer: ${performedBy} (${roleName}).`,
    'campaign',
    campaign.id,
    performedBy
  );

  return {
    success: true,
    message: `"${campaign.title}" (Zero-Balance) chu hlawhtling takin paih bo (deleted) a ni e. Audit log vawn fel a ni.`,
    auditLog: log
  };
}

/**
 * Rule 2: Cancel & Void Campaign (Pawisa lut tawh Bawm hmehhlumna)
 * Keeps financial records, receipts, and transactions intact while closing public donations.
 */
export async function voidAndCancelCampaign(
  campaign: Campaign,
  reason: string,
  performedBy: string = 'Admin',
  roleName: string = 'ADMIN',
  allTransactions?: Transaction[]
): Promise<{ success: boolean; updatedCampaign: Campaign; auditLog?: AuditLog }> {
  const stats = getCampaignFinancialStats(campaign, allTransactions);
  const sanitizedReason = reason?.trim() || 'Campaign cancelled & voided by administrator';

  const voidedCampaign: Campaign = {
    ...campaign,
    status: 'voided',
    isVoided: true,
    voidedAt: new Date().toISOString(),
    voidedBy: performedBy,
    voidReason: sanitizedReason,
    approvalRemarks: `VOIDED / CANCELLED: ${sanitizedReason} (by ${performedBy})`,
    updatedAt: new Date().toISOString(),
    lastEditedBy: performedBy,
    lastEditReason: `Voided: ${sanitizedReason}`
  };

  // 1. Update in local storage
  saveCampaign(voidedCampaign);

  // 2. Sync to Firestore
  try {
    await syncCampaignToFirestore(voidedCampaign);
  } catch (err) {
    console.warn('[SafetyNet] Firestore void sync note:', err);
  }

  // 3. Post to backend server
  if (typeof fetch !== 'undefined') {
    fetch(`/api/campaigns/${campaign.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign: voidedCampaign,
        reason: sanitizedReason,
        performedBy
      })
    }).catch(() => {});
  }

  // 4. Record Audit Trail with preserved funds and reason
  const log = recordAuditLog(
    'CAMPAIGN_VOIDED_AND_CANCELLED',
    `Hmehhlum/Voided Bawm '${campaign.title}' (${campaign.id}). Pawisa lut tawh him taka vawn: ₹${stats.totalCollected.toLocaleString('en-IN')} (${stats.txnCount} txns). Public donation khar a ni. Chhan/Reason: "${sanitizedReason}". Performer: ${performedBy} (${roleName}).`,
    'campaign',
    campaign.id,
    performedBy
  );

  return {
    success: true,
    updatedCampaign: voidedCampaign,
    auditLog: log
  };
}

/**
 * Rule 3: Admin & Creator Edit with Mandatory / Automatic Audit Trail
 */
export async function updateCampaignWithAudit(
  originalCampaign: Campaign,
  updatedFields: Partial<Campaign>,
  reason: string,
  performedBy: string = 'Admin',
  roleName: string = 'ADMIN'
): Promise<{ success: boolean; updatedCampaign: Campaign; auditLog?: AuditLog }> {
  const sanitizedReason = reason?.trim() || 'Campaign details updated';

  const updatedCampaign: Campaign = {
    ...originalCampaign,
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    lastEditedBy: performedBy,
    lastEditReason: sanitizedReason
  };

  // 1. Update in local storage
  saveCampaign(updatedCampaign);

  // 2. Sync to Firestore
  try {
    await syncCampaignToFirestore(updatedCampaign);
  } catch (err) {
    console.warn('[SafetyNet] Firestore update note:', err);
  }

  // 3. Sync to backend server
  if (typeof fetch !== 'undefined') {
    fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCampaign)
    }).catch(() => {});
  }

  // 4. Record Audit Trail
  const changesSummary = Object.keys(updatedFields)
    .filter(k => k !== 'updatedAt' && k !== 'lastEditedBy' && k !== 'lastEditReason')
    .join(', ');

  const log = recordAuditLog(
    'CAMPAIGN_DETAILS_EDITED',
    `Siamthat (Edited) Bawm '${updatedCampaign.title}' (${updatedCampaign.id}). Thlak danglam te: [${changesSummary}]. Chhan/Reason: "${sanitizedReason}". Performer: ${performedBy} (${roleName}).`,
    'campaign',
    updatedCampaign.id,
    performedBy
  );

  return {
    success: true,
    updatedCampaign,
    auditLog: log
  };
}
