# Narrative Guardian

ayudame a crear una APK que les sirve a mis mienbros de corporacion a revisar y editar sus narrativas de IPH policial utilizando un menu intuitivo dando recomendaciones y con la opcion de al finalizar la revicion que esta narrativa pueda ser enviada a un correo electronico especifico basado en dos botones que digan comandancia sur o comandancia norte y cuidando los siguientes aspectos de revicion y bases para emitir consejos y utilizando una imagen que ya tengo prediseñada como interfas de charla, la aplicacion debe contar imagenes que hagan referencia a la placa policial de la policia municipal al logo de DSPM chihuahua y utilizar colores azul marino. Validación Cronológica y Coherencia de Horas

Secuencia lógica obligatoria: El sistema debe verificar que las horas sigan un orden unidireccional sin saltos imposibles: Conocimiento del hecho \(\rightarrow \) Llegada \(\rightarrow \) Entrevista \(\rightarrow \) Lectura de derechos \(\rightarrow \) Detención \(\rightarrow \) Traslado a comandancia \(\rightarrow \) Remisión. [1, 2]

Matriz de validación de intervalos: Comprobar que el tiempo entre la hora de conocimiento y el arribo sea realista según la distancia, y que la lectura de derechos preceda o coincida exactamente con el momento formal de la detención.

Formato de 24 horas: Auditar que todas las marcas de tiempo usen el estándar de dos dígitos para hora y minutos (de 00:00 a 23:59). [1]

Control de Preguntas Esenciales (Las 7 H/W)

¿Qué pasó?: Descripción clara del hecho presuntamente delictivo o falta administrativa.

¿Cómo ocurrió?: Dinámica de los sucesos y uso de la fuerza si aplica.

¿Cuándo y Dónde?: Temporalidad exacta y ubicación georreferenciada del sitio de intervención.

¿Quiénes intervinieron?: Identificación precisa de víctimas, testigos y probables responsables.

¿Con qué y Para qué?: Objetos, armas o vehículos asegurados y el motivo o finalidad de la acción policial. [1, 2, 3]

Ortografía, Sintaxis y Estilo Policial

Corrección gramatical: Eliminar errores de dedo, acentuación y concordancia de género/número que resten formalidad legal al documento.

Lenguaje técnico: Sugerir el uso de terminología jurídica adecuada (ej. en lugar de palabras ambiguas, usar "primer respondiente", "indicio", "aseguramiento"). [1]

Objetividad narrativa: Detectar y señalar juicios de valor o apreciaciones subjetivas del oficial, promoviendo redacciones basadas estrictamente en hechos observables.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oficialdeacuerdosenlinea.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6b65c398-85fc-46b0-a4fb-ebfe552dacfc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
