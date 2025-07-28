"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { NotificationPriority } from "@/lib/types/notifications";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface NotificationPreferences {
  enabledTypes: Set<string>;
  audioEnabled: boolean;
  audioVolume: number;
  retentionCount: number;
  priorityFilter: NotificationPriority[];
}

interface NotificationPreferencesContextType {
  preferences: NotificationPreferences;
  updatePreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => void;
  toggleNotificationType: (type: string) => void;
  resetToDefaults: () => void;
}

const defaultPreferences: NotificationPreferences = {
  enabledTypes: new Set(notificationManager.getAvailableTypes()),
  audioEnabled: true,
  audioVolume: 0.5,
  retentionCount: 50,
  priorityFilter: [
    NotificationPriority.LOW,
    NotificationPriority.NORMAL,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT
  ]
};

const NotificationPreferencesContext = createContext<NotificationPreferencesContextType | undefined>(undefined);

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem("notificationPreferences");
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        setPreferences({
          ...defaultPreferences,
          ...parsed,
          enabledTypes: new Set(parsed.enabledTypes || [])
        });
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      }
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    const toSave = {
      ...preferences,
      enabledTypes: Array.from(preferences.enabledTypes)
    };
    localStorage.setItem("notificationPreferences", JSON.stringify(toSave));
  }, [preferences]);

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleNotificationType = (type: string) => {
    setPreferences(prev => {
      const newEnabledTypes = new Set(prev.enabledTypes);
      if (newEnabledTypes.has(type)) {
        newEnabledTypes.delete(type);
      } else {
        newEnabledTypes.add(type);
      }
      return {
        ...prev,
        enabledTypes: newEnabledTypes
      };
    });
  };

  const resetToDefaults = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <NotificationPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        toggleNotificationType,
        resetToDefaults
      }}
    >
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  const context = useContext(NotificationPreferencesContext);
  if (!context) {
    throw new Error(
      "useNotificationPreferences must be used within a NotificationPreferencesProvider"
    );
  }
  return context;
}