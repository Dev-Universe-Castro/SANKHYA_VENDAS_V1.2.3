"use client"

import { useState, useEffect } from "react"
import { Search, Plus, MoreHorizontal, Calendar, DollarSign, ChevronRight, Settings, User as UserIcon, Pencil, Check, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { LeadModal } from "@/components/lead-modal"
import { LeadCreateModal } from "./lead-create-modal"
import { FunilModal } from "@/components/funil-modal"
import { EstagiosModal } from "@/components/estagios-modal"
import { useToast } from "@/hooks/use-toast"
import type { Funil, EstagioFunil } from "@/lib/oracle-funis-service"
import type { User } from "@/lib/types"
import { authService } from "@/lib/auth-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"

// Tipos importados localmente para evitar importar o módulo oracle
export interface Lead {
  CODLEAD: string
  ID_EMPRESA: number
  NOME: string
  DESCRICAO: string
  VALOR: number
  ESTAGIO: string
  CODESTAGIO: string
  CODFUNIL: string
  DATA_VENCIMENTO: string
  TIPO_TAG: string
  COR_TAG: string
  CODPARC?: string
  CODUSUARIO?: number
  ATIVO: string
  DATA_CRIACAO: string
  DATA_ATUALIZACAO: string
  STATUS_LEAD?: 'EM_ANDAMENTO' | 'GANHO' | 'PERDIDO'
  MOTIVO_PERDA?: string
  DATA_CONCLUSAO?: string
}

const TAG_COLORS: Record<string, string> = {
  'Ads Production': 'bg-blue-100 text-blue-700',
  'Landing Page': 'bg-red-100 text-red-700',
  'Dashboard': 'bg-green-100 text-green-700',
  'UX Design': 'bg-pink-100 text-pink-700',
  'Video Production': 'bg-amber-100 text-amber-700',
  'Typeface': 'bg-cyan-100 text-cyan-700',
  'Web Design': 'bg-purple-100 text-purple-700'
}

export default function LeadsKanban() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFunilModalOpen, setIsFunilModalOpen] = useState(false)
  const [isEstagiosModalOpen, setIsEstagiosModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedFunilForEdit, setSelectedFunilForEdit] = useState<Funil | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null)
  const [funis, setFunis] = useState<Funil[]>([])
  const [estagios, setEstagios] = useState<EstagioFunil[]>([])
  const [selectedEstagioTab, setSelectedEstagioTab] = useState<string>("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'EM_ANDAMENTO' | 'GANHO' | 'PERDIDO'>('EM_ANDAMENTO')
  const [dataInicio, setDataInicio] = useState<string>("")
  const [dataFim, setDataFim] = useState<string>("")
  const [parceirosMap, setParceirosMap] = useState<Record<string, string>>({})
  const [usuariosMap, setUsuariosMap] = useState<Record<number, string>>({})
  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
    loadFunis()
  }, [])

  useEffect(() => {
    if (selectedFunil) {
      setIsLoading(true)
      Promise.all([loadEstagios(), loadLeads()])
        .finally(() => {
          requestAnimationFrame(() => {
            setIsLoading(false)
          })
        })
    }
  }, [selectedFunil])

  const loadFunis = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/funis', {
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Falha ao carregar funis')
      }

      const data = await response.json()
      setFunis(data)

      if (data.length === 0) {
        console.warn("⚠️ Nenhum funil retornado da API")
      }
    } catch (error: any) {
      console.error("❌ Erro ao carregar funis:", error)
      toast({
        title: "Erro ao conectar com a API",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadEstagios = async () => {
    if (!selectedFunil) return
    try {
      const response = await fetch(`/api/funis/estagios?codFunil=${selectedFunil.CODFUNIL}`)
      if (!response.ok) throw new Error('Falha ao carregar estágios')
      const data = await response.json()
      setEstagios(data)
      if (data.length > 0 && !selectedEstagioTab) {
        const sortedEstagios = [...data].sort((a, b) => a.ORDEM - b.ORDEM)
        setSelectedEstagioTab(sortedEstagios[0].CODESTAGIO)
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const loadLeads = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({ t: Date.now().toString() })
      if (dataInicio) params.append('dataInicio', dataInicio)
      if (dataFim) params.append('dataFim', dataFim)

      const response = await fetch(`/api/leads?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-store' }
      })

      if (!response.ok) throw new Error('Falha ao carregar leads')
      const data = await response.json()
      setLeads(Array.isArray(data) ? data : [])
      await loadParceirosNomes(data)
      await loadUsuariosNomes(data)
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error)
      toast({ title: "Erro", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  };

  const loadParceirosNomes = async (leadsData: Lead[]) => {
    try {
      const codParcs = [...new Set(leadsData.map(l => l.CODPARC).filter(Boolean))]
      if (codParcs.length === 0) return
      const cachedParceiros = sessionStorage.getItem('cached_parceiros')
      if (cachedParceiros) {
        const parsedCache = JSON.parse(cachedParceiros)
        const allParceiros = parsedCache.parceiros || parsedCache
        const map: Record<string, string> = {}
        codParcs.forEach(codParc => {
          if (codParc) {
            const parceiro = allParceiros.find((p: any) => p.CODPARC === codParc)
            if (parceiro) map[codParc] = parceiro.NOMEPARC
          }
        })
        setParceirosMap(map)
      }
    } catch (error) { console.error(error) }
  }

  const loadUsuariosNomes = async (leadsData: Lead[]) => {
    try {
      const codUsuarios = [...new Set(leadsData.map(l => l.CODUSUARIO).filter(Boolean))]
      if (codUsuarios.length === 0) return
      const response = await fetch('/api/usuarios')
      if (!response.ok) return
      const usuarios = await response.json()
      const map: Record<number, string> = {}
      codUsuarios.forEach(codUsuario => {
        if (codUsuario !== undefined) {
          const usuario = usuarios.find((u: any) => u.id === codUsuario)
          if (usuario) map[codUsuario] = usuario.name
        }
      })
      setUsuariosMap(map)
    } catch (error) { console.error(error) }
  }

  const handleCreate = () => {
    setSelectedLead(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead)
    requestAnimationFrame(() => setIsModalOpen(true))
  }

  const handleSave = async () => {
    try {
      await loadLeads()
      setIsModalOpen(false)
      setIsCreateModalOpen(false)
      toast({ title: "Sucesso", description: "Dados atualizados!" })
    } catch (error) {
      toast({ title: "Erro", variant: "destructive" })
    }
  }

  const handleFunilSaved = async () => {
    setIsFunilModalOpen(false)
    await loadFunis()
  }

  const handleEstagiosSaved = async () => {
    setIsEstagiosModalOpen(false)
    if (selectedFunil) await loadEstagios()
  }

  const handleDragStart = (lead: Lead) => {
    if (lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO') return
    setDraggedLead(lead)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const handleDrop = async (codEstagio: string, nomeEstagio: string) => {
    if (!draggedLead || draggedLead.CODESTAGIO === codEstagio) {
      setDraggedLead(null)
      return
    }
    const leadOriginal = draggedLead
    setDraggedLead(null)
    try {
      const response = await fetch('/api/leads/atualizar-estagio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codLeed: leadOriginal.CODLEAD, novoEstagio: codEstagio })
      })
      if (!response.ok) throw new Error('Erro ao mover')
      setLeads(prev => prev.map(l => l.CODLEAD === leadOriginal.CODLEAD ? { ...l, CODESTAGIO: codEstagio } : l))
      toast({ title: "Sucesso", description: `Movido para ${nomeEstagio}` })
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" })
    }
  }

  const getLeadsByEstagio = (codEstagio: string) => {
    return leads.filter(lead => {
      const matchesSearch = searchTerm === '' || (lead.NOME && lead.NOME.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesFunil = selectedFunil && String(lead.CODFUNIL) === String(selectedFunil.CODFUNIL)
      const matchesEstagio = String(lead.CODESTAGIO) === String(codEstagio)
      const matchesStatus = statusFilter === 'TODOS' || (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) || lead.STATUS_LEAD === statusFilter
      return matchesSearch && matchesFunil && matchesEstagio && matchesStatus
    })
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sem data'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const handleCreateFunil = () => {
    setSelectedFunilForEdit(null)
    setIsFunilModalOpen(true)
  }

  if (!selectedFunil) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Negócios</h1>
            {currentUser?.role === "Administrador" && (
              <Button onClick={handleCreateFunil} className="flex gap-2">
                <Plus className="w-4 h-4" /> Novo Funil
              </Button>
            )}
          </div>
          {isLoading ? <p>Carregando funis...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {funis.map((funil) => (
                <div key={funil.CODFUNIL} className="bg-card p-6 rounded-lg border hover:shadow-md cursor-pointer" onClick={() => setSelectedFunil(funil)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: funil.COR }} />
                      <h3 className="font-semibold">{funil.NOME}</h3>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <FunilModal isOpen={isFunilModalOpen} onClose={() => setIsFunilModalOpen(false)} funil={selectedFunilForEdit} onSave={handleFunilSaved} />
      </>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{selectedFunil.NOME}</h1>
          <Button variant="link" onClick={() => setSelectedFunil(null)} className="p-0 h-auto text-xs">← Voltar para Funis</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64" />
          <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700 text-white"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
          {currentUser?.role === "Administrador" && (
            <Button variant="outline" onClick={() => { setSelectedFunilForEdit(selectedFunil); setIsEstagiosModalOpen(true); }}><Settings className="w-4 h-4" /></Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'lista' ? (
          <div className="border rounded-lg bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="p-3 text-left">Nome</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Status</th></tr>
              </thead>
              <tbody>
                {leads.filter(l => l.CODFUNIL === selectedFunil.CODFUNIL).map(lead => (
                  <tr key={lead.CODLEAD} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => handleEdit(lead)}>
                    <td className="p-3">{lead.NOME}</td>
                    <td className="p-3">{formatCurrency(lead.VALOR)}</td>
                    <td className="p-3">{lead.STATUS_LEAD}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-4 h-full min-h-[600px]">
            {estagios.sort((a, b) => a.ORDEM - b.ORDEM).map((estagio) => {
              const leadsList = getLeadsByEstagio(estagio.CODESTAGIO)
              return (
                <div 
                  key={estagio.CODESTAGIO} 
                  className="flex-1 min-w-[300px] bg-muted/30 rounded-lg p-3"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(estagio.CODESTAGIO, estagio.NOME)}
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estagio.COR }} />
                      {estagio.NOME}
                    </h3>
                    <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border">{leadsList.length}</span>
                  </div>

                  <div className="space-y-3">
                    {leadsList.map((lead) => (
                      <div 
                        key={lead.CODLEAD}
                        draggable
                        onDragStart={() => handleDragStart(lead)}
                        onClick={() => handleEdit(lead)}
                        className="bg-card p-4 rounded-md shadow-sm border border-border cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                      >
                        <p className="font-semibold text-sm mb-1">{lead.NOME}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{lead.DESCRICAO}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm font-bold">{formatCurrency(lead.VALOR)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(lead.DATA_VENCIMENTO)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      <LeadCreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSave={handleSave} funilSelecionado={selectedFunil ? { CODFUNIL: selectedFunil.CODFUNIL, estagios } : undefined} />
      <LeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} lead={selectedLead} onSave={handleSave} funilSelecionado={selectedFunil ? { CODFUNIL: selectedFunil.CODFUNIL, estagios } : undefined} />
      <FunilModal isOpen={isFunilModalOpen} onClose={() => setIsFunilModalOpen(false)} funil={selectedFunilForEdit} onSave={handleFunilSaved} />
      <EstagiosModal isOpen={isEstagiosModalOpen} onClose={() => setIsEstagiosModalOpen(false)} funil={selectedFunilForEdit} onSave={handleEstagiosSaved} />
    </div>
  )
}