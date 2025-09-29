# Security Best Practices - Bar Roxy Clean

## 🔒 Logging e Debug

### ✅ DO - Cosa fare
1. **Usa sempre `secureLog` invece di `console.log`**
   ```typescript
   import { secureLog } from '@/lib/utils/log-sanitizer';
   
   // Corretto
   secureLog.info('Utente autenticato:', user.ruolo);
   
   // Sbagliato
   console.log('Utente autenticato:', user);
   ```

2. **Configura le variabili d'ambiente per il logging**
   ```env
   LOG_LEVEL="info"          # debug, info, warn, error
   SANITIZE_LOGS="true"      # Attiva sanitizzazione automatica
   DISABLE_SSE_LOGS="false"  # Controlla log SSE
   ```

### ❌ DON'T - Cosa NON fare
1. **Mai loggare informazioni sensibili**
   - Password (anche hash)
   - Token JWT
   - Session ID
   - Cookie values
   - Database connection strings

2. **Mai passare token nell'URL**
   ```typescript
   // ❌ SBAGLIATO
   const url = `/api/sse?token=${token}`;
   
   // ✅ CORRETTO - usa cookie httpOnly
   const url = `/api/sse`;
   ```

## 🔐 Autenticazione e Sessioni

### Cookie httpOnly
- Tutte le sessioni usano cookie httpOnly (`bar-roxy-session`)
- I token JWT NON devono mai essere accessibili via JavaScript
- EventSource include automaticamente i cookie nelle richieste

### Server Actions
- Usa Server Actions per operazioni sensibili
- Verifica sempre l'autenticazione all'inizio:
  ```typescript
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Non autenticato" };
  }
  ```

## 🛡️ Protezione Dati

### Input Validation
- Valida sempre gli input utente
- Usa Zod o simili per schema validation
- Sanitizza input prima di salvare nel DB

### Rate Limiting
- Implementa rate limiting su endpoint critici
- Limita tentativi di login per prevenire brute force

## 📝 Checklist Pre-Deployment

- [ ] Tutti i `console.log` sostituiti con `secureLog`
- [ ] Nessun token/password nei log
- [ ] Cookie configurati come httpOnly
- [ ] Variabili d'ambiente di produzione configurate
- [ ] Script di debug rimossi (`scripts/debug-*`)
- [ ] Endpoint di debug disabilitati
- [ ] HTTPS abilitato in produzione
- [ ] Rate limiting attivo

## 🚨 Segnalazione Problemi

Se trovi un problema di sicurezza:
1. NON aprire una issue pubblica
2. Contatta il supervisore
3. Documenta in privato il problema
4. Attendi fix prima di discuterne

## 📚 Risorse
- [OWASP Top 10](https://owasp.org/Top10/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)