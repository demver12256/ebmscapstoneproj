const express = require('express');
const { BenefitProgram, DistributionEvent, Announcement, Barangay } = require('../db');
const { Op } = require('sequelize');

const router = express.Router();

// Smart Knowledge Base and NLP-pattern matcher
const FAQ_KNOWLEDGE_BASE = [
  {
    topics: ['qr', 'qr code', 'barcode', 'saan makikita ang qr', 'my qr', 'view qr', 'scan'],
    reply_tl: '📱 **Saan makikita ang iyong QR Code?**\n\n1. Pumunta sa iyong **Profile** o **My Benefits / ID** page sa web o mobile app.\n2. Makikita mo roon ang iyong **Personal QR Code** na may Beneficiary ID.\n3. Maaari mo itong i-screenshot o i-save sa cellphone, o ipakita tuwing may distribution at attendance scanning.\n\n*Paalala: Huwag ibahagi ang iyong QR code sa ibang tao para sa iyong seguridad.*',
    reply_en: '📱 **Where to find your Beneficiary QR Code?**\n\n1. Go to your **Profile** or **My Benefits / ID** page in the web portal or mobile app.\n2. You will find your unique **Personal QR Code** with your Beneficiary ID.\n3. You can save or take a screenshot of it to present during distribution and attendance scanning.',
    suggested: [
      'Paano mag-scan ng QR code sa payout?',
      'Ano ang gamit ng RFID card?',
      'Saan makikita ang schedule ng ayuda?'
    ]
  },
  {
    topics: ['medical', 'gamot', 'hospital', 'pagpapagamot', 'laboratory', 'dialysis', 'chemo', 'medicine'],
    reply_tl: '🏥 **Medical Assistance (AICS / BeniAid):**\n\nNagbibigay ang EBMS/DSWD ng tulong pinansyal para sa gamot, operasyon, laboratory, at ospital.\n\n📋 **Mga Pangunahing Requirements:**\n1. **Barangay Certificate of Indigency** (para sa pasyente/kamag-anak)\n2. **Medical Certificate / Clinical Abstract** (may pirma at PRC number ng doktor, hindi lalampas sa 3 buwan)\n3. **Hospital Bill / Statement of Account** o **Prescription / Reseta** na may presyo\n4. **Valid Government ID** ng pasyente at ng maglalakad\n5. **Proof of Relationship** (kung kamag-anak ang nag-aapply tulad ng Marriage Contract o Birth Certificate)\n\nMaaari kang mag-submit online sa **Request Assistance > Medical Assistance**.',
    reply_en: '🏥 **Medical Assistance (AICS / BeniAid):**\n\nFinancial assistance is available for medicines, hospitalization, and laboratory tests.\n\n📋 **Key Requirements:**\n1. **Barangay Certificate of Indigency**\n2. **Medical Certificate / Clinical Abstract** (signed by doctor, issued within 3 months)\n3. **Hospital Bill / Statement of Account** or **Prescription** with quotation\n4. **Valid ID** of patient and representative\n5. **Proof of Relationship** (Birth/Marriage Certificate if representative)\n\nYou can apply directly via **Request Assistance > Medical Assistance**.',
    suggested: [
      'Paano mag-submit ng online application?',
      'Gaano katagal ma-approve ang assistance?',
      'Ano ang requirements sa burial assistance?'
    ]
  },
  {
    topics: ['burial', 'libing', 'patay', 'burol', 'kabaong', 'funeral'],
    reply_tl: '⚰️ **Burial / Funeral Assistance:**\n\nTulong pinansyal para sa gastusin sa burol at pagpapalibing ng yumaong kapamilya.\n\n📋 **Mga Requirements:**\n1. **Death Certificate** ng namatay (may certified true copy o registered seal)\n2. **Funeral Contract** o resibo ng serbisyo sa punerarya\n3. **Barangay Certificate of Indigency**\n4. **Valid ID** ng naglalakad (kamag-anak)\n5. **Birth Certificate o Marriage Certificate** bilang katunayan ng relasyon sa yumao.',
    reply_en: '⚰️ **Burial / Funeral Assistance:**\n\nFinancial help for funeral and burial expenses of a deceased family member.\n\n📋 **Requirements:**\n1. **Registered Death Certificate**\n2. **Funeral Contract** / billing statement from funeral home\n3. **Barangay Certificate of Indigency**\n4. **Valid ID** of the applicant / claimant\n5. **Proof of Relationship** (Marriage Contract or Birth Certificate).',
    suggested: [
      'Paano mag-apply ng assistance online?',
      'May cash payout ba o digital transfer?',
      'Saan makikita ang aking applications?'
    ]
  },
  {
    topics: ['educational', 'school', 'tuition', 'estudyante', 'baon', 'gamit sa eskwela', 'scholarship', 'student'],
    reply_tl: '🎓 **Educational Assistance:**\n\nTulong sa mga mag-aaral para sa matrikula, school supplies, at gastusin sa edukasyon.\n\n📋 **Mga Requirements:**\n1. **Certificate of Enrollment / Registration Form** para sa kasalukuyang school year\n2. **Valid Student ID**\n3. **Barangay Certificate of Indigency** ng magulang o guardian\n4. **Valid ID** ng magulang o guardian\n5. **Statement of Account** (kung may tuition fee).',
    reply_en: '🎓 **Educational Assistance:**\n\nAid for students in need for school supplies, books, and educational fees.\n\n📋 **Requirements:**\n1. **Certificate of Enrollment / Registration Form** for current term\n2. **Valid Student ID**\n3. **Barangay Certificate of Indigency** of parent/guardian\n4. **Valid ID** of parent/guardian.',
    suggested: [
      'Paano mag-apply ng assistance?',
      'Ano ang requirements sa AICS?',
      'Saan makikita ang schedule ng payout?'
    ]
  },
  {
    topics: ['apply', 'mag-apply', 'mag apply', 'paano mag apply', 'application', 'magsumite', 'submit'],
    reply_tl: '📝 **Paano Mag-apply para sa Assistance sa EBMS?**\n\n1. Mag-login sa iyong account gamit ang iyong email/password o **Google Sign-In**.\n2. Pumunta sa menu na **"Assistance"** o **"Request Assistance"**.\n3. Piliin ang kategorya: Halimbawa, *Medical*, *Burial*, *Educational*, o *Emergency*.\n4. I-type ang detalye at i-upload ang malilinaw na litrato ng mga dokumento.\n5. Pindutin ang **Submit Application**.\n6. Maaari mong subaybayan ang estado sa **"My Applications"** tab (Pending, Under Review, Approved, o Released).',
    reply_en: '📝 **How to Apply for Assistance in EBMS:**\n\n1. Log in to your account with your credentials or Google Sign-In.\n2. Navigate to **"Assistance"** or **"Request Assistance"**.\n3. Choose your category: *Medical*, *Burial*, *Educational*, or *Emergency Relief*.\n4. Fill in the required fields and attach clear photos/PDFs of your documents.\n5. Click **Submit Application**.\n6. Track real-time progress under **"My Applications"**.',
    suggested: [
      'Ano ang requirements para sa Medical Assistance?',
      'Gaano katagal bago ma-release ang ayuda?',
      'Saan makikita ang QR code ko?'
    ]
  },
  {
    topics: ['rfid', 'rfid card', 'tap', 'card', 'id card'],
    reply_tl: '💳 **Tungkol sa RFID Card ng Beneficiary:**\n\n- Ang iyong **RFID Card** ay ginagamit para sa contactless attendance at verification tuwing may distribution o payout.\n- Itinatapat lamang ito sa RFID reader scanner ng staff para agad ma-verify ang iyong identity at ma-mark na **Present / Claimed**.\n- Kung wala ka pang RFID card, maaari pa ring gamitin ang iyong **Personal QR Code** sa cellphone pantapat sa scanner!',
    reply_en: '💳 **About Beneficiary RFID Cards:**\n\n- Your **RFID Card** allows fast, contactless attendance tracking and claim verification during distribution events.\n- Simply tap the card against the staff scanner.\n- If you don\'t have a physical RFID card yet, you can use your **Personal QR Code** on your phone screen!',
    suggested: [
      'Saan makikita ang QR code ko?',
      'Saan makikita ang attendance history ko?',
      'Kailan ang susunod na ayuda distribution?'
    ]
  },
  {
    topics: ['payout', 'pera', 'gcash', 'landbank', 'maya', 'cash', 'kuha ng pera', 'claimed'],
    reply_tl: '💰 **Mga Paraan ng Payout:**\n\nNag-aalok ang EBMS ng dalawang paraan ng pagtanggap ng tulong:\n1. **Digital Payout:** Direktang papasok sa iyong **GCash**, **Maya**, o **Landbank** account. Siguraduhing na-update mo ang iyong payout account number sa iyong Profile.\n2. **Cash Over-the-Counter / On-site:** Ibibigay sa designated distribution venue sa araw ng payout gamit ang iyong QR code o RFID card.',
    reply_en: '💰 **Payout Methods:**\n\n1. **Digital Payout:** Direct disbursement to your **GCash**, **Maya**, or **Landbank** account. Keep your account info updated in your Profile.\n2. **Cash Over-the-Counter:** Claimed at the scheduled venue during distribution using your QR code or RFID card.',
    suggested: [
      'Paano i-update ang GCash account ko?',
      'Kailan ang susunod na schedule ng ayuda?',
      'Saan makikita ang aking claim status?'
    ]
  },
  {
    topics: ['hotline', 'contact', 'telepono', 'tawag', 'tulong', 'dswd hotline', 'emergency'],
    reply_tl: '📞 **Emergency & Helpdesk Hotlines:**\n\n- **DSWD Crisis Hotline:** `16545` (Nationwide toll-free)\n- **DSWD Agency Action Center:** `8931-8101 to 07`\n- **National Emergency:** `911`\n- **EBMS Local Office:** Makipag-ugnayan sa iyong Barangay Hall o MSWDO Office sa munisipyo.\n- **In-App Messaging:** Maaari ka ring magpadala ng mensahe sa admin/staff sa ilalim ng **Messages** menu.',
    reply_en: '📞 **Emergency & Helpdesk Hotlines:**\n\n- **DSWD Crisis Hotline:** `16545` (Nationwide toll-free)\n- **DSWD Action Center:** `8931-8101 to 07`\n- **National Emergency:** `911`\n- **EBMS Local Office:** Contact your Barangay Hall or municipal MSWDO desk.\n- **In-App Messages:** Message city social workers directly under **Messages**.',
    suggested: [
      'Paano mag-apply ng medical assistance?',
      'Ano ang requirements sa burial assistance?',
      'Saan makikita ang schedule ng distribution?'
    ]
  }
];

// POST /api/bot/chat
router.post('/chat', async (req, res) => {
  try {
    const { message = '', language = 'auto' } = req.body;
    const query = String(message).trim().toLowerCase();

    if (!query) {
      return res.json({
        success: true,
        reply: 'Kumusta! Ako si **BeniAid Assistant** 🤖. Paano kita matutulungan ngayon? Maaari kang magtanong tungkol sa:\n\n• Mga requirements sa Medical, Burial, o Educational assistance\n• Paano kunin o gamitin ang QR Code at RFID\n• Schedule ng ayuda at distribution\n• Paano mag-apply online sa EBMS',
        suggestedQuestions: [
          'Saan makikita ang QR code ko?',
          'Ano ang requirements sa Medical Assistance?',
          'Kailan ang susunod na distribution ng ayuda?',
          'Paano mag-apply ng assistance?'
        ]
      });
    }

    // 1. Check for live schedule / distribution / program inquiries from the DB
    const isScheduleQuery = ['schedule', 'kailan', 'kelan', 'oras', 'petsa', 'distribution', 'event', 'ayuda', 'program'].some(k => query.includes(k));
    if (isScheduleQuery && (query.includes('schedule') || query.includes('ayuda') || query.includes('distribution') || query.includes('kailan') || query.includes('kelan') || query.includes('susunod'))) {
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
            const dateStr = e.distribution_date ? new Date(e.distribution_date).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Petsa iaanunsyo';
            return `📅 **${e.name || 'Distribution Event'}**\n   • Petsa: ${dateStr}\n   • Lokasyon: ${e.location || 'Barangay Venue'}\n   • Status: ${e.status}`;
          }).join('\n\n');

          return res.json({
            success: true,
            reply: `📢 **Mga Kasalukuyang Schedule ng Distribution:**\n\n${eventList}\n\n*Paalala: Dalhin ang iyong QR Code o RFID Card at 1 valid ID sa venue.*`,
            suggestedQuestions: [
              'Saan makikita ang QR code ko?',
              'Paano mag-check ng attendance?',
              'Ano ang requirements para makasama sa ayuda?'
            ]
          });
        } else if (activePrograms && activePrograms.length > 0) {
          let progList = activePrograms.map(p => `• **${p.name}** (${p.type || 'Financial/Aid'})`).join('\n');
          return res.json({
            success: true,
            reply: `ℹ️ **Mga Aktibong Programa sa EBMS:**\n\n${progList}\n\nSa ngayon, wala pang bagong scheduled distribution date na naka-post. Abangan ang mga anunsyo sa **Announcements** page o mag-text sa hotline para sa updates.`,
            suggestedQuestions: [
              'Ano ang requirements sa Medical Assistance?',
              'Paano mag-apply ng assistance?',
              'Saan makikita ang QR code ko?'
            ]
          });
        }
      } catch (dbErr) {
        console.warn('[Bot DB Lookup]:', dbErr.message);
      }
    }

    // 2. Match with FAQ Knowledge Base
    for (const faq of FAQ_KNOWLEDGE_BASE) {
      const matched = faq.topics.some(t => query.includes(t));
      if (matched) {
        return res.json({
          success: true,
          reply: faq.reply_tl,
          suggestedQuestions: faq.suggested
        });
      }
    }

    // 3. Fallback with helpful assistance guidance
    return res.json({
      success: true,
      reply: 'Salamat sa iyong mensahe! Ako si **BeniAid Bot** 🤖.\n\nNarito ang mga maaari kong masagot agad para sa iyo:\n\n1. **Mga Ayuda & Assistance:** I-type halimbawa ang *"Requirements sa Medical"*, *"Burial assistance"*, o *"Educational aid"*.\n2. **QR Code at RFID:** I-type ang *"Saan makikita ang QR code?"* para sa gabay sa iyong digital pass.\n3. **Schedule & Announcements:** I-type ang *"Schedule ng ayuda"* para sa pinakabagong distribution dates.\n4. **Application:** I-type ang *"Paano mag-apply"* para sa step-by-step tutorial.\n\nPumili sa mga mungkahi sa ibaba o mag-type ng iyong katanungan:',
      suggestedQuestions: [
        'Saan makikita ang QR code ko?',
        'Ano ang requirements sa Medical Assistance?',
        'Kailan ang schedule ng susunod na ayuda?',
        'Paano mag-apply ng assistance online?'
      ]
    });

  } catch (error) {
    console.error('[Bot Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Nagkaroon ng aberya sa bot service. Pakisubukang muli.',
      reply: 'Paumanhin, nagkaroon ng kaunting problema. Pakisubukan muli o magpadala ng mensahe sa Admin.'
    });
  }
});

module.exports = router;
