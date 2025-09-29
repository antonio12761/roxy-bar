'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Gift, CreditCard, User } from 'lucide-react';
import { QRCode } from '@/components/ui/qr-code';
import { useToast } from '@/lib/toast-notifications';
import { getFidelityCardByCodice } from '@/lib/actions/fidelity';

interface FidelityCard {
  id: string;
  codiceCliente: string;
  nomeCliente?: string;
  punti: number;
  puntiTotali: number;
  puntiMensili: number;
  puntiDisponibili: number;
  quotaAttiva: boolean;
  dataScadenzaQuota?: string;
  prossimoReset: string;
  riscattiAttivi: number;
  dataCreazione: string;
  dataUltimaModifica: string;
}

export default function FidelityPage() {
  const [cardCode, setCardCode] = useState('');
  const [card, setCard] = useState<FidelityCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Controlla se la PWA è installabile
    const checkInstallable = () => {
      if ('BeforeInstallPromptEvent' in window) {
        setIsInstallable(true);
      }
    };

    checkInstallable();

    // Controlla se c'è un codice salvato nel localStorage
    const savedCode = localStorage.getItem('fidelityCardCode');
    if (savedCode) {
      setCardCode(savedCode);
      loadCard(savedCode);
    }
  }, []);

  const loadCard = async (code: string) => {
    setLoading(true);
    try {
      const result = await getFidelityCardByCodice(code);
      
      if (!result.success || !result.card) {
        throw new Error(result.error || 'Carta non trovata');
      }
      
      setCard(result.card);
      localStorage.setItem('fidelityCardCode', code);
    } catch (error) {
      toast.error('Carta non trovata. Verifica il codice.');
      setCard(null);
      localStorage.removeItem('fidelityCardCode');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardCode.trim()) {
      loadCard(cardCode.trim());
    }
  };

  const handleInstall = async () => {
    if ('BeforeInstallPromptEvent' in window) {
      const deferredPrompt = (window as any).deferredPrompt;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('App installata! Puoi accedere alla tua carta fedeltà dalla home del telefono.');
        }
      }
    }
  };

  const calculateProgress = () => {
    if (!card) return 0;
    return Math.min((card.punti / 10) * 100, 100);
  };

  const formatPoints = (points: number) => {
    return points.toString().padStart(3, '0');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Bar Roxy - Fidelity Card
        </h1>

        {!card ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <CreditCard className="w-8 h-8 mx-auto mb-2" />
                Accedi alla tua carta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cardCode">Codice Carta</Label>
                  <Input
                    id="cardCode"
                    type="text"
                    placeholder="Inserisci il tuo codice carta"
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Caricamento...
                    </>
                  ) : (
                    'Accedi'
                  )}
                </Button>
              </form>

              {isInstallable && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    Aggiungi questa app alla schermata home per accedere rapidamente alla tua carta fedeltà
                  </p>
                  <Button onClick={handleInstall} variant="outline" className="w-full">
                    Installa App
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>La tua carta fedeltà</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCard(null);
                      setCardCode('');
                      localStorage.removeItem('fidelityCardCode');
                    }}
                  >
                    Esci
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <User className="w-16 h-16 mx-auto mb-2 text-blue-600" />
                    <h2 className="text-xl font-semibold">
                      {card.nomeCliente || 'Cliente'}
                    </h2>
                    <p className="text-gray-500">{card.codiceCliente}</p>
                  </div>

                  {/* Sistema punti semplice (compatibilità) */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-medium">Premio rapido</span>
                      <span className="text-3xl font-bold text-blue-600">
                        {card.punti}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                      <div
                        className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${calculateProgress()}%` }}
                      />
                    </div>
                    
                    <p className="text-sm text-gray-600 text-center">
                      {10 - card.punti > 0
                        ? `Ancora ${10 - card.punti} punti per il premio!`
                        : 'Premio disponibile! 🎉'}
                    </p>
                  </div>

                  {/* Nuovo sistema punti */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Punti del mese</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">Reset: {new Date(card.prossimoReset).toLocaleDateString('it-IT')}</div>
                      </div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {card.puntiMensili}
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Punti disponibili</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">Per premi e quota</div>
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {card.puntiDisponibili}
                      </div>
                    </div>

                    {card.quotaAttiva ? (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Quota attiva ✓</div>
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                              Scade: {new Date(card.dataScadenzaQuota!).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                          <Gift className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-sm text-red-900 dark:text-red-100">Quota non attiva</div>
                        <div className="text-xs text-red-700 dark:text-red-300">Attiva in cassa per €10/mese</div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Totale storico</span>
                      <span className="font-medium">{card.puntiTotali}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Premi attivi</span>
                      <span className="font-medium">{card.riscattiAttivi}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-center">Il tuo QR Code</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="p-4 bg-white rounded-lg shadow-inner">
                  <QRCode value={card.codiceCliente} size={200} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}