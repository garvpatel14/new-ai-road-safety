const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../src/config/db');

async function fixBlobImages() {
  try {
    const potholeImg = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80';
    const crackImg = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80';

    const result = await db.query(`
      UPDATE damage_reports
      SET image = CASE
        WHEN LOWER(type) LIKE '%crack%' THEN $1
        ELSE $2
      END
      WHERE image LIKE 'blob:%' OR image IS NULL OR TRIM(image) = ''
    `, [crackImg, potholeImg]);

    console.log(`Successfully fixed ${result.rowCount} reports with invalid blob image URLs.`);
  } catch (err) {
    console.error('Error fixing blob images:', err);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

fixBlobImages();
