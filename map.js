const map = L.map('map').setView([55.589242, -4.586690], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const statusEl = document.getElementById('status');
const controlsEl = document.getElementById('yearControls');
const yearLayers = new Map();
const walkMarkers = new Map();
const yearCheckboxes = new Map();
let activeRoute = null;
let routeRequest = 0;
let allWalksBounds = null;
function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function safeLink(url, label) {
  if (!url || !/^https:\/\/[^\s"'<>]+$/i.test(String(url))) return '';
  return `<a href="${safeText(url)}" target="_blank" rel="noopener noreferrer">${safeText(label)}</a>`;
}
function popupHtml(p) {
  const rows = [
    ['Date', p.date], ['Distance', p.distance], ['Time', p.time],
    ['Ascent', p.ascent], ['Descent', p.descent],
    ['Rating', p.rating], ['Difficulty', p.difficulty]
  ].filter(([, value]) => value);
  const rowHtml = rows.map(([label, value]) =>
    `<div class="popup-row"><strong>${safeText(label)}:</strong> ${safeText(value)}</div>`
  ).join('');
  const links = [
    safeLink(p.walkPage, 'Walk page'),
    safeLink(p.outdooractive, 'Outdooractive route')
  ].filter(Boolean).join('');
  const routeLine = p.walkNumber
    ? `<div class="route-note">Select this marker to show its GPX track when available.</div>`
    : '';
  return `<div class="popup-title">${safeText(p.name)}</div>
    ${p.description ? `<div>${safeText(p.description)}</div>` : ''}
    ${rowHtml}<div class="popup-links">${links}</div>${routeLine}`;
}
function clearRoute() {
  routeRequest++;
  if (activeRoute) {
    map.removeLayer(activeRoute);
    activeRoute = null;
  }
  // Clear the Find Walk box as well as closing the walk popup.
  document.getElementById('walkNumberSearch').value = '';
  map.closePopup();
  // Return to the full extent of all walk markers.
  if (allWalksBounds && allWalksBounds.isValid()) {
    map.fitBounds(allWalksBounds, { padding: [28, 28], maxZoom: 11 });
  }
  statusEl.textContent = 'Route cleared. Showing the full extent of the walk markers.';
}
document.getElementById('clearRoute').addEventListener('click', clearRoute);
document.getElementById('walkSearch').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('walkNumberSearch');
  const walkNumber = Number(input.value);
  if (!Number.isFinite(walkNumber) || walkNumber < 1) {
    statusEl.textContent = 'Please enter a valid walk number.';
    input.focus();
    return;
  }
  const match = walkMarkers.get(walkNumber);
  if (!match) {
    statusEl.textContent = `Walk ${walkNumber} was not found in the current map data.`;
    return;
  }

  // If its year has been hidden, turn that year back on so the marker is visible.
  const checkbox = yearCheckboxes.get(match.year);
  const layer = yearLayers.get(match.year);
  if (checkbox && layer && !checkbox.checked) {
    checkbox.checked = true;
    layer.addTo(map);
  }
  map.setView(match.marker.getLatLng(), 13);
  match.marker.fire('click');
});
function showRoute(feature, marker) {
  const p = feature.properties || {};
  if (!p.walkNumber) {
    statusEl.textContent = 'This marker has no walk number to match to a GPX file.';
    return;
  }
  const requestId = ++routeRequest;
  if (activeRoute) {
    map.removeLayer(activeRoute);
    activeRoute = null;
  }
  const fileName = `walk-${String(p.walkNumber).padStart(3, '0')}.gpx`;
  statusEl.textContent = `Loading route for ${p.name}…`;
  const route = new L.GPX(fileName, {
    async: true,
    marker_options: {
      startIconUrl: '', // Hide the GPX start pin; the numbered uMap marker identifies the walk start.
      endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
    },
    polyline_options: { color: '#d12d2d', weight: 4, opacity: 0.85 }
  });
  // Remove only the GPX start marker; keep the finish marker and route line.
  route.on('addpoint', event => {
    if (event.point_type === 'start' && event.point) {
      route.removeLayer(event.point);
    }
  });
  route.on('loaded', event => {
    if (requestId !== routeRequest) return;
    activeRoute = event.target.addTo(map);
    map.fitBounds(event.target.getBounds(), { padding: [24, 24] });
    statusEl.textContent = `Showing GPX route: ${p.name}`;
    marker.openPopup();
  });
  route.on('error', () => {
    if (requestId !== routeRequest) return;
    statusEl.textContent = `No GPX file found for ${p.name} yet. The walk marker and its links are still available.`;
  });
}
// Check which GPX files exist. Only those walks receive numbered markers.
async function findAvailableGpxFiles(features) {
  const walkNumbers = [...new Set(features
    .map(feature => feature.properties && feature.properties.walkNumber)
    .filter(number => Number.isFinite(number)))];
  const checks = await Promise.all(walkNumbers.map(async number => {
    const fileName = `walk-${String(number).padStart(3, '0')}.gpx`;
    try {
      const response = await fetch(fileName, { method: 'HEAD', cache: 'no-store' });
      return response.ok ? number : null;
    } catch (_) {
      return null;
    }
  }));
  return new Set(checks.filter(number => number !== null));
}
fetch('walks-data.geojson')
  .then(response => {
    if (!response.ok) throw new Error(`Could not load walk data (${response.status})`);
    return response.json();
  })
  .then(async data => {
    const availableGpxNumbers = await findAvailableGpxFiles(data.features);
    // Keep the overall extent of every walk marker, including years hidden by the filters.
    allWalksBounds = L.geoJSON(data).getBounds();
    if (allWalksBounds.isValid()) {
      map.fitBounds(allWalksBounds, { padding: [28, 28], maxZoom: 11 });
    }
    const years = [...new Set(data.features.map(f => String(f.properties.year)))].sort();
    let total = 0;
    years.forEach(year => {
      const features = data.features.filter(f => String(f.properties.year) === year);
      const layer = L.geoJSON(features, {
        pointToLayer: (feature, latlng) => {
          const walkNumber = feature.properties && feature.properties.walkNumber;
          if (Number.isFinite(walkNumber) && availableGpxNumbers.has(walkNumber)) {
            return L.marker(latlng, {
              icon: L.divIcon({
                className: 'walk-number-icon',
                html: `<span>${safeText(walkNumber)}</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -14]
              })
            });
          }
          return L.circleMarker(latlng, {
            radius: 7, color: '#8b1e2d', weight: 1.5, fillColor: '#e85b65', fillOpacity: 0.9
          });
        },
        onEachFeature: (feature, marker) => {
          marker.bindPopup(popupHtml(feature.properties), { maxWidth: 300 });
          const number = feature.properties && feature.properties.walkNumber;
          if (Number.isFinite(number)) {
            walkMarkers.set(number, { marker, year });
          }
          marker.on('click', () => showRoute(feature, marker));
        }
      }).addTo(map);
      yearLayers.set(year, layer);
      total += features.length;
      const label = document.createElement('label');
      label.className = 'year-toggle';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) layer.addTo(map);
        else map.removeLayer(layer);
      });
      yearCheckboxes.set(year, checkbox);
      label.append(checkbox, document.createTextNode(`${year} (${features.length})`));
      controlsEl.appendChild(label);
    });
    statusEl.textContent = `${total} walk markers loaded across ${years.length} yearly layers. Select a marker to try its GPX track.`;
  })
  .catch(error => {
    console.error(error);
    statusEl.textContent = `Map data could not be loaded: ${error.message}`;
  });
