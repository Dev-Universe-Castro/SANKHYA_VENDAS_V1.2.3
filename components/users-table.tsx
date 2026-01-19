"use client"

import { useState, useEffect } from "react"
import { Search, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Plus, Edit, Ban, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { User } from "@/lib/types"
import UserModal from "./user-modal"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner' // Importando toast para feedback
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export default function UsersTable() {
  const [searchTerm, setSearchTerm] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string>("Administrador")
  const [vendedoresMap, setVendedoresMap] = useState<Record<number, string>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  useEffect(() => {
    loadUsers()
    loadVendedoresNomes()
    // Buscar papel do usuário logado (adapte conforme sua lógica de autenticação)
    const userRole = localStorage.getItem('userRole') || "Administrador"
    setCurrentUserRole(userRole)
    console.log("👤 Papel do usuário carregado:", userRole)
  }, [])

  useEffect(() => {
    console.log("📊 Estado dos usuários:", {
      totalUsuarios: users.length,
      usuariosFiltrados: filteredUsers.length,
      primeiroUsuario: users.length > 0 ? users[0] : null
    })
  }, [users, filteredUsers])

  useEffect(() => {
    const applyFilters = async () => {
      if (searchTerm.trim() === "") {
        setFilteredUsers(users)
      } else {
        // Buscar do IndexedDB com filtros
        const { OfflineDataService } = await import('@/lib/offline-data-service')
        const usuariosFiltrados = await OfflineDataService.getUsuarios({ 
          search: searchTerm 
        })

        const usuariosMapeados = usuariosFiltrados.map((u: any) => ({
          id: u.CODUSUARIO || u.id,
          name: u.NOME || u.name || '',
          email: u.EMAIL || u.email || '',
          role: u.FUNCAO || u.role || 'Vendedor',
          status: u.STATUS || u.status || 'ativo',
          avatar: u.AVATAR || u.avatar || '',
          codVendedor: u.CODVEND || u.codVendedor || null
        }))

        setFilteredUsers(usuariosMapeados)
      }
    }

    applyFilters()
  }, [searchTerm, users])

  // Função para carregar usuários do IndexedDB
  const loadUsers = async () => {
    try {
      setIsLoading(true)

      // Sempre ler do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const usuariosLocal = await OfflineDataService.getUsuarios()

      if (usuariosLocal.length > 0) {
        // Mapear para o formato esperado pelo frontend
        const usuariosMapeados = usuariosLocal.map((u: any) => ({
          id: u.CODUSUARIO || u.id,
          name: u.NOME || u.name || '',
          email: u.EMAIL || u.email || '',
          role: u.FUNCAO || u.role || 'Vendedor',
          status: u.STATUS || u.status || 'ativo',
          avatar: u.AVATAR || u.avatar || '',
          codVendedor: u.CODVEND || u.codVendedor || null
        }))

        setUsers(usuariosMapeados)
        setFilteredUsers(usuariosMapeados)
        console.log(`✅ ${usuariosMapeados.length} usuários carregados do IndexedDB`)
      } else {
        console.log('📦 IndexedDB vazio - aguardando sincronização inicial via prefetch')
        setUsers([])
        setFilteredUsers([])
      }
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error)
      toast.error('Erro ao carregar usuários. Tente novamente.')
      setUsers([])
      setFilteredUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  // Função para carregar nomes de vendedores/gerentes do IndexedDB
  const loadVendedoresNomes = async () => {
    try {
      console.log('🔍 Carregando vendedores do IndexedDB...')
      
      // Buscar vendedores do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const vendedoresList = await OfflineDataService.getVendedores()

      const map: Record<number, string> = {}

      vendedoresList.forEach((v: any) => {
        map[parseInt(v.CODVEND)] = v.APELIDO
      })

      setVendedoresMap(map)
      console.log(`✅ ${vendedoresList.length} vendedores carregados do IndexedDB`)
    } catch (error) {
      console.error("❌ Erro ao carregar nomes de vendedores:", error)
      toast.error('Erro ao carregar nomes de vendedores.')
    }
  }

  const handleCreate = () => {
    setSelectedUser(null)
    setModalMode("create")
    setIsModalOpen(true)
  }

  const handleEdit = (user: User) => {
    console.log("✏️ INICIANDO EDIÇÃO - ID:", user.id)
    console.log("✏️ Dados recebidos:", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: user.avatar
    })

    setIsModalOpen(false)
    setSelectedUser(null)
    setModalMode("edit")

    setTimeout(() => {
      const userToEdit: User = {
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "Vendedor",
        status: user.status || "ativo",
        password: user.password || "",
        avatar: user.avatar || ""
      }

      console.log("✏️ Definindo usuário para edição:", userToEdit)
      setSelectedUser(userToEdit)

      setTimeout(() => {
        console.log("✏️ ABRINDO MODAL com dados completos")
        setIsModalOpen(true)
      }, 50)
    }, 50)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja inativar este usuário?")) {
      try {
        const response = await fetch('/api/usuarios/deletar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao inativar usuário')
        }

        // Remover do IndexedDB
        const { OfflineDataService } = await import('@/lib/offline-data-service')
        await OfflineDataService.deleteUsuario(id)

        // Recarregar a lista de usuários
        await loadUsers()
        toast.success('Usuário inativado com sucesso!')
      } catch (error) {
        console.error("Error inactivating user:", error)
        toast.error('Erro ao inativar usuário. Tente novamente.')
      }
    }
  }

  const handleApprove = async (id: number) => {
    try {
      const response = await fetch('/api/usuarios/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao aprovar usuário')
      }

      // Atualizar status no IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      await OfflineDataService.updateUsuarioStatus(id, "ativo") // Assumindo que aprovar muda o status para 'ativo'

      // Recarregar a lista de usuários
      await loadUsers()
      toast.success('Usuário aprovado com sucesso!')
    } catch (error) {
      console.error("Error approving user:", error)
      toast.error('Erro ao aprovar usuário. Tente novamente.')
    }
  }

  const handleBlock = async (id: number) => {
    if (confirm("Tem certeza que deseja bloquear este usuário?")) {
      try {
        const response = await fetch('/api/usuarios/bloquear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao bloquear usuário')
        }

        // Atualizar status no IndexedDB
        const { OfflineDataService } = await import('@/lib/offline-data-service')
        await OfflineDataService.updateUsuarioStatus(id, "bloqueado") // Assumindo que bloquear muda o status para 'bloqueado'

        // Recarregar a lista de usuários
        await loadUsers()
        toast.success('Usuário bloqueado com sucesso!')
      } catch (error) {
        console.error("Error blocking user:", error)
        toast.error('Erro ao bloquear usuário. Tente novamente.')
      }
    }
  }

  const handleSave = async (userData: Omit<User, "id"> | User) => {
    try {
      const response = await fetch('/api/usuarios/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userData, mode: modalMode })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar usuário')
      }

      const savedUserData = await response.json() // Assume que a API retorna os dados salvos, incluindo o ID se for criação

      // Atualizar ou adicionar no IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      if (modalMode === "create") {
        await OfflineDataService.addUsuario(savedUserData) // Assumindo que o IndexedDB precisa de um método para adicionar
      } else {
        await OfflineDataService.updateUsuario(savedUserData) // Assumindo que o IndexedDB precisa de um método para atualizar
      }

      // Fechar modal
      setIsModalOpen(false)

      // Recarregar usuários para garantir consistência
      await loadUsers()
      toast.success(modalMode === "create" ? 'Usuário criado com sucesso!' : 'Usuário atualizado com sucesso!')

    } catch (error) {
      console.error("Error saving user:", error)
      toast.error(`Erro ao salvar usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const getStatusBadge = (status: User["status"]) => {
    switch (status) {
      case "ativo":
        return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>
      case "pendente":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>
      case "bloqueado":
        return <Badge className="bg-red-500 hover:bg-red-600">Bloqueado</Badge>
      default:
        return <Badge variant="outline">Indefinido</Badge>
    }
  }

  const isAdmin = currentUserRole === "Administrador"

  useEffect(() => {
    console.log("👤 Papel do usuário atual:", currentUserRole)
    console.log("🔑 É administrador?", isAdmin)
  }, [currentUserRole, isAdmin])

  // Helper function to determine if a user is blocked
  const isUserBlocked = (user: User) => user.status === "bloqueado"

  // Combined action for toggling user status (block/unblock)
  const handleToggleStatus = async (user: User) => {
    if (isUserBlocked(user)) {
      // Unblock user
      await handleApprove(user.id) // Assuming approve unblocks
    } else {
      // Block user
      await handleBlock(user.id)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Desktop */}
      <div className="hidden md:flex justify-between items-center border-b p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerenciamento de usuários do sistema
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden border-b px-3 py-3">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg font-bold">Usuários</h1>
          <Button onClick={handleCreate} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gerenciamento de usuários
        </p>
      </div>

      {/* Filtros */}
      <div className="p-4 md:p-6 border-b">
        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos} className="w-full rounded-md border">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filtros</span>
              </div>
              {filtrosAbertos ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                placeholder="Buscar por nome, email ou perfil..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="col-span-1 md:col-span-2"
              />
              {/* Adicionar mais filtros aqui se necessário */}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Lista de Usuários - Mobile (Cards) */}
      <div className="md:hidden flex-1 overflow-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-sm font-medium text-muted-foreground">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const getAvatarColor = (name: string) => {
              const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
                '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
              ]
              const index = name.charCodeAt(0) % colors.length
              return colors[index]
            }

            const getInitials = (name: string) => {
              return name
                .split(' ')
                .filter(word => word.length > 0)
                .slice(0, 2)
                .map(word => word[0])
                .join('')
                .toUpperCase()
            }

            const avatarColor = getAvatarColor(user.name || 'U')
            const initials = getInitials(user.name || 'US')

            return (
              <div
                key={user.id}
                onClick={() => isAdmin ? handleEdit(user) : null}
                className={`bg-card border rounded-lg p-4 transition-all ${isAdmin ? 'hover:shadow-md cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {user.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge variant={user.role === "Administrador" ? "default" : "secondary"} className="text-[10px] px-2 py-0.5">
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(user.status)}
                  </div>
                  {user.codVendedor && vendedoresMap[user.codVendedor] && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {user.role === 'Gerente' ? 'Gerente:' : 'Vendedor:'}
                      </span>
                      <p className="text-xs font-medium text-foreground">
                        {vendedoresMap[user.codVendedor]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Tabela de Usuários - Desktop */}
      <div className="hidden md:block flex-1 overflow-auto p-6 mt-0">
        <div className="rounded-lg border bg-card overflow-x-auto md:overflow-x-visible">
          <Table className="w-full table-fixed md:table-auto">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-auto md:w-auto">ID</TableHead>
                <TableHead className="font-semibold w-auto md:w-auto">Nome</TableHead>
                <TableHead className="font-semibold w-auto md:w-auto">Email</TableHead>
                <TableHead className="font-semibold w-auto md:w-auto">Função</TableHead>
                <TableHead className="font-semibold w-auto md:w-auto">Vendedor/Gerente</TableHead>
                <TableHead className="font-semibold w-auto md:w-auto">Status</TableHead>
                {isAdmin && (
                  <TableHead className="font-semibold text-right w-auto md:w-auto">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <p className="text-sm font-medium text-muted-foreground">Carregando usuários...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium text-sm text-foreground">{user.id}</TableCell>
                    <TableCell className="font-medium truncate max-w-[200px]">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[250px]">{user.email}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          user.role === "Administrador" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
                          user.role === "Gerente" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                          user.role === "Vendedor" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        )}
                      >
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.codVendedor && vendedoresMap[user.codVendedor]
                        ? vendedoresMap[user.codVendedor]
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{getStatusBadge(user.status)}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          {user.status === "pendente" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(user.id)}
                                className="bg-green-500 hover:bg-green-600 text-white font-medium uppercase text-xs flex items-center gap-1 px-2 py-1 h-9 whitespace-nowrap"
                              >
                                <Check className="w-3 h-3" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleBlock(user.id)}
                                className="bg-red-500 hover:bg-red-600 text-white font-medium uppercase text-xs flex items-center gap-1 px-2 py-1 h-9 whitespace-nowrap"
                              >
                                <X className="w-3 h-3" />
                                Bloquear
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(user)}
                                className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(user)}
                                className={cn(
                                  "border whitespace-nowrap",
                                  isUserBlocked(user)
                                    ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                    : "bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                                )}
                              >
                                {isUserBlocked(user) ? (
                                  <>
                                    <Unlock className="w-3 h-3 mr-1" />
                                    Desbloquear
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3 mr-1" />
                                    Inativar
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      {isAdmin && (
        <UserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          user={selectedUser}
          mode={modalMode}
        />
      )}
    </div>
  )
}