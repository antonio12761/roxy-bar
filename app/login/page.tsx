"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/actions/auth";
import { Coffee, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  console.log("🌙 LOGIN PAGE LOADED - Dark Mode Bar Roxy");
  const router = useRouter();
  
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("🔄 Accesso in corso...");

    if (!password.trim()) {
      setMessage("❌ Inserisci la password");
      return;
    }

    startTransition(async () => {
      try {
        const result = await login(password.trim());

        if (result.success && result.user) {
          setMessage(`✅ Benvenuto, ${result.user.nome}!`);
          
          // Salva i dati utente nel localStorage per il componente UserDisplay
          console.log('💾 LOGIN: Saving user to localStorage:', result.user);
          console.log('💾 LOGIN: localStorage before save:', localStorage.length, 'items');
          
          localStorage.setItem('user', JSON.stringify(result.user));
          
          // Verifica che sia stato salvato
          const savedUser = localStorage.getItem('user');
          console.log('✅ LOGIN: Verified saved user:', savedUser);
          console.log('✅ LOGIN: localStorage after save:', localStorage.length, 'items');
          console.log('✅ LOGIN: All localStorage keys:', Object.keys(localStorage));
          
          // Test immediato di parsing
          try {
            const testParse = JSON.parse(savedUser || '{}');
            console.log('✅ LOGIN: Parse test successful:', testParse.nome, testParse.ruolo);
          } catch (error) {
            console.error('❌ LOGIN: Parse test failed:', error);
          }
          
          if (result.redirectPath) {
            console.log(`🔀 LOGIN: Redirect ${result.user.ruolo} →`, result.redirectPath);
            // Usa window.location per un redirect completo che ricarica la pagina
            setTimeout(() => {
              console.log('🔀 LOGIN: Executing redirect...');
              window.location.href = result.redirectPath!;
            }, 1500);
          }
        } else {
          setMessage(`❌ ${result.error || "Password non valida"}`);
        }
      } catch (error) {
        console.error("Errore login:", error);
        setMessage("❌ Errore di connessione");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/15/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -right-32 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-white/10/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Coffee className="h-16 w-16 text-white/70" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bar Roxy
          </h1>
          <p className="text-muted-foreground">
            Sistema di Gestione Dark Mode 🌙
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label 
              htmlFor="password" 
              className="block text-sm font-semibold text-foreground"
            >
              Password Personale
            </label>
            
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci la tua password..."
                disabled={isPending}
                autoFocus
                required
                className="w-full h-12 px-4 pr-12 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !password.trim()}
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
              ? 'bg-white/8/10 text-white/50 border border-white/10-500/20' 
              : message.includes('✅') 
              ? 'bg-white/10/10 text-white/60 border border-white/15-500/20'
              : 'bg-white/10/10 text-white/60 border border-white/15-500/20'
          }`}>
            {message}
          </div>
        )}

        {/* Development Helper */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 p-4 bg-card/50 rounded-lg border border-slate-700">
            <div className="text-xs font-bold text-white/70 mb-3">🔐 Password Dev:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div><span className="text-white/70">Admin:</span> Antonio</div>
              <div><span className="text-white/60">Manager:</span> Filippo</div>
              <div><span className="text-purple-400">Supervisore:</span> Giulio</div>
              <div><span className="text-white/60">Cameriere:</span> Marco</div>
              <div><span className="text-pink-400">Cassa:</span> Paola</div>
              <div><span className="text-cyan-400">Cucina:</span> Chiara</div>
              <div><span className="text-orange-400">Prepara:</span> Andrea</div>
              <div><span className="text-lime-400">Banco:</span> Elena</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2024 Bar Roxy - Clean Architecture 🚀
          </p>
        </div>
      </div>
    </div>
  );
}