import { SEARCH_HISTORY_KEY } from '../state.js';
import { saveState } from './mapCore.js';

export function saveSearchHistoryToStorage(state) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(state.searchHistory));
  } catch (e) {
    console.warn('No se pudo guardar el historial:', e);
  }
}

export function loadSearchHistory(state) {
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      state.searchHistory = JSON.parse(saved);
      if (state.searchHistory.length > 0) {
        state.visibleSearches.add(state.searchHistory[0].id);
        state.selectedSearchId = state.searchHistory[0].id;
      }
    }
  } catch (e) {
    console.warn('No se pudo cargar el historial:', e);
  }
}

function getSelectedSearchEntry(state) {
  const selected = state.searchHistory.find((s) => s.id === state.selectedSearchId);
  if (selected) return selected;

  const firstVisible = state.searchHistory.find((s) => state.visibleSearches.has(s.id));
  if (firstVisible) return firstVisible;

  return null;
}

export function redrawAllSearches(state, transitFns) {
  transitFns.clearDrawnTransitLines(state);

  Object.values(state.searchPolylines).forEach((lines) => {
    lines.forEach((line) => line.setMap(null));
  });
  state.searchPolylines = {};

  state.visibleSearches.forEach((searchId) => {
    const search = state.searchHistory.find((s) => s.id === searchId);
    if (!search) return;

    ensureSearchMarkersForEntry(state, search);

    const rawLineData = Array.isArray(search.polylineData) && search.polylineData.length
      ? search.polylineData
      : buildFallbackLineDataFromMarkers(search);

    state.searchPolylines[searchId] = rawLineData.map((data) => {
      const normalizedPath = Array.isArray(data.path)
        ? data.path
          .map((point) => normalizeCoords(point))
          .filter(Boolean)
        : [];

      if (!normalizedPath.length) return null;

      const polyline = new google.maps.Polyline({
        path: normalizedPath,
        strokeColor: data.color || '#00cc66',
        strokeWeight: data.weight || 6,
        strokeOpacity: 0.8,
        map: state.map,
        zIndex: 15,
      });

      const type = data.type || 'bus';
      state.drawnTransitLines.push({ polyline, type });
      return polyline;
    }).filter(Boolean);
  });

  state.searchHistory.forEach((search) => {
    const isVisible = state.visibleSearches.has(search.id);

    if (state.searchMarkers[search.id]) {
      state.searchMarkers[search.id].forEach((marker) => {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(isVisible ? state.map : null);
        }
      });
    }
  });

  syncSearchEdgeVisibility(state);

  syncSearchNodeVisibility(state);

  transitFns.updateDrawnTransitVisibility(state);
}

function ensureSearchMarkersForEntry(state, searchEntry) {
  if (state.searchMarkers[searchEntry.id] && state.searchMarkers[searchEntry.id].length > 0) return;
  if (!Array.isArray(searchEntry.markerData) || searchEntry.markerData.length === 0) return;

  state.searchMarkers[searchEntry.id] = searchEntry.markerData
    .filter((marker) => marker && marker.position)
    .map((marker) => new google.maps.Marker({
      position: marker.position,
      map: null,
      title: marker.title || `${searchEntry.origin} / ${searchEntry.destination}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: marker.color || searchEntry.markerColor || '#2563eb',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
      },
    }));
}

function normalizeCoords(coords) {
  if (!coords) return null;

  const lat = typeof coords.lat === 'function' ? coords.lat() : coords.lat;
  const lng = typeof coords.lng === 'function' ? coords.lng() : coords.lng;

  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
}

function buildFallbackLineDataFromMarkers(searchEntry) {
  if (!Array.isArray(searchEntry?.markerData) || searchEntry.markerData.length < 2) return [];

  const points = searchEntry.markerData
    .map((marker) => normalizeCoords(marker?.position))
    .filter(Boolean);

  if (points.length < 2) return [];

  return [{
    path: points,
    color: '#00cc66',
    weight: 6,
    type: 'bus',
  }];
}

function syncSearchMarkersVisibility(state) {
  Object.entries(state.searchMarkers).forEach(([searchId, markers]) => {
    const visible = state.visibleSearches.has(searchId);
    if (Array.isArray(markers)) {
      markers.forEach((marker) => {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(visible ? state.map : null);
        }
      });
    }
  });
}

export function toggleSearchVisibility(state, transitFns, searchId, onSelectionChange) {
  if (state.visibleSearches.has(searchId)) {
    state.visibleSearches.delete(searchId);
  } else {
    state.visibleSearches.add(searchId);
    state.selectedSearchId = searchId;
  }

  if (!state.visibleSearches.has(state.selectedSearchId)) {
    const fallback = state.searchHistory.find((s) => state.visibleSearches.has(s.id));
    state.selectedSearchId = fallback?.id || null;
  }

  redrawAllSearches(state, transitFns);
  renderSearchHistoryPanel(state, transitFns, onSelectionChange);
  if (typeof onSelectionChange === 'function') {
    onSelectionChange(getSelectedSearchEntry(state));
  }
}

export function setSearchVisibility(state, transitFns, searchId, visible, onSelectionChange) {
  if (visible) {
    state.visibleSearches.add(searchId);
    state.selectedSearchId = searchId;
  } else {
    state.visibleSearches.delete(searchId);
  }

  if (!state.visibleSearches.has(state.selectedSearchId)) {
    const fallback = state.searchHistory.find((s) => state.visibleSearches.has(s.id));
    state.selectedSearchId = fallback?.id || null;
  }

  redrawAllSearches(state, transitFns);
  renderSearchHistoryPanel(state, transitFns, onSelectionChange);
  if (typeof onSelectionChange === 'function') {
    onSelectionChange(getSelectedSearchEntry(state));
  }
}

export function renderSearchHistoryPanel(state, transitFns, onSelectionChange) {
  const panel = document.getElementById('search-history');
  if (!panel) return;

  let html = '<h3>Historial de búsquedas</h3>';
  html += '<div class="history-actions">';
  html += '<button id="clear-history" class="history-clear">Limpiar historial</button>';
  html += '</div>';

  if (state.searchHistory.length === 0) {
    html += '<p class="history-empty">No hay búsquedas registradas</p>';
  } else {
    html += '<div class="history-list">';
    state.searchHistory.forEach((search) => {
      const isVisible = state.visibleSearches.has(search.id);
      const isSelected = state.selectedSearchId === search.id;
      html += `<div class="history-item ${isVisible ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}" data-search-id="${search.id}">`;
      html += `<input type="checkbox" ${isVisible ? 'checked' : ''} data-search-id="${search.id}">`;
      html += `<div class="history-route"><span class="history-title"><span class="history-dot" style="background:${search.markerColor || '#2563eb'}"></span><strong>${search.origin}</strong></span><span>→</span><strong>${search.destination}</strong></div>`;
      html += `<div class="history-time">${search.timestamp}</div>`;
      html += '</div>';
    });
    html += '</div>';
  }

  panel.innerHTML = html;

  const clearBtn = document.getElementById('clear-history');
  if (clearBtn) clearBtn.addEventListener('click', () => clearSearchHistory(state, transitFns, onSelectionChange));

  panel.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      const searchId = item.getAttribute('data-search-id');
      if (!searchId) return;
      const checkbox = item.querySelector('input[type="checkbox"]');
      const nextValue = checkbox ? !checkbox.checked : !state.visibleSearches.has(searchId);
      setSearchVisibility(state, transitFns, searchId, nextValue, onSelectionChange);
    });
  });

  panel.querySelectorAll('input[type="checkbox"][data-search-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const searchId = target.getAttribute('data-search-id');
      if (!searchId) return;
      setSearchVisibility(state, transitFns, searchId, target.checked, onSelectionChange);
    });
  });
}

function syncSearchNodeVisibility(state) {
  const visibleNodeIds = new Set();

  state.searchHistory.forEach((search) => {
    if (!state.visibleSearches.has(search.id)) return;
    (search.nodeIds || []).forEach((nodeId) => visibleNodeIds.add(nodeId));
  });

  state.nodes.forEach((node) => {
    if (!node.marker || typeof node.marker.setMap !== 'function') return;
    node.marker.setMap(visibleNodeIds.has(node.id) ? state.map : null);
  });
}

function syncSearchEdgeVisibility(state) {
  state.edgePolylines.forEach(({ edge, polyline }) => {
    const visible = !edge.searchId || state.visibleSearches.has(edge.searchId);
    if (polyline && typeof polyline.setMap === 'function') {
      polyline.setMap(visible ? state.map : null);
    }
  });
}

export function clearSearchHistory(state, transitFns, onSelectionChange) {
  if (!confirm('¿Deseas limpiar todo el historial de búsquedas?')) return;

  Object.values(state.searchPolylines).forEach((lines) => {
    lines.forEach((line) => line.setMap(null));
  });
  transitFns.clearDrawnTransitLines(state);

  Object.values(state.searchMarkers).forEach((markers) => {
    markers.forEach((marker) => marker?.setMap(null));
  });

  state.nodes.forEach((node) => {
    if (node.marker && typeof node.marker.setMap === 'function') {
      node.marker.setMap(null);
    }
  });

  state.searchHistory = [];
  state.visibleSearches.clear();
  state.selectedSearchId = null;
  state.searchPolylines = {};
  state.searchMarkers = {};

  state.nodes = [];
  state.edges = [];
  state.edgePolylines.forEach(({ polyline }) => polyline.setMap(null));
  state.edgePolylines = [];

  saveSearchHistoryToStorage(state);
  saveState(state);

  renderSearchHistoryPanel(state, transitFns, onSelectionChange);
  if (typeof onSelectionChange === 'function') {
    onSelectionChange(null);
  }
}

export function saveSearchToHistory(state, transitFns, searchId, origin, destination, polylines, nodes, markerColor, recommendationData, onSelectionChange) {
  const timestamp = new Date().toLocaleString('es-ES');

  const getPolylineType = (polyline) => {
    const found = state.drawnTransitLines.find((item) => item.polyline === polyline);
    return found?.type || 'bus';
  };

  const getPolylineColor = (polyline) => polyline?.get?.('strokeColor') || polyline?.strokeColor || '#00cc66';
  const getPolylineWeight = (polyline) => polyline?.get?.('strokeWeight') || polyline?.strokeWeight || 6;
  const normalizePathPoint = (latlng) => normalizeCoords(latlng);

  const searchEntry = {
    id: searchId,
    origin,
    destination,
    timestamp,
    polylineData: polylines.map((p) => ({
      path: p.getPath().getArray().map((latlng) => normalizePathPoint(latlng)).filter(Boolean),
      color: getPolylineColor(p),
      weight: getPolylineWeight(p),
      type: getPolylineType(p),
    })).filter((line) => Array.isArray(line.path) && line.path.length > 0),
    markerColor,
    markerData: (nodes || [])
      .map((node) => {
        const position = normalizeCoords(node?.coords);
        if (!position) return null;
        return {
          position,
          title: node.name,
          color: markerColor,
        };
      })
      .filter(Boolean)
    ,
    nodeIds: (nodes || []).map((node) => node?.id).filter(Boolean),
    edgeIds: state.edges.filter((edge) => edge.searchId === searchId).map((edge) => edge.id),
    recommendationData,
  };

  state.searchHistory.unshift(searchEntry);
  if (state.searchHistory.length > 10) {
    const removed = state.searchHistory.pop();
    if (removed) {
      state.visibleSearches.delete(removed.id);
      if (state.searchMarkers[removed.id]) {
        state.searchMarkers[removed.id].forEach((marker) => marker?.setMap(null));
        delete state.searchMarkers[removed.id];
      }
    }
  }

  state.searchMarkers[searchId] = nodes
    .map((node) => node?.marker)
    .filter(Boolean);

  saveSearchHistoryToStorage(state);
  state.visibleSearches.add(searchId);
  state.selectedSearchId = searchId;
  renderSearchHistoryPanel(state, transitFns, onSelectionChange);
  redrawAllSearches(state, transitFns);
  if (typeof onSelectionChange === 'function') {
    onSelectionChange(searchEntry);
  }
}
