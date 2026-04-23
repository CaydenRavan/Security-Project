const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
require("dotenv").config();

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification requests. Please try again later." }
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTempToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      mfaPending: true
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function generateFinalToken(user) {
  return jwt.sign(
    {
      userId: user.userId || user.id,
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}


router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username.trim(), email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      [username.trim(), email.trim().toLowerCase(), passwordHash]
    );

    return res.status(201).json({ message: "Registration successful" });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required" });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE username = $1 OR email = $1",
      [identifier.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      return res.status(423).json({ message: "Account is temporarily locked" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      const failedCount = (user.failed_login_attempts || 0) + 1;

      if (failedCount >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          "UPDATE users SET failed_login_attempts = 0, lock_until = $1 WHERE id = $2",
          [lockUntil, user.id]
        );
        return res.status(423).json({ message: "Account temporarily locked due to failed login attempts" });
      }

      await pool.query(
        "UPDATE users SET failed_login_attempts = $1 WHERE id = $2",
        [failedCount, user.id]
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = $1",
      [user.id]
    );

    if (!user.mfa_enabled) {
      const token = generateFinalToken(user);
      return res.json({
        token,
        mfaRequired: false,
        message: "Login successful"
      });
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE",
      [user.id]
    );

    await pool.query(
      "INSERT INTO mfa_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, codeHash, expiresAt]
    );

    const recipient = user.mfa_email || user.email;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipient,
      subject: "Your one time verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes.`
    });

    const tempToken = generateTempToken(user);

    return res.json({
      mfaRequired: true,
      tempToken,
      message: "Verification code sent to email"
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/verify-mfa", verifyLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ message: "Verification code and temporary token are required" });
    }

    let decoded;

    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired verification session" });
    }

    if (!decoded.mfaPending) {
      return res.status(400).json({ message: "This session is not waiting for verification" });
    }

    const activeCodeResult = await pool.query(
      `SELECT * FROM mfa_codes
       WHERE user_id = $1 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [decoded.userId]
    );

    if (activeCodeResult.rows.length === 0) {
      return res.status(400).json({ message: "No active verification code found" });
    }

    const mfaRecord = activeCodeResult.rows[0];

    if (new Date(mfaRecord.expires_at) < new Date()) {
      await pool.query(
        "UPDATE mfa_codes SET used = TRUE WHERE id = $1",
        [mfaRecord.id]
      );
      return res.status(400).json({ message: "Verification code expired" });
    }

    if (mfaRecord.attempts >= 5) {
      return res.status(429).json({ message: "Too many incorrect verification attempts" });
    }

    const isMatch = await bcrypt.compare(code, mfaRecord.code_hash);

    if (!isMatch) {
      await pool.query(
        "UPDATE mfa_codes SET attempts = attempts + 1 WHERE id = $1",
        [mfaRecord.id]
      );
      return res.status(401).json({ message: "Invalid verification code" });
    }

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE id = $1",
      [mfaRecord.id]
    );

    const finalToken = generateFinalToken(decoded);

    return res.json({
      token: finalToken,
      message: "Multi factor authentication completed successfully"
    });
  } catch (error) {
    console.error("Verify MFA error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/resend-mfa-code", verifyLimiter, async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({ message: "Temporary token is required" });
    }

    let decoded;

    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired verification session" });
    }

    if (!decoded.mfaPending) {
      return res.status(400).json({ message: "This session is not waiting for verification" });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];
    const recipient = user.mfa_email || user.email;

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE",
      [user.id]
    );

    await pool.query(
      "INSERT INTO mfa_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, codeHash, expiresAt]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipient,
      subject: "Your new one time verification code",
      text: `Your new verification code is ${code}. It expires in 10 minutes.`
    });

    return res.json({
      message: "A new verification code has been sent to your email"
    });
  } catch (error) {
    console.error("Resend MFA code error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/resend-enable-mfa-code", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    if (!user.mfa_email) {
      return res.status(400).json({ message: "No verification email found for this user" });
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE",
      [decoded.userId]
    );

    await pool.query(
      "INSERT INTO mfa_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
      [decoded.userId, codeHash, expiresAt]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.mfa_email,
      subject: "Your new code to enable two factor authentication",
      text: `Your new verification code is ${code}. It expires in 10 minutes.`
    });

    return res.json({
      message: "A new code has been sent to your email"
    });
  } catch (error) {
    console.error("Resend enable MFA code error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});



router.post("/confirm-enable-mfa", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const codeResult = await pool.query(
      `SELECT * FROM mfa_codes
       WHERE user_id = $1 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [decoded.userId]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: "No active verification code found" });
    }

    const mfaRecord = codeResult.rows[0];

    if (new Date(mfaRecord.expires_at) < new Date()) {
      await pool.query(
        "UPDATE mfa_codes SET used = TRUE WHERE id = $1",
        [mfaRecord.id]
      );
      return res.status(400).json({ message: "Verification code expired" });
    }

    if (mfaRecord.attempts >= 5) {
      return res.status(429).json({ message: "Too many incorrect verification attempts" });
    }

    const isMatch = await bcrypt.compare(code, mfaRecord.code_hash);

    if (!isMatch) {
      await pool.query(
        "UPDATE mfa_codes SET attempts = attempts + 1 WHERE id = $1",
        [mfaRecord.id]
      );
      return res.status(401).json({ message: "Invalid verification code" });
    }

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE id = $1",
      [mfaRecord.id]
    );

    await pool.query(
      "UPDATE users SET mfa_enabled = TRUE WHERE id = $1",
      [decoded.userId]
    );

    return res.json({
      message: "Two factor authentication enabled successfully"
    });
  } catch (error) {
    console.error("Confirm enable MFA error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


router.post("/enable-mfa", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE users SET mfa_email = $1, mfa_enabled = FALSE WHERE id = $2",
      [cleanEmail, decoded.userId]
    );

    await pool.query(
      "UPDATE mfa_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE",
      [decoded.userId]
    );

    await pool.query(
      "INSERT INTO mfa_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
      [decoded.userId, codeHash, expiresAt]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: cleanEmail,
      subject: "Verify your email for two factor authentication",
      text: `Your verification code is ${code}. It expires in 10 minutes.`
    });

    return res.json({
      message: "Verification code sent. Enter the code to finish enabling two factor authentication."
    });
  } catch (error) {
    console.error("Enable MFA error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});



router.post("/disable-mfa", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query(
      "UPDATE users SET mfa_enabled = FALSE, mfa_email = NULL WHERE id = $1",
      [decoded.userId]
    );

    return res.json({ message: "Two factor authentication disabled successfully" });
  } catch (error) {
    console.error("Disable MFA error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
      "SELECT id, username, email, mfa_enabled, mfa_email, created_at FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(userResult.rows[0]);
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
