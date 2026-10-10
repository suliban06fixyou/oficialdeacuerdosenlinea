# Análisis de correspondencia: IPH de infracciones administrativas

Rama de trabajo: `feature/iph-pdf-generator`  
Base: `migracion-ia-economica`  
Alcance: análisis previo a la generación del PDF. No modificar ni desplegar producción sin autorización expresa.

## Formato fuente

El documento de referencia incluye siete secciones: (1) identificación del policía; (2) conocimiento de la probable infracción y quejoso; (3) lugar de los hechos; (4) narración; (5) uso de la fuerza; (6) detención(es); y (7) presentación ante el juzgado o autoridad competente.

## Campos que la aplicación ya captura

En `src/components/RevisorIPH.tsx`:
- Oficial primer respondiente (texto libre).
- Folio llamada / flagrancia.
- Falta administrativa y/o delito.
- Lugar del evento (texto libre).
- Horas de conocimiento, llegada, detención, lectura de derechos y traslado a comandancia.
- Narrativa original y narrativa revisada/sugerida.
- Hallazgos de revisión cronológica, preguntas esenciales y estilo.

## Matriz de brechas

| Sección del IPH | Cobertura observada en la app | Trabajo requerido para un PDF completo |
|---|---|---|
| 1. Identificación del policía | Nombre del oficial en un solo campo; folio disponible. | Separar apellidos/nombres y agregar grado/cargo, unidad, institución, adscripción, entidad y municipio. |
| 2. Conocimiento y quejoso | Hora de conocimiento y descripción general de la falta. | Fecha y hora completas, medio de conocimiento, detalle del reporte y campos opcionales del quejoso. |
| 3. Lugar | Campo de ubicación libre y hora de llegada. | Fecha/hora de arribo, tipo de lugar, descripción, domicilio desglosado y coordenadas opcionales. |
| 4. Narración | Narrativa original y texto revisado. | Imprimir la narrativa final editable y conservar la secuencia cronológica; no inventar hechos para completar campos. |
| 5. Uso de la fuerza | No se observan campos estructurados en el flujo actual. | Preguntar si hubo uso de fuerza; registrar resistencia/agresión, acciones, consecuencias, lesiones y asistencia médica cuando aplique. |
| 6. Detención(es) | Hora de detención y traslado; sin datos estructurados de persona detenida. | Datos de cada persona, domicilio, fecha/hora y lugar de detención. Permitir ninguna o varias personas. |
| 7. Entrega ante autoridad | No se observan campos estructurados en el flujo actual. | Juzgado/institución, fecha/hora de entrega, datos de quien entrega y recibe, firmas y espacio para sello. |

## Decisiones de implementación

1. Los campos no capturados deben mostrarse en blanco, como “No proporcionado” o mediante casillas Sí/No según el formato; nunca inferir nombres, domicilios, lesiones, uso de fuerza ni actuaciones.
2. Las secciones condicionales deben conservar la lógica del documento: si no hubo quejoso, saltar sus datos; si no hubo uso de fuerza, no exigir esa sección; si no hubo detención, permitir continuar a la presentación/cierre sin fabricar datos.
3. Permitir más de una persona detenida. La primera versión puede capturar una persona y dejar el diseño preparado para repetir el bloque, pero el formato fuente indica que la sección se repite si hay más de dos.
4. La narrativa revisada es una propuesta de redacción y debe ser validada por el policía antes de imprimir.
5. La salida debe diseñarse para impresión/PDF en tamaño carta y revisarse visualmente en cuatro páginas antes de considerarse lista.
6. El botón del flujo de salida cambiará a “Generar reporte en PDF”; la acción anterior de copiar/compartir narrativa no debe romperse accidentalmente. Se puede mantener como acción secundaria si resulta necesario.
7. No ejecutar `wrangler deploy`, no fusionar a `main` ni actualizar ramas de producción durante esta tarea.

## Pruebas mínimas

- Caso sin quejoso, sin uso de fuerza y sin persona detenida.
- Caso con quejoso, persona detenida y entrega a autoridad.
- Caso con uso de fuerza y asistencia médica.
- Texto narrativo largo, acentos y caracteres españoles.
- Verificar número de páginas, saltos, campos vacíos y que el contenido no se corte al imprimir.
