const express = require('express');
const { 
  BenefitProgram, 
  DistributionEvent, 
  Announcement, 
  Barangay, 
  Beneficiary, 
  AssistanceRequest 
} = require('../db');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * COMPREHENSIVE EBMS / BENIAID KNOWLEDGE BASE
 * Trained specifically on all possible user questions, workflows, policies,
 * emergency hotlines, requirements, staff procedures, and technical features.
 */
const SYSTEM_KNOWLEDGE_BASE = [
  // 1. GREETINGS & INTRO
  {
    id: 'greetings',
    keywords: [
      'hi', 'hello', 'magandang umaga', 'magandang hapon', 'magandang gabi', 'kamusta', 
      'kumusta', 'good morning', 'good afternoon', 'good evening', 'good day', 'sino ka', 
      'ano pangalan mo', 'who are you', 'tulungan mo ako', 'help me', 'pa help', 'need help'
    ],
    patterns: [
      /^(hi|hello|kamusta|kumusta|magandang\s+(umaga|hapon|gabi)|good\s+(morning|afternoon|evening|day))(\s+po|\s+bot)?$/i,
      /^(sino\s+ka|who\s+are\s+you|ano\s+pangalan\s+mo)(\s+po)?$/i
    ],
    title: 'Pagbati mula kay BeniAid Assistant',
    reply: `👋 **Kumusta! Ako si BeniAid Assistant** 🤖, ang iyong opisyal na AI guide para sa **EBMS (Emergency Beneficiary Management System)**.\n\nHanda akong tumulong sa lahat ng iyong katanungan tungkol sa:\n• 📱 **QR Code at RFID Pass**\n• 📋 **Mga Requirements (Medical, Burial, Educational, Emergency)**\n• 📝 **Paano Magparehistro at Mag-apply Online**\n• 📅 **Schedule ng Ayuda at Distributions**\n• 💰 **GCash / Maya / Landbank Payout Tracking**\n• 👥 **Kinatawan / Representative Authorization**\n\nAno po ang nais ninyong malaman o itanong ngayon?`,
    suggested: [
      'Saan makikita ang QR code ko?',
      'Ano ang requirements sa Medical Assistance?',
      'Kailan ang schedule ng ayuda?',
      'Paano mag-apply ng assistance online?'
    ]
  },

  // 2. GRATITUDE & GOODBYES
  {
    id: 'gratitude_and_goodbye',
    keywords: [
      'salamat', 'maraming salamat', 'thank you', 'thanks', 'ty', 'salamat po', 
      'thank you po', 'ok na', 'ayos na', 'sige po', 'bye', 'paalam', 'goodbye', 
      'walang anuman', 'thank u', 'cge po'
    ],
    patterns: [
      /^(salamat|thank\s*you|thanks|ty|maraming\s+salamat)(\s+po|\s+bot)?$/i,
      /^(ok\s*na|ayos\s*na|sige\s*po|cge\s*po|bye|paalam|goodbye)$/i
    ],
    title: 'Pasasalamat at Pagpapaalam',
    reply: `🤝 **Walang anuman! Ikinagagalak kong makatulong sa iyo.**\n\nKung may karagdagan ka pang katanungan o kailangan ng tulong sa iyong ayuda at rehistro, i-type lamang ito rito anumang oras.\n\n💡 *Paalala: Huwag kalimutang i-save o i-screenshot ang iyong Beneficiary QR Code at panatilihing updated ang iyong cellphone number.* Nawa'y maging ligtas at mapayapa ang iyong araw! ✨`,
    suggested: [
      'Saan makikita ang QR code ko?',
      'Kailan ang schedule ng ayuda?',
      'Ano ang requirements sa Medical Assistance?'
    ]
  },

  // 3. SYSTEM OVERVIEW & WHAT IS EBMS
  {
    id: 'system_overview',
    keywords: [
      'ano ang ebms', 'ano ang beniaid', 'ebms', 'beniaid', 'tungkol sa system', 'about ebms', 
      'about beniaid', 'system', 'ano ito', 'ano ang app', 'para saan', 'ano ginagawa ng ebms'
    ],
    patterns: [
      /ano\s+ang\s+(ebms|beniaid)/i,
      /para\s+saan\s+(ang\s+)?(ebms|beniaid|system|app)/i
    ],
    title: 'Tungkol sa EBMS (BeniAid)',
    reply: `🌐 **Ano ang EBMS (BeniAid)?**\n\nAng **EBMS** (Emergency Beneficiary Management System), na kilala rin bilang **BeniAid**, ay ang opisyal na digital platform para sa pamamahala ng mga ayuda at serbisyong panlipunan ng Pamahalaan/DSWD/MSWDO.\n\n✨ **Pangunahing Gamit ng System:**\n• **Digital Beneficiary Profiling:** Pagpaparehistro at pag-iingat ng talaan ng mga benepisyaryo.\n• **Contactless RFID & QR Scanner:** Mabilis at tumpak na pag-verify ng pagkakakilanlan tuwing may distribution o attendance.\n• **Online Assistance Applications:** Pag-apply para sa Medical, Burial, Educational, at Emergency Aid gamit ang web o cellphone.\n• **Digital at Cash Payout Tracking:** Pamamahagi ng ayuda via GCash, Maya, Landbank, o cash over-the-counter.\n• **PhilSMS Automated Alerts:** Awtomatikong SMS text updates tungkol sa distribution schedules at application status.`,
    suggested: [
      'Paano magparehistro bilang beneficiary?',
      'Saan makikita ang aking QR Code?',
      'Ano-ano ang mga ayuda programs?'
    ]
  },

  // 4. BENEFICIARY REGISTRATION & SIGN UP
  {
    id: 'registration_process',
    keywords: [
      'register', 'magrehistro', 'paano magparehistro', 'sign up', 'gumawa ng account', 
      'create account', 'paano sumali', 'magpalista', 'rehistro', 'mag sign up', 
      'paano mag register', 'saan magpaparehistro', 'gusto ko sumali'
    ],
    patterns: [
      /paano\s+(mag\s*rehistro|mag\s*register|sumali|magpalista|gumawa\s+ng\s+account)/i,
      /gusto\s+ko\s+(magparehistro|magpalista|mag-apply)/i
    ],
    title: 'Paano Magparehistro sa EBMS',
    reply: `📋 **Paano Magparehistro sa EBMS (BeniAid)?**\n\n1. Pumunta sa **Landing Page** o buksan ang **BeniAid Mobile App**.\n2. I-click ang **"Magparehistro"** o **"Create Account"**.\n3. Punan ang mga impormasyon:\n   • **Pangalan at Kapanganakan** (First Name, Last Name, Birthdate, Kasarian)\n   • **Tirahan:** Barangay, Purok/Sitio, at Buong Address\n   • **Kategorya:** PWD, Senior Citizen, Solo Parent, Indigent, 4Ps, Youth, Farmer, o Fisherfolk\n   • **IP Classification:** Katutubo (IP) o Non-IP\n   • **Aktibong Cellphone Number** (para makatanggap ng SMS text alerts)\n   • **Username at Password**\n4. I-upload ang malinaw na litrato ng iyong **Valid Government ID** at **Barangay Indigency**.\n5. I-click ang **"Submit Registration"**. Magiging **"Pending Review"** muna ang status habang sinusuri ng MSWDO social workers.`,
    suggested: [
      'Ano ang mga tinatanggap na Valid ID?',
      'Gaano katagal bago ma-approve ang rehistro?',
      'Saan makikita ang QR code kapag approved na?'
    ]
  },

  // 5. REGISTRATION REQUIREMENTS & ACCEPTED VALID IDS
  {
    id: 'registration_requirements',
    keywords: [
      'valid id', 'requirements sa rehistro', 'ano kailangan sa rehistro', 'mga id na pwede', 
      'anong id ang tatanggapin', 'tinatanggap na id', 'dokumento sa rehistro', 'dokumento'
    ],
    patterns: [
      /anong\s+(valid\s+)?id\s+(ang\s+)?(pwede|tinatanggap|tatanggapin)/i,
      /requirements\s+(sa|para\s+sa)\s+(rehistro|pagpaparehistro|pagpalista)/i
    ],
    title: 'Mga Valid ID at Requirements para sa Rehistro',
    reply: `🪪 **Mga Dokumentong Kailangan sa Pagpaparehistro:**\n\n1. **Isang (1) Opisyal na Valid Government ID:**\n   • Philippine National ID (PhilSys)\n   • UMID o SSS / GSIS ID\n   • Driver's License\n   • COMELEC Voter's ID / Voter's Certificate\n   • Senior Citizen ID (mula sa OSCA)\n   • PWD ID (mula sa PDAO/MSWDO)\n   • Solo Parent ID\n   • Postal ID (Digital / PVC)\n   • Barangay ID\n\n2. **Barangay Certificate of Indigency:**\n   • Inisyu sa loob ng huling anim (6) na buwan mula sa inyong Barangay Hall na nagpapatunay ng paninirahan at katayuan sa buhay.\n\n3. **Aktibong Cellphone Number:**\n   • Kailangan para sa pagtanggap ng PhilSMS notifications at verification OTP.`,
    suggested: [
      'Paano magparehistro sa system?',
      'Gaano katagal bago ma-approve?',
      'Bakit pending pa ang account ko?'
    ]
  },

  // 6. REGISTRATION STATUS (PENDING, APPROVED, REJECTED)
  {
    id: 'account_status',
    keywords: [
      'status ng account', 'pending', 'approved', 'na approve', 'official member', 
      'kailan ma approve', 'rejected', 'tinanggihan', 'bakit pending', 'ano ibig sabihin ng pending', 
      'pending review', 'under review', 'na reject', 'paano kapag rejected'
    ],
    patterns: [
      /bakit\s+(pending|under\s+review|rejected)\s+(ang\s+)?(account|rehistro|profile)/i,
      /kailan\s+(ma-?a?approve|maaprubahan)\s+(ang\s+)?(account|rehistro)/i,
      /gaano\s+katagal\s+(bago\s+ma-?approve|ang\s+approval)/i
    ],
    title: 'Mga Status ng Beneficiary Profile',
    reply: `🔍 **Paliwanag sa Katayuan (Status) ng Iyong Rehistro:**\n\n• 🟡 **Pending Review / Under Review:** Kasalukuyang sinusuri ng MSWDO Social Worker ang iyong isinumiteng mga dokumento at impormasyon.\n  *Oras ng Pagsusuri:* Karaniwang 1 hanggang 3 araw ng trabaho (Lunes hanggang Biyernes).\n\n• 🟢 **Approved (Official Member):** Rehistrado ka na! Mabibigyan ka ng opisyal na **Beneficiary ID Code (hal. BEN-2026-XXXX)** at maaari mo nang i-download at gamitin ang iyong **Personal QR Code** para sa mga ayuda.\n\n• 🔴 **Rejected:** Mayroong kulang, malabo, o hindi tugmang dokumento (halimbawa: malabong ID o paso na indigency). Maaari mong buksan ang iyong profile, basahin ang nakasaad na dahilan, at mag-upload muli ng tamang dokumento para masuri ulit.`,
    suggested: [
      'Saan makikita ang QR code kapag approved na?',
      'Paano mag-apply ng assistance online?',
      'Hotline ng MSWDO para sa follow-up'
    ]
  },

  // 7. BENEFICIARY QR CODE PASS
  {
    id: 'qr_code_details',
    keywords: [
      'qr', 'qr code', 'barcode', 'saan makikita ang qr', 'my qr', 'view qr', 'download qr', 
      'saan ang qr', 'digital id', 'code ko', 'nawala ang qr', 'personal qr', 'paano gamitin ang qr', 
      'screenshot ng qr', 'iprint ang qr'
    ],
    patterns: [
      /saan\s+(makikita|kukunin|hahanapin)\s+(ang\s+)?(qr|qr\s*code|digital\s*id)/i,
      /paano\s+(gamitin|i-?download|i-?print)\s+(ang\s+)?(qr|qr\s*code)/i,
      /nawala\s+(ang\s+)?(qr|qr\s*code)/i
    ],
    title: 'Saan Makikita at Paano Gamitin ang QR Code',
    reply: `📱 **Ang Iyong Personal Beneficiary QR Code:**\n\nAng bawat aprubadong benepisyaryo ay may natatanging QR Code na nagsisilbing iyong digital pass.\n\n📍 **Saan ito makikita?**\n1. Mag-login sa iyong account sa **Web Portal** o **Mobile App**.\n2. Pumunta sa **"My Profile"** o **"Digital ID / My Benefits"**.\n3. Agad na ipapakita ang iyong personal QR Code kasama ang iyong buong pangalan at Beneficiary Number (hal. BEN-2026-XXXX).\n\n💡 **Paano ito gamitin?**\n• **I-save o I-screenshot:** Maaari mo itong i-screenshot sa iyong cellphone gallery o i-print sa papel.\n• **Sa Araw ng Distribution:** Itapat lamang ang QR code sa camera o scanner ng MSWDO staff para sa 1-second contactless verification at maitala ang attendance mo.\n\n⚠️ *Paalala: Huwag ipapamahagi ang iyong QR code sa ibang tao upang maprotektahan ang iyong ayuda.*`,
    suggested: [
      'Ano ang gamit ng RFID card?',
      'Kailan ang susunod na ayuda distribution?',
      'Pwede ba representative ang kumuha gamit ang QR?'
    ]
  },

  // 8. RFID CARD & CONTACTLESS TAP
  {
    id: 'rfid_details',
    keywords: [
      'rfid', 'rfid card', 'tap', 'card', 'id card', 'nfc', 'smart card', 'tap card', 
      'nawala ang rfid', 'saan kukuha ng rfid', 'magkano rfid', 'kailangan ba ng rfid'
    ],
    patterns: [
      /ano\s+ang\s+rfid/i,
      /saan\s+(kukuha|makakakuha)\s+ng\s+rfid/i,
      /nawala\s+ang\s+rfid/i
    ],
    title: 'Tungkol sa RFID Card ng Benepisyaryo',
    reply: `💳 **Tungkol sa Beneficiary RFID Card:**\n\n• **Ano ito?** Ang **RFID Card** ay matibay at pisikal na card na may built-in microchip na ibinibigay ng MSWDO nang **LIBRE** sa mga rehistradong benepisyaryo.\n• **Paano ginagamit?** Itinatap lamang ito sa RFID reader scanner ng staff sa venue. Sa loob ng 1 segundo, mamamarkahan kang **Present / Claimed**.\n• **Wala pang RFID Card?** Walang problema! Ang iyong **Digital QR Code** sa cellphone o printed copy ay may kaparehong bisa at 100% tinatanggap sa scanner.\n• **Nawala ang RFID Card?** Ipagbigay-alam agad sa iyong Barangay Hall o MSWDO Desk upang ma-block ang lumang card at mabigyan ka ng bagong replacement card nang ligtas.`,
    suggested: [
      'Saan makikita ang aking QR code?',
      'Saan makikita ang attendance record ko?',
      'Kailan ang susunod na ayuda schedule?'
    ]
  },

  // 9. MEDICAL ASSISTANCE (AICS GAMOT, HOSPITAL, DIALYSIS)
  {
    id: 'medical_assistance',
    keywords: [
      'medical', 'gamot', 'hospital', 'pagpapagamot', 'laboratory', 'dialysis', 'chemo', 
      'gamot sa ospital', 'operasyon', 'reseta', 'medical assistance', 'tulong medikal', 
      'pambayad sa ospital', 'chemotherapy', 'clinical abstract', 'medical aid'
    ],
    patterns: [
      /requirements\s+(sa|para\s+sa)\s+(medical|gamot|ospital|hospital|dialysis)/i,
      /paano\s+(mag-?apply|humingi\s+ng\s+tulong)\s+(sa\s+)?(gamot|medical|ospital)/i,
      /magkano\s+(ang\s+)?(medical\s+assistance|tulong\s+sa\s+gamot)/i
    ],
    title: 'Medical Assistance Guidelines & Requirements (AICS)',
    reply: `🏥 **Medical Assistance (AICS / BeniAid):**\n\nTulong pinansyal para sa pambili ng gamot, laboratory/diagnostic tests, hemodialysis, chemotherapy, operasyon, at hospital bill.\n\n📋 **Kumpletong Listahan ng Requirements:**\n1. **Barangay Certificate of Indigency** ng pasyente o ng maglalakad.\n2. **Medical Certificate o Clinical Abstract:**\n   • Nilagdaan ng doktor na may malinaw na PRC License Number.\n   • Inisyu sa loob ng huling tatlong (3) buwan.\n3. **Hospital Statement of Account / Billing** (kung naka-confine) O **Reseta (Prescription)** na may quotation mula sa parmasya/botika.\n4. **Isang (1) Valid Government ID** ng pasyente at ng maglalakad.\n5. **Katunayan ng Relasyon** kung kinatawan ang maglalakad (hal. Marriage Contract o Birth Certificate).\n\n💰 **Halaga ng Tulong:** Karaniwang ₱3,000 hanggang ₱10,000 depende sa assessment ng social worker.\n📲 *Maaaring magsumite online via:* **Request Assistance > Medical Assistance**.`,
    suggested: [
      'Gaano katagal bago ma-release ang medical aid?',
      'Paano mag-apply ng assistance online?',
      'Ano ang requirements sa burial assistance?'
    ]
  },

  // 10. BURIAL / FUNERAL ASSISTANCE (LIBING, BUROL)
  {
    id: 'burial_assistance',
    keywords: [
      'burial', 'libing', 'patay', 'burol', 'kabaong', 'funeral', 'pagpapalibing', 
      'cremation', 'punerarya', 'burial assistance', 'tulong sa libing', 'namatayan', 'death aid'
    ],
    patterns: [
      /requirements\s+(sa|para\s+sa)\s+(burial|libing|burol|punerarya)/i,
      /paano\s+(mag-?apply|humingi\s+ng\s+tulong)\s+sa\s+(libing|burial|burol)/i,
      /magkano\s+(ang\s+)?(burial\s+assistance|tulong\s+sa\s+libing)/i
    ],
    title: 'Burial / Funeral Assistance Guidelines',
    reply: `⚰️ **Burial at Funeral Assistance:**\n\nTulong pinansyal para sa gastusin sa burol, kabaong, at pagpapalibing sa yumaong mahal sa buhay.\n\n📋 **Mga Dokumentong Kailangang Ihanda:**\n1. **Certified True Copy ng Death Certificate** (nakarehistro sa Local Civil Registrar o PSA).\n2. **Funeral Contract o Kasunduan sa Punerarya** (nakasaad ang kabuuang halaga at natitirang balanse).\n3. **Barangay Certificate of Indigency** ng naglalakad/claimant.\n4. **Valid Government ID** ng naglalakad na kapamilya.\n5. **Proof of Relationship sa Yumao:**\n   • Marriage Contract (kung asawa ang naglalakad)\n   • Birth Certificate (kung anak o magulang ang naglalakad).\n\n💰 **Halaga ng Tulong:** Karaniwang ₱5,000 hanggang ₱10,000.\n📲 *I-submit ang aplikasyon sa ilalim ng menu na* **"Request Assistance > Burial Assistance"**.`,
    suggested: [
      'Paano mag-apply ng assistance online?',
      'Ano ang requirements sa medical assistance?',
      'Gaano katagal bago ma-release ang assistance?'
    ]
  },

  // 11. EDUCATIONAL ASSISTANCE (TUITION, BAON, GAMIT)
  {
    id: 'educational_assistance',
    keywords: [
      'educational', 'school', 'tuition', 'estudyante', 'baon', 'gamit sa eskwela', 
      'scholarship', 'student', 'eskwelahan', 'kolehiyo', 'high school', 'educational assistance', 
      'allowance', 'tulong sa estudyante'
    ],
    patterns: [
      /requirements\s+(sa|para\s+sa)\s+(educational|estudyante|tuition|school)/i,
      /paano\s+(mag-?apply|makakuha)\s+ng\s+(educational|tulong\s+sa\s+pag-aaral)/i,
      /magkano\s+(ang\s+)?(educational\s+assistance|tulong\s+sa\s+estudyante)/i
    ],
    title: 'Educational Assistance Guidelines',
    reply: `🎓 **Educational Assistance:**\n\nTulong pinansyal para sa mga kapos-palad ngunit masisipag na mag-aaral para sa school supplies, transportasyon, uniporme, at tuition fees.\n\n📋 **Mga Kinakailangang Dokumento:**\n1. **Certificate of Enrollment o Official Registration Form** para sa kasalukuyang semester o school year.\n2. **Valid School ID** ng estudyante (back and front).\n3. **Barangay Certificate of Indigency** ng magulang o tumatayong guardian.\n4. **Valid Government ID** ng magulang/guardian na maglalakad.\n5. **Statement of Account / Assessment Form** (kung may binabayarang matrikula sa kolehiyo o paaralan).\n\n💰 **Halaga ng Tulong:** Karaniwang ₱1,000 hanggang ₱5,000 bawat semester depende sa antas ng pag-aaral.`,
    suggested: [
      'Paano mag-apply ng educational assistance?',
      'Sino ang kwalipikado sa educational aid?',
      'Kailan ang schedule ng educational payout?'
    ]
  },

  // 12. TRANSPORTATION & EMERGENCY CALAMITY RELIEF
  {
    id: 'emergency_assistance',
    keywords: [
      'transportation', 'pamasahe', 'stranded', 'uwi ng probinsya', 'emergency aid', 
      'calamity', 'bagyo', 'baha', 'sunog', 'relief goods', 'food pack', 'sakuna', 
      'nasunugan', 'nasalanta', 'emergency cash'
    ],
    patterns: [
      /requirements\s+(sa|para\s+sa)\s+(transportation|pamasahe|stranded|sunog|kalamidad|bagyo)/i,
      /paano\s+makakuha\s+ng\s+(relief\s+goods|food\s+pack|pamasahe)/i
    ],
    title: 'Transportation & Emergency Calamity Relief',
    reply: `🚨 **Transportation & Calamity Emergency Relief:**\n\n• **Transportation Assistance (Balik-Probinsya / Stranded):**\n  Para sa mga na-stranded o walang pamasahe pabalik sa sariling probinsya.\n  *Requirements:* Police Blotter o Barangay Certification ukol sa pagka-stranded, Valid ID, at katunayan ng tirahan sa pupuntahan.\n\n• **Emergency Calamity Relief (Sunog, Bagyo, Baha, Lindol):**\n  *Requirements:* Barangay Certificate of Disaster Victim o Fire Incident Report mula sa BFP, Valid ID.\n  *Porma ng Tulong:* Emergency food packs, hygiene kits, at financial emergency relief mula sa MSWDO/DSWD.`,
    suggested: [
      'Mga opisyal na emergency hotline',
      'Paano mag-apply ng assistance online?',
      'Saan ang opisina ng MSWDO?'
    ]
  },

  // 13. HOW TO APPLY ONLINE (STEP-BY-STEP)
  {
    id: 'how_to_apply',
    keywords: [
      'apply', 'mag apply', 'mag-apply', 'paano mag apply', 'paano magsumite', 
      'application', 'submit application', 'mag pasa ng requirements', 'saan mag aapply', 
      'mag request ng ayuda', 'request assistance'
    ],
    patterns: [
      /paano\s+(mag-?apply|magsumite|magpasa|mag-?request)\s+(ng\s+ayuda|online|ng\s+assistance)/i,
      /saan\s+(mag-?aapply|pwedeng\s+mag-?apply)/i
    ],
    title: 'Hakbang sa Pag-apply ng Assistance Online',
    reply: `📝 **Step-by-Step Gabay sa Pag-apply ng Assistance Online:**\n\n1. **Mag-login:** Mag-sign in sa EBMS (Web Portal o Mobile App) gamit ang iyong account.\n2. **Pumunta sa Menu:** I-click ang **"Request Assistance"** o **"Assistance"** sa dashboard.\n3. **Pumili ng Kategorya:** Halimbawa: *Medical Assistance*, *Burial Assistance*, o *Educational Assistance*.\n4. **Ibigay ang Detalye:** Ilagay ang kinakailangang halaga (requested amount), dahilan, at deskripsyon ng inyong kalagayan.\n5. **I-attach ang Dokumento:** Mag-upload ng malinaw na litrato o PDF ng iyong requirements (ID, Indigency, Medical Abstract, Billing, atbp.).\n6. **Pindutin ang "Submit":** Agad itong marerehistro sa system at magkakaroon ng Reference Number.\n7. **Subaybayan:** Tingnan ang status sa ilalim ng **"My Applications"**.`,
    suggested: [
      'Saan makikita ang status ng application ko?',
      'Ano ang requirements sa Medical Assistance?',
      'Gaano katagal bago ma-release ang pera?'
    ]
  },

  // 14. APPLICATION STATUS & TWO-TIER APPROVAL FOLLOW-UP
  {
    id: 'application_tracking',
    keywords: [
      'status ng application', 'na approve na ba ang request', 'kailan marerelease', 
      'bakit pending ang request', 'follow up', 'subaybayan ang application', 
      'kailan makukuha ang pera', 'gaano katagal bago matanggap'
    ],
    patterns: [
      /status\s+ng\s+(application|request|tulong)/i,
      /kailan\s+(marerelease|makukuha|matatanggap)\s+(ang\s+)?(pera|ayuda|tulong)/i,
      /gaano\s+katagal\s+(ang\s+application|bago\s+ma-?release)/i
    ],
    title: 'Pagsubaybay sa Katayuan ng Aplikasyon (Two-Tier Approval)',
    reply: `🔍 **Paano Subaybayan ang Iyong Assistance Application:**\n\n1. Buksan ang **"My Applications"** tab sa iyong account.\n2. Ang bawat aplikasyon ay dumaraan sa **Two-Tier Verification System** ng LGU:\n   • 🟡 **Tier 1 (Social Worker Assessment):** Sinusuri ang mga dokumento at kinukumpirma ang katotohanan ng pangangailangan.\n   • 🔵 **Tier 2 (MSWDO Head / Approver Review):** Pinal na pag-apruba sa halagang ipagkakaloob alinsunod sa badyet.\n   • 🟢 **Approved for Disbursement:** Handa na para sa payout via GCash, Maya, o Cash Distribution.\n\n*Oras ng Pagproseso:* Karaniwang 3 hanggang 5 araw ng trabaho. Makakatanggap ka rin ng automated SMS text alert kapag na-aprubahan na ito!`,
    suggested: [
      'Paano matatanggap ang payout via GCash?',
      'Paano i-update ang GCash number ko?',
      'Hotline ng MSWDO para sa follow-up'
    ]
  },

  // 15. PAYOUT METHODS & DISBURSEMENTS
  {
    id: 'payout_methods',
    keywords: [
      'payout', 'pera', 'gcash', 'maya', 'landbank', 'cash', 'kuha ng ayuda', 'saan kukunin ang pera', 
      'account number', 'paano makukuha ang pera', 'disbursement', 'claimed', 'walang gcash'
    ],
    patterns: [
      /paano\s+(makukuha|matatanggap)\s+(ang\s+)?(pera|payout|ayuda)/i,
      /saan\s+(kukunin|ibibigay)\s+(ang\s+)?(pera|payout)/i,
      /pwede\s+ba(ng)?\s+(gcash|maya|landbank|cash)/i
    ],
    title: 'Mga Paraan ng Pagtanggap ng Payout (Disbursement)',
    reply: `💰 **Mga Paraan ng Payout sa EBMS:**\n\n1. **Digital Payout (GCash / Maya / Landbank):**\n   • Direktang papasok ang ayuda sa iyong personal na e-wallet o bank account nang **walang kaltas / zero transaction fee**.\n   • *Paano i-set up:* Pumunta sa iyong **Profile** > **Payout Settings** > Ilagay ang provider, account number, at nakarehistrong buong pangalan.\n\n2. **Cash Over-the-Counter (On-Site Distribution):**\n   • Para sa mga walang digital wallet o bangko, ibibigay ito nang personal sa itinakdang distribution center/barangay hall.\n   • *Kailangang Dalhin:* Ang iyong **Personal QR Code o RFID Card** at isang **Valid Government ID**.`,
    suggested: [
      'Paano i-update ang GCash number ko?',
      'Kailan ang schedule ng susunod na payout?',
      'Pwede ba representative ang kumuha ng ayuda?'
    ]
  },

  // 16. UPDATE GCASH NUMBER / PAYOUT DETAILS
  {
    id: 'update_payout_details',
    keywords: [
      'palitan ang gcash', 'maling gcash number', 'i-update ang gcash', 'update gcash', 
      'palitan ang number sa gcash', 'nawala ang sim', 'update payout', 'bagong gcash'
    ],
    patterns: [
      /paano\s+(palitan|i-?update|baguhin)\s+(ang\s+)?(gcash|maya|bank|payout)/i,
      /mali\s+(ang\s+)?(gcash|number\s+ko)/i
    ],
    title: 'Paano Palitan o I-update ang GCash / Payout Account',
    reply: `📲 **Paano I-update ang GCash o Payout Account:**\n\n1. Mag-login sa iyong account sa **Web Portal** o **Mobile App**.\n2. Pumunta sa **"My Profile"** at piliin ang **"Payout Settings"** o **"Edit Profile"**.\n3. Piliin ang Payout Method (GCash, Maya, o Landbank).\n4. Ilagay ang iyong **11-digit mobile number** (hal. 09123456789) at ang opisyal na pangalan na nakarehistro sa GCash.\n5. I-click ang **"Save Changes"**.\n\n⚠️ *Mahalagang Paalala:* Siguraduhing **Fully Verified** ang iyong GCash account at nakapangalan sa iyo o sa awtorisadong kinatawan upang maiwasan ang rejected disbursement transfer.`,
    suggested: [
      'Paano matatanggap ang payout?',
      'Saan makikita ang status ng application?',
      'Saan makikita ang QR code ko?'
    ]
  },

  // 17. REPRESENTATIVE / AUTHORIZATION LETTER (KUNG MAY SAKIT)
  {
    id: 'representative_claim',
    keywords: [
      'representative', 'kinatawan', 'ipakuha sa iba', 'authorization letter', 'may sakit', 
      'hindi makakapunta', 'nasa ospital', 'asawa ang kukuha', 'anak ang kukuha', 
      'kamag anak', 'spa', 'special power of attorney', 'pwede ba representative'
    ],
    patterns: [
      /pwede\s+ba(ng)?\s+(representative|iba|kinatawan|anak|asawa|kamag-anak)\s+(ang\s+kumuha|mag-?claim)/i,
      /may\s+sakit\s+(ang\s+beneficiary|ako)/i,
      /ano\s+(ang\s+)?requirements\s+(sa|para\s+sa)\s+authorization\s+letter/i
    ],
    title: 'Pagkuha ng Ayuda sa pamamagitan ng Kinatawan (Representative)',
    reply: `👥 **Oo! Pinapayagan ang Authorized Representative** kung ang benepisyaryo ay may sakit, nakaratay sa ospital, senior citizen na hindi makabiyahe, o may kapansanan.\n\n📋 **Mga Kinakailangang Dalhin ng Kinatawan sa Venue:**\n1. **Authorization Letter:**\n   • Nilagdaan ng benepisyaryo (o may malinaw na thumbmark kung hindi makapirma).\n   • Nakasaad ang pangalan ng benepisyaryo at pangalan ng kinatawan.\n2. **Orihinal at Photocopy ng Valid ID ng Benepisyaryo.**\n3. **Orihinal at Photocopy ng Valid ID ng Kinatawan.**\n4. **Proof of Relationship:**\n   • Marriage Contract (kung asawa)\n   • Birth Certificate (kung anak o kapatid)\n   • Barangay Certification of Guardianship/Relationship.\n5. **Digital QR Code o RFID Card ng Benepisyaryo.**`,
    suggested: [
      'Saan makikita ang QR code ng beneficiary?',
      'Kailan ang schedule ng susunod na ayuda?',
      'Hotline ng MSWDO para sa katanungan'
    ]
  },

  // 18. HOW MUCH AID CAN A BENEFICIARY RECEIVE (PAYOUT RATES)
  {
    id: 'payout_amounts',
    keywords: [
      'magkano', 'magkano ang ayuda', 'magkano ang matatanggap', 'maximum amount', 
      'halaga ng tulong', 'magkano ang makukuha', 'mag kano', 'may bayad ba'
    ],
    patterns: [
      /magkano\s+(ang\s+)?(ayuda|matatanggap|makukuha|tulong|payout)/i,
      /may\s+bayad\s+ba\s+(ang\s+)?(pag-?apply|system|rehistro)/i
    ],
    title: 'Halaga ng Ayuda at Kawalan ng Bayad',
    reply: `💵 **Halaga ng Ayuda sa ilalim ng EBMS / AICS:**\n\n• 🏥 **Medical Assistance:** Karaniwang ₱3,000 hanggang ₱10,000 (depende sa halaga ng reseta o hospital bill).\n• ⚰️ **Burial Assistance:** Karaniwang ₱5,000 hanggang ₱10,000 alinsunod sa kontrata sa punerarya.\n• 🎓 **Educational Assistance:** Karaniwang ₱1,000 hanggang ₱5,000 bawat semester.\n• 🚨 **Transportation / Emergency Aid:** Karaniwang ₱1,000 hanggang ₱3,000 pamasahe o relief assistance.\n\n🚫 **WALANG BAYAD (100% LIBRE):**\nAng pagpaparehistro, pag-apply, at paggamit ng EBMS platform ay **ganap na libre**. Walang sinumang staff o opisyal ang may karapatang humingi ng processing fee o kaltas sa inyong ayuda!`,
    suggested: [
      'Paano mag-apply ng assistance online?',
      'Ano ang requirements sa Medical Assistance?',
      'Saan magsusumbong kung may nangongotong o reklamo?'
    ]
  },

  // 19. ATTENDANCE & CLAIM RECORDS
  {
    id: 'attendance_history',
    keywords: [
      'attendance', 'record', 'kasaysayan', 'history', 'naka attendance ba ako', 
      'paano malalaman kung present', 'naka claim na ba', 'claim record', 'logs', 
      'bakit absent', 'hindi na record'
    ],
    patterns: [
      /naka-?attend\s+ba\s+ako/i,
      /saan\s+makikita\s+ang\s+(attendance|record|history)/i,
      /paano\s+malalaman\s+kung\s+(present|claimed)/i
    ],
    title: 'Pagsusuri ng Attendance at Claim Records',
    reply: `📊 **Pagsusuri ng Iyong Attendance at Payout Claims:**\n\n1. Pumunta sa menu na **"Attendance"** o **"My Attendance"** sa iyong account.\n2. Makikita mo rito ang kumpletong talaan:\n   • **Pamagat ng Meeting o Distribution Event**\n   • **Petsa at Oras** kung kailan na-scan ang iyong QR / RFID\n   • **Lokasyon (Venue)** at Tagapangasiwang Staff\n   • **Katayuan:** Dumalo (Present / Claimed) o Liban (Absent)\n   • **Compliance Rate:** Porsyento ng iyong pagdalo sa mga itinakdang patawag ng DSWD/MSWDO.\n\n*Awtomatikong naitatala ang bawat pag-scan kaya garantisadong ligtas ang iyong rekord.*`,
    suggested: [
      'Saan makikita ang aking QR code?',
      'Kailan ang susunod na distribution schedule?',
      'Ano ang gagawin kapag hindi na-scan ang card?'
    ]
  },

  // 20. ANNOUNCEMENTS & SMS NOTIFICATIONS (PHILSMS)
  {
    id: 'announcements_and_sms',
    keywords: [
      'announcement', 'anunsyo', 'balita', 'sms', 'text', 'philsms', 
      'abiso', 'magtetext ba', 'notification', 'alert', 'mensahe mula sa dswd', 
      'bakit walang text', 'nagpalit ng number'
    ],
    patterns: [
      /magte-?text\s+ba/i,
      /bakit\s+walang\s+(text|sms|notification)/i,
      /saan\s+makikita\s+ang\s+(anunsyo|announcement)/i
    ],
    title: 'Announcements at SMS Notifications via PhilSMS',
    reply: `📢 **Mga Anunsyo at PhilSMS Text Alerts:**\n\n• **In-App Announcements:** Pumunta sa **"Announcements"** tab sa app o portal upang mabasa ang mga opisyal na paalala at iskedyul.\n• **PhilSMS Automated Text:** Kapag may bagong programa, ayuda release, o pagpupulong sa iyong barangay, awtomatikong magpapadala ang EBMS ng text message sa numero ng cellphone na inirehistro mo.\n• **Bakit Walang Natatanggap na Text?**\n  1. Maaaring mali o luma ang numerong nakatala sa iyong profile.\n  2. Pumunta sa **Profile > Edit Profile** at i-update ang iyong aktibong cellphone number.\n  3. Siguraduhing may signal at hindi puno ang inbox ng iyong telepono.`,
    suggested: [
      'Paano i-update ang cellphone number ko?',
      'Kailan ang schedule ng ayuda?',
      'Saan makikita ang QR code ko?'
    ]
  },

  // 21. FORGOT PASSWORD, OTP, & GOOGLE SIGN-IN
  {
    id: 'account_security',
    keywords: [
      'password', 'nakalimutan ang password', 'forgot password', 'reset password', 
      'palitan ang password', 'google sign in', 'login error', 'hindi makapasok', 
      'otp', 'one time pin', 'hindi dumadating ang otp', 'resend otp'
    ],
    patterns: [
      /nakalimutan\s+(ko\s+)?ang\s+password/i,
      /paano\s+(mag-?reset|palitan)\s+ng\s+password/i,
      /hindi\s+(dumarating|dumadating|natanggap)\s+ang\s+otp/i
    ],
    title: 'Pag-reset ng Password, OTP, at Google Sign-In',
    reply: `🔐 **Seguridad ng Account at Pag-reset ng Password:**\n\n• **Nakalimutan ang Password?**\n  1. Sa Login screen, i-click ang **"Nakalimutan ang Password?"**.\n  2. Piliin kung saan gustong ipadala ang OTP: sa iyong **Cellphone (SMS)** o sa iyong **Email**.\n  3. Ilagay ang 6-digit verification code at maglagay ng bagong password.\n\n• **Hindi Dumadating ang OTP?**\n  1. Maghintay ng 60 segundo bago i-click ang **"Resend OTP"**.\n  2. Subukang gamitin ang Email OTP alternatibo kung mahina ang signal ng network.\n\n• **Google Sign-In:**\n  Maaari mong gamitin ang button na **"Sign in with Google"** para sa mabilis at ligtas na 1-click login gamit ang iyong Gmail.`,
    suggested: [
      'Paano mag-login gamit ang Google?',
      'Paano magparehistro sa system?',
      'Saan makikita ang QR code ko?'
    ]
  },

  // 22. DIRECT MESSAGING WITH SOCIAL WORKERS (STAFF CHAT)
  {
    id: 'messages_chat',
    keywords: [
      'chat', 'messages', 'kausap', 'social worker', 'magtanong sa staff', 
      'admin chat', 'direct message', 'magmessage', 'makipag-ugnayan', 
      'makipag-usap sa tao', 'totoong tao', 'customer service'
    ],
    patterns: [
      /gusto\s+ko\s+(makausap|kausapin)\s+(ang\s+)?(tao|social\s*worker|staff|admin)/i,
      /paano\s+(mag-?message|makipag-?chat)\s+sa\s+(staff|social\s*worker)/i
    ],
    title: 'Pakikipag-ugnayan sa MSWDO Social Workers',
    reply: `💬 **Pakikipag-ugnayan sa MSWDO Social Workers (Live Chat):**\n\nBukod sa akin bilang AI Assistant, maaari kang makipag-chat nang direkta sa mga kawani at social workers ng munisipyo:\n\n1. Mag-login sa iyong account.\n2. Pumunta sa menu na **"Messages"** sa navigation bar o sidebar.\n3. Piliin ang nakatalagang MSWDO Social Worker o Barangay Officer.\n4. I-type ang iyong mensahe, katanungan, o paglilinaw tungkol sa iyong application.\n5. Makakatanggap ka ng in-app reply at notification kapag sinagot ito ng staff.`,
    suggested: [
      'Ano ang hotline ng DSWD?',
      'Paano mag-follow up ng application?',
      'Saan ang opisina ng MSWDO?'
    ]
  },

  // 23. OFFICE HOURS, LOCATION, & PHYSICAL SUBMISSION
  {
    id: 'office_hours_location',
    keywords: [
      'opisina', 'location', 'address ng mswdo', 'saan ang munisipyo', 'office hours', 
      'anong oras bukas', 'may pasok ba', 'sabado', 'linggo', 'munisipyo', 'city hall'
    ],
    patterns: [
      /saan\s+ang\s+(opisina|munisipyo|mswdo)/i,
      /anong\s+oras\s+(bukas|ang\s+opisina)/i,
      /may\s+pasok\s+ba\s+(ng\s+)?(sabado|linggo|weekend)/i
    ],
    title: 'Oras ng Opisina at Lokasyon ng MSWDO',
    reply: `🏛️ **Oras ng Operasyon at Lokasyon ng MSWDO:**\n\n• **Oras ng Opisina:**\n  Lunes hanggang Biyernes: **8:00 AM – 5:00 PM** (Walang Noon Break)\n  *Sabado, Linggo, at Official Holidays:* Sarado ang opisina ngunit 24/7 na bukas ang online portal at AI Assistant.\n\n• **Lokasyon ng Opisina:**\n  Municipal Social Welfare and Development Office (MSWDO),\n  Ground Floor, Municipal Hall / Munisipyo.\n\n• **Barangay Help Desk:**\n  Maaari ding magtungo sa inyong Barangay Hall sa tanggapan ng Barangay Secretary o Barangay Health Worker (BHW).`,
    suggested: [
      'Mga opisyal na emergency hotline',
      'Paano magparehistro online?',
      'Requirements sa Medical Assistance'
    ]
  },

  // 24. EMERGENCY HOTLINES & OFFICIAL CONTACTS
  {
    id: 'hotlines_contacts',
    keywords: [
      'hotline', 'contact', 'telepono', 'tawag', 'tulong', 'dswd hotline', 
      'emergency number', 'red cross', '911', 'pulis', 'bumbero', 'mswdo phone'
    ],
    patterns: [
      /ano\s+ang\s+(hotline|numero|telepono)\s+ng\s+(dswd|mswdo|emergency)/i,
      /sino\s+ang\s+pwedeng\s+tawagan/i
    ],
    title: 'Mga Opisyal na Emergency Hotlines',
    reply: `📞 **Opisyal na Emergency & Assistance Hotlines:**\n\n• **DSWD Crisis Intervention Helpline:** \`16545\` (Libreng tawag sa cellphone at landline)\n• **DSWD Central Action Desk:** \`8931-8101 to 07\`\n• **National Emergency Helpline (Pulis, Bumbero, Rescue):** \`911\`\n• **Philippine Red Cross:** \`143\` o \`(02) 8790-2300\`\n• **National Center for Mental Health (NCMH Crisis):** \`1553\`\n• **LGU MSWDO Help Desk:** Makipag-ugnayan sa inyong Munisipyo Lunes hanggang Biyernes (8:00 AM - 5:00 PM).`,
    suggested: [
      'Paano mag-apply ng Medical Assistance?',
      'Requirements sa Burial Aid',
      'Saan makikita ang schedule ng ayuda?'
    ]
  },

  // 25. BENEFICIARY CATEGORIES & ELIGIBILITY (SENIOR, PWD, SOLO PARENT, 4PS, IPS)
  {
    id: 'eligibility_categories',
    keywords: [
      'sino ang kwalipikado', 'eligible', 'kwalipikado', 'category', 'kategorya', 
      'pwd aid', 'senior citizen ayuda', 'solo parent', 'indigent', '4ps', 'katutubo', 'ip'
    ],
    patterns: [
      /sino\s+(ang\s+)?(kwalipikado|pwede\s+makatanggap|pwedeng\s+sumali)/i,
      /pwede\s+ba\s+(ang\s+)?(senior|pwd|solo\s*parent|4ps|indigent)/i
    ],
    title: 'Mga Kwalipikadong Kategorya sa ilalim ng EBMS',
    reply: `👥 **Sino-sino ang Kwalipikadong Tumanggap ng Tulong sa EBMS?**\n\nAng system ay nagbibigay ng prayoridad sa mga sumusunod na sektor:\n1. **Senior Citizens (60 taong gulang pataas):** May Senior Citizen ID mula sa OSCA.\n2. **PWD (Persons with Disabilities):** May PWD ID o medical diagnosis mula sa doktor.\n3. **Solo Parents:** May Solo Parent ID o sertipikasyon mula sa LGU/MSWDO.\n4. **Indigent Families / Individuals:** Walang sapat na kita, may Barangay Certificate of Indigency.\n5. **4Ps Beneficiaries:** Rehistradong miyembro (kwalipikado para sa emergency o supplemental medical/burial assistance).\n6. **Farmers and Fisherfolk:** Nakatala sa RSBSA registry.\n7. **Katutubo (Indigenous Peoples - IP):** Mga miyembro ng kinikilalang katutubong pamayanan.`,
    suggested: [
      'Paano magparehistro sa system?',
      'Ano ang requirements sa Medical Assistance?',
      'Saan makikita ang aking QR code?'
    ]
  },

  // 26. 4PS BENEFICIARIES CLARIFICATION
  {
    id: 'four_ps_eligibility',
    keywords: [
      '4ps ako', 'pwede ba 4ps', 'makakakuha ba ang 4ps', 'kasali ba ang 4ps', 
      'member ng 4ps', 'pantawid pamilya'
    ],
    patterns: [
      /pwede\s+ba(ng)?\s+(ang\s+)?4ps/i,
      /makakakuha\s+ba\s+(ang\s+)?4ps/i
    ],
    title: 'Kwalipikasyon ng mga Miyembro ng 4Ps',
    reply: `🌾 **Paalala para sa mga Miyembro ng 4Ps:**\n\n• **Maaari bang magparehistro sa EBMS?** **OO!** Ang mga miyembro ng 4Ps ay maaaring magparehistro sa ilalim ng kategoryang "4Ps Beneficiary".\n• **Maaari bang mag-apply ng Medical o Burial Aid?** **OO!** Kung may biglaang krisis tulad ng hospitalization, chemotherapy, o pagkamatay ng kapamilya na lumalagpas sa regular na cash grant ng 4Ps, kwalipikado kayong magsumite ng request para sa AICS Assistance.\n• **Sa General Food Packs / Calamity Aid:** Kasama rin ang mga 4Ps sa relief assistance sa panahon ng sakuna at kalamidad.`,
    suggested: [
      'Requirements sa Medical Assistance',
      'Requirements sa Burial Assistance',
      'Paano magparehistro sa system?'
    ]
  },

  // 27. STAFF: ATTENDANCE SCANNER & EXPIRED ANNOUNCEMENTS
  {
    id: 'staff_scanner_policy',
    keywords: [
      'scanner', 'camera scanner', 'paano mag scan', 'rfid scanner', 
      'qr scanner', 'mag-scan ng qr', 'attendance scanner', 'staff scanner', 
      'bakit expired ang announcement', 'sarado ang attendance', 'hindi ma-open ang announcement'
    ],
    patterns: [
      /bakit\s+(expired|sarado)\s+(ang\s+)?(announcement|attendance)/i,
      /paano\s+(mag-?scan|gamitin\s+ang\s+scanner)/i,
      /ayaw\s+gumana\s+ng\s+(camera|scanner)/i
    ],
    title: 'Gabay sa Scanner at Patakaran sa Expired Announcements (Staff)',
    reply: `📷 **Gabay sa QR & RFID Scanner at Announcement Rules:**\n\n1. **Patakaran sa Expired Announcements:**\n   • Alinsunod sa patakaran ng sistema, ang mga anunsyo na lumipas na ang itinakdang petsa at oras ay awtomatikong minamarkahan na **[TAPOS NA / SARADO]**.\n   • **Hindi na mabubuksan ang mga ito para sa attendance** upang maiwasan ang late o maling pag-record ng datos.\n   • Ang mga kasalukuyan (**Current**) at paparating (**Incoming**) na anunsyo lamang ang maaaring buksan para sa scanning.\n\n2. **Paggamit ng Live Camera QR Scanner sa Mobile:**\n   • Pindutin ang **"📷 Buksan ang Camera QR Scanner"**.\n   • Payagan ang Camera Permission ng cellphone.\n   • Itapat ang camera sa QR pass ng benepisyaryo para sa awtomatikong pag-detect at vibration feedback.\n\n3. **USB RFID Reader sa Web:** Isaksak ang RFID scanner sa laptop at i-tap ang RFID card ng beneficiary.`,
    suggested: [
      'Saan makikita ng beneficiary ang QR code?',
      'Paano mag-export ng reports?',
      'Paano mag-record ng attendance?'
    ]
  },

  // 28. STAFF: TWO-TIER APPROVALS & REPORTS
  {
    id: 'staff_approvals_reports',
    keywords: [
      'paano mag approve', 'two tier approval', 'paano mag-export ng report', 
      'staff reports', 'paano mag-encode', 'staff dashboard', 'disbursement approval'
    ],
    patterns: [
      /paano\s+(mag-?approve|mag-?export)\s+(ng\s+)?(report|request)/i,
      /ano\s+ang\s+two\s*tier\s+approval/i
    ],
    title: 'Two-Tier Approval at Reports Module (Para sa Staff)',
    reply: `💼 **Gabay sa Staff Workflows (Approvals at Reports):**\n\n• **Two-Tier Approval Workflow para sa Assistance:**\n  1. **Tier 1 (Social Worker Verification):** Sinusuri ang in-upload na reseta, clinical abstract, o death cert. Nilalagyan ng endorsement at iminumungkahing halaga.\n  2. **Tier 2 (MSWDO Head Final Approval):** Sinusuri ang kabuuang badyet at nagbibigay ng pinal na apruba para sa disbursement.\n\n• **Staff Reports Screen:**\n  1. Pumunta sa **Reports** sa web o mobile staff dashboard.\n  2. Piliin ang Uri ng Ulat (*Benepisyaryo, Programa, Pagpapatala, Assistance, Attendance, Anunsyo*).\n  3. Gamitin ang filters ayon sa Programa, Barangay, at Petsa.\n  4. I-click ang **"I-export bilang CSV / Excel"** o i-print para sa opisyal na dokumentasyon.`,
    suggested: [
      'Gabay sa scanner ng staff',
      'Mga sakop na barangay sa system',
      'Paano magparehistro ng beneficiary?'
    ]
  },

  // 29. DATA PRIVACY & SECURITY
  {
    id: 'data_privacy',
    keywords: [
      'data privacy', 'privacy', 'ligtas ba ang impormasyon', 'seguridad ng datos', 
      'privacy policy', 'saan gagamitin ang picture', 'safe ba ang id ko'
    ],
    patterns: [
      /ligtas\s+ba\s+(ang\s+)?(impormasyon|datos|id|data)/i,
      /data\s+privacy/i
    ],
    title: 'Data Privacy at Proteksyon ng Impormasyon',
    reply: `🛡️ **Proteksyon ng Iyong Datos (Data Privacy Policy):**\n\n• Mahigpit na ipinapatupad ng EBMS ang **Republic Act No. 10173 (Data Privacy Act of 2012)**.\n• Ang lahat ng impormasyon, litrato ng Valid ID, medikal na rekord, at contact numbers ay naka-encrypt at protektado ng matataas na pamantayan sa seguridad.\n• **Saan gagamitin?** Gagamitin lamang ang mga ito ng LGU at DSWD para sa beripikasyon, lehitimong pamamahagi ng ayuda, at pag-iwas sa ghost beneficiaries.\n• **Hindi kailanman ibabahagi** o ibebenta ang inyong datos sa mga pribadong kompanya o ikatlong partido nang walang inyong pahintulot.`,
    suggested: [
      'Paano magparehistro sa system?',
      'Saan makikita ang aking QR code?',
      'Hotline ng MSWDO para sa katanungan'
    ]
  },

  // 30. DOCUMENT UPLOAD TROUBLESHOOTING
  {
    id: 'upload_troubleshooting',
    keywords: [
      'ayaw mag upload', 'error sa pag upload', 'malabo ang id', 'file size', 
      'format ng file', 'cannot upload', 'upload error', 'paano mag upload ng id'
    ],
    patterns: [
      /ayaw\s+(mag-?upload|tanggapin)\s+(ang\s+)?(id|file|dokumento|picture)/i,
      /anong\s+(format|size)\s+ng\s+(file|upload)/i
    ],
    title: 'Gabay sa Pag-upload ng Dokumento at Solusyon sa Error',
    reply: `📸 **Solusyon sa Pag-upload ng Dokumento at IDs:**\n\n1. **Mga Tinatanggap na Format:**\n   • JPG, JPEG, PNG, o PDF.\n2. **Limitasyon sa Laki ng File:**\n   • Hanggang **5MB** bawat litrato o dokumento.\n3. **Mga Tip para Mabilis Ma-approve:**\n   • Siguraduhing maliwanag ang ilaw at walang reflection o flash glare.\n   • Dapat malinaw na nababasa ang Buong Pangalan, Petsa ng Kapanganakan, Pirma, at ID Number.\n   • Sa mga reseta at clinical abstract, kailangang kitang-kita ang pirma at PRC License Number ng doktor.\n4. **Kung Nag-e-error ang Pag-upload:**\n   • I-crop ang litrato para mabawasan ang laki ng file, o i-refresh ang browser/app at subukang muli.`,
    suggested: [
      'Ano ang mga tinatanggap na Valid ID?',
      'Paano mag-apply ng assistance online?',
      'Saan makikita ang status ng application?'
    ]
  },

  // 31. COMPLAINTS & GRIEVANCE REDRESS (SUMBONG)
  {
    id: 'complaints_grievance',
    keywords: [
      'reklamo', 'sumbong', 'magreklamo', 'complaint', 'grievance', 'nangongotong', 
      'hindi binigyan ng ayuda', 'unfair', 'saan magsusumbong', 'reklamo sa barangay'
    ],
    patterns: [
      /saan\s+(magsusumbong|magre-?reklamo)/i,
      /may\s+reklamo\s+ako/i
    ],
    title: 'Grievance Redress at Paghahain ng Reklamo',
    reply: `⚖️ **Paghahain ng Reklamo o Sumbong ukol sa Ayuda:**\n\nKung mayroong iregularidad, hindi patas na pamamahagi, o paglabag:\n1. **MSWDO Grievance Desk:** Magtungo sa Tanggapan ng Social Welfare sa Munisipyo at humingi ng Grievance Intake Form.\n2. **Direct In-App Message:** Pumunta sa **"Messages"** tab sa iyong account at magpadala ng pormal na ulat sa Admin.\n3. **DSWD Action Center Hotline:** Tumawag sa \`16545\` o mag-email sa \`inquiry@dswd.gov.ph\`.\n4. **8888 Citizens' Complaint Center:** Tumawag sa \`8888\` para sa agarang aksyon ng pamahalaan.\n\n*Garantisadong protektado at kumpidensyal ang pagkakakilanlan ng nagrereklamo.*`,
    suggested: [
      'Mga opisyal na emergency hotline',
      'Oras ng opisina ng MSWDO',
      'Paano mag-chat sa social worker?'
    ]
  }
];

/**
 * Normalizes user text for robust NLP matching.
 * Cleans punctuation, handles colloquial Taglish shortcuts, and standardizes terms.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bpano\b/g, 'paano')
    .replace(/\bsan\b/g, 'saan')
    .replace(/\bkelan\b/g, 'kailan')
    .replace(/\bpede\b/g, 'pwede')
    .replace(/\bpedeng\b/g, 'pwedeng')
    .replace(/\bmeron\b/g, 'may')
    .replace(/\bmag\s*kano\b/g, 'magkano')
    .replace(/\bsched\b/g, 'schedule')
    .replace(/\breq\b/g, 'requirements')
    .replace(/\brequirments\b/g, 'requirements')
    .replace(/\brekwirements\b/g, 'requirements')
    .replace(/\bdokyumento\b/g, 'dokumento')
    .replace(/\basistance\b/g, 'assistance')
    .replace(/\bbenificiary\b/g, 'beneficiary')
    .replace(/\bbenepisyaryo\b/g, 'beneficiary');
}

/**
 * Intelligent Matcher Function
 * Matches using exact phrases, regular expressions, and weighted token scoring.
 */
function findBestMatch(userQuery) {
  const raw = userQuery.toLowerCase().trim();
  const normalized = normalizeText(userQuery);
  const words = normalized.split(' ').filter(w => w.length > 1);

  let bestMatch = null;
  let highestScore = 0;

  for (const item of SYSTEM_KNOWLEDGE_BASE) {
    let score = 0;

    // 1. Regex Pattern Match (Highest priority)
    if (item.patterns && item.patterns.length > 0) {
      for (const pattern of item.patterns) {
        if (pattern.test(raw) || pattern.test(normalized)) {
          score += 30;
          break;
        }
      }
    }

    // 2. Keyword & Multi-word phrase matching
    for (const kw of item.keywords) {
      const normKw = normalizeText(kw);
      if (raw === kw || normalized === normKw) {
        score += 25; // Exact full match
      } else if (normalized.includes(normKw)) {
        // Multi-word phrase match gives higher confidence
        score += normKw.split(' ').length > 1 ? 12 : 5;
      }
    }

    // 3. Token Overlap Score
    let tokenOverlap = 0;
    for (const kw of item.keywords) {
      const kwWords = normalizeText(kw).split(' ');
      for (const w of words) {
        if (kwWords.includes(w)) {
          tokenOverlap += 1;
        }
      }
    }
    score += Math.min(tokenOverlap * 2, 10);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  // Minimum threshold to prevent spurious false positives
  return highestScore >= 6 ? bestMatch : null;
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
    const normalizedQuery = normalizeText(query);

    // 1. DYNAMIC DATABASE LOOKUP: Beneficiary ID Code Search (e.g. BEN-2026-XXXX)
    const benCodeMatch = query.match(/BEN-?\d{4}-?\w+/i) || query.match(/BEN-\w+/i);
    if (benCodeMatch) {
      try {
        const searchedCode = benCodeMatch[0].toUpperCase();
        const beneficiary = await Beneficiary.findOne({
          where: {
            [Op.or]: [
              { beneficiary_id_code: searchedCode },
              { beneficiary_id_code: searchedCode.replace(/BEN(\d)/, 'BEN-$1') }
            ]
          },
          include: [{ model: Barangay, attributes: ['barangay_name'] }]
        });

        if (beneficiary) {
          const brgyName = beneficiary.Barangay ? beneficiary.Barangay.barangay_name : 'N/A';
          const rfidStatus = beneficiary.RFID_number ? 'May naka-link na RFID' : 'Walang RFID (QR code active)';
          return res.json({
            success: true,
            reply: `👤 **Impormasyon para sa Beneficiary Code: ${beneficiary.beneficiary_id_code || searchedCode}**\n\n• **Pangalan:** ${beneficiary.first_name} ${beneficiary.last_name}\n• **Barangay:** Brgy. ${brgyName}\n• **Katayuan (Status):** **${beneficiary.status}**\n• **Kategorya:** ${beneficiary.civil_status || 'Beneficiary'}\n• **RFID Status:** ${rfidStatus}\n\n*Kung may kailangan kang baguhin o i-update sa rekord na ito, pumunta sa Profile Settings o makipag-ugnayan sa MSWDO Staff.*`,
            suggestedQuestions: [
              'Saan makikita ang QR code ko?',
              'Paano mag-apply ng assistance online?',
              'Kailan ang schedule ng susunod na ayuda?'
            ]
          });
        }
      } catch (benErr) {
        console.warn('[Bot DB Beneficiary Code Lookup]:', benErr.message);
      }
    }

    // 2. DYNAMIC DATABASE LOOKUP: Schedule & Distribution Events
    const isExcludedFromSchedule = [
      'paano', 'pano', 'how', 'magkano', 'how much', 
      'representative', 'kinatawan', 'requirements', 'dokumento',
      'apply', 'senior', 'pwd', 'solo parent', 
      'medical', 'burial', 'educational', '4ps', 'rehistro', 'register'
    ].some(w => normalizedQuery.includes(w));

    const isScheduleIntent = (
      normalizedQuery.includes('schedule') || 
      normalizedQuery.includes('kailan ang ayuda') || 
      normalizedQuery.includes('kelan ang ayuda') || 
      normalizedQuery.includes('kailan ang distribution') || 
      normalizedQuery.includes('petsa ng distribution') || 
      normalizedQuery.includes('kailan marerelease') ||
      (normalizedQuery.includes('kailan') && normalizedQuery.includes('ayuda')) ||
      (normalizedQuery.includes('petsa') && normalizedQuery.includes('ayuda')) ||
      (normalizedQuery.includes('distribution') && !normalizedQuery.includes('scanner') && !normalizedQuery.includes('staff'))
    ) && !isExcludedFromSchedule;

    if (isScheduleIntent) {
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

    // 3. DYNAMIC DATABASE LOOKUP: Barangays covered
    if (
      normalizedQuery.includes('anong barangay') || 
      normalizedQuery.includes('mga barangay') || 
      normalizedQuery.includes('sakop na barangay') ||
      normalizedQuery.includes('sakop ng munisipyo')
    ) {
      try {
        const barangays = await Barangay.findAll({
          attributes: ['barangay_name', 'barangay_code', 'captain_name'],
          limit: 12,
          order: [['barangay_name', 'ASC']]
        });
        if (barangays && barangays.length > 0) {
          const bList = barangays.map(b => `• **Brgy. ${b.barangay_name}** (${b.barangay_code || 'LGU'})${b.captain_name ? ` - Kap. ${b.captain_name}` : ''}`).join('\n');
          return res.json({
            success: true,
            reply: `🏛️ **Mga Sakop na Barangay sa ilalim ng EBMS:**\n\n${bList}\n\n*Maaaring magtungo sa tanggapan ng iyong Barangay Hall para kumuha ng Certificate of Indigency para sa iyong ayuda application.*`,
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

    // 4. INTELLIGENT KNOWLEDGE BASE MATCHING
    const match = findBestMatch(query);
    if (match) {
      return res.json({
        success: true,
        reply: match.reply,
        suggestedQuestions: match.suggested
      });
    }

    // 5. INTELLIGENT FALLBACK with guided contextual options
    return res.json({
      success: true,
      reply: `Salamat sa iyong mensahe! Ako si **BeniAid Assistant** 🤖.\n\nUpang mabigyan kita ng pinakatumpak na gabay, maaari mong piliin ang isa sa mga sumusunod na paksa:\n\n1. 📱 **QR Code at RFID:** *"Saan makikita ang QR code ko?"*\n2. 🏥 **Assistance Requirements:** *"Requirements sa Medical"*, *"Burial aid"*, o *"Educational aid"*\n3. 📝 **Pag-apply Online:** *"Paano mag-apply ng assistance online?"*\n4. 📅 **Distribution Schedule:** *"Kailan ang schedule ng ayuda?"*\n5. 💰 **Payout Methods:** *"Paano matatanggap ang payout via GCash?"*\n6. 👥 **Kinatawan / Representative:** *"Pwede ba representative ang kumuha ng ayuda?"*\n\nPiliin ang isa sa mga mungkahi sa ibaba o mag-type ng mas partikular na katanungan:`,
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
