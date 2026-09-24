import { Campaign, BawmCategory, ScreenId, Transaction } from '../types';
import { INITIAL_CAMPAIGNS } from '../data/initialData';
import { getStoredCampaigns, getStoredTransactions } from './storage';

export interface ParsedRoute {
  screen?: ScreenId;
  campaignId?: string;
  campaign?: Campaign;
  category?: BawmCategory;
  receiptId?: string;
  failureReason?: string;
  receiptMeta?: {
    amount?: number;
    baseAmount?: number;
    platformFee?: number;
    feeOption?: 'ADD_ON' | 'DEDUCT';
    campaignId?: string;
    campaignTitle?: string;
    category?: BawmCategory;
    donorName?: string;
    donorPhone?: string;
    isAnonymous?: boolean;
    utr?: string;
  };
  isSulhnuOpen?: boolean;
  isMemberRollOpen?: boolean;
  memberRollCampaignId?: string;
  isAdminOpen?: boolean;
  isWalletOpen?: boolean;
  view?: 'website' | 'app';
  isPhonePeOpen?: boolean;
  isDirectPhonePeLaunch?: boolean;
  phonePeLaunchAmount?: number;
  donorName?: string;
  donorPhone?: string;
  donorVeng?: string;
  isAnonymous?: boolean;
}

/**
 * Extracts query parameters and route information from current window URL or hash
 */
export function getUrlRoute(campaignsList?: Campaign[], transactionsList?: Transaction[]): ParsedRoute | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);

    // Also check hash for parameters e.g. #/?campaign=xxx, #campaign=xxx, #/c/xxx, #/post/xxx
    if (window.location.hash) {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      if (rawHash.includes('?') || rawHash.includes('=')) {
        const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
        const hashParams = new URLSearchParams(hashQuery);
        hashParams.forEach((val, key) => {
          if (!searchParams.has(key)) {
            searchParams.set(key, val);
          }
        });
      } else if (rawHash.match(/^(?:campaign|c|bawm|post|p)\/([a-zA-Z0-9_-]+)/i)) {
        const match = rawHash.match(/^(?:campaign|c|bawm|post|p)\/([a-zA-Z0-9_-]+)/i);
        if (match && match[1] && !searchParams.has('campaign')) {
          searchParams.set('campaign', match[1]);
        }
      }
    }

    // Also check pathname for /campaign/:id, /c/:id, /bawm/:id, /post/:id, /p/:id
    const pathname = window.location.pathname;
    const campPathMatch = pathname.match(/\/(?:campaign|c|bawm|post|p)\/([a-zA-Z0-9_-]+)/i);
    if (campPathMatch && campPathMatch[1] && !searchParams.has('campaign')) {
      searchParams.set('campaign', campPathMatch[1]);
    }

    const campaignId = searchParams.get('campaign') || 
                       searchParams.get('cmp') || 
                       searchParams.get('c') || 
                       searchParams.get('id') || 
                       searchParams.get('bawm') || 
                       searchParams.get('post') ||
                       searchParams.get('p');

    const screenParam = searchParams.get('screen') || searchParams.get('page');
    const viewParam = searchParams.get('view');
    const statusParam = (searchParams.get('status') || '').toUpperCase();
    const codeParam = (searchParams.get('code') || '').toUpperCase();
    const responseCodeParam = (searchParams.get('responseCode') || '').toUpperCase();
    const stateParam = (searchParams.get('state') || '').toUpperCase();
    const failedParam = searchParams.get('failed');

    const isExplicitFailStatus = statusParam === 'PAYMENT_ERROR' || 
                                 statusParam === 'FAILED' || 
                                 statusParam === 'PAYMENT_DECLINED' || 
                                 statusParam === 'CANCELLED' ||
                                 statusParam === 'EXPIRED' ||
                                 codeParam === 'PAYMENT_ERROR' ||
                                 codeParam === 'FAILED' ||
                                 codeParam === 'CANCELLED' ||
                                 codeParam === 'TRANSACTION_NOT_FOUND' ||
                                 responseCodeParam === 'PAYMENT_ERROR' ||
                                 responseCodeParam === 'FAILED' ||
                                 responseCodeParam === 'CANCELLED' ||
                                 stateParam === 'FAILED' ||
                                 stateParam === 'CANCELLED' ||
                                 stateParam === 'EXPIRED' ||
                                 failedParam === '1' ||
                                 failedParam === 'true' ||
                                 screenParam === 'failed';

    let receiptId = '';
    const explicitFailedTxId = searchParams.get('receipt') || 
                               searchParams.get('tx') || 
                               searchParams.get('txn') || 
                               searchParams.get('txnId') ||
                               searchParams.get('merchantTransactionId') ||
                               searchParams.get('orderId') ||
                               searchParams.get('receiptId') ||
                               searchParams.get('phonepe_txn_id') ||
                               '';

    if (!isExplicitFailStatus) {
      receiptId = explicitFailedTxId;
    }

    // Special catch: If arriving at /callback or /phonepe/callback
    if (pathname.includes('/callback') || pathname.includes('/phonepe/callback')) {
      if (isExplicitFailStatus) {
        return {
          screen: 'failed',
          receiptId: explicitFailedTxId,
          failureReason: searchParams.get('reason') || 'PhonePe payment was cancelled or declined',
          view: 'app',
        };
      }
      return {
        screen: 'success',
        receiptId: receiptId,
        view: 'app',
      };
    }

    // If explicit fail status requested anywhere in the app URL (takes strict priority over screen=success)
    if (isExplicitFailStatus) {
      const amtParam = searchParams.get('amt');
      const baseAmtParam = searchParams.get('baseAmt');
      const feeParam = searchParams.get('fee');
      const feeOptParam = searchParams.get('feeOpt');
      const cidParam = searchParams.get('cid');
      const ctitleParam = searchParams.get('ctitle');
      const catParam = searchParams.get('cat') || searchParams.get('category');
      const donorParam = searchParams.get('donor');
      const donorPhoneParam = searchParams.get('donorPhone');
      const anonParam = searchParams.get('anon');
      const reasonParam = searchParams.get('reason') || searchParams.get('msg') || searchParams.get('error') || 'Payment cancelled or declined on PhonePe';

      const receiptMeta = (amtParam || baseAmtParam || cidParam || ctitleParam || donorParam) ? {
        amount: amtParam ? parseFloat(amtParam) : undefined,
        baseAmount: baseAmtParam ? parseFloat(baseAmtParam) : undefined,
        platformFee: feeParam ? parseFloat(feeParam) : undefined,
        feeOption: (feeOptParam as any) || 'ADD_ON',
        campaignId: cidParam || undefined,
        campaignTitle: ctitleParam || undefined,
        category: (catParam as BawmCategory) || undefined,
        donorName: donorParam || undefined,
        donorPhone: donorPhoneParam || undefined,
        isAnonymous: anonParam === '1' || anonParam === 'true',
      } : undefined;

      return {
        screen: 'failed',
        receiptId: explicitFailedTxId,
        failureReason: reasonParam,
        receiptMeta,
        view: 'app',
      };
    }

    const rollId = searchParams.get('roll') || 
                   searchParams.get('member_roll') || 
                   searchParams.get('memberRoll');
    const phonepeParam = searchParams.get('phonepe') || 
                         searchParams.get('pg') || 
                         searchParams.get('phonepe_checkout');
    const catParam = searchParams.get('cat') || searchParams.get('category');
    const sulhnuParam = searchParams.get('sulhnu') || searchParams.get('history');
    const adminParam = searchParams.get('admin');
    const walletParam = searchParams.get('wallet');
    const parsedView: 'website' | 'app' | undefined = (viewParam === 'app' || viewParam === 'website') ? viewParam : undefined;
    const isLaunchPayPath = pathname.toLowerCase().includes('launch-pay') ||
                            pathname.toLowerCase() === '/phonepe' || 
                            pathname.toLowerCase() === '/phonepe-uat' || 
                            pathname.toLowerCase() === '/uat' ||
                            pathname.toLowerCase().endsWith('/phonepe') ||
                            pathname.toLowerCase().endsWith('/phonepe-uat') ||
                            pathname.toLowerCase().endsWith('/uat');

    // If visiting PhonePe gateway launch directly and not returning from a payment receipt:
    if (isLaunchPayPath && !receiptId && !searchParams.get('receipt') && !searchParams.get('txnId') && !searchParams.get('code')) {
      const amtStr = searchParams.get('amt') || searchParams.get('amount') || searchParams.get('amountInRupees') || '100';
      return {
        screen: 'phonepe_launcher' as ScreenId,
        isDirectPhonePeLaunch: true,
        phonePeLaunchAmount: Number(amtStr) || 100,
        campaignId: campaignId ? decodeURIComponent(campaignId) : undefined,
        donorName: searchParams.get('donor') || searchParams.get('donorName') || undefined,
        donorPhone: searchParams.get('donorPhone') || searchParams.get('phone') || undefined,
        category: (catParam as BawmCategory) || undefined,
        view: 'app'
      };
    }

    const isPhonePePath = pathname.toLowerCase() === '/phonepe';
    const isPhonePeOpen = phonepeParam === 'true' || phonepeParam === '1' || phonepeParam === 'phonepe' || isPhonePePath;

    // 1. If Campaign ID is present: Match existing campaign or reconstruct dynamic campaign
    if (campaignId) {
      const cleanId = decodeURIComponent(campaignId).trim();
      const allCampaigns = [
        ...(campaignsList || []),
        ...getStoredCampaigns(),
        ...INITIAL_CAMPAIGNS
      ];

      const existing = allCampaigns.find(c => c.id.toLowerCase() === cleanId.toLowerCase());
      
      // Only explicit donation amount params (amt, amount, am, payAmt), NEVER target or total
      const urlAmtStr = searchParams.get('amt') || searchParams.get('amount') || searchParams.get('am') || searchParams.get('payAmt');
      const numUrlAmt = (urlAmtStr && !isNaN(parseFloat(urlAmtStr)) && parseFloat(urlAmtStr) > 0) ? parseFloat(urlAmtStr) : undefined;

      const donorParam = searchParams.get('donor') || searchParams.get('payer') || searchParams.get('name');
      const vengParam = searchParams.get('veng') || searchParams.get('section') || searchParams.get('loc');
      const isAnon = donorParam === 'Anonymous' || searchParams.get('anon') === '1' || searchParams.get('anon') === 'true';

      if (existing) {
        return {
          screen: 'checkout',
          campaignId: existing.id,
          campaign: numUrlAmt ? { ...existing, customAmount: numUrlAmt } : existing,
          category: existing.category,
          isPhonePeOpen: isPhonePeOpen || Boolean(numUrlAmt && (searchParams.get('pay') === '1' || searchParams.get('pay') === 'true')),
          view: parsedView || 'app',
          donorName: donorParam ? decodeURIComponent(donorParam) : undefined,
          donorVeng: vengParam ? decodeURIComponent(vengParam) : undefined,
          isAnonymous: isAnon,
        };
      }

      // Reconstruct dynamic campaign from URL parameters if passed in smart web link
      const title = searchParams.get('title');
      const upi = searchParams.get('upi') || searchParams.get('pa');
      const loc = searchParams.get('loc') || searchParams.get('location');
      const org = searchParams.get('org') || searchParams.get('orgName');
      const target = searchParams.get('target');
      const cause = searchParams.get('cause');
      const creator = searchParams.get('creator') || searchParams.get('creatorName') || searchParams.get('pn');
      const mitthi = searchParams.get('mitthi') || searchParams.get('mitthiHming');
      const vuiHun = searchParams.get('vuiHun');
      const vuitu = searchParams.get('vuitu');
      const thihni = searchParams.get('thihni');
      const urgencyDeadline = searchParams.get('urgencyDeadline') || searchParams.get('deadline');
      const validityDate = searchParams.get('validityDate') || searchParams.get('validity');
      const img = searchParams.get('img') || searchParams.get('imageUrl');

      const deducedCategory = (catParam as BawmCategory) || 
        (cleanId.startsWith('cmp-k') ? 'kumtluang' : 
         cleanId.startsWith('cmp-r') ? 'ralna' : 
         cleanId.startsWith('cmp-kh') ? 'khawlsak' : 
         cleanId.startsWith('cmp-rk') ? 'rikrum' : 'others');

      const reconstructed: Campaign = {
        id: cleanId,
        category: deducedCategory,
        title: title ? decodeURIComponent(title) : (mitthi ? `Ralna: ${decodeURIComponent(mitthi)}` : 'RonPay Bawm'),
        location: loc ? decodeURIComponent(loc) : 'Mizoram',
        gpsCoords: '23.7271, 92.7176',
        upiId: upi ? decodeURIComponent(upi) : (searchParams.get('pa') ? decodeURIComponent(searchParams.get('pa')!) : 'direct@upi'),
        orgName: org ? decodeURIComponent(org) : undefined,
        targetAmount: target ? Number(target) : undefined,
        cause: cause ? decodeURIComponent(cause) : undefined,
        creatorName: creator ? decodeURIComponent(creator) : undefined,
        mitthiHming: mitthi ? decodeURIComponent(mitthi) : undefined,
        vuiHun: vuiHun ? decodeURIComponent(vuiHun) : undefined,
        vuitu: vuitu ? decodeURIComponent(vuitu) : undefined,
        thihni: thihni ? decodeURIComponent(thihni) : undefined,
        urgencyDeadline: urgencyDeadline ? decodeURIComponent(urgencyDeadline) : undefined,
        imageUrl: img ? decodeURIComponent(img) : undefined,
        validityDate: validityDate ? decodeURIComponent(validityDate) : '2027-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      return {
        screen: 'checkout',
        campaignId: cleanId,
        campaign: numUrlAmt ? { ...reconstructed, customAmount: numUrlAmt } : reconstructed,
        category: deducedCategory,
        isPhonePeOpen: isPhonePeOpen || Boolean(numUrlAmt && (searchParams.get('pay') === '1' || searchParams.get('pay') === 'true')),
        view: parsedView || 'app',
        donorName: donorParam ? decodeURIComponent(donorParam) : undefined,
        donorVeng: vengParam ? decodeURIComponent(vengParam) : undefined,
        isAnonymous: isAnon,
      };
    }

    // 1b. If Explicit Failure from Payment Gateway redirect (e.g. PhonePe decline / failure)
    if (isExplicitFailStatus) {
      return {
        screen: 'checkout',
        view: parsedView || 'app',
      };
    }

    // 1c. If PhonePe Standard Checkout page is requested
    if (screenParam === 'phonepe-checkout' || screenParam === 'phonepe_checkout' || pathname.includes('phonepe-checkout')) {
      return {
        screen: 'phonepe_checkout',
        view: 'app',
      };
    }

    // 2. If Receipt ID is present
    if (receiptId && receiptId.trim() !== '' && !isExplicitFailStatus) {
      const amtParam = searchParams.get('amt');
      const baseAmtParam = searchParams.get('baseAmt');
      const feeParam = searchParams.get('fee');
      const feeOptParam = searchParams.get('feeOpt');
      const cidParam = searchParams.get('cid');
      const ctitleParam = searchParams.get('ctitle');
      const catParam = searchParams.get('cat') || searchParams.get('category');
      const donorParam = searchParams.get('donor');
      const donorPhoneParam = searchParams.get('donorPhone');
      const anonParam = searchParams.get('anon');
      const utrParam = searchParams.get('utr');

      const receiptMeta = (amtParam || baseAmtParam || cidParam || ctitleParam || donorParam) ? {
        amount: amtParam ? parseFloat(amtParam) : undefined,
        baseAmount: baseAmtParam ? parseFloat(baseAmtParam) : undefined,
        platformFee: feeParam ? parseFloat(feeParam) : undefined,
        feeOption: (feeOptParam === 'DEDUCT' ? 'DEDUCT' : 'ADD_ON') as 'ADD_ON' | 'DEDUCT',
        campaignId: cidParam ? decodeURIComponent(cidParam) : undefined,
        campaignTitle: ctitleParam ? decodeURIComponent(ctitleParam) : undefined,
        category: (catParam as BawmCategory) || undefined,
        donorName: donorParam ? decodeURIComponent(donorParam) : undefined,
        donorPhone: donorPhoneParam ? decodeURIComponent(donorPhoneParam) : undefined,
        isAnonymous: anonParam === '1' || anonParam === 'true',
        utr: utrParam ? decodeURIComponent(utrParam) : undefined,
      } : undefined;

      return {
        screen: 'success',
        receiptId: decodeURIComponent(receiptId).trim(),
        receiptMeta,
        view: 'app',
      };
    }

    // 3. If Member Roll is requested
    if (rollId) {
      return {
        isMemberRollOpen: true,
        memberRollCampaignId: decodeURIComponent(rollId).trim(),
      };
    }

    // 4. If Sulhnu history is requested
    if (sulhnuParam === 'true' || sulhnuParam === '1') {
      return {
        isSulhnuOpen: true,
      };
    }

    // 5. If specific screen or category requested
    if (screenParam) {
      const validScreens: ScreenId[] = ['home', 'website', 'explorer', 'create_qr', 'creator_reg', 'reports', 'checkout', 'success', 'failed', 'cash_pending'];
      const matched = validScreens.find(s => s === screenParam.toLowerCase());
      if (matched) {
        return {
          screen: matched,
          category: (catParam as BawmCategory) || undefined,
        };
      }
    }

    if (catParam) {
      return {
        screen: 'explorer',
        category: catParam as BawmCategory,
      };
    }

    if (adminParam === 'true') {
      return {
        isAdminOpen: true,
      };
    }

    if (walletParam === 'true') {
      return {
        isWalletOpen: true,
      };
    }

    if (parsedView || isPhonePeOpen) {
      return {
        view: parsedView,
        isPhonePeOpen,
      };
    }

    return null;
  } catch (err) {
    console.error('Error parsing route URL:', err);
    return null;
  }
}

export function isAndroidOrMobileApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  return isAndroid || isStandalone || (isMobile && window.innerWidth < 768);
}

export function updateBrowserView(view: 'website' | 'app', screen?: ScreenId) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (view === 'app') {
      url.searchParams.set('view', 'app');
      if (screen && screen !== 'home') {
        url.searchParams.set('screen', screen);
      }
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore history state errors
  }
}


export const PAYMENT_ROUTING_PARAMS = [
  'campaign', 'cmp', 'c', 'id', 'bawm', 'post', 'p',
  'screen', 'page', 'cat', 'category', 'title', 'upi', 'pa', 'loc', 'location',
  'receipt', 'receiptId', 'phonepe_txn_id', 'tx', 'txn', 'txnId', 'merchantTransactionId', 'orderId',
  'status', 'code', 'responseCode', 'state', 'failed', 'reason', 'msg', 'error',
  'phonepe', 'pg', 'phonepe_checkout', 'pay', 'simulate', 'gateway', 'mock', 'mode', 'fallback',
  'amt', 'amount', 'baseAmt', 'fee', 'feeOpt', 'cid', 'ctitle',
  'donor', 'donorPhone', 'payer', 'name', 'section', 'veng', 'anon', 'utr',
  'roll', 'member_roll', 'memberRoll', 'sulhnu', 'history', 'admin', 'wallet'
];

const consumedReceiptIds = new Set<string>();

export function markReceiptAsConsumed(receiptId?: string | null) {
  if (!receiptId || typeof receiptId !== 'string') return;
  const cleanId = receiptId.trim();
  if (!cleanId) return;
  consumedReceiptIds.add(cleanId);
  try {
    const stored = sessionStorage.getItem('RONPAY_CONSUMED_RECEIPTS');
    const list: string[] = stored ? JSON.parse(stored) : [];
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      sessionStorage.setItem('RONPAY_CONSUMED_RECEIPTS', JSON.stringify(list));
    }
  } catch {}
}

export function isReceiptConsumed(receiptId?: string | null): boolean {
  if (!receiptId || typeof receiptId !== 'string') return false;
  const cleanId = receiptId.trim();
  if (!cleanId) return false;
  if (consumedReceiptIds.has(cleanId)) return true;
  try {
    const stored = sessionStorage.getItem('RONPAY_CONSUMED_RECEIPTS');
    if (stored) {
      const list: string[] = JSON.parse(stored);
      if (Array.isArray(list) && list.includes(cleanId)) {
        consumedReceiptIds.add(cleanId);
        return true;
      }
    }
  } catch {}
  return false;
}

export function cleanPaymentUrlParams() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    PAYMENT_ROUTING_PARAMS.forEach(p => url.searchParams.delete(p));
    if (window.location.hash && (
      window.location.hash.includes('receipt') || 
      window.location.hash.includes('phonepe') || 
      window.location.hash.includes('screen') || 
      window.location.hash.includes('status') ||
      window.location.hash.includes('txn')
    )) {
      window.location.hash = '';
    }

    let targetPath = url.pathname;
    const lowerPath = targetPath.toLowerCase();
    if (
      lowerPath.includes('callback') ||
      lowerPath.includes('phonepe') ||
      lowerPath.includes('launch-pay') ||
      lowerPath.includes('uat')
    ) {
      targetPath = '/';
    }

    const queryStr = url.searchParams.toString();
    const newUrl = queryStr ? `${targetPath}?${queryStr}` : targetPath;
    window.history.replaceState({ screen: 'home' }, '', newUrl);
  } catch (e) {
    // Ignore history state errors
  }
}

/**
 * Updates the browser URL without reloading page, enabling shareable URLs
 */
export function updateBrowserUrl(
  screen: ScreenId, 
  campaign?: Campaign | null, 
  category?: BawmCategory | null,
  options: { replace?: boolean } = { replace: false }
) {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    
    // Completely wipe all past routing, payment, transaction, and simulator params
    PAYMENT_ROUTING_PARAMS.forEach(param => {
      url.searchParams.delete(param);
    });

    // Also clear hash if it contained receipt/status/phonepe remnants
    if (window.location.hash && (
      window.location.hash.includes('receipt') || 
      window.location.hash.includes('phonepe') || 
      window.location.hash.includes('status') ||
      window.location.hash.includes('screen')
    )) {
      window.location.hash = '';
    }

    let targetPath = url.pathname;
    const lowerPath = targetPath.toLowerCase();
    if (
      screen === 'home' ||
      lowerPath.includes('callback') ||
      lowerPath.includes('phonepe') ||
      lowerPath.includes('launch-pay') ||
      lowerPath.includes('uat')
    ) {
      targetPath = '/';
    }

    if (screen === 'checkout' && campaign) {
      url.searchParams.set('campaign', campaign.id);
      if (campaign.category) url.searchParams.set('cat', campaign.category);
      if (campaign.title) url.searchParams.set('title', campaign.title);
      if (campaign.upiId) url.searchParams.set('upi', campaign.upiId);
      if (campaign.location) url.searchParams.set('loc', campaign.location);
    } else if (screen === 'explorer') {
      url.searchParams.set('screen', 'explorer');
      if (category) url.searchParams.set('cat', category);
    } else if (screen !== 'home') {
      url.searchParams.set('screen', screen);
    }

    const queryStr = url.searchParams.toString();
    const newUrl = queryStr ? `${targetPath}?${queryStr}` : targetPath;

    if (options.replace) {
      window.history.replaceState({ screen, campaignId: campaign?.id, category }, '', newUrl);
    } else {
      window.history.pushState({ screen, campaignId: campaign?.id, category }, '', newUrl);
    }
  } catch {
    // Ignore history state errors in restricted sandboxes
  }
}
