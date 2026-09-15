export interface ScanPayParams {
  txnId: string;
  rawAmt: number;
  donorName: string;
  causeTitle: string;
  effectiveCategory: string;
  campId: string;
  baseAmt: number;
  feeAmt: number;
}

export function getScanPayHtml(params: ScanPayParams): string {
  const {
    txnId,
    rawAmt,
    donorName,
    causeTitle,
    effectiveCategory,
    campId,
    baseAmt,
    feeAmt
  } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>PhonePe Checkout - TSPMIZOPAYUAT</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --phonepe-purple: #5f259f;
      --phonepe-dark: #471879;
      --phonepe-light: #7b2cbf;
      --phonepe-bg: #f8fafc;
      --phonepe-text: #1e293b;
      --emerald: #10b981;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      background-color: var(--phonepe-bg);
      color: var(--phonepe-text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0 0 110px 0;
    }
    .main-wrapper {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 30px rgba(0,0,0,0.06);
    }
    /* Header - Exact PhonePe Brand */
    .top-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .merchant-logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #ff9800;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(255, 152, 0, 0.25);
    }
    .merchant-logo svg {
      width: 22px;
      height: 22px;
    }
    .merchant-info h1 {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .merchant-info p {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .btn-close-header {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-close-header:active { background: #e2e8f0; }

    /* Page Content */
    .content-body {
      padding: 20px;
      flex: 1;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 12px;
    }

    /* UPI Payment Grid (2x2) */
    .upi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    .upi-card {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;
    }
    .upi-card:active { transform: scale(0.98); }
    .upi-card.selected {
      border-color: #5f259f;
      background: #faf5ff;
      box-shadow: 0 2px 10px rgba(95, 37, 159, 0.12);
    }
    .upi-card .radio-dot {
      display: none;
      position: absolute;
      top: 8px;
      right: 8px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5f259f;
      color: #ffffff;
      font-size: 9px;
      align-items: center;
      justify-content: center;
      font-weight: 900;
    }
    .upi-card.selected .radio-dot { display: flex; }
    .upi-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .icon-phonepe { background: #5f259f; color: #ffffff; font-weight: 900; font-size: 16px; }
    .icon-gpay { background: #ffffff; border: 1px solid #e2e8f0; font-weight: 900; font-size: 14px; }
    .icon-paytm { background: #002970; color: #ffffff; font-weight: 900; font-size: 10px; }
    .icon-other { background: #f1f5f9; color: #475569; font-weight: 900; font-size: 14px; }
    .upi-name {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Other Methods */
    .other-methods {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }
    .method-row {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .method-row:active { transform: scale(0.98); }
    .method-row.selected {
      border-color: #5f259f;
      background: #faf5ff;
    }
    .method-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .method-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .method-name {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .method-badges {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .badge-pill {
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .chevron-right {
      color: #94a3b8;
      font-size: 18px;
      font-weight: 700;
    }

    /* Powered by PhonePe */
    .powered-by {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      margin-top: 10px;
    }
    .powered-by .pe-badge {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #5f259f;
      color: white;
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
    }
    .powered-by strong { color: #5f259f; font-weight: 800; }

    /* Sticky Bottom Bar - Exact Screenshot */
    .sticky-bottom {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      padding: 12px 18px;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.06);
      z-index: 30;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pay-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .amt-display {
      display: flex;
      flex-direction: column;
    }
    .amt-num {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .btn-breakup {
      font-size: 12px;
      font-weight: 700;
      color: #5f259f;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      text-decoration: underline;
    }
    .btn-pay-action {
      background: #5f259f;
      color: #ffffff;
      font-size: 15px;
      font-weight: 800;
      border: none;
      border-radius: 10px;
      padding: 12px 36px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(95, 37, 159, 0.3);
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-pay-action:active {
      transform: scale(0.97);
      background: #4e1c84;
    }
    .timeout-pill {
      background: #fff7ed;
      border: 1px solid #ffedd5;
      color: #c2410c;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      padding: 5px 10px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    /* UPI Authorization Bottom Sheet Modal */
    .sheet-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 50;
      align-items: flex-end;
      justify-content: center;
    }
    .sheet-modal {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-radius: 24px 24px 0 0;
      padding: 24px 20px;
      box-shadow: 0 -10px 30px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: slideUp 0.25s ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
    }
    .sheet-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pin-box {
      background: #faf5ff;
      border: 1.5px solid #d8b4fe;
      border-radius: 14px;
      padding: 16px;
      text-align: center;
    }
    .pin-dots {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 12px 0 6px;
    }
    .pin-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #cbd5e1;
      transition: background 0.15s;
    }
    .pin-dot.filled { background: #5f259f; }
    .btn-sheet-pay {
      background: #5f259f;
      color: #ffffff;
      font-size: 15px;
      font-weight: 800;
      padding: 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(95, 37, 159, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-sheet-pay:active { transform: scale(0.98); }

    /* Success Screen */
    .success-wrapper {
      display: none;
      padding: 30px 20px;
      text-align: center;
    }
    .success-circle {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 900;
      margin-bottom: 16px;
      box-shadow: 0 6px 20px rgba(22, 163, 74, 0.2);
    }
    .btn-return-app {
      background: #5f259f;
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      padding: 12px 20px;
      border-radius: 12px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="main-wrapper">
    <!-- Top Header matching Screenshot -->
    <div class="top-header">
      <div class="brand-left">
        <div class="merchant-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <div class="merchant-info">
          <h1>TSPMIZOPAYUAT</h1>
          <p>PhonePe PG Sandbox Gateway</p>
        </div>
      </div>
      <button type="button" class="btn-close-header" onclick="performSafeClose()" title="Close">✕</button>
    </div>

    <!-- Main Payment Options Body -->
    <div class="content-body" id="paymentContent">
      <!-- Section 1: UPI Payment -->
      <div class="section-title">UPI Payment</div>
      <div class="upi-grid">
        <!-- PhonePe (Selected by default) -->
        <div class="upi-card selected" id="optPhonePe" onclick="selectPaymentMethod('phonepe')">
          <div class="radio-dot">✓</div>
          <div class="upi-icon icon-phonepe">पे</div>
          <div class="upi-name">PhonePe</div>
        </div>

        <!-- Google Pay -->
        <div class="upi-card" id="optGpay" onclick="selectPaymentMethod('gpay')">
          <div class="radio-dot">✓</div>
          <div class="upi-icon icon-gpay" style="color:#1a73e8;">G</div>
          <div class="upi-name">Google Pay</div>
        </div>

        <!-- PayTM -->
        <div class="upi-card" id="optPaytm" onclick="selectPaymentMethod('paytm')">
          <div class="radio-dot">✓</div>
          <div class="upi-icon icon-paytm">pay</div>
          <div class="upi-name">PayTM</div>
        </div>

        <!-- Apps & UPI QR -->
        <div class="upi-card" id="optOtherUpi" onclick="selectPaymentMethod('other_upi')">
          <div class="radio-dot">✓</div>
          <div class="upi-icon icon-other">•••</div>
          <div class="upi-name">Apps & UPI QR</div>
        </div>
      </div>

      <!-- Section 2: Other Methods -->
      <div class="section-title">Other Methods</div>
      <div class="other-methods">
        <!-- Debit/Credit Card -->
        <div class="method-row" id="optCard" onclick="selectPaymentMethod('card')">
          <div class="method-left">
            <div class="method-icon">💳</div>
            <div class="method-name">Debit/Credit Card</div>
          </div>
          <div class="method-badges">
            <span class="badge-pill" style="color:#1a1f71; font-weight:900;">VISA</span>
            <span class="badge-pill" style="color:#eb001b; font-weight:900;">MC</span>
            <span class="badge-pill" style="color:#097939; font-weight:900;">RuPay</span>
            <span class="badge-pill">+2</span>
            <span class="chevron-right">›</span>
          </div>
        </div>

        <!-- Net Banking -->
        <div class="method-row" id="optNetBanking" onclick="selectPaymentMethod('netbanking')">
          <div class="method-left">
            <div class="method-icon">🏦</div>
            <div class="method-name">Net Banking</div>
          </div>
          <div class="method-badges">
            <span class="badge-pill" style="color:#004c8f;">SBI</span>
            <span class="badge-pill" style="color:#004b87;">HDFC</span>
            <span class="badge-pill" style="color:#af2622;">ICICI</span>
            <span class="badge-pill">+57</span>
            <span class="chevron-right">›</span>
          </div>
        </div>
      </div>

      <!-- UAT Sandbox Helper Info Banner -->
      <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 12px; padding: 12px 14px; margin-top: 12px; font-size: 11.5px; color: #6b21a8; line-height: 1.45;">
        <div style="font-weight: 800; font-size: 12px; margin-bottom: 3px; display:flex; align-items:center; gap:6px;">
          <span>⚡ PhonePe PG Sandbox Notice:</span>
        </div>
        Play Store PhonePe app hian Sandbox test lak a phal loh avangin, <strong>'Pay'</strong> hmet la, Sandbox UPI Authorization hmangin payment hi a tlang nghal ang.
      </div>

      <!-- Powered by PhonePe -->
      <div class="powered-by">
        <span>Powered by</span>
        <span class="pe-badge">पे</span>
        <strong>PhonePe</strong>
      </div>
    </div>

    <!-- Success Result Screen -->
    <div class="success-wrapper" id="successScreen">
      <div class="success-circle">✓</div>
      <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 6px;">Payment Successful!</h2>
      <p style="font-size: 14px; color: #64748b; margin-bottom: 20px; line-height: 1.5;">
        ₹${rawAmt.toFixed(2)} paid successfully to <strong>TSPMIZOPAYUAT</strong>.<br>
        <span style="color: #047857; font-weight: 700;">Desktop screen-ah official receipt a in-update nghal e.</span>
      </p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: left; font-size: 12px; margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:#64748b;">Transaction ID:</span>
          <span style="font-weight:700; font-family:monospace;">${txnId}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:#64748b;">UTR / Bank Ref:</span>
          <span style="font-weight:700; font-family:monospace; color:#047857;" id="successUtr">UTR${Date.now()}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Method:</span>
          <span style="font-weight:700;" id="successMethod">PhonePe UPI</span>
        </div>
      </div>

      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 11.5px; font-weight: 700; padding: 10px; border-radius: 10px; margin-bottom: 12px;" id="closeCountdownBanner">
        ⏳ He page hi <span id="secCount">3</span> seconds hnuah a in-close ang...
      </div>

      <button type="button" class="btn-return-app" onclick="performSafeClose()">
        <span>✕ Khar Rawh (Close Window)</span>
      </button>

      <a href="/?view=app&paid=${encodeURIComponent(txnId)}" style="display:block; margin-top:10px; font-size:12px; color:#5f259f; font-weight:700; text-decoration:none;">
        🏠 Return to RonPay Home
      </a>
    </div>

    <!-- Sticky Bottom Bar matching Screenshot -->
    <div class="sticky-bottom" id="stickyBottomBar">
      <div class="pay-row">
        <div class="amt-display">
          <div class="amt-num">₹${rawAmt.toFixed(2)}</div>
          <button type="button" class="btn-breakup" onclick="toggleBreakupModal()">View Breakup</button>
        </div>
        <button type="button" class="btn-pay-action" id="btnMainPay" onclick="handlePayClick()">
          <span id="btnPayText">Pay</span>
          <span id="btnPayArrow">➔</span>
        </button>
      </div>
      <div class="timeout-pill">
        <span>⏱</span>
        <span>This page will timeout in <strong id="timeoutTimer">04:24</strong> mins</span>
      </div>
    </div>
  </div>

  <!-- UPI Authorization Bottom Sheet Modal -->
  <div class="sheet-overlay" id="upiSheet" onclick="if(event.target===this) closeUpiSheet()">
    <div class="sheet-modal">
      <div class="sheet-header">
        <div class="sheet-title">
          <span class="upi-icon icon-phonepe" style="width:26px; height:26px; font-size:13px;" id="sheetMethodIcon">पे</span>
          <span id="sheetMethodTitle">PhonePe UPI Payment</span>
        </div>
        <button type="button" style="background:none; border:none; font-size:18px; color:#64748b; cursor:pointer;" onclick="closeUpiSheet()">✕</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 14px; border-radius:12px;">
        <div>
          <div style="font-size:11px; color:#64748b;">Pay To</div>
          <div style="font-size:14px; font-weight:800; color:#0f172a;">TSPMIZOPAYUAT</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; color:#64748b;">Amount</div>
          <div style="font-size:18px; font-weight:900; color:#5f259f;">₹${rawAmt.toFixed(2)}</div>
        </div>
      </div>

      <div class="pin-box">
        <div style="font-size:12px; font-weight:700; color:#581c87;">Enter 4-Digit UPI PIN to Authorize</div>
        <div class="pin-dots">
          <div class="pin-dot filled"></div>
          <div class="pin-dot filled"></div>
          <div class="pin-dot filled"></div>
          <div class="pin-dot filled"></div>
        </div>
        <div style="font-size:11px; color:#7e22ce; margin-top:6px;">Auto-Filled for PhonePe UAT Sandbox</div>
      </div>

      <button type="button" class="btn-sheet-pay" id="btnConfirmUpi" onclick="executePayment()">
        <span>Confirm & Pay ₹${rawAmt.toFixed(2)}</span>
      </button>

      <button type="button" onclick="closeUpiSheet()" style="background:none; border:none; font-size:12px; color:#64748b; font-weight:600; cursor:pointer; padding:6px;">
        Cancel
      </button>
    </div>
  </div>

  <!-- Breakup Modal -->
  <div class="sheet-overlay" id="breakupSheet" onclick="if(event.target===this) toggleBreakupModal()">
    <div class="sheet-modal">
      <div class="sheet-header">
        <div class="sheet-title">Payment Breakup</div>
        <button type="button" style="background:none; border:none; font-size:18px; color:#64748b; cursor:pointer;" onclick="toggleBreakupModal()">✕</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Campaign:</span>
          <span style="font-weight:700; color:#0f172a; text-align:right; max-width:220px;">${causeTitle}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Donor Name:</span>
          <span style="font-weight:700; color:#0f172a;">${donorName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid #f1f5f9;">
          <span style="color:#64748b;">Donation Amount:</span>
          <span style="font-weight:700;">₹${baseAmt.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">RonPay Platform Fee (1%):</span>
          <span style="font-weight:700;">₹${feeAmt.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid #e2e8f0; font-size:15px; font-weight:900;">
          <span>Total Payable:</span>
          <span style="color:#5f259f;">₹${rawAmt.toFixed(2)}</span>
        </div>
      </div>

      <button type="button" class="btn-sheet-pay" onclick="toggleBreakupModal()">
        <span>Got it</span>
      </button>
    </div>
  </div>

  <script>
    const txnId = ${JSON.stringify(txnId)};
    const amt = ${rawAmt};
    const donorName = ${JSON.stringify(donorName)};
    const causeTitle = ${JSON.stringify(causeTitle)};
    const categoryParam = ${JSON.stringify(effectiveCategory)};
    const campId = ${JSON.stringify(campId)};

    let selectedMethod = 'phonepe';

    function selectPaymentMethod(method) {
      selectedMethod = method;
      document.querySelectorAll('.upi-card, .method-row').forEach(el => el.classList.remove('selected'));
      
      if (method === 'phonepe') document.getElementById('optPhonePe')?.classList.add('selected');
      else if (method === 'gpay') document.getElementById('optGpay')?.classList.add('selected');
      else if (method === 'paytm') document.getElementById('optPaytm')?.classList.add('selected');
      else if (method === 'other_upi') document.getElementById('optOtherUpi')?.classList.add('selected');
      else if (method === 'card') document.getElementById('optCard')?.classList.add('selected');
      else if (method === 'netbanking') document.getElementById('optNetBanking')?.classList.add('selected');
    }

    function handlePayClick() {
      if (selectedMethod === 'phonepe' || selectedMethod === 'gpay' || selectedMethod === 'paytm' || selectedMethod === 'other_upi') {
        const titleEl = document.getElementById('sheetMethodTitle');
        const iconEl = document.getElementById('sheetMethodIcon');
        if (selectedMethod === 'phonepe') {
          if (titleEl) titleEl.innerText = 'PhonePe UPI Payment';
          if (iconEl) { iconEl.innerText = 'पे'; iconEl.className = 'upi-icon icon-phonepe'; }
        } else if (selectedMethod === 'gpay') {
          if (titleEl) titleEl.innerText = 'Google Pay UPI Payment';
          if (iconEl) { iconEl.innerText = 'G'; iconEl.className = 'upi-icon icon-gpay'; }
        } else if (selectedMethod === 'paytm') {
          if (titleEl) titleEl.innerText = 'PayTM UPI Payment';
          if (iconEl) { iconEl.innerText = 'pay'; iconEl.className = 'upi-icon icon-paytm'; }
        } else {
          if (titleEl) titleEl.innerText = 'UPI Authorization';
          if (iconEl) { iconEl.innerText = '•••'; iconEl.className = 'upi-icon icon-other'; }
        }
        document.getElementById('upiSheet').style.display = 'flex';
      } else if (selectedMethod === 'netbanking') {
        executePayment('Net Banking (SBI)');
      } else {
        executePayment('Debit Card (Visa)');
      }
    }

    function closeUpiSheet() {
      document.getElementById('upiSheet').style.display = 'none';
    }

    function toggleBreakupModal() {
      const sheet = document.getElementById('breakupSheet');
      if (sheet) sheet.style.display = sheet.style.display === 'flex' ? 'none' : 'flex';
    }

    async function executePayment(overrideMethod) {
      const btn = document.getElementById('btnConfirmUpi');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span style="display:inline-block; animation:spin 1s linear infinite;">🔄</span> Connecting to Bank...';
      }
      const mainBtn = document.getElementById('btnMainPay');
      if (mainBtn) {
        mainBtn.disabled = true;
        mainBtn.innerHTML = 'Authorizing...';
      }

      const methodLabel = overrideMethod || (
        selectedMethod === 'phonepe' ? 'PhonePe UPI' :
        selectedMethod === 'gpay' ? 'Google Pay' :
        selectedMethod === 'paytm' ? 'PayTM' :
        selectedMethod === 'card' ? 'Debit/Credit Card' :
        selectedMethod === 'netbanking' ? 'Net Banking' : 'UPI Payment'
      );

      try {
        const resp = await fetch('/api/phonepe/confirm-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantTransactionId: txnId,
            status: 'PAYMENT_SUCCESS',
            amountInRupees: amt,
            donorName: donorName,
            campaignTitle: causeTitle,
            campaignId: campId,
            category: categoryParam,
            paymentMethod: methodLabel
          })
        });
        const data = await resp.json();

        // Broadcast to desktop window
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('ronpay_payment_channel');
            bc.postMessage({
              type: 'PHONEPE_PAYMENT_SUCCESS',
              txnId: txnId,
              utr: data?.data?.utr
            });
            bc.close();
          }
        } catch(bcErr) {}

        closeUpiSheet();

        // Switch to Success View
        document.getElementById('paymentContent').style.display = 'none';
        document.getElementById('stickyBottomBar').style.display = 'none';
        document.getElementById('successScreen').style.display = 'block';

        if (data?.data?.utr) {
          document.getElementById('successUtr').innerText = data.data.utr;
        }
        document.getElementById('successMethod').innerText = methodLabel;

        // Auto Close countdown
        let sec = 4;
        const countEl = document.getElementById('secCount');
        const timer = setInterval(() => {
          sec--;
          if (countEl) countEl.innerText = sec;
          if (sec <= 0) {
            clearInterval(timer);
            performSafeClose();
          }
        }, 1000);

      } catch (err) {
        alert('Payment Authorization Error. Please retry.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Confirm & Pay ₹' + amt.toFixed(2);
        }
        if (mainBtn) {
          mainBtn.disabled = false;
          mainBtn.innerHTML = 'Pay ➔';
        }
      }
    }

    // Safe Window Close / Navigation
    function performSafeClose() {
      try { window.close(); } catch(e) {}
      try { window.open('', '_self', ''); window.close(); } catch(e) {}
      setTimeout(() => {
        window.location.replace('/?view=app&paid=' + encodeURIComponent(txnId));
      }, 300);
    }

    // Real timeout timer (04:24 counting down)
    let totalSec = 264;
    setInterval(() => {
      if (totalSec > 0) {
        totalSec--;
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        const el = document.getElementById('timeoutTimer');
        if (el) el.innerText = m + ':' + s;
      }
    }, 1000);
  </script>
</body>
</html>`;
}
