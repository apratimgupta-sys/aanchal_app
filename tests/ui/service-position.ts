// Where a service sits in the daily entry's list, which is the number a clerk
// reads (01 to 17). The list is grouped (counter work, then collections), so the
// position is not the service id: the id is what is stored and sent, the
// position is only what is shown. Written out by hand on purpose. Deriving it
// from the app's own ordering would make the tests agree with whatever the app
// does, and this table is what says what the app should do.
//
// The eight field-work services (8, 9, 10, 13, 14, 15, 16, 17) are reported by
// field officers as visits and are not on the daily entry, so they have no
// position: asking for one is an error, not "undefined".
const POSITION: Record<number, number> = {
  1: 1, 3: 2, 4: 3, 7: 4, 11: 5, 12: 6, 18: 7, 19: 8, 20: 9, 21: 10, 22: 11, 23: 12, 24: 13, 25: 14,
  2: 15, 5: 16, 6: 17,
};

export const servicePosition = (serviceId: number): string => {
  const position = POSITION[serviceId];
  if (position === undefined) throw new Error(`service ${serviceId} is not on the daily entry`);
  return String(position).padStart(2, "0");
};

// The list as the clerk reads it, top to bottom, by service id. Hand-written, in
// the same order as the table above.
export const OFFERED_IDS: readonly number[] = [1, 3, 4, 7, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25, 2, 5, 6];
// The eight that are reported as visits instead.
export const FIELD_WORK_IDS: readonly number[] = [8, 9, 10, 13, 14, 15, 16, 17];
