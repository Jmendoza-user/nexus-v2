/**
 * NEXUS V2 — Pantalla 10: Config — Asistente Principal
 * Ruta: /m/config/principal
 */

import {
  ArrowLeft, Play, Pause, Volume2, ChevronRight,
  Mic, Sparkles, MessageSquare, Sliders,
} from "lucide-react";

const VOICE_OPTIONS = [
  { id: "elisa-maria", name: "Elisa María", description: "Voz principal · Español LATAM · Cálida", active: true },
  { id: "sofia",       name: "Sofía",       description: "Formal · Colombia · Neutra",             active: false },
  { id: "carlos",      name: "Carlos",      description: "Masculino · México · Dinámico",          active: false },
];

const TONE_SUGGESTIONS = [
  { id: "formal",   label: "Más formal",   preview: "Estimado usuario, he procesado su solicitud..." },
  { id: "casual",   label: "Más casual",   preview: "Listo Jerson, ya lo hice. ¿Algo más?" },
  { id: "concise",  label: "Más conciso",  preview: "Hecho." },
];

const CURRENT_SYSTEM_PROMPT = `Eres el asistente personal de Jerson Mendoza, fundador de J4 Smart Solutions. Tus características:
- Respuestas concisas y directas (máximo 3-4 líneas salvo que se pida detalle)
- Siempre priorizas calidad sobre velocidad
- Español neutro LATAM, tono cercano pero profesional
- Proactivo: alertas de borradores, tareas vencidas, oportunidades detectadas`;

export default function ConfigPrincipal() {
  const proactivityLevel = 3;

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/cuenta" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">Asistente principal</h1>
        <button className="text-[#7C5CFF] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1" aria-label="Guardar cambios">Guardar</button>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-10 space-y-5">

        {/* System prompt */}
        <section aria-labelledby="system-prompt-label">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <p id="system-prompt-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Prompt del sistema</p>
          </div>
          <textarea
            className="w-full bg-[#101015] border border-[#1F1F29] rounded-[14px] px-4 py-3.5 text-sm text-[#F4F4F7] leading-relaxed resize-none focus:outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20 transition-colors placeholder:text-[#6A6A7C]"
            rows={7}
            defaultValue={CURRENT_SYSTEM_PROMPT}
            aria-label="Prompt del sistema del asistente"
          />
          {/* Sugerencias de tono */}
          <p className="text-[#6A6A7C] text-xs mt-2 mb-2.5">Ajustar tono rápido:</p>
          <div className="flex gap-2 flex-wrap">
            {TONE_SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                className="bg-[#101015] border border-[#1F1F29] rounded-[10px] px-3 py-2 text-xs text-[#A8A8B8] hover:border-[#7C5CFF] hover:text-[#7C5CFF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                aria-label={`Aplicar tono: ${s.label}. Ejemplo: ${s.preview}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Voz */}
        <section aria-labelledby="voice-label">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 size={14} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <p id="voice-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Voz del asistente</p>
          </div>
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden" role="radiogroup" aria-label="Seleccionar voz">
            {VOICE_OPTIONS.map((voice, index) => (
              <div key={voice.id}>
                <div
                  className={`flex items-center gap-3 px-4 py-4 ${voice.active ? "bg-[#7C5CFF0D]" : ""}`}
                  role="radio"
                  aria-checked={voice.active}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${voice.active ? "border-[#7C5CFF]" : "border-[#2A2A36]"}`}>
                    {voice.active && <div className="w-2.5 h-2.5 rounded-full bg-[#7C5CFF]" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${voice.active ? "text-[#F4F4F7]" : "text-[#A8A8B8]"}`}>{voice.name}</p>
                    <p className="text-[#6A6A7C] text-xs">{voice.description}</p>
                  </div>
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-[#2A2A36] hover:border-[#7C5CFF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                    aria-label={`Escuchar muestra de voz ${voice.name}`}
                  >
                    <Play size={14} strokeWidth={1.75} className="text-[#A8A8B8]" />
                  </button>
                </div>
                {index < VOICE_OPTIONS.length - 1 && <div className="ml-[calc(1rem+1.25rem+0.75rem)] h-px bg-[#1F1F29]" />}
              </div>
            ))}
          </div>
        </section>

        {/* Proactividad */}
        <section aria-labelledby="proactivity-label">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <p id="proactivity-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Nivel de proactividad</p>
          </div>
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4">
            <div className="flex justify-between items-baseline mb-4">
              <p className="text-[#F4F4F7] text-sm font-semibold">
                {["Mínimo", "Moderado", "Equilibrado", "Activo", "Máximo"][proactivityLevel - 1]}
              </p>
              <span className="text-[#7C5CFF] text-sm font-bold font-mono">{proactivityLevel}/5</span>
            </div>
            {/* Slider visual */}
            <div className="relative mb-3">
              <div className="h-2 bg-[#1A1A22] rounded-full overflow-hidden">
                <div className="h-full bg-[#7C5CFF] rounded-full" style={{ width: `${((proactivityLevel - 1) / 4) * 100}%` }} />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#7C5CFF] shadow"
                style={{ left: `calc(${((proactivityLevel - 1) / 4) * 100}% - 10px)` }}
                role="slider"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={proactivityLevel}
                aria-label="Nivel de proactividad"
                tabIndex={0}
              />
            </div>
            <p className="text-[#6A6A7C] text-xs leading-relaxed">
              {proactivityLevel === 3 && "El agente te avisa cuando detecta algo relevante, pero espera que tú inicies la conversación principal."}
              {proactivityLevel === 4 && "El agente te envía resúmenes proactivos, recuerda tareas y sugiere acciones sin que se lo pidas."}
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
