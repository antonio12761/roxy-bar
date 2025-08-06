"use client";

import { useState, useTransition, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, Loader2, Eye, EyeOff, User } from "lucide-react";
import dynamic from "next/dynamic";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import Link from "next/link";
import { login } from "@/lib/actions/auth";

// Dynamic import with fallback
const ShaderBackground = dynamic(() => import("@/components/ShaderBackground"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />
});

const AnimatedBackground = dynamic(() => import("@/components/AnimatedBackground"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />
});

function LoginPageContent() {
  console.log("🌙 LOGIN PAGE LOADED - Multi-Tenant Dark Mode Roxy Bar");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromOrdine = searchParams.get('access') === 'ordine';
  
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [message, setMessage] = useState("");
  const [useShader, setUseShader] = useState(true);
  
  // Disabilita swipe back su login
  useEffect(() => {
    // Previeni swipe back gesture su iOS
    const preventSwipe = (e: TouchEvent) => {
      if (e.touches[0].clientX < 20) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchstart', preventSwipe, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', preventSwipe);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("🔄 Accesso in corso...");

    if (!formData.username.trim() || !formData.password.trim()) {
      setMessage("❌ Inserisci username e password");
      return;
    }

    startTransition(async () => {
      try {
        const result = await login(formData.username.trim(), formData.password.trim());

        if (result.success && result.user) {
          setMessage(`✅ Benvenuto, ${result.user.nome}!`);
          
          // Salva i dati utente nel localStorage
          localStorage.setItem('user', JSON.stringify(result.user));
          
          if (result.redirectPath) {
            setTimeout(() => {
              window.location.href = result.redirectPath || '/';
            }, 1500);
          }
        } else {
          setMessage(`❌ ${result.error || "Credenziali non valide"}`);
        }
      } catch (error) {
        console.error("Errore login:", error);
        setMessage("❌ Errore di connessione");
      }
    });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative">
      {/* Background with fallback */}
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        {useShader ? (
          <div onError={() => setUseShader(false)}>
            <ShaderBackground />
          </div>
        ) : (
          <AnimatedBackground />
        )}
      </Suspense>

      <LiquidGlassCard className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Coffee className="h-16 w-16 text-white/80" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Roxy Bar
          </h1>
          <p className="text-gray-400">
            Gestionale Operativo Ristorazione
          </p>
          {isFromOrdine && (
            <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
              <p className="text-green-400 text-sm font-medium">
                ✅ Accesso autorizzato - Area operatori
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div className="space-y-2">
            <label 
              htmlFor="username" 
              className="block text-sm font-semibold text-white flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="mario.rossi"
              disabled={isPending}
              autoFocus
              required
              className="v0-input"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="password" 
              className="block text-sm font-semibold text-white"
            >
              Password
            </label>
            
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="••••••••"
                disabled={isPending}
                required
                className="v0-input"
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !formData.username.trim() || !formData.password.trim()}
            className="w-full h-12 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Accesso in corso...
              </>
            ) : (
              <>
                🔓 Accedi al Sistema
              </>
            )}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm font-medium text-center transition-all ${
            message.includes('❌') 
              ? 'bg-red-900/30 text-red-400 border border-red-800/50' 
              : message.includes('✅') 
              ? 'bg-green-900/30 text-green-400 border border-green-800/50'
              : 'bg-gray-900/50 text-gray-300 border border-gray-700/50'
          }`}>
            {message}
          </div>
        )}

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Prima volta? {" "}
            <Link 
              href="/register" 
              className="text-amber-500 hover:text-amber-400 transition-colors font-semibold"
            >
              Registra la tua organizzazione
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2025 Roxy Bar
          </p>
        </div>
      </LiquidGlassCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}