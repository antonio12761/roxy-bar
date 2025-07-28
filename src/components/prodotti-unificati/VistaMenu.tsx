'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Coffee, 
  TrendingUp, 
  Search, 
  Package,
  Euro
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  getProdottiUnificati,
  registraVenditaUnificata,
  getCategorieUniche,
  type ProdottoMenu
} from '@/actions/prodotti-unificati'

export default function VistaMenu() {
  const [prodotti, setProdotti] = useState<ProdottoMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroRicerca, setFiltroRicerca] = useState('')
  const [categorie, setCategorie] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    caricaProdotti()
    caricaCategorie()
  }, [filtroCategoria])

  const caricaProdotti = async () => {
    startTransition(async () => {
      try {
        setLoading(true)
        const result = await getProdottiUnificati({
          vista: 'menu',
          categoria: filtroCategoria || undefined
        })
        
        if (result.success && result.data) {
          setProdotti(result.data as ProdottoMenu[])
        }
      } catch (error) {
        console.error('Errore caricamento prodotti:', error)
      } finally {
        setLoading(false)
      }
    })
  }

  const caricaCategorie = async () => {
    const cat = await getCategorieUniche('menu')
    setCategorie(cat)
  }

  const registraVendita = async (prodottoId: number, quantita: number) => {
    startTransition(async () => {
      const result = await registraVenditaUnificata(prodottoId, quantita)
      if (result.success) {
        await caricaProdotti()
      }
    })
  }

  const prodottiFiltrati = prodotti.filter(p => {
    const matchCategoria = !filtroCategoria || 
      p.categoria === filtroCategoria || 
      p.categoriaMenu === filtroCategoria
    const matchRicerca = !filtroRicerca || 
      p.nome.toLowerCase().includes(filtroRicerca.toLowerCase()) ||
      p.descrizione.toLowerCase().includes(filtroRicerca.toLowerCase())
    
    return matchCategoria && matchRicerca
  })

  const margineMedia = prodottiFiltrati.length > 0
    ? prodottiFiltrati.reduce((sum, p) => sum + parseFloat(p.marginePercentuale), 0) / prodottiFiltrati.length
    : 0

  const prodottiDisponibili = prodottiFiltrati.filter(p => p.disponibilita > 0).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vista Menu</h1>
          <p className="text-gray-500">Prodotti disponibili per la vendita</p>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Prodotti Menu</p>
              <p className="text-2xl font-bold">{prodottiFiltrati.length}</p>
            </div>
            <Coffee className="w-8 h-8 text-white/70" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Disponibili</p>
              <p className="text-2xl font-bold">{prodottiDisponibili}</p>
            </div>
            <Package className="w-8 h-8 text-white/70" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Margine Medio</p>
              <p className="text-2xl font-bold">{margineMedia.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Categorie</p>
              <p className="text-2xl font-bold">{categorie.length}</p>
            </div>
            <Euro className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filtri */}
      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-gray-600">Ricerca</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cerca per nome o descrizione..."
                value={filtroRicerca}
                onChange={(e) => setFiltroRicerca(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="text-sm text-gray-600">Categoria</label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Tutte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tutte</SelectItem>
                {categorie.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabella */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Prezzo</TableHead>
              <TableHead className="text-right">Disponibilità</TableHead>
              <TableHead className="text-right">Margine</TableHead>
              <TableHead>Allergeni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : prodottiFiltrati.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Nessun prodotto trovato
                </TableCell>
              </TableRow>
            ) : (
              prodottiFiltrati.map((prodotto) => (
                <TableRow key={prodotto.id}>
                  <TableCell className="font-medium">
                    {prodotto.nome}
                    {prodotto.volumeServizio && (
                      <span className="text-gray-500 text-sm ml-2">
                        ({prodotto.volumeServizio})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{prodotto.categoriaMenu || prodotto.categoria}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {prodotto.descrizione}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    €{prodotto.prezzoVendita.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {prodotto.disponibilita > 0 ? (
                      <Badge variant="success">{prodotto.disponibilita}</Badge>
                    ) : (
                      <Badge variant="destructive">Esaurito</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <span className="font-semibold">{prodotto.marginePercentuale}%</span>
                      <span className="text-gray-500 text-sm block">
                        €{prodotto.margineUnitario.toFixed(2)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {prodotto.allergeni ? (
                      <span className="text-sm text-gray-600">{prodotto.allergeni}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}