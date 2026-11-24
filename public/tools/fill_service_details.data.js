// Values used to fill EMPTY fields of existing services (Transaction Details, Step-by-Step Guide,
// Location and Contact). Source: LGU-BINAN 2026 Citizen's Charter (1st Edition).
// The runner never overwrites a field that already has a value.
//
// SERVICE_FILLS key = "<officeId>/<serviceId>" (Firestore document IDs).
//   tabs[i]   → fills tab i (by position). null = leave that tab alone.
//   steps[j]  → fills procedure j of that tab (by position).
//   source    → charter page (printed page number) or 'generated' when the service is not in the charter.

const CITY_HALL = (floor) => `${floor} Floor, City Hall Building, Brgy. Zapote, City of Binan, Laguna`;

// "List of Offices", charter pp. 383–385. Applied to every service of the office whose field is empty.
export const OFFICE_CONTACTS = {
  OCM:   { location: CITY_HALL('3rd'), contact_phone: '(049)513-5002 / (049)513-5003', contact_email: 'ocm@binan.gov.ph' },
  OCVM:  { location: CITY_HALL('2nd'), contact_phone: '(049)513-5006 / (049)513-5007', contact_email: 'cvmo@binan.gov.ph' },
  CHRDO: { location: CITY_HALL('3rd'), contact_phone: '(049)513-5013', contact_email: 'chrd@binan.gov.ph' },
  OCPO:  { location: CITY_HALL('3rd'), contact_phone: '(049)513-5070', contact_email: 'pop@binan.gov.ph' },
  OCBO:  { location: CITY_HALL('3rd'), contact_phone: '(049)513-5009', contact_email: 'cbo@binan.gov.ph' },
  OCLO:  { location: CITY_HALL('3rd'), contact_phone: '(049)513-5022 / (049)513-5023' },              // no email in charter
  OCGSO: { location: CITY_HALL('3rd'), contact_phone: '(049)513-5010 / (049)513-5011', contact_email: 'gso@binan.gov.ph' },
  ICTO:  { location: CITY_HALL('3rd'), contact_phone: '(049)513-5288', contact_email: 'icto@binan.gov.ph' },
  OCPDC: { location: CITY_HALL('3rd'), contact_phone: '(049)513-5018 / (049)513-5019', contact_email: 'cpdo@binan.gov.ph' },
  OCE:   { location: CITY_HALL('3rd'), contact_phone: '(049)513-5027 / (049)513-5026', contact_email: 'ceo@binan.gov.ph' },
  OBO:   { location: CITY_HALL('3rd'), contact_email: 'obo@binan.gov.ph' },                           // no phone in charter
  PESO:  { location: CITY_HALL('2nd'), contact_phone: '(049)513-5008 / (049)513-5075', contact_email: 'peso@binan.gov.ph' },
  OCIO:  { location: CITY_HALL('2nd'), contact_phone: '(049)513-5028 / (049)513-5029', contact_email: 'cio@binan.gov.ph' },
  OCA2:  { location: CITY_HALL('2nd'), contact_phone: '(049)513-5012', contact_email: 'oca@binan.gov.ph' },
  CENRO: { location: CITY_HALL('1st'), contact_phone: '(049)513-5096', contact_email: 'cenro@binan.gov.ph' },
  // Not in the List of Offices – taken from the PRS service page (p. 161–162)
  OCCO:  { location: CITY_HALL('3rd'), contact_phone: '(049)513-5000 / 0991-747-2585', contact_email: 'cco@binan.gov.ph' }
  // CHSLO: no location/contact anywhere in the charter – left empty on purpose.
};

const G2C = 'G2C – Government to Citizen';
const G2B = 'G2B – Government to Business';
const G2G = 'G2G – Government to Government';
const CONCERNED = 'Concerned individuals or their authorized representative.';
const CITY_OFFICES = 'All offices in the City Government of Biñan';

export const SERVICE_FILLS = {
  // ───────────── CENRO ─────────────
  'CENRO/CENRO-CLEARANCE': { source: 'p. 150', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'See Article T, Section 3T-02 of the 2016 Revised Revenue Code', total_processing_time: '35 minutes',
    steps: [
      { agency_actions: ['Receive filled-up Environmental Data Sheet and verify the application and requirements as to completeness and validity.', 'Recommend approval of the Environmental Clearance.', 'Review, approve and sign the Environmental Clearance.'] },
      { agency_actions: ['Release the Environmental Clearance.'] }
    ] }] },
  'CENRO/CENRO-CUT-TREES': { source: 'p. 155', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Php 50.00', total_processing_time: '2 days and 48 minutes',
    steps: [
      { agency_actions: ['Verify submitted requirements. If complete and in order, set schedule for inspection.', 'Conduct inspection and make recommendation.'] },
      { agency_actions: ['Receive payment and issue official receipt.', 'Issue Certificate of No Objection and endorsement to DENR-PENRO, who will issue the tree cutting permit.'] },
      { agency_actions: ['Release the Certificate of No Objection/Endorsement.'] }
    ] }] },
  'CENRO/CENRO-MRF': { source: 'p. 157', tabs: [{
    transaction_type: G2G, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '6 days and 10 minutes',
    steps: [
      { agency_actions: ['Verify submitted requirements. If complete and in order, set schedule for inspection.', 'Conduct validation, site inspection and make recommendation.', 'Endorse and recommend approval to the Mayor.'] },
      { agency_actions: ['Approve proposed project or training subject to standard disbursement and accounting procedures.'] }
    ] }] },
  'CENRO/CENRO-TREE-PARKS': { source: 'p. 158', tabs: [{
    transaction_type: G2G, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '6 days and 10 minutes',
    steps: [
      { agency_actions: ['Verify submitted requirements. If complete and in order, set schedule for inspection.', 'Conduct validation, site inspection and make recommendation.', 'Endorse and recommend approval to the Mayor.'] },
      { agency_actions: ['Approve proposed project.'] }
    ] }] },
  'CENRO/CENRO-WASTE-TRANSPORTER': { source: 'p. 152', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Php 1,550.00 + Inspection Fee dependent on type of vehicle', total_processing_time: '58 minutes',
    steps: [
      { agency_actions: ['Receive filled-up form and verify the application and requirements as to completeness and validity.', 'Prepare and issue order of payment.'] },
      { agency_actions: ['Receive payment and issue official receipt.', 'Prepare the Waste Transporter Certificate and recommend approval.', 'Review, approve and sign the Registration Certificate.'] },
      { agency_actions: ['Release the Waste Transporter Certificate.'] }
    ] }] },

  // ───────────── CHRDO ─────────────
  'CHRDO/CHRDO-201-FILES': { source: 'p. 226', tabs: [{
    transaction_type: G2G, who_may_avail: 'Officials and employees of the City Government of Biñan',
    total_fee: 'None', total_processing_time: '3 days',
    steps: [
      { agency_actions: ['Assess and receive request form.'], notes: 'All applications received after 5:00 PM or during weekends and holidays are deemed received at 8:00 AM of the next business day.' },
      { agency_actions: ['Prepare the requested document.', 'Validate the data and sign the requested document.', 'Release the document.'] }
    ] }] },
  'CHRDO/CHRDO-PLACEMENT': { source: 'p. 137', tabs: [{
    transaction_type: G2C, who_may_avail: 'Proposed appointee.',
    total_fee: 'None', total_processing_time: '2 days, 2 hours and 45 minutes',
    steps: [
      { agency_actions: ['Assess and receive all documents.'] },
      { agency_actions: ['Prepare the Position Description Form.', 'Prepare all documents for signature of the proposed appointee, department head, City Accountant and appointing authority: Appointment Papers, Certificate of Availability of Funds, Certification of the HRMPSB, Minutes of the HRMPSB, Oath of Office, Certificate of Assumption.', 'Sign all relevant documents.'] },
      { agency_actions: ['Sign the appointment papers.', 'Administer the Oath of Office.'] }
    ] }] },
  'CHRDO/CHRDO-RECRUITMENT': { source: 'p. 133', tabs: [{
    transaction_type: G2C, who_may_avail: 'Qualified applicants within the publication period. Residency is required for Department Head positions.',
    total_fee: 'None', total_processing_time: '10 minutes (walk-in); 3 business days (online)',
    steps: [
      { agency_actions: ['Receive and assess documents submitted.'] },
      { agency_actions: ['Receive applications with complete requirements within the publication period.'], notes: 'Applications may also be submitted online in PDF format to recruitment.chrd@binan.gov.ph. All applications received after 5:00 PM or during weekends and holidays are deemed received at 8:00 AM of the next business day.' }
    ] }] },
  'CHRDO/CHRDO-SELECTION': { source: 'p. 135', tabs: [{
    transaction_type: G2C, who_may_avail: 'Qualified applicants within the publication period. Residency is required for Department Head positions.',
    total_fee: 'None', total_processing_time: '15 days, 2 hours and 55 minutes',
    steps: [
      { agency_actions: ['Notify the applicant and facilitate the administration of the employment examination (written, personality/temperament test and functional examination).', 'Check, tally, validate and record the results.', 'Inform applicants of the examination results via email (or contact number). Only those who meet the threshold are scheduled for the HRMPSB interview.'] },
      { agency_actions: ['Interview the applicants and prepare matrix of the applicants for consideration of the appointing authority.'] },
      { agency_actions: ['The appointing authority chooses from the top 5 qualified applicants.', 'HR informs the applicants of the decision of the appointing authority via email or phone call.'] }
    ] }] },

  // ───────────── CHSLO ─────────────
  'CHSLO/CHSLO-COMPLAINT-LETTER': { source: 'p. 217', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED, total_fee: 'None', total_processing_time: '2 hours',
    steps: [{ agency_actions: ['Receive and check the submitted complaint letter for reference and validation, which is a requirement for the inquiry and investigation.'] }] }] },
  'CHSLO/CHSLO-HOA-ORIENTATION': { source: 'p. 218', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED, total_fee: 'None', total_processing_time: '5 days',
    steps: [{ agency_actions: ['Receive and schedule the orientation.'] }] }] },
  'CHSLO/CHSLO-HOA-REGISTRATION': { source: 'p. 215', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED, total_fee: 'None', total_processing_time: '10 days',
    steps: [{ agency_actions: ['Receive and check the submitted documents for compliance with the requirements for HOA registration before endorsing to DHSUD.'] }] }] },
  'CHSLO/CHSLO-HOA-UPDATING': { source: 'p. 216', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED, total_fee: 'None', total_processing_time: '10 days',
    steps: [{ agency_actions: ['Receive and check the submitted documents for compliance with the requirements for annual updating of HOA before endorsing to DHSUD.'] }] }] },

  // ───────────── ICTO ─────────────
  'ICTO/ICTO-ONLINE-HELPDESK': { source: 'p. 220', tabs: [{
    transaction_type: G2G, who_may_avail: 'Employees of the City Government of Biñan',
    total_fee: 'None', total_processing_time: '30 minutes – 24 working hours (depends on the complexity of the request)',
    steps: [
      { agency_actions: ['Monitor incoming tickets through the system and ensure that all tickets are attended to.', 'Assist clients without an employee account in account creation/enrollment.'], online_link: 'https://icto.binan.gov.ph/support', notes: 'Walk-in clients may use the ICTO Client Kiosk to log in and create a ticket.' },
      { agency_actions: ['Claim and review the support ticket.', 'Conduct an initial assessment and attempt troubleshooting to diagnose the issue.', 'Perform appropriate action and recommendation (e.g. not repairable, recommend replacement).'], notes: 'Processing time depends on the complexity of the request.' },
      { agency_actions: ['The agent or client closes the ticket after completion of the request.'] }
    ] }] },
  'ICTO/ICTO-PROJECT-REQUEST': { source: 'p. 222', tabs: [{
    transaction_type: G2G, who_may_avail: 'Offices and Departments of the City Government of Biñan, or an authorized representative of their department',
    total_fee: 'None', total_processing_time: '1 – 12 months (depends on the complexity and timeline of the project)',
    steps: [
      { agency_actions: ['Receive the request form and forward it to the Department Head for review.'] },
      { agency_actions: ['Review and assess the requested project for feasibility; the Department Head and division-in-charge provide recommendations.', 'Send an email to the requesting party regarding the disposition.'], notes: 'If feasible, the project proceeds to Requirements Gathering and Project Development and Testing. Processing time may vary from 1 to 12 months depending on the complexity of the project.' },
      { agency_actions: ['Update the Project Request form and forward it to the respective signatories.', 'Update the Project Request Log.'] }
    ] }] },
  'ICTO/ICTO-TECH4ED-CLIENTS': { source: 'p. 128', tabs: [{
    transaction_type: G2C, who_may_avail: 'All',
    total_fee: 'None', total_processing_time: '10 minutes – 1 hour (depends on the service/s chosen)',
    steps: [
      { agency_actions: ['Check completeness of required information.'] },
      { agency_actions: ['Designate the appropriate area for the service/s chosen by the client.'], notes: 'Computer use is limited to a maximum of 1 hour based on check-in.' },
      { agency_actions: ['Conduct a quick check of the workstation to ensure it is ready for the next user.', 'Indicate log-out time of the user and ensure services have been completed.'] }
    ] }] },
  'ICTO/ICTO-TECH4ED-TRAINING': { source: 'p. 130', tabs: [{
    transaction_type: G2C, who_may_avail: 'Interested individuals',
    total_fee: 'None', total_processing_time: '1 – 2 weeks (based on the training schedule)',
    steps: [
      { agency_actions: ['Regularly update training schedules on the Tech4Ed announcement board and/or Facebook page.', 'Receive and review request letters.', 'Assess feasibility based on schedule, resources and existing activities, and notify the requester of the result.'] },
      { agency_actions: ['Receive and process registrations.', 'Verify completeness of participant information.'] },
      { agency_actions: ['Send confirmation and relevant instructions.', 'Notify registrants if slots are full and provide alternative options, if available.'] },
      { agency_actions: ['Facilitate and deliver training programs, conduct assessments and provide guidance throughout the session.'] },
      { agency_actions: ['Collect post-training requirements and evaluation forms.'] },
      { agency_actions: ['Verify compliance with requirements and issue certificates.'], notes: 'Certificates are issued to participants who meet the requirements and complete the post-training evaluation.' }
    ] }] },

  // ───────────── OBO ─────────────
  'OBO/OBO-ANNUAL': { source: 'p. 37', tabs: [{
    transaction_type: G2B, who_may_avail: 'Applicants who will renew their business permit and who will apply for a new business permit.',
    total_fee: 'Permit fees are based on the IRR of the National Building Code (PD 1096)', total_processing_time: '30 minutes',
    steps: [
      { agency_actions: ['Accept the accomplished business permit application form.'] },
      { agency_actions: ['Issue the Order of Payment.'] },
      { agency_actions: ['Receive the Official Receipt and check the documents for final approval of the Building Official.', 'The Building Official evaluates and approves the application.', 'Release the approved business permit application.'] }
    ] }] },
  'OBO/OBO-CFEI': { source: 'p. 35', tabs: [{
    transaction_type: G2B, who_may_avail: 'Applicants applying for reconnection, remodel, upgrading, downgrading, relocation, temporary, transfer and net metering of electric service in MERALCO.',
    total_fee: 'Permit fees are based on the IRR of the National Building Code of the Philippines (PD 1096)', total_processing_time: '1 day, 1 hour and 5 minutes',
    steps: [
      { agency_actions: ['Receive the requirements and interview the applicant.', 'The inspector has the Inspection Form filled up by the client and schedules the site inspection.', 'The inspector visits the site, takes pictures of the area inspected and submits them to the assigned staff.'] },
      { agency_actions: ['Assess the application; if requirements are incomplete, return the application for completion.', 'Issue the Order of Payment if documents are complete.'] },
      { agency_actions: ['Receive the Official Receipt and check the documents for final approval of the Building Official.', 'The Building Official evaluates and approves the application.', 'Release the approved CFEI.'] }
    ] }] },
  'OBO/OBO-CONST': { source: 'p. 30', tabs: [{
    transaction_type: G2B, who_may_avail: 'Owner/applicant who will proceed with the construction, installation, addition, alteration, renovation, conversion, repair, moving, demolition or other work activity.',
    total_fee: 'Permit fees are based on the National Building Code of the Philippines (type of occupancy, total floor area, cost of the project and height of the building/structure)', total_processing_time: '2 days, 2 hours and 32 minutes',
    steps: [
      { agency_actions: ['Initial review, checking and assessment of all required documents; issue a Claim Stub with control number and return date if complete, or return with a Return Slip if incomplete.', 'Endorse the application to the Bureau of Fire Protection (BFP) for processing of the Fire Safety Evaluation Certificate (FSEC).', 'Endorse the application to the City Planning and Development Office for processing of the Zoning/Locational Clearance.', 'Check/review the plans and documents for minimum compliance with PD 1096 and issue the Order of Payment for the building permit.', 'OBO, BFP and CPDO conduct the site inspection.'], notes: 'If the application is unacted by the BFP after one (1) day, the OBO will process the permit subject to Post Inspection of the BFP.' },
      { agency_actions: ['The City Treasurer’s Office issues the Official Receipt for the Orders of Payment from the OBO, BFP and CPDO.'] },
      { agency_actions: ['Receive and validate the claim stub and Official Receipt.', 'Collate all issued clearances and permits and assign control numbers for the Building Official’s signature.', 'The Building Official signs the building permits.', 'Release the permit to the client.'] }
    ] }] },
  'OBO/OBO-OCCUPANCY': { source: 'p. 40', tabs: [{
    transaction_type: G2B, who_may_avail: 'Applicants with approved building permit prior to occupancy.',
    total_fee: 'Fees are based on the IRR of the National Building Code of the Philippines', total_processing_time: '3 hours and 5 minutes',
    steps: [
      { agency_actions: ['Receive and check the form and requirements and notify the client of the schedule of site inspection.', 'Inspect the site to verify its status and submit the inspection report.'] },
      { agency_actions: ['Issue the Order of Payment if documents are complete.'] },
      { agency_actions: ['Receive the Official Receipt and check the documents for final approval of the Building Official.', 'The Building Official evaluates and approves the application.', 'Release the approved Certificate of Occupancy.'] }
    ] }] },

  // ───────────── Office of the City Accountant ─────────────
  'OCA2/OCA2-PAYSLIP': { source: 'p. 239', tabs: [{
    transaction_type: G2C, who_may_avail: 'Regular employees',
    total_fee: 'None', total_processing_time: '9 minutes',
    steps: [
      { agency_actions: ['Receive the Certified True Copy Request Form and check or fill in the employee’s information.', 'Check and issue a certified copy of the employee’s pay slip.', 'Sign and certify the form.'] },
      { agency_actions: ['Release the certified pay slip and forms.'] }
    ] }] },
  'OCA2/OCA2-PHILHEALTH': { source: 'p. 193', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '44 minutes',
    steps: [
      { agency_actions: ['Look for the claimant’s documents.', 'If the certification is available, prepare the FURS; if not, notify Ospital ng Biñan to follow up with PhilHealth.', 'Check supporting documents and review completeness.', 'Prepare the disbursement voucher.', 'The City Accountant signs and approves the disbursement voucher, which is forwarded to the Mayor’s Office and then to the Treasurer’s Office for check preparation.'] },
      { agency_actions: ['Release the check to the claimant.'] }
    ] }] },
  'OCA2/OCA2-VOUCHERS': { source: 'p. 236', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '41 minutes',
    steps: [
      { agency_actions: ['Check supporting documents and review completeness.', 'Prepare the disbursement voucher.', 'The City Accountant signs and approves the disbursement voucher.', 'Forward the signed voucher to the Requesting Office, the Mayor’s Office, then the Treasurer’s Office for check preparation.'] },
      { agency_actions: ['Release the check to the claimant.'] }
    ] }] },

  // ───────────── Budget / Cooperatives ─────────────
  'OCBO/OCBO-OBLIGATION-SLIP': { source: 'p. 227', tabs: [{
    transaction_type: G2G, who_may_avail: 'All offices in the City Government of Biñan and DepEd',
    total_fee: 'None', total_processing_time: '10 minutes',
    steps: [{ agency_actions: ['Receive and assess the completeness of the requirements.', 'Verify availability of appropriations and prepare the Obligation Slip.', 'Certify and sign the Obligation Slip.', 'Record and release the Obligation Slip.'] }] }] },
  'OCCO/OCCO-PRS': { source: 'p. 161', tabs: [{
    transaction_type: G2C, who_may_avail: 'Prospective members having a common bond of interest who are willing to form a primary cooperative.',
    total_fee: 'None', total_processing_time: '1st Session – 2 hours, 30 minutes; 2nd Session – 2 hours, 20 minutes',
    steps: [
      { agency_actions: ['Receive the TRF and instruct the client to prepare and submit the letter of request addressed to CDA for the conduct of PRS.'] },
      { agency_actions: ['Receive the Letter of Request.', 'Coordinate with the CDA Regional Office and Biñan CDA Specialist for acknowledgment of the request and confirmation of schedule.'] },
      { agency_actions: ['Finalize the PRS schedule with the CDA Specialist and client (date, venue, time and platform).', 'Prepare venue and meals for face-to-face set-up.'] },
      { agency_actions: ['Assist in the conduct of PRS.'] }
    ] }] },

  // ───────────── Office of the City Engineer ─────────────
  'OCE/OCE-BRGY': { source: 'p. 46', tabs: [{
    transaction_type: G2C, who_may_avail: 'Barangays and concerned citizens',
    total_fee: 'None', total_processing_time: '16 days, 8 hours and 5 minutes',
    steps: [
      { agency_actions: ['Receive the request letter from the barangay.', 'The Office of the Mayor forwards the approved letter to the CEO.', 'The CEO conducts site inspection and prepares the detailed plan and Program of Works.', 'The CEO forwards the completed Program of Works and detailed plans to the Barangay Captain.'] },
      { agency_actions: ['The Barangay Captain gives the CEO a copy of the approved Program of Works, detailed plans, contract and Notice to Proceed.', 'The CEO schedules and conducts the inspection of the project with the contractor.', 'The CEO conducts monitoring inspections until completion of the project.'] },
      { agency_actions: ['The Barangay Captain submits the contractor’s billing requirements to the CEO.', 'The CEO conducts inspection and prepares the documentary requirements for payment.', 'The CEO submits the completed billing documents to the barangay for processing of payment.'] }
    ] }] },
  'OCE/OCE-IMPL': { source: 'p. 43', tabs: [{
    transaction_type: G2C, who_may_avail: 'Contractors',
    total_fee: 'None', total_processing_time: '1 day, 3 hours and 50 minutes',
    steps: [
      { agency_actions: ['Schedule site inspection and bring detailed plans and Program of Works.', 'Conduct inspection during project implementation.'] },
      { agency_actions: ['Provide the list of requirements for processing of payment.', 'Conduct site inspection and prepare inspection report, bar chart, statement of time elapsed, certificate of completion, punch list, quality inspection list and statement of work accomplished.', 'Submit copy of signed documents to COA-TAS for request for inspection.', 'Submit complete billing documents to the City Accounting Office for payment.'] }
    ] }] },
  'OCE/OCE-PREP': { source: 'p. 42', tabs: [{
    transaction_type: `${G2C}; ${G2G}`, who_may_avail: 'Barangays, subdivisions, schools and concerned citizens',
    total_fee: 'None', total_processing_time: '16 days, 3 hours and 25 minutes',
    steps: [{ agency_actions: ['Receive the request letter endorsed by the Office of the City Mayor.', 'Conduct site inspection and prepare the Site Inspection Verification Report.', 'Prepare detailed plans.', 'Prepare the Program of Works.', 'Submit detailed plans and Program of Works for approval of the City Mayor.', 'Submit the proposed project to the City Budget Office for budget allocation.', 'Submit the approved project to the Bids and Awards Committee.'] }] }] },
  'OCE/OCE-REPAIR': { source: 'p. 45', tabs: [{
    transaction_type: G2C, who_may_avail: 'Barangays, subdivisions, and concerned citizens',
    total_fee: 'None', total_processing_time: '2 days, 1 hour and 30 minutes',
    steps: [{ agency_actions: ['The Barangay Captain brings the request to the City Mayor’s Office/City Engineering Office.', 'After approval, the CEO schedules inspection of the site.', 'The electrical section of the CEO conducts inspection and prepares the list of materials/supplies needed.', 'The electricians proceed to the site and repair the streetlights.', 'The electricians take pictures of the repaired streetlights and record the activity in the office logbook.'] }] }] },

  // ───────────── General Services ─────────────
  'OCGSO/OCGSO-DISPOSAL': { source: 'p. 233', tabs: [{
    transaction_type: 'G2G, G2B', who_may_avail: CITY_OFFICES,
    total_fee: 'None', total_processing_time: '2 – 3 days',
    steps: [{ agency_actions: ['Inspect and verify the condition of the PPE to be returned to the GSO.', 'Update the Inventory and Inspection Report of Unserviceable Property (IIRUP) for approval of the inspection officer, General Services Officer and City Mayor.', 'Furnish COA and the Disposal Committee with the updated IIRUP upon accumulation of unserviceable properties.', 'Conduct an ocular inspection, determine the mode of disposal and perform an auction.', 'Update the book of records on the final dropping of the disposed items.'] }] }] },
  'OCGSO/OCGSO-MAINTENANCE': { source: 'p. 234', tabs: [{
    transaction_type: 'G2G, G2B', who_may_avail: CITY_OFFICES,
    total_fee: 'None', total_processing_time: '4 – 5 days',
    steps: [{ agency_actions: ['Review the request and perform a random check-up on the vehicle or air-conditioning unit.', 'After the actual CPM, verify that the service corresponds to the request.', 'Record and update the CPM History Record.'], notes: 'The request process shall be in accordance with the Procurement Control Procedure.' }] }] },
  'OCGSO/OCGSO-ORCR': { source: 'p. 230', tabs: [{
    transaction_type: 'G2G, G2B', who_may_avail: CITY_OFFICES,
    total_fee: 'None', total_processing_time: '3 – 5 days',
    steps: [
      { agency_actions: ['Identify the government vehicles due for renewal of registration and retrieve their latest OR/CR.', 'Schedule the vehicles and proceed to the accredited Emission Testing Center.', 'Ensure payment of registration renewal/insurance premiums and forward the disbursement to the City Accounting Office.'] },
      { agency_actions: ['Claim the new registration papers and furnish a copy to the accountable custodian of the service vehicle.'] }
    ] }] },
  'OCGSO/OCGSO-PROCUREMENT': { source: 'p. 229', tabs: [{
    transaction_type: 'G2G, G2B', who_may_avail: CITY_OFFICES,
    total_fee: 'None', total_processing_time: '15 days',
    steps: [
      { agency_actions: ['Review the documents (RS/PR, Market Scoping Form, PPMP).', 'Process budget allotment, cash availability, BAC Resolution and posting in PhilGEPS.'] },
      { agency_actions: ['Prepare and approve the Canvass, Abstract of Quotations, Declaration and Recommendation, Notice of Award, Purchase Order and Notice of Delivery.', 'Forward documents to the Budget Office and Accounting Office.'] },
      { agency_actions: ['Prepare and approve the Inspection and Acceptance Report, Property Acknowledgment Report and Inventory Custodian Slip.'] }
    ] }] },
  'OCGSO/OCGSO-TAGGING-INVENTORY': { source: 'p. 232', tabs: [{
    transaction_type: G2G, who_may_avail: CITY_OFFICES,
    total_fee: 'None', total_processing_time: '3 – 4 days',
    steps: [
      { agency_actions: ['Receive and countercheck items endorsed by the GSO and ensure a copy of the PAR/ICS.', 'Prepare Inventory Tag Stickers and ensure proper placement on each PPE.'] },
      { agency_actions: ['Inspect and verify the condition of the PPE to be returned and/or transferred.', 'Update the Report on the Physical Count of Property, Plant and Equipment (RPCPPE).'] }
    ] }] },

  // ───────────── City Information Office ─────────────
  'OCIO/OCIO-BENCHMARKING': { source: 'p. 166', tabs: [{
    transaction_type: `${G2G}; ${G2C}`, who_may_avail: 'Government offices and the public',
    total_fee: 'None', total_processing_time: '1 hour',
    steps: [
      { agency_actions: ['Receive the Benchmarking Activity Request Letter and coordinate with the Mayor’s Office and/or concerned department.'] },
      { agency_actions: ['Provide the Record Logbook (Benchmarking Activity) upon arrival of the client in the city.'] },
      { agency_actions: ['Assist the clients during the benchmarking activity.'], notes: 'Time depends on the number of facilities to be visited.' }
    ] }] },
  'OCIO/OCIO-FDPP': { source: 'p. 165', tabs: [{
    transaction_type: `${G2G}; ${G2C}`, who_may_avail: 'Government offices and the public',
    total_fee: 'None', total_processing_time: '5 minutes',
    steps: [{ agency_actions: ['Publish the Full Disclosure Policy (FDP) documents at www.binan.gov.ph and display them at the City Hall Lobby, Sentrong Pangkultura ng Biñan and Ospital ng Biñan.'], online_link: 'https://www.binan.gov.ph' }] }] },
  'OCIO/OCIO-ONLINE-INQ': { source: 'p. 163', tabs: [{
    transaction_type: G2C, who_may_avail: 'Public or concerned individuals',
    total_fee: 'None', total_processing_time: '5 minutes',
    steps: [
      { agency_actions: ['Assess the inquiry or information needed.'] },
      { agency_actions: ['Issue the needed information or provide an answer to the inquiry.'] }
    ] }] },
  'OCIO/OCIO-PHONE-INQ': { source: 'p. 164', tabs: [{
    transaction_type: G2C, who_may_avail: 'Public or concerned individuals',
    total_fee: 'None', total_processing_time: '3 minutes',
    steps: [{ agency_actions: ['Answer the phone call and provide the needed information.'] }] }] },
  'OCIO/OCIO-TARPAULIN': { source: 'p. 235', tabs: [{
    transaction_type: G2G, who_may_avail: 'Government offices and other departments',
    total_fee: 'None', total_processing_time: '1 – 2 days',
    steps: [
      { agency_actions: ['Receive the Tarpaulin Job Request Form.'] },
      { agency_actions: ['Receive the file, check the content and print.'] },
      { agency_actions: ['Notify the client once the tarpaulin is done and let the client sign the receiving logbook.'] }
    ] }] },

  // ───────────── City Legal Office ─────────────
  'OCLO/OCLO-ADVICE': { source: 'p. 196', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '45 minutes',
    steps: [{ agency_actions: ['Referral of assignment.', 'Interview of client.', 'Refer to the Legal Officer for consultation.', 'Rendering of legal advice.'] }] }] },
  'OCLO/OCLO-CONTRACT-REVIEW': { source: 'p. 197', tabs: [{
    transaction_type: G2C, who_may_avail: 'Biñan City Government officials and employees, and Biñan City constituents.',
    total_fee: 'None', total_processing_time: '40 minutes',
    steps: [{ agency_actions: ['Receive the required documents and check for completeness.', 'Review contracts and provide comments.', 'Return the reviewed documents with comments and revisions.'] }] }] },

  // ───────────── Office of the City Mayor ─────────────
  'OCM/OCM-CCTV': { source: 'p. 124', tabs: [{
    transaction_type: G2C, who_may_avail: 'Any concerned individual',
    total_fee: 'None', total_processing_time: '21 minutes',
    steps: [
      { agency_actions: ['Review and validate the submitted documents.'] },
      { agency_actions: ['The City Administrator approves the review upon validation of the documents.', 'Sign and record the CCTV Record Review Form in the CCTV Incoming/Outgoing Logbook.', 'Submit the form to the City Command Control and Communication Center.'] }
    ] }] },
  'OCM/OCM-OBLIGATION-SLIP': { source: 'p. 225', tabs: [{
    transaction_type: G2G, who_may_avail: 'Biñan Local Government Unit',
    total_fee: 'None', total_processing_time: '1 day and 25 minutes',
    steps: [
      { agency_actions: ['Receive the submitted documents and record them in the corresponding logbook.', 'Check the documents submitted.', 'Endorse the documents to the City Mayor or City Administrator for review, approval and signature.'] },
      { agency_actions: ['Release the approved and signed documents to the concerned department.'] }
    ] }] },
  'OCM/OCM-REQUESTS': { source: 'p. 122', tabs: [{
    transaction_type: G2C, who_may_avail: 'Various agencies, NGOs and private individuals',
    total_fee: 'None', total_processing_time: '1 day and 20 minutes',
    steps: [{ agency_actions: ['Record the submitted documents in the Correspondence Logbook.', 'Submit the document to the Administrative Staff for review and endorsement to the City Administrator and/or City Mayor.', 'Review the documents for proper action.', 'For documents needing approval, contact the agency, NGO or private individual for its release.', 'Record the released document in the Correspondence Logbook.'] }] }] },
  'OCM/OCM-TRAVEL-ORDER': { source: 'p. 224', tabs: [{
    transaction_type: G2G, who_may_avail: 'Local government elected officials and department heads.',
    total_fee: 'None', total_processing_time: '1 day and 13 minutes',
    steps: [
      { agency_actions: ['Receive the submitted documents and record them in the Travel Order Logbook (official business) or Incoming/Outgoing Logbook (vacation leave).'] },
      { agency_actions: ['Forward the documents to the City Administrator or City Mayor for approval.', 'Release the approved Travel Order Form to the official and have the logbook signed.'] },
      { agency_actions: ['Receive the submitted Travel Order documents.'] }
    ] }] },
  'OCM/OCM-WEDDING': { source: 'p. 120', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '15 minutes',
    steps: [
      { agency_actions: ['Validate and check the completeness and authenticity of the requirements.'] },
      { agency_actions: ['Secure the couple’s preferred wedding date and time and verify availability.', 'Record the couple’s names, date and time in the Civil Wedding Logbook once availability is confirmed.', 'Endorse the documentary requirements to the City Civil Registrar Office.'] }
    ] }] },
  // Not in the charter – values derived from the service's own existing steps.
  'OCM/OCM-CLEARANCE': { source: 'generated', tabs: [{
    transaction_type: G2C, who_may_avail: 'Individuals who need a Mayor’s Clearance for employment, PNP application, firearms license or legal purposes.',
    total_fee: 'None for Biñan residents; Php 100.00 for non-residents', total_processing_time: '10 minutes',
    steps: [
      { agency_actions: ['Receive and check the documentary requirements.'] },
      { agency_actions: ['Issue the order of payment (non-residents) and official receipt.'] },
      { agency_actions: ['The City Mayor or City Administrator approves the Mayor’s Clearance.'] },
      { agency_actions: ['Release the clearance to the client and file one copy with the Records Section.'] }
    ] }] },
  'OCM/OCM-HAPI': { source: 'generated', tabs: [{
    transaction_type: G2C, who_may_avail: 'Poor, marginalized, vulnerable and disadvantaged individuals who need medical assistance.',
    total_fee: 'None', total_processing_time: '7 minutes',
    steps: [
      { agency_actions: ['Receive and check the photocopies of the requirements.'] },
      { agency_actions: ['The City Mayor or City Administrator approves the HAPI Certification.'] },
      { agency_actions: ['Release the certification and forward the requirements to the Records Section for submission to the Accounting Office.'] }
    ] }] },
  'OCM/OCM-MERALCO': { source: 'generated', tabs: [{
    transaction_type: G2C, who_may_avail: 'Applicants with an approved electrical permit and inspection from the City Engineer/Building Official Office.',
    total_fee: 'None', total_processing_time: '8 minutes',
    steps: [
      { agency_actions: ['Receive and check the approved documentary requirements.'] },
      { agency_actions: ['Release the Meralco Waiver certification and have the client sign the logbook.'] }
    ] }] },

  // ───────────── City Planning and Development ─────────────
  'OCPDC/OCPDC-ASSISTANCE': { source: 'p. 214', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'None', total_processing_time: '6 minutes',
    steps: [{ agency_actions: ['Receive, verify and validate the requirements for completeness.', 'Send the data to the client.'] }] }] },
  'OCPDC/OCPDC-CLEARANCE-BUILDING': { source: 'p. 208', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Fees are based on the HLURB Regulatory Board 2013 Schedule of Fees', total_processing_time: '14 minutes (194 minutes if site inspection is required)',
    steps: [
      { agency_actions: ['Receive and review all submitted documents from the OBO.', 'Verify the zoning classification. If compliant, prepare the Certificate on Zoning Classification; if not, conduct a site inspection.'] },
      { agency_actions: ['Assess fees and issue Orders of Payment for certificates and clearances.', 'Endorse the assessment form/orders of payment to the OBO.'] },
      { agency_actions: ['Prepare the Locational Clearance.', 'Endorse the approved Locational Clearance and Certificate on Zoning Classification to the OBO.'], notes: 'The OBO releases the Locational Clearance and Certificate on Zoning Classification to the client.' }
    ] }] },
  'OCPDC/OCPDC-CLEARANCE-BUSINESS': { source: 'p. 207', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Php 200.00', total_processing_time: '6 minutes (186 minutes if included in the negative list)',
    steps: [{ agency_actions: ['Receive, verify and validate the requirements for compliance and completeness.', 'If included in the negative list, conduct a site inspection.', 'Prepare and issue the electronically signed Locational Clearance and endorse it to BPLO staff for releasing.'], notes: 'Additional requirements and a site inspection apply if the business is included in the negative list.' }] }] },
  'OCPDC/OCPDC-DEV-PERMIT': { source: 'p. 210', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Fees are based on the HLURB Regulatory Board 2013 Schedule of Fees', total_processing_time: '46 minutes (586 minutes including evaluation and site inspection)',
    steps: [
      { agency_actions: ['Receive, verify and validate the requirements for completeness and preliminary assessment.', 'Comprehensive evaluation of technical documents and compliance.', 'Conduct site inspection.', 'Final review by the City Planning and Development Coordinator.'] },
      { agency_actions: ['Assess fees and issue Orders of Payment.'] },
      { agency_actions: ['Prepare the Development Permit.', 'Secure the recommendation of the City Planning and Development Coordinator for approval of the Local Chief Executive.', 'Release the approved and signed Development Permit to the client.'] }
    ] }] },
  'OCPDC/OCPDC-ZONING-CERT': { source: 'p. 212', tabs: [{
    transaction_type: G2C, who_may_avail: CONCERNED,
    total_fee: 'Fees are based on the HLURB Regulatory Board 2013 Schedule of Fees', total_processing_time: '14 minutes',
    steps: [
      { agency_actions: ['Receive, verify and validate the requirements for completeness.', 'Verify the zoning classification.'] },
      { agency_actions: ['Assess fees and issue Orders of Payment.'] },
      { agency_actions: ['Prepare the Certificate on Zoning Classification.', 'Release the Certificate on Zoning Classification.'] }
    ] }] },

  // ───────────── Population / Vice Mayor ─────────────
  'OCPO/OCPO-PMO': { source: 'p. 159', tabs: [{
    transaction_type: G2C, who_may_avail: 'Would-be couples required to attend the Pre-Marriage Orientation for their marriage license.',
    total_fee: 'None', total_processing_time: '4 hours and 15 minutes',
    steps: [
      { agency_actions: ['Interview applicant couples for the Responsible Parenthood and Family Planning Form-1.', 'Administer the Marriage Expectation Inventory (MEI) form.', 'Provide the PMO session schedule for applicant couples 18 years old and above, with reminders on things to bring.'] },
      { agency_actions: ['Facilitate the Pre-Marriage Orientation seminar.', 'Issue the Certificate of Compliance upon completion.'] },
      { agency_actions: ['Release the Certificate of Compliance.', 'Have the couple sign the receiving copy of the released certificate.'] }
    ] }] },
  'OCVM/OCVM-LEGIS': { source: 'p. 125', tabs: [{
    transaction_type: G2C, who_may_avail: 'Constituents of the City of Biñan, government agencies/offices, and different organizations/groups',
    total_fee: 'Php 100.00 per page', total_processing_time: '22 minutes',
    steps: [
      { agency_actions: ['Have the requestor fill up the Request Slip (Form No. CVMO-012-1) specifying the needed document and purpose.', 'Record the accomplished Request Slip in the Receiving Log Book (Form No. CVMO-013-Ø).'], notes: 'If the request is “FOR AGENDA INCLUSION ONLY”, no payment is required. Requests for certification proceed to payment.' },
      { agency_actions: ['Check availability of the documents requested, assess the fees (Form No. CVMO-014-Ø) and secure approval from the Secretary to the Sanggunian.', 'The requestor pays the assessed fee at the Office of the City Treasurer, Cash Division.'], notes: 'The Official Receipt number shall be indicated in the Request Form.' },
      { agency_actions: ['Check the Official Receipt.', 'Prepare the documents, stamp “Certified True Copy” and have them signed by the Secretary to the Sanggunian or an authorized signatory.', 'Secure acknowledgment of receipt from the requestor and release the requested document.'] }
    ] }] },

  // ───────────── PESO ─────────────
  'PESO/PESO-ACCREDITATION': { source: 'p. 142', tabs: [{
    transaction_type: G2C, who_may_avail: 'Employers / industry partners',
    total_fee: 'None', total_processing_time: '9 minutes',
    steps: [
      { agency_actions: ['Provide a list of documentary requirements to be submitted.'] },
      { agency_actions: ['Issue the PESO Accreditation Certificate upon validation of requirements.'] },
      { agency_actions: ['Encode the accredited PESO partner’s details in the Local Economic Database.'] },
      // steps 4–5 are not in the charter (generated from the existing step descriptions)
      { agency_actions: ['Receive the letter of intent and send the confirmation slip for the upcoming activity.'] },
      { agency_actions: ['Receive the signed confirmation slip and confirm the employer’s participation.'] }
    ] }] },
  'PESO/PESO-OFW-HELPDESK': { source: 'p. 144', tabs: [{
    transaction_type: G2C, who_may_avail: 'OFW returnees and their families from Biñan City',
    total_fee: 'None', total_processing_time: '5 – 6 minutes',
    steps: [
      { agency_actions: ['Collect photocopies and counter-check original documents; provide the OFW form and Case Intake Sheet.', 'For OWWA benefits: provide the list of programs and services, requirements and forms needed, and refer to OWWA for submission.'] },
      { agency_actions: ['Verify the filled-up forms and documents.'] },
      // step 3 is not in the charter (generated from the existing step description)
      { agency_actions: ['Release the assistance to the OFW returnee on the scheduled date.'] }
    ] }] },
  'PESO/PESO-REFERRALS': { source: 'p. 139', tabs: [{
    transaction_type: G2C, who_may_avail: 'Jobseekers',
    total_fee: 'None', total_processing_time: 'Walk-in: 16 minutes; Online: 4 minutes',
    steps: [
      { agency_actions: ['Ensure complete details are provided in the registration sheet (walk-in) or that the automated form is sent to the applicant (online).'] },
      {},
      { agency_actions: ['Assess applicant information and qualifications and conduct the Pre-Employment Orientation Seminar; issue a referral letter as necessary.', 'For online applicants, review and ensure complete details are provided.'] },
      { agency_actions: ['Release the referral letter (printed for walk-in, PDF/JPG for online applicants).'] },
      { agency_actions: ['Encode the details of the resumé or bio-data in the PESO applicants database.'] }
    ] }] },
  'PESO/PESO-SPES': { source: 'p. 146', tabs: [{
    transaction_type: G2C, who_may_avail: 'Students aged 15 – 30 years old',
    total_fee: 'None', total_processing_time: '10 minutes',
    steps: [
      { agency_actions: ['Counter-check and verify the submitted documents.'] },
      { agency_actions: ['Schedule the 20-day work period and assign specific work.'] },
      { agency_actions: ['Counter-check and verify the submitted documents.'] },
      { agency_actions: ['Distribute salary.'] }
    ] }] },

  // ───────────── Treasurer 1 – only missing parts ─────────────
  'OCT/OCT-CEDULA': { source: 'p. 109', tabs: [null, {   // tab 2 "Business and Corporations"
    transaction_type: G2C, who_may_avail: 'Company/Business owners or their authorized representative',
    total_fee: 'Depends on the gross income derived from business and assessed value of real property', total_processing_time: '10 minutes',
    steps: [
      { agency_actions: ['Assessment of tax to pay.'] },
      { agency_actions: ['Issuance of cedula.'] },
      { agency_actions: ['Secure the duplicate and triplicate copies of duly signed cedula.'] }
    ] }] },
  'OCT/OCT-PROFESSIONAL': { source: 'p. 106', tabs: [{ steps: [{}, { agency_actions: ['Issuance of official receipt.'] }] }] },

  // ───────────── Civil Registrar – blank step fees ─────────────
  'OCCR/OCCR-COURT-DECREE': { source: 'p. 82', tabs: [{ steps: [{}, {}, { fee: 'None' }] }] },
  'OCCR/OCCR-LEGAL-INST': { source: 'p. 93', tabs: [{ steps: [{}, {}, { fee: 'None' }] }] },

  // ───────────── DTI – not in charter ─────────────
  'DTI-NEGOSYO-CENTER-OFFICE/DTI-NEGOSYO-CENTER-OFFICE-APPLICATION-FOR-BUSINESS-NAME-REGISTRATION': { source: 'generated', tabs: [{
    steps: [{}, { agency_actions: ['Validation of the business name registration fee payment.'] }] }] }
};

// Treasurer "Release" steps (client step "Receive and double check your official receipt").
// The charter puts the OR issuance in the payment step, so the release step only hands it over.
export const RELEASE_STEP_ACTION = {
  match: (officeId, step) => ['OCT', 'OFFICE-OF-THE-CITY-TREASURER-2'].includes(officeId)
    && /^release$/i.test(String(step.process_name || '').trim()),
  value: (step) => /scanned copy/i.test(step.process_description || '')
    ? ['Release of the physical official receipt upon presentation of the scanned copy and a valid ID.']
    : /cedula/i.test(step.process_description || '')
      ? ['Release of the duly signed cedula.']
      : /tax clearance/i.test(step.process_description || '')
        ? ['Release of the Tax Clearance.']
        : ['Release of the official receipt.']
};
