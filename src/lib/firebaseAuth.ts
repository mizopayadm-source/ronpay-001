import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  Auth
} from 'firebase/auth';

const env = (import.meta as any).env || {};

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDbLHlj2yEDQVxm2LRJjY8OMpuBab-TxEk",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ronpay-7fc69.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ronpay-7fc69",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ronpay-7fc69.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "807189818533",
  appId: env.VITE_FIREBASE_APP_ID || "1:807189818533:web:2ab29ad49be78f9824b14c",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-P29J9QMYK6"
};

let firebaseAuthInstance: Auth | null = null;
let activeRecaptchaVerifier: RecaptchaVerifier | null = null;
let latestConfirmationResult: ConfirmationResult | null = null;

export const getFirebaseAuth = (): Auth => {
  if (!firebaseAuthInstance) {
    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
    firebaseAuthInstance = getAuth(app);
    firebaseAuthInstance.useDeviceLanguage();
  }
  return firebaseAuthInstance;
};

/**
 * Formats an Indian 10-digit mobile number or international number to E.164 (+91XXXXXXXXXX)
 */
export const formatToE164Phone = (rawPhone: string): string => {
  const trimmed = (rawPhone || '').trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length >= 10) {
    return `+91${digits.slice(-10)}`;
  }
  return `+91${digits}`;
};

export const clearFirebaseRecaptcha = () => {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {
      // ignore cleanup error
    }
    activeRecaptchaVerifier = null;
  }
};

/**
 * Translates Firebase Auth error codes into clear, actionable Mizo messages
 */
export const formatFirebasePhoneError = (err: any): string => {
  const code = err?.code || '';
  const msg = err?.message || String(err || '');

  if (code === 'auth/invalid-phone-number') {
    return 'Phone number format a dik lo. Khawngaihin 10-digit mobile number dik tak chhu lut rawh (e.g. 9862300000).';
  }
  if (code === 'auth/invalid-verification-code') {
    return '❌ OTP Code i chhut luh hi a dik lo! SMS-a 6-digit OTP lo thleng kha enfiah la chhu nawn rawh.';
  }
  if (code === 'auth/code-expired') {
    return '⌛ He OTP Code hi a hun apel (Expired) tawh. "Resend OTP" hmetin OTP thar la rawh.';
  }
  if (code === 'auth/too-many-requests') {
    return '⚠️ Vawi tam lutuk OTP thawn tum a nih avangin Firebase-in darkar tlemte chhung a dang rih. Nakin deuhah tum leh rawh.';
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current-domain';
    return `⚠️ Domain Phalna A Awm Lo (auth/unauthorized-domain): Firebase Console -> Authentication -> Settings -> Authorized domains ah "${currentHost}" hi belh (Add domain) phawt a ngai.`;
  }
  if (code === 'auth/billing-not-enabled' || msg.includes('BILLING_NOT_ENABLED')) {
    return '⚠️ Firebase Project (ronpay-7fc69) ah Real SMS thawn chhuak turin Blaze Plan (Billing) link a ngai, emaw Firebase Console -> Authentication -> Sign-in method -> Phone -> "Phone numbers for testing" ah he phone number hi test OTP nen dah lut rawh.';
  }
  if (code === 'auth/quota-exceeded') {
    return '⚠️ Vawiina Firebase SMS OTP thawn theih zat (Daily Quota) a zo rih.';
  }
  if (code === 'auth/captcha-check-failed' || code === 'auth/network-request-failed') {
    return '⚠️ Network emaw reCAPTCHA verification a tlawlh. Internet connection enfiah la tum nawn leh rawh.';
  }
  return `Firebase OTP Error (${code || 'unknown'}): ${msg}`;
};

/**
 * Ensures a clean DOM container exists for Invisible reCAPTCHA and initializes RecaptchaVerifier
 */
const getOrCreateRecaptchaVerifier = (containerId: string = 'ronpay-firebase-recaptcha-container'): RecaptchaVerifier => {
  clearFirebaseRecaptcha();

  if (typeof document !== 'undefined') {
    let container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    } else {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }
  }

  const auth = getFirebaseAuth();
  activeRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved automatically
    },
    'expired-callback': () => {
      clearFirebaseRecaptcha();
    }
  });

  return activeRecaptchaVerifier;
};

/**
 * Sends a real SMS OTP via Firebase Authentication (project: ronpay-7fc69)
 */
export const sendFirebasePhoneOtp = async (
  rawPhone: string,
  containerId: string = 'ronpay-firebase-recaptcha-container'
): Promise<{
  success: boolean;
  e164Phone: string;
  confirmationResult?: ConfirmationResult;
  error?: string;
}> => {
  const cleanDigits = (rawPhone || '').replace(/\D/g, '');
  if (cleanDigits.length < 10) {
    return {
      success: false,
      e164Phone: rawPhone,
      error: 'Khawngaihin 10-digit Mobile Number dik tak chhu lut rawh.'
    };
  }

  const e164Phone = formatToE164Phone(rawPhone);

  try {
    const auth = getFirebaseAuth();
    const verifier = getOrCreateRecaptchaVerifier(containerId);
    const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, verifier);
    latestConfirmationResult = confirmationResult;
    return {
      success: true,
      e164Phone,
      confirmationResult
    };
  } catch (err: any) {
    clearFirebaseRecaptcha();
    return {
      success: false,
      e164Phone,
      error: formatFirebasePhoneError(err)
    };
  }
};

/**
 * Verifies the 6-digit SMS OTP code against Firebase ConfirmationResult
 */
export const verifyFirebasePhoneOtp = async (
  otpCode: string,
  customConfirmation?: ConfirmationResult | null
): Promise<{
  success: boolean;
  uid?: string;
  phoneNumber?: string | null;
  error?: string;
}> => {
  const cleanOtp = (otpCode || '').trim();
  if (!cleanOtp || cleanOtp.length < 6) {
    return {
      success: false,
      error: 'Khawngaihin SMS-a 6-Digit OTP Code lo thleng kha kim takin chhu lut rawh.'
    };
  }

  const targetConfirmation = customConfirmation || latestConfirmationResult;
  if (!targetConfirmation) {
    return {
      success: false,
      error: 'OTP session hmuh a ni lo. Khawngaihin "Send OTP" hmet tha leh rawh.'
    };
  }

  try {
    const credential = await targetConfirmation.confirm(cleanOtp);
    latestConfirmationResult = null;
    clearFirebaseRecaptcha();
    return {
      success: true,
      uid: credential.user?.uid,
      phoneNumber: credential.user?.phoneNumber
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatFirebasePhoneError(err)
    };
  }
};
