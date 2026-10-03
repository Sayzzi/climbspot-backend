/** Proposals as the Itineraries API gives them, to be saved. */

const path = {
  type: 'LineString',
  coordinates: [
    [6, 45],
    [6, 45.01],
    [6.01, 45.01],
    [6, 45],
  ],
};

const elevationProfile = [
  { distance: 0, elevation: 450 },
  { distance: 2800, elevation: 520 },
  { distance: 5600, elevation: 450 },
];

export const aLoop = () => ({
  kind: 'loop',
  exact: true,
  differences: [],
  path,
  elevationProfile,
  length: 5600,
  heightGained: 105,
  effort: { kmEffort: 6.7, flatEquivalentDistance: 6300 },
  relief: 'rolling',
});

export const anUphillItinerary = () => ({
  kind: 'uphill',
  exact: false,
  differences: [{ kind: 'gradient', min: 0.05, max: 0.08, actual: 0.045 }],
  path: {
    type: 'LineString',
    coordinates: [
      [6, 45],
      [6, 45.027],
    ],
  },
  elevationProfile: [
    { distance: 0, elevation: 450 },
    { distance: 3000, elevation: 585 },
  ],
  length: 3000,
  heightGained: 135,
  start: { latitude: 45, longitude: 6, elevation: 450 },
  top: { latitude: 45.027, longitude: 6, elevation: 585 },
  elevationGain: 135,
  averageGradient: 0.045,
  maximumGradient: 0.08,
  difficultyScore: 13_500,
  category: 'cat4',
  distanceToStart: 800,
});

export const aHillSession = () => ({
  kind: 'session',
  exact: true,
  differences: [],
  repeats: 8,
  repeat: {
    path: {
      type: 'LineString',
      coordinates: [
        [6.01, 45.01],
        [6.01, 45.0127],
      ],
    },
    elevationProfile: [
      { distance: 0, elevation: 450 },
      { distance: 300, elevation: 472 },
    ],
    length: 300,
    averageGradient: 0.075,
    maximumGradient: 0.075,
    start: { latitude: 45.01, longitude: 6.01, elevation: 450 },
    top: { latitude: 45.0127, longitude: 6.01, elevation: 472 },
  },
  warmUp: {
    path,
    elevationProfile,
    length: 1800,
  },
  totals: {
    length: 8400,
    heightGained: 239,
    effort: { kmEffort: 10.8, flatEquivalentDistance: 10_200 },
  },
});
