# Modernité Solar Studio V31 Gas-Boiler Defaults Upgrade Audit

## Scope and source integrity

The supplied **Modernite Solar Studio V31 Gas-Boiler Defaults** source was compared directly with the deployed V28 runtime. V31 is 5,770,040 bytes and carries a distinct SHA-256 fingerprint: `e0017ad9761f374c16b6b230771f0dae2c072158cfa0100067c158575c225441`. The update retains the complete customer catalogue: **UK01–UK07, EU01–EU06, CA01–CA08, and JP01–JP05**, all eight BIPV product families, all seven language options, all 24 embedded imagery records, and the existing DOM and module identifiers. No customer building, product, 3D asset, or route was removed.

## V31 functional change

The changed source is concentrated in the customer energy module and its interface. V31 increases the energy-system module payload and changes its configured equipment defaults. In the fully initialized V31 runtime, the **Other heating: gas boiler** device is enabled, its **boiler efficiency is 0.9**, and its **heating-demand share is 100%**. The alternate electrical heating devices, including heat pump, electric hot water, underfloor heating, radiant heating, and infrared heating, start disabled. This matches the update name and demonstrates that the new default is active rather than only labelled in the UI.

## Runtime validation

V31 initialized successfully with the English interface, one Three.js canvas, UK01 selected, all four regional tabs available, and no console exceptions. The energy drawer opened correctly and displayed its default configuration. The final deployment keeps `studio.html` as a byte-identical copy of the supplied V31 file; the React layer remains a host only and cannot change the customer-authored model, products, calculations, or visual system.
