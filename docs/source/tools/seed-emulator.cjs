// Sample data for the documentation screenshots, written to the LOCAL Firebase
// emulators only (project demo-gabayan). Never point this at the real project.
//
//   firebase emulators:start --only auth,firestore,functions --project demo-gabayan
//   node docs/source/tools/seed-emulator.cjs
//
// Wipes the emulators' Firestore + Auth data, then adds offices, rooms, services,
// admins, citizens with service history, Review Queue requests, Deleted Records
// and Activity Log entries. Uses firebase-admin from functions/node_modules
// (run `npm ci` in functions/ first).
const path = require('path');
const { createRequire } = require('module');

const PROJECT = 'demo-gabayan';
const FIRESTORE = '127.0.0.1:8080';
const AUTH = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = PROJECT;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;

const requireFromFunctions = createRequire(path.join(__dirname, '../../../functions/package.json'));
const admin = requireFromFunctions('firebase-admin');
const { Timestamp } = requireFromFunctions('firebase-admin/firestore');

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const auth = admin.auth();

const SITE = 'http://localhost:5510';
const PASSWORD = 'GaBayan#2026';
const NOW = Date.now();
const DAY = 86400000;
const ago = (days, hours = 0, minutes = 0) => Timestamp.fromMillis(NOW - days * DAY - hours * 3600000 - minutes * 60000);
const inDays = (days) => Timestamp.fromMillis(NOW + days * DAY);
const officeIdFromName = (name) => String(name).trim().toUpperCase().replace(/\s+/g, '-');
const serviceIdFor = (officeId, name) => `${officeId}-${String(name).trim().toUpperCase().replace(/\s+/g, '-')}`;

// Deterministic "random" numbers so every run draws the same charts.
let seed = 20261125;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

async function wipe() {
  const fs = await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const au = await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  if (!fs.ok || !au.ok) throw new Error('Could not clear the emulators. Are they running?');
}

// ---------------------------------------------------------------- offices & rooms
const SCHEDULE = 'Mon-Fri, 8AM-5PM';
const OFFICES = [
  { name: 'Business Permits and Licensing Office', floor: 'first_floor', slot: 's1', desc: 'Processes new and renewed business permits, retirement of businesses and special permits.' },
  { name: 'Office of the City Treasurer 1', floor: 'first_floor', slot: 's3', desc: 'Collects real property tax, business tax and issues community tax certificates.' },
  { name: 'Office of the City Treasurer 2', floor: 'first_floor', slot: 's4', desc: 'Handles certified copies of official receipts and transfer tax payments.' },
  { name: 'City Civil Registry Office', floor: 'first_floor', slot: 's13', desc: 'Registers births, marriages and deaths and issues certified copies.' },
  { name: "City Assessor's Office", floor: 'first_floor', slot: 's15', desc: 'Appraises real property and issues tax declarations and certifications.' },
  { name: 'Public Employment Service Office', floor: 'first_floor', slot: null, desc: 'Job matching, referrals and employment facilitation for residents.' },
  { name: 'City Health Office', floor: 'second_floor', slot: null, desc: 'Health certificates, sanitary permits and public health programs.' },
  { name: 'City Social Welfare and Development Office', floor: 'second_floor', slot: null, desc: 'Social services, senior citizen, PWD and solo parent IDs.' },
  { name: 'City Engineering Office', floor: 'third_floor', slot: null, desc: 'Building, occupancy and other construction-related permits.' },
  { name: 'Human Resource Management Office', floor: 'third_floor', slot: null, desc: 'Employment records and certificates for city government employees.' },
  { name: 'Office of the City Mayor', floor: 'third_floor', slot: null, desc: "Mayor's clearances, endorsements and executive services." }
];
const TRASHED_OFFICE = { name: 'City Planning and Development Office', floor: 'second_floor', desc: 'Zoning and locational clearances.' };

const ROOMS = [
  { name: 'Information Desk', category: 'building_access', slot: 's2', desc: 'Front desk that directs visitors to the right office.' },
  { name: 'First Aid Station', category: 'emergency_services', slot: 's8', desc: 'Basic first aid and emergency assistance.' },
  { name: 'Ground Floor Comfort Room', category: 'comfort_rooms', slot: 's14', desc: 'Public restrooms near the main lobby.' },
  { name: 'PWD and Senior Citizens Lounge', category: 'facilities_and_amenities', slot: null, desc: 'Priority waiting area for PWDs and senior citizens.' }
];

// ---------------------------------------------------------------- services
const step = (process_name, fee, processing_time, process_description, person_in_charge, extra = {}) => ({
  process_name, fee, processing_time, process_description, person_in_charge,
  online_link: '', navigate_to: '', agency_actions: [], notes: '', ...extra
});
const tab = (tab_name, fields, requirements, procedures) => ({
  tab_name,
  transaction_type: fields.type || 'G2C – Government to Citizen',
  who_may_avail: fields.who || 'All citizens',
  total_fee: fields.fee || 'None',
  total_processing_time: fields.time || '30 Minutes',
  requirements: requirements.map(([requirement_name, secure_at]) => ({ requirement_name, secure_at })),
  procedures
});

// A short but complete tab for the less detailed sample services.
const simpleTab = (name, office, fee = 'None', time = '30 Minutes', reqs = [['Valid ID', 'Applicant'], ['Accomplished request form', office]]) =>
  tab(name, { fee, time }, reqs, [
    step('Submission of Requirements', 'None', '10 Minutes', 'Submit the accomplished form and the requirements at the window.', `${office} – Window 1`, { agency_actions: ['Checks the completeness of the requirements.'] }),
    step('Payment', fee, '10 Minutes', 'Pay the fees at the City Treasurer and keep the official receipt.', 'Office of the City Treasurer 1', { navigate_to: 'Office of the City Treasurer 1' }),
    step('Release', 'None', time, 'Claim the document by presenting the official receipt.', `${office} – Releasing Window`)
  ]);

const BPLO = 'Business Permits and Licensing Office';
const SERVICES = {
  [BPLO]: [
    {
      name: 'New Business Application',
      description: 'Application for a business permit for a new business operating in Biñan City.',
      tabs: [
        tab('Walk-In', { type: 'G2B – Government to Business', who: 'Business owners with a new business in Biñan City', fee: 'Based on the Revised Revenue Code (2016) City of Binan', time: '1 Day' }, [
          ['BPLO FORM 001-2: Application Form For Business Permit', 'Business Permits and Licensing Office'],
          ['DTI / SEC / CDA Registration', 'DTI, SEC or CDA'],
          ['Barangay Clearance', 'Barangay Hall'],
          ['Occupancy Permit (if applicable)', 'City Engineering Office']
        ], [
          step('Application and Assessment', 'None', '50 Minutes', 'Submit the requirements and accomplish the Application Form for Business Permit. The assessor computes the fees.', 'BPLO Assessment Window 1 to 3', {
            agency_actions: ['Verification of documents', 'Assessment of business tax and regulatory fees'],
            notes: '*Incomplete requirements will not be accepted.'
          }),
          step('Payment', 'Based on the Revised Revenue Code (2016) City of Binan', '15 Minutes', 'Pay the assessed fees at the City Treasurer and keep the official receipt.', 'Office of the City Treasurer 1 – Cashier', {
            navigate_to: 'Office of the City Treasurer 1',
            agency_actions: ['Issuance of official receipt']
          }),
          step('Claiming of Permit', 'None', '15 Minutes', "Present the official receipt to claim the Mayor's Permit and the business plate.", 'BPLO Releasing Window', {
            agency_actions: ["Release of Mayor's Permit and business plate"]
          })
        ]),
        tab('Online', { type: 'G2B – Government to Business', who: 'Business owners with a new business in Biñan City', fee: 'Based on the Revised Revenue Code (2016) City of Binan', time: '1 to 3 Days' }, [
          ['Scanned application form', 'binancitybusinesspermit.online'],
          ['DTI / SEC / CDA Registration', 'DTI, SEC or CDA']
        ], [
          step('Online Application', 'None', '20 Minutes', 'Fill in the online application and upload the scanned requirements.', 'BPLO Online Desk', { online_link: 'https://binancitybusinesspermit.online' }),
          step('Online Payment', 'Based on the Revised Revenue Code (2016) City of Binan', '1 to 5 Days', 'Pay through the payment channels listed on the Statement of Account sent by email.', 'Office of the City Treasurer 1', {
            agency_actions: ['Sending of SOA via email.'],
            notes: '*Payment will be credited within 1 to 5 working days.'
          })
        ])
      ]
    },
    { name: 'Renewal of Business Application', description: 'Yearly renewal of an existing business permit.', simple: ['Walk-In', 'Based on the Revised Revenue Code (2016) City of Binan', '50 Minutes'] },
    { name: 'Retirement of Business', description: 'Closure of a business and cancellation of its permit.', simple: ['Walk-In', 'None', '1 Day'] },
    { name: "Mayor's Permit for Special Events", description: 'Temporary permit for fairs, bazaars and similar events.', simple: ['Walk-In', '₱500', '1 Day'] }
  ],
  'Office of the City Treasurer 1': [
    { name: 'Payment of Real Property Tax', description: 'Yearly or quarterly payment of real property tax.', simple: ['Walk-In', 'Based on the assessed value', '20 Minutes'] },
    { name: 'Issuance of Community Tax Certificate', description: 'Issuance of the cedula for individuals and corporations.', simple: ['Walk-In', '₱5 basic plus additional tax', '10 Minutes'] },
    { name: 'Payment of Business Tax', description: 'Payment of business taxes and regulatory fees.', simple: ['Walk-In', 'Based on the assessment', '20 Minutes'] }
  ],
  'Office of the City Treasurer 2': [
    { name: 'Certified True Copy of Official Receipt', description: 'Certified copy of an official receipt issued by the city.', simple: ['Walk-In', '₱100', '15 Minutes'] }
  ],
  'City Civil Registry Office': [
    { name: 'Request for Birth Certificate', description: 'Certified copy of a birth certificate registered in Biñan City.', simple: ['Walk-In', '₱150', '30 Minutes'] },
    { name: 'Registration of Marriage', description: 'Registration of a marriage solemnized in Biñan City.', simple: ['Walk-In', '₱200', '1 Day'] },
    { name: 'Request for Death Certificate', description: 'Certified copy of a death certificate registered in Biñan City.', simple: ['Walk-In', '₱150', '30 Minutes'] },
    { name: 'Late Registration of Birth', description: 'Registration of a birth reported after 30 days.', simple: ['Walk-In', '₱300', '10 Days'] }
  ],
  "City Assessor's Office": [
    { name: 'Issuance of Tax Declaration', description: 'Certified copy of the tax declaration of a property.', simple: ['Walk-In', '₱100', '30 Minutes'] },
    { name: 'Certification of No Improvement', description: 'Certifies that a lot has no building or improvement.', simple: ['Walk-In', '₱100', '1 Day'] }
  ],
  'Public Employment Service Office': [
    { name: 'Job Referral', description: 'Referral of qualified applicants to partner employers.', simple: ['Walk-In', 'None', '30 Minutes'] }
  ],
  'City Health Office': [
    { name: 'Issuance of Health Certificate', description: 'Health certificate for food handlers and other workers.', simple: ['Walk-In', '₱150', '1 Day'] },
    { name: 'Sanitary Permit', description: 'Sanitary permit to operate for business establishments.', simple: ['Walk-In', 'Based on the business type', '1 Day'] }
  ],
  'City Social Welfare and Development Office': [
    { name: 'Issuance of Senior Citizen ID', description: 'ID card for residents aged 60 and above.', simple: ['Walk-In', 'None', '1 Day'] },
    { name: 'Issuance of PWD ID', description: 'ID card for persons with disability.', simple: ['Walk-In', 'None', '1 Day'] },
    { name: 'Issuance of Solo Parent ID', description: 'ID card for solo parents under RA 11861.', simple: ['Walk-In', 'None', '1 Day'] }
  ],
  'City Engineering Office': [
    { name: 'Building Permit Application', description: 'Permit to construct, renovate or demolish a building.', simple: ['Walk-In', 'Based on the National Building Code', '5 Days'] },
    { name: 'Occupancy Permit', description: 'Permit to use a building after construction.', simple: ['Walk-In', 'Based on the National Building Code', '5 Days'] }
  ],
  'Human Resource Management Office': [
    { name: 'Certificate of Employment', description: 'Certificate of employment for city government employees.', simple: ['Walk-In', 'None', '1 Day'] }
  ],
  'Office of the City Mayor': [
    { name: "Mayor's Clearance", description: "Clearance issued by the Office of the City Mayor.", simple: ['Walk-In', '₱100', '30 Minutes'] }
  ],
  [TRASHED_OFFICE.name]: [
    { name: 'Zoning Clearance', description: 'Certifies that a land use follows the zoning ordinance.', simple: ['Walk-In', '₱500', '3 Days'] },
    { name: 'Locational Clearance', description: 'Clearance on the location of a project or business.', simple: ['Walk-In', '₱500', '3 Days'] }
  ]
};

// Services in Deleted Records: [office, name, deleted days ago, requested by]
const TRASHED_SERVICES = [
  ['City Civil Registry Office', 'Request for CENOMAR', 2, 'Ana Cruz'],
  ['Office of the City Treasurer 2', 'Payment of Transfer Tax', 28, null]
];

// ---------------------------------------------------------------- people
const SUPER = { email: 'superadmin@gabayan.test', name: 'Super Admin', avatar: 'profileimage_male1.jpg' };
const ADMINS = [
  { email: 'maria.santos@gabayan.test', name: 'Maria Santos', office: BPLO, status: 'active', avatar: 'profileimage_female2.jpg', created: 210, login: 0 },
  { email: 'jose.reyes@gabayan.test', name: 'Jose Reyes', office: 'Office of the City Treasurer 1', status: 'active', avatar: 'profileimage_male3.jpg', created: 180, login: 2 },
  { email: 'ana.cruz@gabayan.test', name: 'Ana Cruz', office: 'City Civil Registry Office', status: 'active', avatar: 'profileimage_female1.jpg', created: 5, login: 1 },
  { email: 'ramon.villanueva@gabayan.test', name: 'Ramon Villanueva', office: "City Assessor's Office", status: 'active', avatar: 'profileimage_male4.jpg', created: 300, login: 120 },
  { email: 'paolo.garcia@gabayan.test', name: 'Paolo Garcia', office: 'City Health Office', status: 'deactivated', avatar: 'profileimage_male2.jpg', created: 260, login: 140, reason: 'Transferred to another department' },
  { email: 'liza.mendoza@gabayan.test', name: 'Liza Mendoza', office: "City Assessor's Office", status: 'pending', avatar: 'profileimage_female3.jpg', created: 0.1, login: null }
];

const FIRST = ['Juan', 'Maria', 'Jose', 'Andrea', 'Mark', 'Kristine', 'Carlo', 'Patricia', 'Miguel', 'Angelica', 'Rafael', 'Camille', 'Joshua', 'Bea', 'Gabriel', 'Nicole', 'Adrian', 'Janine', 'Paolo', 'Trisha', 'Christian', 'Erika', 'Daniel', 'Shaira'];
const LAST = ['Dela Cruz', 'Reyes', 'Santos', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Villanueva', 'Fernandez', 'Lopez', 'Gonzales'];

// Sign-up ages in days: a few today/this week, more over the year, some older.
const CITIZEN_AGES = [0.05, 0.3, 1, 2, 3, 5, 8, 12, 17, 23, 30, 38, 47, 56, 66, 77, 88, 100, 112, 125, 138, 152, 166, 181,
  196, 212, 228, 245, 262, 280, 298, 316, 334, 352, 365, 380, 400, 425, 450, 480, 510, 545, 580, 620, 660, 700, 760, 820];

// Weighted popularity of services in the citizens' service history
const POPULAR = [
  [BPLO, 'New Business Application', 12], [BPLO, 'Renewal of Business Application', 9],
  ['City Civil Registry Office', 'Request for Birth Certificate', 10], ['Office of the City Treasurer 1', 'Issuance of Community Tax Certificate', 8],
  ['Office of the City Treasurer 1', 'Payment of Real Property Tax', 6], ['City Health Office', 'Issuance of Health Certificate', 5],
  ['City Social Welfare and Development Office', 'Issuance of Senior Citizen ID', 4], [BPLO, 'Retirement of Business', 3],
  ["City Assessor's Office", 'Issuance of Tax Declaration', 3], ['City Engineering Office', 'Building Permit Application', 2],
  ['City Civil Registry Office', 'Registration of Marriage', 2], [BPLO, "Mayor's Permit for Special Events", 2]
];
const weighted = POPULAR.flatMap(([o, s, w]) => Array(w).fill([o, s]));

async function createLogin({ email, name, avatar }, extra = {}) {
  const user = await auth.createUser({ email, password: PASSWORD, displayName: name, photoURL: `${SITE}/assets/${avatar}`, ...extra });
  return user.uid;
}

async function main() {
  await wipe();
  const batchWrites = [];
  const set = (ref, data) => batchWrites.push([ref, data]);

  // Offices, rooms and services
  const allOffices = [...OFFICES, { ...TRASHED_OFFICE, slot: null, trashed: true }];
  for (const o of allOffices) {
    const id = officeIdFromName(o.name);
    set(db.collection('offices').doc(id), {
      office_name: o.name, description: o.desc, floor: o.floor, category: 'regular_service', schedule: SCHEDULE,
      created_at: ago(400),
      ...(o.slot ? { map_slot: o.slot, map_slot_v: 2 } : {}),
      ...(o.trashed ? {
        isDeleted: true, deletedAt: ago(5), deletedBy_uid: 'seed', deletedBy_name: 'Super Admin', permanentDeleteAt: inDays(25)
      } : {})
    });
    for (const s of SERVICES[o.name] || []) {
      const tabs = s.tabs || [simpleTab(s.simple[0], o.name, s.simple[1], s.simple[2])];
      set(db.collection('offices').doc(id).collection('services').doc(serviceIdFor(id, s.name)), {
        service_name: s.name, description: s.description,
        location: `${o.floor === 'first_floor' ? '1st' : o.floor === 'second_floor' ? '2nd' : '3rd'} Floor, City Hall Building, Brgy. Zapote, Binan City, Laguna`,
        contact_phone: '(049)513-5084', contact_email: '', tabs,
        created_at: ago(300), updated_at: ago(20)
      });
    }
  }
  for (const [officeName, name, days, requestedBy] of TRASHED_SERVICES) {
    const officeId = officeIdFromName(officeName);
    set(db.collection('offices').doc(officeId).collection('services').doc(serviceIdFor(officeId, name)), {
      service_name: name, description: `${name} (sample).`, location: '1st Floor, City Hall Building, Brgy. Zapote, Binan City, Laguna',
      contact_phone: '(049)513-5084', contact_email: '', tabs: [simpleTab('Walk-In', officeName, '₱150', '1 Day')],
      created_at: ago(300), updated_at: ago(40),
      isDeleted: true, deletedAt: ago(days), deletedBy_uid: 'seed', deletedBy_name: 'Super Admin', permanentDeleteAt: inDays(30 - days),
      deletedFromOffice_id: officeId, deletedFromOffice_name: officeName,
      ...(requestedBy ? { deletionRequest_id: 'seed-cenomar', deletionRequestedBy_uid: 'seed', deletionRequestedBy_name: requestedBy } : {})
    });
  }
  for (const r of ROOMS) {
    set(db.collection('other_room').doc(officeIdFromName(r.name)), {
      room_name: r.name, description: r.desc, floor: 'first_floor', category: r.category, schedule: 'Mon-Sun, 7AM-7PM',
      created_at: ago(400), ...(r.slot ? { map_slot: r.slot, map_slot_v: 2 } : {})
    });
  }

  // Super Admin + office admins (Auth logins and admin/{uid} records)
  const superUid = await createLogin(SUPER);
  set(db.collection('admin').doc(superUid), {
    admin_id: superUid, full_name: SUPER.name, email: SUPER.email, admin_office: '', role: 'super_admin', status: 'active',
    sign_in_method: 'email', createdAt: ago(420), updatedAt: ago(30)
  });
  set(db.collection('app_settings').doc('super_admin'), { uids: [superUid] });

  const adminUids = {};
  for (const a of ADMINS) {
    const uid = await createLogin(a, a.status === 'deactivated' ? { disabled: true } : {});
    adminUids[a.name] = uid;
    set(db.collection('admin').doc(uid), {
      admin_id: uid, full_name: a.name, email: a.email, admin_office: a.office, role: 'admin', status: a.status,
      sign_in_method: 'email', accepted_terms_version: '1.0', accepted_terms_at: ago(a.created),
      createdAt: ago(a.created), updatedAt: ago(Math.min(a.created, 3)),
      ...(a.status === 'active' ? { approvedAt: ago(Math.max(a.created - 0.5, 0)), approvedBy_uid: superUid } : {}),
      ...(a.status === 'deactivated' ? {
        previous_status: 'active', deactivated_at: ago(12), deactivated_by: superUid, deactivated_by_name: 'Super Admin', deactivation_reason: a.reason
      } : {})
    });
  }

  // Citizens (imported so their "last login" times look real) + service history
  const citizens = CITIZEN_AGES.map((age, i) => {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i}@example.com`;
    const lastLoginDays = i % 9 === 4 ? null : Math.min(age, age > 150 ? 100 + (i % 5) * 20 : Math.floor(rand() * Math.max(age, 1)));
    return { uid: `citizen-${String(i + 1).padStart(3, '0')}`, name, email, age, lastLoginDays, deactivated: i === 7 || i === 30 };
  });
  await auth.importUsers(citizens.map((c) => ({
    uid: c.uid, email: c.email, displayName: c.name, disabled: c.deactivated,
    metadata: {
      creationTime: new Date(NOW - c.age * DAY).toUTCString(),
      ...(c.lastLoginDays == null ? {} : { lastSignInTime: new Date(NOW - c.lastLoginDays * DAY - 3600000).toUTCString() })
    }
  })));
  citizens.forEach((c) => {
    set(db.collection('users').doc(c.uid), {
      user_id: c.uid, username: c.name, full_name: c.name, email: c.email, profile_img: 'assets/default_profile.png',
      accepted_terms_version: '1.0', createdAt: ago(c.age), updatedAt: ago(Math.min(c.age, 2)),
      ...(c.deactivated ? { status: 'deactivated', previous_status: 'active', deactivated_at: ago(20), deactivated_by_name: 'Super Admin', deactivation_reason: 'Duplicate account' } : {})
    });
    // 1-5 services each, used at times after the citizen signed up
    const count = 1 + Math.floor(rand() * 5);
    const used = new Set();
    for (let k = 0; k < count; k++) {
      const [officeName, serviceName] = pick(weighted);
      const serviceId = serviceIdFor(officeIdFromName(officeName), serviceName);
      if (used.has(serviceId)) continue;
      used.add(serviceId);
      const maxDays = Math.min(c.age, 360);
      const when = maxDays * rand(); // anywhere in the last year after signing up
      const completed = rand() < 0.62;
      set(db.collection('users').doc(c.uid).collection('service_history').doc(serviceId), {
        service_id: serviceId, service_name: serviceName,
        status: completed ? 'Completed' : 'In Progress', progress: completed ? 1 : 0.5,
        checked_requirements: [], completed_steps: [], tab_progress: {},
        last_updated: ago(when)
      });
    }
  });

  // Review Queue: open requests + accepted history
  const liza = ADMINS.find((a) => a.name === 'Liza Mendoza');
  const maria = ADMINS.find((a) => a.name === 'Maria Santos');
  const jose = ADMINS.find((a) => a.name === 'Jose Reyes');
  const pending = [
    { type: 'new_admin', requested_by_uid: adminUids['Liza Mendoza'], requested_by_name: liza.name, requested_by_email: liza.email, target_admin_uid: adminUids['Liza Mendoza'], office_name: liza.office, createdAt: ago(0, 0, 25) },
    { type: 'delete_service', requested_by_uid: adminUids['Maria Santos'], requested_by_name: maria.name, requested_by_email: maria.email, office_id: officeIdFromName(BPLO), office_name: BPLO, service_id: serviceIdFor(officeIdFromName(BPLO), "Mayor's Permit for Special Events"), service_name: "Mayor's Permit for Special Events", createdAt: ago(0, 0, 55) },
    { type: 'delete_service', requested_by_uid: adminUids['Jose Reyes'], requested_by_name: jose.name, requested_by_email: jose.email, office_id: officeIdFromName('Office of the City Treasurer 1'), office_name: 'Office of the City Treasurer 1', service_id: serviceIdFor(officeIdFromName('Office of the City Treasurer 1'), 'Payment of Business Tax'), service_name: 'Payment of Business Tax', createdAt: ago(0, 1, 35) }
  ];
  pending.forEach((r, i) => set(db.collection('requests').doc(`seed-pending-${i + 1}`), { status: 'pending', ...r }));
  const completed = [
    { type: 'new_admin', who: 'Ana Cruz', office: 'City Civil Registry Office', created: 5.4, resolved: 4.9 },
    { type: 'delete_service', who: 'Ana Cruz', office: 'City Civil Registry Office', service: 'Request for CENOMAR', created: 2.6, resolved: 2 },
    { type: 'new_admin', who: 'Maria Santos', office: BPLO, created: 210.3, resolved: 209.8 },
    { type: 'new_admin', who: 'Jose Reyes', office: 'Office of the City Treasurer 1', created: 180.4, resolved: 180 }
  ];
  completed.forEach((r, i) => {
    const a = ADMINS.find((x) => x.name === r.who);
    set(db.collection('completed_requests').doc(`seed-done-${i + 1}`), {
      type: r.type, status: 'completed', requested_by_uid: adminUids[r.who], requested_by_name: r.who, requested_by_email: a.email,
      office_name: r.office, ...(r.service ? { service_name: r.service } : { target_admin_uid: adminUids[r.who] }),
      createdAt: ago(r.created), resolvedAt: ago(r.resolved), resolvedBy_uid: superUid, resolvedBy_name: 'Super Admin'
    });
  });

  // Activity Log copies (the Super Admin's and Maria's)
  const LOGS = [
    ['admin_account_requested', 0, 0, 25, { actor_name: 'Liza Mendoza', actor_uid: adminUids['Liza Mendoza'], actor_role: 'admin', office_name: liza.office }],
    ['service_delete_requested', 0, 0, 55, { actor_name: 'Maria Santos', actor_uid: adminUids['Maria Santos'], actor_role: 'admin', office_name: BPLO, service_name: "Mayor's Permit for Special Events" }],
    ['service_delete_requested', 0, 1, 35, { actor_name: 'Jose Reyes', actor_uid: adminUids['Jose Reyes'], actor_role: 'admin', office_name: 'Office of the City Treasurer 1', service_name: 'Payment of Business Tax' }],
    ['service_updated', 0, 9, 40, { actor_name: 'Maria Santos', actor_uid: adminUids['Maria Santos'], actor_role: 'admin', office_name: BPLO, service_name: 'New Business Application' }],
    ['service_delete_accepted', 2, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: 'City Civil Registry Office', service_name: 'Request for CENOMAR', target_name: 'Ana Cruz' }],
    ['service_added', 3, 1, 0, { actor_name: 'Ana Cruz', actor_uid: adminUids['Ana Cruz'], actor_role: 'admin', office_name: 'City Civil Registry Office', service_name: 'Late Registration of Birth' }],
    ['admin_account_accepted', 4, 22, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: 'City Civil Registry Office', target_name: 'Ana Cruz' }],
    ['office_deleted', 5, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: TRASHED_OFFICE.name }],
    ['admin_account_deactivated', 12, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: 'City Health Office', target_name: 'Paolo Garcia' }],
    ['user_account_deactivated', 20, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', target_name: citizens[7].name }],
    ['office_added', 41, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: 'Public Employment Service Office' }],
    ['service_restored', 47, 0, 0, { actor_name: 'Super Admin', actor_uid: superUid, actor_role: 'super_admin', office_name: 'City Health Office', service_name: 'Sanitary Permit' }]
  ];
  LOGS.forEach(([type, d, h, m, details], i) => {
    set(db.collection('admin').doc(superUid).collection('activity_logs').doc(`seed-log-${i + 1}`), {
      type, actor_uid: '', actor_name: '', actor_role: 'admin', office_name: '', service_name: '', target_name: '', target_uid: '',
      ...details, createdAt: ago(d, h, m)
    });
  });
  [['office_added', 41, { office_name: 'Public Employment Service Office' }],
    ['service_delete_declined', 60, { office_name: BPLO, service_name: 'Retirement of Business' }],
    ['admin_account_accepted', 209.8, { office_name: BPLO }]].forEach(([type, d, details], i) => {
    set(db.collection('admin').doc(adminUids['Maria Santos']).collection('activity_logs').doc(`seed-log-${i + 1}`), {
      type, actor_uid: superUid, actor_name: 'Super Admin', actor_role: 'super_admin', service_name: '', target_name: '', target_uid: '',
      ...details, createdAt: ago(d)
    });
  });

  // Write everything in batches of 400
  for (let i = 0; i < batchWrites.length; i += 400) {
    const batch = db.batch();
    batchWrites.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data));
    await batch.commit();
  }
  console.log(`Seeded ${batchWrites.length} documents, ${citizens.length} citizens, ${ADMINS.length + 1} admins.`);
  console.log(`Sign in at ${SITE}/login.html?emulators`);
  console.log(`  Super Admin:  ${SUPER.email} / ${PASSWORD}`);
  console.log(`  Office Admin: ${maria.email} / ${PASSWORD}`);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
