import React from 'react';
import { CreditCard, Euro, Smartphone, Building2, Coins, Receipt, Banknote, Wallet } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";

export type PaymentMethod = 'CONTANTI' | 'POS' | 'BANCOMAT' | 'SATISPAY' | 'MISTO';

interface PaymentMethodGridProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  showQuickAmount?: boolean;
  amount?: number;
}

const paymentMethods = [
  { 
    value: 'CONTANTI' as const, 
    label: 'Contanti',
    icon: Euro,
    color: '#22c55e', // green-500
    bgColor: '#22c55e20',
    description: 'Pagamento in contanti'
  },
  { 
    value: 'POS' as const,
    label: 'POS/Carta',
    icon: CreditCard,
    color: '#3b82f6', // blue-500
    bgColor: '#3b82f620',
    description: 'Carta di credito/debito'
  },
  { 
    value: 'BANCOMAT' as const,
    label: 'Bancomat',
    icon: Building2,
    color: '#06b6d4', // cyan-500
    bgColor: '#06b6d420',
    description: 'Carta Bancomat'
  },
  { 
    value: 'SATISPAY' as const,
    label: 'Satispay',
    icon: Smartphone,
    color: '#f97316', // orange-500
    bgColor: '#f9731620',
    description: 'Pagamento mobile'
  },
  { 
    value: 'MISTO' as const,
    label: 'Misto',
    icon: Coins,
    color: '#a855f7', // purple-500
    bgColor: '#a855f720',
    description: 'Contanti + Carta'
  }
];

export default function PaymentMethodGrid({ 
  value, 
  onChange, 
  disabled = false,
  showQuickAmount = false,
  amount = 0
}: PaymentMethodGridProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: colors.text.primary }}>
          Seleziona metodo di pagamento
        </label>
        {showQuickAmount && amount > 0 && (
          <span className="text-lg font-bold" style={{ color: colors.accent }}>
            €{amount.toFixed(2)}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {paymentMethods.map(({ value: method, label, icon: Icon, color, bgColor, description }) => {
          const isSelected = value === method;
          
          return (
            <button
              key={method}
              onClick={() => onChange(method)}
              disabled={disabled}
              className="relative group p-4 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: isSelected ? bgColor : colors.bg.card,
                borderColor: isSelected ? color : colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: isSelected ? `0 0 20px ${color}30` : 'none'
              }}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div 
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              
              <div className="flex flex-col items-center gap-2">
                <div 
                  className="p-3 rounded-lg transition-colors"
                  style={{ 
                    backgroundColor: isSelected ? color + '20' : colors.bg.darker,
                    color: isSelected ? color : colors.text.secondary
                  }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                
                <div className="text-center">
                  <div 
                    className="font-semibold text-sm"
                    style={{ color: isSelected ? color : colors.text.primary }}
                  >
                    {label}
                  </div>
                  <div 
                    className="text-xs opacity-75 mt-0.5"
                    style={{ color: colors.text.muted }}
                  >
                    {description}
                  </div>
                </div>
              </div>
              
              {/* Hover effect */}
              {!disabled && !isSelected && (
                <div 
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ 
                    backgroundColor: color + '10',
                    borderColor: color,
                    borderWidth: '2px',
                    borderStyle: 'solid'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Quick tips based on selection */}
      {value && (
        <div 
          className="p-3 rounded-lg text-sm flex items-start gap-2"
          style={{ 
            backgroundColor: paymentMethods.find(m => m.value === value)?.bgColor || colors.bg.darker,
            color: paymentMethods.find(m => m.value === value)?.color || colors.text.secondary
          }}
        >
          <Receipt className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {value === 'CONTANTI' && 'Ricevi i contanti dal cliente e consegna il resto se necessario'}
            {value === 'POS' && 'Il cliente inserisce la carta nel POS e digita il PIN'}
            {value === 'BANCOMAT' && 'Il cliente usa la carta Bancomat per il pagamento'}
            {value === 'SATISPAY' && 'Il cliente scansiona il QR code o riceve la notifica su Satispay'}
            {value === 'MISTO' && 'Dividi il pagamento tra contanti e carta secondo le preferenze del cliente'}
          </div>
        </div>
      )}
    </div>
  );
}