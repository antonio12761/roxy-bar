#!/bin/bash
# Script per iniziare una nuova sessione di lavoro

echo "🚀 Avvio sessione di lavoro..."

# Pull degli ultimi cambiamenti
echo "📥 Sincronizzazione con repository remoto..."
git pull

# Aggiorna timestamp SESSION_STATUS
echo "📝 Aggiornamento SESSION_STATUS.md..."
npm run session-update auto

# Mostra il contenuto attuale
echo ""
echo "📋 STATO ATTUALE DEL PROGETTO:"
echo "================================"
head -n 30 SESSION_STATUS.md | grep -E "^##|^###|^\*\*|^- \[" | head -20

echo ""
echo "✅ Sessione avviata! Buon lavoro!"
echo "💡 Ricorda di usare 'npm run session-update work \"descrizione\"' per tracciare i lavori"