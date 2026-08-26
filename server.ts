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
// CENTRAL DATABASE PERSISTENCE & MULTI-DEVICE SYNC APIS
// -------------------------------------------------------------
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'ronpay_db.json');

interface DatabaseSchema {
  campaigns: any[];
  members: any[];
  transactions: any[];
  creators: any[];
  pricingConfig: any;
  announcement: any;
  auditLogs: any[];
  lastUpdated: string;
}

function getDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
        members: Array.isArray(parsed.members) ? parsed.members : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        creators: Array.isArray(parsed.creators) ? parsed.creators : [],
        pricingConfig: parsed.pricingConfig || null,
        announcement: parsed.announcement || null,
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    }
  } catch (err) {
    console.error('Failed reading DB file:', err);
  }
  return {
    campaigns: [],
    members: [],
    transactions: [],
    creators: [],
    pricingConfig: null,
    announcement: null,
    auditLogs: [],
    lastUpdated: new Date().toISOString()
  };
}

function saveDatabase(db: DatabaseSchema) {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving DB file:', err);
  }
}

// Upsert helper for arrays by unique key
function mergeCollections<T extends Record<string, any>>(serverList: T[], clientList: T[], key: string = 'id'): T[] {
  if (!Array.isArray(clientList) || clientList.length === 0) return serverList;
  const map = new Map<string, T>();
  // 1. Put server items
  for (const item of serverList) {
    if (item && item[key]) {
      map.set(String(item[key]).toLowerCase(), item);
    }
  }
  // 2. Put / overwrite with client items
  for (const item of clientList) {
    if (item && item[key]) {
      const k = String(item[key]).toLowerCase();
      const existing = map.get(k);
      map.set(k, { ...(existing || {}), ...item });
    }
  }
  return Array.from(map.values());
}

// GET /api/data/state - Fetch current central database state
app.get('/api/data/state', (req: Request, res: Response) => {
  const db = getDatabase();
  res.json({
    success: true,
    data: db,
    timestamp: db.lastUpdated
  });
});

// POST /api/data/sync - Bi-directional sync between App, Web Portal, & Multi-devices
app.post('/api/data/sync', (req: Request, res: Response) => {
  try {
    const {
      campaigns,
      members,
      transactions,
      creators,
      pricingConfig,
      announcement,
      auditLogs
    } = req.body || {};

    const db = getDatabase();

    // Merge collections intelligently
    if (Array.isArray(campaigns)) {
      db.campaigns = mergeCollections(db.campaigns, campaigns, 'id');
    }
    if (Array.isArray(members)) {
      db.members = mergeCollections(db.members, members, 'id');
    }
    if (Array.isArray(transactions)) {
      db.transactions = mergeCollections(db.transactions, transactions, 'id');
    }
    if (Array.isArray(creators)) {
      db.creators = mergeCollections(db.creators, creators, 'phone');
    }
    if (Array.isArray(auditLogs)) {
      db.auditLogs = mergeCollections(db.auditLogs, auditLogs, 'id');
    }
    if (pricingConfig && typeof pricingConfig === 'object') {
      db.pricingConfig = { ...(db.pricingConfig || {}), ...pricingConfig };
    }
    if (announcement && typeof announcement === 'object') {
      db.announcement = { ...(db.announcement || {}), ...announcement };
    }

    saveDatabase(db);

    res.json({
      success: true,
      message: 'State synchronized successfully',
      data: db,
      timestamp: db.lastUpdated
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single Campaign Fetch for QR Code Deep Linking / Web Portals
app.get('/api/campaigns/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const camp = db.campaigns.find(c => String(c.id).toLowerCase() === String(id).toLowerCase());
  if (camp) {
    res.json({ success: true, campaign: camp });
  } else {
    res.status(404).json({ success: false, message: `Campaign ${id} not found on server` });
  }
});

// Create / Update Campaign endpoint
app.post('/api/campaigns', (req: Request, res: Response) => {
  try {
    const campaign = req.body;
    if (!campaign || !campaign.id) {
      return res.status(400).json({ success: false, message: 'Invalid campaign payload' });
    }
    const db = getDatabase();
    db.campaigns = mergeCollections(db.campaigns, [campaign], 'id');
    saveDatabase(db);
    res.json({ success: true, campaign, data: db });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Members API
app.get('/api/members', (req: Request, res: Response) => {
  const { campaignId } = req.query;
  const db = getDatabase();
  let result = db.members;
  if (campaignId) {
    result = result.filter(m => String(m.campaignId).toLowerCase() === String(campaignId).toLowerCase());
  }
  res.json({ success: true, members: result });
});

app.post('/api/members', (req: Request, res: Response) => {
  try {
    const member = req.body;
    if (!member || !member.id) {
      return res.status(400).json({ success: false, message: 'Invalid member payload' });
    }
    const db = getDatabase();
    db.members = mergeCollections(db.members, [member], 'id');
    saveDatabase(db);
    res.json({ success: true, member, data: db });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/members/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.members = db.members.filter(m => String(m.id).toLowerCase() !== String(id).toLowerCase());
    saveDatabase(db);
    res.json({ success: true, message: `Member ${id} deleted` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Transactions API
app.get('/api/transactions', (req: Request, res: Response) => {
  const db = getDatabase();
  res.json({ success: true, transactions: db.transactions });
});

app.post('/api/transactions', (req: Request, res: Response) => {
  try {
    const tx = req.body;
    if (!tx || !tx.id) {
      return res.status(400).json({ success: false, message: 'Invalid transaction payload' });
    }
    const db = getDatabase();
    db.transactions = mergeCollections(db.transactions, [tx], 'id');
    saveDatabase(db);
    res.json({ success: true, transaction: tx, data: db });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Announcement API
app.get('/api/announcement', (req: Request, res: Response) => {
  const db = getDatabase();
  res.json({ success: true, announcement: db.announcement });
});

app.post('/api/announcement', (req: Request, res: Response) => {
  try {
    const ann = req.body;
    const db = getDatabase();
    db.announcement = ann;
    saveDatabase(db);
    res.json({ success: true, announcement: ann });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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
    console.log(`RonPay Server running on http://0.0.0.0:${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
