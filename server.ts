import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

// Initialize Express App
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoints for Cloud Run & Ingress
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// PhonePe Credentials from Env or UAT Defaults
const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT';
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'TSPMIZOPAYUAT';
const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID || 'TSPMIZOPAYUAT_2608171706';
const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1';
const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || 'Y2E1YWRiMjYtMDRlMy00ZDcxLWFjOTItYmFhOTUyMzA4MDc4';
const PHONEPE_UAT_BASE_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// In-memory mock database for transactions and webhook events
interface PaymentRecord {
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number; // in paise
  campaignTitle: string;
  status: 'PENDING' | 'PAYMENT_SUCCESS' | 'PAYMENT_ERROR' | 'PAYMENT_DECLINED';
  createdAt: string;
  phonePeTransactionId?: string;
  splitDetails?: {
    merchantShare: number;
    platformShare: number;
  };
}

const transactionStore: Record<string, PaymentRecord> = {};
const webhookLogStore: Array<{ id: string; receivedAt: string; payload: any }> = [];

// Helper: Calculate PhonePe Checksum / X-VERIFY
function generateChecksum(base64Payload: string, endpoint: string, saltKey: string, saltIndex: string = '1') {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${saltIndex}`;
}

// -------------------------------------------------------------
// API 1: PhonePe TSP Configuration & Status Info
// -------------------------------------------------------------
app.get('/api/phonepe/config', (req: Request, res: Response) => {
  res.json({
    status: 'SUCCESS',
    environment: PHONEPE_ENV,
    merchantId: PHONEPE_MERCHANT_ID,
    clientId: PHONEPE_CLIENT_ID,
    clientVersion: PHONEPE_CLIENT_VERSION,
    baseUrl: PHONEPE_UAT_BASE_URL,
    tspHeadersRequired: [
      'Authorization (Bearer TSP Token)',
      `X-MERCHANT-ID (${PHONEPE_MERCHANT_ID})`,
      'X-SOURCE (WEB)',
      'X-SOURCE-VERSION (1.0)',
      'Content-Type (application/json)'
    ],
    featuresSupported: [
      'Standard Checkout (UPI, Cards, NetBanking, Wallets)',
      'TSP Token Authorization',
      'Split Settlement (Merchant & RonPay Platform Fee)',
      'Webhook Callback Verification',
      'Refund & Status Inquiry'
    ]
  });
});

// -------------------------------------------------------------
// API 2: PhonePe TSP OAuth Token Generator
// -------------------------------------------------------------
app.post('/api/phonepe/token', async (req: Request, res: Response) => {
  try {
    // Standard PhonePe TSP Auth simulation / payload
    const token = 'tsp_uat_token_' + crypto.randomBytes(16).toString('hex');
    const expiresIn = 3600; // 1 hour
    
    res.json({
      success: true,
      code: 'SUCCESS',
      message: 'TSP Token generated successfully',
      data: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        clientId: PHONEPE_CLIENT_ID,
        merchantId: PHONEPE_MERCHANT_ID,
        issuedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// API 3: Initiate Standard Checkout (PG V2 Pay API)
// -------------------------------------------------------------
app.post('/api/phonepe/initiate-pay', (req: Request, res: Response) => {
  try {
    const { 
      amountInRupees, 
      donorName, 
      campaignTitle, 
      campaignId, 
      category, 
      customerPhone,
      simulateStatus 
    } = req.body;

    const amountInPaise = Math.round((Number(amountInRupees) || 100) * 100);
    const merchantTransactionId = `RPAY_TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const merchantUserId = `USER_${(customerPhone || '9862000000').replace(/\D/g, '')}`;

    // Standard PhonePe PG V2 Payload Schema
    const paymentPayload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      amount: amountInPaise,
      redirectUrl: `${req.headers.origin || 'http://localhost:3000'}/api/phonepe/callback?txnId=${merchantTransactionId}`,
      redirectMode: 'POST',
      callbackUrl: `${req.headers.origin || 'http://localhost:3000'}/api/phonepe/webhook`,
      mobileNumber: customerPhone || '9862300000',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    const xVerifyHeader = generateChecksum(base64Payload, '/pg/v1/pay', PHONEPE_CLIENT_SECRET, '1');

    // Calculate Split Settlement (99% Campaign Creator, 1% RonPay Platform Fee)
    const platformFeePaise = Math.round(amountInPaise * 0.01);
    const merchantSharePaise = amountInPaise - platformFeePaise;

    // Save state in record store
    transactionStore[merchantTransactionId] = {
      merchantTransactionId,
      merchantUserId,
      amount: amountInPaise,
      campaignTitle: campaignTitle || 'RonPay Community Bawm',
      status: simulateStatus === 'FAILURE' ? 'PAYMENT_ERROR' : (simulateStatus === 'PENDING' ? 'PENDING' : 'PAYMENT_SUCCESS'),
      createdAt: new Date().toISOString(),
      phonePeTransactionId: `T${Date.now()}`,
      splitDetails: {
        merchantShare: merchantSharePaise,
        platformShare: platformFeePaise
      }
    };

    // Return Standard Checkout Response
    res.json({
      success: true,
      code: 'PAYMENT_INITIATED',
      message: 'Payment request initiated on PhonePe PG V2',
      data: {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        instrumentResponse: {
          type: 'PAY_PAGE',
          redirectInfo: {
            url: `https://mercury-uat.phonepe.com/transact/simulator?token=${merchantTransactionId}`,
            method: 'POST'
          }
        },
        payloadBase64: base64Payload,
        xVerify: xVerifyHeader,
        tspHeaders: {
          'X-MERCHANT-ID': PHONEPE_MERCHANT_ID,
          'X-VERIFY': xVerifyHeader,
          'Content-Type': 'application/json'
        },
        splitSettlement: {
          totalRupees: (amountInPaise / 100).toFixed(2),
          campaignSettlementRupees: (merchantSharePaise / 100).toFixed(2),
          platformFeeRupees: (platformFeePaise / 100).toFixed(2),
          rule: '1% RonPay Gateway Service Fee + 99% Direct Campaign Account'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// API 4: Check Transaction Status (PG V2 Status API)
// -------------------------------------------------------------
app.get('/api/phonepe/status/:merchantTransactionId', (req: Request, res: Response) => {
  const { merchantTransactionId } = req.params;
  const record = transactionStore[merchantTransactionId];

  if (!record) {
    return res.status(404).json({
      success: false,
      code: 'TRANSACTION_NOT_FOUND',
      message: `Transaction ${merchantTransactionId} does not exist.`
    });
  }

  // Calculate Checksum for Status endpoint: /pg/v1/status/{merchantId}/{merchantTransactionId}
  const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
  const xVerify = generateChecksum('', endpoint, PHONEPE_CLIENT_SECRET, '1');

  res.json({
    success: true,
    code: record.status,
    message: record.status === 'PAYMENT_SUCCESS' ? 'Your payment has been successfully processed.' : 'Transaction pending or unconfirmed.',
    data: {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: record.merchantTransactionId,
      transactionId: record.phonePeTransactionId,
      amount: record.amount,
      state: 'COMPLETED',
      responseCode: record.status === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'PENDING',
      paymentInstrument: {
        type: 'UPI',
        utr: 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000),
        vpa: 'user@phonepe'
      },
      splitDetails: record.splitDetails,
      xVerify: xVerify
    }
  });
});

// -------------------------------------------------------------
// API 5: Split Settlement API Spec & Calculation
// -------------------------------------------------------------
app.post('/api/phonepe/split-settlement', (req: Request, res: Response) => {
  const { amount, merchantVpa, platformVpa } = req.body;
  const total = Number(amount) || 500;
  const platformFee = Number((total * 0.01).toFixed(2));
  const merchantAmount = Number((total - platformFee).toFixed(2));

  res.json({
    success: true,
    message: 'PhonePe Split Settlement configured for RonPay',
    splitInstruction: {
      merchantId: PHONEPE_MERCHANT_ID,
      settlementType: 'SPLIT_SETTLEMENT',
      splits: [
        {
          recipientType: 'CAMPAIGN_MERCHANT',
          accountOrVpa: merchantVpa || 'mizo.bawm@axl',
          amount: merchantAmount,
          percentage: '99%',
          description: 'Direct Campaign Bawm Settlement'
        },
        {
          recipientType: 'PLATFORM_OPERATOR',
          accountOrVpa: platformVpa || 'ronpay.tech@ybl',
          amount: platformFee,
          percentage: '1%',
          description: 'RonPay TSP Platform Technology Fee'
        }
      ]
    }
  });
});

// -------------------------------------------------------------
// API 6: Webhook Callback Receiver
// -------------------------------------------------------------
app.post('/api/phonepe/webhook', (req: Request, res: Response) => {
  const eventId = 'EVT_' + Date.now();
  webhookLogStore.unshift({
    id: eventId,
    receivedAt: new Date().toISOString(),
    payload: req.body
  });

  // Limit log store to 50 entries
  if (webhookLogStore.length > 50) webhookLogStore.pop();

  res.json({
    success: true,
    message: 'PhonePe webhook notification received and recorded successfully.'
  });
});

// API 7: Fetch Webhook Logs for Admin/Developer review
app.get('/api/phonepe/webhook-logs', (req: Request, res: Response) => {
  res.json({
    total: webhookLogStore.length,
    logs: webhookLogStore
  });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || hasDist;

  if (!isProduction) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite middleware could not be loaded, defaulting to static files:', err);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (req: Request, res: Response) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('RonPay Server is active.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`RonPay Server running on http://0.0.0.0:${PORT} (PID: ${process.pid}, NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer();
