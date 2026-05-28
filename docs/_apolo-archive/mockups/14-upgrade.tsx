/**
 * NEXUS V2 — Pantalla 14: Upgrade / Planes
 * Ruta: /m/upgrade
 */

import { ArrowLeft, Check, Sparkles, Users, Zap, X } from "lucide-react";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceSubtitle: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  highlight: boolean;
  badge?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "Gratis",
    priceSubtitle: "siempre",
    description: "Para explorar el asistente",
    cta: "Plan actual",
    highlight: false,
    icon: Zap,
    features: [
      { text: "500 mensajes IA / mes",                   included: true },
      { text: "100 segundos de voz / mes",               included: true },
      { text: "50 MB vault",                             included: true },
      { text: "1 agente base",                           included: true },
      { text: "Borradores financieros",                  included: false },
      { text: "Skills avanzadas",                        included: false },
      { text: "TokenGuard",                              included: false },
      { text: "Conexiones OAuth (Gmail, Calendar)",      included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "COP 45.000",
    priceSubtitle: "/ mes · ~11 USD",
    description: "Para profesionales que usan IA a diario",
    cta: "Cambiar a Pro",
    highlight: true,
    badge: "14 días gratis",
    icon: Sparkles,
    features: [
      { text: "5.000 mensajes IA / mes",                 included: true },
      { text: "5.000 segundos de voz / mes",             included: true },
      { text: "500 MB vault",                            included: true },
      { text: "3 agentes personalizables",               included: true },
      { text: "Borradores financieros ilimitados",       included: true },
      { text: "Skills avanzadas (autocure)",             included: true },
      { text: "TokenGuard activo",                       included: true },
      { text: "Gmail + Calendar + Telegram",             included: true },
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "COP 120.000",
    priceSubtitle: "/ mes · hasta 5 usuarios",
    description: "Para equipos PyME",
    cta: "Contactar ventas",
    highlight: false,
    icon: Users,
    features: [
      { text: "Todo lo de Pro × 5 usuarios",             included: true },
      { text: "Agentes compartidos",                     included: true },
      { text: "Panel admin de uso",                      included: true },
      { text: "SSO Google Workspace",                    included: true },
      { text: "Soporte prioritario",                     included: true },
      { text: "Integración MercadoPago",                 included: true },
      { text: "Reports de productividad",                included: true },
      { text: "Onboarding dedicado",                     included: true },
    ],
  },
];

export default function Upgrade() {
  const currentPlan = "free";

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/cuenta" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">Planes</h1>
      </header>

      {/* Hero */}
      <div className="px-5 pb-6 text-center">
        <p className="text-[#F4F4F7] text-2xl font-bold mb-2">Elige tu plan</p>
        <p className="text-[#A8A8B8] text-sm">Cancela cuando quieras. Sin permanencia.</p>
      </div>

      {/* Cards de planes */}
      <main className="flex-1 overflow-y-auto px-5 pb-10">
        <div className="flex flex-col gap-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === currentPlan} />
          ))}
        </div>

        <p className="text-center text-[#6A6A7C] text-xs mt-8 leading-relaxed px-4">
          Precios en COP. Cobrado mensualmente vía MercadoPago. Al cambiar de plan, el acceso nuevo se activa inmediatamente.
        </p>
      </main>
    </div>
  );
}

function PlanCard({ plan, isCurrent }: { plan: Plan; isCurrent: boolean }) {
  return (
    <div
      className={`rounded-[20px] border p-5 relative overflow-hidden ${
        plan.highlight
          ? "bg-[#101015] border-[#7C5CFF]"
          : "bg-[#101015] border-[#1F1F29]"
      }`}
      style={plan.highlight ? { boxShadow: "0 0 0 1px #7C5CFF30, 0 12px 32px rgba(124,92,255,0.12)" } : {}}
      role="article"
      aria-label={`Plan ${plan.name}`}
    >
      {/* Badge "más popular" */}
      {plan.highlight && (
        <div className="absolute top-4 right-4 bg-[#7C5CFF] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          Más popular
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center ${plan.highlight ? "bg-[#7C5CFF1A]" : "bg-[#1A1A22]"}`}>
          <plan.icon size={20} strokeWidth={1.75} className={plan.highlight ? "text-[#7C5CFF]" : "text-[#6A6A7C]"} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[#F4F4F7] text-lg font-bold">{plan.name}</p>
          <p className="text-[#6A6A7C] text-xs">{plan.description}</p>
        </div>
      </div>

      {/* Precio */}
      <div className="mb-1">
        <span
          className="text-[2rem] font-bold leading-none tracking-tight"
          style={{ fontFamily: "'Space Grotesk', var(--font-sans)", color: plan.highlight ? "#7C5CFF" : "#F4F4F7" }}
        >
          {plan.price}
        </span>
      </div>
      <p className="text-[#6A6A7C] text-xs mb-4">{plan.priceSubtitle}</p>

      {/* Features */}
      <ul className="space-y-2.5 mb-5" role="list" aria-label={`Características del plan ${plan.name}`}>
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {f.included ? (
              <Check size={14} strokeWidth={2} className="text-[#22C55E] flex-shrink-0" aria-hidden="true" />
            ) : (
              <X size={14} strokeWidth={2} className="text-[#2A2A36] flex-shrink-0" aria-hidden="true" />
            )}
            <span className={`text-sm ${f.included ? "text-[#A8A8B8]" : "text-[#2A2A36]"}`}>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <div className="w-full flex items-center justify-center py-3.5 rounded-[14px] border border-[#2A2A36] text-[#6A6A7C] text-sm font-medium">
          Plan actual
        </div>
      ) : (
        <button
          className={`w-full py-3.5 rounded-[14px] font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A] transition-colors
            ${plan.highlight
              ? "bg-[#7C5CFF] text-white hover:bg-[#9175FF] focus-visible:ring-[#7C5CFF]"
              : "bg-[#1A1A22] text-[#F4F4F7] border border-[#2A2A36] hover:border-[#7C5CFF] focus-visible:ring-[#7C5CFF]"
            }`}
          style={plan.highlight ? { boxShadow: "0 8px 24px rgba(124,92,255,0.30)" } : {}}
          aria-label={`${plan.cta}${plan.badge ? ` — ${plan.badge}` : ""}`}
        >
          {plan.cta}
          {plan.badge && (
            <span className="ml-2 text-xs opacity-80">· {plan.badge}</span>
          )}
        </button>
      )}
    </div>
  );
}
