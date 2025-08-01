"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  Shield, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Key, 
  Users,
  Loader2,
  X,
  Check,
  Lock
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";

interface Permission {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  User_createdBy?: {
    nome: string;
    cognome: string;
  };
  RolePermission?: Array<{
    id: string;
    permissionId: string;
    customRoleId: string;
    Permission: Permission;
  }>;
  _count?: {
    UserCustomRole: number;
  };
}

interface RoleFormData {
  name: string;
  description: string;
  permissions: string[];
}

export default function RolesPage() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<RoleFormData>({
    name: "",
    description: "",
    permissions: []
  });
  const [message, setMessage] = useState("");
  const [creatingDefaults, setCreatingDefaults] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [search]);

  const fetchRoles = async () => {
    try {
      const params = new URLSearchParams({
        ...(search && { search })
      });

      const response = await fetch(`/api/admin/roles?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/admin/permissions", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/roles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
          setMessage("✅ Ruolo creato con successo");
          setShowCreateModal(false);
          fetchRoles();
          resetForm();
        } else {
          setMessage(`❌ ${result.error}`);
        }
      } catch (error) {
        setMessage("❌ Errore durante la creazione");
      }
    });
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/roles/${selectedRole.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
          setMessage("✅ Ruolo aggiornato con successo");
          setShowEditModal(false);
          fetchRoles();
          resetForm();
        } else {
          setMessage(`❌ ${result.error}`);
        }
      } catch (error) {
        setMessage("❌ Errore durante l'aggiornamento");
      }
    });
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo ruolo?")) return;

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        fetchRoles();
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      permissions: []
    });
    setSelectedRole(null);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupPermissionsByCategory = () => {
    const grouped: Record<string, Permission[]> = {};
    const categoryLabels: Record<string, string> = {
      'USERS': '👤 Gestione Utenti',
      'ROLES': '🔐 Gestione Ruoli',
      'ORDERS': '📝 Gestione Ordini',
      'PRODUCTS': '📦 Gestione Prodotti',
      'REPORTS': '📊 Report e Statistiche',
      'SETTINGS': '⚙️ Impostazioni',
      'PAYMENTS': '💳 Pagamenti',
      'INVENTORY': '📋 Inventario'
    };
    
    permissions.forEach(permission => {
      const category = permission.name.split('.')[0].toUpperCase();
      const label = categoryLabels[category] || category;
      if (!grouped[label]) {
        grouped[label] = [];
      }
      grouped[label].push(permission);
    });
    return grouped;
  };

  const getPermissionDisplayName = (permission: Permission) => {
    const nameMap: Record<string, string> = {
      'users.view': 'Visualizza utenti',
      'users.create': 'Crea utenti',
      'users.edit': 'Modifica utenti',
      'users.delete': 'Elimina utenti',
      'roles.view': 'Visualizza ruoli',
      'roles.create': 'Crea ruoli',
      'roles.edit': 'Modifica ruoli',
      'roles.delete': 'Elimina ruoli',
      'orders.view': 'Visualizza ordini',
      'orders.create': 'Crea ordini',
      'orders.edit': 'Modifica ordini',
      'orders.delete': 'Elimina ordini',
      'products.view': 'Visualizza prodotti',
      'products.create': 'Crea prodotti',
      'products.edit': 'Modifica prodotti',
      'products.delete': 'Elimina prodotti',
      'reports.view': 'Visualizza report',
      'reports.export': 'Esporta report',
      'settings.view': 'Visualizza impostazioni',
      'settings.edit': 'Modifica impostazioni',
      'payments.view': 'Visualizza pagamenti',
      'payments.process': 'Processa pagamenti',
      'inventory.view': 'Visualizza inventario',
      'inventory.manage': 'Gestisci inventario'
    };
    return nameMap[permission.name] || permission.name;
  };

  const defaultRoleTemplates = [
    {
      name: 'Cameriere',
      description: 'Gestisce gli ordini ai tavoli e al banco',
      permissions: ['orders.view', 'orders.create', 'orders.edit', 'products.view']
    },
    {
      name: 'Prepara',
      description: 'Gestisce la preparazione degli ordini',
      permissions: ['orders.view', 'orders.edit', 'products.view']
    },
    {
      name: 'Cassa',
      description: 'Gestisce i pagamenti e la chiusura dei conti',
      permissions: ['orders.view', 'payments.view', 'payments.process', 'reports.view']
    },
    {
      name: 'Supervisore',
      description: 'Supervisiona le operazioni e gestisce il personale',
      permissions: ['orders.view', 'orders.edit', 'orders.delete', 'users.view', 'reports.view', 'reports.export', 'products.view', 'products.edit']
    }
  ];

  const handleUseTemplate = (template: typeof defaultRoleTemplates[0]) => {
    const permissionIds = permissions
      .filter(p => template.permissions.includes(p.name))
      .map(p => p.id);
    
    setFormData({
      name: template.name,
      description: template.description,
      permissions: permissionIds
    });
  };

  const createDefaultRoles = async () => {
    setCreatingDefaults(true);
    try {
      let createdCount = 0;
      
      for (const template of defaultRoleTemplates) {
        // Check if role already exists
        const existingRole = roles.find(r => r.name.toLowerCase() === template.name.toLowerCase());
        if (existingRole) continue;

        const permissionIds = permissions
          .filter(p => template.permissions.includes(p.name))
          .map(p => p.id);

        const response = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            permissions: permissionIds
          })
        });

        if (response.ok) {
          createdCount++;
        }
      }

      if (createdCount > 0) {
        setMessage(`✅ ${createdCount} ruoli di default creati con successo!`);
        fetchRoles();
      } else {
        setMessage('ℹ️ Tutti i ruoli di default sono già presenti');
      }
    } catch (error) {
      console.error('Error creating default roles:', error);
      setMessage('❌ Errore nella creazione dei ruoli di default');
    } finally {
      setCreatingDefaults(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: colors.text.primary }}>
              <Shield className="h-8 w-8" />
              Gestione Ruoli
            </h1>
            <p className="mt-2" style={{ color: colors.text.muted }}>Crea e gestisci ruoli personalizzati con permessi specifici</p>
          </div>
          <div className="flex gap-3">
            {roles.length === 0 && (
              <button
                onClick={createDefaultRoles}
                disabled={creatingDefaults}
                className="font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-lg"
                style={{ 
                  backgroundColor: creatingDefaults ? colors.bg.hover : colors.bg.card, 
                  color: creatingDefaults ? colors.text.muted : colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  cursor: creatingDefaults ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => !creatingDefaults && (e.currentTarget.style.backgroundColor = colors.bg.hover)}
                onMouseLeave={(e) => !creatingDefaults && (e.currentTarget.style.backgroundColor = colors.bg.card)}
              >
                {creatingDefaults ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creazione in corso...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    Crea Ruoli Default
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-lg"
              style={{ 
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Plus className="h-5 w-5" />
              Nuovo Ruolo
            </button>
          </div>
        </div>

        {/* Global Message */}
        {message && !showCreateModal && !showEditModal && (
          <div 
            className="p-4 rounded-lg text-sm font-medium text-center animate-in fade-in duration-300"
            style={{
              backgroundColor: message.includes('❌') ? 'rgba(220, 38, 38, 0.1)' : 
                               message.includes('ℹ️') ? 'rgba(59, 130, 246, 0.1)' : 
                               'rgba(34, 197, 94, 0.1)',
              color: message.includes('❌') ? colors.text.error : 
                     message.includes('ℹ️') ? colors.text.primary :
                     colors.text.success,
              borderColor: message.includes('❌') ? colors.border.error : 
                          message.includes('ℹ️') ? colors.border.primary :
                          colors.border.success,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            {message}
          </div>
        )}

        {/* Search */}
        <div className="rounded-lg p-6" style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
            <input
              type="text"
              placeholder="Cerca ruoli..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary, 
                borderWidth: '1px', 
                borderStyle: 'solid',
                '--tw-ring-color': colors.button.primary
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.muted }} />
            </div>
          ) : roles.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
              <p style={{ color: colors.text.muted }}>Nessun ruolo trovato</p>
            </div>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="rounded-lg p-6 relative" style={{ 
                backgroundColor: colors.bg.card, 
                borderColor: colors.border.primary, 
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: colors.text.primary }}>{role.name}</h3>
                      {role.description && (
                        <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>{role.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedRole(role);
                          setFormData({
                            name: role.name,
                            description: role.description || "",
                            permissions: (role as any).permissions?.map((p: any) => p.permissionId) || []
                          });
                          setShowEditModal(true);
                        }}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: colors.text.secondary }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.bg.hover;
                          e.currentTarget.style.color = colors.text.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = colors.text.secondary;
                        }}
                        title="Modifica"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: colors.text.error }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm" style={{ color: colors.text.muted }}>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {role._count?.UserCustomRole || 0} utenti
                    </span>
                    <span className="flex items-center gap-1">
                      <Key className="h-4 w-4" />
                      {role.RolePermission?.length || 0} permessi
                    </span>
                  </div>

                  <div className="pt-4 border-t" style={{ borderColor: colors.border.secondary }}>
                    <p className="text-xs mb-2" style={{ color: colors.text.muted }}>Permessi:</p>
                    <div className="flex flex-wrap gap-1">
                      {role.RolePermission?.slice(0, 5).map((perm) => (
                        <Badge key={perm.id} variant="outline" className="text-xs">
                          {perm.Permission.name}
                        </Badge>
                      ))}
                      {(role.RolePermission?.length || 0) > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{(role.RolePermission?.length || 0) - 5} altri
                        </Badge>
                      )}
                    </div>
                  </div>

                  {role.User_createdBy && (
                    <div className="text-xs pt-2" style={{ color: colors.text.muted }}>
                      Creato da {role.User_createdBy.nome} {role.User_createdBy.cognome}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" style={{ 
            backgroundColor: colors.bg.card, 
            borderColor: colors.border.primary, 
            borderWidth: '1px', 
            borderStyle: 'solid' 
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {showCreateModal ? 'Crea Nuovo Ruolo' : 'Modifica Ruolo'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  resetForm();
                  setMessage("");
                }}
                className="transition-colors"
                style={{ color: colors.text.secondary }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.text.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.text.secondary}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={showCreateModal ? handleCreateRole : handleUpdateRole} className="space-y-6">
              {/* Template Selection for Create Modal */}
              {showCreateModal && (
                <div className="rounded-lg p-4" style={{ backgroundColor: colors.bg.darker }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: colors.text.primary }}>
                    🎯 Usa un template predefinito
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {defaultRoleTemplates.map((template) => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() => handleUseTemplate(template)}
                        className="p-3 rounded-lg text-left transition-all duration-200 border"
                        style={{
                          backgroundColor: formData.name === template.name ? colors.bg.hover : 'transparent',
                          borderColor: formData.name === template.name ? colors.button.primary : colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                        onMouseEnter={(e) => {
                          if (formData.name !== template.name) {
                            e.currentTarget.style.backgroundColor = colors.bg.hover;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (formData.name !== template.name) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <p className="font-medium text-sm" style={{ color: colors.text.primary }}>
                          {template.name}
                        </p>
                        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                          {template.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Nome Ruolo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full h-12 px-4 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid',
                    '--tw-ring-color': colors.button.primary
                  } as React.CSSProperties}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Descrizione</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 resize-none"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid',
                    '--tw-ring-color': colors.button.primary
                  } as React.CSSProperties}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                  Permessi 
                  <span className="font-normal text-xs ml-2" style={{ color: colors.text.muted }}>
                    ({formData.permissions.length} selezionati)
                  </span>
                </label>
                <div className="space-y-4">
                  {Object.entries(groupPermissionsByCategory()).map(([category, perms]) => {
                    const categoryPermissionCount = perms.filter(p => formData.permissions.includes(p.id)).length;
                    const allSelected = categoryPermissionCount === perms.length;
                    
                    return (
                      <div key={category} className="rounded-lg p-4 transition-all duration-200" style={{ 
                        backgroundColor: colors.bg.darker,
                        borderColor: categoryPermissionCount > 0 ? colors.button.primary : 'transparent',
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2" style={{ color: colors.text.primary }}>
                            {category}
                            {categoryPermissionCount > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                                backgroundColor: colors.button.primary + '20',
                                color: colors.button.primary 
                              }}>
                                {categoryPermissionCount}/{perms.length}
                              </span>
                            )}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                // Deselect all in category
                                const categoryPermIds = perms.map(p => p.id);
                                setFormData(prev => ({
                                  ...prev,
                                  permissions: prev.permissions.filter(id => !categoryPermIds.includes(id))
                                }));
                              } else {
                                // Select all in category
                                const categoryPermIds = perms.map(p => p.id);
                                setFormData(prev => ({
                                  ...prev,
                                  permissions: [...new Set([...prev.permissions, ...categoryPermIds])]
                                }));
                              }
                            }}
                            className="text-xs px-3 py-1 rounded transition-colors duration-200"
                            style={{
                              backgroundColor: allSelected ? colors.button.primary : 'transparent',
                              color: allSelected ? colors.button.primaryText : colors.text.secondary,
                              border: `1px solid ${colors.border.primary}`
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = allSelected ? colors.button.primaryHover : colors.bg.hover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = allSelected ? colors.button.primary : 'transparent';
                            }}
                          >
                            {allSelected ? '✓ Tutti selezionati' : 'Seleziona tutti'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {perms.map((permission) => {
                            const isChecked = formData.permissions.includes(permission.id);
                            return (
                              <label
                                key={permission.id}
                                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200"
                                style={{ 
                                  backgroundColor: isChecked ? colors.button.primary + '10' : 'transparent',
                                  borderColor: isChecked ? colors.button.primary : colors.border.secondary,
                                  borderWidth: '1px',
                                  borderStyle: 'solid'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isChecked) {
                                    e.currentTarget.style.backgroundColor = colors.bg.hover;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isChecked) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(permission.id)}
                                  className="w-4 h-4 rounded"
                                  style={{ accentColor: colors.button.primary }}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                    {getPermissionDisplayName(permission)}
                                  </p>
                                  {permission.description && (
                                    <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{permission.description}</p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {message && (
                <div 
                  className="p-4 rounded-lg text-sm font-medium text-center"
                  style={{
                    backgroundColor: message.includes('❌') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    color: message.includes('❌') ? colors.text.error : colors.text.success,
                    borderColor: message.includes('❌') ? colors.border.error : colors.border.success,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  {message}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                    setMessage("");
                  }}
                  className="flex-1 h-12 font-semibold rounded-lg transition-colors duration-200"
                  style={{ 
                    backgroundColor: colors.bg.hover, 
                    color: colors.text.primary 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-12 font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: isPending ? colors.bg.hover : colors.button.primary, 
                    color: isPending ? colors.text.muted : colors.button.primaryText,
                    cursor: isPending ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => !isPending && (e.currentTarget.style.backgroundColor = colors.button.primaryHover)}
                  onMouseLeave={(e) => !isPending && (e.currentTarget.style.backgroundColor = colors.button.primary)}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {showCreateModal ? 'Creazione...' : 'Aggiornamento...'}
                    </>
                  ) : (
                    showCreateModal ? 'Crea Ruolo' : 'Aggiorna Ruolo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}