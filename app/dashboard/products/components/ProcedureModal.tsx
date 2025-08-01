"use client";

import { useState, useEffect } from "react";
import { X, Plus, Save, Trash2, Loader2, Wine } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { GlassSelector } from "@/components/ui/GlassSelector";

interface ProcedureStep {
  id: string;
  description: string;
  order: number;
  ingredients: ProcedureIngredient[];
}

interface ProcedureIngredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface ProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: number | null;
  productName?: string;
  product?: any;
  categories?: any[];
  onSuccess?: () => void;
}

interface IngredientSelectorProps {
  onSelectIngredient: (name: string, quantity?: string, unit?: string) => void;
  onClose: () => void;
  colors: any;
}

// Common ingredients for quick selection
const COMMON_INGREDIENTS = [
  "Campari Bitter",
  "Prosecco",
  "Aperol",
  "Gin",
  "Vodka",
  "Rum",
  "Whisky",
  "Limone",
  "Arancia",
  "Lime",
  "Acqua tonica",
  "Soda",
  "Ghiaccio",
  "Zucchero",
  "Sale",
  "Pepe"
];

function IngredientSelector({ onSelectIngredient, onClose, colors }: IngredientSelectorProps) {
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("ml");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredIngredients = COMMON_INGREDIENTS.filter(ingredient =>
    ingredient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (ingredientName: string) => {
    onSelectIngredient(ingredientName, quantity || undefined, unit);
  };

  const handleCustomAdd = () => {
    if (customName.trim()) {
      onSelectIngredient(customName.trim(), quantity || undefined, unit);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Cerca ingrediente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 rounded-lg"
        style={{ 
          backgroundColor: colors.bg.input,
          color: colors.text.primary,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      />

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
            Quantità - opzionale
          </label>
          <input
            type="number"
            placeholder="es. 33"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.input,
              color: colors.text.primary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
            Unità
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.input,
              color: colors.text.primary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <option value="ml">ml</option>
            <option value="cl">cl</option>
            <option value="l">l</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="pz">pz</option>
            <option value="cucchiai">cucchiai</option>
            <option value="cucchiaini">cucchiaini</option>
            <option value="spicchi">spicchi</option>
            <option value="fette">fette</option>
          </select>
        </div>
      </div>

      {/* Common ingredients */}
      <div>
        <h5 className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
          Ingredienti comuni:
        </h5>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {filteredIngredients.map((ingredient) => (
            <button
              key={ingredient}
              onClick={() => handleSelect(ingredient)}
              className="text-left p-2 rounded transition-colors text-sm"
              style={{ 
                backgroundColor: colors.bg.input,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.input}
            >
              {ingredient}
            </button>
          ))}
        </div>
      </div>

      {/* Custom ingredient */}
      <div>
        <h5 className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
          Ingrediente personalizzato:
        </h5>
        <input
          type="text"
          placeholder="Nome ingrediente"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg mb-2"
          style={{ 
            backgroundColor: colors.bg.input,
            color: colors.text.primary,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        />
        <button
          onClick={handleCustomAdd}
          disabled={!customName.trim()}
          className="w-full px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ 
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText
          }}
          onMouseEnter={(e) => !customName.trim() || (e.currentTarget.style.backgroundColor = colors.button.primaryHover)}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
        >
          Aggiungi ingrediente personalizzato
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg transition-colors"
          style={{ 
            backgroundColor: colors.bg.input,
            color: colors.text.secondary
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.input}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

export function ProcedureModal({ 
  isOpen, 
  onClose, 
  productId: propProductId,
  productName: propProductName,
  product,
  categories,
  onSuccess 
}: ProcedureModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const productId = product?.id || propProductId;
  const productName = product?.name || propProductName || "";
  
  const [steps, setSteps] = useState<ProcedureStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProcedure, setIsLoadingProcedure] = useState(false);
  const [selectedGlasses, setSelectedGlasses] = useState<string[]>([]);
  const [showIngredientPopup, setShowIngredientPopup] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [currentTextAreaRef, setCurrentTextAreaRef] = useState<HTMLTextAreaElement | null>(null);

  // Load existing procedure when modal opens
  useEffect(() => {
    if (isOpen && productId) {
      loadExistingProcedure();
    } else if (!isOpen) {
      // Reset when modal closes
      setSteps([]);
    }
  }, [isOpen, productId]);

  const loadExistingProcedure = async () => {
    if (!productId) return;
    
    setIsLoadingProcedure(true);
    try {
      const response = await fetch(`/api/products/procedures?productId=${productId}`);
      
      if (response.ok) {
        const procedure = await response.json();
        if (procedure && procedure.ProcedureStep) {
          // Convert the loaded procedure to our state format
          const loadedSteps = procedure.ProcedureStep
            .sort((a: any, b: any) => a.order - b.order)
            .map((step: any) => ({
              id: step.id,
              description: step.description,
              order: step.order,
              ingredients: step.ProcedureIngredient.map((ing: any) => ({
                id: ing.id,
                name: ing.name,
                quantity: ing.quantity.toString(),
                unit: ing.unit
              }))
            }));
          setSteps(loadedSteps);
          
          // Load saved glasses
          if (procedure.glasses && Array.isArray(procedure.glasses)) {
            setSelectedGlasses(procedure.glasses);
          }
        }
      }
    } catch (error) {
      console.error("Errore caricamento procedura:", error);
    } finally {
      setIsLoadingProcedure(false);
    }
  };


  const addStep = () => {
    const newStep: ProcedureStep = {
      id: Date.now().toString(),
      description: "",
      order: steps.length + 1,
      ingredients: []
    };
    setSteps([...steps, newStep]);
  };

  // Extract ingredients from text with parentheses format
  const extractIngredientsFromText = (text: string): ProcedureIngredient[] => {
    const ingredients: ProcedureIngredient[] = [];
    
    // Match patterns like (Aperol) 33ml or (Prosecco) or (Ingredient Name) 50g or (Limone) 2spicchi
    const matches = text.matchAll(/\(([^)]+)\)(?:\s*(\d+(?:\.\d+)?)(ml|cl|l|g|kg|pz|cucchiai|cucchiaini|spicchi|fette))?/g);
    
    for (const match of matches) {
      const name = match[1].trim();
      const quantity = match[2] || "0";
      const unit = match[3] || "pz";
      
      // Avoid duplicates
      if (!ingredients.find(ing => ing.name.toLowerCase() === name.toLowerCase())) {
        ingredients.push({
          id: `${Date.now()}_${Math.random()}`,
          name,
          quantity,
          unit
        });
      }
    }
    
    return ingredients;
  };

  const updateStep = (stepId: string, field: keyof ProcedureStep, value: any) => {
    setSteps(steps.map(step => {
      if (step.id === stepId) {
        const updatedStep = { ...step, [field]: value };
        
        // If updating description, automatically extract ingredients
        if (field === 'description') {
          updatedStep.ingredients = extractIngredientsFromText(value);
        }
        
        return updatedStep;
      }
      return step;
    }));
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId));
  };


  const toggleGlass = (glassId: string) => {
    setSelectedGlasses(prev => 
      prev.includes(glassId) 
        ? prev.filter(id => id !== glassId)
        : [...prev, glassId]
    );
  };

  const openIngredientPopup = (stepId: string, textAreaRef: HTMLTextAreaElement) => {
    setCurrentStepId(stepId);
    setCurrentTextAreaRef(textAreaRef);
    setShowIngredientPopup(true);
  };

  const insertIngredientInText = (ingredientName: string, quantity?: string, unit?: string) => {
    if (!currentTextAreaRef || !currentStepId) return;
    
    const textarea = currentTextAreaRef;
    const cursorPosition = textarea.selectionStart;
    const currentText = textarea.value;
    
    // Create ingredient text in parentheses format: (Nome Ingrediente) quantità unità
    const ingredientText = quantity && unit ? `(${ingredientName}) ${quantity}${unit}` : `(${ingredientName})`;
    
    // Insert at cursor position
    const newText = currentText.slice(0, cursorPosition) + ingredientText + currentText.slice(cursorPosition);
    
    // Update step description
    updateStep(currentStepId, 'description', newText);
    
    // Close popup and focus back to textarea
    setShowIngredientPopup(false);
    setCurrentStepId(null);
    setCurrentTextAreaRef(null);
    
    // Focus textarea and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition + ingredientText.length, cursorPosition + ingredientText.length);
    }, 100);
  };

  const renderStepPreview = (step: ProcedureStep) => {
    let description = step.description;
    
    // Replace parentheses format with badges: (Ingredient) 33ml or (Ingredient) 2spicchi -> badge
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
        const quantity = ingredientMatch[2];
        const unit = ingredientMatch[3];
        const displayText = quantity && unit ? `${ingredientName} ${quantity}${unit}` : ingredientName;
        
        elements.push(
          <span 
            key={`ingredient_${i}`}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mx-1"
            style={{ 
              backgroundColor: colors.accent + '20',
              color: colors.accent,
              borderColor: colors.accent,
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
  };

  const handleSave = async () => {
    if (!productId || steps.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/products/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          steps: steps.map((step, index) => ({
            description: step.description,
            order: index + 1,
            ingredients: step.ingredients.map(ing => ({
              name: ing.name,
              quantity: parseFloat(ing.quantity) || 0,
              unit: ing.unit
            }))
          })),
          glasses: selectedGlasses
        })
      });

      if (!response.ok) throw new Error("Errore nel salvataggio");

      onSuccess?.();
      onClose();
      setSteps([]);
    } catch (error) {
      console.error("Errore:", error);
      alert("Errore nel salvataggio della procedura");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedModal isOpen={isOpen} onClose={onClose} title={`Procedura per ${productName}`} size="xl">
      <div className="space-y-4">
        {/* Loading state */}
        {isLoadingProcedure ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.primary }} />
          </div>
        ) : (
          <>
            {/* Glass Selection */}
            <div className="mb-6">
              <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: colors.text.primary }}>
                <Wine className="h-4 w-4" />
                Bicchieri consigliati
              </h4>
              <GlassSelector 
                selectedGlasses={selectedGlasses}
                onGlassToggle={toggleGlass}
                colors={colors}
              />
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <h4 className="font-medium" style={{ color: colors.text.primary }}>
                Passaggi della preparazione
              </h4>
              {steps.map((step, stepIndex) => (
          <div 
            key={step.id}
            className="p-4 rounded-lg space-y-3"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-start gap-3">
              <span 
                className="text-lg font-semibold"
                style={{ color: colors.text.primary }}
              >
                {stepIndex + 1}.
              </span>
              <div className="flex-1 space-y-3">
                <div className="relative">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        // Store reference for ingredient insertion
                        (el as any).stepId = step.id;
                      }
                    }}
                    placeholder="Descrivi questo passaggio..."
                    value={step.description}
                    onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 pr-12 rounded-lg resize-none"
                    rows={2}
                    style={{ 
                      backgroundColor: colors.bg.input,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                      openIngredientPopup(step.id, textarea);
                    }}
                    className="absolute right-2 top-2 p-1 rounded transition-colors"
                    title="Aggiungi ingrediente"
                    style={{ 
                      color: colors.accent,
                      backgroundColor: colors.bg.card
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.card}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Preview of step with badges */}
                {step.description && step.ingredients.length > 0 && (
                  <div 
                    className="p-3 rounded-lg"
                    style={{ 
                      backgroundColor: colors.bg.hover,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    <p className="text-xs font-medium mb-2" style={{ color: colors.text.secondary }}>
                      Anteprima:
                    </p>
                    <div className="text-sm" style={{ color: colors.text.primary }}>
                      {renderStepPreview(step)}
                    </div>
                  </div>
                )}
                
                {/* Ingredients extracted from text - read only display */}
                {step.ingredients.length > 0 && (
                  <div className="space-y-2">
                    <h4 
                      className="text-sm font-medium"
                      style={{ color: colors.text.secondary }}
                    >
                      Ingredienti rilevati automaticamente:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {step.ingredients.map((ingredient) => (
                        <span 
                          key={ingredient.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                          style={{ 
                            backgroundColor: colors.bg.hover,
                            color: colors.text.secondary,
                            borderColor: colors.border.primary,
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                        >
                          {ingredient.name} {ingredient.quantity !== "0" && `${ingredient.quantity}${ingredient.unit}`}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: colors.text.muted }}>
                      Gli ingredienti vengono estratti automaticamente dal testo usando il formato (Nome Ingrediente) quantitàunità
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeStep(step.id)}
                className="p-1 rounded transition-colors"
                style={{ 
                  color: colors.text.error 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
              ))}
            </div>

            {/* Add step button */}
            <button
              onClick={addStep}
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              style={{ 
                backgroundColor: colors.bg.card,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'dashed'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.card}
            >
              <Plus className="h-5 w-5" />
              Aggiungi passaggio
            </button>

            {/* Ingredient Summary */}
            {steps.some(step => step.ingredients.length > 0) && (
              <div 
                className="mt-6 p-4 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.accent,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <h4 className="font-medium mb-3" style={{ color: colors.text.primary }}>
                  Riepilogo ingredienti totali:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // Aggregate ingredients across all steps
                    const ingredientMap = new Map<string, { quantity: number; unit: string }>();
                    
                    steps.forEach(step => {
                      step.ingredients.forEach(ing => {
                        if (ing.name && ing.quantity) {
                          const key = `${ing.name}_${ing.unit}`;
                          const existing = ingredientMap.get(key);
                          const quantity = parseFloat(ing.quantity) || 0;
                          if (existing) {
                            existing.quantity += quantity;
                          } else {
                            ingredientMap.set(key, { quantity, unit: ing.unit });
                          }
                        }
                      });
                    });
                    
                    return Array.from(ingredientMap.entries()).map(([key, data]) => {
                      const name = key.split('_')[0];
                      return (
                        <span 
                          key={key}
                          className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium"
                          style={{ 
                            backgroundColor: colors.accent + '20',
                            color: colors.accent,
                            borderColor: colors.accent,
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

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: colors.bg.card,
              color: colors.text.secondary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.card}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || steps.length === 0}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = colors.button.primaryHover)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            <Save className="h-4 w-4" />
            {isLoading ? "Salvataggio..." : "Salva procedura"}
          </button>
        </div>
          </>
        )}

        {/* Ingredient Selection Popup */}
        {showIngredientPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div 
              className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto"
              style={{ 
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <h4 className="font-medium mb-4" style={{ color: colors.text.primary }}>
                Aggiungi ingrediente
              </h4>
              
              <IngredientSelector 
                onSelectIngredient={insertIngredientInText}
                onClose={() => setShowIngredientPopup(false)}
                colors={colors}
              />
            </div>
          </div>
        )}
      </div>
    </ThemedModal>
  );
}