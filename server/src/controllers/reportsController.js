const db = require('../config/db');

// Get all reports with optional PostGIS spatial radius & filters
const getAllReports = async (req, res) => {
  try {
    const { status, type, severity, lat, lng, radiusKm, search, reportedBy } = req.query;
    let queryText = `
      SELECT 
        r.id, r.type, r.severity, r.status, r.description, r.location_name as "locationName",
        r.lat, r.lng, r.date, r.time, r.image, r.reported_by as "reportedBy",
        r.ai_confidence as "aiConfidence", r.upvotes, r.depth_cm as "depthCm",
        r.width_cm as "widthCm", r.area_sq_m as "areaSqM", r.priority_score as "priorityScore",
        r.district, r.vehicles_involved as "vehiclesInvolved", r.created_at as "createdAt"
    `;

    // If spatial coordinates and radius provided, calculate distance in meters via PostGIS
    const hasSpatialFilter = lat && lng;
    if (hasSpatialFilter) {
      queryText += `, ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters `;
    }

    queryText += ` FROM damage_reports r WHERE 1=1 `;
    const params = [];

    if (hasSpatialFilter) {
      params.push(parseFloat(lng));
      params.push(parseFloat(lat));

      if (radiusKm) {
        const radiusMeters = parseFloat(radiusKm) * 1000;
        params.push(radiusMeters);
        queryText += ` AND ST_DWithin(r.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${params.length}) `;
      }
    }

    if (status === 'Active') {
      queryText += ` AND r.status != 'Resolved' `;
    } else if (status && status !== 'all' && status !== 'All') {
      params.push(status);
      queryText += ` AND r.status ILIKE $${params.length} `;
    }

    if (type && type !== 'all') {
      params.push(type);
      queryText += ` AND r.type ILIKE $${params.length} `;
    }

    if (severity && severity !== 'all') {
      params.push(severity);
      queryText += ` AND r.severity ILIKE $${params.length} `;
    }

    if (reportedBy && reportedBy !== 'all') {
      params.push(reportedBy);
      queryText += ` AND r.reported_by ILIKE $${params.length} `;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (r.description ILIKE $${params.length} OR r.location_name ILIKE $${params.length} OR r.id ILIKE $${params.length}) `;
    }

    if (hasSpatialFilter) {
      queryText += ` ORDER BY distance_meters ASC, r.created_at DESC `;
    } else {
      queryText += ` ORDER BY r.created_at DESC `;
    }

    const reportsResult = await db.query(queryText, params);
    const reports = reportsResult.rows;

    // Attach comments for each report
    for (const report of reports) {
      const commentsRes = await db.query(
        'SELECT id, user_name as "user", text, to_char(created_at, \'YYYY-MM-DD HH24:MI\') as "time" FROM report_comments WHERE report_id = $1 ORDER BY created_at ASC',
        [report.id]
      );
      report.comments = commentsRes.rows;
    }

    return res.json({
      count: reports.length,
      reports,
    });
  } catch (err) {
    console.error('Get reports error:', err);
    return res.status(500).json({ error: 'Failed to retrieve reports from database' });
  }
};

// Get single report by ID
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const reportRes = await db.query(
      `SELECT 
        id, type, severity, status, description, location_name as "locationName",
        lat, lng, date, time, image, reported_by as "reportedBy",
        ai_confidence as "aiConfidence", upvotes, depth_cm as "depthCm",
        width_cm as "widthCm", area_sq_m as "areaSqM", priority_score as "priorityScore",
        district, vehicles_involved as "vehiclesInvolved", created_at as "createdAt"
       FROM damage_reports WHERE id = $1`,
      [id]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportRes.rows[0];
    const commentsRes = await db.query(
      'SELECT id, user_name as "user", text, to_char(created_at, \'YYYY-MM-DD HH24:MI\') as "time" FROM report_comments WHERE report_id = $1 ORDER BY created_at ASC',
      [id]
    );
    report.comments = commentsRes.rows;

    return res.json({ report });
  } catch (err) {
    console.error('Get report by ID error:', err);
    return res.status(500).json({ error: 'Failed to retrieve report' });
  }
};

// Create new report with PostGIS Point geometry
const createReport = async (req, res) => {
  try {
    const {
      type, severity, description, locationName,
      lat, lng, image, reportedBy, aiConfidence,
      depthCm, widthCm, areaSqM, priorityScore, district,
      vehiclesInvolved
    } = req.body;

    const reportId = `REP-${Date.now().toString().slice(-4)}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const numericLat = parseFloat(lat) || 37.7749;
    const numericLng = parseFloat(lng) || -122.4194;

    const insertQuery = `
      INSERT INTO damage_reports (
        id, type, severity, status, description, location_name,
        lat, lng, geom, date, time, image, reported_by,
        ai_confidence, upvotes, depth_cm, width_cm, area_sq_m,
        priority_score, district, vehicles_involved
      )
      VALUES (
        $1, $2, $3, 'Pending', $4, $5,
        $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326), $8, $9, $10, $11,
        $12, 1, $13, $14, $15,
        $16, $17, $18
      )
      RETURNING *;
    `;

    const values = [
      reportId,
      type || 'Pothole',
      severity || 'Medium',
      description || 'Road surface hazard reported via SafeRoad AI',
      locationName || 'Geocoded Road Segment',
      numericLat,
      numericLng,
      dateStr,
      timeStr,
      image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
      reportedBy || 'Civilian Reporter',
      aiConfidence || '95%',
      parseFloat(depthCm) || 0,
      parseFloat(widthCm) || 0,
      parseFloat(areaSqM) || 0,
      parseInt(priorityScore, 10) || 60,
      district || 'City Zone',
      parseInt(vehiclesInvolved, 10) || 0,
    ];

    const result = await db.query(insertQuery, values);
    const createdReport = result.rows[0];

    // Add to verification queue automatically
    await db.query(`
      INSERT INTO verification_queue (id, report_id, type, ai_confidence, estimated_depth, estimated_area, officer_status, ai_flagged_severity, location, image, inspection_notes)
      VALUES ($1, $2, $3, $4, $5, $6, 'Pending Verification', $7, $8, $9, $10)
    `, [
      `VER-${Date.now().toString().slice(-3)}`,
      reportId,
      type || 'Pothole',
      0.95,
      `${depthCm || '10'} cm`,
      `${areaSqM || '0.2'} sq m`,
      severity || 'Medium',
      locationName || 'Road Location',
      image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
      'Citizen submitted report queued for municipal engineer verification.'
    ]);

    // Increment user reports_submitted counter
    if (reportedBy) {
      await db.query(
        'UPDATE users SET reports_submitted = COALESCE(reports_submitted, 0) + 1 WHERE name ILIKE $1',
        [reportedBy]
      ).catch(() => {});
    }

    // Create notification
    await db.query(`
      INSERT INTO notifications (id, title, message, time, type, read)
      VALUES ($1, $2, $3, 'Just now', 'system', false)
    `, [
      `NOT-${Date.now().toString().slice(-4)}`,
      'New Hazard Reported',
      `Hazard ${reportId} (${type}) was reported at ${locationName || 'your vicinity'}.`
    ]);

    return res.status(201).json({
      message: 'Damage report created successfully with PostGIS spatial geometry',
      report: createdReport,
    });
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ error: 'Failed to create report' });
  }
};

// Upvote a report
const upvoteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE damage_reports SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({ upvotes: result.rows[0].upvotes });
  } catch (err) {
    console.error('Upvote error:', err);
    return res.status(500).json({ error: 'Failed to upvote report' });
  }
};

// Add comment to a report
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, user } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const result = await db.query(
      `INSERT INTO report_comments (report_id, user_name, text)
       VALUES ($1, $2, $3)
       RETURNING id, user_name as "user", text, to_char(created_at, 'YYYY-MM-DD HH24:MI') as "time"`,
      [id, user || 'Community Member', text]
    );

    return res.status(201).json({ comment: result.rows[0] });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
};

// Update report status (admin or inspector)
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, severity, priorityScore } = req.body;

    const fields = [];
    const values = [];

    if (status) {
      values.push(status);
      fields.push(`status = $${values.length}`);
    }
    if (severity) {
      values.push(severity);
      fields.push(`severity = $${values.length}`);
    }
    if (priorityScore !== undefined) {
      values.push(priorityScore);
      fields.push(`priority_score = $${values.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE damage_reports SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({ report: result.rows[0] });
  } catch (err) {
    console.error('Update report error:', err);
    return res.status(500).json({ error: 'Failed to update report' });
  }
};

module.exports = {
  getAllReports,
  getReportById,
  createReport,
  upvoteReport,
  addComment,
  updateReportStatus,
};
