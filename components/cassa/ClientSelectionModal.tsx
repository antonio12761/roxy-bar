import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, User, UserPlus } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { getClienti, createCliente } from "@/lib/actions/clienti";
import { searchClienti, getRecentClienti } from '@/lib/actions/clienti-autocomplete';

interface ClientSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (client: any) => void;
}

export default function ClientSelectionModal({ isOpen, onClose, onSelectClient }: ClientSelectionModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [clientSearch, setClientSearch] = useState("");
  const [allClients, setAllClients] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentClienti, setRecentClienti] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ 
    nome: "", 
    telefono: "", 
    email: "", 
    note: "" 
  });

  const searchClients = async (search: string) => {
    try {
      setIsLoadingClients(true);
      const result = await getClienti(1, 20, search);
      if (result.success && result.data) {
        setAllClients(result.data.clienti || []);
      }
    } catch (error) {
      console.error("Errore ricerca clienti:", error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    
    // Carica clienti recenti all'apertura
    getRecentClienti().then(setRecentClienti);
    
    const timer = setTimeout(() => {
      searchClients(clientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, isOpen]);

  // Gestione autocomplete
  const handleClientSearchChange = useCallback(async (value: string) => {
    setClientSearch(value);
    
    if (value.length >= 2) {
      const results = await searchClienti(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else if (value.length === 0 && recentClienti.length > 0) {
      setSuggestions(recentClienti);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [recentClienti]);

  const handleSelectSuggestion = (suggestion: string) => {
    setClientSearch(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    // Imposta automaticamente il nome nel form nuovo cliente
    if (showNewClientForm) {
      setNewClientData({ ...newClientData, nome: suggestion });
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.nome.trim()) return;
    
    try {
      const result = await createCliente({
        ...newClientData,
        attivo: true
      });
      if (result.success && result.data) {
        // Seleziona automaticamente il cliente appena creato
        onSelectClient(result.data);
        // Chiudi il modal
        handleClose();
        // Notifica successo
        if (typeof window !== 'undefined' && Notification.permission === "granted") {
          new Notification("Cliente Creato", {
            body: `${result.data.nome} è stato aggiunto con successo`,
            icon: '/icon-192.png'
          });
        }
      } else {
        alert(result.error || "Errore creazione cliente");
      }
    } catch (error) {
      console.error("Errore creazione cliente:", error);
      alert("Errore durante la creazione del cliente");
    }
  };

  const handleClose = () => {
    setClientSearch("");
    setShowNewClientForm(false);
    setNewClientData({ nome: "", telefono: "", email: "", note: "" });
    setSelectedClient(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" 
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
      >
        <div className="flex items-center justify-between p-6 border-b" 
          style={{ borderColor: colors.border.primary }}
        >
          <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            Seleziona Cliente per Debito
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        <div className="p-6">
          {!showNewClientForm ? (
            <>
              {/* Search Bar with Autocomplete */}
              <div className="mb-4 relative">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                    style={{ color: colors.text.secondary }}
                  />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => handleClientSearchChange(e.target.value)}
                    onFocus={() => {
                      if (clientSearch.length === 0 && recentClienti.length > 0) {
                        setSuggestions(recentClienti);
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Cerca o seleziona cliente..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>
                
                {/* Autocomplete Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div 
                    className="absolute z-10 w-full mt-1 rounded-lg shadow-lg border overflow-hidden"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.primary
                    }}
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {clientSearch.length === 0 && (
                        <div className="px-3 py-1 text-xs font-medium" 
                          style={{ 
                            backgroundColor: colors.bg.hover,
                            color: colors.text.secondary 
                          }}
                        >
                          Clienti recenti
                        </div>
                      )}
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="px-3 py-2 cursor-pointer hover:bg-opacity-10 transition-colors flex items-center gap-2"
                          style={{
                            backgroundColor: 'transparent',
                            color: colors.text.primary
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.bg.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <User className="h-3 w-3" style={{ color: colors.text.secondary }} />
                          <span>{suggestion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Clients List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.text.muted }} />
                  </div>
                ) : allClients.length === 0 ? (
                  <div className="text-center py-8" style={{ color: colors.text.secondary }}>
                    Nessun cliente trovato
                  </div>
                ) : (
                  allClients.map((cliente) => (
                    <div
                      key={cliente.id}
                      onClick={() => setSelectedClient(cliente)}
                      className="p-4 rounded-lg cursor-pointer transition-all duration-200"
                      style={{ 
                        backgroundColor: selectedClient?.id === cliente.id ? colors.bg.hover : colors.bg.darker,
                        borderColor: selectedClient?.id === cliente.id ? colors.border.primary : colors.border.secondary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium" style={{ color: colors.text.primary }}>
                            {cliente.nome}
                          </div>
                          {cliente.telefono && (
                            <div className="text-sm" style={{ color: colors.text.secondary }}>
                              {cliente.telefono}
                            </div>
                          )}
                          {cliente.email && (
                            <div className="text-sm" style={{ color: colors.text.secondary }}>
                              {cliente.email}
                            </div>
                          )}
                        </div>
                        {cliente.totaleDebiti > 0 && (
                          <div className="text-sm" style={{ color: colors.text.error }}>
                            Debiti: €{cliente.totaleDebiti.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Prepopola il nome se c'è del testo nella ricerca
                    if (clientSearch.trim()) {
                      setNewClientData({ ...newClientData, nome: clientSearch.trim() });
                    }
                    setShowNewClientForm(true);
                  }}
                  className="flex-1 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: colors.button.secondary || colors.button.outlineBg,
                    color: colors.button.secondaryText || colors.button.outlineText,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Nuovo Cliente
                </button>
                <button
                  onClick={() => {
                    if (selectedClient) {
                      onSelectClient(selectedClient);
                      handleClose();
                    }
                  }}
                  disabled={!selectedClient}
                  className="flex-1 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                >
                  Conferma Selezione
                </button>
              </div>
            </>
          ) : (
            <>
              {/* New Client Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" 
                    style={{ color: colors.text.secondary }}
                  >
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={newClientData.nome}
                    onChange={(e) => setNewClientData({ ...newClientData, nome: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" 
                    style={{ color: colors.text.secondary }}
                  >
                    Telefono
                  </label>
                  <input
                    type="text"
                    value={newClientData.telefono}
                    onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" 
                    style={{ color: colors.text.secondary }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" 
                    style={{ color: colors.text.secondary }}
                  >
                    Note
                  </label>
                  <textarea
                    value={newClientData.note}
                    onChange={(e) => setNewClientData({ ...newClientData, note: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowNewClientForm(false);
                      setNewClientData({ nome: "", telefono: "", email: "", note: "" });
                    }}
                    className="flex-1 py-2 rounded-lg transition-colors duration-200"
                    style={{ 
                      backgroundColor: colors.button.secondary || colors.button.outlineBg,
                      color: colors.button.secondaryText || colors.button.outlineText,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleCreateClient}
                    disabled={!newClientData.nome.trim()}
                    className="flex-1 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      backgroundColor: colors.button.primary,
                      color: colors.button.primaryText
                    }}
                  >
                    Crea Cliente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}