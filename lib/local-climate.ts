import type { Region } from "../types/solar";
import type { IrradianceSeries, MonthlyIrradiance } from "./pvgis";

/**
 * Versioned regional planning-climate inputs for the approved simplified
 * empirical model. These values are intentionally local to the application:
 * the primary calculation therefore never depends on an external weather API.
 *
 * They are broad planning profiles, not a substitute for a site survey,
 * measured weather file, or a future external validation provider.
 */
type RegionalClimateProfile = {
  monthlyHorizontalKwhM2: readonly number[];
  monthlyAirTemperatureC: readonly number[];
  diffuseShare: number;
  reflectedShare: number;
};

const REGIONAL_PLANNING_CLIMATE: Readonly<Record<Region, RegionalClimateProfile>> = {
  UK: {
    monthlyHorizontalKwhM2: [30, 52, 87, 119, 145, 157, 153, 133, 99, 65, 38, 27],
    monthlyAirTemperatureC: [4, 5, 7, 10, 13, 16, 18, 18, 15, 11, 7, 5],
    diffuseShare: 0.36,
    reflectedShare: 0.05,
  },
  EU: {
    monthlyHorizontalKwhM2: [45, 68, 104, 135, 163, 176, 171, 148, 112, 76, 49, 35],
    monthlyAirTemperatureC: [3, 5, 8, 12, 16, 20, 22, 21, 17, 12, 7, 4],
    diffuseShare: 0.31,
    reflectedShare: 0.05,
  },
  CA: {
    monthlyHorizontalKwhM2: [39, 62, 100, 132, 158, 169, 166, 141, 105, 69, 42, 28],
    monthlyAirTemperatureC: [-8, -6, -1, 6, 13, 18, 21, 20, 14, 7, 0, -6],
    diffuseShare: 0.34,
    reflectedShare: 0.07,
  },
  JP: {
    monthlyHorizontalKwhM2: [50, 70, 101, 130, 152, 164, 169, 153, 119, 84, 56, 40],
    monthlyAirTemperatureC: [5, 6, 9, 14, 18, 22, 26, 27, 23, 17, 12, 7],
    diffuseShare: 0.33,
    reflectedShare: 0.05,
  },
};

function circularAngularDistance(firstDeg: number, secondDeg: number) {
  const raw = Math.abs(((firstDeg - secondDeg + 540) % 360) - 180);
  return Math.min(180, raw);
}

/**
 * A small, explicit plane-of-array adjustment used only with the local profile.
 * It keeps orientation visible in the monthly chart while avoiding a false claim
 * of site-specific ray-traced or API-derived weather data.
 */
function planeOfArrayFactor(azimuthDeg: number, tiltDeg: number) {
  const tilt = Math.max(0, Math.min(90, tiltDeg));
  if (tilt < 10) return 0.98;

  const southness = Math.cos((circularAngularDistance(azimuthDeg, 180) * Math.PI) / 180);
  const orientation = 0.68 + 0.32 * southness;
  const tiltExposure = 0.86 + 0.18 * Math.sin((tilt * Math.PI) / 180);
  const verticalAdjustment = tilt >= 75 ? 0.86 : 1;
  return Math.max(0.34, orientation * tiltExposure * verticalAdjustment);
}

export function localEmpiricalClimateSeries(input: {
  region: Region;
  azimuthDeg: number;
  tiltDeg: number;
}): IrradianceSeries {
  const profile = REGIONAL_PLANNING_CLIMATE[input.region];
  const planeFactor = planeOfArrayFactor(input.azimuthDeg, input.tiltDeg);

  const monthly: MonthlyIrradiance[] = profile.monthlyHorizontalKwhM2.map((horizontal, index) => {
    const irradiationKwhM2 = horizontal * planeFactor;
    const reflected = irradiationKwhM2 * profile.reflectedShare;
    const diffuse = irradiationKwhM2 * profile.diffuseShare;
    const beam = Math.max(0, irradiationKwhM2 - diffuse - reflected);
    return {
      month: index + 1,
      irradiationKwhM2,
      averageAirTemperatureC: profile.monthlyAirTemperatureC[index] ?? 10,
      beamKwhM2: beam,
      diffuseKwhM2: diffuse,
      reflectedKwhM2: reflected,
    };
  });

  return {
    database: "Modernité local empirical climate profile v1",
    source: "local-empirical-climate",
    monthly,
  };
}

export function localClimateMethodNote(region: Region) {
  const annualHorizontal = REGIONAL_PLANNING_CLIMATE[region].monthlyHorizontalKwhM2.reduce((total, value) => total + value, 0);
  return `Local regional planning climate profile v1 (${annualHorizontal.toFixed(0)} kWh/m² horizontal annual baseline).`;
}
