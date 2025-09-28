# 🤖 Claude con Gestione Sessione Automatica

## Installazione Rapida

### Opzione 1: Usa il launcher locale (CONSIGLIATO)
Dalla cartella del progetto, usa semplicemente:
```bash
./claude
```

### Opzione 2: Installa alias globale
```bash
# Installa l'alias nel tuo shell config
./scripts/install-claude-alias.sh

# Ricarica la configurazione
source ~/.zshrc  # o ~/.bashrc

# Poi da qualsiasi cartella:
cd /path/to/roxy_bar
claude
```

## Come Funziona

1. **All'avvio di Claude**:
   - Git pull automatico
   - Aggiorna SESSION_STATUS.md
   - Mostra stato del progetto

2. **Durante la sessione**:
   - Claude funziona normalmente
   - Usa `npm run session:quick work "descrizione"` per tracciare progressi

3. **Alla chiusura di Claude**:
   - Ti chiede se vuoi salvare la sessione
   - Opzione per committare SESSION_STATUS.md

## Workflow Completo

```bash
# Mattina - avvia Claude (fa tutto automaticamente)
./claude

# Durante il lavoro - in un altro terminale
npm run session:quick work "Implementato feature X"
npm run session:quick sync  # Sincronizza con git

# Claude si chiude - salva automaticamente la sessione
```

## Vantaggi

✅ Non devi ricordarti di fare git pull
✅ SESSION_STATUS sempre aggiornato
✅ Tracciamento automatico delle sessioni
✅ Sincronizzazione multi-sviluppatore
✅ Zero configurazione aggiuntiva

## Troubleshooting

Se `./claude` non funziona:
1. Assicurati che `claude-chat` sia installato nel PATH
2. Verifica i permessi: `chmod +x claude`
3. Controlla che npm sia disponibile