// Fix RQI segments to use Anand, Gujarat coordinates
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'garvpatel@14',
  database: process.env.DB_NAME || 'saferoad_db',
});

async function fixRqiSegments() {
  const client = await pool.connect();
  try {
    const updates = [
      { id: 'RQI-1', name: 'Station Road to Nana Bazar Corridor', rqi_score: 36, status: 'Poor', lat1: 22.5606, lng1: 72.9575, lat2: 22.5595, lng2: 72.9460 },
      { id: 'RQI-2', name: 'Amul Dairy Industrial Highway', rqi_score: 48, status: 'Fair', lat1: 22.5535, lng1: 72.9515, lat2: 22.5400, lng2: 72.9320 },
      { id: 'RQI-3', name: '100 Feet Bypass Ring Road', rqi_score: 94, status: 'Good', lat1: 22.5690, lng1: 72.9350, lat2: 22.5580, lng2: 72.9260 },
      { id: 'RQI-4', name: 'Vidyanagar Education Corridor', rqi_score: 88, status: 'Good', lat1: 22.5580, lng1: 72.9260, lat2: 22.5528, lng2: 72.9242 },
      { id: 'RQI-5', name: 'Karamsad Heritage Boulevard', rqi_score: 62, status: 'Fair', lat1: 22.5528, lng1: 72.9242, lat2: 22.5475, lng2: 72.8988 },
    ];

    for (const seg of updates) {
      await client.query(`
        UPDATE rqi_segments
        SET name=$1, rqi_score=$2, status=$3,
            lat1=$4, lng1=$5, lat2=$6, lng2=$7,
            geom=ST_SetSRID(ST_MakeLine(ST_MakePoint($5, $4), ST_MakePoint($7, $6)), 4326)
        WHERE id=$8
      `, [seg.name, seg.rqi_score, seg.status, seg.lat1, seg.lng1, seg.lat2, seg.lng2, seg.id]);
      console.log(`✅ Updated ${seg.id}: ${seg.name}`);
    }
    console.log('All RQI segments updated to Anand, Gujarat coordinates.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRqiSegments();
