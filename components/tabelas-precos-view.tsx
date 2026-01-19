"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, Table, Package, DollarSign, ArrowLeft, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OfflineDataService } from "@/lib/offline-data-service"
import { toast } from "sonner"

export default function TabelasPrecosView() {
  const [tabelas, setTabelas] = useState<any[]>([])
  const [parceirosMap, setParceirosMap] = useState<Record<number, any[]>>({})
  const [tabelaSelecionada, setTabelaSelecionada] = useState<any>(null)
  const [precos, setPrecos] = useState<any[]>([])
  const [produtosMap, setProdutosMap] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState(true)
  const [buscaTabela, setBuscaTabela] = useState("")
  const [buscaPreco, setBuscaPreco] = useState("")

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  const carregarDadosIniciais = async () => {
    setLoading(true)
    try {
      const [tabelasData, produtosData, parceirosData] = await Promise.all([
        OfflineDataService.getTabelasPrecos(),
        OfflineDataService.getProdutos(),
        OfflineDataService.getParceiros()
      ])
      
      setTabelas(tabelasData)
      
      const pMap: Record<number, any> = {}
      produtosData.forEach((p: any) => {
        const cod = Number(p.CODPROD)
        if (!isNaN(cod)) {
          pMap[cod] = p
        }
      })
      setProdutosMap(pMap)

      // Mapear parceiros por CODTAB
      const parcMap: Record<number, any[]> = {}
      console.log("DEBUG: Iniciando mapeamento. Total parceiros:", parceirosData.length)
      parceirosData.forEach((parc: any) => {
        // Log para os primeiros parceiros para ver a estrutura
        const codTab = Number(parc.CODTAB)
        if (!isNaN(codTab) && codTab > 0) {
          if (!parcMap[codTab]) parcMap[codTab] = []
          parcMap[codTab].push(parc)
        }
      })
      console.log("DEBUG: Mapeamento concluído. Chaves no mapa:", Object.keys(parcMap))
      setParceirosMap(parcMap)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar informações")
    } finally {
      setLoading(false)
    }
  }

  const selecionarTabela = async (tabela: any) => {
    setTabelaSelecionada(tabela)
    setLoading(true)
    try {
      const allPrecos = await OfflineDataService.getExcecoesPrecos()
      const precosFiltrados = allPrecos.filter((p: any) => Number(p.NUTAB) === Number(tabela.NUTAB))
      setPrecos(precosFiltrados)
    } catch (error) {
      console.error("Erro ao carregar preços:", error)
      toast.error("Erro ao carregar preços da tabela")
    } finally {
      setLoading(false)
    }
  }

  const tabelasFiltradas = tabelas.filter(t => 
    String(t.CODTAB).includes(buscaTabela) || 
    (t.DESCRICAO && t.DESCRICAO.toLowerCase().includes(buscaTabela.toLowerCase()))
  )

  const precosFiltrados = precos.filter(p => {
    const produto = produtosMap[Number(p.CODPROD)]
    const termo = buscaPreco.toLowerCase()
    return String(p.CODPROD).includes(termo) || 
           (produto?.DESCRPROD && produto.DESCRPROD.toLowerCase().includes(termo))
  })

  if (tabelaSelecionada) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setTabelaSelecionada(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Tabela: {tabelaSelecionada.CODTAB}</h2>
            <p className="text-muted-foreground">NUTAB: {tabelaSelecionada.NUTAB} | {tabelaSelecionada.DESCRICAO || 'Sem descrição'}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Preços dos Produtos</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produto ou código..." 
                  value={buscaPreco}
                  onChange={(e) => setBuscaPreco(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cód. Prod</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Preço de Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {precosFiltrados.length > 0 ? (
                    precosFiltrados.map((p, idx) => {
                      const produto = produtosMap[Number(p.CODPROD)]
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{p.CODPROD}</TableCell>
                          <TableCell>{produto?.DESCRPROD || 'Produto não encontrado'}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.VLRVENDA)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum preço encontrado nesta tabela.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </UITable>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Tabelas de Preços</h2>
        <p className="text-muted-foreground">Selecione uma tabela para visualizar os preços dos produtos.</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar tabela por código ou nome..." 
            value={buscaTabela}
            onChange={(e) => setBuscaTabela(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tabelasFiltradas.map((tabela) => {
            const parceiros = parceirosMap[Number(tabela.CODTAB)] || []
            const parceiroPrincipal = parceiros[0]
            
            return (
              <Card 
                key={tabela.NUTAB} 
                className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
                onClick={() => selecionarTabela(tabela)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="font-mono">Cód: {tabela.CODTAB}</Badge>
                    <Table className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg mt-2">{tabela.DESCRICAO || `Tabela ${tabela.CODTAB}`}</CardTitle>
                  <CardDescription>NUTAB: {tabela.NUTAB}</CardDescription>
                  <div className="mt-3 space-y-2">
                    {parceiroPrincipal ? (
                      <div className="text-xs font-medium text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-100 shadow-sm">
                        <p className="flex items-center gap-2 mb-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold uppercase tracking-tight">Parceiro Vinculado</span>
                        </p>
                        <p className="text-sm font-bold text-blue-900 leading-tight">
                          {parceiroPrincipal.NOMEPARC}
                        </p>
                        {parceiros.length > 1 && (
                          <p className="text-[10px] text-blue-500 mt-1.5 flex items-center gap-1 italic">
                            + {parceiros.length - 1} outros parceiros nesta tabela
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 opacity-50" />
                        <span>Nenhum parceiro vinculado ao Cód: {tabela.CODTAB}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-primary font-medium">
                    Ver preços <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {tabelasFiltradas.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Nenhuma tabela de preço encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
