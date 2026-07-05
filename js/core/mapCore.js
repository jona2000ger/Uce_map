import { MAP_CENTER, STORAGE_KEY } from '../state.js';

export function initMapBase(state, onToggleVisibility) {
  state.map = new google.maps.Map(document.getElementById('map'), {
    center: MAP_CENTER,
    zoom: 12,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
      { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    ],
    mapTypeControl: false,
    streetViewControl: false,
  });

  state.transitLayer = new google.maps.TransitLayer();
  state.transitLayer.setMap(null);
  state.directionsService = new google.maps.DirectionsService();
  state.infoWindow = new google.maps.InfoWindow();

  document.getElementById('toggle-bus')?.addEventListener('change', onToggleVisibility);
  document.getElementById('toggle-metro')?.addEventListener('change', onToggleVisibility);
  document.getElementById('toggle-ecovia')?.addEventListener('change', onToggleVisibility);

  state.nodes.forEach((node) => addNodeMarker(state, node));
  state.edges.forEach((edge) => drawEdge(state, edge));
}

export function addNodeMarker(state, node) {
  const isCritical = node.score > 8.8;
  const marker = new google.maps.Marker({
    position: node.coords,
    map: state.map,
    draggable: true,
    label: { text: node.id, color: 'white', fontWeight: 'bold', fontSize: '12px' },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: isCritical ? '#ff5f57' : '#4da6ff',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#ffffff',
    },
    title: node.name,
  });

  marker.addListener('click', () => showNodeInfo(state, node));

  marker.addListener('dragend', (event) => {
    node.coords.lat = event.latLng.lat();
    node.coords.lng = event.latLng.lng();
    refreshMap(state);
    if (state.selectedNode && state.selectedNode.id === node.id) {
      showNodeInfo(state, node);
    }
  });

  node.marker = marker;
}

export function drawEdge(state, edge) {
  const fromNode = findNode(state, edge.from);
  const toNode = findNode(state, edge.to);
  if (!fromNode || !toNode) return;

  const lineSymbol = { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 };

  const polyline = new google.maps.Polyline({
    path: [fromNode.coords, toNode.coords],
    strokeColor: edge.closed ? '#dd3333' : (edge.color || (edge.critical ? '#ff8c00' : '#7fbfff')),
    strokeOpacity: edge.closed ? 0 : 0.8,
    strokeWeight: edge.closed ? 0 : edge.critical ? 6 : 4,
    icons: edge.closed ? [{ icon: lineSymbol, offset: '0', repeat: '20px' }] : null,
    map: state.map,
  });

  polyline.addListener('click', () => toggleEdgeReport(state, edge));
  state.edgePolylines.push({ edge, polyline });
}

export function refreshMap(state) {
  state.edgePolylines.forEach(({ polyline }) => polyline.setMap(null));
  state.edgePolylines.length = 0;
  state.edges.forEach((edge) => drawEdge(state, edge));
}

export function showNodeInfo(state, node) {
  state.selectedNode = node;
  const info = `<strong>${node.name}</strong><br>${node.description}<br><b>Accidentes:</b> ${node.score}<br><b>Coords:</b> ${node.coords.lat.toFixed(5)}, ${node.coords.lng.toFixed(5)}<br><em>Arrastra este nodo para moverlo.</em>`;
  document.getElementById('node-info').innerHTML = info;
  renderNodeControls(state);

  state.infoWindow.setContent(`<div style="color:black;"><strong>${node.name}</strong><br>${node.description}</div>`);
  state.infoWindow.open(state.map, node.marker);
  state.map.panTo(node.coords);
  state.map.setZoom(13);
}

export function saveSelectedNode(state) {
  if (!state.selectedNode) return;
  saveState(state);
  alert(`Posición de ${state.selectedNode.name} guardada en el navegador.`);
}

export function renderNodeControls(state) {
  const container = document.getElementById('node-controls');
  if (!container) return;
  container.innerHTML = '';

  if (!state.selectedNode) {
    container.innerHTML = '<p>Selecciona un nodo para ver sus vías conectadas y reportar problemas.</p>';
    return;
  }

  const title = document.createElement('h3');
  title.innerText = `Nodo seleccionado: ${state.selectedNode.name}`;
  container.appendChild(title);

  const saveButton = document.createElement('button');
  saveButton.id = 'save-node-button';
  saveButton.innerText = 'Guardar posición exacta';
  saveButton.addEventListener('click', () => saveSelectedNode(state));
  container.appendChild(saveButton);

  const edgesList = document.createElement('div');
  edgesList.className = 'edge-list';
  const connected = state.edges.filter((edge) => edge.from === state.selectedNode.id || edge.to === state.selectedNode.id);

  if (connected.length === 0) {
    edgesList.innerHTML = '<p>Este nodo no tiene vías conectadas.</p>';
  } else {
    connected.forEach((edge) => {
      const item = document.createElement('div');
      item.className = 'edge-item';
      item.innerHTML = `<strong>${edge.name}</strong><span class="edge-status ${edge.closed ? 'edge-closed' : 'edge-open'}">${edge.closed ? 'Reportada' : 'Operativa'}</span>`;
      const button = document.createElement('button');
      button.className = 'edge-action';
      button.innerText = edge.closed ? 'Restaurar vía' : 'Reportar vía';
      button.addEventListener('click', () => {
        toggleEdgeReport(state, edge);
        showNodeInfo(state, state.selectedNode);
      });
      item.appendChild(button);
      edgesList.appendChild(item);
    });
  }

  container.appendChild(edgesList);
}

export function toggleEdgeReport(state, edge) {
  edge.closed = !edge.closed;
  refreshMap(state);
  if (state.selectedNode) renderNodeControls(state);
}

export function findNode(state, id) {
  return state.nodes.find((node) => node.id === id);
}

export function getGraphState(state) {
  return {
    nodes: state.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      coords: node.coords,
      score: node.score,
      description: node.description,
    })),
    edges: state.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      searchId: edge.searchId || null,
      name: edge.name,
      critical: !!edge.critical,
      closed: !!edge.closed,
      color: edge.color || null,
    })),
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getGraphState(state)));
}

export function applySavedState(state, saved) {
  if (!saved) return;

  if (Array.isArray(saved.nodes)) {
    saved.nodes.forEach((savedNode) => {
      if (!savedNode?.id || !savedNode?.coords) return;

      const normalizedCoords = {
        lat: Number(savedNode.coords.lat),
        lng: Number(savedNode.coords.lng),
      };

      if (Number.isNaN(normalizedCoords.lat) || Number.isNaN(normalizedCoords.lng)) return;

      const node = findNode(state, savedNode.id);
      if (node) {
        node.coords = normalizedCoords;
        if (savedNode.name) node.name = savedNode.name;
        if (typeof savedNode.score === 'number') node.score = savedNode.score;
        if (savedNode.description) node.description = savedNode.description;
      } else {
        state.nodes.push({
          id: savedNode.id,
          name: savedNode.name || savedNode.id,
          coords: normalizedCoords,
          score: typeof savedNode.score === 'number' ? savedNode.score : 5,
          description: savedNode.description || 'Nodo restaurado desde almacenamiento.',
        });
      }
    });
  }

  if (Array.isArray(saved.edges)) {
    saved.edges.forEach((savedEdge) => {
      if (!savedEdge?.id || !savedEdge?.from || !savedEdge?.to) return;

      const edge = state.edges.find((e) => e.id === savedEdge.id);
      if (edge) {
        edge.closed = !!savedEdge.closed;
        edge.critical = !!savedEdge.critical;
        edge.color = savedEdge.color || edge.color;
        edge.name = savedEdge.name || edge.name;
        edge.searchId = savedEdge.searchId || edge.searchId || null;
      } else {
        state.edges.push({
          id: savedEdge.id,
          from: savedEdge.from,
          to: savedEdge.to,
          searchId: savedEdge.searchId || null,
          name: savedEdge.name || `${savedEdge.from} - ${savedEdge.to}`,
          critical: !!savedEdge.critical,
          closed: !!savedEdge.closed,
          color: savedEdge.color || null,
        });
      }
    });
  }
}

export function loadSavedState(state) {
  try {
    const hash = window.location.hash;
    if (hash.startsWith('#state=')) {
      const encoded = hash.slice(7);
      const decoded = decodeURIComponent(atob(encoded));
      applySavedState(state, JSON.parse(decoded));
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applySavedState(state, JSON.parse(saved));
  } catch (error) {
    console.warn('No se pudo cargar el estado guardado:', error);
  }
}
