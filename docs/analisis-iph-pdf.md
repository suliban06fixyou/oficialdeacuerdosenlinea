# Generación de PDF del IPH municipal de Chihuahua

Rama de trabajo: `feature/iph-pdf-generator`  
Base de la solicitud de cambios: `migracion-ia-economica`  
Alcance: generación, vista previa y compartición del PDF usando exclusivamente el formato que proporcionó el usuario. No fusionar ni desplegar a producción sin autorización expresa.

## Plantilla autorizada

Archivo: `public/iph-infracciones-administrativas.pdf`

La plantilla se copia sin remaquetar desde el PDF que el usuario cargó. La huella Git del blob es `84ad33a575514e4ccb2d5a1359e744f76dcafd11`, que coincide con el archivo adjunto. Contiene cuatro páginas, con tamaño carta en las páginas 1 y 3 y A4 en las páginas 2 y 4. El PDF no contiene campos de formulario rellenables; los datos capturados se dibujan encima del contenido existente.

La aplicación no descarga plantillas de `gob.mx`, SESNSP ni otros sitios externos. El PDF utilizado se sirve desde los recursos estáticos locales del proyecto.

## Datos que la aplicación ya captura

En `src/components/RevisorIPH.tsx`:
- Nombre y número de placa del oficial en un solo campo de texto.
- Folio de llamada / flagrancia.
- Falta administrativa y/o delito.
- Lugar del evento en texto libre.
- Horas de conocimiento, llegada, detención, lectura de derechos y traslado a comandancia.
- Narrativa original y narrativa revisada/sugerida.
- Hallazgos de revisión cronológica, preguntas esenciales y estilo.

## Mapeo en la primera versión del generador

| Campo en la aplicación | Tratamiento |
|---|---|
| Falta administrativa / delito | Se escribe en el espacio descriptivo del apartado 2.2. |
| Lugar del evento | Se escribe en el apartado 3.2, “Describa brevemente”. |
| Hora de conocimiento | Se escribe en las casillas de hora del apartado 2.1. |
| Hora de llegada | Se escribe en las casillas de hora del apartado 3.1. |
| Hora de detención | Se escribe en las casillas de hora del apartado 6.3. |
| Narrativa final | Se escribe en el espacio rayado de la sección 4; los renglones se alinean con las líneas impresas. |
| Folio de llamada / flagrancia | Se usa en el nombre del archivo descargado. No se inserta en el número de referencia oficial porque el campo del formulario sigue una estructura distinta y el folio libre no garantiza correspondencia. |
| Oficial (nombre y placa en texto libre) | No se descompone en apellidos, nombres, grado o unidad; esos campos permanecen vacíos para no colocar datos en casillas incorrectas. |

## Reglas de integridad

1. No cambiar, recrear, omitir ni reordenar partes de la plantilla original.
2. No completar fechas, nombres desglosados, adscripción, domicilio detallado, quejoso, uso de fuerza, lesiones, personas detenidas o autoridad receptora si esos datos no están capturados de forma estructurada.
3. Los campos no informados quedan en blanco; no se agrega “No” ni “No proporcionado” como hecho inferido.
4. No recortar la narrativa silenciosamente. Si no cabe en los renglones disponibles, el generador muestra un error para que el usuario ajuste el texto antes de generar el PDF.
5. El archivo debe ser un PDF real descargable/compartible, no una captura de pantalla ni una liga al documento fuente.
6. Flujo en dispositivo móvil: generar PDF, mostrar vista previa, y permitir “Guardar PDF” o “Compartir PDF” mediante el menú nativo del dispositivo. Si el navegador no admite compartir archivos, descargar una copia para adjuntarla manualmente.
7. No ejecutar `wrangler deploy`, no fusionar la solicitud de cambios a `main`, ni alterar producción durante esta tarea.

## Verificaciones implementadas

- Validación automatizada de que la plantilla local se puede leer como PDF.
- Validación de cuatro páginas y de sus dimensiones mixtas esperadas.
- Compilación y comprobación de tipos de TypeScript.
- Prueba visual local de posición de texto ficticio (solo para calibración; no representa hechos reales).
- La aplicación aún necesita una prueba de extremo a extremo en el sitio de previsualización para confirmar la vista previa y compartir desde el dispositivo.
