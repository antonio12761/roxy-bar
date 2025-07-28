'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Download,
  Filter
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
  refreshVisteProdotti,
  generaReportProdotti,
  getCategorieUniche,
  type ProdottoMagazzino
} from '@/actions/prodotti-unificati'

export default function VistaMagazzino() {
  const [prodotti, setProdotti] = useState<ProdottoMagazzino[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroRicerca, setFiltroRicerca] = useState('')
  const [mostraSoloDaRiordinare, setMostraSoloDaRiordinare] = useState(false)
  const [categorie, setCategorie] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    caricaProdotti()
    caricaCategorie()
  }, [])

  const caricaProdotti = async () => {
    startTransition(async () => {
      try {
        setLoading(true)
        const result = await getProdottiUnificati({
          vista: 'magazzino',
          categoria: filtroCategoria || undefined,
          daRiordinare: mostraSoloDaRiordinare || undefined
        })
        
        if (result.success && result.data) {
          setProdotti(result.data as ProdottoMagazzino[])
        }
      } catch (error) {
        console.error('Errore caricamento prodotti:', error)
      } finally {
        setLoading(false)
      }
    })
  }

  const caricaCategorie = async () => {
    const cat = await getCategorieUniche('magazzino')
    setCategorie(cat)
  }

  const handleRefreshViste = async () => {
    startTransition(async () => {
      const result = await refreshVisteProdotti()
      if (result.success) {
        await caricaProdotti()
      }
    })
  }

  const esportaReport = async (tipo: 'riordino' | 'valore-magazzino' | 'margini' | 'rotazione') => {
    startTransition(async () => {
      const result = await generaReportProdotti(tipo)
      
      if (result.success && result.report) {
        const blob = new Blob([JSON.stringify(result.report, null, 2)], { 
          type: 'application/json' 
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${tipo}-${new Date().toISOString().split('T')[0]}.json`
        a.click()
      }
    })
  }

  const prodottiFiltrati = prodotti.filter(p => {
    const matchCategoria = !filtroCategoria || p.categoria === filtroCategoria
    const matchRicerca = !filtroRicerca || 
      p.nome.toLowerCase().includes(filtroRicerca.toLowerCase()) ||
      p.codice?.includes(filtroRicerca) ||
      p.fornitore?.toLowerCase().includes(filtroRicerca.toLowerCase())
    
    return matchCategoria && matchRicerca
  })

  const valoreTotale = prodottiFiltrati.reduce((sum, p) => sum + p.valoreGiacenza, 0)
  const prodottiDaRiordinare = prodottiFiltrati.filter(p => p.daRiordinare).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vista Magazzino</h1>
          <p className="text-gray-500">Gestione inventario e scorte</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => esportaReport('riordino')} 
            variant="outline"
            disabled={isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            Report Riordino
          </Button>
          <Button 
            onClick={handleRefreshViste} 
            variant="outline"
            disabled={isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Prodotti Totali</p>
              <p className="text-2xl font-bold">{prodottiFiltrati.length}</p>
            </div>
            <Package className="w-8 h-8 text-white/70" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Valore Magazzino</p>
              <p className="text-2xl font-bold">€{valoreTotale.toFixed(2)}</p>
            </div>
            <Package className="w-8 h-8 text-white/70" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Da Riordinare</p>
              <p className="text-2xl font-bold">{prodottiDaRiordinare}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Categorie</p>
              <p className="text-2xl font-bold">{categorie.length}</p>
            </div>
            <Filter className="w-8 h-8 text-purple-500" />
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
                placeholder="Cerca per nome, codice o fornitore..."
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

          <Button
            variant={mostraSoloDaRiordinare ? "default" : "outline"}
            onClick={() => {
              setMostraSoloDaRiordinare(!mostraSoloDaRiordinare)
              caricaProdotti()
            }}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Da Riordinare
          </Button>
        </div>
      </Card>

      {/* Tabella */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornitore</TableHead>
              <TableHead className="text-right">Giacenza</TableHead>
              <TableHead className="text-right">Unità</TableHead>
              <TableHead className="text-right">P. Acquisto</TableHead>
              <TableHead className="text-right">Valore</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : prodottiFiltrati.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Nessun prodotto trovato
                </TableCell>
              </TableRow>
            ) : (
              prodottiFiltrati.map((prodotto) => (
                <TableRow key={prodotto.id}>
                  <TableCell className="font-mono text-sm">
                    {prodotto.codice}
                  </TableCell>
                  <TableCell className="font-medium">
                    {prodotto.nome}
                  </TableCell>
                  <TableCell>{prodotto.categoria}</TableCell>
                  <TableCell>{prodotto.fornitore || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={prodotto.daRiordinare ? 'text-red-600 font-semibold' : ''}>
                      {prodotto.giacenzaAttuale}
                    </span>
                    {prodotto.giacenzaMinima && (
                      <span className="text-gray-500 text-sm">
                        /{prodotto.giacenzaMinima}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {prodotto.unitaMisura}
                  </TableCell>
                  <TableCell className="text-right">
                    €{prodotto.prezzoAcquisto.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    €{prodotto.valoreGiacenza.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {prodotto.daRiordinare ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Riordinare
                      </Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
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