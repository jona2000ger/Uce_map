import { state } from './state.js';
import {
  addNodeMarker,
  initMapBase,
  loadSavedState,
  refreshMap,
  saveState,
} from './core/mapCore.js';
import {
  clearDrawnTransitLines,
  detectOverlappingTransitSegments,
  drawTransitLinesFromResults,
  fetchTransitOption,
  getModeName,
  getSystemType,
  updateDrawnTransitVisibility,
} from './core/transitCore.js';
import {
  loadSearchHistory,
  redrawAllSearches,
  renderSearchHistoryPanel,
  saveSearchToHistory,
} from './core/historyCore.js';

const SEARCH_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#ca8a04', '#db2777'];

function getSearchColor(index) {
  return SEARCH_COLORS[index % SEARCH_COLORS.length];
}

const transitFns = {
  clearDrawnTransitLines,
  updateDrawnTransitVisibility,
};

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por el navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

function getAddressFromLatLng(latLng) {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === 'OK' && Array.isArray(results) && results.length > 0) {
        resolve(results[0].formatted_address);
        return;
      }
      resolve(null);
    });
  });
}

function updateRecommendationFromHistoryEntry(searchEntry) {
  if (!searchEntry || !searchEntry.recommendationData) {
    document.getElementById('best-transport').textContent = '-';
    document.getElementById('best-time').textContent = '-';
    document.getElementById('best-distance').textContent = '-';
    document.getElementById('best-route').textContent = 'Sin selección';
    document.getElementById('best-lines').textContent = '-';
    document.getElementById('search-status').textContent = 'Última búsqueda: -';
    document.getElementById('node-info').innerHTML = '<strong>Sin datos</strong><br>Selecciona una búsqueda del historial.';
    return;
  }

  const data = searchEntry.recommendationData;
  document.getElementById('best-transport').textContent = data.bestTransport;
  document.getElementById('best-time').textContent = data.bestTime;
  document.getElementById('best-distance').textContent = data.bestDistance;
  document.getElementById('best-route').textContent = data.bestRoute;
  document.getElementById('best-lines').textContent = data.bestLines;
  document.getElementById('search-count').textContent = `Búsquedas realizadas: ${state.searchHistory.length}`;
  const overlapSuffix = data.overlapNotice ? ` · ${data.overlapNotice}` : '';
  document.getElementById('search-status').textContent = `Última búsqueda: ${searchEntry.timestamp}${overlapSuffix}`;
  if (data.detailHtml) {
    document.getElementById('node-info').innerHTML = data.detailHtml;
  }
}

function updateRecommendationPanel(mejorOpcion, legInfo, origen, destino, overlapInfo = null) {
  const transportName = getModeName(mejorOpcion.mode);
  const tiempo = legInfo.duration.text;
  const distancia = legInfo.distance.text;

  const transitSteps = Array.isArray(legInfo.steps)
    ? legInfo.steps.filter((step) => step.travel_mode === 'TRANSIT')
    : [];

  const lineNames = [
    ...new Set(
      transitSteps.map((step) => step?.transit?.line?.short_name || step?.transit?.line?.name).filter(Boolean),
    ),
  ];

  const recommendedLines = lineNames.length ? lineNames.join(' · ') : 'Sin línea específica';

  document.getElementById('best-transport').textContent = transportName;
  document.getElementById('best-time').textContent = tiempo;
  document.getElementById('best-distance').textContent = distancia;
  document.getElementById('best-route').textContent = `${origen} → ${destino}`;
  document.getElementById('best-lines').textContent = recommendedLines;

  document.getElementById('search-count').textContent = `Búsquedas realizadas: ${state.searchHistory.length}`;
  const overlapSuffix = overlapInfo?.hasOverlap
    ? ` · ⚠ Líneas superpuestas: ${overlapInfo.overlapSegmentCount}`
    : '';
  document.getElementById('search-status').textContent = `Última búsqueda: ${new Date().toLocaleTimeString('es-ES')}${overlapSuffix}`;
}

function buildDetailedResultHtml(origenNombre, destinoNombre, mejorOpcion, rutasValidas, overlapInfo = null) {
  let info = `<strong>${origenNombre} → ${destinoNombre}</strong><br><br>`;
  info += `<div style="padding: 10px; background: #004d26; border: 1px solid #00ff99; border-radius: 8px; margin-bottom: 12px;">`;
  info += `<b>Mejor opción:</b><br><span style="color: #00ff99; font-size: 1.1em; font-weight: bold;">${getModeName(mejorOpcion.mode)} (${mejorOpcion.leg.duration.text})</span>`;
  info += `</div>`;
  if (overlapInfo?.hasOverlap) {
    info += `<div style="padding: 10px; background: #3a2800; border: 1px solid #ffcc00; border-radius: 8px; margin-bottom: 12px;">`;
    info += `<b>⚠ Líneas superpuestas detectadas:</b> ${overlapInfo.overlapSegmentCount} tramos (máx. ${overlapInfo.maxOverlap} coincidencias en un tramo).`;
    info += `</div>`;
  }
  info += `<div style="font-size:0.85em; color:#ccc; margin-bottom:10px;">`;
  info += `Color en mapa: <span style="color:#00cc66"><b>Verde</b></span> (más rápida) · <span style="color:#ffcc00"><b>Amarillo</b></span> (intermedia) · <span style="color:#ff4d4d"><b>Rojo</b></span> (más lenta)`;
  info += `</div>`;

  info += `<b>Opciones disponibles evaluadas:</b><br><ul style="margin-top: 5px; list-style-type: none; padding-left: 0;">`;

  rutasValidas.forEach((res) => {
    const steps = res.leg.steps.filter((s) => s.travel_mode === 'TRANSIT');
    let desgloseLineas = '';

    if (steps.length === 0) {
      desgloseLineas = '<br>&nbsp;&nbsp;<span style="font-size: 0.85em;">Ruta sin transporte público, solo caminata.</span>';
    } else {
      steps.forEach((s) => {
        const lineName = s.transit.line.short_name || s.transit.line.name;
        const sysType = getSystemType(lineName, s.transit.line.vehicle.type);
        desgloseLineas += `<div style="margin-left: 20px; font-size: 0.85em; border-left: 3px solid ${sysType.color}; padding-left: 6px; margin-top: 4px;">`;
        desgloseLineas += `<b>Línea:</b> ${lineName} (hacia ${s.transit.headsign})</div>`;
      });
    }

    const isBest = res.mode === mejorOpcion.mode;
    info += `<li style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #333;">`;
    if (isBest) info += `<span style="color:#22c55e; font-weight:700;">Principal</span> `;

    let rutasDisplay = '';
    if (res.routeResults && res.routeResults.length > 0) {
      const allBuses = [];
      res.routeResults.forEach((route) => {
        const routeSteps = route.legs[0].steps.filter((s) => s.travel_mode === 'TRANSIT');
        routeSteps.forEach((s) => {
          const lineName = s.transit.line.short_name || s.transit.line.name;
          if (!allBuses.includes(lineName)) allBuses.push(lineName);
        });
      });
      rutasDisplay = allBuses.length > 0 ? `(${allBuses.join(', ')})` : `(${res.routeResults.length} rutas)`;
    } else {
      rutasDisplay = '(1 ruta)';
    }

    info += `<b style="font-size: 1.05em; color:khaki">${getModeName(res.mode)}</b>: ${res.leg.duration.text} <span style="font-size:0.8em; color:#9ad">${rutasDisplay}</span> `;
    info += desgloseLineas;
    info += `</li>`;
  });

  info += `</ul>`;
  return info;
}

async function calculateAndDrawRealRoute(originLatLng, destLatLng, originName, destName) {
  if (state.customRouteLine) state.customRouteLine.setMap(null);
  if (state.selectedRouteLine) state.selectedRouteLine.setMap(null);
  clearDrawnTransitLines(state);

  document.getElementById('node-info').innerHTML = '<strong>Calculando opciones...</strong><br>Analizando rutas en Metro, Bus y Mixto...';

  const resultados = await Promise.all([
    fetchTransitOption(state, originLatLng, destLatLng, 'ALL'),
    fetchTransitOption(state, originLatLng, destLatLng, 'BUS'),
    fetchTransitOption(state, originLatLng, destLatLng, 'ECOVIA'),
    fetchTransitOption(state, originLatLng, destLatLng, 'SUBWAY'),
  ]);

  const rutasValidas = resultados.filter((res) => res.leg !== null);

  if (!rutasValidas.length) {
    document.getElementById('node-info').innerHTML = '<strong>Error</strong><br>No se encontraron opciones de transporte público directo entre estos puntos.';
    return;
  }

  rutasValidas.sort((a, b) => a.leg.duration.value - b.leg.duration.value);
  const mejorOpcion = rutasValidas[0];
  const searchId = Date.now().toString();

  // CÁLCULO DE IDENTIFICADORES DE NODOS DINÁMICOS:
  // En cada búsqueda se generan dos IDs (origen/destino) para modelar
  // el trayecto como nodos dentro del grafo visual.
  const oId = `N${Math.floor(Math.random() * 1000)}`;
  const dId = `N${Math.floor(Math.random() * 1000)}`;

  // CÁLCULO DE DATOS DE NODOS:
  // Se construye un objeto por nodo con: id, nombre, coordenadas, score
  // y descripción. El score=5 es un valor base para nodos creados por búsqueda.
  const nuevoOrigen = {
    id: oId,
    name: originName.split(',')[0],
    coords: originLatLng,
    role: 'origin',
    score: 5,
    description: 'Punto real creado dinámicamente.',
  };

  const nuevoDestino = {
    id: dId,
    name: destName.split(',')[0],
    coords: destLatLng,
    role: 'destination',
    score: 5,
    description: 'Destino real creado dinámicamente.',
  };

  // REGISTRO + DIBUJO DE NODOS:
  // 1) Se agregan al estado global (grafo en memoria)
  // 2) addNodeMarker() los dibuja inmediatamente en el mapa.
  state.nodes.push(nuevoOrigen, nuevoDestino);
  addNodeMarker(state, nuevoOrigen);
  addNodeMarker(state, nuevoDestino);

  const markerColor = getSearchColor(state.searchHistory.length);
  [nuevoOrigen, nuevoDestino].forEach((node) => {
    if (!node.marker) return;
    node.marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: markerColor,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#ffffff',
    });
  });

  state.edges.push({
    id: `${oId}_${dId}`,
    from: oId,
    to: dId,
    searchId,
    critical: false,
    closed: false,
    color: markerColor,
    name: `${nuevoOrigen.name} - ${nuevoDestino.name}`,
  });

  // Redibuja aristas para conectar el nuevo par de nodos y persiste estado.
  refreshMap(state);
  saveState(state);

  const bounds = new google.maps.LatLngBounds();
  bounds.extend(originLatLng);
  bounds.extend(destLatLng);
  state.map.fitBounds(bounds);

  const routeResults = rutasValidas.flatMap((item) => item.routeResults || []);
  const overlapInfo = detectOverlappingTransitSegments(routeResults);
  const polylines = drawTransitLinesFromResults(state, routeResults);

  const overlapNotice = overlapInfo.hasOverlap
    ? `⚠ Líneas superpuestas: ${overlapInfo.overlapSegmentCount}`
    : null;

  saveSearchToHistory(
    state,
    transitFns,
    searchId,
    nuevoOrigen.name,
    nuevoDestino.name,
    polylines,
    [nuevoOrigen, nuevoDestino],
    markerColor,
    {
      bestTransport: getModeName(mejorOpcion.mode),
      bestTime: mejorOpcion.leg.duration.text,
      bestDistance: mejorOpcion.leg.distance.text,
      bestRoute: `${nuevoOrigen.name} → ${nuevoDestino.name}`,
      bestLines: [
        ...new Set(
          (mejorOpcion.leg.steps || [])
            .filter((step) => step.travel_mode === 'TRANSIT')
            .map((step) => step?.transit?.line?.short_name || step?.transit?.line?.name)
            .filter(Boolean),
        ),
      ].join(' · ') || 'Sin línea específica',
      overlapNotice,
      detailHtml: buildDetailedResultHtml(
        nuevoOrigen.name,
        nuevoDestino.name,
        mejorOpcion,
        rutasValidas,
        overlapInfo,
      ),
    },
    updateRecommendationFromHistoryEntry,
  );

  updateRecommendationPanel(mejorOpcion, mejorOpcion.leg, nuevoOrigen.name, nuevoDestino.name, overlapInfo);
  document.getElementById('node-info').innerHTML = buildDetailedResultHtml(
    nuevoOrigen.name,
    nuevoDestino.name,
    mejorOpcion,
    rutasValidas,
    overlapInfo,
  );
}

function initCustomRouteAutocompletes() {
  const inputOrigin = document.getElementById('custom-origin');
  const inputDest = document.getElementById('custom-destination');
  const btnCalculate = document.getElementById('calculate-custom-route');
  const useCurrentLocation = document.getElementById('use-current-location');

  const options = {
    componentRestrictions: { country: 'ec' },
    bounds: new google.maps.LatLngBounds(new google.maps.LatLng(-0.4, -78.6), new google.maps.LatLng(0.0, -78.3)),
    strictBounds: true,
  };

  const autocompleteOrigin = new google.maps.places.Autocomplete(inputOrigin, options);
  const autocompleteDest = new google.maps.places.Autocomplete(inputDest, options);

  const setCurrentAddressInOrigin = async () => {
    try {
      const currentLatLng = await getCurrentPosition();
      const address = await getAddressFromLatLng(currentLatLng);
      inputOrigin.value = address || '';
      if (!address) {
        inputOrigin.placeholder = 'No se pudo resolver la dirección exacta';
      }
    } catch {
      inputOrigin.value = '';
      inputOrigin.placeholder = 'No se pudo obtener tu ubicación';
    }
  };

  const syncOriginInputState = () => {
    const checked = useCurrentLocation?.checked;
    inputOrigin.disabled = !!checked;
    if (checked) {
      inputOrigin.value = '';
      inputOrigin.placeholder = 'Obteniendo dirección actual...';
      setCurrentAddressInOrigin();
    } else {
      inputOrigin.placeholder = 'Ej: Quitumbe';
      if (!autocompleteOrigin.getPlace()?.geometry) {
        inputOrigin.value = '';
      }
    }
    if (!checked && inputOrigin.value === 'Mi ubicación actual') {
      inputOrigin.value = '';
    }
  };

  useCurrentLocation?.addEventListener('change', syncOriginInputState);
  syncOriginInputState();

  btnCalculate.addEventListener('click', async () => {
    const placeO = autocompleteOrigin.getPlace();
    const placeD = autocompleteDest.getPlace();
    const useGeo = !!useCurrentLocation?.checked;

    if (!placeD || !placeD.geometry) {
      alert('Por favor selecciona un destino válido sugerido por Google dentro de Quito.');
      return;
    }

    let originLatLng = null;
    let originName = '';

    if (useGeo) {
      try {
        originLatLng = await getCurrentPosition();
        originName = await getAddressFromLatLng(originLatLng) || 'Ubicación actual (sin dirección exacta)';
        inputOrigin.value = originName;
      } catch (error) {
        alert('No se pudo obtener tu ubicación actual. Revisa permisos de ubicación del navegador.');
        return;
      }
    } else {
      if (!placeO || !placeO.geometry) {
        alert('Por favor selecciona un origen válido sugerido por Google dentro de Quito.');
        return;
      }
      originLatLng = placeO.geometry.location;
      originName = placeO.name;
    }

    calculateAndDrawRealRoute(originLatLng, placeD.geometry.location, originName, placeD.name);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSavedState(state);
  initMapBase(state, () => updateDrawnTransitVisibility(state));
  loadSearchHistory(state);
  renderSearchHistoryPanel(state, transitFns, updateRecommendationFromHistoryEntry);
  redrawAllSearches(state, transitFns);
  const initialSelected = state.searchHistory.find((s) => s.id === state.selectedSearchId) || null;
  updateRecommendationFromHistoryEntry(initialSelected);
  initCustomRouteAutocompletes();
});
