require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Step 1: Change column to VARCHAR to allow any value
  console.log('Step 1: Changing category column to VARCHAR...');
  await conn.query("ALTER TABLE beneficiaries MODIFY COLUMN category VARCHAR(255) NOT NULL");

  // Step 2: Update old category values to valid ENUM values
  console.log('Step 2: Updating old category values...');
  const [result] = await conn.query(
    "UPDATE beneficiaries SET category = '4Ps Household Beneficiaries' WHERE category NOT IN ('4Ps Household Beneficiaries', 'Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)')"
  );
  console.log('Rows updated:', result.affectedRows);

  // Step 3: Verify
  const [rows] = await conn.query('SELECT DISTINCT category FROM beneficiaries');
  console.log('Categories now:', rows);

  await conn.end();
  console.log('Done! You can now start the server.');
})();
