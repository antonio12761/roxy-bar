"use client";

import React from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

interface CameriereModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CameriereModal({ isOpen, onClose }: CameriereModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        className={`relative flex flex-col rounded-lg shadow-2xl transition-all duration-300 ${
          isExpanded ? 'w-[90vw] h-[90vh]' : ''
        }`}
        style={{ 
          width: isExpanded ? undefined : '375px',
          height: isExpanded ? undefined : '812px',
          maxHeight: '90vh',
          backgroundColor: colors.bg.card,
          border: `1px solid ${colors.border.primary}`
        }}
      >
        {/* Control Buttons */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-black/20 backdrop-blur hover:bg-black/30"
            style={{
              color: colors.text.primary,
            }}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={onClose}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-black/20 backdrop-blur hover:bg-black/30"
            style={{
              color: colors.text.primary,
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Iframe */}
        <iframe
          src="/cameriere/nuova-ordinazione"
          className="w-full h-full rounded-lg border-0"
          title="Cameriere - Nuova Ordinazione"
        />
      </div>
    </div>
  );
}