# Modernité Staged Configurator & 3D Geometry Verification

Date: 22 September 2026

## 1. Verified Interaction Pipeline
1. **Google Maps Pegman & Road-Line Street View**:
   - The native Google Pegman control remains positioned at `RIGHT_BOTTOM`.
   - Street View opens directly upon placing Pegman onto any Google road line with real panorama coverage.
   - An on-screen prompt guides users clearly without overlapping native zoom or street-view buttons.
2. **Multiple Additional Structures with Independent Parameters**:
   - Users can choose one, multiple, or no additional structures (`conservatory`, `carport`, `canopy`).
   - Selecting multiple structures provides dedicated tabs so each structure retains its own editable `widthM`, `depthM`, `eavesHeightM`, and `solarCoverage`.
   - The parametric 3D scene renders each active structure in its correct spatial relationship to the house.
3. **Parametric 3D Building Architecture**:
   - Roof pitch supports full adjustments up to 90° for vertical solar envelope studies.
   - Gable infill walls stay geometrically connected under the roof planes across all pitch settings, eliminating gaps.
   - Roof planes now display structured BIPV solar arrays when active.
   - Distinct architectural forms (detached, semi-detached, mid-terrace, end-terrace, bungalow, low-rise, high-rise) exhibit differentiated geometry, storey layouts, and materials.
4. **Independent Surface Library**:
   - The configurator separates building form (Step 3), additional structures (Step 4), and solar product selection (Step 5).
   - In Step 5, products are grouped by surface family:
     - `Roof`: Windsor Broad, Cotswold Slate, Yorkshire Longspan, Highland Shingle.
     - `Facade`: Light-transmitting and opaque BIPV facade modules.
     - `Windows & glass`: Photovoltaic glazing for windows and skylights.
     - `Railing`: Solar balustrades.
     - `Additional structures`: Photovoltaic glass and canopy modules.
   - Selections for one surface never overwrite or disable another.
5. **SolarLLM Interaction Simplicity**:
   - "Locate property" functions as an explicit search trigger matching `Enter`.
   - Measured roof outlines require no saving or naming step to continue.
