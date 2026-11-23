// js/components/admin-legal-content.js
//
// DRAFT TEXT for the GaBayan WEB ADMIN (administrators), separate from the
// citizen app text. Have your legal counsel / privacy contact review it
// before release. If the portal's data practices change, update the text AND
// bump `version`.
//
// BLANKS YOU MUST FILL IN (use the same values as legal_content.dart):
//   effectiveDate, operatorName, contactEmail

const version = '1.0';
const effectiveDate = 'November 01, 2026';
const operatorName = 'GaBayan Team';
const contactEmail = 'gabayan.noreply@gmail.com';

const charter =
  "2026 Citizen's Charter (1st Edition) of the City Government of Biñan, Laguna";

export const ADMIN_LEGAL = {
  version,
  effectiveDate,
  operatorName,
  contactEmail,

  // ---------------------------------------------------------------------------
  // TERMS & CONDITIONS
  // ---------------------------------------------------------------------------
  termsIntro:
    'Please read these Terms & Conditions carefully. By creating an ' +
    'administrator account, you agree to be bound by them.',

  terms: [
    {
      heading: 'About the Web Admin',
      body:
        'The GaBayan web admin is used by authorized staff to add and manage ' +
        'offices and services, review requests and send notifications to ' +
        'GaBayan app users. It is for official work related to GaBayan only.',
    },
    {
      heading: 'Account Approval and Roles',
      body:
        'New administrator accounts are reviewed by the Super Admin and ' +
        'cannot sign in until approved. What you can do depends on your ' +
        'office and role. Some actions, such as deleting a service, may need ' +
        'the approval of the Super Admin. The Super Admin may approve, ' +
        'change, deactivate, reactivate or remove any administrator account.',
    },
    {
      heading: 'Accuracy of Published Content',
      body:
        `Information you publish must be accurate and based on the ${charter} ` +
        'or an official issuance of the concerned office. Check requirements, ' +
        'fees, processing times, persons in charge and office locations ' +
        'before saving. Citizens rely on this information, so correct or ' +
        'remove outdated content promptly.',
    },
    {
      heading: 'Notifications',
      body:
        'Adding or saving changes to a service sends a notification to ' +
        'registered app users, and notifications can reach their phones even ' +
        'when the app is closed. Only save changes when a service really ' +
        'changed, and do not use the system for advertising, personal ' +
        'messages, political content or anything misleading.',
    },
    {
      heading: 'Account Security',
      body:
        'Keep your password private and do not share your account. Sign out ' +
        'on shared computers. You are responsible for actions taken under ' +
        'your account. Tell the Super Admin right away if you suspect that ' +
        'someone else has used it.',
    },
    {
      heading: 'Activity Log',
      body:
        'Actions such as requesting an account, adding, updating or deleting ' +
        'services and requesting deletions are recorded in an activity log ' +
        'with your name, role, office and the time. The log is used for ' +
        'security and accountability.',
    },
    {
      heading: 'Acceptable Use',
      body:
        'Do not misuse the web admin, go beyond the access of your role, ' +
        'interfere with the system, or enter unlawful, offensive or ' +
        'misleading content.',
    },
    {
      heading: 'User Information',
      body:
        'The web admin may use basic app user information only to run ' +
        'GaBayan, for example to send notifications. Do not copy, share or ' +
        'use that information for any other purpose.',
    },
    {
      heading: 'Inactive Accounts, Suspension and Removal',
      body:
        'For security, an administrator account that has not signed in for ' +
        '30 days may be deactivated by the Super Admin. A deactivated ' +
        'account cannot sign in, but it is not deleted, and the Super Admin ' +
        'can reactivate it at any time. Your access may also be suspended or ' +
        'removed if you break these Terms or no longer work with the ' +
        'concerned office. You may delete your own administrator account at ' +
        'any time.',
    },
    {
      heading: 'Disclaimer and Liability',
      body:
        'The web admin is provided "as is" and "as available". ' +
        'Administrators remain responsible for the content they publish. To ' +
        `the extent allowed by Philippine law, ${operatorName} is not liable ` +
        'for losses caused by content published by administrators, service ' +
        'interruptions or errors in the system.',
    },
    {
      heading: 'Changes to These Terms',
      body:
        'We may update these Terms. When we do, we will change the version ' +
        'number and may ask you to review and accept the new version before ' +
        'you continue using the web admin.',
    },
    {
      heading: 'Governing Law and Contact',
      body:
        'These Terms are governed by the laws of the Republic of the ' +
        `Philippines. For questions, contact ${contactEmail}.`,
    },
  ],

  // ---------------------------------------------------------------------------
  // PRIVACY POLICY
  // ---------------------------------------------------------------------------
  privacyIntro:
    'This Privacy Policy explains how GaBayan collects, uses, stores and ' +
    'protects the personal information of administrators who use the web ' +
    'admin, in accordance with the Data Privacy Act of 2012 (Republic Act ' +
    'No. 10173). Information about citizens who use the mobile app is covered ' +
    'in the Privacy Policy shown in that app.',

  privacy: [
    {
      heading: 'Who Is Responsible',
      body:
        `The personal information controller is ${operatorName}. For privacy ` +
        `questions or to exercise your rights, contact us at ${contactEmail}.`,
    },
    {
      heading: 'Information We Collect',
      body:
        '• Account details: full name, email address, office, role and ' +
        'account status.\n' +
        '• Your password, which is handled by Firebase Authentication and ' +
        'cannot be read by us, or your Google sign-in details (name and ' +
        'email address) if you use Continue with Google.\n' +
        '• Your sign-in method, and the dates your account was created and ' +
        'updated.\n' +
        '• The date and time of your last sign-in, used to tell whether an ' +
        'account is still in use.\n' +
        '• Requests you make, such as account approval and service deletion ' +
        'requests.\n' +
        '• Activity log entries: your name, role, office, the action taken ' +
        'and the time.\n' +
        '• Verification codes we email you if you reset your password.\n' +
        '• A record of the version of these documents you accepted, and when.',
    },
    {
      heading: 'How We Use Your Information',
      body:
        'We use your information to review and approve administrator access, ' +
        'keep the web admin secure, show who made each change, find accounts ' +
        'that have not been used for 30 days so the Super Admin can ' +
        'deactivate them, send you account emails such as registration ' +
        'updates and verification codes, and comply with the law.',
    },
    {
      heading: 'Legal Basis',
      body:
        'We process your personal information based on your consent, which ' +
        'you give by accepting this Policy when you sign up, and as needed ' +
        'to manage access to the web admin. You may withdraw your consent by ' +
        'deleting your account.',
    },
    {
      heading: 'Who We Share It With',
      body:
        'We do not sell your personal information. The Super Admin and other ' +
        'authorized administrators may see your name, office and actions in ' +
        'the activity log and review queue, depending on their role. The ' +
        'Super Admin can also see your full name, email address, office, ' +
        'registration date and last sign-in in the account management page, ' +
        'where accounts can be deactivated or reactivated.\n\n' +
        'We use trusted service providers to run the web admin: Google ' +
        'Firebase (authentication, database and cloud functions), Google ' +
        'Sign-In, and EmailJS, which sends registration, notification and ' +
        'verification emails. They process data only to provide these ' +
        'services. We may disclose information when required by law or a ' +
        'lawful order.',
    },
    {
      heading: 'Storage and Transfers',
      body:
        'Your information is stored on Google Firebase servers and passes ' +
        'through our email provider. Both may be located outside the ' +
        'Philippines. We use providers that maintain recognized security ' +
        'standards, and we share only the information needed to run the web ' +
        'admin.',
    },
    {
      heading: 'Retention',
      body:
        'We keep your information while your administrator account is ' +
        'active. A deactivated account and its information are kept until ' +
        'the Super Admin reactivates or removes it. When you delete your ' +
        'account, your administrator profile is ' +
        'removed. Activity log entries and past requests may be kept for ' +
        'accountability and audit purposes.',
    },
    {
      heading: 'Security',
      body:
        'We apply reasonable organizational, physical and technical ' +
        'safeguards, including encrypted connections, role-based access and ' +
        'Super Admin approval of new accounts. No system is completely ' +
        'secure, so please keep your password private.\n\n' +
        'If a personal data breach affecting you occurs, we will notify you ' +
        'and the National Privacy Commission as required by law.',
    },
    {
      heading: 'Your Rights',
      body:
        'Under the Data Privacy Act you have the right to be informed, to ' +
        'access, to object, to correct, to erase or block, to data ' +
        'portability, and to claim damages if your data is misused. You can ' +
        'delete your administrator account in the web admin. To exercise ' +
        `other rights, email ${contactEmail}. You may also file a complaint ` +
        'with the National Privacy Commission (privacy.gov.ph).',
    },
    {
      heading: 'Changes and Contact',
      body:
        'We will change the version number when this Policy is updated and ' +
        'may ask you to review it again. For questions, contact ' +
        `${contactEmail}.`,
    },
  ],
};