import assert from "node:assert/strict";
import { extraerUsoFuerza } from "../src/components/IphPdfGenerator.tsx";

// Verbal refusal and insults describe conduct/resistance, not automatically force.
const resistanceOnly = extraerUsoFuerza(
  "La persona se negó a obedecer la indicación. Posteriormente, profirió insultos contra el oficial.",
);
assert.match(resistanceOnly.resistencia, /se negó a obedecer/i);
assert.match(resistanceOnly.resistencia, /profirió insultos/i);
assert.equal(resistanceOnly.descripcion, "");

// An explicitly documented verbal instruction belongs in the police-action field.
const verbalization = extraerUsoFuerza(
  "Se le indicó que se detuviera. La persona se negó a obedecer y trató de escapar.",
);
assert.match(verbalization.resistencia, /se negó a obedecer/i);
assert.match(verbalization.resistencia, /trató de escapar/i);
assert.equal(verbalization.descripcion, "Se le indicó que se detuviera.");

// The second field may include an explicitly described act to neutralize the threat.
const neutralization = extraerUsoFuerza(
  "Fue necesario neutralizarlo con una técnica de control.",
);
assert.equal(neutralization.resistencia, "");
assert.match(neutralization.descripcion, /neutralizarlo/i);

// A detention alone must not be treated as evidence that force was used.
const detentionOnly = extraerUsoFuerza(
  "La persona fue detenida a las 20:10 horas y trasladada a comandancia.",
);
assert.deepEqual(detentionOnly, { resistencia: "", descripcion: "" });

console.log("Validación de resistencia y uso de fuerza completada.");
