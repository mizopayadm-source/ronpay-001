import { Campaign, BawmCategory, ScreenId, Transaction } from '../types';
import { parseScannedPayload } from '../components/QRScannerModal';

export interface ParsedRoute {
  screen?: ScreenId;
  campaignId?: string;
  campaign?: Campaign;
  category?: BawmCategory;
  receiptId?: string;
  isSulhnuOpen?: boolean;
  isMemberRollOpen?: boolean;
  memberRollCampaignId?: string;
  isAdminOpen?: boolean;
  isWalletOpen?: boolean;
}

/**
 * Extracts query parameters from current window URL or hash
 */
export function getUrlRoute(campaigns: Campaign[], transactions: Transaction[]): ParsedRoute | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    let searchParams = url.searchParams;

    // Also check hash for parameters e.g. #/?campaign=xxx or #campaign=xxx
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.includes('?') || hash.includes('=')) {
        const hashQuery = hash.includes('?') ? hash.split('?')[1] : hash;
        const hashParams = new URLSearchParams(hashQuery);
        // Merge or prioritize hash params
        hashParams.forEach((val, key) => {
          if (!searchParams.has(key)) {
            searchParams.set(key, val);
          }
        });
      } else if (hash.startsWith('campaign/')) {
        const id = hash.replace('campaign/', '');
        if (id && !searchParams.has('campaign')) {
          searchParams.set('campaign', id);
        }
      }
    }

    // Also check pathname for /campaign/:id or /c/:id
    const pathname = window.location.pathname;
    const campPathMatch = pathname.match(/\/(?:campaign|c|bawm)\/([a-zA-Z0-9_-]+)/i);
    if (campPathMatch && campPathMatch[1] && !searchParams.has('campaign')) {
      searchParams.set('campaign', campPathMatch[1]);
    }

    const campaignId = searchParams.get('campaign') || 
                       searchParams.get('cmp') || 
                       searchParams.get('c') || 
                       searchParams.get('id') || 
                       searchParams.get('bawm') || 
                       searchParams.get('post');

    const receiptId = searchParams.get('receipt') || 
                      searchParams.get('tx') || 
                      searchParams.get('txn') || 
                      searchParams.get('receiptId');

    const rollId = searchParams.get('roll') || 
                   searchParams.get('member_roll') || 
                   searchParams.get('memberRoll');

    const screenParam = searchParams.get('screen') || searchParams.get('page') || searchParams.get('view');
    const catParam = searchParams.get('cat') || searchParams.get('category');
    const sulhnuParam = searchParams.get('sulhnu') || searchParams.get('history');
    const adminParam = searchParams.get('admin');
    const walletParam = searchParams.get('wallet');

    // 1. If Campaign ID is present: Match or reconstruct campaign
    if (campaignId) {
      const cleanId = decodeURIComponent(campaignId).trim();
      const existing = campaigns.find(c => c.id.toLowerCase() === cleanId.toLowerCase());
      
      if (existing) {
        return {
          screen: 'checkout',
          campaignId: existing.id,
          campaign: existing,
          category: existing.category,
        };
      }

      // Reconstruct dynamic campaign from URL parameters if passed in web link
      const title = searchParams.get('title');
      const upi = searchParams.get('upi');
      const loc = searchParams.get('loc');
      const org = searchParams.get('org');
      const target = searchParams.get('target');
      const cause = searchParams.get('cause');
      const creator = searchParams.get('creator');

      const deducedCategory = (catParam as BawmCategory) || 
        (cleanId.startsWith('cmp-k') ? 'kumtluang' : cleanId.startsWith('cmp-r') ? 'ralna' : 'others');

      const reconstructed: Campaign = {
        id: cleanId,
        category: deducedCategory,
        title: title ? decodeURIComponent(title) : 'Scanned Bawm',
        location: loc ? decodeURIComponent(loc) : 'Mizoram',
        gpsCoords: '23.7271, 92.7176',
        upiId: upi ? decodeURIComponent(upi) : 'ronpay@axl',
        orgCode: org ? decodeURIComponent(org) : undefined,
        targetAmount: target ? Number(target) : undefined,
        cause: cause ? decodeURIComponent(cause) : undefined,
        creatorName: creator ? decodeURIComponent(creator) : undefined,
        validityDate: '2027-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      return {
        screen: 'checkout',
        campaignId: cleanId,
        campaign: reconstructed,
        category: deducedCategory,
      };
    }

    // 2. If Receipt ID is present
    if (receiptId) {
      return {
        screen: 'success',
        receiptId: decodeURIComponent(receiptId).trim(),
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
      const validScreens: ScreenId[] = ['home', 'explorer', 'create_qr', 'creator_reg', 'reports', 'checkout', 'success', 'cash_pending'];
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

    return null;
  } catch (err) {
    console.error('Error parsing route URL:', err);
    return null;
  }
}

/**
 * Updates the browser URL without reloading page, enabling shareable URLs
 */
export function updateBrowserUrl(screen: ScreenId, campaign?: Campaign | null, category?: BawmCategory | null) {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    
    // Clear old routing params
    url.searchParams.delete('campaign');
    url.searchParams.delete('cmp');
    url.searchParams.delete('c');
    url.searchParams.delete('id');
    url.searchParams.delete('bawm');
    url.searchParams.delete('post');
    url.searchParams.delete('screen');
    url.searchParams.delete('cat');
    url.searchParams.delete('title');
    url.searchParams.delete('upi');
    url.searchParams.delete('loc');
    url.searchParams.delete('receipt');

    if (screen === 'checkout' && campaign) {
      url.searchParams.set('campaign', campaign.id);
      if (campaign.category) url.searchParams.set('cat', campaign.category);
      if (campaign.title) url.searchParams.set('title', campaign.title);
      if (campaign.upiId) url.searchParams.set('upi', campaign.upiId);
      if (campaign.location) url.searchParams.set('loc', campaign.location);
    } else if (screen === 'explorer' && category) {
      url.searchParams.set('screen', 'explorer');
      url.searchParams.set('cat', category);
    } else if (screen !== 'home') {
      url.searchParams.set('screen', screen);
    }

    const newUrl = url.searchParams.toString() ? `${url.pathname}?${url.searchParams.toString()}` : url.pathname;
    window.history.replaceState({}, '', newUrl);
  } catch {
    // Ignore history replace state in strict sandboxes
  }
}
