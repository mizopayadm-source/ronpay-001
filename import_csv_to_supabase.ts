import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvDate(str: string): string {
  if (!str) return new Date().toISOString();
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return new Date().toISOString();
  const [_, d, m, y, h, min, meridiem] = match;
  let hour = parseInt(h, 10);
  if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const isoStr = y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0') + 'T' + 
                 String(hour).padStart(2, '0') + ':' + min.padStart(2, '0') + ':00+05:30';
  return new Date(isoStr).toISOString();
}

const monthsMap: Record<string, string> = {
  'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
  'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
  'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
};

function extractPeriod(remark: string | undefined, isoDate: string) {
  if (!remark) {
    const d = new Date(isoDate);
    const m = d.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });
    const y = String(d.getFullYear());
    return { periodMonth: m, periodYear: y, periodLabel: m + ' ' + y };
  }
  
  const shortMatch = remark.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-(\d{2,4})/i);
  if (shortMatch) {
    const mKey = shortMatch[1].toLowerCase().slice(0, 3);
    const fullM = monthsMap[mKey] || shortMatch[1];
    let y = shortMatch[2];
    if (y.length === 2) y = '20' + y;
    return { periodMonth: fullM, periodYear: y, periodLabel: fullM + ' ' + y };
  }

  const fullMatch = remark.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})/i);
  if (fullMatch) {
    return { periodMonth: fullMatch[1], periodYear: fullMatch[2], periodLabel: fullMatch[1] + ' ' + fullMatch[2] };
  }

  const d = new Date(isoDate);
  const m = d.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });
  const y = String(d.getFullYear());
  return { periodMonth: m, periodYear: y, periodLabel: m + ' ' + y };
}

async function runImport() {
  console.log('=== Starting CSV Import to Supabase ===');
  const csvPath = 'public/assets/aistudio/RonPay1_2ee1644f.csv';
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const dbPath = 'data/ronpay_db.json';
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {};
  const campaigns: any[] = db.campaigns || [];
  const members: any[] = db.members || [];

  const campMap = new Map<string, any>();
  campaigns.forEach(c => {
    if (c.title) campMap.set(c.title.toLowerCase().trim(), c);
  });

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.slice(1).map(parseCsvLine);
  console.log(`Parsed ${rows.length} rows from CSV.`);

  const importedIds = new Set<string>();
  let totalSum = 0;

  const clientTxList: any[] = [];
  const supaRows: any[] = [];

  for (const r of rows) {
    let [id, rawDate, cat, campTitle, donor, recType, amtStr, mode, status, remark, ref] = r;
    if (!id) continue;
    if (donor === '?KP') donor = 'TKP';
    if (donor === 'Buhfai?ham') donor = 'Buhfaitham';

    const cleanId = String(id).trim();
    importedIds.add(cleanId.toLowerCase());
    const amt = parseFloat(amtStr) || 0;
    totalSum += amt;
    const isoTime = parseCsvDate(rawDate);
    const matchedCamp = campMap.get((campTitle || '').toLowerCase().trim());
    const campaignId = matchedCamp ? matchedCamp.id : 'cmp-default';
    const category = (cat || (matchedCamp ? matchedCamp.category : 'kumtluang')).toLowerCase();

    const donorType = recType === 'MIMAL' ? 'member' : (recType === 'GROUP' ? 'group' : 'general');
    const isAnonymous = (donor || '').toLowerCase() === 'anonymous';

    const period = extractPeriod(remark, isoTime);

    // Member match
    const matchedMem = members.find(m => 
      m.name && m.name.toLowerCase().trim() === (donor || '').toLowerCase().trim() && 
      (m.campaignId === campaignId || !matchedCamp)
    );

    const clientTx = {
      id: cleanId,
      campaignId,
      campaignTitle: matchedCamp ? matchedCamp.title : campTitle,
      category,
      donorName: donor || 'Valued Donor',
      memberId: matchedMem ? matchedMem.id : undefined,
      donorType,
      groupName: donorType === 'group' ? donor : undefined,
      isAnonymous,
      amount: amt,
      platformFee: 0,
      totalAmount: amt,
      paymentMethod: (mode || '').toLowerCase() === 'cash' ? 'cash' : 'upi',
      status: (status || 'completed').toLowerCase(),
      remark: remark || undefined,
      periodType: category === 'kumtluang' ? 'monthly' : 'one_time',
      periodMonth: period.periodMonth,
      periodYear: period.periodYear,
      periodLabel: period.periodLabel,
      referenceNo: ref || undefined,
      utr: ref || undefined,
      timestamp: isoTime,
      createdAt: isoTime,
      updatedAt: new Date().toISOString(),
      metadata: {
        source: 'csv_import',
        importedAt: new Date().toISOString()
      }
    };

    clientTxList.push(clientTx);

    supaRows.push({
      id: cleanId,
      campaign_id: campaignId,
      campaign_title: matchedCamp ? matchedCamp.title : campTitle,
      category,
      donor_name: donor || 'Valued Donor',
      donor_phone: null,
      donor_veng: null,
      member_id: matchedMem ? matchedMem.id : null,
      sub_id: null,
      donor_type: donorType,
      group_name: donorType === 'group' ? donor : null,
      is_anonymous: isAnonymous,
      amount: amt,
      platform_fee: 0,
      total_amount: amt,
      payment_method: (mode || '').toLowerCase() === 'cash' ? 'cash' : 'upi',
      status: (status || 'completed').toLowerCase(),
      remark: remark || null,
      period_type: category === 'kumtluang' ? 'monthly' : 'one_time',
      period_month: period.periodMonth,
      period_year: period.periodYear,
      period_label: period.periodLabel,
      utr: ref || null,
      reference_no: ref || null,
      timestamp: isoTime,
      created_at: isoTime,
      updated_at: new Date().toISOString(),
      metadata: {
        source: 'csv_import',
        importedAt: new Date().toISOString()
      }
    });
  }

  console.log(`Prepared ${supaRows.length} Supabase rows. Total amount: ₹${totalSum}`);

  // 1. Remove imported IDs from tombstone deleted lists in db
  if (Array.isArray(db.deletedTransactionIds)) {
    db.deletedTransactionIds = db.deletedTransactionIds.filter(
      (delId: string) => !importedIds.has(String(delId).toLowerCase().trim())
    );
  }

  // Merge into local db
  const existingMap = new Map<string, any>();
  (db.transactions || []).forEach((t: any) => {
    if (t && t.id) existingMap.set(String(t.id).toLowerCase().trim(), t);
  });
  clientTxList.forEach(t => {
    existingMap.set(String(t.id).toLowerCase().trim(), t);
  });
  db.transactions = Array.from(existingMap.values());
  db.lastUpdated = new Date().toISOString();

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  if (fs.existsSync('public/ronpay_db.json')) {
    fs.writeFileSync('public/ronpay_db.json', JSON.stringify(db, null, 2), 'utf8');
  }
  console.log(`Saved ${db.transactions.length} transactions to ${dbPath}`);

  // 2. Push to Supabase PostgREST
  const sbUrl = process.env.VITE_SUPABASE_URL || 'https://aqrplcmpealgruduwnhw.supabase.co';
  const sbKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__zS5fiKvBI5u6HYgour64g_g_tJj5WL';

  console.log(`Connecting to Supabase at ${sbUrl}...`);
  let insertedCount = 0;
  const chunkSize = 35; // Safe batch size
  for (let i = 0; i < supaRows.length; i += chunkSize) {
    const chunk = supaRows.slice(i, i + chunkSize);
    console.log(`Upserting chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} items)...`);
    const resp = await fetch(`${sbUrl}/rest/v1/transactions?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(chunk)
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`Chunk ${Math.floor(i / chunkSize) + 1} failed:`, resp.status, errBody);
      // Try single row fallback for this chunk
      for (const singleRow of chunk) {
        const sResp = await fetch(`${sbUrl}/rest/v1/transactions?on_conflict=id`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(singleRow)
        });
        if (sResp.ok) {
          insertedCount++;
        } else {
          console.error(`Row ${singleRow.id} failed:`, await sResp.text());
        }
      }
    } else {
      insertedCount += chunk.length;
      console.log(`Chunk ${Math.floor(i / chunkSize) + 1} succeeded!`);
    }
  }

  console.log(`Successfully uploaded ${insertedCount}/${supaRows.length} transactions to Supabase!`);

  // 3. Update fund_pools in Supabase
  try {
    const poolRes = await fetch(`${sbUrl}/rest/v1/fund_pools?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify([{
        id: 'public_pool',
        name: 'RonPay Public Fund Pool',
        total_amount: Math.round(totalSum * 100) / 100,
        total_count: insertedCount,
        last_updated: new Date().toISOString()
      }])
    });
    console.log('Fund pool update status:', poolRes.status, poolRes.statusText);
  } catch (pe: any) {
    console.warn('Fund pool update error:', pe?.message);
  }

  // 4. Verify transaction count in Supabase
  try {
    const verifyRes = await fetch(`${sbUrl}/rest/v1/transactions?select=id,amount`, {
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`
      }
    });
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      const actualCount = verifyData.length;
      const actualSum = verifyData.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);
      console.log('=== Supabase Verification Success ===');
      console.log(`Verified transactions in Supabase: ${actualCount}`);
      console.log(`Verified total amount in Supabase: ₹${actualSum}`);
    } else {
      console.error('Verification query failed:', await verifyRes.text());
    }
  } catch (ve: any) {
    console.error('Verification fetch error:', ve?.message);
  }

  console.log('=== CSV Import Completed ===');
}

runImport().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
