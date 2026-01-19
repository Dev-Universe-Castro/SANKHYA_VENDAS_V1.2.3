"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface TabelaPrecoConfig {
  CODCONFIG?: number
  NUTAB: number
  CODTAB: string
  DESCRICAO?: string
  ATIVO?: string
}

interface TabelaPreco {
  NUTAB: number
  CODTAB: string
  DTVIGOR: string
  PERCENTUAL: number
}

export default function TabelasPrecosConfigManager() {
  const [configs, setConfigs] = useState<TabelaPrecoConfig[]>([])
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<TabelaPreco[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<TabelaPrecoConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<TabelaPrecoConfig>({
    NUTAB: 0,
    CODTAB: '',
    DESCRICAO: ''
  })

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    setLoading(true)
    try {
      // Carregar dados do IndexedDB primeiro, se disponíveis
      try {
        const { OfflineDataService } = await import('@/lib/offline-data-service');
        const storedConfigs = await OfflineDataService.getTabelasPrecosConfig();
        if (storedConfigs && storedConfigs.length > 0) {
          setConfigs(storedConfigs);
          console.log('✅ Configurações de tabelas de preços carregadas do IndexedDB:', storedConfigs.length);
        } else {
          // Se não houver dados no IndexedDB, buscar da API
          const resConfigs = await fetch('/api/tabelas-precos-config');
          if (resConfigs.ok) {
            const data = await resConfigs.json();
            const fetchedConfigs = data.configs || [];
            setConfigs(fetchedConfigs);
            console.log('✅ Configurações de tabelas de preços carregadas da API:', fetchedConfigs.length);
            // Salvar no IndexedDB
            await OfflineDataService.saveTabelasPrecosConfig(fetchedConfigs);
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro ao carregar configurações do IndexedDB ou API:', e);
      }

      // Carregar tabelas de preços disponíveis do IndexedDB
      try {
        const { OfflineDataService } = await import('@/lib/offline-data-service');
        const storedTabelas = await OfflineDataService.getTabelasPrecos();
        if (storedTabelas && storedTabelas.length > 0) {
          setTabelasDisponiveis(storedTabelas);
          console.log('✅ Tabelas de preços disponíveis carregadas do IndexedDB:', storedTabelas.length);
        } else {
          // Se não houver dados no IndexedDB, buscar da API
          const resTabelas = await fetch('/api/oracle/tabelas-precos');
          if (resTabelas.ok) {
            const data = await resTabelas.json();
            const fetchedTabelas = data.tabelas || [];
            setTabelasDisponiveis(fetchedTabelas);
            console.log('✅ Tabelas de preços disponíveis carregadas da API:', fetchedTabelas.length);
            // Salvar no IndexedDB
            await OfflineDataService.saveTabelasPrecos(fetchedTabelas);
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro ao carregar tabelas disponíveis do IndexedDB ou API:', e);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const abrirModalNovo = () => {
    setFormData({
      NUTAB: 0,
      CODTAB: '',
      DESCRICAO: ''
    })
    setEditando(null)
    setShowModal(true)
  }

  const abrirModalEditar = (config: TabelaPrecoConfig) => {
    console.log('🔍 Abrindo modal para editar configuração:', config)
    setFormData({ ...config })
    setEditando(config)
    setShowModal(true)
  }

  const handleTabelaChange = (nutab: string) => {
    const tabela = tabelasDisponiveis.find(t => String(t.NUTAB) === nutab)
    if (tabela) {
      setFormData({
        ...formData,
        NUTAB: tabela.NUTAB,
        CODTAB: tabela.CODTAB,
        DESCRICAO: `Tabela ${tabela.CODTAB}`
      })
    }
  }

  const handleSubmit = async () => {
    if (!formData.NUTAB || formData.NUTAB === 0) {
      toast.error('Selecione uma tabela de preços')
      return
    }

    setLoading(true)
    try {
      const url = '/api/tabelas-precos-config'
      const method = editando ? 'PUT' : 'POST'

      const payload = editando
        ? { ...formData, CODCONFIG: editando.CODCONFIG }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()

        if (data.success) {
          toast.success(editando ? 'Configuração atualizada' : 'Configuração criada')
          setShowModal(false)

          // Atualizar IndexedDB com os dados retornados
          if (data.syncData?.tabelasPrecosConfig) {
            console.log('🔄 Atualizando IndexedDB com dados sincronizados...')
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            await OfflineDataService.sincronizarTudo({
              tabelasPrecosConfig: {
                count: data.syncData.tabelasPrecosConfig.length,
                data: data.syncData.tabelasPrecosConfig
              }
            })
          }

          carregarDados()
        } else {
          toast.error('Erro ao salvar configuração')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao salvar configuração')
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar configuração')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletar = async (codConfig: number) => {
    console.log('🗑️ Tentando deletar configuração:', codConfig)
    
    if (!confirm('Deseja realmente desativar esta configuração?')) {
      console.log('❌ Deleção cancelada pelo usuário')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/tabelas-precos-config?codConfig=${codConfig}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()

        if (data.success) {
          toast.success('Configuração desativada')

          // Atualizar IndexedDB com os dados retornados
          if (data.syncData?.tabelasPrecosConfig) {
            console.log('🔄 Atualizando IndexedDB com dados sincronizados...')
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            await OfflineDataService.sincronizarTudo({
              tabelasPrecosConfig: {
                count: data.syncData.tabelasPrecosConfig.length,
                data: data.syncData.tabelasPrecosConfig
              }
            })
          }

          carregarDados()
        } else {
          toast.error('Erro ao desativar configuração')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao desativar')
      }
    } catch (error) {
      console.error('Erro ao deletar:', error)
      toast.error('Erro ao desativar configuração')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar tabelas já configuradas
  const tabelasNaoConfiguradas = tabelasDisponiveis.filter(
    t => !configs.some(c => c.NUTAB === t.NUTAB)
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tabelas de Preços</CardTitle>
          <Button onClick={abrirModalNovo} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Tabela
          </Button>
        </CardHeader>
        <CardContent>
          {loading && configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma tabela de preços configurada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>NUTAB</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.CODCONFIG}>
                    <TableCell className="font-medium">
                      {config.CODTAB}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{config.NUTAB}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {config.DESCRICAO || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            console.log('✏️ Abrindo edição para:', config.CODCONFIG);
                            setFormData({ ...config });
                            setEditando(config);
                            setShowModal(true);
                          }}
                          disabled={loading}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            console.log('🗑️ Abrindo exclusão para:', config.CODCONFIG);
                            handleDeletar(config.CODCONFIG!);
                          }}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Configuração' : 'Nova Configuração'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tabela de Preços *</Label>
              <Select
                value={String(formData.NUTAB || '')}
                onValueChange={handleTabelaChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tabela..." />
                </SelectTrigger>
                <SelectContent>
                  {tabelasDisponiveis.map((tabela) => (
                    <SelectItem key={tabela.NUTAB} value={String(tabela.NUTAB)}>
                      {tabela.CODTAB} (NUTAB: {tabela.NUTAB})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.DESCRICAO}
                onChange={(e) => setFormData({ ...formData, DESCRICAO: e.target.value })}
                placeholder="Ex: Tabela de Preços Padrão"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}