#!/bin/bash
# Script veloce per tracciare lavori e sincronizzare

# Primo parametro: comando (work, issue, todo)
# Secondo parametro: descrizione o priorità (per todo)
# Terzo parametro: descrizione (per todo)

if [ $# -eq 0 ]; then
    echo "Uso: npm run session:quick <comando> <descrizione>"
    echo "Comandi:"
    echo "  work <desc>  - Traccia lavoro completato"
    echo "  issue <desc> - Segnala problema"
    echo "  todo <prio> <desc> - Aggiunge TODO"
    echo "  sync - Sincronizza e committa"
    exit 1
fi

case "$1" in
    work|issue)
        npm run session-update "$1" "${@:2}"
        ;;
    todo)
        npm run session-update "$1" "$2" "${@:3}"
        ;;
    sync)
        # Pull, aggiorna, committa e pusha
        git pull
        npm run session-update auto
        git add SESSION_STATUS.md
        git commit -m "update: session status - $(date +%H:%M)"
        git push
        echo "✅ SESSION_STATUS sincronizzato!"
        ;;
    *)
        echo "Comando non valido: $1"
        exit 1
        ;;
esac