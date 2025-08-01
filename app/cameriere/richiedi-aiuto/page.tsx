"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { ArrowLeft, Bell, MapPin, AlertCircle, Coffee, Users, Clock, Send, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { inviaRichiestaAiuto } from "@/lib/actions/richiedi-aiuto";
import { toast } from "@/lib/toast";

interface HelpRequest {
  tipo: 'URGENTE' | 'NORMALE' | 'BASSA_PRIORITA';
  destinatari: ('CAMERIERI' | 'CUCINA' | 'TUTTI')[];
  tavolo?: string;
  messaggio: string;
}

const PREDEFINED_MESSAGES = [
  { icon: Coffee, text: "Ordine pronto da servire", tipo: 'NORMALE' as const },
  { icon: Users, text: "Cliente richiede assistenza", tipo: 'NORMALE' as const },
  { icon: AlertCircle, text: "Problema con ordine", tipo: 'URGENTE' as const },
  { icon: Clock, text: "Ordine in ritardo", tipo: 'URGENTE' as const },
  { icon: MapPin, text: "Necessario supporto al tavolo", tipo: 'NORMALE' as const },
];

export default function RichiediAiutoPage() {
  const [request, setRequest] = useState<HelpRequest>({
    tipo: 'NORMALE',
    destinatari: ['CAMERIERI'],
    tavolo: '',
    messaggio: ''
  });
  const [isSending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const handleSendHelp = async () => {
    if (!request.messaggio.trim()) {
      toast.error("Inserisci un messaggio");
      return;
    }
    
    if (request.destinatari.length === 0) {
      toast.error("Seleziona almeno un destinatario");
      return;
    }
    
    setSending(true);
    try {
      const result = await inviaRichiestaAiuto(request);
      
      if (result.success) {
        setShowSuccess(true);
        toast.success("Richiesta di aiuto inviata!");
        
        // Reset form after 2 seconds
        setTimeout(() => {
          setRequest({
            tipo: 'NORMALE',
            destinatari: ['CAMERIERI'],
            tavolo: '',
            messaggio: ''
          });
          setShowSuccess(false);
        }, 2000);
      } else {
        toast.error(result.error || "Errore nell'invio della richiesta");
      }
    } catch (error) {
      console.error("Error sending help request:", error);
      toast.error("Errore nell'invio della richiesta");
    } finally {
      setSending(false);
    }
  };

  const toggleDestinatario = (dest: 'CAMERIERI' | 'CUCINA' | 'TUTTI') => {
    if (dest === 'TUTTI') {
      setRequest({ ...request, destinatari: ['TUTTI'] });
    } else {
      const newDest = request.destinatari.includes('TUTTI') 
        ? [dest]
        : request.destinatari.includes(dest)
          ? request.destinatari.filter(d => d !== dest)
          : [...request.destinatari.filter(d => d !== 'TUTTI'), dest];
      
      setRequest({ ...request, destinatari: newDest });
    }
  };

  const selectPredefinedMessage = (message: typeof PREDEFINED_MESSAGES[0]) => {
    setRequest({ 
      ...request, 
      messaggio: message.text,
      tipo: message.tipo
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center gap-3">
          <Link 
            href="/cameriere" 
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
          </Link>
          <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
            Richiedi Aiuto
          </h1>
        </div>
      </div>

      {showSuccess ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <CheckCircle className="h-24 w-24 mb-4" style={{ color: colors.text.success }} />
          <h2 className="text-2xl font-medium mb-2" style={{ color: colors.text.primary }}>
            Richiesta Inviata!
          </h2>
          <p style={{ color: colors.text.muted }}>
            I colleghi sono stati notificati
          </p>
        </div>
      ) : (
        <div className="p-6 max-w-2xl mx-auto">
          {/* Priority Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Priorità
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setRequest({ ...request, tipo: 'BASSA_PRIORITA' })}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.tipo === 'BASSA_PRIORITA' ? '' : ''
                }`}
                style={{
                  backgroundColor: request.tipo === 'BASSA_PRIORITA' ? colors.text.success : colors.bg.card,
                  color: request.tipo === 'BASSA_PRIORITA' ? 'white' : colors.text.secondary,
                  border: `1px solid ${request.tipo === 'BASSA_PRIORITA' ? colors.text.success : colors.border.primary}`
                }}
              >
                Bassa
              </button>
              <button
                onClick={() => setRequest({ ...request, tipo: 'NORMALE' })}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.tipo === 'NORMALE' ? '' : ''
                }`}
                style={{
                  backgroundColor: request.tipo === 'NORMALE' ? colors.accent : colors.bg.card,
                  color: request.tipo === 'NORMALE' ? colors.button.primaryText : colors.text.secondary,
                  border: `1px solid ${request.tipo === 'NORMALE' ? colors.accent : colors.border.primary}`
                }}
              >
                Normale
              </button>
              <button
                onClick={() => setRequest({ ...request, tipo: 'URGENTE' })}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.tipo === 'URGENTE' ? '' : ''
                }`}
                style={{
                  backgroundColor: request.tipo === 'URGENTE' ? colors.text.error : colors.bg.card,
                  color: request.tipo === 'URGENTE' ? 'white' : colors.text.secondary,
                  border: `1px solid ${request.tipo === 'URGENTE' ? colors.text.error : colors.border.primary}`
                }}
              >
                Urgente
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Destinatari
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => toggleDestinatario('CAMERIERI')}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.destinatari.includes('CAMERIERI') || request.destinatari.includes('TUTTI') ? '' : ''
                }`}
                style={{
                  backgroundColor: request.destinatari.includes('CAMERIERI') || request.destinatari.includes('TUTTI') 
                    ? colors.accent : colors.bg.card,
                  color: request.destinatari.includes('CAMERIERI') || request.destinatari.includes('TUTTI') 
                    ? colors.button.primaryText : colors.text.secondary,
                  border: `1px solid ${request.destinatari.includes('CAMERIERI') || request.destinatari.includes('TUTTI') 
                    ? colors.accent : colors.border.primary}`
                }}
              >
                Camerieri
              </button>
              <button
                onClick={() => toggleDestinatario('CUCINA')}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.destinatari.includes('CUCINA') || request.destinatari.includes('TUTTI') ? '' : ''
                }`}
                style={{
                  backgroundColor: request.destinatari.includes('CUCINA') || request.destinatari.includes('TUTTI') 
                    ? colors.accent : colors.bg.card,
                  color: request.destinatari.includes('CUCINA') || request.destinatari.includes('TUTTI') 
                    ? colors.button.primaryText : colors.text.secondary,
                  border: `1px solid ${request.destinatari.includes('CUCINA') || request.destinatari.includes('TUTTI') 
                    ? colors.accent : colors.border.primary}`
                }}
              >
                Cucina
              </button>
              <button
                onClick={() => toggleDestinatario('TUTTI')}
                className={`p-3 rounded-lg font-medium transition-colors ${
                  request.destinatari.includes('TUTTI') ? '' : ''
                }`}
                style={{
                  backgroundColor: request.destinatari.includes('TUTTI') ? colors.accent : colors.bg.card,
                  color: request.destinatari.includes('TUTTI') ? colors.button.primaryText : colors.text.secondary,
                  border: `1px solid ${request.destinatari.includes('TUTTI') ? colors.accent : colors.border.primary}`
                }}
              >
                Tutti
              </button>
            </div>
          </div>

          {/* Table Number (optional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Tavolo (opzionale)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
              <input
                type="text"
                placeholder="Numero tavolo"
                value={request.tavolo}
                onChange={(e) => setRequest({ ...request, tavolo: e.target.value })}
                className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>
          </div>

          {/* Predefined Messages */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Messaggi rapidi
            </label>
            <div className="space-y-2">
              {PREDEFINED_MESSAGES.map((msg, index) => {
                const Icon = msg.icon;
                return (
                  <button
                    key={index}
                    onClick={() => selectPredefinedMessage(msg)}
                    className="w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors"
                    style={{
                      backgroundColor: request.messaggio === msg.text ? colors.accent + '20' : colors.bg.card,
                      borderColor: request.messaggio === msg.text ? colors.accent : colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: colors.accent }} />
                    <span style={{ color: colors.text.primary }}>{msg.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Messaggio
            </label>
            <textarea
              placeholder="Descrivi la situazione..."
              value={request.messaggio}
              onChange={(e) => setRequest({ ...request, messaggio: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: colors.text.primary
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendHelp}
            disabled={isSending || !request.messaggio.trim() || request.destinatari.length === 0}
            className="w-full py-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: request.tipo === 'URGENTE' ? colors.text.error : colors.accent,
              color: colors.button.primaryText
            }}
          >
            {isSending ? (
              <>
                <Bell className="h-5 w-5 animate-pulse" />
                Invio in corso...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Invia Richiesta di Aiuto
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}