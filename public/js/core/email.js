// Notification emails sent from the browser through EmailJS.
// EmailJS is loaded only when the first email is sent, so it never slows page loads.
// Every function resolves true/false and never throws; don't make the UI wait for it.
// (Password-recovery codes are sent by the server: functions/src/auth-recovery.js.)
import { escapeHtml } from './dom.js';
import { usingEmulators } from './firebase.js';

const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/+esm';
const PUBLIC_KEY = 'KA-6Zx9c2My5ohVje';
const SERVICE_ID = 'service_2qau4rv';
const NOTIFY_TEMPLATE_ID = 'template_vrjaw7d';
const SUPER_ADMIN_EMAIL = 'gabayan.superadmin@gmail.com';

let client = null;
function emailjs() {
  if (!client) {
    client = import(EMAILJS_URL).then((mod) => {
      const lib = mod.default || mod;
      lib.init({ publicKey: PUBLIC_KEY });
      return lib;
    });
  }
  return client;
}

// details: [['Office', 'Treasury'], ['Email', 'a@b.c']] -> escaped "Office: ...<br>Email: ..."
function detailLines(rows) {
  return rows.map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value || '-')}`).join('<br>');
}

export async function sendNotification({ toEmail, toName, subject, heading, statusTitle, statusColor, message, details = [] }) {
  if (!toEmail) return false;
  if (usingEmulators) {
    console.info('[email] (emulators: not sent)', subject, '->', toEmail);
    return true;
  }
  try {
    const lib = await emailjs();
    await lib.send(SERVICE_ID, NOTIFY_TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName || 'there',
      subject,
      heading,
      status_title: statusTitle,
      status_color: statusColor,
      status_message: message,
      details: Array.isArray(details) ? detailLines(details) : ''
    });
    return true;
  } catch (error) {
    console.error(`[email] failed to send "${subject}"`, error);
    return false;
  }
}

const REGISTRATION = {
  review: {
    subject: 'GaBayan Account Request - Under Review',
    title: 'Under Review',
    color: '#2057CE',
    message: 'We received your request to create an admin account. A Super Admin is reviewing it now. You will get another email once a decision is made.'
  },
  accepted: {
    subject: 'GaBayan Account Request - Approved',
    title: 'Approved',
    color: '#16A34A',
    message: 'Good news! Your admin account request has been approved. You can now sign in to GaBayan.'
  },
  rejected: {
    subject: 'GaBayan Account Request - Not Approved',
    title: 'Not Approved',
    color: '#DC2626',
    message: 'Unfortunately, your admin account request was not approved. Please contact your Super Admin if you think this is a mistake.'
  }
};

// Sign-up status email to the requesting admin (stage: review | accepted | rejected)
export function sendRegistrationEmail(toEmail, name, office, stage) {
  const content = REGISTRATION[stage];
  if (!content) return Promise.resolve(false);
  return sendNotification({
    toEmail,
    toName: name,
    subject: content.subject,
    heading: 'Admin Account Request',
    statusTitle: content.title,
    statusColor: content.color,
    message: content.message,
    details: [['Office', office], ['Email', toEmail]]
  });
}

export function notifySuperAdminNewRequest(requesterName, requesterEmail, office) {
  return sendNotification({
    toEmail: SUPER_ADMIN_EMAIL,
    toName: 'Super Admin',
    subject: 'GaBayan - New Admin Account Request',
    heading: 'New Admin Account Request',
    statusTitle: 'Needs Review',
    statusColor: '#2057CE',
    message: `${requesterName || 'Someone'} has requested an admin account. Please review the request in the Review Queue and approve or reject it.`,
    details: [['Name', requesterName], ['Email', requesterEmail], ['Office', office]]
  });
}

export function notifySuperAdminDeleteRequest(adminName, serviceName, office) {
  return sendNotification({
    toEmail: SUPER_ADMIN_EMAIL,
    toName: 'Super Admin',
    subject: 'GaBayan - Service Deletion Request',
    heading: 'Service Deletion Request',
    statusTitle: 'Needs Review',
    statusColor: '#2057CE',
    message: `${adminName || 'An admin'} has requested to delete a service. Please review the request in the Review Queue.`,
    details: [['Service', serviceName], ['Requested by', adminName], ['Office', office]]
  });
}

// Result of a Review Queue request, sent to the admin who asked.
export function sendRequestCompleted(toEmail, name, what, approved, details = []) {
  return sendNotification({
    toEmail,
    toName: name,
    subject: `GaBayan - Your ${what} request was ${approved ? 'approved' : 'not approved'}`,
    heading: 'Request Update',
    statusTitle: approved ? 'Approved' : 'Not Approved',
    statusColor: approved ? '#16A34A' : '#DC2626',
    message: approved
      ? `Your ${what} request has been approved and completed.`
      : `Your ${what} request was not approved. Please contact your Super Admin if you have questions.`,
    details
  });
}
