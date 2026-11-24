// adminAuth: "Forgot password" for admin accounts, checked entirely on the server.
// The code is generated here, stored only as a salted hash, expires after 5 minutes,
// allows 5 wrong tries, and can be re-sent once a minute. Ported from the mobile
// app's flow (DocsEase-MobileApplication/docsease/functions/index.js) but limited
// to active admin accounts and kept in its own collection.
const crypto = require("crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { db, Timestamp } = require("./lib/refs");
const { invalid, notFound, conflict, tooMany, unavailable } = require("./lib/errors");

const EMAILJS_PRIVATE_KEY = defineSecret("EMAILJS_PRIVATE_KEY");
const EMAILJS_SERVICE_ID = "service_2qau4rv";
const EMAILJS_TEMPLATE_ID = "template_fsgox73";
const EMAILJS_PUBLIC_KEY = "KA-6Zx9c2My5ohVje";

const RESET_COLLECTION = "admin_password_resets";
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;

// Same rule the login page shows: 8+ characters, an uppercase letter, a number and a symbol.
function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password needs an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password needs a number.";
  if (!/[^A-Za-z0-9\s]/.test(pw)) return "Password needs a symbol.";
  return null;
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();
const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const hashCode = (code, salt) => crypto.createHash("sha256").update(salt + String(code).trim()).digest("hex");

function safeEqualHex(a, b) {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function requireEmail(value) {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email)) throw invalid("Please enter a valid email address.");
  return email;
}

// The Auth user behind an email, only if it belongs to an active admin.
async function activeAdminByEmail(email) {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code === "auth/user-not-found") throw notFound("Email is not registered or invalid.");
    throw e;
  }
  const snap = await db().collection("admin").doc(user.uid).get();
  if (!snap.exists || (snap.data() || {}).status !== "active") throw notFound("Email is not registered or invalid.");
  return user;
}

async function emailCode(email, code) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    console.log(`[emulator] recovery code for ${email}: ${code}`);
    return;
  }
  let res;
  try {
    res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY.value(),
        template_params: { to_email: email, recovery_code: code }
      })
    });
  } catch (e) {
    console.error("EmailJS request failed:", e);
    throw unavailable("Could not reach the email service. Please try again.");
  }
  if (!res.ok) {
    console.error("EmailJS rejected the request:", res.status, await res.text());
    throw unavailable("Failed to send the verification code. Please try again.");
  }
}

// Checks a code without using it up. Wrong codes count toward the attempt limit.
async function checkCode(email, code) {
  const ref = db().collection(RESET_COLLECTION).doc(email);
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "expired" };
    const d = snap.data();
    if (d.expiresAt.toMillis() < Date.now()) {
      tx.delete(ref);
      return { ok: false, reason: "expired" };
    }
    if (safeEqualHex(hashCode(code, d.salt), d.codeHash)) return { ok: true };

    const attempts = (d.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      tx.delete(ref);
      return { ok: false, reason: "locked" };
    }
    tx.update(ref, { attempts });
    return { ok: false, reason: "wrong", attemptsLeft: MAX_ATTEMPTS - attempts };
  });

  if (result.ok) return ref;
  if (result.reason === "wrong") throw invalid("The code is incorrect.");
  if (result.reason === "locked") throw tooMany("Too many wrong attempts. Please request a new code.");
  throw conflict("Verification code has expired. Please resend code.");
}

async function sendRecoveryCode({ email: rawEmail }) {
  const email = requireEmail(rawEmail);
  await activeAdminByEmail(email);

  const ref = db().collection(RESET_COLLECTION).doc(email);
  const existing = await ref.get();
  if (existing.exists && existing.data().lastSentAt) {
    const waitMs = RESEND_COOLDOWN_MS - (Date.now() - existing.data().lastSentAt.toMillis());
    if (waitMs > 0) {
      const secs = Math.ceil(waitMs / 1000);
      throw tooMany(`Please wait ${secs} seconds before requesting another code.`, { retryAfterSeconds: secs });
    }
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const now = Date.now();
  await ref.set({
    codeHash: hashCode(code, salt),
    salt,
    attempts: 0,
    createdAt: Timestamp.fromMillis(now),
    lastSentAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS)
  });

  try {
    await emailCode(email, code);
  } catch (e) {
    await ref.delete();
    throw e;
  }
  return { ok: true, expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

async function verifyRecoveryCode({ email: rawEmail, code }) {
  const email = requireEmail(rawEmail);
  if (!code) throw invalid("Please enter the 6-digit code.");
  await checkCode(email, code);
  return { valid: true };
}

async function resetPasswordWithCode({ email: rawEmail, code, newPassword }) {
  const email = requireEmail(rawEmail);
  if (!code) throw invalid("Please enter the 6-digit code.");
  const problem = passwordProblem(newPassword);
  if (problem) throw invalid(problem);

  const ref = await checkCode(email, code);
  const user = await activeAdminByEmail(email);
  await admin.auth().updateUser(user.uid, { password: newPassword });
  await admin.auth().revokeRefreshTokens(user.uid); // sign out other sessions
  await ref.delete();
  return { success: true };
}

const ACTIONS = { sendRecoveryCode, verifyRecoveryCode, resetPasswordWithCode };

// Public (no sign-in needed): used by the login page's "Forgot password" screens.
exports.adminAuth = onCall({ secrets: [EMAILJS_PRIVATE_KEY] }, async (request) => {
  const { action, data } = request.data || {};
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!run) throw new HttpsError("invalid-argument", "Unknown action.");
  try {
    return await run(data || {});
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error(`adminAuth.${action} failed:`, error);
    throw new HttpsError("internal", "Something went wrong. Please try again.");
  }
});
