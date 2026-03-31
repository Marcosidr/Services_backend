import { describe, expect, it } from "@jest/globals";
import {
  calculateDistanceKm,
  parseLatitude,
  parseLongitude,
  validateCoordinatePair
} from "../src/utils/geo";

describe("geo utils", () => {
  it("parse latitude/longitude valid values", () => {
    expect(parseLatitude("-23.55052")).toEqual({
      provided: true,
      value: -23.55052,
      invalid: false
    });
    expect(parseLongitude("-46,633308")).toEqual({
      provided: true,
      value: -46.633308,
      invalid: false
    });
  });

  it("validate coordinate pair with partial payload", () => {
    const latitude = parseLatitude("-23.55");
    const longitude = parseLongitude(undefined);
    expect(validateCoordinatePair(latitude, longitude)).toBe(
      "Informe latitude e longitude juntas"
    );
  });

  it("calculate haversine distance in km", () => {
    const sp = { latitude: -23.55052, longitude: -46.633308 };
    const rj = { latitude: -22.906847, longitude: -43.172897 };
    const distance = calculateDistanceKm(sp, rj);

    // Sao Paulo -> Rio (linha reta) ~357km
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(380);
  });
});
