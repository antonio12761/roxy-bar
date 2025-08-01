"use client";

import { useState, useEffect } from "react";
import { X, ChefHat, Package, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemedModal } from "@/components/ui/ThemedModal";

interface ProcedureStep {
  id: string;
  description: string;
  order: number;
  ProcedureIngredient: ProcedureIngredient[];
}

interface ProcedureIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface ProductProcedure {
  id: string;
  productId: number;
  ProcedureStep: ProcedureStep[];
}

interface ProcedureViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: number | null;
  quantity: number;
}

export function ProcedureViewModal({ 
  isOpen, 
  onClose, 
  productName,
  productId,
  quantity = 1
}: ProcedureViewModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [procedure, setProcedure] = useState<ProductProcedure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      loadProcedure();
    }
  }, [isOpen, productId]);

  const loadProcedure = async () => {
    if (!productId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/products/procedures?productId=${productId}`);
      
      if (!response.ok) {
        throw new Error("Errore nel caricamento della procedura");
      }
      
      const data = await response.json();
      setProcedure(data);
    } catch (error) {
      console.error("Errore:", error);
      setError("Impossibile caricare la procedura");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateIngredientQuantity = (baseQuantity: number): string => {
    const adjustedQuantity = baseQuantity * quantity;
    
    // Format the number to avoid floating point issues
    if (adjustedQuantity % 1 === 0) {
      return adjustedQuantity.toString();
    } else {
      return adjustedQuantity.toFixed(2).replace(/\.?0+$/, '');
    }
  };

  const renderStepDescription = (step: ProcedureStep) => {
    let description = step.description || "";
    
    // If description is empty, return empty
    if (!description.trim()) {
      return "";
    }
    
    // Handle both new format (parentheses) and old format (ingredient list)
    // First, check if description contains parentheses format
    const hasParenthesesFormat = /\([^)]+\)(?:\s*\d+(?:\.\d+)?(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?/g.test(description);
    
    if (hasParenthesesFormat) {
      // New format: replace parentheses with badges
      const parts = description.split(/(\([^)]+\)(?:\s*\d+(?:\.\d+)?(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?)/g);
      const elements = [];
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Skip if part is undefined or empty
        if (!part) continue;
        
        // Check if this part matches the ingredient pattern
        const ingredientMatch = part.match(/\(([^)]+)\)(?:\s*(\d+(?:\.\d+)?)(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?/);
        
        if (ingredientMatch) {
          // This is an ingredient - render as badge
          const ingredientName = ingredientMatch[1];
          const rawQuantity = ingredientMatch[2];
          const unit = ingredientMatch[3];
          
          let displayText = ingredientName;
          if (rawQuantity && unit) {
            // Always show single recipe quantities, not multiplied
            const singleQuantity = parseFloat(rawQuantity);
            displayText = `${ingredientName} ${singleQuantity}${unit}`;
          }
          
          elements.push(
            <span 
              key={`ingredient_${i}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mx-1 shadow-sm"
              style={{ 
                backgroundColor: colors.accent + '30',
                color: colors.accent,
                borderColor: colors.accent + '60',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              {displayText}
            </span>
          );
        } else if (part) {
          // Regular text
          elements.push(part);
        }
      }
      
      return elements.length > 0 ? elements : description;
    } else {
      // Old format: use ingredient list
      const ingredients = step.ProcedureIngredient || [];
      ingredients.forEach((ingredient) => {
        const ingredientText = `${ingredient.name} ${calculateIngredientQuantity(ingredient.quantity)}${ingredient.unit}`;
        
        // Find ingredient name in description and replace with badge (case insensitive)
        const regex = new RegExp(`\\b${ingredient.name}\\b`, 'gi');
        if (regex.test(description)) {
          description = description.replace(regex, `___BADGE_${ingredient.id}___`);
        }
      });

      // Convert string back to JSX with badges
      const parts = description.split(/___BADGE_(\w+)___/);
      const elements = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // Regular text
          if (parts[i]) {
            elements.push(parts[i]);
          }
        } else {
          // Badge placeholder - find corresponding ingredient
          const ingredientId = parts[i];
          if (!ingredientId) continue;
          
          const ingredient = ingredients.find(ing => ing && ing.id === ingredientId);
          if (ingredient) {
            const ingredientText = `${ingredient.name} ${ingredient.quantity}${ingredient.unit}`;
            elements.push(
              <span 
                key={ingredient.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mx-1 shadow-sm"
                style={{ 
                  backgroundColor: colors.accent + '30',
                  color: colors.accent,
                  borderColor: colors.accent + '60',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {ingredientText}
              </span>
            );
          }
        }
      }
      
      return elements.length > 0 ? elements : description;
    }
  };

  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={onClose}
      size="xl"
      title={`Procedura: ${productName} (${quantity > 1 ? `${quantity} porzioni` : '1 porzione'})`}
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {/* Skeleton for procedure steps */}
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="p-6 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '2px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-8 h-8 rounded-full animate-pulse"
                    style={{ backgroundColor: colors.bg.hover }}
                  ></div>
                  <div className="flex-1 space-y-2">
                    <div 
                      className="h-4 rounded animate-pulse"
                      style={{ backgroundColor: colors.bg.hover, width: '80%' }}
                    ></div>
                    <div 
                      className="h-4 rounded animate-pulse"
                      style={{ backgroundColor: colors.bg.hover, width: '60%' }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Skeleton for ingredients summary */}
            <div 
              className="mt-8 p-6 rounded-lg"
              style={{ 
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <div 
                className="h-5 w-48 rounded animate-pulse mb-4"
                style={{ backgroundColor: colors.bg.hover }}
              ></div>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="h-8 rounded-full animate-pulse"
                    style={{ 
                      backgroundColor: colors.bg.hover,
                      width: `${60 + (i * 20)}px`
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p style={{ color: colors.text.error }}>{error}</p>
          </div>
        )}

        {!isLoading && !error && !procedure && (
          <div className="text-center py-8">
            <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
            <p style={{ color: colors.text.secondary }}>
              Nessuna procedura disponibile per questo prodotto
            </p>
          </div>
        )}

        {!isLoading && !error && procedure && (
          <div className="space-y-4">
            {procedure.ProcedureStep.map((step, index) => (
              <div 
                key={step.id}
                className="p-6 rounded-lg transition-all hover:shadow-md"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '2px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm"
                    style={{ 
                      backgroundColor: colors.accent,
                      color: 'white'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-base leading-relaxed" style={{ color: colors.text.primary }}>
                      {renderStepDescription(step)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary of all ingredients */}
            {procedure.ProcedureStep.some(step => (step.ProcedureIngredient && step.ProcedureIngredient.length > 0) || /\([^)]+\)/.test(step.description || "")) && (
              <div 
                className="mt-8 p-6 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.accent,
                  borderWidth: '2px',
                  borderStyle: 'solid'
                }}
              >
                <h4 className="font-semibold text-base mb-4 flex items-center gap-2" style={{ color: colors.text.primary }}>
                  <Package className="h-4 w-4" style={{ color: colors.accent }} />
                  Riepilogo ingredienti totali:
                </h4>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    // Aggregate ingredients across all steps
                    const ingredientMap = new Map<string, { quantity: number; unit: string }>();
                    
                    procedure.ProcedureStep.forEach(step => {
                      if (!step) return;
                      
                      const stepDescription = step.description || "";
                      
                      // Extract ingredients from description if using new format
                      const hasParenthesesFormat = /\([^)]+\)(?:\s*\d+(?:\.\d+)?(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?/g.test(stepDescription);
                      
                      if (hasParenthesesFormat) {
                        // Parse ingredients from parentheses format
                        const matches = stepDescription.matchAll(/\(([^)]+)\)(?:\s*(\d+(?:\.\d+)?)(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?/g);
                        
                        for (const match of matches) {
                          const name = match[1].trim();
                          const rawQuantity = parseFloat(match[2]) || 0;
                          const unit = match[3] || 'pz';
                          
                          const key = `${name}_${unit}`;
                          const existing = ingredientMap.get(key);
                          
                          // Use single recipe quantities, not multiplied
                          const singleQuantity = rawQuantity;
                          
                          if (existing) {
                            existing.quantity += singleQuantity;
                          } else {
                            ingredientMap.set(key, { quantity: singleQuantity, unit });
                          }
                        }
                      } else {
                        // Use old format with ProcedureIngredient list
                        const ingredients = step.ProcedureIngredient || [];
                        ingredients.forEach(ing => {
                          const key = `${ing.name}_${ing.unit}`;
                          const existing = ingredientMap.get(key);
                          const singleQuantity = ing.quantity;
                          
                          if (existing) {
                            existing.quantity += singleQuantity;
                          } else {
                            ingredientMap.set(key, { quantity: singleQuantity, unit: ing.unit });
                          }
                        });
                      }
                    });
                    
                    return Array.from(ingredientMap.entries()).map(([key, data]) => {
                      const name = key.split('_')[0];
                      return (
                        <span 
                          key={key}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shadow-sm"
                          style={{ 
                            backgroundColor: colors.accent + '30',
                            color: colors.accent,
                            borderColor: colors.accent + '60',
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                        >
                          {name} {data.quantity}{data.unit}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg transition-colors font-medium"
            style={{ 
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            Chiudi
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}