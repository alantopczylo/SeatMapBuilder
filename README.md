# SeatMap Builder (Fanz MVP)

Un editor visual interactivo para diseñar mapas de asientos de recintos, desarrollado como MVP para la prueba técnica de Fanz. La aplicación permite maquetar áreas complejas de asientos usando un entorno gráfico, inspirado en plataformas robustas como Seats.io.

## Características Principales
- 🖱️ **Canvas Interactivo:** Lienzo fluido con sistema de dibujo click-move-click y drag-and-drop.
- 🪑 **Creación de Filas y Mesas:** Calculadora trigonométrica y de circunferencias en tiempo real para proyectar asientos guiados magnéticamente (Orthogonal Snapping).
- 🏷️ **Etiquetado Avanzado:** Renombrado masivo ("Batch Labeling") modificando prefijos y secuencias de numeración instantáneamente. 
- 🔗 **Selección Inteligente:** AABB (Bounding Box Selection) múltiple, jerarquía natural de eventos (Bubbling) aislando partes de la meta-selección entera.
- 💾 **Portabilidad de Estado:** Exportación e importación cruzada con JSON directo.

## Stack Tecnológico 🛠️
- **Framework:** Next.js (App Router, Client Components).
- **Lenguaje:** TypeScript estricto.
- **Gráficos 2D:** React-Konva (wrapper declarativo sobre Canvas API).
- **Estado Global:** Zustand (store atómico).
- **Aesthetic / Styling:** Tailwind CSS + Lucide Icons (react-icons/md).
- **IA Asistencial:** Cursor y modelos integrados para pair-programming.

## Instrucciones de Setup 🚀

1. Clona el repositorio:
   ```bash
   git clone <repo-url>
   cd seatmap-builder
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Ejecuta el servidor de desarrollo en modo local:
   ```bash
   npm run dev
   ```
4. Abre [http://localhost:3000](http://localhost:3000). *(Advertencia: Konva se saltea el SSR de Next.js mediante dynamic imports para tener acceso fluido al API `window` del navegador).*

## Decisiones Técnicas Relevantes 🧠

1. **Konva.js over DOM/SVG:** Aunque un grid DOM con React puede funcionar para 200 asientos, Canvas es imprescindible cuando las arenas escalan a los +2,000 elementos. React-Konva mapea mutaciones estado directamente a renders de Canvas mitigando la saturación del Main Thread del navegador.
2. **Sistema Zustand:** Zustand fue preferido sobre Context API por sus suscripciones transitorias. El Canvas muta 60 veces por segundo en el arrastre (eventos `onMouseMove`); inyectar esos triggers a contextos pesados frenaría el Virtual DOM de React entero.
3. **Ghosting y Matemáticas C-M-C:** El dibujado natural mediante "Arrastrar" generaba clicks fantasma por hardware imperfecto. Se transicionó deliberadamente el paradigma core a una triada Click -> Move -> Click apoyada estrictamente con fórmulas `Math.atan2` (Rotación/Espaciado de fila) y `Math.PI` / Circunferencias (Radios de las sillas de Mesa) proyectando vistas previas opacas antes de consolidar datos nativos garantizando 0 errores manuales del arquitecto.
4. **Almacenamiento Serializado (No DB):** Para alinearse con las reglas de MVP puro cliente y evitar fricción de configuración o despliegue en bases de datos para revisión técnica temporal rápida, se persistió la robustez de los datos nativos serializados y expuestos directamente por el cliente asíncrono con `FileReader` para cargar las mutaciones. El esquema JSON exportable emula perfectamente cualquier DB NoSQL que usaría en producción.


## Esquema de Datos 📦
Los modelos de datos (`store/useMapStore.ts`) están normalizados bajo una herencia abstracta base. 
```typescript
interface Seat {
  id: string; // UUID v4
  label: string; // ej: '1A', 'VIP'
  x: number; // Relativo al centro de parent.
  y: number; // Relativo al centro de parent.
  status: string; // 'available', 'reserved'
}

interface BaseMapElement {
  id: string; // ID global
  type: 'row' | 'table' | 'area'; // Discriminador nativo
  label: string;
  x: number; // Absoluto en el Canvas Global
  y: number; // Absoluto en el Canvas Global
}
```

## Supuestos Asumidos 📌
* Se asume que el diseñador mapea secciones en un contenedor idealizado plano. Las distancias no usan métricas escaladas a la arquitectura civil (p. ej. metros cuadrados de construcción real), sino píxeles relativos exportables posteriormente.
* El etiquetado rápido ignora saltos de filas por ahora (p. ej. ignorar Fila 13 o letra O por temas visuales) e incrementa numéricamente la progresión en base `N+1`.
* En la actual iteración visual MVP, la mesa central de herramientas prioriza `row` y `table` asimilándolos como contenedores dependientes de `Seats`. 

## AI Prompts (Log de Auditoría) 📜
Con el objetivo de proveer transparencia, las interacciones sostenidas con el modelo asistencial se encuentran en el archivo base adjunto `prompts.jsonl`.
Cada línea describe el timestamp, propósito atómico, el prompt inyectado, y la resolución/nota tomada para cada sprint.
# SeatMapBuilder
