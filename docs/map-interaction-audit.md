# Live Map Interaction Audit — 22 September 2026

The live `/roof` screen was inspected in the browser using its initial Nottingham demonstration state and then with the existing Street View control.

The audit confirms three issues. First, the initial location state exposes **“Nottingham”** as if it were the user’s typed address, rather than a neutral empty input with a separate “Demo location” action. Second, the Street View control passes the rooftop marker coordinates directly to the panorama; the returned panorama can therefore be an interior business/user-contributed view rather than a navigable roadside position. Third, boundary drawing relies entirely on Google’s basic `DrawingManager`; it has no dedicated vertex progress feedback, no explicit completion action, and it discards the old boundary immediately when trace mode begins.

The redesign will use StreetViewService to locate the nearest outdoor street panorama, display a Pegman-style road-inspection mode, preserve existing geometry until a replacement trace is confirmed, and offer a facade annotation rectangle that is separate from metric roof-area geometry.

## Refined workflow verification

The rebuilt screen now opens with an **“Awaiting location”** state, a blank address field, and a clear split between address search and manual pin placement. The previous Nottingham label is no longer presented as a user-provided property. The first trace action was also verified: the controls change to **Undo**, **Confirm boundary**, and **Cancel**, while an on-map prompt reports the exact number of corners still needed. This confirms that the user can now start a new boundary without erasing the existing one until confirmation.

The map trace test also confirmed that the browser operates at a 1280 × 1100 viewport, while the rendered screenshot is scaled. The live map viewport occupies x=483.9–1207.0 and y=363.2–847.2 in that coordinate system; follow-up trace verification uses these true coordinates.

The real map trace handler was tested with verified browser coordinates. The first click immediately changed the on-map metric to **1 corner**, enabled Undo, and rendered a dotted provisional line, confirming that the new React-managed draft drawing is receiving native Google Maps click events rather than relying on the opaque legacy drawing manager.

The trace cancellation test restored the untouched satellite state and cleared the draft without committing geometry. The controls then reveal the site-pin mode separately from roof tracing, confirming that location placement is no longer conflated with boundary measurement.

## Road View validation result

The revised Road View entry now exposes a dedicated Pegman-style control, records an outdoor road-level intent in the interface, and unlocks the **Mark façade** annotation action. However, the current Google panorama returned at the seed coordinates is still an indoor user-contributed shop panorama despite an `OUTDOOR` source request. This is not acceptable for a façade workflow and requires a final candidate-selection safeguard before delivery.

The final Street View safeguard was verified in-browser. Pressing **Road view** now changes the map to a clear road map, exposes the native Google **“Drag Pegman onto the map to open Street View”** control, and presents the explicit instruction **“Drop Pegman on a road.”** The app no longer automatically opens an indoor panorama. This puts road-level selection under user control and makes the façade annotation workflow available only after a real Street View panorama is deliberately opened.
