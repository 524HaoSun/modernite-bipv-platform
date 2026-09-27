# Modernité SolarLLM-Style Redesign & Empirical Model Integration

Date: 22 September 2026

## 1. Interaction and Hierarchy Alignment with SolarLLM
- **Visual hierarchy:** The application layout now follows the four-step workflow from [SolarLLM](https://solarllm.app/):
  1. **Location:** High-contrast luminous world map with country boundaries and Europe drawer.
  2. **Roof trace:** Satellite view with point-by-point polygon corner clicking. Outline area is computed instantly on the third vertex with no naming or saving step.
  3. **Model:** Building archetype gallery rendered with differentiated architectural forms, an optional additions strip (conservatory, carport, entrance canopy), simple roof product cards, finish swatches, and an interactive 3D model.
  4. **Review & Results:** Single annual electricity input, immediate potential calculation, 12-month generation histogram, and verifiable assumption ledger.

## 2. Calculation Model Simplification
- Replaced the multi-layer physics engine with the documented empirical formula:
  $$\text{Global Irradiance} = I_{\text{direct}} + I_{\text{diffuse}} + I_{\text{reflected}}$$
  $$\eta_{\text{base}} = \begin{cases} 0.2021 + 0.0000757142857 \cdot I & I \le 140 \\ -0.02458 \ln(I) + 0.33386 & I > 140 \end{cases}$$
  $$T_{\text{layer}} = T_{\text{air}} + k_{\text{direct}} \cdot I_{\text{direct}} + k_{\text{diff/refl}} \cdot (I_{\text{diffuse}} + I_{\text{reflected}})$$
  $$\eta = \frac{W_p/m^2}{164.06737524} \cdot \eta_{\text{base}} \cdot [1 - 0.00189 \cdot (T_{\text{layer}} - 25)]$$
  $$E_{\text{AC}} = 0.90 \cdot P_{\text{DC}} \cdot \Delta t$$
- Regression tests in `tests/empirical-generation.test.ts` verify the Solar Window Edge worked example ($77.97\text{ W}$, $0.07017\text{ kWh}$) and color roof derates.
