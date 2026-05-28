/**
 * NEXUS V2 — Pantalla 15: Login
 * Ruta: /m/login
 */

import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";

export default function Login() {
  const showPassword = false;

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #7C5CFF 0%, transparent 70%)" }} />
      </div>

      {/* Contenido */}
      <div className="relative flex flex-col flex-1 px-6 pt-[calc(env(safe-area-inset-top,0px)+60px)]">

        {/* Logo + marca */}
        <div className="flex flex-col items-center mb-12">
          {/* Logo mark */}
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #7C5CFF 0%, #5B3ECC 100%)", boxShadow: "0 8px 32px rgba(124,92,255,0.35)" }}
            aria-hidden="true"
          >
            <Sparkles size={28} strokeWidth={1.5} className="text-white" />
          </div>

          <p className="text-[#F4F4F7] text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', var(--font-sans)" }}>
            NEXUS
          </p>
          <p className="text-[#6A6A7C] text-sm mt-1">Tu agente de IA personal</p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" aria-label="Formulario de inicio de sesión" onSubmit={(e) => e.preventDefault()}>
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-[#A8A8B8] text-sm font-medium mb-2">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              className="w-full bg-[#101015] border border-[#1F1F29] rounded-[10px] px-4 py-3.5 text-[#F4F4F7] text-sm placeholder:text-[#6A6A7C] focus:outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20 transition-colors"
              aria-required="true"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="text-[#A8A8B8] text-sm font-medium">
                Contraseña
              </label>
              <a href="/m/forgot-password" className="text-[#7C5CFF] text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[#101015] border border-[#1F1F29] rounded-[10px] px-4 pr-12 py-3.5 text-[#F4F4F7] text-sm placeholder:text-[#6A6A7C] focus:outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20 transition-colors"
                aria-required="true"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#6A6A7C] hover:text-[#A8A8B8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {/* CTA principal */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#7C5CFF] text-white rounded-[14px] py-4 font-bold text-sm mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A] hover:bg-[#9175FF] transition-colors"
            style={{ boxShadow: "0 8px 24px rgba(124,92,255,0.30)" }}
            aria-label="Iniciar sesión"
          >
            Continuar
            <ArrowRight size={18} strokeWidth={1.75} />
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#1F1F29]" />
          <span className="text-[#6A6A7C] text-xs">o</span>
          <div className="flex-1 h-px bg-[#1F1F29]" />
        </div>

        {/* Google SSO (futuro) */}
        <button
          className="w-full flex items-center justify-center gap-3 bg-[#101015] border border-[#2A2A36] rounded-[14px] py-4 text-[#A8A8B8] text-sm font-medium hover:border-[#7C5CFF] hover:text-[#F4F4F7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Continuar con Google (próximamente)"
          disabled
        >
          {/* Google icon simplificado */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" opacity=".5"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" opacity=".5"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" opacity=".5"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" opacity=".5"/>
          </svg>
          Continuar con Google
          <span className="text-xs text-[#6A6A7C]">(próximamente)</span>
        </button>

        {/* Crear cuenta */}
        <p className="text-center text-[#6A6A7C] text-sm mt-6">
          ¿No tienes cuenta?{" "}
          <a href="/m/onboarding/bienvenida" className="text-[#7C5CFF] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded">
            Crear cuenta gratis
          </a>
        </p>
      </div>

      {/* Footer */}
      <div className="relative px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4 text-center">
        <p className="text-[#2A2A36] text-xs">
          Al continuar aceptas los{" "}
          <a href="/terms" className="text-[#6A6A7C] hover:text-[#A8A8B8] underline">Términos de uso</a>
          {" "}y la{" "}
          <a href="/privacy" className="text-[#6A6A7C] hover:text-[#A8A8B8] underline">Política de privacidad</a>
        </p>
      </div>
    </div>
  );
}
