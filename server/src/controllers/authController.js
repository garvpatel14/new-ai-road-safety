const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendPasswordResetEmail } = require('../config/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'saferoad_ai_super_secret_jwt_key_2026';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Register ────────────────────────────────────────────────────────────────

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `USR-${Date.now().toString().slice(-4)}`;

    const result = await db.query(
      `INSERT INTO users (id, name, email, password, role, status, reports_submitted)
       VALUES ($1, $2, $3, $4, 'user', 'Active', 0)
       RETURNING id, name, email, role, status, reports_submitted`,
      [userId, name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ message: 'User registered successfully', token, user });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 OR LOWER(TRIM(email)) = REPLACE($1, \'roadsafe.ai\', \'saferoad.ai\') OR LOWER(TRIM(email)) = REPLACE($1, \'saferoad.ai\', \'roadsafe.ai\')',
      [cleanEmail]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userData } = user;
    return res.json({ message: 'Login successful', token, user: userData });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

// ─── Get Profile ─────────────────────────────────────────────────────────────

const getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, status, reports_submitted, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Server error retrieving profile' });
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Please provide an email address' });
    }

    // Always return 200 to prevent user-enumeration attacks
    const genericResponse = {
      message: 'If that email is registered, a password reset link has been sent.',
    };

    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.json(genericResponse);
    }

    // Delete any existing tokens for this email first
    await db.query('DELETE FROM password_resets WHERE email = $1', [email]);

    // Generate a cryptographically-secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await db.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
      [email, token, expiresAt]
    );

    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;

    // Send email (non-blocking — don't fail the request if mail errors)
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (mailErr) {
      console.error('[Mailer] Failed to send reset email:', mailErr.message);
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Look up the token
    const tokenResult = await db.query(
      'SELECT * FROM password_resets WHERE token = $1',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const resetRecord = tokenResult.rows[0];

    // Check expiry
    if (new Date() > new Date(resetRecord.expires_at)) {
      await db.query('DELETE FROM password_resets WHERE token = $1', [token]);
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    // Hash and update the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [
      hashedPassword,
      resetRecord.email,
    ]);

    // Delete the used token
    await db.query('DELETE FROM password_resets WHERE token = $1', [token]);

    return res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

// ─── Update Profile ──────────────────────────────────────────────────────────

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if the new email is already taken by another user
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already in use by another account' });
    }

    const result = await db.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3
       RETURNING id, name, email, role, status, reports_submitted, avatar, created_at`,
      [name, email, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Server error updating profile' });
  }
};

// ─── Change Password ─────────────────────────────────────────────────────────

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Fetch user with password hash
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error changing password' });
  }
};

module.exports = { register, login, getProfile, updateProfile, changePassword, forgotPassword, resetPassword };
