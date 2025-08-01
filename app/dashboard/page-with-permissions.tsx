"use client";

import { PermissionGuard, usePermissions } from "@/components/permission-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardWithPermissions() {
  const { hasPermission, loading } = usePermissions();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard con Controllo Permessi</h1>

      {/* Sezione visibile solo con permesso dashboard.view */}
      <PermissionGuard permission="dashboard.view">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Dashboard Generale</h2>
          <p>Questa sezione è visibile solo agli utenti con il permesso 'dashboard.view'</p>
        </Card>
      </PermissionGuard>

      {/* Sezione visibile solo con permesso statistics.view */}
      <PermissionGuard permission="statistics.view">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Statistiche</h2>
          <p>Questa sezione è visibile solo agli utenti con il permesso 'statistics.view'</p>
        </Card>
      </PermissionGuard>

      {/* Sezione con controllo multiplo di permessi */}
      <PermissionGuard permission={["reports.view", "reports.export"]}>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Report</h2>
          <p>Questa sezione è visibile se hai almeno uno dei permessi: 'reports.view' o 'reports.export'</p>
          
          {/* Bottone visibile solo con permesso specifico */}
          {hasPermission("reports.export") && (
            <Button className="mt-4">
              Esporta Report
            </Button>
          )}
        </Card>
      </PermissionGuard>

      {/* Sezione con fallback personalizzato */}
      <PermissionGuard 
        permission="system.settings"
        fallback={
          <Card className="p-6 bg-gray-100">
            <h2 className="text-xl font-semibold mb-4">Impostazioni Sistema</h2>
            <p className="text-gray-600">
              Non hai i permessi per visualizzare le impostazioni di sistema.
              Contatta un amministratore per richiedere l'accesso.
            </p>
          </Card>
        }
      >
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Impostazioni Sistema</h2>
          <p>Qui puoi modificare le impostazioni del sistema</p>
          <Button className="mt-4">Modifica Impostazioni</Button>
        </Card>
      </PermissionGuard>
    </div>
  );
}