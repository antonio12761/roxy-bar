"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Key, 
  Shield,
  UserCheck,
  UserX,
  Loader2,
  Mail,
  User,
  Building2,
  Filter,
  ChevronDown,
  X,
  UserPlus
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  username: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  attivo: boolean;
  bloccato: boolean;
  emailVerified: Date | null;
  ultimoAccesso: Date | null;
  createdAt: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
}

interface UserPermissions {
  permissions: string[];
  customRoles: any[];
  directPermissions: any[];
  systemRole: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  nome: string;
  cognome: string;
  ruolo: string;
  mustChangePassword: boolean;
}

const ROLES = [
  { value: 'ADMIN', label: 'Admin', color: 'text-purple-400' },
  { value: 'MANAGER', label: 'Manager', color: 'text-blue-400' },
  { value: 'SUPERVISORE', label: 'Supervisore', color: 'text-indigo-400' },
  { value: 'CAMERIERE', label: 'Cameriere', color: 'text-green-400' },
  { value: 'PREPARA', label: 'Prepara', color: 'text-orange-400' },
  { value: 'BANCO', label: 'Banco', color: 'text-lime-400' },
  { value: 'CUCINA', label: 'Cucina', color: 'text-cyan-400' },
  { value: 'CASSA', label: 'Cassa', color: 'text-pink-400' }
];

export default function AdminUsersPage() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<CustomRole[]>([]);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    email: "",
    password: "",
    nome: "",
    cognome: "",
    ruolo: "CAMERIERE",
    mustChangePassword: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [quickRoleUserId, setQuickRoleUserId] = useState<string | null>(null);
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter]);
  
  // Fetch available roles
  useEffect(() => {
    fetchAvailableRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setErrors({});

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
          setMessage("✅ Utente creato con successo");
          setShowCreateModal(false);
          fetchUsers();
          resetForm();
        } else {
          setMessage(`❌ ${result.error}`);
        }
      } catch (error) {
        setMessage("❌ Errore durante la creazione");
      }
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setMessage("");
    setErrors({});

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            ...formData
          })
        });

        const result = await response.json();

        if (response.ok) {
          setMessage("✅ Utente aggiornato con successo");
          setShowEditModal(false);
          fetchUsers();
          resetForm();
        } else {
          setMessage(`❌ ${result.error}`);
        }
      } catch (error) {
        setMessage("❌ Errore durante l'aggiornamento");
      }
    });
  };

  const handleToggleUserStatus = async (userId: string, field: 'attivo' | 'bloccato', value: boolean) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          [field]: value
        })
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      nome: "",
      cognome: "",
      ruolo: "CAMERIERE",
      mustChangePassword: true
    });
    setSelectedUser(null);
  };

  const handleQuickRoleUpdate = async (userId: string, newRole: string) => {
    setUpdatingRoles(prev => new Set(prev).add(userId));
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          ruolo: newRole
        })
      });

      if (response.ok) {
        // Update the local state
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, ruolo: newRole } : user
        ));
        setMessage(`✅ Ruolo aggiornato con successo`);
        setTimeout(() => setMessage(""), 3000);
      } else {
        const data = await response.json();
        setMessage(`❌ ${data.error || "Errore nell'aggiornamento del ruolo"}`);
      }
    } catch (error) {
      console.error("Error updating role:", error);
      setMessage("❌ Errore nell'aggiornamento del ruolo");
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getRoleColor = (role: string) => {
    return ROLES.find(r => r.value === role)?.color || 'text-gray-400';
  };
  
  const fetchAvailableRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.roles);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };
  
  const handleShowRoles = async (user: User) => {
    setSelectedUser(user);
    setShowRolesModal(true);
    
    // Fetch user permissions and roles
    try {
      const response = await fetch(`/api/admin/permissions/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserPermissions(data);
      }
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    }
  };
  
  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch("/api/admin/users/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          roleId
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setMessage(result.message);
        handleShowRoles(selectedUser); // Refresh roles
      } else {
        const error = await response.json();
        setMessage(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error("Error assigning role:", error);
      setMessage("❌ Errore nell'assegnazione del ruolo");
    }
  };
  
  const handleRemoveRole = async (roleId: string) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/admin/users/roles?userId=${selectedUser.id}&roleId=${roleId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        const result = await response.json();
        setMessage(result.message);
        handleShowRoles(selectedUser); // Refresh roles
      } else {
        const error = await response.json();
        setMessage(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error("Error removing role:", error);
      setMessage("❌ Errore nella rimozione del ruolo");
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8" />
              Gestione Utenti
            </h1>
            <p className="text-gray-400 mt-2">Gestisci gli utenti della tua organizzazione</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg"
          >
            <Plus className="h-5 w-5" />
            Nuovo Utente
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-lg p-6" style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
                <input
                  type="text"
                  placeholder="Cerca per nome, username o email..."
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
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-12 px-4 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary, 
                borderWidth: '1px', 
                borderStyle: 'solid',
                '--tw-ring-color': colors.button.primary
              } as React.CSSProperties}
            >
              <option value="">Tutti i ruoli</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-12 px-4 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary, 
                borderWidth: '1px', 
                borderStyle: 'solid',
                '--tw-ring-color': colors.button.primary
              } as React.CSSProperties}
            >
              <option value="">Tutti gli stati</option>
              <option value="active">Attivi</option>
              <option value="blocked">Bloccati</option>
              <option value="inactive">Inattivi</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-lg p-6" style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.muted }} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
              <p style={{ color: colors.text.muted }}>Nessun utente trovato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: colors.border.secondary }}>
                    <th className="text-left py-4 px-4 font-medium" style={{ color: colors.text.secondary }}>Utente</th>
                    <th className="text-left py-4 px-4 font-medium" style={{ color: colors.text.secondary }}>Ruolo</th>
                    <th className="text-left py-4 px-4 font-medium" style={{ color: colors.text.secondary }}>Stato</th>
                    <th className="text-left py-4 px-4 font-medium" style={{ color: colors.text.secondary }}>Ultimo accesso</th>
                    <th className="text-right py-4 px-4 font-medium" style={{ color: colors.text.secondary }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="border-b transition-colors"
                      style={{ borderColor: colors.border.secondary }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="py-4 px-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold" style={{ color: colors.text.primary }}>{user.nome} {user.cognome}</p>
                            {user.emailVerified && (
                              <Shield className="h-4 w-4" style={{ color: colors.text.success }} />
                            )}
                          </div>
                          <p className="text-sm" style={{ color: colors.text.secondary }}>@{user.username}</p>
                          <p className="text-xs" style={{ color: colors.text.muted }}>{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {quickRoleUserId === user.id ? (
                          <select
                            value={user.ruolo}
                            onChange={(e) => {
                              handleQuickRoleUpdate(user.id, e.target.value);
                              setQuickRoleUserId(null);
                            }}
                            onBlur={() => setQuickRoleUserId(null)}
                            className="px-3 py-1 rounded-lg font-medium focus:outline-none focus:ring-2"
                            style={{ 
                              backgroundColor: colors.bg.input,
                              borderColor: colors.border.primary,
                              color: colors.text.primary,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              '--tw-ring-color': colors.button.primary
                            } as React.CSSProperties}
                            autoFocus
                          >
                            {ROLES.map(role => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setQuickRoleUserId(user.id)}
                            className={`font-medium px-3 py-1 rounded-lg transition-all hover:ring-2 ${getRoleColor(user.ruolo)}`}
                            style={{
                              backgroundColor: colors.bg.hover,
                              '--tw-ring-color': colors.button.primary
                            } as React.CSSProperties}
                            disabled={updatingRoles.has(user.id)}
                          >
                            {updatingRoles.has(user.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin inline" />
                            ) : (
                              ROLES.find(r => r.value === user.ruolo)?.label
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {user.attivo ? (
                            <span className="flex items-center gap-1" style={{ color: colors.text.success }}>
                              <UserCheck className="h-4 w-4" />
                              Attivo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1" style={{ color: colors.text.muted }}>
                              <UserX className="h-4 w-4" />
                              Inattivo
                            </span>
                          )}
                          {user.bloccato && (
                            <span className="text-sm" style={{ color: colors.text.error }}>(Bloccato)</span>
                          )}
                          {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                            <span className="text-sm" style={{ color: colors.text.error }}>(Temporaneo)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm" style={{ color: colors.text.secondary }}>
                          {user.ultimoAccesso 
                            ? new Date(user.ultimoAccesso).toLocaleString('it-IT')
                            : 'Mai'
                          }
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setFormData({
                                username: user.username,
                                email: user.email,
                                password: "",
                                nome: user.nome,
                                cognome: user.cognome,
                                ruolo: user.ruolo,
                                mustChangePassword: false
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
                            onClick={() => handleShowRoles(user)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: colors.button.primary }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = colors.bg.hover;
                              e.currentTarget.style.color = colors.button.primaryHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = colors.button.primary;
                            }}
                            title="Gestisci Ruoli"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleUserStatus(user.id, 'attivo', !user.attivo)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ 
                              color: user.attivo ? colors.text.success : colors.text.secondary 
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = user.attivo ? 'rgba(34, 197, 94, 0.1)' : colors.bg.hover;
                              e.currentTarget.style.color = user.attivo ? colors.text.success : colors.text.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = user.attivo ? colors.text.success : colors.text.secondary;
                            }}
                            title={user.attivo ? "Disattiva" : "Attiva"}
                          >
                            {user.attivo ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleToggleUserStatus(user.id, 'bloccato', !user.bloccato)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ 
                              color: user.bloccato ? colors.text.error : colors.text.secondary 
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = user.bloccato ? 'rgba(220, 38, 38, 0.1)' : colors.bg.hover;
                              e.currentTarget.style.color = user.bloccato ? colors.text.error : colors.text.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = user.bloccato ? colors.text.error : colors.text.secondary;
                            }}
                            title={user.bloccato ? "Sblocca" : "Blocca"}
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-2xl" style={{ 
            backgroundColor: colors.bg.card, 
            borderColor: colors.border.primary, 
            borderWidth: '1px', 
            borderStyle: 'solid' 
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {showCreateModal ? 'Crea Nuovo Utente' : 'Modifica Utente'}
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

            <form onSubmit={showCreateModal ? handleCreateUser : handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
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
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Cognome</label>
                  <input
                    type="text"
                    value={formData.cognome}
                    onChange={(e) => setFormData({...formData, cognome: e.target.value})}
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
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
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
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
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

              {(showCreateModal || formData.password) && (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>
                    Password {showEditModal && "(lascia vuoto per non cambiare)"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full h-12 px-4 rounded-lg focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.bg.input, 
                      borderColor: colors.border.primary, 
                      color: colors.text.primary, 
                      borderWidth: '1px', 
                      borderStyle: 'solid',
                      '--tw-ring-color': colors.button.primary
                    } as React.CSSProperties}
                    required={showCreateModal}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Ruolo</label>
                <select
                  value={formData.ruolo}
                  onChange={(e) => setFormData({...formData, ruolo: e.target.value})}
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
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {showCreateModal && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mustChangePassword"
                    checked={formData.mustChangePassword}
                    onChange={(e) => setFormData({...formData, mustChangePassword: e.target.checked})}
                    className="w-4 h-4 text-amber-600 bg-gray-900 border-gray-700 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="mustChangePassword" className="text-sm" style={{ color: colors.text.secondary }}>
                    L'utente deve cambiare password al primo accesso
                  </label>
                </div>
              )}

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
                    showCreateModal ? 'Crea Utente' : 'Aggiorna Utente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Roles Management Modal */}
      {showRolesModal && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto" style={{ 
            backgroundColor: colors.bg.card, 
            borderColor: colors.border.primary, 
            borderWidth: '1px', 
            borderStyle: 'solid' 
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                Gestione Ruoli - {selectedUser.nome} {selectedUser.cognome}
              </h2>
              <button
                onClick={() => {
                  setShowRolesModal(false);
                  setSelectedUser(null);
                  setUserPermissions(null);
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
            
            {userPermissions && (
              <div className="space-y-6">
                {/* Current System Role */}
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text.primary }}>Ruolo di Sistema</h3>
                  <Badge variant="secondary" className="text-base">
                    {ROLES.find(r => r.value === userPermissions.systemRole)?.label || userPermissions.systemRole}
                  </Badge>
                </div>
                
                {/* Custom Roles */}
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>Ruoli Personalizzati</h3>
                  {userPermissions.customRoles.length > 0 ? (
                    <div className="space-y-2">
                      {userPermissions.customRoles.map((userRole: any) => (
                        <div key={userRole.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
                          <div>
                            <p className="font-medium" style={{ color: colors.text.primary }}>{userRole.CustomRole.name}</p>
                            {userRole.CustomRole.description && (
                              <p className="text-sm" style={{ color: colors.text.secondary }}>{userRole.CustomRole.description}</p>
                            )}
                            <p className="text-xs" style={{ color: colors.text.muted }}>
                              Assegnato da {userRole.User_assignedBy.nome} {userRole.User_assignedBy.cognome}
                              {userRole.expiresAt && ` • Scade il ${new Date(userRole.expiresAt).toLocaleDateString('it-IT')}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveRole(userRole.customRoleId)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: colors.text.error }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: colors.text.muted }}>Nessun ruolo personalizzato assegnato</p>
                  )}
                </div>
                
                {/* Available Roles to Assign */}
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>Assegna Nuovo Ruolo</h3>
                  <div className="space-y-2">
                    {availableRoles
                      .filter(role => !userPermissions.customRoles.some((ur: any) => ur.customRoleId === role.id))
                      .map(role => (
                        <div key={role.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
                          <div>
                            <p className="font-medium" style={{ color: colors.text.primary }}>{role.name}</p>
                            {role.description && (
                              <p className="text-sm" style={{ color: colors.text.secondary }}>{role.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAssignRole(role.id)}
                            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            style={{ 
                              backgroundColor: colors.button.primary, 
                              color: colors.button.primaryText 
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
                          >
                            <Plus className="h-4 w-4" />
                            Assegna
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* All Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>Permessi Totali</h3>
                  <div className="flex flex-wrap gap-2">
                    {userPermissions.permissions.map((permission: string) => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {message && (
              <div 
                className="mt-4 p-4 rounded-lg text-sm font-medium text-center"
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
          </div>
        </div>
      )}
    </div>
  );
}