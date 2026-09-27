import { describe, expect, it, vi } from "vitest";
import { toPvgisAspect } from "../lib/geometry";
import { fetchPvgisSeries } from "../lib/pvgis";

describe("PVGIS aspect conversion (§14.2)", () => {
  it("maps compass azimuths to PVGIS aspect", () => {
    expect(toPvgisAspect(180)).toBe(0);
    expect(toPvgisAspect(90)).toBe(90);
    expect(toPvgisAspect(270)).toBe(-90);
  });

  it("retries a transient aborted irradiance request before reporting a user-facing failure", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        outputs: { hourly: [{ time: "20250101:0010", Gb: 100, Gd: 30, Gr: 5, T2m: 10 }] },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPvgisSeries({ region: "UK", lat: 51.481, lng: -0.121, tiltDeg: 35, azimuthDeg: 180 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("pvgis");
    expect(result.monthly).toHaveLength(12);
    vi.unstubAllGlobals();
  });
});
