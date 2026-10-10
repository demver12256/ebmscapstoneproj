const express = require('express');
const { BenefitProgram, DistributionEvent, Announcement, Barangay } = require('../db');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * COMPREHENSIVE EBMS / BENIAID KNOWLEDGE BASE
 * Trained specifically on all workflows, features, policies, and requirements of the system.
 */
const SYSTEM_KNOWLEDGE_BASE = [
  // 1. SYSTEM OVERVIEW & WHAT IS EBMS
  {
    id: 'system_overview',
    keywords: [
      'ano ang ebms', 'ano ang beniaid', 'ebms', 'beniaid', 'tungkol sa system', 'about ebms', 
      'about beniaid', 'system', 'ano ito', 'ano ang app', 'para saan'
    ],
    title: 'Tungkol sa EBMS (BeniAid)',
    reply: `🌐 **Ano ang EBMS (BeniAid)?**\n\nAng **EBMS** (Emergency Beneficiary Management System), na kilala rin bilang **BeniAid**, ay ang opisyal na digital platform para sa pamamahala ng mga ayuda at serbisyong panlipunan ng Pamahalaan/DSWD/MSWDO.\n\n✨ **Pangunahing Gamit ng System:**\n• **Digital Beneficiary Profiling:** Pagpaparehistro at pag-iingat ng talaan ng mga benepisyaryo.\n• **Contactless RFID & QR Scanner:** Mabilis at tumpak na pag-verify ng pagkakakilanlan tuwing may distribution o attendance.\n• **Online Assistance Applications:** Pag-apply para sa Medical, Burial, Educational, at Emergency Aid gamit ang web o cellphone.\n• **Digital at Cash Payout Tracking:** Pamamahagi ng ayuda via GCash, Maya, Landbank, o cash over-the-counter.\n• **PhilSMS Automated Alerts:** Awtomatikong SMS text updates tungkol sa distribution schedules at application status.`,
    suggested: [
      'Paano magparehistro bilang beneficiary?',
      'Saan makikita ang aking QR Code?',
      'Ano-ano ang mga ayuda programs?'
    ]
  },

  // 2. BENEFICIARY REGISTRATION & SIGN UP
  {
    id: 'registration_process',
    keywords: [
      'register', 'magrehistro', 'paano magparehistro', 'sign up', 'gumawa ng account', 
      'create account', 'paano sumali', 'magpalista', 'rehistro', 'mag sign up'
    ],
    title: 'Paano Magparehistro',
    reply: `📋 **Paano Magparehistro sa EBMS (BeniAid)?**\n\n1. Pumunta sa **Landing Page** o buksan ang **BeniAid Mobile App**.\n2. I-click ang **"Magparehistro"** o **"Create Account"**.\n3. Punan ang mga impormasyon:\n   • **Pangalan at Kapanganakan** (First Name, Last Name, Birthdate, Kasarian)\n   • **Tirahan:** Barangay, Purok/Sitio, at Address\n   • **Kategorya:** PWD, Senior Citizen, Solo Parent, Indigent, 4Ps, Youth, Farmer, o Fisherfolk\n   • **IP Classification:** Katutubo (IP) o Non-IP\n   • **Aktibong Cellphone Number** (para makatanggap ng SMS alerts)\n   • **Username at Password**\n4. I-upload ang malinaw na kopya ng iyong **Valid Government ID** at **Barangay Indigency**.\n5. I-submit. Magiging **"Pending"** muna ang status habang sinusuri ng MSWDO staff.`,
    suggested: [
      'Gaano katagal bago ma-approve ang rehistro?',
      'Ano ang requirements para sa rehistro?',
      'Ano ang gagawin kapag na-approve na?'
    ]
  },

  // 3. REGISTRATION STATUS (PENDING, APPROVED, REJECTED)
  {
    id: 'account_status',
    keywords: [
      'status ng account', 'pending', 'approved', 'na approve', 'official member', 
      'kailan ma approve', 'rejected', 'tinanggihan', 'bakit pending', 'ano ibig sabihin ng pending'
    ],
    title: 'Mga Status ng Beneficiary Profile',
    reply: `🔍 **Paliwanag sa Katayuan (Status) ng Iyong Rehistro:**\n\n• 🟡 **Pending:** Kasalukuyang sinusuri ng MSWDO / LGU Social Worker ang iyong mga isinumiteng dokumento at impormasyon.\n• 🟢 **Approved (Official Member):** Rehistrado ka na! Bibigyan ka ng opisyal na **Beneficiary ID (hal. BEN-2026-XXXX)** at magagamit mo na ang iyong **Digital QR Code** para sa mga ayuda.\n• 🔴 **Rejected:** Mayroong kulang, malabo, o hindi tugmang dokumento. Maaari mong tingnan ang tala ng dahilan at mag-reapply o mag-upload ng tamang dokumento.\n\n*Tip: Karaniwang 1 hanggang 3 araw ng trabaho ang pag-verify depende sa dami ng nagpaparehistro.*`,
    suggested: [
      'Saan makikita ang QR code kapag approved na?',
      'Paano mag-apply ng assistance?',
      'Hotline ng MSWDO para sa follow-up'
    ]
  },

  // 4. BENEFICIARY QR CODE
  {
    id: 'qr_code_details',
    keywords: [
      'qr', 'qr code', 'barcode', 'saan makikita ang qr', 'my qr', 'view qr', 'download qr', 
      'saan ang qr', 'digital id', 'code ko', 'nawala ang qr', 'personal qr'
    ],
    title: 'Saan Makikita at Paano Gamitin ang QR Code',
    reply: `📱 **Ang Iyong Personal Beneficiary QR Code:**\n\nAng bawat aprubadong benepisyaryo ay may natatanging QR Code na nagsisilbing iyong digital pass.\n\n📍 **Saan ito makikita?**\n1. Mag-login sa iyong account sa **Web Portal** o **Mobile App**.\n2. Pumunta sa **"My Profile"** o **"My Benefits / Digital ID"**.\n3. Agad na ipapakita ang iyong personal QR Code kasama ang iyong buong pangalan at Beneficiary Number.\n\n💡 **Paano ito gamitin?**\n• Maaari mo itong i-screenshot o i-download sa iyong gallery.\n• Sa araw ng pamamahagi (distribution), itapat lamang ang QR code sa scanner ng staff para maitala ang iyong attendance at matanggap ang ayuda.\n\n⚠️ *Paalala: Huwag ibahagi ang iyong QR code sa iba upang maprotektahan ang iyong ayuda.*`,
    suggested: [
      'Ano ang gamit ng RFID card?',
      'Paano kung walang cellphone sa distribution venue?',
      'Kailan ang susunod na ayuda distribution?'
    ]
  },

  // 5. RFID CARD & CONTACTLESS SCANNING
  {
    id: 'rfid_details',
    keywords: [
      'rfid', 'rfid card', 'tap', 'card', 'id card', 'nfc', 'smart card', 'tap card', 'nawala ang rfid'
    ],
    title: 'Tungkol sa RFID Card',
    reply: `💳 **Tungkol sa Beneficiary RFID Card:**\n\n- Ang **RFID Card** ay pisikal na card na ibinibigay ng MSWDO na may built-in contactless chip.\n- **Paano ginagamit?** Itinatap lamang ito sa RFID reader scanner ng staff sa venue. Sa loob ng 1 segundo, lalabas ang iyong pangalan at mamamarkahan kang **Present / Claimed**.\n- **Wala pang RFID Card?** Walang problema! Ang iyong **Digital QR Code** sa cellphone ay may parehong bisa at tinatanggap din sa scanner.\n- **Nawala ang RFID Card?** Ipagbigay-alam sa iyong Barangay Hall o MSWDO Desk upang mabura ang lumang card at maitala ang bago.`,
    suggested: [
      'Saan makikita ang aking QR code?',
      'Paano mag-scan ang staff gamit ang camera?',
      'Saan makikita ang attendance record ko?'
    ]
  },

  // 6. MEDICAL ASSISTANCE (AICS)
  {
    id: 'medical_assistance',
    keywords: [
      'medical', 'gamot', 'hospital', 'pagpapagamot', 'laboratory', 'dialysis', 'chemo', 
      'gamot sa ospital', 'operasyon', 'reseta', 'medical assistance', 'tulong medikal'
    ],
    title: 'Medical Assistance Guidelines & Requirements',
    reply: `🏥 **Medical Assistance (AICS / BeniAid):**\n\nTulong pinansyal para sa pambili ng mga mamahaling gamot, pambayad sa laboratory/diagnostic tests, hemodialysis, chemotherapy, at bill sa ospital.\n\n📋 **Kumpletong Listahan ng Requirements:**\n1. **Barangay Certificate of Indigency** ng pasyente o ng claimant.\n2. **Medical Certificate o Clinical Abstract:**\n   • Nilagdaan ng doktor na may PRC License Number.\n   • Inisyu sa loob ng huling tatlong (3) buwan.\n3. **Hospital Statement of Account / Billing Statement** (kung naka-confine) O **Reseta (Prescription)** na may opisyal na quotation mula sa botika/parmasya.\n4. **Isang (1) Valid Government ID** ng pasyente at ng maglalakad.\n5. **Katunayan ng Relasyon (Proof of Relationship)** kung kinatawan ang maglalakad (hal. Marriage Certificate o Birth Certificate).\n\n📲 *Maaaring magsumite online via:* **Request Assistance > Medical Assistance**.`,
    suggested: [
      'Gaano katagal bago ma-release ang medical aid?',
      'Ano ang requirements sa burial assistance?',
      'Paano mag-upload ng reseta at medical abstract?'
    ]
  },

  // 7. BURIAL ASSISTANCE (AICS)
  {
    id: 'burial_assistance',
    keywords: [
      'burial', 'libing', 'patay', 'burol', 'kabaong', 'funeral', 'pagpapalibing', 
      'cremation', 'punerarya', 'burial assistance', 'tulong sa libing'
    ],
    title: 'Burial / Funeral Assistance Guidelines',
    reply: `⚰️ **Burial at Funeral Assistance:**\n\nTulong pinansyal para sa gastusin sa burol, kabaong, at pagpapalibing sa yumaong mahal sa buhay.\n\n📋 **Mga Dokumentong Kailangang Ihanda:**\n1. **Certified True Copy ng Death Certificate** (nakarehistro sa Local Civil Registrar o PSA).\n2. **Funeral Contract o Kasunduan sa Punerarya** (nakasaad ang kabuuang halaga at natitirang balanse).\n3. **Barangay Certificate of Indigency** ng naglalakad/claimant.\n4. **Valid Government ID** ng naglalakad na kapamilya.\n5. **Proof of Relationship sa Yumao:**\n   • Marriage Contract (kung asawa)\n   • Birth Certificate (kung anak o magulang).\n\n📲 *I-submit ang aplikasyon sa ilalim ng menu na* **"Request Assistance"**.`,
    suggested: [
      'Paano mag-apply ng assistance online?',
      'Ano ang requirements sa medical assistance?',
      'Saan makikita ang status ng burial application?'
    ]
  },

  // 8. EDUCATIONAL ASSISTANCE (AICS)
  {
    id: 'educational_assistance',
    keywords: [
      'educational', 'school', 'tuition', 'estudyante', 'baon', 'gamit sa eskwela', 
      'scholarship', 'student', 'eskwelahan', 'kolehiyo', 'high school', 'educational assistance'
    ],
    title: 'Educational Assistance Guidelines',
    reply: `🎓 **Educational Assistance:**\n\nTulong pinansyal para sa mga kapos-palad na mag-aaral para sa school supplies, transportasyon, uniporme, at tuition fees.\n\n📋 **Mga Kinakailangang Dokumento:**\n1. **Certificate of Enrollment o Registration Form** para sa kasalukuyang semester/school year.\n2. **Valid School ID** ng estudyante.\n3. **Barangay Certificate of Indigency** ng magulang o guardian.\n4. **Valid ID** ng magulang/guardian na maglalakad.\n5. **Statement of Account / Assessment Form** (kung may binabayarang matrikula sa kolehiyo/paaralan).`,
    suggested: [
      'Paano mag-apply ng educational assistance?',
      'Sino ang kwalipikado sa educational aid?',
      'Kailan ang schedule ng educational payout?'
    ]
  },

  // 9. TRANSPORTATION & EMERGENCY RELIEF ASSISTANCE
  {
    id: 'emergency_assistance',
    keywords: [
      'transportation', 'pamasahe', 'stranded', 'uwi ng probinsya', 'emergency aid', 
      'calamity', 'bagyo', 'baha', 'sunog', 'relief goods', 'food pack', 'sakuna'
    ],
    title: 'Transportation at Emergency Calamity Assistance',
    reply: `🚨 **Transportation & Calamity Emergency Relief:**\n\n• **Transportation Assistance:** Para sa mga na-stranded o walang pamasahe pabalik sa sariling probinsya.\n  *Requirements:* Police Blotter o Barangay Certification ukol sa pagka-stranded, Valid ID, at katunayan ng tirahan sa pupuntahan.\n\n• **Emergency Calamity Relief (Sunog, Bagyo, Baha):**\n  *Requirements:* Barangay Certificate of Disaster Victim / Fire Incident Report mula sa BFP, Valid ID.\n  *Porma ng Tulong:* Food packs, emergency kits, at emergency financial cash assistance sa tulong ng LGU/MSWDO.`,
    suggested: [
      'Hotline ng emergency at kalamidad',
      'Paano makatanggap ng relief goods?',
      'Paano mag-apply ng medical assistance?'
    ]
  },

  // 10. HOW TO APPLY ONLINE IN EBMS
  {
    id: 'how_to_apply',
    keywords: [
      'apply', 'mag apply', 'mag-apply', 'paano mag apply', 'paano magsumite', 
      'application', 'submit application', 'mag pasa ng requirements', 'saan mag aapply'
    ],
    title: 'Hakbang sa Pag-apply ng Assistance Online',
    reply: `📝 **Step-by-Step Gabay sa Pag-apply ng Assistance:**\n\n1. **Mag-log in:** Mag-sign in sa EBMS gamit ang iyong account (o Google Sign-In).\n2. **Pumunta sa Assistance Menu:** I-click ang **"Assistance"** o **"Request Assistance"** sa navigation bar.\n3. **Pumili ng Kategorya:** Halimbawa: *Medical Assistance*, *Burial Assistance*, o *Educational Assistance*.\n4. **Ibigay ang Detalye:** Ilagay ang kinakailangang halaga, dahilan, at deskripsyon ng sitwasyon.\n5. **I-attach ang Dokumento:** Mag-upload ng malinaw na litrato o PDF ng iyong requirements (ID, Indigency, Medical Abstract, atbp.).\n6. **Pindutin ang "Submit":** Agad itong marerehistro sa system para sa rebyu ng social worker.\n7. **Subaybayan:** Tingnan ang status sa ilalim ng **"My Applications"**.`,
    suggested: [
      'Saan makikita ang status ng application ko?',
      'Ano ang requirements sa Medical Assistance?',
      'Paano kung na-reject ang application ko?'
    ]
  },

  // 11. PAYOUT METHODS & PREFERENCES
  {
    id: 'payout_methods',
    keywords: [
      'payout', 'pera', 'gcash', 'maya', 'landbank', 'cash', 'kuha ng ayuda', 'saan kukunin ang pera', 
      'account number', 'paano makukuha ang pera', 'disbursement', 'claimed'
    ],
    title: 'Mga Paraan ng Pagtanggap ng Payout (Disbursement)',
    reply: `💰 **Mga Paraan ng Payout sa EBMS:**\n\n1. **Digital Payout (GCash / Maya / Landbank):**\n   • Direktang papasok ang ayuda sa iyong digital wallet o bank account.\n   • **Paano i-setup?** Pumunta sa iyong **Profile** > **Payout Settings** > Ilagay ang provider (GCash/Maya/Landbank), ang iyong cellphone/account number, at ang nakarehistrong pangalan.\n\n2. **Cash Over-the-Counter (On-Site Distribution):**\n   • Ibibigay nang personal sa nakatalagang barangay distribution center sa itinakdang petsa.\n   • **Kailangang Dalhin:** Iyong **QR Code o RFID Card** at isang **Valid Government ID**.`,
    suggested: [
      'Paano i-update ang GCash number ko?',
      'Kailan ang schedule ng susunod na payout?',
      'Paano kung wala akong GCash o bangko?'
    ]
  },

  // 12. ATTENDANCE & CLAIM RECORD
  {
    id: 'attendance_history',
    keywords: [
      'attendance', 'record', 'kasaysayan', 'history', 'naka attendance ba ako', 
      'paano malalaman kung present', 'naka claim na ba', 'claim record', 'logs'
    ],
    title: 'Pagsusuri ng Attendance at Claim Records',
    reply: `📊 **Pagsusuri ng Iyong Attendance at Payout Claims:**\n\n- Pumunta sa menu na **"Attendance"** o **"My Attendance"** sa iyong account.\n- Makikita mo rito ang kumpletong talaan:\n  • Pangalan ng Distribution Event o Programa\n  • Petsa at Oras kung kailan na-scan ang iyong QR / RFID\n  • Lokasyon at Tagapangasiwang Staff\n  • Katayuan: **Present / Claimed**\n\n*Awtomatikong naitatala ang bawat pag-scan kaya walang mawawalang rekord ng iyong natanggap na tulong.*`,
    suggested: [
      'Saan makikita ang QR code ko?',
      'Kailan ang susunod na event ng distribution?',
      'Ano ang gagawin kapag hindi na-scan ang card?'
    ]
  },

  // 13. ANNOUNCEMENTS & SMS NOTIFICATIONS
  {
    id: 'announcements_and_sms',
    keywords: [
      'announcement', 'anunsyo', 'balita', 'sms', 'text', 'philsms', 
      'abiso', 'magtetext ba', 'notification', 'alert', 'mensahe mula sa dswd'
    ],
    title: 'Announcements at SMS Notifications via PhilSMS',
    reply: `📢 **Mga Anunsyo at PhilSMS Text Alerts:**\n\n- **In-App Announcements:** Pumunta sa **"Announcements"** tab sa app o portal upang mabasa ang mga opisyal na paalala at iskedyul.\n- **PhilSMS Automated Text:** Kapag may bagong programa o distribution sa iyong barangay, awtomatikong magpapadala ang EBMS ng SMS notification sa numero ng cellphone na inirehistro mo.\n- **Update ng Phone Number:** Kung nagpalit ka ng cellphone number, i-update agad ito sa iyong **Profile** upang hindi maantala ang iyong mga text alerts.`,
    suggested: [
      'Paano i-update ang cellphone number ko?',
      'Kailan ang susunod na ayuda schedule?',
      'Saan makikita ang QR code ko?'
    ]
  },

  // 14. MESSAGING WITH SOCIAL WORKERS (STAFF)
  {
    id: 'messages_chat',
    keywords: [
      'chat', 'messages', 'kausap', 'social worker', 'magtanong sa staff', 
      'admin chat', 'direct message', 'magmessage', 'makipag-ugnayan'
    ],
    title: 'Direct Messaging sa MSWDO Staff',
    reply: `💬 **Pakikipag-ugnayan sa MSWDO Social Workers:**\n\nBukod sa akin bilang AI Assistant, maaari kang makipag-chat nang direkta sa mga kawani ng MSWDO:\n1. Pumunta sa menu na **"Messages"** sa web portal o mobile app.\n2. Makikita mo ang listahan ng mga opisyal na staff at social workers.\n3. Magpadala ng mensahe ukol sa iyong mga katanungan o paglilinaw sa iyong application.\n4. Makakatanggap ka ng in-app reply at abiso kapag sumagot ang staff.`,
    suggested: [
      'Ano ang hotline ng DSWD?',
      'Paano mag-follow up ng application?',
      'Saan ang opisina ng MSWDO?'
    ]
  },

  // 15. CAMERA & RFID SCANNER (STAFF / ADMIN FEATURE)
  {
    id: 'scanner_feature',
    keywords: [
      'scanner', 'camera scanner', 'paano mag scan', 'rfid scanner', 
      'qr scanner', 'mag-scan ng qr', 'attendance scanner', 'staff scanner'
    ],
    title: 'Camera at RFID Scanner ng Staff',
    reply: `📷 **Gabay sa RFID & Camera QR Scanner (Para sa Staff):**\n\nAng mga Staff at Barangay Encoders ay maaaring mag-scan sa dalawang paraan:\n\n1. **USB RFID Reader:** Isaksak ang RFID reader sa laptop. Pindutin ang reader mode at itapat ang RFID card ng beneficiary.\n2. **Camera QR Code Scanner:**\n   • Pumunta sa **RFID & QR Attendance** page.\n   • I-click ang **"Switch to Camera Scanner"** o buksan sa secure HTTPS.\n   • I-allow ang camera permission ng browser.\n   • Itapat ang camera sa QR code sa cellphone o ID ng beneficiary para sa awtomatikong pag-detect at pag-verify.`,
    suggested: [
      'Saan makikita ng beneficiary ang QR code?',
      'Ano ang gagawin kapag hindi mabasa ang card?',
      'Paano mag-record ng distribution attendance?'
    ]
  },

  // 16. FORGOT PASSWORD & GOOGLE SIGN-IN
  {
    id: 'account_security',
    keywords: [
      'password', 'nakalimutan ang password', 'forgot password', 'reset password', 
      'palitan ang password', 'google sign in', 'login error', 'hindi makapasok'
    ],
    title: 'Pag-reset ng Password at Google Sign-In',
    reply: `🔐 **Seguridad ng Account at Pag-reset ng Password:**\n\n• **Nakalimutan ang Password?**\n  1. Sa Login page, i-click ang **"Nakalimutan ang Password?"**.\n  2. Piliin kung saan gustong ipadala ang One-Time PIN (OTP): sa iyong **Email** o via **SMS Text** sa iyong cellphone.\n  3. I-type ang 6-digit verification code at maglagay ng bagong password.\n\n• **Google Sign-In:**\n  Maaari mong gamitin ang button na **"Sign in with Google"** para sa mabilis at ligtas na 1-click access gamit ang iyong Gmail account.`,
    suggested: [
      'Paano mag-login gamit ang Google?',
      'Hindi dumarating ang OTP code sa cellphone',
      'Paano i-update ang profile information?'
    ]
  },

  // 17. EMERGENCY HOTLINES & OFFICIAL CONTACTS
  {
    id: 'hotlines_contacts',
    keywords: [
      'hotline', 'contact', 'telepono', 'tawag', 'tulong', 'dswd hotline', 
      'emergency number', 'opisina', 'lgu contact', 'mswdo phone'
    ],
    title: 'Mga Opisyal na Emergency Hotlines',
    reply: `📞 **Opisyal na Emergency & Assistance Hotlines:**\n\n• **DSWD Crisis Intervention Hotline:** \`16545\` (Libreng tawag nationwide)\n• **DSWD Central Action Desk:** \`8931-8101 to 07\`\n• **National Emergency Hotline (Pulis, Bumbero, Rescue):** \`911\`\n• **Philippine Red Cross:** \`143\`\n• **National Center for Mental Health (NCMH):** \`1553\`\n• **LGU MSWDO Desk:** Makipag-ugnayan sa Tanggapan ng Social Welfare sa Munisipyo o sa iyong Barangay Hall Lunes hanggang Biyernes (8:00 AM - 5:00 PM).`,
    suggested: [
      'Paano mag-apply ng Medical Assistance?',
      'Requirements sa Burial Aid',
      'Saan makikita ang schedule ng ayuda?'
    ]
  },

  // 18. BENEFICIARY CATEGORIES & ELIGIBILITY
  {
    id: 'eligibility_categories',
    keywords: [
      'sino ang kwalipikado', 'eligible', 'kwalipikado', 'category', 'kategorya', 
      'pwd aid', 'senior citizen ayuda', 'solo parent', 'indigent', '4ps'
    ],
    title: 'Mga Kwalipikadong Kategorya sa ilalim ng EBMS',
    reply: `👥 **Sino-sino ang Kwalipikadong Tumanggap ng Tulong sa EBMS?**\n\nAng system ay nagbibigay ng prayoridad sa mga sumusunod na sektor:\n1. **PWD (Persons with Disabilities):** May PWD ID o medical diagnosis.\n2. **Senior Citizens (60 taong gulang pataas):** May Senior Citizen ID mula sa OSCA.\n3. **Solo Parents:** May Solo Parent ID o sertipikasyon mula sa LGU.\n4. **Indigent Families / Individuals:** Walang sapat o pirmihang kita, may Barangay Indigency.\n5. **4Ps Beneficiaries:** Rehistradong miyembro ng Pantawid Pamilyang Pilipino Program.\n6. **Farmers and Fisherfolk:** Nakatala sa RSBSA registry.\n7. **Katutubo (Indigenous Peoples - IP):** Mga miyembro ng kinikilalang tribo o pamayanang katutubo.`,
    suggested: [
      'Paano magparehistro sa system?',
      'Ano ang requirements sa Medical Assistance?',
      'Saan makikita ang aking QR code?'
    ]
  }
];

/**
 * Intelligent Matcher Function
 * Scores incoming user message against keywords and patterns.
 */
function findBestMatch(userQuery) {
  const normalized = userQuery.toLowerCase().trim();
  let bestMatch = null;
  let highestScore = 0;

  for (const item of SYSTEM_KNOWLEDGE_BASE) {
    let score = 0;

    for (const kw of item.keywords) {
      if (normalized === kw) {
        score += 15; // Exact match
      } else if (normalized.includes(kw)) {
        score += kw.length > 5 ? 8 : 4; // Substring match, weights longer phrases higher
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  // Minimum threshold to prevent false positives
  return highestScore >= 3 ? bestMatch : null;
}

// POST /api/bot/chat
router.post('/chat', async (req, res) => {
  try {
    const { message = '' } = req.body;
    const query = String(message).trim();

    // Welcome Greeting when query is empty
    if (!query) {
      return res.json({
        success: true,
        reply: 'Kumusta! Ako si **BeniAid Assistant** 🤖, ang iyong digital na gabay sa EBMS.\n\nHanda akong sumagot sa anumang katanungan ukol sa:\n• **QR Code at RFID Cards**\n• **Mga Requirements (Medical, Burial, Educational)**\n• **Live Schedule ng Ayuda at Distributions**\n• **Paano Mag-apply Online at Katayuan ng Aplikasyon**\n• **GCash/Maya/Landbank Payout Methods**\n\nPumili sa mga mungkahi sa ibaba o mag-type ng iyong tanong!',
        suggestedQuestions: [
          'Saan makikita ang QR code ko?',
          'Ano ang requirements sa Medical Assistance?',
          'Kailan ang schedule ng ayuda?',
          'Paano mag-apply ng assistance online?'
        ]
      });
    }

    const lowerQuery = query.toLowerCase();

    // 1. DYNAMIC DATABASE LOOKUP: Schedule & Distribution Events
    const isScheduleIntent = ['schedule', 'kailan', 'kelan', 'oras', 'petsa', 'distribution', 'ayuda', 'event', 'venue'].some(k => lowerQuery.includes(k));
    if (isScheduleIntent && (lowerQuery.includes('schedule') || lowerQuery.includes('ayuda') || lowerQuery.includes('distribution') || lowerQuery.includes('kailan') || lowerQuery.includes('kelan') || lowerQuery.includes('susunod') || lowerQuery.includes('petsa'))) {
      try {
        const upcomingEvents = await DistributionEvent.findAll({
          where: {
            status: { [Op.in]: ['Scheduled', 'Ongoing', 'scheduled', 'ongoing'] }
          },
          order: [['distribution_date', 'ASC']],
          limit: 3,
        });

        const activePrograms = await BenefitProgram.findAll({
          where: {
            status: { [Op.in]: ['Active', 'active'] }
          },
          limit: 4,
        });

        if (upcomingEvents && upcomingEvents.length > 0) {
          let eventList = upcomingEvents.map(e => {
            const dateStr = e.distribution_date 
              ? new Date(e.distribution_date).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' }) 
              : 'Petsa iaanunsyo';
            return `📅 **${e.name || 'Distribution Event'}**\n   • Petsa: ${dateStr}\n   • Venue: ${e.location || 'Barangay Center'}\n   • Katayuan: ${e.status}`;
          }).join('\n\n');

          return res.json({
            success: true,
            reply: `📢 **Mga Kasalukuyang Iskedyul ng Ayuda / Distribution sa EBMS:**\n\n${eventList}\n\n*Paalala sa mga Pupunta: Dalhin ang iyong QR Code o RFID Card at 1 Valid Government ID para ma-scan agad sa venue.*`,
            suggestedQuestions: [
              'Saan makikita ang QR code ko?',
              'Paano mag-check ng attendance history?',
              'Ano ang requirements para makasama sa ayuda?'
            ]
          });
        } else if (activePrograms && activePrograms.length > 0) {
          let progList = activePrograms.map(p => `• **${p.name}** (${p.type || 'Financial/Material Aid'})`).join('\n');
          return res.json({
            success: true,
            reply: `ℹ️ **Mga Aktibong Programa sa EBMS:**\n\n${progList}\n\nSa kasalukuyan, wala pang bagong naka-schedule na petsa ng distribution na nai-publish sa database. Manatiling nakatutok sa **Announcements** page o maghintay ng SMS notification mula sa PhilSMS!`,
            suggestedQuestions: [
              'Requirements sa Medical Assistance',
              'Paano mag-apply ng assistance online?',
              'Saan makikita ang QR code ko?'
            ]
          });
        }
      } catch (dbErr) {
        console.warn('[Bot DB Event Lookup]:', dbErr.message);
      }
    }

    // 2. DYNAMIC DATABASE LOOKUP: Barangays covered
    if (lowerQuery.includes('anong barangay') || lowerQuery.includes('mga barangay') || lowerQuery.includes('sakop na barangay')) {
      try {
        const barangays = await Barangay.findAll({
          attributes: ['barangay_name', 'barangay_code', 'captain_name'],
          limit: 8,
          order: [['barangay_name', 'ASC']]
        });
        if (barangays && barangays.length > 0) {
          const bList = barangays.map(b => `• **Brgy. ${b.barangay_name}** (${b.barangay_code || 'LGU'})${b.captain_name ? ` - Kap. ${b.captain_name}` : ''}`).join('\n');
          return res.json({
            success: true,
            reply: `🏛️ **Mga Sakop na Barangay sa ilalim ng EBMS:**\n\n${bList}\n\n*Maaaring pumunta sa tanggapan ng iyong barangay hall para kumuha ng Certificate of Indigency para sa iyong ayuda application.*`,
            suggestedQuestions: [
              'Paano magparehistro bilang beneficiary?',
              'Requirements sa Medical Assistance',
              'Saan makikita ang QR code ko?'
            ]
          });
        }
      } catch (err) {
        console.warn('[Bot DB Barangay Lookup]:', err.message);
      }
    }

    // 3. INTELLIGENT KNOWLEDGE BASE MATCHING
    const match = findBestMatch(lowerQuery);
    if (match) {
      return res.json({
        success: true,
        reply: match.reply,
        suggestedQuestions: match.suggested
      });
    }

    // 4. INTELLIGENT FALLBACK with guided options
    return res.json({
      success: true,
      reply: `Salamat sa iyong mensahe! Ako si **BeniAid Assistant** 🤖.\n\nHindi ko tiyak na nakuha ang eksaktong detalye ng iyong tanong, ngunit maaari kitang gabayan sa alinman sa mga sumusunod:\n\n1. **QR Code at RFID:** I-type ang *"Saan makikita ang QR code ko?"*\n2. **Assistance Requirements:** I-type ang *"Requirements sa Medical"*, *"Burial assistance"*, o *"Educational aid"*\n3. **Distribution Schedule:** I-type ang *"Kailan ang schedule ng ayuda?"*\n4. **Application Process:** I-type ang *"Paano mag-apply ng assistance online?"*\n5. **Payout Methods:** I-type ang *"Paano matatanggap ang payout via GCash?"*\n\nPiliin ang isa sa mga mungkahi sa ibaba:`,
      suggestedQuestions: [
        'Saan makikita ang QR code ko?',
        'Ano ang requirements sa Medical Assistance?',
        'Kailan ang schedule ng ayuda?',
        'Paano mag-apply ng assistance online?'
      ]
    });

  } catch (error) {
    console.error('[Bot Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Nagkaroon ng aberya sa bot service. Pakisubukang muli.',
      reply: 'Paumanhin, nagkaroon ng kaunting problema sa bot server. Pakisubukan muli o magpadala ng mensahe sa Admin.'
    });
  }
});

module.exports = router;
