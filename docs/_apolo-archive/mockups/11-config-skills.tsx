/**
 * NEXUS V2 — Pantalla 11: Config — Skills
 * Ruta: /m/config/skills
 */

import { ArrowLeft, Zap, PlugZap, Plus, Search, ChevronRight, Download, CheckCircle2, AlertTriangle, X } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  category: string;
  installed: boolean;
  hasUpdate?: boolean;
  broken?: boolean;
  mcpRequired?: string;
}

const SKILLS: Skill[] = [
  { id: "s1", name: "ui-ux-pro-max",      description: "Diseño web e interfaces de usuario de alta fidelidad.",     capabilities: ["Wireframes", "Componentes React", "Design tokens", "Mockups"], category: "Diseño", installed: true },
  { id: "s2", name: "banner-design",       description: "Banners y contenido visual para redes sociales.",           capabilities: ["Instagram", "LinkedIn", "Stories", "Portadas"], category: "Diseño", installed: true },
  { id: "s3", name: "email-manager",       description: "Gestión y redacción de correos con contexto del vault.",    capabilities: ["Redactar", "Responder", "Priorizar", "Resumir"], category: "Productividad", installed: true },
  { id: "s4", name: "image-gen-prompts",   description: "Prompts optimizados para Midjourney, DALL-E y Stable Diffusion.", capabilities: ["Midjourney v6", "DALL-E 3", "SD XL"], category: "IA Generativa", installed: true, hasUpdate: true },
  { id: "s5", name: "web-scraper",         description: "Scraping headless con Playwright para extracción de datos.", capabilities: ["HTML", "JavaScript", "Tablas", "PDFs"], category: "Automatización", installed: true, broken: true, mcpRequired: "playwright-mcp" },
  { id: "s6", name: "code-review",         description: "Revisión de código con análisis de seguridad y rendimiento.", capabilities: ["TypeScript", "Python", "SQL", "Dockerfile"], category: "Desarrollo", installed: false },
  { id: "s7", name: "calendar-manager",    description: "Gestión avanzada de Google Calendar con rutinas inteligentes.", capabilities: ["Crear eventos", "Rutas", "Rutinas", "Conflictos"], category: "Productividad", installed: false },
  { id: "s8", name: "invoice-ocr",         description: "Extracción de datos de facturas físicas y digitales.",      capabilities: ["PDF", "Foto", "TIFF", "Historial"], category: "Finanzas", installed: false },
];

export default function ConfigSkills() {
  const installed = SKILLS.filter(s => s.installed);
  const available = SKILLS.filter(s => !s.installed);

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/cuenta" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">Skills</h1>
      </header>

      {/* Search */}
      <div className="px-5 pb-4">
        <div className="relative">
          <Search size={15} strokeWidth={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6A6A7C] pointer-events-none" aria-hidden="true" />
          <input type="search" placeholder="Buscar skills..." className="w-full bg-[#101015] border border-[#1F1F29] rounded-[10px] pl-10 pr-4 py-2.5 text-sm text-[#F4F4F7] placeholder:text-[#6A6A7C] focus:outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20 transition-colors" aria-label="Buscar skills" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-10 space-y-6">
        {/* Instaladas */}
        <section aria-labelledby="installed-label">
          <p id="installed-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium mb-3">Instaladas ({installed.length})</p>
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden">
            {installed.map((skill, i) => (
              <div key={skill.id}>
                <SkillRow skill={skill} />
                {i < installed.length - 1 && <div className="ml-[calc(1rem+2rem+0.75rem)] h-px bg-[#1F1F29]" />}
              </div>
            ))}
          </div>
        </section>

        {/* Disponibles */}
        <section aria-labelledby="available-label">
          <p id="available-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium mb-3">Disponibles ({available.length})</p>
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden">
            {available.map((skill, i) => (
              <div key={skill.id}>
                <SkillRow skill={skill} />
                {i < available.length - 1 && <div className="ml-[calc(1rem+2rem+0.75rem)] h-px bg-[#1F1F29]" />}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 ${skill.installed ? "bg-[#7C5CFF1A]" : "bg-[#1A1A22]"}`}>
        {skill.broken
          ? <AlertTriangle size={16} strokeWidth={1.75} className="text-[#F59E0B]" />
          : skill.installed
          ? <Zap size={16} strokeWidth={1.75} className="text-[#7C5CFF]" />
          : <PlugZap size={16} strokeWidth={1.75} className="text-[#6A6A7C]" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[#F4F4F7] text-sm font-semibold font-mono truncate">{skill.name}</p>
          {skill.hasUpdate && <span className="text-[10px] bg-[#F59E0B1A] text-[#F59E0B] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">actualización</span>}
          {skill.broken && <span className="text-[10px] bg-[#EF44441A] text-[#EF4444] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">error</span>}
        </div>
        <p className="text-[#6A6A7C] text-xs truncate">{skill.description}</p>
      </div>
      {skill.installed ? (
        skill.hasUpdate ? (
          <button className="flex-shrink-0 flex items-center gap-1.5 bg-[#F59E0B1A] text-[#F59E0B] text-xs font-semibold px-2.5 py-1.5 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]" aria-label={`Actualizar skill ${skill.name}`}>
            <Download size={12} strokeWidth={1.75} />
            Actualizar
          </button>
        ) : (
          <ChevronRight size={16} strokeWidth={1.75} className="text-[#6A6A7C] flex-shrink-0" aria-hidden="true" />
        )
      ) : (
        <button className="flex-shrink-0 flex items-center gap-1.5 bg-[#7C5CFF1A] text-[#7C5CFF] text-xs font-semibold px-2.5 py-1.5 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label={`Instalar skill ${skill.name}`}>
          <Plus size={12} strokeWidth={2} />
          Instalar
        </button>
      )}
    </div>
  );
}
