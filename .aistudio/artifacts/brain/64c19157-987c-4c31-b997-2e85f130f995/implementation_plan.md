# RONPAY Organization Security, Deep Link Auto-Routing & Auditor Isolation Plan

Ruahmanna hian Guest, Member, leh Auditor-te tana data security leh privacy vawn him dan tur a duang a. Guest leh Member-te hnenah bawm dang data leh administrative financial control a liam chhuah loh nan, Org QR/Link aṭanga lut-te tan dedicated portal isolated taka hawn dan leh Auditor-te an audit tur bawm bika restrict dan a ruahman a ni.

### User Review & Critical Decisions

> [!IMPORTANT]
> A hnuaia thutlukna (decisions) 4-te hi Phase 1 zawhna chhanna leh i rawtna mil liau liaua duan a ni:

- **Confirmed Decision 1 (Guest & Member Security & Role-Based Protection)**:
  - **Organization Home Screen** visual layout (4 Stats Cards, Target Donut Chart, Monthly Bar Chart, leh Recent Transactions Table) hi vawn him a ni ang.
  - Amaherawhchu, **Data Isolation & Security** khauh tak kenkawh a ni ang:
    - Guest leh Member-te tan an awmna bawm bik chauh a lang ang a, pawl dang leh bawm dang transaction emaw report a in-mix/leak reng reng lovang.
    - Sensitive Admin Controls (`+ Add Member / Bial Target`, `Bawm Thar / Config`, `Hmanral / Expenses desk`, `Full Ledger & Excel Download`, `SECY Handover`) chu Creator / Admin / Authorized Officer lo tan thuhruk emaw **Smart Login / PIN Prompt** hian a veng ang.
    - Guest leh Member tan direct **"Pekna / Thawh Rawh (Contribute)"** leh **"Quick Entry (Digit 4 / Passbook)"** button lian leh awlsam dah a ni ang.
- **Confirmed Decision 2 (Org QR & Deep Link Auto-Routing)**:
  - Miin Organization bik QR code an scan emaw link (`?c=...` / `?org=...` / `?bawm=...`) an hawn rualin, Ralna/Khawlsak/Rikrum leh mimal home screen kal kual lovin **chu Organization Bawm Portal chiah chu auto-routing hmangin a inhawng tlang nghal ang**.
  - Chu bawm chhungah chuan mimal thil (Ralna/Khawlsak/Bill) duh ve thote tan **"🌐 Normal / Full Mode"** button awlsam taka luh theihna dah tel a ni ang.
- **Confirmed Decision 3 (Strict Auditor Scope Isolation)**:
  - Auditor account emaw phone number-a lut reng reng chuan **anmahni audit tura ruat (granted access) Bawm chauh** an hmu ang.
  - Multi-bawm dropdown-ah pawh an grant neih lohna bawm dang reng reng a lang ve lovang; Super Admin emaw an nih chauh loh chuan an audit tur bikah an in-lock tlat ang a, Full Version en kual duh tan toggle switch dah a ni ang.
- **Confirmed Decision 4 (Registration & Profile Org-Only Persistence)**:
  - Creator Registration emaw Settings-a `Organization-Only` thlangtute chu an browser session leh profile-ah nghet taka chhinchhiah a ni ang a, app an hawn apiangin an Org Portal chauh a inhawng nghal zel ang.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Tiered Security Architecture**:
     - *Public / Member Layer*: Org Basic Info (Logo, Title, Location, Notice), Public Collection Progress, Direct Contribution / UPI QR, leh Digit 4 Passbook Quick Entry.
     - *Administrative Layer*: Expense ledger, voucher approval, member editing, Bawm configuration, leh Full excel export te chu Authenticated Creator/Treasurer/Officer tan chauh hawn a ni ang.
  2. **Org QR / Direct Link Smart Router**:
     - URL parameter (`?c=cmp-kumtluang-1` or `?org=EBEZBK` or `?bawm=...`) a awm chuan system-in auto-detect nghalin, chu bawm chu Active Bawm-ah a dah ang a, Org-Only mode-ah a lut tlang nghal ang.
  3. **Auditor Grant Lockdown**:
     - Auditor Portal-ah active auditor grants check hmasak a ni ang a, an grant neihna campaign ID chauh dropdown leh reports-ah a lang ang.

- **Target Audience / Persona**:
  - **Kohhran / Pawl Member & Contributor**: An biak in / pawl link emaw QR scan aṭanga lut a, sum thawh zung zung leh anmahni passbook enfiah duhtute.
  - **Creator / Finance Treasurer / Central Accountant**: An pawl financial record, target progress, leh expense desk enkawltu hotute.
  - **Designated Auditor**: Hun tiam chhung atana pawl sum endik tura ruat, pawl dang record hmuh ve remchang lote.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Guest / Public Contributor Flow (Direct Org QR)**:
     - Biak in / Pawl QR code a scan veleh **Organization Portal** ah a lut tlang nghal.
     - Screen chungah Biak in / Pawl Hming, Logo, leh Address a hmu ang.
     - A hnuai chiahah **`⚡ Thawh Rawh / Pekna (Contribute)`** button lian tak a hmu ang a, hmeh rualin direct UPI payment / checkout a inhawng nghal ang.
     - Pawl dang data emaw private voucher details a hmu lovang.
  2. **Creator / Treasurer Management Flow**:
     - Treasurer a login veleh Management Controls (`+ Add Target`, `Hmanral`, `Config`, `Excel`) a rawn inhawng nghal ang.
     - Unrelated Bawms (Ralna, Rikrum, etc.) hmuh a ngai lovang.
  3. **Auditor Locked View Flow**:
     - Auditor-in a phone number hmangin login a tih veleh, SMS/PIN verify hnuah a audit tur Bawm (entirnan: `BCM Ebenezer`) chauh a inhawng ang.
     - Multi-campaign switcher-ah pawh bawm dang a lang lovang.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Institutional Financial Trust & Clean Mobile Ergonomics.
  - *Color Palette & Tokens*: Slate canvas (`bg-slate-50`), pristine white cards (`bg-white border-slate-200`), institutional deep indigo (`indigo-600`), emerald green for verified contributions (`#16A34A`), and amber (`#D97706`) for auditor notices.
  - *Tabular Typography*: `font-mono tabular-nums` for all amounts (`₹`), percentages, and voucher references to ensure perfect vertical alignment on mobile and desktop.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero Data Leakage Across Organizations**
  - *Chosen Approach*: `HomeScreen` Org Dashboard stats calculation-ah active campaign ID strictly enforce a ni ang a, general or mixed fallback transaction record reng reng an pawl ID a nih loh chuan a lang lovang.
  - *Why*: Organization hrang hrang ten anmahni sum dinhmun chauh an hmuh a, mi dang record an hmuh ve loh nan a pawimawh em em a ni.
- **Decision 2: Seamless Deep Link Entry with Full Mode Escape Hatch**
  - *Chosen Approach*: URL parameter a awm chuan default-in Org-Only Mode-ah a lut ang a, mahse top bar-ah **"🌐 Mimal + Pawl Mode"** button a awm reng ang.
  - *Why*: Mimal thil (Ralna/Khawlsak) hmang duh tan kawng a inhawng reng a, pawl thil chauh ti duh tan erawh thil hnawk a bo hmak thung.
- **Decision 3: Grant-Scoped Auditor Access**
  - *Chosen Approach*: `AuditorPortalModal` chhungah `accessibleCampaigns` filter chu active grants chauhvin a thliar hrang ang.
  - *Why*: Auditor chu a audit tur pawlah chauh a lut thei a, security leh privacy a vawng him ber.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Access Control Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    INCOMING ENTRY / URL ROUTER                            │
│           (?c=cmp-kumtluang-1 / ?org=EBEZBK / QR Scan / Login)            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
┌─────────────────────────────────────┐ ┌───────────────────────────────────┐
│   PUBLIC / GUEST / MEMBER ACCESS    │ │     AUTHENTICATED STAFF / CREATOR │
│  • Direct Org Portal (Scoped ID)    │ │  • Full Financial KPIs & Targets  │
│  • Org Header, Logo, Notice         │ │  • + Add Member / Kohhran Target  │
│  • Goal Progress & Category Share   │ │  • Hmanral Desk & Expense Records │
│  • ⚡ Contribute / Thawh Rawh       │ │  • Dynamic Bawm Category Config   │
│  • 4-Digit Passbook Lookup          │ │  • Full Ledger & Excel Export     │
│  • 🌐 Switch to Normal RonPay       │ │  • SECY Officer Handover          │
└─────────────────────────────────────┘ └───────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        AUDITOR PORTAL ISOLATION                           │
│  • Matches user phone against active grants (getActiveAuditorGrants)     │
│  • Accessible campaigns locked to authorized Campaign ID only             │
│  • Cash Book, Ledger, Audit Lock, and Certificate generation              │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Core Module Updates**:
  1. **`src/utils/urlRouting.ts` & `src/App.tsx`**:
     - Handle `?c=...`, `?org=...`, `?bawm=...` parameters on startup to auto-set `selectedCampaign`, set `workspaceMode` to `org_only`, and route directly to the Organization Home screen.
  2. **`src/components/HomeScreen.tsx`**:
     - Enforce strict campaign transaction isolation (prevent any other campaign's transactions from rendering in stats or ledger).
     - Guard sensitive administrative buttons (`+ Add Member/Target`, `Hmanral/Expense Desk`, `Bawm Config`, `Excel Export`) so non-authenticated users get a friendly login/auth prompt or clean view.
     - Add prominent **"⚡ Thawh Rawh / Pekna (Contribute)"** primary action on the Org Home Screen for rapid UPI / Checkout entry.
  3. **`src/components/AuditorPortalModal.tsx`**:
     - Strict filtering of `accessibleCampaigns`: if the user is not a Super Admin, lock the campaign selector to only the campaign(s) present in `getActiveAuditorGrantsForUser`.
