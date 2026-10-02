/** Rounds for API responses: values are measured far more precisely than they are known. */
export const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Coordinates to ~1 cm. */
export const roundCoordinate = (value: number) => round(value, 7);
