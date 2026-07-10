# Quito Transit Analytics — Guía técnica y didáctica

Este proyecto simula y analiza rutas de transporte público en Quito usando Google Maps.
Está pensado para aprendizaje práctico de frontend, integración de APIs y manejo de estado.

## 1) ¿Qué se usó?

## Tecnologías principales
- HTML, CSS, JavaScript (arquitectura vanilla, modular)
- TypeScript + Vite (segunda arquitectura)
- Google Maps JavaScript API
  - Maps (mapa)
  - Places (autocompletado de direcciones)
  - Directions (rutas y tiempos en transporte público)
  - Geocoder (convertir coordenadas a dirección real)
- `localStorage` para persistir historial y estado visual

## Arquitecturas incluidas
1. **Vanilla modular** (raíz del workspace)
2. **Vite + TypeScript** (`quito-transit-vite-ts`)

---

## 2) Estructura del proyecto

## A. Vanilla (raíz)
- `index.html`: layout principal y paneles
- `styles.css`: estilos (UI empresarial)
- `js/app.js`: orquestación principal (eventos, cálculos, UI)
- `js/state.js`: estado global
- `js/core/mapCore.js`: mapa base, nodos, aristas, persistencia de grafo
- `js/core/transitCore.js`: consumo de Directions API y dibujo de líneas
- `js/core/historyCore.js`: historial, visibilidad, persistencia y reconstrucción

## B. Vite + TypeScript
- `quito-transit-vite-ts/src/ui/app.ts`: UI principal y lógica de interacción
- `quito-transit-vite-ts/src/infrastructure/maps/*`: integración de APIs de mapas
- `quito-transit-vite-ts/src/application/*`: casos de uso (recomendación)
- `quito-transit-vite-ts/src/domain/*`: modelos/tipos de dominio

---

## 3) Flujo funcional (paso a paso)

## 3.1) ¿Cómo se calculan y se dibujan los nodos?

En este proyecto, un “nodo” representa un punto del grafo (por ejemplo, origen o destino de una búsqueda).

### A) Cálculo de nodos dinámicos (al buscar una ruta)
Se realiza en `js/app.js`, dentro de la función `calculateAndDrawRealRoute(...)`.

Ahí se hace lo siguiente:
1. Se crean IDs dinámicos para origen y destino (`oId`, `dId`).
2. Se construyen objetos de nodo con estructura:
   - `id`
   - `name`
   - `coords` (lat/lng)
   - `score`
   - `description`
3. Esos nodos se agregan al estado global con `state.nodes.push(...)`.

### B) Dibujo de nodos en el mapa
También se dispara desde `js/app.js` llamando a `addNodeMarker(state, nodo)`.

La lógica de dibujo vive en `js/core/mapCore.js`, función `addNodeMarker(...)`:
- Crea el marcador de Google Maps (`new google.maps.Marker(...)`).
- Asigna estilo, etiqueta y color (crítico vs normal según `score`).
- Registra eventos:
  - `click`: muestra información del nodo.
  - `dragend`: actualiza coordenadas y redibuja conexiones.

### C) Redibujo de conexiones cuando se mueve un nodo
En `js/core/mapCore.js`, función `refreshMap(...)`:
- Limpia polylines anteriores.
- Vuelve a dibujar aristas con `drawEdge(...)` usando las coordenadas nuevas.

### D) Dibujo inicial de nodos al cargar la app
En `js/core/mapCore.js`, función `initMapBase(...)`:
- Recorre `state.nodes` y llama `addNodeMarker(...)` para pintar todos los nodos existentes
  (incluye nodos restaurados desde almacenamiento local).

## 3.2) Explicación por función (enfoque matemático y de nodos)

Esta sección sirve como guion para explicar a una profesora de Matemática qué hace cada función clave y cuál es su rol en el “modelo de grafo”.

### Archivo: `js/app.js` (coordinación del cálculo)

- `getCurrentPosition()`
  - Obtiene coordenadas GPS actuales del usuario.
  - Salida: un punto geográfico `(lat, lng)`.

- `getAddressFromLatLng(latLng)`
  - Convierte un punto `(lat, lng)` a dirección legible (geocodificación inversa).

- `updateRecommendationFromHistoryEntry(searchEntry)`
  - Actualiza paneles con resultados guardados de una búsqueda anterior.

- `updateRecommendationPanel(mejorOpcion, legInfo, origen, destino)`
  - Muestra la opción con menor tiempo y su distancia.

- `buildDetailedResultHtml(...)`
  - Construye el detalle visual de rutas evaluadas (desglose de líneas).

- `calculateAndDrawRealRoute(originLatLng, destLatLng, originName, destName)`
  - **Función principal del cálculo**:
    1. Consulta varias modalidades (`ALL`, `BUS`, `ECOVIA`, `SUBWAY`).
    2. Filtra rutas válidas.
    3. Ordena por tiempo total (`duration.value` en segundos).
    4. Toma la primera como mejor opción.
    5. Crea dos nodos dinámicos (origen/destino) y una arista entre ellos.
    6. Dibuja nodos y líneas en el mapa.
    7. Guarda todo en historial y `localStorage`.

- `initCustomRouteAutocompletes()`
  - Configura inputs de origen/destino con sugerencias de Google Places y enlaza el botón “Calcular”.

---

### Archivo: `js/core/mapCore.js` (modelo de grafo y render de nodos)

- `initMapBase(state, onToggleVisibility)`
  - Inicializa mapa, servicios y listeners de filtros.
  - Dibuja nodos/aristas existentes al cargar la aplicación.

- `addNodeMarker(state, node)`
  - Dibuja un nodo como marcador circular.
  - Regla visual: si `score > 8.8`, se marca como crítico (otro color).
  - Permite arrastrar el nodo (`dragend`) para cambiar su posición real.

- `drawEdge(state, edge)`
  - Dibuja la arista (conexión) entre dos nodos del grafo.

- `refreshMap(state)`
  - Redibuja aristas cuando cambian posiciones de nodos.

- `showNodeInfo(state, node)`
  - Muestra propiedades del nodo seleccionado (nombre, score, coordenadas).

- `saveSelectedNode(state)`
  - Guarda la posición editada del nodo en almacenamiento local.

- `renderNodeControls(state)`
  - Crea UI para administrar vías conectadas al nodo.

- `toggleEdgeReport(state, edge)`
  - Cambia una vía entre operativa/cerrada y actualiza el dibujo.

- `findNode(state, id)`
  - Busca un nodo por identificador.

- `getGraphState(state)`
  - Serializa nodos y aristas para guardar.

- `saveState(state)`
  - Guarda el grafo en `localStorage`.

- `applySavedState(state, saved)`
  - Reconstruye nodos/aristas desde datos guardados.

- `loadSavedState(state)`
  - Carga estado desde URL o `localStorage`.

---

### Archivo: `js/core/transitCore.js` (cálculo y dibujo de rutas de transporte)

- `getSystemType(lineName, vehicleType)`
  - Clasifica el tipo de sistema (metro, ecovía/trole, bus).

- `buildTransitOptions(mode)`
  - Define restricciones de búsqueda por modalidad.

- `isEcoviaOrTroleStep(step)`
  - Detecta si un segmento pertenece a Ecovía/Trole.

- `clearDrawnTransitLines(state)`
  - Limpia líneas de transporte dibujadas.

- `getSpeedColorByRank(index, total)`
  - Asigna color por ranking de tiempo (rápida/intermedia/lenta).

- `drawTransitLinesFromRoute(state, routeResult, speedColor)`
  - Dibuja en mapa los segmentos de transporte público de una ruta.

- `drawTransitLinesFromResults(state, routeResults)`
  - Ordena rutas por tiempo y dibuja todas con color de ranking.

- `updateDrawnTransitVisibility(state)`
  - Muestra/oculta líneas según filtros (bus/metro/ecovía).

- `fetchTransitOption(state, origin, destination, mode)`
  - Consulta Directions API para obtener rutas, duración y distancia.

- `getModeName(mode)`
  - Traduce códigos de modo a nombres legibles.

---

### Archivo: `js/core/historyCore.js` (persistencia de resultados y nodos)

- `saveSearchHistoryToStorage(state)` / `loadSearchHistory(state)`
  - Guarda/carga historial completo.

- `redrawAllSearches(state, transitFns)`
  - Reconstruye líneas y nodos visibles desde historial.

- `toggleSearchVisibility(...)` / `setSearchVisibility(...)`
  - Activa o desactiva visualización de una búsqueda.

- `renderSearchHistoryPanel(...)`
  - Renderiza lista de búsquedas con checkboxes.

- `clearSearchHistory(...)`
  - Limpia historial, líneas, nodos y estado persistido.

- `saveSearchToHistory(...)`
  - Guarda una búsqueda con:
    - geometría de líneas,
    - marcadores (nodos),
    - recomendación,
    - referencias de nodos/aristas.

---

### Resumen matemático simple (para exposición)

Se modela el problema como un grafo:
- Nodo = punto geográfico (origen/destino/parada)
- Arista = conexión posible entre nodos
- Peso de arista = tiempo estimado de viaje

El criterio de recomendación es:
- elegir la ruta con menor tiempo total.

Formalmente, si cada ruta candidata tiene tiempo total $T_i$, entonces se selecciona:

$$
	ext{ruta óptima} = \arg\min_i \; T_i
$$

En el código, ese cálculo se materializa ordenando rutas por `duration.value` y tomando la primera.

### Explicación detallada de fórmulas y símbolos

#### 1) Función de costo por ruta

$$
f(r_i)=T_i=\text{duration.value}(r_i)
$$

Donde:
- $f$: función objetivo (costo que se compara).
- $r_i$: ruta candidata número $i$.
- $i$: índice de ruta ($i=1,2,\dots,n$).
- $T_i$: tiempo total de la ruta $r_i$ (en segundos).
- $\text{duration.value}(r_i)$: tiempo que devuelve Directions API para esa ruta.

Interpretación: a cada ruta se le asigna un costo igual a su tiempo total.

#### 2) Selección de ruta óptima

$$
r^*=\arg\min_{r_i\in\mathcal{R}} f(r_i)
$$

Donde:
- $r^*$: ruta óptima (la elegida).
- $\arg\min$: operador “argumento que minimiza”.
- $\mathcal{R}$: conjunto de rutas candidatas.
- $r_i\in\mathcal{R}$: cada ruta posible dentro del conjunto.
- $f(r_i)$: costo de la ruta (tiempo).

Interpretación: se elige la ruta cuyo tiempo es el menor.

#### 3) Tiempo total como suma de tramos

$$
T_i=\sum_{k=1}^{m_i} t_{ik}
$$

Donde:
- $T_i$: tiempo total de la ruta $i$.
- $\sum$: sumatoria.
- $k$: índice del tramo dentro de la ruta.
- $m_i$: número total de tramos de la ruta $i$.
- $t_{ik}$: tiempo del tramo $k$ en la ruta $i$.

Interpretación: el tiempo total de una ruta es la suma de todos sus segmentos.

#### 4) Representación matemática de un nodo (punto geográfico)

$$
p=(\phi,\lambda)
$$

Donde:
- $p$: nodo/punto en el mapa.
- $\phi$: latitud.
- $\lambda$: longitud.

Para origen y destino:

$$
p_o=(\phi_o,\lambda_o),\quad p_d=(\phi_d,\lambda_d)
$$

Donde:
- $p_o$: punto de origen.
- $p_d$: punto de destino.
- $\phi_o,\lambda_o$: latitud/longitud del origen.
- $\phi_d,\lambda_d$: latitud/longitud del destino.

Interpretación: Google Maps entrega estas coordenadas y el sistema las dibuja como marcadores (nodos).

## Flujo 1: Búsqueda de ruta estándar
1. Usuario selecciona origen y destino (Places autocomplete).
2. El sistema consulta varias modalidades de transporte (`ALL`, `BUS`, `ECOVIA`, `SUBWAY`).
3. Para cada modalidad, Directions API devuelve rutas y tiempos.
4. Se filtran rutas válidas y se ordenan por duración.
5. Se muestra la **recomendación óptima** (la de menor tiempo).
6. Se dibujan líneas en el mapa y se guarda en historial.

## Flujo 2: Usar ubicación actual
1. Usuario activa check “usar ubicación actual”.
2. Navegador obtiene coordenadas con `navigator.geolocation`.
3. Geocoder convierte coordenadas a dirección real (calles).
4. Esa dirección se usa como origen para calcular la ruta al destino.

## Flujo 3: Historial de búsquedas
1. Cada búsqueda se guarda con:
   - origen/destino
   - timestamp
   - datos de líneas (path, color, tipo, grosor)
   - datos de marcadores
   - recomendación mostrada
2. Al marcar/desmarcar en historial:
   - se muestran/ocultan líneas
   - se muestran/ocultan nodos
   - se actualiza panel de recomendación
3. Al recargar pantalla, el historial se reconstruye desde `localStorage`.

## Flujo 4: Filtros por sistema
- Checkboxes: Bus / Metro / Ecovía-Trole.
- Afectan visibilidad de líneas según tipo detectado por segmento.

---

## 4) ¿Cómo se calcula la recomendación?

La recomendación se basa principalmente en **menor tiempo total de viaje**.

De forma simplificada:

1. Obtener rutas por modo.
2. Extraer duración de cada ruta (`duration.value` en segundos).
3. Ordenar de menor a mayor.
4. Elegir la primera como óptima.

También se listan alternativas evaluadas, líneas detectadas y distancia.

---

## 5) Consumo de APIs (explicación simple)

## Places API
- Sirve para sugerir direcciones válidas mientras el usuario escribe.
- Evita errores de texto libre y mejora precisión de coordenadas.

## Directions API
- Calcula rutas reales entre origen y destino.
- Devuelve:
  - `legs` (tramos)
  - `steps` (pasos, incluyendo pasos de transporte)
  - `duration`, `distance`
  - geometría para dibujar líneas en el mapa

## Geocoder API
- Convierte lat/lng en dirección legible.
- Se usa cuando el origen es ubicación actual.

---

## 6) Persistencia de datos

Se usa `localStorage` para:
- historial de búsquedas
- estado de nodos/aristas del grafo
- sesiones visuales

Ventaja didáctica: permite estudiar estado de UI sin backend.

---

## 7) Diferencias entre arquitecturas

## Vanilla
- Menos capas, más directo.
- Ideal para entender fundamentos de DOM, eventos y estado.

## Vite + TypeScript
- Tipado fuerte y mejor escalabilidad.
- Separación por capas (dominio, aplicación, infraestructura, UI).
- Más cercano a estándares empresariales.

---

## 8) Ejecución

## Vanilla (raíz)
Requisitos:
- Node.js 18+
- npm

Pasos:
1. Ir a la raíz del workspace (donde está `index.html`).
2. Levantar un servidor estático.

Comandos recomendados:
- Opción A (sin instalar global):
  - `npx serve`
- Opción B con puerto específico:
  - `npx serve -l 5173`

Luego abrir en navegador la URL que imprima la terminal (por ejemplo `http://localhost:3000` o `http://localhost:5173`).

## Vite + TypeScript
Dentro de `quito-transit-vite-ts`:
- configurar variables de entorno
- instalar dependencias
- ejecutar en modo desarrollo con Vite

Pasos:
1. Entrar al subproyecto:
   - `cd quito-transit-vite-ts`
2. Crear archivo de entorno:
   - `cp .env.example .env`
3. Instalar dependencias:
   - `npm install`
4. Ejecutar en desarrollo:
   - `npm run dev`
5. Abrir la URL de Vite (normalmente `http://localhost:5173`).

Comandos útiles adicionales:
- Build de producción:
  - `npm run build`
- Preview del build:
  - `npm run preview`

### Ejecutar Vite con Docker (opcional)
Dentro de `quito-transit-vite-ts`:
- `docker compose up --build`

Esto levanta el proyecto usando la configuración de `Dockerfile` y `docker-compose.yml`.

---

## 9) Conceptos académicos que se pueden explicar en clase

- Integración de servicios externos (APIs REST/JS SDK)
- Arquitectura modular
- Manejo de estado en frontend
- Persistencia local (`localStorage`)
- Programación asíncrona (`Promise`, `async/await`)
- Geolocalización web
- Renderizado condicional y sincronización de UI

---

## 10) Recomendación pedagógica para 2.º semestre

Sugerencia de práctica por etapas:
1. Mostrar mapa base.
2. Agregar autocomplete de direcciones.
3. Calcular una ruta simple.
4. Dibujar alternativas y elegir la mejor.
5. Guardar historial.
6. Añadir filtros y ubicación actual.

Así los estudiantes pasan de “UI básica” a “flujo completo empresarial” de forma progresiva.

---

## 11) Nota de seguridad

No se recomienda exponer claves de API en frontend en producción.
Para ambientes reales:
- restringir claves por dominio
- rotar claves
- usar backend/proxy cuando aplique

---

Si quieres, en un siguiente paso preparo también una versión de este README en formato “guion de exposición” (10–15 minutos) para presentar en clase.