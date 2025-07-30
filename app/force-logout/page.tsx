"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForceLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear all possible cookies and localStorage
    const clearEverything = async () => {
      try {
        // Clear localStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear all cookies by setting them to expire
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Call server logout
        await fetch('/api/logout', { method: 'POST' });
        
        console.log('[ForceLogout] All data cleared, redirecting to login...');
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login');
        }, 1000);
        
      } catch (error) {
        console.error('[ForceLogout] Error:', error);
        // Force redirect anyway
        window.location.href = '/login';
      }
    };

    clearEverything();
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Pulizia sessione...</h2>
        <p className="text-white/70">Reindirizzamento al login in corso</p>
      </div>
    </div>
  );
}