"use client";

import React from "react";
import { Wine, Coffee, Beer, Martini } from "lucide-react";

interface Glass {
  id: string;
  name: string;
  icon: React.ElementType;
}

const availableGlasses: Glass[] = [
  { id: "wine", name: "Calice vino", icon: Wine },
  { id: "beer", name: "Boccale birra", icon: Beer },
  { id: "martini", name: "Coppa Martini", icon: Martini },
  { id: "coffee", name: "Tazzina caffè", icon: Coffee },
  { id: "tumbler", name: "Tumbler", icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <path d="M5 12V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v5m0 0v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5m14 0H5" />
    </svg>
  )},
  { id: "highball", name: "Highball", icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <path d="M6 6h12v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6z" />
      <path d="M6 6V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2" />
    </svg>
  )},
  { id: "shot", name: "Shot", icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <path d="M8 6h8v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6z" />
    </svg>
  )},
  { id: "flute", name: "Flûte", icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <path d="M12 2v10m0 0l-2 6h4l-2-6zm-2 6a2 2 0 1 0 4 0M10 20h4" />
    </svg>
  )}
];

interface GlassSelectorProps {
  selectedGlasses: string[];
  onGlassToggle: (glassId: string) => void;
  colors: any;
}

export function GlassSelector({ selectedGlasses, onGlassToggle, colors }: GlassSelectorProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
      {availableGlasses.map((glass) => {
        const isSelected = selectedGlasses.includes(glass.id);
        const Icon = glass.icon;
        
        return (
          <button
            key={glass.id}
            onClick={() => onGlassToggle(glass.id)}
            className="p-3 rounded-lg border-2 transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: isSelected ? colors.accent + '20' : colors.bg.input,
              borderColor: isSelected ? colors.accent : colors.border.primary,
              color: isSelected ? colors.accent : colors.text.secondary
            }}
            title={glass.name}
          >
            <div className="w-6 h-6 mx-auto">
              <Icon />
            </div>
            <span className="text-xs mt-1 block truncate">{glass.name}</span>
          </button>
        );
      })}
    </div>
  );
}