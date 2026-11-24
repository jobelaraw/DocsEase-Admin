// Fixed option lists shared by several pages.

export const FLOORS = [
  ['first_floor', 'First Floor'],
  ['second_floor', 'Second Floor'],
  ['third_floor', 'Third Floor']
];

// regular_service = an office (offices collection); everything else is a room (other_room)
export const CATEGORIES = [
  ['regular_service', 'Regular Service'],
  ['emergency_services', 'Emergency Services'],
  ['building_access', 'Building Access'],
  ['facilities_and_amenities', 'Facilities and Amenities'],
  ['comfort_rooms', 'Comfort Rooms'],
  ['suites_and_hubs', 'Suites and Hubs']
];

export const OFFICE_CATEGORY = 'regular_service';

// Fallback only; the server reports the real value with the Deleted Records list.
export const TRASH_RETENTION_DAYS = 30;

// suites_and_hubs -> Suites And Hubs (for values not in the lists above)
export const prettyValue = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const labelOf = (list, value) => (list.find(([v]) => v === value) || [value, prettyValue(value)])[1];
