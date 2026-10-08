const db = require('../config/db');

// Get all Work Orders
const getWorkOrders = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, report_id as "reportId", title, crew_assigned as "crewAssigned",
        contractor, estimated_cost as "estimatedCost", status,
        start_date as "startDate", completion_target as "completionTarget",
        progress_pct as "progressPct", before_image as "beforeImage",
        after_image as "afterImage", created_at as "createdAt"
      FROM work_orders
      ORDER BY created_at DESC;
    `);

    return res.json({ workOrders: result.rows });
  } catch (err) {
    console.error('Get work orders error:', err);
    return res.status(500).json({ error: 'Failed to retrieve work orders' });
  }
};

// Create new Work Order
const createWorkOrder = async (req, res) => {
  try {
    const {
      reportId, title, crewAssigned, contractor,
      estimatedCost, startDate, completionTarget, beforeImage
    } = req.body;

    const id = `WO-${Date.now().toString().slice(-4)}`;

    const result = await db.query(`
      INSERT INTO work_orders (
        id, report_id, title, crew_assigned, contractor,
        estimated_cost, status, start_date, completion_target,
        progress_pct, before_image
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Scheduled', $7, $8, 0, $9)
      RETURNING *;
    `, [
      id, reportId, title, crewAssigned, contractor,
      estimatedCost, startDate, completionTarget, beforeImage
    ]);

    // Update the associated damage report status to 'Scheduled'
    if (reportId) {
      await db.query("UPDATE damage_reports SET status = 'Scheduled' WHERE id = $1", [reportId]);
    }

    return res.status(201).json({ workOrder: result.rows[0] });
  } catch (err) {
    console.error('Create work order error:', err);
    return res.status(500).json({ error: 'Failed to create work order' });
  }
};

// Update Work Order status or progress
const updateWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progressPct, afterImage } = req.body;

    const fields = [];
    const values = [];

    if (status) {
      values.push(status);
      fields.push(`status = $${values.length}`);
    }
    if (progressPct !== undefined) {
      values.push(progressPct);
      fields.push(`progress_pct = $${values.length}`);
    }
    if (afterImage) {
      values.push(afterImage);
      fields.push(`after_image = $${values.length}`);
    }

    values.push(id);
    const query = `UPDATE work_orders SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const updated = result.rows[0];
    if (updated.status === 'Completed' && updated.report_id) {
      await db.query("UPDATE damage_reports SET status = 'Resolved' WHERE id = $1", [updated.report_id]);
    }

    return res.json({ workOrder: updated });
  } catch (err) {
    console.error('Update work order error:', err);
    return res.status(500).json({ error: 'Failed to update work order' });
  }
};

// Get Verification Queue
const getVerificationQueue = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, report_id as "reportId", type, ai_confidence as "aiConfidence",
        estimated_depth as "estimatedDepth", estimated_area as "estimatedArea",
        officer_status as "officerStatus", ai_flagged_severity as "aiFlaggedSeverity",
        location, image, inspection_notes as "inspectionNotes",
        created_at as "createdAt"
      FROM verification_queue
      ORDER BY created_at DESC;
    `);

    return res.json({ queue: result.rows });
  } catch (err) {
    console.error('Get verification queue error:', err);
    return res.status(500).json({ error: 'Failed to retrieve verification queue' });
  }
};

// Verify or reject report in verification queue
const verifyQueueItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, officerStatus, inspectionNotes } = req.body; // action: 'approve' | 'reject' | 'escalate'

    let newStatus = officerStatus || (action === 'approve' ? 'Verified & Queued' : 'Rejected');

    const result = await db.query(`
      UPDATE verification_queue
      SET officer_status = $1, inspection_notes = COALESCE($2, inspection_notes)
      WHERE id = $3
      RETURNING *;
    `, [newStatus, inspectionNotes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    const item = result.rows[0];
    if (action === 'approve' && item.report_id) {
      await db.query("UPDATE damage_reports SET status = 'Under Review' WHERE id = $1", [item.report_id]);
    }

    return res.json({ item });
  } catch (err) {
    console.error('Verify item error:', err);
  }
};

// Get all registered users for Admin User Management
const getUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, name, email, role, status,
        COALESCE(reports_submitted, 0) as "reportsSubmitted",
        avatar, created_at as "createdAt"
      FROM users
      ORDER BY created_at DESC;
    `);
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, status, reports_submitted as "reportsSubmitted"',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
};

module.exports = {
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  getVerificationQueue,
  verifyQueueItem,
  getUsers,
  updateUserRole,
};
