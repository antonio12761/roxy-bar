'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency } from '@/lib/utils'
import { Clock, Package, CheckCircle, DollarSign, Send } from 'lucide-react'
import type { Ordinazione, RigaOrdinazione, Prodotto, Tavolo } from '@prisma/client'

type OrdinazioneCompleta = Ordinazione & {
  righe: (RigaOrdinazione & {
    prodotto: Prodotto
  })[]
  tavolo?: Tavolo | null
}

interface OrderZonesProps {
  ordinazioni: OrdinazioneCompleta[]
  onStatusChange?: (orderId: string, newStatus: string) => void
}

const statusConfig = {
  INVIATA: {
    title: 'Ordini Inviati',
    icon: Send,
    color: 'bg-white/10',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-white/15-300 dark:border-white/15-700',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-700 dark:text-blue-300'
  },
  PRONTA: {
    title: 'Ordini Pronti',
    icon: Package,
    color: 'bg-white/10',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-white/15-300 dark:border-white/15-700',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    textColor: 'text-green-700 dark:text-green-300'
  },
  CONSEGNATA: {
    title: 'Ordini Ritirati',
    icon: CheckCircle,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-300 dark:border-purple-700',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    textColor: 'text-purple-700 dark:text-purple-300'
  },
  PAGATA: {
    title: 'Ordini Pagati',
    icon: DollarSign,
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-300 dark:border-gray-700',
    iconBg: 'bg-gray-100 dark:bg-gray-900/50',
    textColor: 'text-gray-700 dark:text-gray-300'
  }
}

export function OrderZones({ ordinazioni, onStatusChange }: OrderZonesProps) {
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, OrdinazioneCompleta[]>>({})

  useEffect(() => {
    const grouped = ordinazioni.reduce((acc, ord) => {
      const status = ord.stato
      if (!acc[status]) acc[status] = []
      acc[status].push(ord)
      return acc
    }, {} as Record<string, OrdinazioneCompleta[]>)
    
    setOrdersByStatus(grouped)
  }, [ordinazioni])

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  const getOrderTitle = (ord: OrdinazioneCompleta) => {
    if (ord.tipo === 'TAVOLO' && ord.tavolo) {
      return `Tavolo ${ord.tavolo.numero}${ord.tavolo.zona ? ` - ${ord.tavolo.zona}` : ''}`
    } else if (ord.tipo === 'ASPORTO') {
      return `Asporto - ${ord.nomeCliente || 'Cliente'}`
    } else {
      return `Bancone - ${ord.nomeCliente || 'Cliente'}`
    }
  }

  const renderOrderCard = (ord: OrdinazioneCompleta) => (
    <Card key={ord.id} className="mb-3 hover:shadow-lg transition-all duration-200 border-2">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-semibold">
              {getOrderTitle(ord)}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(ord.createdAt)}
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            #{ord.numero}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 mb-3">
          {ord.righe.map((riga) => (
            <div key={riga.id} className="flex justify-between items-start text-sm">
              <span className="flex items-center gap-1 flex-1">
                <span className="font-semibold text-base">{riga.quantita}x</span>
                <span className="line-clamp-2">{riga.prodotto.nome}</span>
                {riga.note && (
                  <span className="text-muted-foreground text-xs italic">({riga.note})</span>
                )}
              </span>
              <Badge 
                variant="secondary" 
                className={`text-xs ml-2 ${
                  riga.postazione === 'CUCINA' 
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    : riga.postazione === 'BANCO'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                }`}
              >
                {riga.postazione}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-3 border-t">
          <span className="font-bold text-lg">{formatCurrency(Number(ord.totale))}</span>
          {onStatusChange && getNextStatus(ord.stato) && (
            <Button
              size="sm"
              variant="default"
              className="font-medium"
              onClick={() => {
                const nextStatus = getNextStatus(ord.stato)
                if (nextStatus) onStatusChange(ord.id, nextStatus)
              }}
            >
              {getNextStatus(ord.stato) === 'PRONTA' && 'Segna Pronto'}
              {getNextStatus(ord.stato) === 'CONSEGNATA' && 'Consegnato'}
              {getNextStatus(ord.stato) === 'PAGATA' && 'Pagato'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow = ['INVIATA', 'PRONTA', 'CONSEGNATA', 'PAGATA']
    const currentIndex = statusFlow.indexOf(currentStatus)
    return currentIndex >= 0 && currentIndex < statusFlow.length - 1
      ? statusFlow[currentIndex + 1]
      : null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {Object.entries(statusConfig).map(([status, config]) => {
        const Icon = config.icon
        const orders = ordersByStatus[status] || []
        
        return (
          <div
            key={status}
            className={`rounded-xl border-2 ${config.borderColor} ${config.bgColor} overflow-hidden shadow-lg`}
          >
            <div className={`p-4 border-b-2 ${config.borderColor}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold flex items-center gap-3 ${config.textColor}`}>
                  <div className={`p-2.5 rounded-xl ${config.iconBg}`}>
                    <Icon className={`h-5 w-5 ${config.textColor}`} />
                  </div>
                  {config.title}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={`text-sm font-bold px-3 py-1 ${config.iconBg} ${config.textColor}`}
                >
                  {orders.length}
                </Badge>
              </div>
            </div>
            
            <div className="p-4">
              <ScrollArea className="h-[calc(100vh-300px)] pr-3">
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-50">
                    <Icon className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-center text-muted-foreground">
                      Nessun ordine in questa zona
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(renderOrderCard)}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )
      })}
    </div>
  )
}