import { createFileRoute } from "@tanstack/react-router";
import RevisorIPH from "@/components/RevisorIPH";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Revisor de Narrativas IPH | DSPM Chihuahua" },
      {
        name: "description",
        content:
          "Herramienta para revisar y corregir narrativas de IPH policial: validación cronológica, 7 preguntas esenciales, estilo policial y envío a Comandancia Sur o Norte.",
      },
      { property: "og:title", content: "Revisor de Narrativas IPH | DSPM Chihuahua" },
      {
        property: "og:description",
        content:
          "Revisión asistida de narrativas policiales con validación de horas, preguntas esenciales y envío a comandancia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevisorIPH,
});
