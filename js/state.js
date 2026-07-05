export const MAP_CENTER = { lat: -0.21, lng: -78.48 };
export const STORAGE_KEY = 'quito-graph-state';
export const SEARCH_HISTORY_KEY = 'quito-search-history';

export const state = {
  map: null,
  transitLayer: null,
  directionsService: null,
  infoWindow: null,
  selectedRouteLine: null,
  customRouteLine: null,
  selectedNode: null,
  edgePolylines: [],
  drawnTransitLines: [],
  searchHistory: [],
  visibleSearches: new Set(),
  selectedSearchId: null,
  searchPolylines: {},
  searchMarkers: {},
  nodes: [],
  edges: [],
};
