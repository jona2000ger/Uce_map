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