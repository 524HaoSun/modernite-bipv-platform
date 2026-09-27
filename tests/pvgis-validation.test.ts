import { describe, expect, it, vi } from "vitest";
import { fetchPvgisAnnualValidation } from "../lib/pvgis-validation";

describe("PVGIS annual validation", () => {
  it("uses the official PVcalc inputs for a building-mounted CdTe surface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      inputs: { meteo_data: { radiation_db: "PVGIS-SARAH3" } },
      outputs: { totals: { fixed: { E_y: 1024.4, SD_y: 45.1, "H(i)_y": 1189.2, l_total: 10 } } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPvgisAnnualValidation({
      lat: 51.5,
      lng: -0.12,
      tiltDeg: 35,
      azimuthDeg: 180,
      capacityKwp: 1.25,
      database: "PVGIS-SARAH3",
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v5_3/PVcalc?");
    expect(url).toContain("pvtechchoice=CdTe");
    expect(url).toContain("mountingplace=building");
    expect(url).toContain("loss=10");
    expect(url).toContain("aspect=0");
    expect(result).toMatchObject({ annualKwh: 1024.4, annualStandardDeviationKwh: 45.1, database: "PVGIS-SARAH3", endpoint: "v5_3/PVcalc" });
  });
});
