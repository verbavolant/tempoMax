import { expectNumberInRange, expectObject } from './validation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Posizione letta dal GPS: la precisione serve a giudicare un check-in fuori raggio. */
export interface MeasuredPosition extends Coordinates {
  accuracyMeters: number;
}

export function parseCoordinates(value: unknown, path: string): Coordinates {
  const object = expectObject(value, path);
  return {
    latitude: expectNumberInRange(object.latitude, `${path}.latitude`, -90, 90),
    longitude: expectNumberInRange(object.longitude, `${path}.longitude`, -180, 180),
  };
}

export function parseMeasuredPosition(value: unknown, path: string): MeasuredPosition {
  const object = expectObject(value, path);
  return {
    ...parseCoordinates(object, path),
    accuracyMeters: expectNumberInRange(object.accuracyMeters, `${path}.accuracyMeters`, 0, Infinity),
  };
}

