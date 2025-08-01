"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Building2, User, Mail } from "lucide-react";
import dynamic from "next/dynamic";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import Link from "next/link";

// Dynamic import with fallback
const ShaderBackground = dynamic(() => import("@/components/ShaderBackground"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />
});

const AnimatedBackground = dynamic(() => import("@/components/AnimatedBackground"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />
});

export default function RegisterPage() {
  const router = useRouter();
  
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    tenantName: "",
    email: "",
    username: "",
    password: "",
    firstName: "",
    lastName: ""
  });
  const [message, setMessage] = useState("");
  const [useShader, setUseShader] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tenantName.trim() || !formData.email.trim() || 
        !formData.username.trim() || !formData.password.trim()) {
      setMessage("❌ Compila tutti i campi");
      return;
    }

    if (formData.password.length < 8) {
      setMessage("❌ Password minimo 8 caratteri");
      return;
    }

    setMessage("🔄 Registrazione in corso...");

    startTransition(async () => {
      try {
        // Genera slug dal nome dell'organizzazione
        const tenantSlug = formData.tenantName.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Estrai nome e cognome dall'username o usa valori default
        const [firstName, lastName] = formData.username.includes('.') 
          ? formData.username.split('.')
          : [formData.username, 'Admin'];

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantName: formData.tenantName.trim(),
            tenantSlug: tenantSlug,
            email: formData.email.trim(),
            username: formData.username.trim(),
            password: formData.password,
            firstName: firstName || formData.username,
            lastName: lastName || 'Admin'
          })
        });

        const result = await response.json();

        if (result.success) {
          setMessage("✅ Registrazione completata!");
          setTimeout(() => {
            router.push('/login');
          }, 1500);
        } else {
          setMessage(`❌ ${result.error || "Errore registrazione"}`);
        }
      } catch (error) {
        console.error("Errore:", error);
        setMessage("❌ Errore di connessione");
      }
    });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative">
      {/* Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        {useShader ? (
          <div onError={() => setUseShader(false)}>
            <ShaderBackground />
          </div>
        ) : (
          <AnimatedBackground />
        )}
      </Suspense>

      <LiquidGlassCard className="w-full max-w-sm">
        {/* Header compatto */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Registrazione</h1>
          <p className="text-sm text-gray-400 mt-1">Crea la tua organizzazione</p>
        </div>

        {/* Form compatto */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Organization */}
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3" />
              Organizzazione
            </label>
            <input
              type="text"
              value={formData.tenantName}
              onChange={(e) => setFormData({...formData, tenantName: e.target.value})}
              placeholder="Siplit"
              disabled={isPending}
              className="v0-input h-10 text-sm"
              autoFocus
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1 mb-1">
              <Mail className="h-3 w-3" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="admin@esempio.it"
              disabled={isPending}
              className="v0-input h-10 text-sm"
            />
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1 mb-1">
              <User className="h-3 w-3" />
              Username Admin
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="admin"
              disabled={isPending}
              className="v0-input h-10 text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Min. 8 caratteri"
                disabled={isPending}
                className="v0-input h-10 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-10 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-4"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrazione...
              </>
            ) : (
              "Crea Account"
            )}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-medium text-center ${
            message.includes('❌') 
              ? 'bg-red-900/30 text-red-400 border border-red-800/50' 
              : message.includes('✅') 
              ? 'bg-green-900/30 text-green-400 border border-green-800/50'
              : 'bg-gray-900/50 text-gray-300 border border-gray-700/50'
          }`}>
            {message}
          </div>
        )}

        {/* Login link */}
        <div className="mt-4 text-center">
          <Link 
            href="/login" 
            className="text-xs text-gray-400 hover:text-amber-400 transition-colors"
          >
            Hai già un account? <span className="font-medium">Accedi</span>
          </Link>
        </div>
      </LiquidGlassCard>
    </div>
  );
}