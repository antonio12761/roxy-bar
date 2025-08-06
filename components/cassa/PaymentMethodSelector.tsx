import React from 'react';
import { CreditCard, Euro, Receipt } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";

interface PaymentMethodSelectorProps {
  value: 'POS' | 'CONTANTI' | 'MISTO';
  onChange: (method: 'POS' | 'CONTANTI' | 'MISTO') => void;
}

export default function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const methods = [
    { value: 'POS' as const, icon: CreditCard },
    { value: 'CONTANTI' as const, icon: Euro },
    { value: 'MISTO' as const, icon: Receipt }
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: colors.text.primary }}>
        Metodo di pagamento
      </label>
      <div className="grid grid-cols-3 gap-2">
        {methods.map(({ value: method, icon: Icon }) => (
          <button
            key={method}
            onClick={() => onChange(method)}
            className="py-2 px-3 rounded-lg transition-all duration-200"
            style={{ 
              backgroundColor: value === method ? colors.button.primary : 'transparent',
              color: value === method ? colors.button.primaryText : colors.text.primary,
              borderColor: value === method ? colors.button.primary : colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <Icon className="h-4 w-4 mx-auto mb-1" />
            <span className="text-sm">{method}</span>
          </button>
        ))}
      </div>
    </div>
  );
}