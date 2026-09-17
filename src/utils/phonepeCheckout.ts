/**
 * PhonePe Standard Checkout (Website API Integration) Utility
 * Aligned with official PhonePe documentation:
 * https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website
 *
 * Steps:
 * 1. Generate Authorization Token (server-side /v1/oauth/token)
 * 2. Create Payment Request (server-side /checkout/v2/pay)
 * 3. Invoke iframe PayPage (window.PhonePeCheckout.transact with type: 'IFRAME')
 * 4. Verify Payment Response (server-side /checkout/v2/order/{merchantOrderId}/status)
 */

declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (options: {
        tokenUrl: string;
        callback: (response: 'USER_CANCEL' | 'CONCLUDED' | string) => void;
        type: 'IFRAME' | 'REDIRECT';
      }) => void;
      closePage: () => void;
    };
  }
}

export interface PhonePeInitiatePaymentParams {
  merchantTransactionId?: string;
  amountInRupees: number;
  baseAmountInRupees?: number;
  feeOption?: 'ADD_ON' | 'DEDUCT';
  donorName?: string;
  donorPhone?: string;
  campaignId?: string;
  campaignTitle?: string;
  category?: string;
  isAnonymous?: boolean;
  origin?: string;
  simulateStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING';
}

export interface PhonePeInitiatePaymentResponse {
  success: boolean;
  orderId?: string;
  merchantOrderId?: string;
  redirectUrl?: string;
  state?: string;
  expireAfter?: number;
  code?: string;
  message?: string;
  data?: {
    orderId?: string;
    merchantOrderId?: string;
    redirectUrl?: string;
    merchantTransactionId?: string;
    token?: string;
    instrumentResponse?: {
      type: string;
      redirectInfo?: {
        url?: string;
        mercuryUrl?: string;
        localUrl?: string;
        method?: string;
      };
    };
    [key: string]: any;
  };
}

export interface PhonePeStatusResponse {
  success: boolean;
  orderId?: string;
  merchantOrderId?: string;
  state?: 'COMPLETED' | 'FAILED' | 'PENDING' | string;
  amount?: number;
  paymentDetails?: Array<{
    paymentMode?: string;
    transactionId?: string;
    utr?: string;
    state?: string;
  }>;
  code?: string;
  message?: string;
  data?: {
    status?: string;
    state?: string;
    amount?: number;
    amountRupees?: number;
    utr?: string;
    merchantTransactionId?: string;
    transactionId?: string;
    [key: string]: any;
  };
}

const PHONEPE_BUNDLE_URL_SANDBOX = 'https://mercury-uat.phonepe.com/web/bundle/checkout.js';
const PHONEPE_BUNDLE_URL_PROD = 'https://mercury.phonepe.com/web/bundle/checkout.js';

let scriptLoadPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads the official PhonePe Checkout script bundle
 * into the document if not already loaded.
 */
export function loadPhonePeCheckoutScript(env: 'SANDBOX' | 'PROD' = 'SANDBOX'): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if (window.PhonePeCheckout && typeof window.PhonePeCheckout.transact === 'function') {
    return Promise.resolve(true);
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector(`script[src*="checkout.js"]`);
    if (existingScript && window.PhonePeCheckout) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = env === 'PROD' ? PHONEPE_BUNDLE_URL_PROD : PHONEPE_BUNDLE_URL_SANDBOX;
    script.async = true;
    script.onload = () => {
      resolve(Boolean(window.PhonePeCheckout && typeof window.PhonePeCheckout.transact === 'function'));
    };
    script.onerror = () => {
      console.warn('PhonePe checkout.js failed to load, falling back to direct iframe / redirect');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Step 2: Call the backend Create Payment Request endpoint (/checkout/v2/pay or /api/phonepe/initiate-pay)
 */
export async function initiatePhonePePayment(
  params: PhonePeInitiatePaymentParams
): Promise<PhonePeInitiatePaymentResponse> {
  const origin = params.origin || (typeof window !== 'undefined' ? window.location.origin : 'https://ronpay.app');

  const response = await fetch('/api/phonepe/initiate-pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      merchantTransactionId: params.merchantTransactionId,
      amountInRupees: params.amountInRupees,
      baseAmountInRupees: params.baseAmountInRupees,
      feeOption: params.feeOption || 'ADD_ON',
      donorName: params.donorName || 'Valued Donor',
      donorPhone: params.donorPhone || '9862000000',
      campaignId: params.campaignId,
      campaignTitle: params.campaignTitle,
      category: params.category,
      isAnonymous: Boolean(params.isAnonymous),
      simulateStatus: params.simulateStatus,
      origin: origin
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { message: errorText || `HTTP ${response.status}` };
    }
    throw new Error(parsed?.message || `Payment initiation failed (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * Step 3: Invoke iframe PayPage using the official PhonePe Checkout bundle.
 * Falls back gracefully to redirect or embedded container if window.PhonePeCheckout is unavailable.
 */
export async function invokePhonePePayPage(options: {
  tokenUrl: string;
  type?: 'IFRAME' | 'REDIRECT';
  onConcluded: () => void;
  onUserCancel: () => void;
  onError?: (err: any) => void;
}): Promise<boolean> {
  const { tokenUrl, type = 'IFRAME', onConcluded, onUserCancel, onError } = options;

  if (!tokenUrl) {
    if (onError) onError(new Error('Missing tokenUrl for PhonePe PayPage'));
    return false;
  }

  try {
    const hasSdk = await loadPhonePeCheckoutScript();
    if (hasSdk && window.PhonePeCheckout && typeof window.PhonePeCheckout.transact === 'function') {
      window.PhonePeCheckout.transact({
        tokenUrl: tokenUrl,
        callback: (response: string) => {
          if (response === 'USER_CANCEL') {
            onUserCancel();
          } else if (response === 'CONCLUDED' || response === 'SUCCESS') {
            onConcluded();
          } else {
            // Default to concluded to verify status via authoritative API
            onConcluded();
          }
        },
        type: type
      });
      return true;
    } else {
      // Fallback if script is blocked or unavailable
      console.info('PhonePeCheckout SDK not available, using iframe fallback or redirect');
      return false;
    }
  } catch (err) {
    if (onError) onError(err);
    return false;
  }
}

/**
 * Close the PayPage if currently opened via iframe
 */
export function closePhonePePayPage(): void {
  try {
    if (typeof window !== 'undefined' && window.PhonePeCheckout?.closePage) {
      window.PhonePeCheckout.closePage();
    }
  } catch (e) {
    console.warn('Error closing PhonePe PayPage:', e);
  }
}

/**
 * Step 4: Verify Payment Response via authoritative backend status endpoint
 */
export async function checkPhonePePaymentStatus(
  merchantTransactionId: string
): Promise<PhonePeStatusResponse> {
  const url = `/api/phonepe/status/${encodeURIComponent(merchantTransactionId)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!resp.ok) {
    throw new Error(`Status check failed (HTTP ${resp.status})`);
  }

  return await resp.json();
}
