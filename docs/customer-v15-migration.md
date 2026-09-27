# Customer V15 Studio Migration

The customer supplied `Modernite-Solar-Studio-V15.html` as the authoritative implementation. The release uses that exact, self-contained runtime rather than recreating a parallel approximation in React. The source contains the original Three.js showroom, regional building catalogue, product configuration rules, embedded image assets, materials, camera controls, exports and report actions.

The application now loads the customer runtime as a same-origin, full-viewport frame. This preserves its original visual hierarchy, regional building IDs and product behaviours without replacing the company-specific content with generated alternatives. The existing React configurator remains recoverable from the preceding project checkpoint but is no longer rendered.

The project shell itself remains intentionally minimal so that it cannot modify the customer Studio CSS, JavaScript or scene graph. The Studio begins in its own English runtime configuration.
