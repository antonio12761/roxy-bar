"use client";

import { useState, useEffect } from "react";
import { X, Save, User, Phone, Mail, MapPin, Calendar, Tag, FileText } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { createCliente, updateCliente, type ClienteInput } from "@/lib/actions/clienti";
import { toast } from "sonner";

interface ClienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  cliente?: any; // Cliente esistente per modifica
}

const TAGS_PREDEFINITI = [
  "VIP",
  "Frequente",
  "Nuovo",
  "Business",
  "Famiglia",
  "Gruppo",
  "Compleanno",
  "Evento"
];

export default function ClienteFormModal({
  isOpen,
  onClose,
  onSuccess,
  cliente
}: ClienteFormModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ClienteInput>({
    nome: "",
    cognome: "",
    telefono: "",
    email: "",
    codiceFiscale: "",
    partitaIva: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    dataNascita: "",
    tags: [],
    note: "",
    attivo: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || "",
        cognome: cliente.cognome || "",
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        codiceFiscale: cliente.codiceFiscale || "",
        partitaIva: cliente.partitaIva || "",
        indirizzo: cliente.indirizzo || "",
        citta: cliente.citta || "",
        cap: cliente.cap || "",
        provincia: cliente.provincia || "",
        dataNascita: cliente.dataNascita 
          ? new Date(cliente.dataNascita).toISOString().split('T')[0]
          : "",
        tags: cliente.tags || [],
        note: cliente.note || "",
        attivo: cliente.attivo !== undefined ? cliente.attivo : true
      });
    } else {
      // Reset form per nuovo cliente
      setFormData({
        nome: "",
        cognome: "",
        telefono: "",
        email: "",
        codiceFiscale: "",
        partitaIva: "",
        indirizzo: "",
        citta: "",
        cap: "",
        provincia: "",
        dataNascita: "",
        tags: [],
        note: "",
        attivo: true
      });
    }
    setErrors({});
  }, [cliente]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Il nome è obbligatorio";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email non valida";
    }

    if (formData.cap && !/^\d{5}$/.test(formData.cap)) {
      newErrors.cap = "CAP deve essere di 5 cifre";
    }

    if (formData.codiceFiscale && formData.codiceFiscale.length !== 16) {
      newErrors.codiceFiscale = "Codice fiscale deve essere di 16 caratteri";
    }

    if (formData.partitaIva && !/^\d{11}$/.test(formData.partitaIva)) {
      newErrors.partitaIva = "Partita IVA deve essere di 11 cifre";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = cliente 
        ? await updateCliente(cliente.id, formData)
        : await createCliente(formData);

      if (result.success) {
        toast.success(cliente ? "Cliente aggiornato con successo" : "Cliente creato con successo");
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || "Errore nel salvataggio");
      }
    } catch (error) {
      toast.error("Errore nel salvataggio del cliente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...(prev.tags || []), tag]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        style={{ backgroundColor: colors.bg.card }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 flex items-center justify-between p-6 border-b"
          style={{ 
            borderColor: colors.border.primary,
            backgroundColor: colors.bg.card 
          }}
        >
          <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            {cliente ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:opacity-80 transition-opacity"
            style={{ backgroundColor: colors.bg.hover }}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dati Anagrafici */}
          <div>
            <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.secondary }}>
              Dati Anagrafici
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Nome *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: errors.nome ? colors.text.error : colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="Nome"
                  />
                </div>
                {errors.nome && (
                  <p className="mt-1 text-xs" style={{ color: colors.text.error }}>{errors.nome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Cognome
                </label>
                <input
                  type="text"
                  value={formData.cognome || ""}
                  onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: colors.border.primary,
                    color: colors.text.primary
                  }}
                  placeholder="Cognome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Data di Nascita
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
                  <input
                    type="date"
                    value={formData.dataNascita || ""}
                    onChange={(e) => setFormData({ ...formData, dataNascita: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div>
            <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.secondary }}>
              Contatti
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Telefono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
                  <input
                    type="tel"
                    value={formData.telefono || ""}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="+39 123 456 7890"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: errors.email ? colors.text.error : colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="email@esempio.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs" style={{ color: colors.text.error }}>{errors.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Indirizzo */}
          <div>
            <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.secondary }}>
              Indirizzo
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Indirizzo
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
                  <input
                    type="text"
                    value={formData.indirizzo || ""}
                    onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="Via/Piazza..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.citta || ""}
                    onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="Città"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                    CAP
                  </label>
                  <input
                    type="text"
                    value={formData.cap || ""}
                    onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                    maxLength={5}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: errors.cap ? colors.text.error : colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="00000"
                  />
                  {errors.cap && (
                    <p className="mt-1 text-xs" style={{ color: colors.text.error }}>{errors.cap}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.provincia || ""}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value.toUpperCase() })}
                    maxLength={2}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                    placeholder="XX"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dati Fiscali */}
          <div>
            <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.secondary }}>
              Dati Fiscali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  value={formData.codiceFiscale || ""}
                  onChange={(e) => setFormData({ ...formData, codiceFiscale: e.target.value.toUpperCase() })}
                  maxLength={16}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: errors.codiceFiscale ? colors.text.error : colors.border.primary,
                    color: colors.text.primary
                  }}
                  placeholder="RSSMRA85M01H501Z"
                />
                {errors.codiceFiscale && (
                  <p className="mt-1 text-xs" style={{ color: colors.text.error }}>{errors.codiceFiscale}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={formData.partitaIva || ""}
                  onChange={(e) => setFormData({ ...formData, partitaIva: e.target.value })}
                  maxLength={11}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: errors.partitaIva ? colors.text.error : colors.border.primary,
                    color: colors.text.primary
                  }}
                  placeholder="12345678901"
                />
                {errors.partitaIva && (
                  <p className="mt-1 text-xs" style={{ color: colors.text.error }}>{errors.partitaIva}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.secondary }}>
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {TAGS_PREDEFINITI.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.tags?.includes(tag) ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: formData.tags?.includes(tag) ? colors.button.primary : colors.bg.hover,
                    color: formData.tags?.includes(tag) ? colors.button.primaryText : colors.text.secondary,
                    outlineColor: formData.tags?.includes(tag) ? colors.button.primary : undefined
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
              Note
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4" style={{ color: colors.text.muted }} />
              <textarea
                value={formData.note || ""}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
                className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          {/* Stato */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="attivo"
              checked={formData.attivo}
              onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="attivo" className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Cliente attivo
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: colors.border.primary }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.secondary
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-2"
              style={{
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText
              }}
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Salvataggio...' : (cliente ? 'Aggiorna' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}