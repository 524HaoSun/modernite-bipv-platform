import json
from pathlib import Path

SOURCE = Path('/home/ubuntu/modernite-bipv-platform/scripts/cache/countries.geojson')
OUTPUT = Path('/home/ubuntu/modernite-bipv-platform/client/src/data/coverage-countries.ts')

# Every territory available in the product workflow. All European selections use the
# EU planning profile, but remain independently selectable for map search and modelling.
TARGETS = {
    'GBR': ('GB', 'UK'),
    'IRL': ('IE', 'EU'), 'AUT': ('AT', 'EU'), 'BEL': ('BE', 'EU'), 'BGR': ('BG', 'EU'),
    'HRV': ('HR', 'EU'), 'CYP': ('CY', 'EU'), 'CZE': ('CZ', 'EU'), 'DNK': ('DK', 'EU'),
    'EST': ('EE', 'EU'), 'FIN': ('FI', 'EU'), 'FRA': ('FR', 'EU'), 'DEU': ('DE', 'EU'),
    'GRC': ('GR', 'EU'), 'HUN': ('HU', 'EU'), 'ITA': ('IT', 'EU'), 'LVA': ('LV', 'EU'),
    'LTU': ('LT', 'EU'), 'LUX': ('LU', 'EU'), 'MLT': ('MT', 'EU'), 'NLD': ('NL', 'EU'),
    'POL': ('PL', 'EU'), 'PRT': ('PT', 'EU'), 'ROU': ('RO', 'EU'), 'SVK': ('SK', 'EU'),
    'SVN': ('SI', 'EU'), 'ESP': ('ES', 'EU'), 'SWE': ('SE', 'EU'), 'NOR': ('NO', 'EU'),
    'CHE': ('CH', 'EU'), 'ISL': ('IS', 'EU'), 'SRB': ('RS', 'EU'), 'BIH': ('BA', 'EU'),
    'ALB': ('AL', 'EU'), 'MNE': ('ME', 'EU'), 'MKD': ('MK', 'EU'), 'UKR': ('UA', 'EU'),
    'CAN': ('CA', 'CA'), 'JPN': ('JP', 'JP'),
}


def perpendicular_distance(point, start, end):
    x, y = point
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / (dx * dx + dy * dy) ** 0.5


def simplify(points, tolerance):
    if len(points) < 4:
        return points
    start, end = points[0], points[-1]
    greatest_distance, greatest_index = 0, 0
    for index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[index], start, end)
        if distance > greatest_distance:
            greatest_distance, greatest_index = distance, index
    if greatest_distance > tolerance:
        left = simplify(points[:greatest_index + 1], tolerance)
        right = simplify(points[greatest_index:], tolerance)
        return left[:-1] + right
    return [start, end]


def compact_ring(ring):
    closed = ring[0] == ring[-1]
    points = ring[:-1] if closed else ring
    # Small states must remain a valid polygon and clickable on a zoomable map.
    if len(points) < 5:
        return [[round(lng, 5), round(lat, 5)] for lng, lat in ring]
    simplified = simplify(points + [points[0]], 0.035)
    if len(simplified) < 4:
        simplified = points + [points[0]]
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return [[round(lng, 5), round(lat, 5)] for lng, lat in simplified]


def compact_geometry(geometry):
    if geometry['type'] == 'Polygon':
        return {'type': 'Polygon', 'coordinates': [compact_ring(ring) for ring in geometry['coordinates']]}
    return {'type': 'MultiPolygon', 'coordinates': [[compact_ring(ring) for ring in polygon] for polygon in geometry['coordinates']]}

source = json.loads(SOURCE.read_text())
features = []
for feature in source['features']:
    iso = feature['properties'].get('ISO3166-1-Alpha-3')
    if iso not in TARGETS:
        continue
    ident, region = TARGETS[iso]
    geometry = feature.get('geometry')
    if not geometry or geometry['type'] not in {'Polygon', 'MultiPolygon'}:
        continue
    features.append({
        'type': 'Feature',
        'properties': {'id': ident, 'region': region, 'iso': iso, 'name': feature['properties']['name']},
        'geometry': compact_geometry(geometry),
    })
features.sort(key=lambda feature: feature['properties']['id'])
body = json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':'))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text('export const COVERAGE_COUNTRY_GEOJSON = ' + body + ' as const;\n')
print(f'Wrote {OUTPUT} with {len(features)} countries, {OUTPUT.stat().st_size // 1024} KB')
