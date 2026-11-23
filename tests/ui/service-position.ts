// Where a service sits in the daily entry's list, which is the number a clerk
// reads (01 to 25). The list is grouped by shape (counter work, collections,
// field work), so the position is not the service id: the id is what is stored
// and sent, the position is only what is shown. Written out by hand on purpose.
// Deriving it from the app's own ordering would make the tests agree with
// whatever the app does, and this table is what says what the app should do.
const POSITION: Record<number, number> = {
  1: 1, 3: 2, 4: 3, 7: 4, 11: 5, 12: 6, 18: 7, 19: 8, 20: 9, 21: 10, 22: 11, 23: 12, 24: 13, 25: 14,
  2: 15, 5: 16, 6: 17,
  8: 18, 9: 19, 10: 20, 13: 21, 14: 22, 15: 23, 16: 24, 17: 25,
};

export const servicePosition = (serviceId: number): string => String(POSITION[serviceId]).padStart(2, "0");
