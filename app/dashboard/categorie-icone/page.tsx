'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit2, Palette, ArrowLeft, Upload, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import Link from 'next/link'

interface CategoryIcon {
  id: number
  categoryName: string
  icon: string | null
  iconType: string
  color: string | null
}

// Emoji suggerite per categorie comuni
const suggestedEmojis: {[key: string]: string[]} = {
  'CAFFETTERIA': ['☕', '🥐', '🍩', '🧁', '🥧'],
  'BIRRE': ['🍺', '🍻', '🍷', '🥃'],
  'BIRRA': ['🍺', '🍻', '🍷', '🥃'],
  'BIRRASPINA': ['🍺', '🍻', '🍷', '🥃'],
  'COCKTAIL': ['🍹', '🍸', '🥂', '🍾', '🍷'],
  'MIXCOCKTAIL': ['🍹', '🍸', '🥂', '🍾', '🍷'],
  'APERITIVI': ['🥂', '🍾', '🥳', '🎉', '🍻'],
  'ALCOLICI': ['🥃', '🍾', '🍸', '🔥', '💪'],
  'BIBITE': ['🥤', '🧃', '🧉', '💧', '🥛'],
  'PANINI': ['🥪', '🍔', '🌭', '🌮', '🌯'],
  'GELATI': ['🍨', '🍦', '🍧', '🧊', '🥶'],
  'LIQUORI': ['🥃', '🍾', '🥂', '🍷', '🍶'],
  'DISTILLATI': ['🥃', '🍾', '🍸', '🔥', '💪'],
  'VINI&SPUMANTI': ['🍷', '🍾', '🥂', '🍇', '🍶'],
  'SNACK&CO.': ['🍿', '🥨', '🍟', '🌰', '🥜'],
  'DOLCIUMI': ['🍬', '🍭', '🍫', '🍩', '🍪'],
  'CARAMELLE&GOMME': ['🍬', '🍭', '🍫', '🍩', '🍪']
}

// Colori suggeriti
const suggestedColors = [
  '#FF6B6B', // Rosso
  '#4ECDC4', // Turchese
  '#45B7D1', // Azzurro
  '#96CEB4', // Verde menta
  '#FFEAA7', // Giallo
  '#DDA0DD', // Viola
  '#F4A460', // Arancione
  '#98D8C8', // Verde acqua
  '#FFB6C1', // Rosa
  '#B0E0E6', // Blu polvere
]

export default function CategoryIconsSettings() {
  const [categories, setCategories] = useState<CategoryIcon[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<CategoryIcon>>({})
  const [uploadingIcon, setUploadingIcon] = useState<string | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/dashboard/category-icons')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Errore caricamento categorie:', error)
      toast.error('Errore nel caricamento delle categorie')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (category: Partial<CategoryIcon>) => {
    if (!category.categoryName) return

    try {
      const response = await fetch('/api/dashboard/category-icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: category.categoryName,
          icon: category.icon,
          iconType: category.iconType || 'emoji',
          color: category.color
        })
      })
      
      if (response.ok) {
        toast.success('Categoria aggiornata')
        loadCategories()
        setEditingName(null)
      }
    } catch (error) {
      console.error('Errore salvataggio:', error)
      toast.error('Errore nel salvataggio')
    }
  }

  const handleIconUpload = async (categoryName: string, file: File) => {
    setUploadingIcon(categoryName)
    
    const formData = new FormData()
    formData.append('icon', file)

    try {
      const response = await fetch(`/api/dashboard/category-icons/${encodeURIComponent(categoryName)}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Icona caricata con successo')
        loadCategories()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Errore nel caricamento dell\'icona')
      }
    } catch (error) {
      console.error('Errore upload icona:', error)
      toast.error('Errore nel caricamento dell\'icona')
    } finally {
      setUploadingIcon(null)
    }
  }

  const startEdit = (category: CategoryIcon) => {
    setEditingName(category.categoryName)
    setEditForm(category)
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditForm({})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    )
  }

  // Raggruppa categorie principali e sottocategorie
  const mainCategories = categories.filter(c => !c.categoryName.includes('>'))
  const subCategories = categories.filter(c => c.categoryName.includes('>'))

  return (
    <div className="container mx-auto p-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Gestione Icone Categorie</h1>
          <p className="text-gray-600">Personalizza le icone delle categorie del menu</p>
        </div>
      </div>

      {/* Categorie Principali */}
      <h2 className="text-xl font-semibold mb-4">Categorie Principali</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {mainCategories.map((category) => {
          const categoryKey = category.categoryName.toUpperCase().replace('&', '&')
          const suggestions = suggestedEmojis[categoryKey] || []
          
          return (
            <Card key={category.categoryName} className="p-4">
              {editingName === category.categoryName ? (
                <div className="space-y-3">
                  <div className="font-semibold">{category.categoryName}</div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={editForm.icon || ''}
                      onChange={(e) => setEditForm({...editForm, icon: e.target.value, iconType: 'emoji'})}
                      placeholder="Emoji"
                      className="w-20"
                    />
                    <Input
                      type="color"
                      value={editForm.color || '#000000'}
                      onChange={(e) => setEditForm({...editForm, color: e.target.value})}
                      className="w-20"
                    />
                  </div>

                  {/* Emoji suggerite */}
                  {suggestions.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Suggerite:</span>
                      {suggestions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setEditForm({...editForm, icon: emoji, iconType: 'emoji'})}
                          className="text-2xl hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Colori suggeriti */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-sm text-gray-600">Colori:</span>
                    {suggestedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditForm({...editForm, color})}
                        className="w-6 h-6 rounded border-2 border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleSave(editForm)} 
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Salva
                    </Button>
                    <Button 
                      onClick={cancelEdit} 
                      variant="outline" 
                      size="sm"
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Mostra icona personalizzata o emoji */}
                      {category.icon && category.iconType === 'image' ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          <img 
                            src={category.icon} 
                            alt={category.categoryName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-3xl">{category.icon || '🍽️'}</span>
                      )}
                      <div>
                        <div className="font-semibold">{category.categoryName}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {/* Upload Icon Button */}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`upload-${category.categoryName}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleIconUpload(category.categoryName, file)
                            }
                          }}
                        />
                        <Button
                          onClick={() => document.getElementById(`upload-${category.categoryName}`)?.click()}
                          size="sm"
                          variant="outline"
                          disabled={uploadingIcon === category.categoryName}
                          title="Carica immagine"
                        >
                          {uploadingIcon === category.categoryName ? (
                            <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => startEdit(category)}
                        size="sm"
                        variant="outline"
                        title="Modifica emoji e colore"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {category.color && (
                    <div className="flex items-center gap-2 mt-2">
                      <Palette className="h-4 w-4 text-gray-500" />
                      <div 
                        className="w-full h-2 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Sottocategorie */}
      {subCategories.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">Sottocategorie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {subCategories.map((category) => (
              <Card key={category.categoryName} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{category.icon || '🍽️'}</span>
                    <div>
                      <div className="text-sm font-medium">{category.categoryName}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`upload-sub-${category.categoryName}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleIconUpload(category.categoryName, file)
                          }
                        }}
                      />
                      <Button
                        onClick={() => document.getElementById(`upload-sub-${category.categoryName}`)?.click()}
                        size="sm"
                        variant="outline"
                        disabled={uploadingIcon === category.categoryName}
                      >
                        {uploadingIcon === category.categoryName ? (
                          <div className="animate-spin h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Note informativa */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Come funziona</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Le icone personalizzate verranno mostrate nel menu clienti (/menu)</li>
          <li>• Puoi caricare immagini PNG/JPG o usare emoji</li>
          <li>• I colori possono essere utilizzati per temi personalizzati</li>
          <li>• Le modifiche sono immediate e non richiedono riavvio</li>
          <li>• Queste sono le categorie reali usate dai tuoi prodotti</li>
        </ul>
      </div>
    </div>
  )
}