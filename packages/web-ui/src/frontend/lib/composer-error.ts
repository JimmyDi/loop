export const composerError = (errors: unknown[]): unknown =>
  errors.find((error) => error !== undefined);

export const composerBlocked = (...states: boolean[]): boolean => states.some(Boolean);
