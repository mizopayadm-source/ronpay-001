import { Campaign, BawmCategory, ScreenId, Transaction } from '../types';
import { INITIAL_CAMPAIGNS } from '../data/initialData';
import { getStoredCampaigns, getStoredTransactions } from './storage';

export interface ParsedRoute {
  view?: 'website' | 'app';
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
  isPhonePeOpen?: boolean;
}

/**
 * Extracts query parameters and route information from current window URL or hash
 */
export function getUrlRoute(campaignsList?: Campaign[], transactionsList?: Transaction[]): ParsedRoute | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);

    // Also check hash for parameters e.g. #/?campaign=xxx, #campaign=xxx, #/c/xxx, #/post/xxx, #/app
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
      } else if (rawHash === 'app' || rawHash.startsWith('app/')) {
        searchParams.set('view', 'app');
      }
    }

    // Also check pathname for /app, /campaign/:id, /c/:id, /bawm/:id, /post/:id, /p/:id
    const pathname = window.location.pathname;
    const isAppPath = pathname === '/app' || pathname.startsWith('/app/');
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

    const receiptId = searchParams.get('receipt') || 
                      searchParams.get('tx') || 
                      searchParams.get('txn') || 
                      searchParams.get('tx_id') || 
                      searchParams.get('txnRef') || 
                      searchParams.get('tr') || 
                      searchParams.get('receiptId');

    const paymentStatus = searchParams.get('payment_status') || 
                          searchParams.get('status') || 
                          searchParams.get('upi_status') || 
                          searchParams.get('responseCode');

    const rollId = searchParams.get('roll') || 
                   searchParams.get('member_roll') || 
                   searchParams.get('memberRoll');

    const screenParam = searchParams.get('screen') || searchParams.get('page') || searchParams.get('view');
    const catParam = searchParams.get('cat') || searchParams.get('category');
    const sulhnuParam = searchParams.get('sulhnu') || searchParams.get('history');
    const adminParam = searchParams.get('admin');
    const walletParam = searchParams.get('wallet');
    const phonepeParam = searchParams.get('phonepe') || searchParams.get('uat') || searchParams.get('pg');

    // 0. If PhonePe UAT / PG parameter is present: Route directly to checkout & open PhonePe portal
    if (phonepeParam) {
      const allCampaigns = [
        ...(campaignsList || []),
        ...getStoredCampaigns(),
        ...INITIAL_CAMPAIGNS
      ];
      const defaultCamp = allCampaigns[0] || INITIAL_CAMPAIGNS[0];
      return {
        view: 'app',
        screen: 'checkout',
        campaignId: defaultCamp?.id,
        campaign: defaultCamp,
        category: defaultCamp?.category,
        isPhonePeOpen: true,
      };
    }

    // 1. If Campaign ID is present: Match existing campaign or reconstruct dynamic campaign
    if (campaignId) {
      const cleanId = decodeURIComponent(campaignId).trim();
      const allCampaigns = [
        ...(campaignsList || []),
        ...getStoredCampaigns(),
        ...INITIAL_CAMPAIGNS
      ];

      const existing = allCampaigns.find(c => c.id.toLowerCase() === cleanId.toLowerCase());
      
      if (existing) {
        return {
          view: 'app',
          screen: 'checkout',
          campaignId: existing.id,
          campaign: existing,
          category: existing.category,
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
        upiId: upi ? decodeURIComponent(upi) : 'ronpay@axl',
        orgName: org ? decodeURIComponent(org) : undefined,
        targetAmount: target ? Number(target) : undefined,
        cause: cause ? decodeURIComponent(cause) : undefined,
        creatorName: creator ? decodeURIComponent(creator) : undefined,
        mitthiHming: mitthi ? decodeURIComponent(mitthi) : undefined,
        vuiHun: vuiHun ? decodeURIComponent(vuiHun) : undefined,
        vuitu: vuitu ? decodeURIComponent(vuitu) : undefined,
        thihni: thihni ? decodeURIComponent(thihni) : undefined,
        imageUrl: img ? decodeURIComponent(img) : undefined,
        validityDate: '2027-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      return {
        view: 'app',
        screen: 'checkout',
        campaignId: cleanId,
        campaign: reconstructed,
        category: deducedCategory,
      };
    }

    // 2. If Receipt ID is present
    if (receiptId) {
      return {
        view: 'app',
        screen: 'success',
        receiptId: decodeURIComponent(receiptId).trim(),
      };
    }

    // 3. If Member Roll is requested
    if (rollId) {
      return {
        view: 'app',
        isMemberRollOpen: true,
        memberRollCampaignId: decodeURIComponent(rollId).trim(),
      };
    }

    // 4. If Sulhnu history is requested
    if (sulhnuParam === 'true' || sulhnuParam === '1') {
      return {
        view: 'app',
        isSulhnuOpen: true,
      };
    }

    // 5. If specific screen or category requested
    if (screenParam) {
      const validScreens: ScreenId[] = ['home', 'explorer', 'create_qr', 'creator_reg', 'reports', 'checkout', 'success', 'cash_pending'];
      const matched = validScreens.find(s => s === screenParam.toLowerCase());
      if (matched) {
        return {
          view: 'app',
          screen: matched,
          category: (catParam as BawmCategory) || undefined,
        };
      }
      if (screenParam === 'app') {
        return {
          view: 'app',
          screen: 'home',
          category: (catParam as BawmCategory) || undefined,
        };
      }
    }

    if (catParam) {
      return {
        view: 'app',
        screen: 'explorer',
        category: catParam as BawmCategory,
      };
    }

    if (adminParam === 'true') {
      return {
        view: 'app',
        isAdminOpen: true,
      };
    }

    if (walletParam === 'true') {
      return {
        view: 'app',
        isWalletOpen: true,
      };
    }

    // Explicit override checks in query parameters
    const explicitView = searchParams.get('view');
    const isExplicitWebsite = explicitView === 'website' || searchParams.get('website') === 'true' || searchParams.get('site') === 'true';
    const isExplicitApp = explicitView === 'app' || 
                          searchParams.get('app') === 'true' || 
                          searchParams.get('platform') === 'android' ||
                          searchParams.get('source') === 'android' ||
                          isAppPath;

    // 1. Explicit request for Website takes top precedence (e.g. user clicked "Website" button on mobile)
    if (isExplicitWebsite) {
      return {
        view: 'website',
      };
    }

    // 2. Explicit request for App
    if (isExplicitApp) {
      return {
        view: 'app',
        screen: 'home',
      };
    }

    // 3. Android Mobile App / Mobile Environment Check:
    // When opened from a Mobile App (Android APK, Android WebView, PWA, or Android phone):
    // The App dashboard (Khualmi Guest mode) launches directly without showing promotional web home.
    if (isAndroidOrMobileApp()) {
      return {
        view: 'app',
        screen: 'home',
      };
    }

    // 4. Default for Desktop / Web Browsers accessing the root domain (e.g. www.ronpay.com):
    // Shows the comprehensive RonPay Marketing & BBPS information website.
    return {
      view: 'website',
    };
  } catch (err) {
    console.error('Error parsing route URL:', err);
    return { view: isAndroidOrMobileApp() ? 'app' : 'website' };
  }
}

/**
 * Detects whether the current environment is a Mobile App, Android device, Android WebView, or standalone PWA.
 * On Mobile App / Android environments, the user expects to see the actual App directly (Bawm suites, Guest mode)
 * rather than the marketing website landing page.
 */
export function isAndroidOrMobileApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const win = window as any;

  // 1. Injected Android or mobile native app bridge objects (Cordova, Capacitor, React Native, custom WebView)
  if (
    win.Android !== undefined ||
    win.AndroidBridge !== undefined ||
    win.Capacitor !== undefined ||
    win.ReactNativeWebView !== undefined ||
    win.flutter_inappwebview !== undefined ||
    win._ronpay_android === true
  ) {
    return true;
  }

  // 2. Android device detection (all Android phones, tablets, Android APK wrappers, Android WebViews)
  if (/Android/i.test(ua)) {
    return true;
  }

  // 3. Standalone / Installed PWA / WebAPK / TWA (Trusted Web Activity)
  try {
    const isStandalone = 
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
      (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) ||
      (navigator as any).standalone === true;
    if (isStandalone) {
      return true;
    }
  } catch {}

  // 4. Android app intent referrer (e.g. android-app://com.ronpay.app)
  if (typeof document !== 'undefined' && document.referrer && document.referrer.startsWith('android-app://')) {
    return true;
  }

  // 5. Generic mobile device user agents (iPhone, iPad, Windows Phone, etc.)
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Switch between Website and App views with full browser history & URL update
 */
export function updateBrowserView(view: 'website' | 'app', screen: ScreenId = 'home') {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (view === 'website') {
      // Switch to website, set view=website explicitly so mobile devices know user intended to view website
      url.pathname = '/';
      url.searchParams.set('view', 'website');
      url.searchParams.delete('screen');
      url.searchParams.delete('app');
      url.hash = '';
      const newUrl = url.searchParams.toString() ? `${url.pathname}?${url.searchParams.toString()}` : url.pathname;
      window.history.pushState({ view: 'website' }, '', newUrl);
    } else {
      // Switch to /app
      if (!url.pathname.startsWith('/app')) {
        url.pathname = '/app';
      }
      url.searchParams.delete('view');
      url.searchParams.delete('website');
      url.searchParams.delete('site');
      if (screen && screen !== 'home') {
        url.searchParams.set('screen', screen);
      } else {
        url.searchParams.delete('screen');
      }
      const queryStr = url.searchParams.toString();
      const newUrl = queryStr ? `${url.pathname}?${queryStr}` : url.pathname;
      window.history.pushState({ view: 'app', screen }, '', newUrl);
    }
  } catch {}
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
    
    // Clear old routing params
    url.searchParams.delete('campaign');
    url.searchParams.delete('cmp');
    url.searchParams.delete('c');
    url.searchParams.delete('id');
    url.searchParams.delete('bawm');
    url.searchParams.delete('post');
    url.searchParams.delete('p');
    url.searchParams.delete('screen');
    url.searchParams.delete('cat');
    url.searchParams.delete('title');
    url.searchParams.delete('upi');
    url.searchParams.delete('loc');
    url.searchParams.delete('receipt');
    url.searchParams.delete('roll');
    url.searchParams.delete('sulhnu');
    url.searchParams.delete('admin');
    url.searchParams.delete('wallet');

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
    const newUrl = queryStr ? `${url.pathname}?${queryStr}` : url.pathname;

    if (options.replace) {
      window.history.replaceState({ screen, campaignId: campaign?.id, category }, '', newUrl);
    } else {
      window.history.pushState({ screen, campaignId: campaign?.id, category }, '', newUrl);
    }
  } catch {
    // Ignore history state errors in restricted sandboxes
  }
}
