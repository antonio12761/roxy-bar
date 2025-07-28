"use client";

import React from "react";
import { Bell, BellOff, Volume2, VolumeX, RotateCcw, Save } from "lucide-react";
import { useNotificationPreferences } from "@/lib/contexts/NotificationPreferencesContext";
import { NotificationPriority } from "@/lib/types/notifications";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export default function NotificationSettings() {
  const {
    preferences,
    updatePreference,
    toggleNotificationType,
    resetToDefaults
  } = useNotificationPreferences();

  const notificationTypeLabels: Record<string, string> = {
    "order_created": "Nuovi ordini",
    "order_updated": "Aggiornamenti ordini",
    "order_ready": "Ordini pronti",
    "order_delivered": "Ordini consegnati",
    "order_paid": "Pagamenti completati",
    "item_in_progress": "Elementi in lavorazione",
    "item_ready": "Elementi pronti",
    "item_delivered": "Elementi consegnati",
    "payment_requested": "Richieste di pagamento",
    "payment_completed": "Pagamenti completati",
    "duplicate_order_warning": "Avvisi ordini duplicati",
    "order_conflict": "Conflitti ordini"
  };

  const priorityLabels: Record<NotificationPriority, string> = {
    [NotificationPriority.LOW]: "Bassa",
    [NotificationPriority.NORMAL]: "Normale",
    [NotificationPriority.HIGH]: "Alta",
    [NotificationPriority.URGENT]: "Urgente"
  };

  const priorityColors: Record<NotificationPriority, string> = {
    [NotificationPriority.LOW]: "bg-gray-100 text-gray-700",
    [NotificationPriority.NORMAL]: "bg-blue-100 text-blue-700",
    [NotificationPriority.HIGH]: "bg-orange-100 text-orange-700",
    [NotificationPriority.URGENT]: "bg-red-100 text-red-700"
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Impostazioni Notifiche
          </h2>
          <p className="text-gray-600 mt-1">
            Personalizza come ricevi le notifiche nell'applicazione
          </p>
        </div>

        {/* Audio Settings */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-4">Audio</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preferences.audioEnabled ? (
                  <Volume2 className="h-5 w-5 text-gray-700" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <label htmlFor="audio-enabled" className="font-medium">
                    Abilita suoni
                  </label>
                  <p className="text-sm text-gray-600">
                    Riproduci suoni per le notifiche
                  </p>
                </div>
              </div>
              <input
                id="audio-enabled"
                type="checkbox"
                checked={preferences.audioEnabled}
                onChange={(e) => updatePreference("audioEnabled", e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            {preferences.audioEnabled && (
              <div className="ml-8">
                <label htmlFor="audio-volume" className="block text-sm font-medium mb-2">
                  Volume: {Math.round(preferences.audioVolume * 100)}%
                </label>
                <input
                  id="audio-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={preferences.audioVolume}
                  onChange={(e) => updatePreference("audioVolume", parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Priority Filter */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-4">Filtra per Priorità</h3>
          <p className="text-sm text-gray-600 mb-4">
            Mostra solo notifiche con queste priorità
          </p>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(priorityLabels).map(([priority, label]) => {
              const isSelected = preferences.priorityFilter.includes(priority as NotificationPriority);
              return (
                <button
                  key={priority}
                  onClick={() => {
                    const newFilter = isSelected
                      ? preferences.priorityFilter.filter(p => p !== priority)
                      : [...preferences.priorityFilter, priority as NotificationPriority];
                    updatePreference("priorityFilter", newFilter);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? priorityColors[priority as NotificationPriority]
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification Types */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-4">Tipi di Notifica</h3>
          <p className="text-sm text-gray-600 mb-4">
            Scegli quali tipi di notifiche ricevere
          </p>
          
          <div className="space-y-3">
            {notificationManager.getAvailableTypes().map(type => (
              <label
                key={type}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
              >
                <input
                  type="checkbox"
                  checked={preferences.enabledTypes.has(type)}
                  onChange={() => toggleNotificationType(type)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="font-medium">
                    {notificationTypeLabels[type] || type.replace(/_/g, " ")}
                  </span>
                  {notificationManager.getConfig(type) && (
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                      priorityColors[notificationManager.getConfig(type)!.priority]
                    }`}>
                      {priorityLabels[notificationManager.getConfig(type)!.priority]}
                    </span>
                  )}
                </div>
                {preferences.enabledTypes.has(type) ? (
                  <Bell className="h-4 w-4 text-green-600" />
                ) : (
                  <BellOff className="h-4 w-4 text-gray-400" />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Retention Settings */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-4">Storico Notifiche</h3>
          
          <div>
            <label htmlFor="retention-count" className="block text-sm font-medium mb-2">
              Numero massimo di notifiche da conservare
            </label>
            <input
              id="retention-count"
              type="number"
              min="10"
              max="200"
              step="10"
              value={preferences.retentionCount}
              onChange={(e) => updatePreference("retentionCount", parseInt(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-white/15-500"
            />
            <p className="text-sm text-gray-600 mt-1">
              Le notifiche più vecchie verranno automaticamente rimosse
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 flex justify-between">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Ripristina predefinite
          </button>
          
          <button
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            <Save className="h-4 w-4" />
            Salva modifiche
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-white/15-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Informazioni</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Le notifiche urgenti verranno sempre mostrate indipendentemente dai filtri</li>
          <li>• Le impostazioni sono salvate localmente nel tuo browser</li>
          <li>• I suoni di notifica richiedono l'interazione dell'utente per essere riprodotti</li>
          <li>• Le notifiche con acknowledgment richiesto devono essere confermate manualmente</li>
        </ul>
      </div>
    </div>
  );
}