        "use client"

        import React, { useState, useEffect } from 'react'
        import { ChevronLeft, ChevronRight, Plus, List, Calendar, Clock, AlertCircle, CheckCircle2, Archive, FileText } from 'lucide-react'
        import { Button } from '@/components/ui/button'
        import { useToast } from '@/hooks/use-toast'
        import {
          Dialog,
          DialogContent,
          DialogHeader,
          DialogTitle,
        } from "@/components/ui/dialog"
        import {
          AlertDialog,
          AlertDialogAction,
          AlertDialogCancel,
          AlertDialogContent,
          AlertDialogDescription,
          AlertDialogFooter,
          AlertDialogHeader,
          AlertDialogTitle,
        } from "@/components/ui/alert-dialog"
        import { Input } from "@/components/ui/input"
        import { Label } from "@/components/ui/label"
        import { Textarea } from "@/components/ui/textarea"
        import {
          Select,
          SelectContent,
          SelectItem,
          SelectTrigger,
          SelectValue,
        } from "@/components/ui/select"
        import { Badge } from '@/components/ui/badge'

        // --- Interfaces ---
        interface CalendarioEvento {
          CODATIVIDADE: string
          CODLEAD?: string
          TIPO: string
          TITULO: string
          DESCRICAO: string
          DATA_INICIO: string
          DATA_FIM: string
          STATUS: 'ATRASADO' | 'EM_ANDAMENTO' | 'REALIZADO' | 'AGUARDANDO'
          COR?: string
          ATIVO?: string
        }

        interface NovaAtividade {
          TIPO: string
          TITULO: string
          DESCRICAO: string
          DATA_INICIO: string
          DATA_FIM: string
          STATUS: 'ATRASADO' | 'EM_ANDAMENTO' | 'REALIZADO' | 'AGUARDANDO'
          COR: string
          CODLEAD?: string
        }

        interface EventoItemProps {
          evento: CalendarioEvento
          onUpdate: () => void
          onUpdateLocal: (evento: CalendarioEvento) => void
          onClose?: () => void
        }

        // --- Componente de Item de Evento (Card Individual) ---
        function EventoItem({ evento, onUpdate, onUpdateLocal, onClose }: EventoItemProps) {
          const [editando, setEditando] = useState(false)
          const [titulo, setTitulo] = useState(evento.TITULO)
          const [descricao, setDescricao] = useState(evento.DESCRICAO)
          const [tipo, setTipo] = useState(evento.TIPO)
          const [cor, setCor] = useState(evento.COR || '#22C55E')
          const [dataInicio, setDataInicio] = useState(evento.DATA_INICIO.slice(0, 16))
          const [dataFim, setDataFim] = useState(evento.DATA_FIM.slice(0, 16))
          const [salvando, setSalvando] = useState(false)
          const [concluindo, setConcluindo] = useState(false)
          const [mostrarAlertaInativar, setMostrarAlertaInativar] = useState(false)
          const [inativando, setInativando] = useState(false)
          const { toast } = useToast()

          const marcarStatus = async (novoStatus: string) => {
            try {
              setConcluindo(true)
              const response = await fetch('/api/leads/atividades/atualizar-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CODATIVIDADE: evento.CODATIVIDADE, STATUS: novoStatus })
              })
              if (!response.ok) throw new Error('Erro ao atualizar status')
              onUpdateLocal({ ...evento, STATUS: novoStatus as any })
              await onUpdate()
              toast({ title: "Sucesso", description: `Status alterado para ${novoStatus}` })
            } catch (error: any) {
              toast({ title: "Erro", description: error.message, variant: "destructive" })
            } finally {
              setConcluindo(false)
            }
          }

          const salvarEdicao = async () => {
            try {
              setSalvando(true)
              const response = await fetch('/api/leads/atividades/atualizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  CODATIVIDADE: evento.CODATIVIDADE,
                  TITULO: titulo,
                  DESCRICAO: descricao,
                  TIPO: tipo,
                  COR: cor,
                  DATA_INICIO: dataInicio + ':00',
                  DATA_FIM: dataFim + ':00'
                })
              })
              if (!response.ok) throw new Error('Erro ao atualizar')
              setEditando(false)
              await onUpdate()
              toast({ title: "Atividade atualizada" })
            } catch (error: any) {
              toast({ title: "Erro", description: error.message, variant: "destructive" })
            } finally {
              setSalvando(false)
            }
          }

          const inativar = async () => {
            try {
              setInativando(true)
              const response = await fetch('/api/leads/atividades/atualizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CODATIVIDADE: evento.CODATIVIDADE, ATIVO: 'N' })
              })
              if (!response.ok) throw new Error('Erro ao inativar')
              setMostrarAlertaInativar(false)
              if (onClose) onClose()
              await onUpdate()
              toast({ title: "Atividade removida" })
            } catch (error: any) {
              toast({ title: "Erro", description: error.message, variant: "destructive" })
            } finally {
              setInativando(false)
            }
          }

          return (
            <div className="relative pl-6 sm:pl-12 mb-4 group">
              <div className="absolute left-1 sm:left-2.5 top-2 w-2 h-2 sm:w-3 sm:h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: cor }} />
              <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {evento.STATUS === 'REALIZADO' ? <CheckCircle2 className="text-green-600 w-4 h-4" /> : <Clock className="text-blue-600 w-4 h-4" />}
                      <h3 className="font-semibold text-sm sm:text-base truncate">{evento.TITULO}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{evento.DESCRICAO}</p>
                  </div>
                  <Badge variant={evento.STATUS === 'REALIZADO' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                    {evento.STATUS}
                  </Badge>
                </div>

                {editando ? (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" />
                    <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={salvarEdicao} disabled={salvando}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => marcarStatus(evento.STATUS === 'REALIZADO' ? 'AGUARDANDO' : 'REALIZADO')}>
                      {evento.STATUS === 'REALIZADO' ? 'Reabrir' : 'Concluir'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditando(true)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setMostrarAlertaInativar(true)}>Inativar</Button>
                  </div>
                )}
              </div>

              <AlertDialog open={mostrarAlertaInativar} onOpenChange={setMostrarAlertaInativar}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deseja inativar esta tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>Ela poderá ser recuperada na lista de inativos.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Não</AlertDialogCancel>
                    <AlertDialogAction onClick={inativar} className="bg-red-600">Sim, inativar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )
        }

        // --- Componente Principal ---
        export default function CalendarioView() {
          const [currentDate, setCurrentDate] = useState(new Date())
          const [eventos, setEventos] = useState<CalendarioEvento[]>([])
          const [loading, setLoading] = useState(true)
          const [visualizacao, setVisualizacao] = useState<'calendario' | 'lista'>('calendario')

          // Estados de Modais
          const [modalDiaAberto, setModalDiaAberto] = useState(false)
          const [modalNovaAtividadeAberto, setModalNovaAtividadeAberto] = useState(false)
          const [modalInativosAberto, setModalInativosAberto] = useState(false)

          // Estados de Dados Selecionados
          const [eventosDoDia, setEventosDoDia] = useState<CalendarioEvento[]>([])
          const [eventosInativos, setEventosInativos] = useState<CalendarioEvento[]>([])
          const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)

          // Estados de Filtro e Criação
          const [dataInicioFiltro, setDataInicioFiltro] = useState("")
          const [dataFimFiltro, setDataFimFiltro] = useState("")
          const [salvandoAtividade, setSalvandoAtividade] = useState(false)
          const [reativando, setReativando] = useState<string | null>(null)
          const [novaAtividade, setNovaAtividade] = useState<NovaAtividade>({
            TIPO: 'EMAIL', TITULO: '', DESCRICAO: '', DATA_INICIO: new Date().toISOString().split('T')[0], DATA_FIM: new Date().toISOString().split('T')[0], STATUS: 'AGUARDANDO', COR: '#22C55E'
          })

          const { toast } = useToast()
          const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

          // --- Funções de API ---
          const loadEventos = async () => {
            try {
              setLoading(true)
              const params = new URLSearchParams()
              if (dataInicioFiltro) params.append('dataInicio', dataInicioFiltro)
              if (dataFimFiltro) params.append('dataFim', dataFimFiltro)

              const res = await fetch(`/api/leads/eventos?${params.toString()}&t=${Date.now()}`)
              const data = await res.json()
              setEventos(data.filter((e: any) => e.ATIVO !== 'N'))

              const resInativos = await fetch(`/api/leads/eventos/inativos?t=${Date.now()}`)
              const inativos = await resInativos.json()
              setEventosInativos(inativos)
            } catch (e) {
              console.error(e)
            } finally {
              setLoading(false)
            }
          }

          useEffect(() => { loadEventos() }, [currentDate])

          // --- Lógica de Renderização do Calendário ---
          const getDaysInMonth = (date: Date) => {
            const year = date.getFullYear(), month = date.getMonth()
            const firstDay = new Date(year, month, 1).getDay()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const days = []
            for (let i = 0; i < firstDay; i++) days.push({ day: '', isCurrentMonth: false, date: new Date() })
            for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) })
            return days
          }

          const getEventosForDay = (date: Date) => {
            return eventos.filter(e => new Date(e.DATA_INICIO).toDateString() === date.toDateString())
          }

          const handleSalvarNova = async () => {
            if (!novaAtividade.TITULO) return toast({ title: "Título obrigatório", variant: "destructive" })
            try {
              setSalvandoAtividade(true)
              const res = await fetch('/api/leads/atividades/criar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novaAtividade)
              })
              if (res.ok) {
                setModalNovaAtividadeAberto(false)
                loadEventos()
                toast({ title: "Tarefa criada com sucesso!" })
              }
            } finally {
              setSalvandoAtividade(false)
            }
          }

          const handleReativar = async (id: string) => {
            setReativando(id)
            await fetch('/api/leads/atividades/atualizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ CODATIVIDADE: id, ATIVO: 'S' }) })
            setReativando(null)
            loadEventos()
            toast({ title: "Tarefa reativada" })
          }

          if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>

          return (
            <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
              {/* Header Desktop */}
              <div className="bg-white border-b p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Minhas Tarefas</h1>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant={visualizacao === 'calendario' ? 'default' : 'outline'} onClick={() => setVisualizacao('calendario')}><Calendar className="w-4 h-4 mr-2"/>Calendário</Button>
                    <Button size="sm" variant={visualizacao === 'lista' ? 'default' : 'outline'} onClick={() => setVisualizacao('lista')}><List className="w-4 h-4 mr-2"/>Lista</Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setModalInativosAberto(true)}><Archive className="w-4 h-4 mr-2"/>Arquivados ({eventosInativos.length})</Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setModalNovaAtividadeAberto(true)}><Plus className="w-4 h-4 mr-2"/>Nova Tarefa</Button>
                </div>
              </div>

              {/* Conteúdo com scroll independente */}
              <div className="flex-1 overflow-auto p-4 md:p-6">

                {/* FILTROS DA LISTA */}
                {visualizacao === 'lista' && (
                  <div className="mb-6 flex flex-wrap gap-3 bg-white p-4 rounded-lg border shadow-sm">
                     <div className="flex items-center gap-2">
                        <Label className="text-xs">De:</Label>
                        <Input type="date" className="h-8 w-36 text-xs" value={dataInicioFiltro} onChange={e => setDataInicioFiltro(e.target.value)} />
                     </div>
                     <div className="flex items-center gap-2">
                        <Label className="text-xs">Até:</Label>
                        <Input type="date" className="h-8 w-36 text-xs" value={dataFimFiltro} onChange={e => setDataFimFiltro(e.target.value)} />
                     </div>
                     <Button size="sm" variant="secondary" onClick={loadEventos}>Filtrar</Button>
                     {(dataInicioFiltro || dataFimFiltro) && <Button size="sm" variant="ghost" onClick={() => {setDataInicioFiltro(""); setDataFimFiltro(""); loadEventos()}}>Limpar</Button>}
                  </div>
                )}

                {/* RENDERIZAÇÃO CONDICIONAL */}
                {visualizacao === 'lista' ? (
                  <div className="max-w-4xl mx-auto space-y-2">
                    {eventos.length === 0 ? (
                       <div className="text-center py-20 bg-white rounded-xl border border-dashed">
                          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                          <p className="text-slate-500">Nenhuma tarefa encontrada para este período.</p>
                       </div>
                    ) : (
                      eventos.map(e => <EventoItem key={e.CODATIVIDADE} evento={e} onUpdate={loadEventos} onUpdateLocal={() => {}} />)
                    )}
                  </div>
                ) : (
                  /* CALENDÁRIO GRID */
                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h2 className="text-lg font-bold text-slate-700 capitalize">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="h-4 w-4"/></Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 text-center border-b bg-slate-50/50">
                      {diasSemana.map(d => <div key={d} className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 flex-1">
                      {getDaysInMonth(currentDate).map((day, i) => (
                        <div key={i} className={`min-h-[100px] p-1 border-r border-b hover:bg-slate-50 transition-colors cursor-pointer ${!day.isCurrentMonth && 'bg-slate-50/30'}`} 
                          onClick={() => day.isCurrentMonth && (setDataSelecionada(day.date), setEventosDoDia(getEventosForDay(day.date)), setModalDiaAberto(true))}>
                          <span className={`text-xs font-semibold p-1 ${day.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>{day.day}</span>
                          <div className="mt-1 space-y-1">
                            {day.isCurrentMonth && getEventosForDay(day.date).slice(0, 3).map(ev => (
                              <div key={ev.CODATIVIDADE} className="text-[9px] truncate px-1.5 py-0.5 rounded-sm text-white font-medium" style={{ backgroundColor: ev.COR }}>{ev.TITULO}</div>
                            ))}
                            {day.isCurrentMonth && getEventosForDay(day.date).length > 3 && <p className="text-[8px] text-slate-400 font-bold ml-1">+{getEventosForDay(day.date).length - 3} mais</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MODAIS */}
              <Dialog open={modalDiaAberto} onOpenChange={setModalDiaAberto}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Tarefas de {dataSelecionada?.toLocaleDateString()}</DialogTitle></DialogHeader>
                  <div className="mt-6">
                    {eventosDoDia.length === 0 ? <p className="text-center py-10 text-slate-500">Nada agendado para hoje.</p> :
                      eventosDoDia.map(e => <EventoItem key={e.CODATIVIDADE} evento={e} onUpdate={loadEventos} onUpdateLocal={() => {}} onClose={() => setModalDiaAberto(false)} />)}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={modalNovaAtividadeAberto} onOpenChange={setModalNovaAtividadeAberto}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Agendar Nova Atividade</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>Título</Label><Input placeholder="Ex: Ligar para cliente X" onChange={e => setNovaAtividade({...novaAtividade, TITULO: e.target.value})} /></div>
                    <div><Label>Descrição</Label><Textarea placeholder="Detalhes da atividade..." onChange={e => setNovaAtividade({...novaAtividade, DESCRICAO: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><Label>Data</Label><Input type="date" value={novaAtividade.DATA_INICIO} onChange={e => setNovaAtividade({...novaAtividade, DATA_INICIO: e.target.value, DATA_FIM: e.target.value})} /></div>
                       <div><Label>Tipo</Label>
                          <Select onValueChange={(val) => setNovaAtividade({...novaAtividade, TIPO: val})}>
                            <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMAIL">E-mail</SelectItem>
                              <SelectItem value="LIGACAO">Ligação</SelectItem>
                              <SelectItem value="REUNIAO">Reunião</SelectItem>
                              <SelectItem value="VISITA">Visita</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                    </div>
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleSalvarNova} disabled={salvandoAtividade}>
                       {salvandoAtividade ? "Salvando..." : "Criar Tarefa"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={modalInativosAberto} onOpenChange={setModalInativosAberto}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader><DialogTitle>Tarefas Arquivadas</DialogTitle></DialogHeader>
                  <div className="space-y-2 mt-4 max-h-[60vh] overflow-auto pr-2">
                    {eventosInativos.length === 0 ? <p className="text-center py-10">Nenhuma tarefa arquivada.</p> : 
                      eventosInativos.map(e => (
                        <div key={e.CODATIVIDADE} className="p-3 border rounded-lg flex justify-between items-center bg-slate-50">
                          <div className="min-w-0 pr-4">
                            <p className="font-semibold text-sm truncate">{e.TITULO}</p>
                            <p className="text-[10px] text-slate-500">{new Date(e.DATA_INICIO).toLocaleDateString()}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleReativar(e.CODATIVIDADE)} disabled={reativando === e.CODATIVIDADE}>Reativar</Button>
                        </div>
                      ))}
                  </div>
                </DialogContent>
              </Dialog>

              <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
              `}</style>
            </div>
          )
        }