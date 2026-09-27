# Modernité Solar Studio V28 Upgrade Audit

## Source integrity

The customer-supplied V28 source is **5,753,911 bytes**, compared with V15 at 5,439,519 bytes. The upgrade retains the complete regional building catalogue: **UK01–UK07, EU01–EU06, CA01–CA08, and JP01–JP05**. It also retains all eight existing BIPV product families: roof tiles, façade, sunroom, rooflight, carport, pergola, shading, and railing. The embedded image set remains unchanged, preventing a visual or product-catalogue regression during this update.

## New V28 modules

V28 adds separate customer-authored modules for building inputs, location and time-zone management, a shadow worker and service, the energy core and energy UI, system sizing, building controls, an arrangement panel, and V27 interaction behavior. The source therefore introduces controllable building dimensions and orientation, product placement, hourly-shadow analysis, energy and generation information, and inverter/battery sizing. These additions are part of the supplied client runtime and will be carried across without modification.

## Deployment approach

V28 has passed runtime readiness validation and replaces the existing `studio.html` byte-for-byte. The React shell remains limited to full-viewport hosting; it cannot alter the customer HTML, CSS, Three.js geometry, products, calculations, or interaction logic.
