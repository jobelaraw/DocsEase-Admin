import emailjs from 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/+esm';

//Settings 
const EMAILJS_PUBLIC_KEY = 'KA-6Zx9c2My5ohVje';
const SERVICE_ID = 'service_2qau4rv';        
const OTP_TEMPLATE_ID = 'template_fsgox73';    
const NOTIFY_TEMPLATE_ID = 'template_vrjaw7d'; 
const SUPER_ADMIN_EMAIL = 'gabayan.superadmin@gmail.com';

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

//Recovery code 
export function sendRecoveryCode(toEmail, recoveryCode) {
  return emailjs.send(SERVICE_ID, OTP_TEMPLATE_ID, {
    to_email: toEmail,
    recovery_code: recoveryCode
  });
}

//Generic notification
export async function sendNotification({ toEmail, toName, subject, heading, statusTitle, statusColor, message, details }) {
  if (!toEmail) return false;
  try {
    await emailjs.send(SERVICE_ID, NOTIFY_TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName || 'there',
      subject,
      heading,
      status_title: statusTitle,
      status_color: statusColor,
      status_message: message,
      details: details || ''
    });
    return true;
  } catch (err) {
    console.error('[email-service] failed to send "' + subject + '"', err);
    return false;
  }
}

//Sign-up / registration (sent to the admin)
export function sendRegistrationEmail(toEmail, name, office, stage) {
  const content = {
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
  }[stage];
  if (!content) return Promise.resolve(false);

  return sendNotification({
    toEmail,
    toName: name,
    subject: content.subject,
    heading: 'Admin Account Request',
    statusTitle: content.title,
    statusColor: content.color,
    message: content.message,
    details: 'Office: ' + (office || '-') + '<br>Email: ' + toEmail
  });
}

//New admin request (sent to the super admin)
export function notifySuperAdminNewRequest(requesterName, requesterEmail, office) {
  return sendNotification({
    toEmail: SUPER_ADMIN_EMAIL,
    toName: 'Super Admin',
    subject: 'GaBayan - New Admin Account Request',
    heading: 'New Admin Account Request',
    statusTitle: 'Needs Review',
    statusColor: '#2057CE',
    message: (requesterName || 'Someone') + ' has requested an admin account. Please review the request in the Pending Review page and approve or reject it.',
    details: 'Name: ' + (requesterName || '-') + '<br>Email: ' + (requesterEmail || '-') + '<br>Office: ' + (office || '-')
  });
}

//Delete service request (sent to the super admin)
export function notifySuperAdminDeleteRequest(adminName, serviceName, office) {
  return sendNotification({
    toEmail: SUPER_ADMIN_EMAIL,
    toName: 'Super Admin',
    subject: 'GaBayan - Service Deletion Request',
    heading: 'Service Deletion Request',
    statusTitle: 'Needs Review',
    statusColor: '#2057CE',
    message: (adminName || 'An admin') + ' has requested to delete a service. Please review the request in the Pending Review page.',
    details: 'Service: ' + (serviceName || '-') + '<br>Requested by: ' + (adminName || '-') + '<br>Office: ' + (office || '-')
  });
}

// Request completed (sent to the admin)
export function sendRequestCompleted(toEmail, name, what, approved, details) {
  return sendNotification({
    toEmail,
    toName: name,
    subject: 'GaBayan - Your ' + what + ' request was ' + (approved ? 'approved' : 'not approved'),
    heading: 'Request Update',
    statusTitle: approved ? 'Approved' : 'Not Approved',
    statusColor: approved ? '#16A34A' : '#DC2626',
    message: approved
      ? 'Your ' + what + ' request has been approved and completed.'
      : 'Your ' + what + ' request was not approved. Please contact your Super Admin if you have questions.',
    details: details || ''
  });
}