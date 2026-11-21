# Vista previa segura del generador IPH en Cloudflare

## Estado verificado
- La compilación de la rama `feature/iph-pdf-generator-corrections` termina correctamente en GitHub Actions.
- Cloudflare ha construido versiones de la rama, pero la versión de producción sigue recibiendo el 100 % del tráfico.
- `wrangler.jsonc` contiene una vinculación D1 de **producción**. No ejecutar despliegues de prueba reutilizando esa vinculación.

## Antes de habilitar una vista previa
1. En Cloudflare, crear una base D1 **de pruebas** (distinta de `oficial-acuerdos-uso`) y obtener su ID real. No usar datos policiales reales para las pruebas.
2. Configurar los secretos de la vista previa de manera separada y con credenciales de pruebas. No copiar claves a GitHub ni al código.
3. Crear una configuración de Wrangler específica de vista previa con nombre y binding D1 de prueba, sin sustituir `wrangler.jsonc`. El ID D1 debe provenir de Cloudflare, nunca inventarse.
4. Desde un entorno autenticado en Cloudflare y con el código de esta rama, consultar `npx wrangler preview --help` para confirmar la sintaxis de la versión instalada y publicar la vista previa usando la configuración aislada.
5. Comprobar que la URL resultante **no** es `https://oficialdeacuerdosenlinea.suliban06.workers.dev/` y que el tráfico de producción permanece al 100 % en su versión anterior.

## Criterios de aceptación
- La vista previa presenta el botón `Abrir PDF` en la barra inferior; si aparece solamente `Abrir` dentro del visor, no es el componente actualizado.
- `Abrir PDF` abre el documento o informa claramente de un bloqueo del navegador.
- `Guardar PDF` descarga un PDF válido y `Compartir PDF` usa la función del dispositivo o descarga el archivo.
- El documento conserva el formato oficial, sin inventar datos; se validan las secciones 1, 2, 3, 5, 6 y 7 con narrativas sintéticas.
- No fusionar ni activar producción hasta revisar visualmente los PDF generados.

## Advertencias
- Una compilación marcada `Listo` no significa que el código haya recibido tráfico de producción.
- El botón `Vista` del Worker principal abre producción, no necesariamente una vista previa.
- No ejecutar `wrangler deploy`, `wrangler versions deploy` ni cambiar porcentajes de tráfico durante las pruebas.
