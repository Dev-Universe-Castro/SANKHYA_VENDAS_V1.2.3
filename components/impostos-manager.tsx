"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface RegraImposto {
  ID_REGRA?: number
  NOME: string
  DESCRICAO?: string
  NOTA_MODELO: number
  CODIGO_EMPRESA: number
  FINALIDADE_OPERACAO: number
  CODIGO_NATUREZA: number
  ATIVO?: string
}

export default function ImpostosManager() {
  const [regras, setRegras] = useState<RegraImposto[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<RegraImposto | null>(null)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState<RegraImposto>({
    NOME: '',
    DESCRICAO: '',
    NOTA_MODELO: 0,
    CODIGO_EMPRESA: 0,
    FINALIDADE_OPERACAO: 0,
    CODIGO_NATUREZA: 0
  })

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    setLoading(true)
    try {
      // 1. Carregar do IndexedDB primeiro (IMEDIATO)
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const offline = await OfflineDataService.getRegrasImpostos()
      
      if (offline && offline.length > 0) {
        console.log('✅ Impostos carregados do IndexedDB:', offline.length)
        setRegras([...offline])
      } else {
        console.log('ℹ️ Nenhum dado offline de impostos encontrado, buscando na API...')
      }

      // 2. Buscar da API apenas para atualização (segundo plano ou se vazio)
      const response = await fetch('/api/regras-impostos', {
        cache: 'no-store'
      })
      
      if (response.ok) {
        const data = await response.json()
        const listaRegras = data.regras || []
        
        // Se houver diferença ou se estava vazio, atualiza o estado
        if (listaRegras.length > 0) {
          const regrasFormatadas = listaRegras.map((r: any) => ({
            ID_REGRA: r.ID_REGRA || r.id_regra,
            NOME: r.NOME || r.nome,
            DESCRICAO: r.DESCRICAO || r.descricao,
            NOTA_MODELO: r.NOTA_MODELO || r.nota_modelo,
            CODIGO_EMPRESA: r.CODIGO_EMPRESA || r.codigo_empresa,
            FINALIDADE_OPERACAO: r.FINALIDADE_OPERACAO || r.finalidade_operacao,
            CODIGO_NATUREZA: r.CODIGO_NATUREZA || r.codigo_natureza,
            ATIVO: r.ATIVO || r.ativo || 'S'
          }))

          setRegras([...regrasFormatadas])
          
          // Sincronizar em segundo plano para uso futuro
          OfflineDataService.sincronizarTudo({
            regrasImpostos: {
              count: regrasFormatadas.length,
              data: regrasFormatadas
            }
          })
        }
      }
    } catch (error) {
      console.error('Erro ao carregar regras de impostos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const method = editando ? 'PUT' : 'POST'
      const response = await fetch('/api/regras-impostos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando ? { ...formData, ID_REGRA: editando.ID_REGRA } : formData)
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(editando ? 'Regra atualizada' : 'Regra criada')
        setShowModal(false)
        if (data.syncData?.regrasImpostos) {
          const { OfflineDataService } = await import('@/lib/offline-data-service')
          await OfflineDataService.sincronizarTudo({
            regrasImpostos: { count: data.syncData.regrasImpostos.length, data: data.syncData.regrasImpostos }
          })
        }
        carregarDados()
      }
    } catch (error) {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletar = async (id: number) => {
    if (!confirm('Deseja desativar esta regra?')) return
    setLoading(true)
    try {
      const response = await fetch(`/api/regras-impostos?idRegra=${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Regra desativada')
        carregarDados()
      }
    } catch (error) {
      toast.error('Erro ao deletar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Regras de Impostos</CardTitle>
          <Button onClick={() => { setEditando(null); setFormData({ NOME: '', DESCRICAO: '', NOTA_MODELO: 0, CODIGO_EMPRESA: 0, FINALIDADE_OPERACAO: 0, CODIGO_NATUREZA: 0 }); setShowModal(true); }} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Nova Regra
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Finalidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.map((regra) => (
                <TableRow key={regra.ID_REGRA}>
                  <TableCell>{regra.NOME}</TableCell>
                  <TableCell>{regra.FINALIDADE_OPERACAO}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditando(regra); setFormData(regra); setShowModal(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeletar(regra.ID_REGRA!)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editando ? 'Editar Regra' : 'Nova Regra'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={formData.NOME} onChange={e => setFormData({...formData, NOME: e.target.value})} /></div>
            <div><Label>Finalidade Operação</Label><Input type="number" value={formData.FINALIDADE_OPERACAO} onChange={e => setFormData({...formData, FINALIDADE_OPERACAO: Number(e.target.value)})} /></div>
            <div><Label>Nota Modelo</Label><Input type="number" value={formData.NOTA_MODELO} onChange={e => setFormData({...formData, NOTA_MODELO: Number(e.target.value)})} /></div>
            <div><Label>Código Empresa</Label><Input type="number" value={formData.CODIGO_EMPRESA} onChange={e => setFormData({...formData, CODIGO_EMPRESA: Number(e.target.value)})} /></div>
            <div><Label>Natureza</Label><Input type="number" value={formData.CODIGO_NATUREZA} onChange={e => setFormData({...formData, CODIGO_NATUREZA: Number(e.target.value)})} /></div>
            <div><Label>Descrição</Label><Textarea value={formData.DESCRICAO} onChange={e => setFormData({...formData, DESCRICAO: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
