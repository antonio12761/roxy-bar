"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

interface NumericKeypadProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  currentValue: number;
  title?: string;
}

export function NumericKeypad({ isOpen, onClose, onConfirm, currentValue, title = "Inserisci quantità" }: NumericKeypadProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [value, setValue] = useState(currentValue.toString());

  const handleNumber = (num: string) => {
    if (value === "0") {
      setValue(num);
    } else {
      setValue(value + num);
    }
  };

  const handleClear = () => {
    setValue("0");
  };

  const handleBackspace = () => {
    if (value.length > 1) {
      setValue(value.slice(0, -1));
    } else {
      setValue("0");
    }
  };

  const handleConfirm = () => {
    const numValue = parseInt(value) || 0;
    if (numValue > 0) {
      onConfirm(numValue);
      onClose();
    }
  };

  const buttons = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '←']
  ];

  return (
    <ThemedModal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {/* Display */}
        <div 
          className="text-center text-3xl font-bold p-4 rounded-lg"
          style={{
            backgroundColor: colors.bg.input,
            color: colors.text.primary,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          {value}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {buttons.map((row, rowIndex) => (
            row.map((btn, btnIndex) => (
              <button
                key={`${rowIndex}-${btnIndex}`}
                onClick={() => {
                  if (btn === 'C') handleClear();
                  else if (btn === '←') handleBackspace();
                  else handleNumber(btn);
                }}
                className="p-4 text-xl font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.bg.card,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }}
              >
                {btn}
              </button>
            ))
          ))}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          className="w-full p-3 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.button.primaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.button.primary;
          }}
        >
          Conferma
        </button>
      </div>
    </ThemedModal>
  );
}