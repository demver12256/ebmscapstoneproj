require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

async function shuffleApprovalDates() {
  const beneficiaries = await sequelize.query(
    `SELECT id FROM beneficiaries
     WHERE status = 'Approved'
       AND (
         approval_date IN ('2026-11-25', '2026-11-26')
         OR approved_at LIKE '2026-11-25%' 
         OR approved_at LIKE '2026-11-26%'
       )
     ORDER BY id`,
    { type: QueryTypes.SELECT }
  );

  const dates = ['2026-11-08', '2026-11-09', '2026-11-10'];
  for (let i = dates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dates[i], dates[j]] = [dates[j], dates[i]];
  }

  for (let i = 0; i < beneficiaries.length; i++) {
    const date = dates[i % dates.length];
    await sequelize.query(
      'UPDATE beneficiaries SET approval_date = :date, approved_at = :approvedAt WHERE id = :id',
      { replacements: { date, approvedAt: `${date} 12:00:00`, id: beneficiaries[i].id } }
    );
  }

  console.log(`Updated approval dates for ${beneficiaries.length} approved beneficiaries.`);
}

shuffleApprovalDates()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
