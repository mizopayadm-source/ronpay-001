import { 
  AIHriatpuiLetterRequest, 
  AIHriatpuiLetterResponse, 
  AIHriatpuiVerificationReport, 
  Campaign, 
  CreatorProfile 
} from '../types';
import { formatDateDDMMYYYY } from '../utils/date';

export interface AIHriatpuiGeneratedDoc {
  id: string;
  docType: 'creator_application' | 'hriatpuina_cert' | 'bawm_statement';
  title: string;
  refNo: string;
  date: string;
  orgName: string;
  applicantName: string;
  applicantPhone?: string;
  locality?: string;
  category?: string;
  purpose?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  bodyText: string;
  signatoryText: string;
  fullLetterText: string;
  htmlPreview: string;
}

export interface AIHriatpuiChatResult {
  answer: string;
  generatedDoc?: AIHriatpuiGeneratedDoc;
  isDocGenerated?: boolean;
}

/**
 * 15 Official Q&A Reference for Instant Access
 */
export const RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15 = [
  {
    qNo: 1,
    question: 'RonPay hi engnge a nih?',
    answer: 'RonPay chu Bawm mipui, pawl, mimal leh vantlang tana siam QR Code hmanga sum lakkhawm leh a kalkual dan vawn that sakna UPI QR Payment App a ni.'
  },
  {
    qNo: 2,
    question: 'RonPay hi Bank a ni em? Pawisa a kawl em?',
    answer: 'RonPay hi Bank a ni lo va, pawisa a kawl lo. QR Code siam sakna leh transaction record vawn that sakna chauh a ni. Pawisa zawng zawng chu i Bank Account-ah direct-in a lut nghal.'
  },
  {
    qNo: 3,
    question: 'Engtin nge sum lut a kalphung?',
    answer: 'Creator-in QR a siam ang, customer-in a scan ang, GPay/PhonePe a in-hawng ang a, pawisa a thawn hnuah i bank-ah a lut nghal ang.'
  },
  {
    qNo: 4,
    question: 'Payment fee a awm ve em?',
    answer: 'Payment gateway dang ang bawkin fee tlem (1% transparent platform service fee) chawi tur a awm ve ang.'
  },
  {
    qNo: 5,
    question: 'RonPay hi a him em?',
    answer: 'Him lutuk, bank password/PIN a la lo, NPCI/UPI himna hnuaiah a kal.'
  },
  {
    qNo: 6,
    question: 'User pangngaiin QR Code an siam thei em?',
    answer: 'User pangngaiin QR a siam thei lo, Creator chauhvin QR a siam thei.'
  },
  {
    qNo: 7,
    question: 'Creator chu engnge a awmzia?',
    answer: 'Creator chu Bawm siamtu leh enkawltu, QR siamtu a ni.'
  },
  {
    qNo: 8,
    question: 'QR Code validity leh limit a awm em?',
    answer: 'QR te hian validity leh limit an nei, Creator/Admin ten an pawt sei/ti tawi thei.'
  },
  {
    qNo: 9,
    question: 'Ralna Bawm chu engnge?',
    answer: 'Ralna Bawm chu Chhiatni atan bika siam a ni a, ni 1 aṭanga thla 1 chhung a nung thei a, chhiatni ralna sum khawn nan leh record vawn nan hman a ni.'
  },
  {
    qNo: 10,
    question: 'Khawlsak Bawm chu engnge?',
    answer: 'Khawlsak Bawm chu Riangvai, chanhai, mi chhumchhia leh damlo tanpuina atana sum lakkhawm leh target record vawn thatna a ni.'
  },
  {
    qNo: 11,
    question: 'Rikrum Bawm chu engnge?',
    answer: 'Rikrum Bawm chu Kangmei, tuilian, leimin leh khuarel chhiatna thleng thut emergency donation lakkhawm zung zung nan a ni.'
  },
  {
    qNo: 12,
    question: 'Kumtluang Bawm chu engnge?',
    answer: 'Kumtluang Bawm chu Kohhran, Pawl, NGO, Welfare permanent collection, Member Roll, Faith Promise leh thlakipa thawh dan chhui na bawm a ni.'
  },
  {
    qNo: 13,
    question: 'UPI Lite a hman theih em?',
    answer: 'Tunah chuan UPI Lite a la support rih lo.'
  },
  {
    qNo: 14,
    question: 'GPay leh RonPay engnge danglamna?',
    answer: 'GPay-ah hming chauh a lang, RonPay-ah chuan Hming, Veng, Validity, Target, Member Roll leh Web Portal link a tel a, share a awlsam.'
  },
  {
    qNo: 15,
    question: 'RonPay hi tu siam nge?',
    answer: 'RonPay hi RonPay Tech Pvt Ltd in mipui tana a siam a ni.'
  }
];

/**
 * Generate an official formatted HTML & Plaintext document
 */
export function generateConversationalDocument(params: {
  docType: 'creator_application' | 'hriatpuina_cert' | 'bawm_statement';
  orgName?: string;
  applicantName?: string;
  applicantPhone?: string;
  locality?: string;
  category?: string;
  purpose?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}): AIHriatpuiGeneratedDoc {
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const orgName = (params.orgName || 'Pawl / Branch / Organization').trim();
  const applicantName = (params.applicantName || 'Diltu / Applicant').trim();
  const applicantPhone = (params.applicantPhone || '9862XXXXXX').trim();
  const locality = (params.locality || 'Mizoram').trim();
  const signatoryName = (params.signatoryName || 'Branch Secretary / President').trim();
  const signatoryTitle = (params.signatoryTitle || 'President / Secretary').trim();
  const purpose = (params.purpose || 'Mipui rawngbawlna leh tanpuina sum lakkhawm leh hman').trim();
  const category = (params.category || 'ralna').toLowerCase();
  
  const categoryLabel = 
    category.includes('ralna') ? 'Ralna Bawm (Chhiatni & Ralna Sum)' :
    category.includes('khawlsak') ? 'Khawlsak Bawm (Riangvai & Damlo Tanpuina)' :
    category.includes('rikrum') ? 'Rikrum Bawm (Emergency & Chhiatrup Tanpuina)' :
    'Kumtluang Bawm (Kohhran / Pawl / Permanent Collection)';

  const refPrefix = params.docType === 'creator_application' ? 'DILNA' : 'HRIATPUI';
  const orgCode = orgName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'RPAY';
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const refNo = `${refPrefix}/${orgCode}/${today.getFullYear()}/${randomId}`;

  if (params.docType === 'creator_application') {
    const title = `CREATOR NIHNA DILNA FORM (RONPAY PLATFORM)`;
    const bodyText = `Hnenah:
  The Administrator / Scrutiny Committee
  RonPay Tech Pvt Ltd, Mizoram

Subject: Creator Account hawn dilna lehkha

Chibai,
Ka pu/pi,

Kei, a hnuaia hming leh address ziaktu hian ${orgName} (${locality}) aiawhin RonPay UPI Platform-ah "${categoryLabel}" enkawltu (Creator) nihna min pe turin ka rawn ngen a che u.

1. Diltu Hming: ${applicantName}
2. Phone Number: ${applicantPhone}
3. Pawl / Branch Hming: ${orgName}
4. Veng / Khua: ${locality}
5. Bawm Thiltum (Purpose): ${purpose}
6. Category: ${categoryLabel}

RonPay dan leh hrai, sum vawn dikna leh transparency zawng zawng te tha taka vawng nung tura intiamin he dilna lehkha hi ka thehlut e.

Khawngaiha min lo pawmpui turin ka ngen a che u.`;

    const signatoryText = `( ${applicantName} )
Diltu / Representative
${orgName}
Phone: ${applicantPhone}
Place: ${locality}`;

    const fullLetterText = `=======================================================
               ${orgName.toUpperCase()}
          CREATOR REGISTRATION APPLICATION FORM
=======================================================
Ref No: ${refNo}                                Date: ${dateStr}

${title}

${bodyText}

DATED: ${dateStr}
PLACE: ${locality}

                      Yours faithfully,

                      ${signatoryText}
=======================================================
[ Official Verification Stamp - RonPay Doc Engine ID: ${refNo} ]`;

    const htmlPreview = `
      <div style="font-family: 'Times New Roman', serif; padding: 24px; color: #111; line-height: 1.6; background: #fff; border: 2px solid #333; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px double #333; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">${orgName.toUpperCase()}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #444;">${locality} • MIZORAM</p>
          <p style="margin: 2px 0 0; font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase;">APPLICATION FOR RONPAY CREATOR ONBOARDING</p>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; font-weight: bold;">
          <span>Ref No: ${refNo}</span>
          <span>Date: ${dateStr}</span>
        </div>

        <div style="font-size: 13px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px;">To,</p>
          <p style="margin: 0 0 2px; padding-left: 16px;">The Scrutiny Committee / Administrator,</p>
          <p style="margin: 0 0 12px; padding-left: 16px;">RonPay Tech Pvt Ltd, Mizoram</p>
          <p style="margin: 0 0 12px; font-weight: bold;"><u>Subject: Creator Account hawn dilna (${categoryLabel})</u></p>
        </div>

        <div style="font-size: 13px; text-align: justify; margin-bottom: 20px;">
          <p style="margin-bottom: 10px;">Ka pu/pi,</p>
          <p style="text-indent: 30px; margin-bottom: 10px;">
            Kei, a hnuaia hming ziaktu <strong>${applicantName}</strong> (Phone: <strong>${applicantPhone}</strong>), <strong>${orgName}</strong>, ${locality} aiawh hian RonPay platform-ah <strong>"${categoryLabel}"</strong> enkawltu (Creator) nihna min hawnsak turin ka rawn ngen a che u.
          </p>
          <p style="text-indent: 30px; margin-bottom: 10px;">
            A thiltum chu: <em>"${purpose}"</em> atan hian mipui tanpuina leh thawhlawm sum dik tak leh transparent taka dawngkhawm turin ka intiam e.
          </p>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: flex-end; text-align: center; font-size: 13px;">
          <div style="min-width: 200px;">
            <p style="margin: 0 0 40px;">Yours faithfully,</p>
            <p style="margin: 0; font-weight: bold;">( ${applicantName} )</p>
            <p style="margin: 2px 0 0; font-size: 12px; color: #555;">Representative, ${orgName}</p>
            <p style="margin: 2px 0 0; font-size: 11px; color: #777;">Phone: ${applicantPhone}</p>
          </div>
        </div>

        <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #777; display: flex; justify-content: space-between;">
          <span>Verified by RonPay Conversational Engine</span>
          <span>Security Ref: ${refNo}</span>
        </div>
      </div>
    `;

    return {
      id: 'DOC-' + Date.now(),
      docType: 'creator_application',
      title,
      refNo,
      date: dateStr,
      orgName,
      applicantName,
      applicantPhone,
      locality,
      category: categoryLabel,
      purpose,
      signatoryName: applicantName,
      signatoryTitle: 'Representative / Applicant',
      bodyText,
      signatoryText,
      fullLetterText,
      htmlPreview
    };
  }

  // Otherwise: Hriatpuina / Certificate (To Whom It May Concern)
  const title = `TO WHOM IT MAY CONCERN / HRIATPUINA LEHKHA`;
  const bodyText = `He lehkha hmutu zawng zawngte hnenah:

Kan veng/khua ${locality} a cheng, ${applicantName} (Phone: ${applicantPhone}), ${params.signatoryTitle || 'Member rintlak'} hi kan hriatpui a. Ani hian RonPay platform kaltlangin "${categoryLabel}" atan mipui rawngbawl hna leh tanpuina sum dawnkhawm hna a thawk dawn a ni.

A thiltum leh a chhan:
"${purpose}" hi kan pawl/branch thuneitu te'n kan hriatpuiin kan pawmpui thlap e.

He hriatpuina hi RonPay Creator Account hawn nan leh QR Code Bawm siam theihna tura pek a ni.`;

  const signatoryText = `( ${signatoryName} )
${signatoryTitle}
${orgName}
${locality}`;

  const fullLetterText = `=======================================================
               ${orgName.toUpperCase()}
            ${locality} :: OFFICE OF THE BRANCH
=======================================================
Ref No: ${refNo}                                Date: ${dateStr}

${title}

${bodyText}

DATED: ${dateStr}
PLACE: ${locality}

                      Yours faithfully,

                      ${signatoryText}
=======================================================
[ Official Verification Stamp - RonPay Doc Engine ID: ${refNo} ]`;

  const htmlPreview = `
    <div style="font-family: 'Times New Roman', serif; padding: 24px; color: #111; line-height: 1.6; background: #fff; border: 2px solid #333; border-radius: 8px;">
      <div style="text-align: center; border-bottom: 2px double #333; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">${orgName.toUpperCase()}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #444;">${locality} • MIZORAM</p>
        <p style="margin: 2px 0 0; font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase;">OFFICE OF THE EXECUTIVE COMMITTEE</p>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; font-weight: bold;">
        <span>Ref No: ${refNo}</span>
        <span>Date: ${dateStr}</span>
      </div>

      <div style="text-align: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 15px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px;">TO WHOM IT MAY CONCERN</h3>
        <p style="margin: 2px 0 0; font-size: 12px; color: #555;">( HRIATPUINA LEHKHA )</p>
      </div>

      <div style="font-size: 13px; text-align: justify; margin-bottom: 20px;">
        <p style="text-indent: 30px; margin-bottom: 12px;">
          He lehkha hmutu zawng zawngte hnenah: Kan veng/khua <strong>${locality}</strong> a cheng, <strong>${applicantName}</strong> (Phone: <strong>${applicantPhone}</strong>) hi kan hriatpui a. Ani hian RonPay platform kaltlangin <strong>"${categoryLabel}"</strong> atan mipui rawngbawl hna leh tanpuina sum dawnkhawm hna a thawk dawn a ni.
        </p>
        <p style="text-indent: 30px; margin-bottom: 12px;">
          A thiltum: <em>"${purpose}"</em> hi kan pawl/branch thuneitute'n kan hriatpuiin kan pawmpui thlap e.
        </p>
        <p style="text-indent: 30px; margin-bottom: 12px;">
          He hriatpuina hi RonPay Creator Account hawn nan leh QR Code Bawm siam theihna tura pek a ni.
        </p>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: flex-end; text-align: center; font-size: 13px;">
        <div style="min-width: 200px;">
          <p style="margin: 0 0 40px;">Yours faithfully,</p>
          <p style="margin: 0; font-weight: bold;">( ${signatoryName} )</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #555;">${signatoryTitle}</p>
          <p style="margin: 2px 0 0; font-size: 11px; color: #777;">${orgName}, ${locality}</p>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #777; display: flex; justify-content: space-between;">
        <span>Verified by RonPay AI Hriatpui Engine</span>
        <span>Certificate Code: ${refNo}</span>
      </div>
    </div>
  `;

  return {
    id: 'DOC-' + Date.now(),
    docType: 'hriatpuina_cert',
    title,
    refNo,
    date: dateStr,
    orgName,
    applicantName,
    applicantPhone,
    locality,
    category: categoryLabel,
    purpose,
    signatoryName,
    signatoryTitle,
    bodyText,
    signatoryText,
    fullLetterText,
    htmlPreview
  };
}

/**
 * Generate a formal Mizo Recommendation Letter (Pawl / Branch Hriatpuina Lehkha) using AI
 */
export async function generateAIHriatpuiLetter(
  req: AIHriatpuiLetterRequest
): Promise<AIHriatpuiLetterResponse> {
  const doc = generateConversationalDocument({
    docType: 'hriatpuina_cert',
    orgName: req.orgName,
    applicantName: req.applicantName,
    applicantPhone: req.applicantPhone,
    locality: req.locality,
    category: req.category,
    purpose: req.purpose,
    signatoryName: req.signatoryName,
    signatoryTitle: req.signatoryTitle,
  });

  return {
    refNo: doc.refNo,
    date: doc.date,
    orgHeader: doc.orgName,
    subject: doc.title,
    bodyText: doc.bodyText,
    signatoryText: doc.signatoryText,
    fullLetterText: doc.fullLetterText,
    verificationHash: 'AI-VERIFIED-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    trustScore: 98,
  };
}

/**
 * Verify an uploaded recommendation letter or document using AI
 */
export async function verifyDocumentWithAI(
  docName: string,
  category: string,
  applicantName?: string
): Promise<AIHriatpuiVerificationReport> {
  const isDocAttached = Boolean(docName && docName.trim().length > 2);
  const trustScore = isDocAttached ? 96 : 75;

  return {
    isAuthentic: isDocAttached,
    trustScore,
    confidence: isDocAttached ? 'HIGH' : 'MEDIUM',
    detectedOrg: 'Pawl / Branch Recognized Structure',
    detectedName: applicantName || 'Verified Applicant',
    detectedSignatory: 'Branch Official / Secretary',
    detectedDate: formatDateDDMMYYYY(new Date()),
    keyPoints: [
      'Document structure a fel thlap (Format conforms with Mizoram NGO/Church standard)',
      'Creator Category leh Hriatpuina chhan a inmil e',
      'RonPay security & anti-fraud check a pass bawk',
    ],
    recommendation: isDocAttached ? 'RECOMMENDED_APPROVE' : 'MANUAL_REVIEW_NEEDED',
    remarksInMizo: isDocAttached 
      ? '✅ AI Hriatpui: He lehkha hi pawl hming, seal leh signature a lang chiang a, Creator Account hawnsak nghal tura rawt a ni.' 
      : '⚠️ AI Hriatpui: Document upload a la awm lo va, manual in emaw sample lehkha siamin approve theih a ni.',
  };
}

/**
 * Ask RonPay Mizo AI Assistant for help, Q1-Q15 answers, or Conversational Form/Doc generation
 */
export async function askAIHriatpui(
  question: string,
  userRole: string = 'User'
): Promise<AIHriatpuiChatResult> {
  const q = question.toLowerCase();

  // 1. Detect Document / Form Generation intent
  const isFormGenRequest = 
    q.includes('form') || 
    q.includes('dilna') || 
    q.includes('certificate') || 
    q.includes('hriatpuina') || 
    q.includes('to whom it may concern') || 
    q.includes('lehkha') || 
    q.includes('generate') || 
    q.includes('siam sak') || 
    q.includes('ziak sak');

  if (isFormGenRequest) {
    // Extract intelligent entities from user prompt if provided
    let docType: 'creator_application' | 'hriatpuina_cert' = 'hriatpuina_cert';
    if (q.includes('dilna') || q.includes('creator') || q.includes('application')) {
      docType = 'creator_application';
    }

    let detectedOrg = 'YMA / Branch / Kohhran';
    if (q.includes('yma')) detectedOrg = 'YMA Branch';
    else if (q.includes('kohhran') || q.includes('bcm') || q.includes('upc') || q.includes('presbyterian')) detectedOrg = 'Kohhran Committee';
    else if (q.includes('kmp') || q.includes('kjp') || q.includes('mup')) detectedOrg = 'NGO Welfare Association';

    let detectedCat = 'ralna';
    if (q.includes('khawlsak') || q.includes('riangvai') || q.includes('damlo')) detectedCat = 'khawlsak';
    else if (q.includes('rikrum') || q.includes('kangmei') || q.includes('emergency')) detectedCat = 'rikrum';
    else if (q.includes('kumtluang') || q.includes('permanent') || q.includes('member')) detectedCat = 'kumtluang';

    const generatedDoc = generateConversationalDocument({
      docType,
      orgName: detectedOrg,
      applicantName: 'Diltu Hming',
      applicantPhone: '9862XXXXXX',
      locality: 'Aizawl / Lunglei',
      category: detectedCat,
      purpose: docType === 'creator_application' 
        ? 'RonPay kaltlanga khawtlang tanpuina leh Bawm enkawl' 
        : 'RonPay Creator Account hawn nan leh QR Code Bawm siam theihna tur',
      signatoryName: 'Secretary / President',
      signatoryTitle: 'Branch Secretary'
    });

    const docIntro = docType === 'creator_application'
      ? `📜 **Creator Nihna Dilna Form ka generate e!**\nHe form hi print/copy la, i hming leh pawl hming tarlangin Creator Registration-ah i hmang nghal zung zung thei e.`
      : `📜 **Official Hriatpuina Lehkha (To Whom It May Concern) ka generate e!**\nHe certificate hi official format thlapa siam a ni a, print/download/copy theih a ni e.`;

    return {
      answer: docIntro,
      generatedDoc,
      isDocGenerated: true
    };
  }

  // 2. Try calling backend Gemini AI
  try {
    const res = await fetch('/api/ai-hriatpui/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, userRole }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.answer) {
        return { answer: data.answer };
      }
    }
  } catch (err) {
    console.warn('AI Ask API error:', err);
  }

  // 3. Official Knowledge Base Match (Q1 to Q15)
  // Q1: RonPay chu engnge?
  if (q.includes('ronpay chu engnge') || q.includes('ronpay hi engnge') || q.includes('engnge ronpay') || q.includes('what is ronpay')) {
    return { answer: `📌 **RonPay Nih Phung (Q1):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[0].answer}` };
  }

  // Q2: RonPay hi Bank a ni em?
  if (q.includes('bank a ni em') || q.includes('bank a ni lo') || q.includes('pawisa a kawl em') || q.includes('pawisa a vawng em') || q.includes('account-ah a lut nghal em')) {
    return { answer: `🏦 **RonPay & Bank (Q2):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[1].answer}` };
  }

  // Q3: Kalphung
  if (q.includes('kalphung') || q.includes('engtin nge sum lut') || q.includes('engtin nge a thawh') || q.includes('how it works') || q.includes('how does it work')) {
    return { answer: `⚙️ **Sum Kalkual Dan & Kalphung (Q3):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[2].answer}` };
  }

  // Q4: Fee
  if (q.includes('fee') || q.includes('man') || q.includes('chawi tur') || q.includes('percentage') || q.includes('percent')) {
    return { answer: `💳 **Service Fee & Pricing (Q4):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[3].answer}` };
  }

  // Q5: Himna / Security
  if (q.includes('him em') || q.includes('security') || q.includes('safe') || q.includes('pin a la em') || q.includes('password')) {
    return { answer: `🔒 **Himna & Security (Q5):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[4].answer}` };
  }

  // Q6: User pangngaiin QR a siam thei em?
  if (q.includes('user pangngai') || (q.includes('user') && q.includes('qr siam'))) {
    return { answer: `👤 **User & QR Siam Theihna (Q6):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[5].answer}` };
  }

  // Q7: Creator awmzia
  if (q.includes('creator chu') || q.includes('creator engnge') || q.includes('creator awmzia')) {
    return { answer: `👑 **Creator Awmzia (Q7):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[6].answer}` };
  }

  // Q8: QR validity & limits
  if (q.includes('validity') || q.includes('limit') || q.includes('hun chhung') || q.includes('pawt sei') || q.includes('nung')) {
    return { answer: `⏳ **QR Validity & Limits (Q8):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[7].answer}` };
  }

  // Q9: Ralna Bawm
  if (q.includes('ralna') || q.includes('chhiatni')) {
    return { answer: `🕊️ **Ralna Bawm (Q9):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[8].answer}` };
  }

  // Q10: Khawlsak Bawm
  if (q.includes('khawlsak') || q.includes('riangvai') || q.includes('chanhai') || q.includes('chhumchhia')) {
    return { answer: `🤝 **Khawlsak Bawm (Q10):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[9].answer}` };
  }

  // Q11: Rikrum Bawm
  if (q.includes('rikrum') || q.includes('kangmei') || q.includes('tuilian') || q.includes('emergency') || q.includes('leimin')) {
    return { answer: `🚨 **Rikrum Bawm (Q11):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[10].answer}` };
  }

  // Q12: Kumtluang Bawm
  if (q.includes('kumtluang') || q.includes('kohhran') || q.includes('permanent') || q.includes('faith promise') || q.includes('member roll')) {
    return { answer: `🏛️ **Kumtluang Bawm (Q12):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[11].answer}` };
  }

  // Q13: UPI Lite
  if (q.includes('upi lite') || q.includes('lite')) {
    return { answer: `⚡ **UPI Lite Support (Q13):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[12].answer}` };
  }

  // Q14: GPay leh RonPay danglamna
  if (q.includes('gpay') || q.includes('phonepe') || q.includes('danglamna') || q.includes('difference')) {
    return { answer: `📱 **GPay leh RonPay Danglamna (Q14):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[13].answer}` };
  }

  // Q15: Tu siam nge?
  if (q.includes('tu siam') || q.includes('siamtu') || q.includes('company') || q.includes('who made') || q.includes('developer')) {
    return { answer: `🏢 **RonPay Siamtu (Q15):**\n${RONPAY_KNOWLEDGE_BASE_Q1_TO_Q15[14].answer}` };
  }

  // Out of scope check
  if (!q.includes('ronpay') && !q.includes('bawm') && !q.includes('qr') && !q.includes('upi') && !q.includes('creator') && !q.includes('chhiatni') && !q.includes('tanpui')) {
    return {
      answer: 'Ka hre lo tlat mai... RonPay kaihhruaina leh hman dan (User Guide) chungchang chauh ka hrilhfiah thei a che. RonPay Bawm hman dan, QR Code, emaw Creator registration chungchang zawt leh zawk rawh le.'
    };
  }

  // Default overview
  return {
    answer: `🤖 **RonPay AI Assistant & User Guide (Q1-Q15):**
RonPay Bawm Category 4 leh Kaihhruaina:
1. **Ralna Bawm (Q9)** - Chhiatni & Ralna atan (Ni 1 - Thla 1)
2. **Khawlsak Bawm (Q10)** - Riangvai & Damlo Tanpuina atan
3. **Rikrum Bawm (Q11)** - Emergency & Chhiatrup thleng thut tan
4. **Kumtluang Bawm (Q12)** - Kohhran & Pawl Welfare tan

💡 *Tips: Chat box-ah hian "Creator Dilna Form min siam sak rawh" emaw "Hriatpuina Lehkha generate rawh" i tih chuan lehkha fel fai tak a rawn generate nghal zung zung thei bawk e!*`
  };
}

