// Services for "Office of the City Treasurer 2"
// Source: LGU-BINAN 2026 Citizen's Charter (1st Edition), pages 100–119.
// Shape matches what Forms/add_service.html saves to offices/{officeId}/services/{serviceId}.

export const OFFICE_NAME = 'Office of the City Treasurer 2';

export const COMMON = {
  location: '1st Floor, City Hall Building, Brgy. Zapote, Binan City, Laguna',
  contact_phone: '(049)513-5072 / (049)513-5004',
  contact_email: 'cto@binan.gov.ph'
};

const OCT = OFFICE_NAME;
const G2C = 'G2C – Government to Citizen';
const CLERK = 'Revenue Collection Clerk';
const ASSESSOR = 'Assessment Personnel';
const APPROVER = 'Approving Officer/Immediate Supervisor';
const RECEIPT_TEXT = 'Receive and double-check your official receipt.';

const req = (requirement_name, secure_at) => ({ requirement_name, secure_at });

const step = ({ name, fee = 'None', time, desc, person = CLERK, actions = [], navigate = '', notes = '' }) => ({
  process_name: name,
  fee,
  processing_time: time,
  process_description: desc,
  person_in_charge: person,
  online_link: '',
  navigate_to: navigate,
  agency_actions: actions,
  notes
});

const walkIn = ({ who, totalFee, totalTime, requirements, procedures }) => ([{
  tab_name: 'Walk-In',
  transaction_type: G2C,
  who_may_avail: who,
  total_fee: totalFee,
  total_processing_time: totalTime,
  requirements,
  procedures
}]);

// Shared 2-step flow used by most "Payment of ... Fees" services:
// 1) present requirements at the payment window, 2) pay and receive the OR.
const simplePayment = ({ verb = 'present', fee, verifyTime = '2 minutes', payTime = '3 minutes', receiptText = RECEIPT_TEXT, issueAction = 'Issuance of official receipt.', verifyAction = 'Verification of documents.' }) => ([
  step({
    name: verb === 'submit' ? 'Submission of Requirements' : 'Presentation of Requirements',
    time: verifyTime,
    desc: `Proceed to the payment window and ${verb} the requirements.`,
    actions: [verifyAction],
    navigate: OCT
  }),
  step({
    name: 'Payment',
    fee,
    time: payTime,
    desc: `Pay the corresponding amount. ${receiptText}`,
    actions: [issueAction]
  })
]);

export const SERVICES = [
  // p. 100
  {
    service_name: 'Requisition of Real Property Tax Clearance',
    description: 'Issues a Real Property Tax Clearance certifying that the real property taxes of a property have been paid, upon request of the property owner or their authorized representative.',
    tabs: walkIn({
      who: 'Real property owners or their authorized representative.',
      totalFee: '₱150.00 per copy',
      totalTime: '4 hours',
      requirements: [
        req('Requisition and Payment Slip', OCT),
        req('Official Receipt of Payment for Tax Clearance Request (₱150.00 per copy)', OCT),
        req('Photocopy of Latest Real Property Tax (Amilyar) Receipt', 'Applicant'),
        req('Photocopy of Registered Owner’s Valid ID', 'Applicant'),
        req('Special Power of Attorney and valid IDs (if availed via a representative)', 'Applicant')
      ],
      procedures: [
        step({
          name: 'Submission of Requirements',
          fee: '₱150.00 per copy',
          time: '4 hours',
          desc: 'Proceed to the assessment window and submit the requirements. Receive and double-check your Tax Clearance.',
          person: ASSESSOR,
          actions: ['Verification of documents, preparation and issuance of Tax Clearance.'],
          navigate: OCT
        })
      ]
    })
  },

  // pp. 104–105
  {
    service_name: 'Payment of Transfer Tax of Real Property Ownership',
    description: 'Collects the transfer tax due on the sale, donation, or other transfer of ownership of real property, through the issuance of a Tax Order of Payment (TOP) and official receipt.',
    tabs: walkIn({
      who: 'Real property owners/buyers or their authorized representative.',
      totalFee: 'As stated in the Tax Order of Payment (TOP)',
      totalTime: '4 hours, 5 minutes',
      requirements: [
        req('Photocopy of Deed of Absolute Sale, Deed of Donation, or Extra Judicial Settlement (whichever is applicable)', 'Applicant'),
        req('Photocopy of Latest Tax Declaration (House and Lot)', 'Office of the City Assessor'),
        req('Photocopy of Certificate of No Improvement (if no building)', 'Office of the City Assessor'),
        req('Photocopy of Latest Tax Clearance (House and Lot)', OCT),
        req('Tax Order of Payment (TOP)', OCT),
        req('Special Power of Attorney and valid IDs (if availed via a representative)', 'Applicant')
      ],
      procedures: [
        step({
          name: 'Submission of Requirements',
          time: '4 hours',
          desc: 'Proceed to the assessment window and submit the requirements.',
          person: `${ASSESSOR}; ${APPROVER}`,
          actions: ['Verification of requirements.', 'Approval and issuance of TOP.'],
          navigate: OCT
        }),
        step({
          name: 'Payment',
          fee: 'As stated in the TOP: 0.0075 of the Selling Price or Fair Market Value, whichever is higher, plus 2% penalty per month and 25% surcharge for unpaid taxes',
          time: '5 minutes',
          desc: `Proceed to the payment window and pay the corresponding taxes. ${RECEIPT_TEXT}`,
          actions: ['Issuance of official receipt.']
        })
      ]
    })
  },

  // p. 106
  {
    service_name: 'Payment of Professional Tax',
    description: 'Collects the annual professional tax from licensed professionals who have passed examinations conducted by the Professional Regulation Commission (PRC).',
    tabs: walkIn({
      who: 'Licensed professionals who have passed examinations conducted by the Professional Regulation Commission (PRC) or their authorized representative.',
      totalFee: '₱300.00 – Highly Professionals; ₱250.00 – Professionals (plus 25% surcharge if payment is later than January)',
      totalTime: '5 minutes',
      requirements: [
        req('Valid Professional Regulation Commission (PRC) ID', 'Professional Regulation Commission (PRC)'),
        req('Latest Cedula with Declared Annual Gross Income', OCT),
        req('Authorization letter and valid IDs (if availed via a representative)', 'Applicant')
      ],
      procedures: simplePayment({
        fee: '₱300.00 – Highly Professionals; ₱250.00 – Professionals (plus 25% surcharge if payment is later than January)'
      })
    })
  },

  // p. 107
  {
    service_name: 'Payment of Occupational or Calling Fee',
    description: 'Collects the occupational or calling fee from professionals whose occupation does not require a government examination.',
    tabs: walkIn({
      who: 'Professionals not requiring government examinations or their authorized representative.',
      totalFee: '₱300.00 – Highly Professionals; ₱260.00 – Professionals (plus 25% surcharge if payment is later than January)',
      totalTime: '5 minutes',
      requirements: [
        req('Valid ID', 'Applicant'),
        req('Latest Cedula with Declared Annual Gross Income', OCT),
        req('Authorization letter and valid IDs (if availed via a representative)', 'Applicant')
      ],
      procedures: simplePayment({
        fee: '₱300.00 – Highly Professionals; ₱260.00 – Professionals (plus 25% surcharge if payment is later than January)'
      })
    })
  },

  // p. 108
  {
    service_name: 'Payment of Community Tax Certificate (Cedula) for Individual',
    description: 'Issues the Community Tax Certificate (Cedula) to individuals upon payment of the corresponding community tax based on their gross income.',
    tabs: walkIn({
      who: 'Employed individuals or their authorized representative.',
      totalFee: 'Depends on the gross income',
      totalTime: '10 minutes',
      requirements: [
        req('Cedula Data Form', OCT),
        req('One Valid ID', 'Applicant'),
        req('Authorization letter and valid IDs (if availed via a representative)', 'Applicant')
      ],
      procedures: [
        step({
          name: 'Submission of Requirements',
          time: '5 minutes',
          desc: 'Proceed to the payment window and submit the requirements.',
          actions: ['Assessment of tax to pay.'],
          navigate: OCT
        }),
        step({
          name: 'Payment',
          fee: '₱1.00 for every ₱1,000.00 of gross income derived from business or profession, plus ₱5.00 basic community tax, plus 2% penalty per month if payment is later than February',
          time: '4 minutes',
          desc: 'Pay the corresponding taxes.',
          actions: ['Issuance of cedula.']
        }),
        step({
          name: 'Signing of Cedula',
          time: '1 minute',
          desc: 'Receive and double-check your cedula. Sign and imprint your right thumb mark on the space provided.',
          actions: ['Secure the duplicate and triplicate copies of duly signed cedula.']
        })
      ]
    })
  },

  // p. 109
  {
    service_name: 'Payment of Community Tax Certificate (Cedula) for Businesses and Corporations',
    description: 'Issues the Community Tax Certificate (Cedula) to businesses and corporations upon payment of the corresponding community tax based on gross income and assessed value of real property.',
    tabs: walkIn({
      who: 'Company/Business owners or their authorized representative.',
      totalFee: 'Depends on the gross income derived from business and assessed value of real property',
      totalTime: '10 minutes',
      requirements: [
        req('Application Form for Business Permit', 'Business Permit and Licensing Office'),
        req('Tax Order of Payment (TOP)', 'Business Permit and Licensing Office')
      ],
      procedures: [
        step({
          name: 'Presentation of Requirements',
          time: '5 minutes',
          desc: 'Proceed to the payment window and present the requirements.',
          actions: ['Assessment of tax to pay.'],
          navigate: OCT
        }),
        step({
          name: 'Payment',
          fee: '₱2.00 for every ₱5,000.00 of gross income derived from business, plus ₱2.00 for every ₱5,000.00 of assessed value of real property, plus ₱500.00 basic community tax, plus 2% penalty per month if payment is later than February',
          time: '4 minutes',
          desc: 'Pay the corresponding taxes.',
          actions: ['Issuance of cedula.']
        }),
        step({
          name: 'Signing of Cedula',
          time: '1 minute',
          desc: 'Receive and double-check your cedula. Sign and imprint your right thumb mark on the space provided.',
          actions: ['Secure the duplicate and triplicate copies of duly signed cedula.']
        })
      ]
    })
  },

  // p. 110
  {
    service_name: 'Payment of Clearance and Certification Fees',
    description: 'Collects the fees for clearances and certifications issued by city offices, as stated in the payment slip from the concerned office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the payment slip',
      totalTime: '5 minutes',
      requirements: [
        req('Payment Slip', 'Concerned office'),
        req('One Valid ID', 'Applicant')
      ],
      procedures: simplePayment({ fee: 'As stated in the payment slip' })
    })
  },

  // p. 111
  {
    service_name: 'Payment of Civil Registration Fees',
    description: 'Collects the fees for civil registry documents and transactions, as stated in the payment slip from the Local Civil Registry Office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the payment slip',
      totalTime: '5 minutes',
      requirements: [
        req('Certificate', 'Office of the City Civil Registrar'),
        req('Payment Slip', 'Office of the City Civil Registrar')
      ],
      procedures: simplePayment({ fee: 'As stated in the payment slip' })
    })
  },

  // p. 112
  {
    service_name: 'Payment of Cemetery Fees',
    description: 'Collects the fees for the use of the city cemetery, as stated in the payment slip from the City Cemetery Office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the payment slip',
      totalTime: '5 minutes',
      requirements: [
        req('Death Certificate', 'Office of the City Civil Registrar'),
        req('Payment Slip', 'City Cemetery Office')
      ],
      procedures: simplePayment({ fee: 'As stated in the payment slip' })
    })
  },

  // p. 113
  {
    service_name: 'Payment of Permit Fees for Building, Electrical, and Occupancy',
    description: 'Collects the fees for building, electrical, and occupancy permits, as stated in the Order of Payment from the City Engineering Office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the Order of Payment',
      totalTime: '11 minutes',
      requirements: [
        req('Order of Payment', 'Office of the City Engineer'),
        req('Building/Electrical/Occupancy Data Form', OCT),
        req('Photocopy of Contractor’s Tax Official Receipt (if applicable)', OCT)
      ],
      procedures: [
        step({
          name: 'Submission of Requirements',
          time: '8 minutes',
          desc: 'Proceed to the assessment window and submit the requirements.',
          person: `${ASSESSOR}; ${APPROVER}`,
          actions: ['Verification of requirements.', 'Approval of transaction.'],
          navigate: OCT
        }),
        step({
          name: 'Payment',
          fee: 'As stated in the Order of Payment',
          time: '3 minutes',
          desc: `Proceed to the payment window and pay the corresponding taxes. ${RECEIPT_TEXT}`,
          actions: ['Issuance of official receipt.']
        })
      ]
    })
  },

  // p. 114
  {
    service_name: 'Payment of Zoning Clearance Fees',
    description: 'Collects the fees for zoning clearances, as stated in the Order of Payment from the City Planning and Development Office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the Order of Payment',
      totalTime: '8 minutes',
      requirements: [
        req('Order of Payment', 'Office of the City Planning and Development Coordinator')
      ],
      procedures: [
        step({
          name: 'Submission of Requirements',
          time: '5 minutes',
          desc: 'Proceed to the assessment window and submit the requirements.',
          person: ASSESSOR,
          actions: ['Verification of documents.', 'Approval of transaction.'],
          navigate: OCT
        }),
        step({
          name: 'Payment',
          fee: 'As stated in the Order of Payment',
          time: '3 minutes',
          desc: `Proceed to the payment window and pay the corresponding taxes. ${RECEIPT_TEXT}`,
          actions: ['Issuance of official receipt.']
        })
      ]
    })
  },

  // p. 115
  {
    service_name: 'Payment of Traffic Violation Fees',
    description: 'Collects the fines for traffic and ordinance violations, as stated in the Order of Payment from the apprehending office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the Order of Payment',
      totalTime: '5 minutes',
      requirements: [
        req('Photocopy of Ordinance Infraction Ticket', 'City Marshall Office / Biñan Tricycle Franchising and Regulatory Board (BTFRB) / Public Order and Safety Office (POSO) / Biñan Police Station'),
        req('Order of Payment', 'City Marshall Office / Biñan Tricycle Franchising and Regulatory Board (BTFRB) / Public Order and Safety Office (POSO) / Biñan Police Station')
      ],
      procedures: simplePayment({ verb: 'submit', fee: 'As stated in the Order of Payment' })
    })
  },

  // p. 116
  {
    service_name: 'Payment of Public Market Stall Rental and Electric Fees',
    description: 'Collects the stall rental and electricity fees from public market stallholders, as stated in the Statement of Account (SOA).',
    tabs: walkIn({
      who: 'Stallholders or their authorized representative.',
      totalFee: 'As stated in the Statement of Account (SOA)',
      totalTime: '5 minutes',
      requirements: [
        req('Statement of Account (SOA)', OCT),
        req('Latest Official Receipt', 'Applicant')
      ],
      procedures: simplePayment({ fee: 'As stated in the SOA' })
    })
  },

  // p. 117
  {
    service_name: 'Payment of Sealing and Licensing Fees of Weights and Measures',
    description: 'Collects the sealing and licensing fees for weighing scales, pumps, and other measuring instruments used by private markets and gasoline stations.',
    tabs: walkIn({
      who: 'Authorized representatives of private markets and gasoline stations.',
      totalFee: 'As stated in the data form',
      totalTime: '10 minutes',
      requirements: [
        req('Pump/Weight/Measure License Data Form', OCT),
        req('Weighing Scale License Information Sheet (applicable to weights only)', OCT)
      ],
      procedures: simplePayment({
        fee: 'As stated in the data form',
        verifyTime: '5 minutes',
        payTime: '5 minutes',
        receiptText: 'Receive and double-check your official receipt and seal.',
        issueAction: 'Issuance of official receipt and seal.'
      })
    })
  },

  // p. 118
  {
    service_name: 'Payment of Franchising and Licensing Fees',
    description: 'Collects the franchising and licensing fees of tricycle operators, as stated in the Order of Payment from the Biñan Tricycle Franchising and Regulatory Board (BTFRB).',
    tabs: walkIn({
      who: 'Tricycle owners or their authorized representative.',
      totalFee: 'As stated in the Order of Payment',
      totalTime: '5 minutes',
      requirements: [
        req('Order of Payment', 'Biñan Tricycle Franchising and Regulatory Board (BTFRB)')
      ],
      procedures: simplePayment({ fee: 'As stated in the Order of Payment' })
    })
  },

  // p. 119
  {
    service_name: 'Payment of Rental Fees of Real Properties Owned by the City',
    description: 'Collects the rental fees for the use of real properties owned by the City, as stated in the Order of Payment from the City Vice Mayor’s Office.',
    tabs: walkIn({
      who: 'Concerned individuals or their authorized representative.',
      totalFee: 'As stated in the Order of Payment',
      totalTime: '5 minutes',
      requirements: [
        req('Order of Payment', 'Office of the City Vice Mayor')
      ],
      procedures: simplePayment({
        verb: 'submit',
        fee: 'As stated in the Order of Payment',
        verifyAction: 'Verification of document.'
      })
    })
  }
];

// Same ID scheme as Forms/add_service.html
export const serviceIdFor = (officeId, serviceName) =>
  `${officeId}-${serviceName.toUpperCase().replace(/\s+/g, '-')}`;
