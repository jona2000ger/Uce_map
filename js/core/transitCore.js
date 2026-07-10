export function getSystemType(lineName, vehicleType) {
  const nameUpper = lineName.toUpperCase();
  if (
    nameUpper.includes('METRO') ||
    vehicleType === 'SUBWAY' ||
    vehicleType === 'RAIL' ||
    vehicleType === 'HEAVY_RAIL' ||
    vehicleType === 'COMMUTER_TRAIN' ||
    vehicleType === 'TRAIN'
  ) {
    return { color: '#ff4d4d', filterKey: 'metro', lineColor: '#ff4d4d' };
  }
  if (nameUpper.includes('TROLE') || nameUpper.includes('C1') || nameUpper.includes('C2')) {
    return { color: '#2eb82e', filterKey: 'ecovia', lineColor: '#2eb82e' };
  }
  if (nameUpper.includes('ECOV') || nameUpper.includes('E1') || nameUpper.includes('E2') || nameUpper.includes('E3')) {
    return { color: '#3399ff', filterKey: 'ecovia', lineColor: '#3399ff' };
  }
  return { color: '#999999', filterKey: 'bus', lineColor: '#ffcc66' };
}

export function buildTransitOptions(mode) {
  const options = { departureTime: new Date() };
  if (mode === 'BUS' || mode === 'ECOVIA') {
    options.modes = [google.maps.TransitMode.BUS];
  } else if (mode === 'SUBWAY') {
    options.modes = [
      google.maps.TransitMode.SUBWAY,
      google.maps.TransitMode.RAIL,
      google.maps.TransitMode.TRAIN,
      google.maps.TransitMode.TRAM,
    ];
  }
  return options;
}

export function isEcoviaOrTroleStep(step) {
  const lineName = (step?.transit?.line?.short_name || step?.transit?.line?.name || '').toUpperCase();
  return (
    lineName.includes('ECOV') ||
    lineName.includes('TROLE') ||
    lineName.includes('CORREDOR') ||
    lineName.includes('RIO COCA') ||
    lineName.includes('C1') ||
    lineName.includes('C2') ||
    lineName.includes('E1') ||
    lineName.includes('E2') ||
    lineName.includes('E3')
  );
}

export function clearDrawnTransitLines(state) {
  state.drawnTransitLines.forEach((item) => item.polyline.setMap(null));
  state.drawnTransitLines = [];
}

function normalizePoint(point) {
  if (!point) return null;
  const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
  const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return { lat, lng };
}

function buildSegmentKey(a, b) {
  const p1 = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`;
  const p2 = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

export function detectOverlappingTransitSegments(routeResults) {
  if (!Array.isArray(routeResults) || routeResults.length === 0) {
    return { hasOverlap: false, overlapSegmentCount: 0, maxOverlap: 1 };
  }

  const segmentCounter = new Map();

  routeResults.forEach((route) => {
    const leg = route?.legs?.[0];
    if (!leg || !Array.isArray(leg.steps)) return;

    leg.steps
      .filter((step) => step.travel_mode === 'TRANSIT')
      .forEach((step) => {
        const path = Array.isArray(step.path)
          ? step.path.map((point) => normalizePoint(point)).filter(Boolean)
          : [];

        for (let i = 0; i < path.length - 1; i += 1) {
          const key = buildSegmentKey(path[i], path[i + 1]);
          segmentCounter.set(key, (segmentCounter.get(key) || 0) + 1);
        }
      });
  });

  let overlapSegmentCount = 0;
  let maxOverlap = 1;

  segmentCounter.forEach((count) => {
    if (count > 1) {
      overlapSegmentCount += 1;
      if (count > maxOverlap) maxOverlap = count;
    }
  });

  return {
    hasOverlap: overlapSegmentCount > 0,
    overlapSegmentCount,
    maxOverlap,
  };
}

export function getSpeedColorByRank(index, total) {
  if (total <= 1) return '#00cc66';
  const ratio = index / (total - 1);
  if (ratio <= 0.33) return '#00cc66';
  if (ratio <= 0.66) return '#ffcc00';
  return '#ff4d4d';
}

export function drawTransitLinesFromRoute(state, routeResult, speedColor) {
  if (!routeResult || !routeResult.legs || routeResult.legs.length === 0) return [];

  const polylines = [];
  const transitSteps = routeResult.legs[0].steps.filter((step) => step.travel_mode === 'TRANSIT');
  transitSteps.forEach((step) => {
    const lineName = step.transit.line.short_name || step.transit.line.name || 'Línea';
    const sysType = getSystemType(lineName, step.transit.line.vehicle.type);
    const path = step.path || [];
    if (!path.length) return;

    const polyline = new google.maps.Polyline({
      path,
      strokeColor: speedColor || sysType.lineColor,
      strokeOpacity: 0.95,
      strokeWeight: 6,
      zIndex: 20,
      map: state.map,
    });

    state.drawnTransitLines.push({ polyline, type: sysType.filterKey });
    polylines.push(polyline);
  });

  return polylines;
}

export function drawTransitLinesFromResults(state, routeResults) {
  if (!Array.isArray(routeResults) || routeResults.length === 0) return [];
  const ordered = [...routeResults].sort((a, b) => {
    const da = a?.legs?.[0]?.duration?.value ?? Number.MAX_SAFE_INTEGER;
    const db = b?.legs?.[0]?.duration?.value ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });

  const allPolylines = [];
  ordered.forEach((route, index) => {
    const speedColor = getSpeedColorByRank(index, ordered.length);
    const polylines = drawTransitLinesFromRoute(state, route, speedColor);
    allPolylines.push(...polylines);
  });

  updateDrawnTransitVisibility(state);
  return allPolylines;
}

export function updateDrawnTransitVisibility(state) {
  const showBus = document.getElementById('toggle-bus')?.checked ?? true;
  const showMetro = document.getElementById('toggle-metro')?.checked ?? true;
  const showEcovia = document.getElementById('toggle-ecovia')?.checked ?? true;

  state.drawnTransitLines.forEach((item) => {
    let visible = true;
    if (item.type === 'bus') visible = showBus;
    if (item.type === 'metro') visible = showMetro;
    if (item.type === 'ecovia') visible = showEcovia;
    item.polyline.setMap(visible ? state.map : null);
  });
}

export function fetchTransitOption(state, origin, destination, mode) {
  return new Promise((resolve) => {
    const options = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.TRANSIT,
      provideRouteAlternatives: true,
      region: 'ec',
      transitOptions: buildTransitOptions(mode),
    };

    state.directionsService.route(options, (response, status) => {
      if (status === 'OK') {
        const routes = Array.isArray(response.routes) ? response.routes : [];
        if (!routes.length || !routes[0].legs || !routes[0].legs.length) {
          resolve({ mode, leg: null, routeResults: [] });
          return;
        }

        let routeResults = routes;
        if (mode === 'ECOVIA') {
          routeResults = routes.filter((route) => {
            const legCandidate = route.legs && route.legs[0];
            if (!legCandidate) return false;
            const transitSteps = legCandidate.steps.filter((step) => step.travel_mode === 'TRANSIT');
            return transitSteps.some((step) => isEcoviaOrTroleStep(step));
          });

          if (!routeResults.length) {
            resolve({ mode, leg: null, routeResults: [] });
            return;
          }
        }

        resolve({ mode, leg: routeResults[0].legs[0], routeResults });
      } else {
        resolve({ mode, leg: null, routeResults: [] });
      }
    });
  });
}

export function getModeName(mode) {
  if (mode === 'ALL') return 'Mixto (Ecovía / Trole / Corredores)';
  if (mode === 'BUS') return 'Buses Estándar / Alimentadores';
  if (mode === 'ECOVIA') return 'Ecovía / Trole';
  if (mode === 'SUBWAY') return 'Metro de Quito';
  return mode;
}
