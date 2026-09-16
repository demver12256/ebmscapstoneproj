const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Announcement } = require('../db');

async function test() {
  const anns = await Announcement.findAll({ where: { id: [66, 67, 70, 73, 74] } });
  anns.forEach(a => {
    console.log(`ID ${a.id}: "${a.title}" | Venue: "${a.venue}" | Target Bgys: ${JSON.stringify(a.target_barangays)}`);
  });
}
test().then(() => process.exit(0)).catch(console.error);
