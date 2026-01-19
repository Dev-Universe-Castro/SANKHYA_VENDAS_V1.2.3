"use client"

import { useState, useEffect } from "react"
import { X, Table, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export interface TabelaPrecoPreco {
  NUTAB: number
  CODTAB: string
  DESCRICAO: string
  PRECO: number
}

interface EscolherPrecoTabelaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: any
  tabelas: any[]
  onSelect: (tabela: any) => void
}

export function EscolherPrecoTabelaModal({
  open,
  onOpenChange,
  produto,
  tabelas,
  onSelect
}: EscolherPrecoTabelaModalProps) {
  const [search, setSearch] = useState("")
  const [precos, setPrecos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && produto) {
      carregarPrecos()
    }
  }, [open, produto])

  const carregarPrecos = async () => {
    if (!produto) return
    setLoading(true)
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      
      const precosCalculados = await Promise.all(
        tabelas.map(async (tab) => {
          // Usar estritamente o NUTAB para busca offline
          const nutabParaBusca = tab.NUTAB || tab.nutab;
          const precosOffline = await OfflineDataService.getPrecos(
            Number(produto.CODPROD),
            nutabParaBusca ? Number(nutabParaBusca) : undefined
          )

          let preco = 0
          if (precosOffline && precosOffline.length > 0) {
            const itemPreco = precosOffline[0]
            const valorRaw = itemPreco.VLRVENDA !== undefined ? itemPreco.VLRVENDA : 
                             itemPreco.vlrVenda !== undefined ? itemPreco.vlrVenda : 
                             itemPreco.PRECO;

            if (valorRaw != null) {
              preco = typeof valorRaw === 'string' 
                ? parseFloat(valorRaw.replace(',', '.')) 
                : parseFloat(valorRaw)
            }
          }

          // Se não encontrou offline e estiver online, tentar API (fallback)
          if (preco === 0 && navigator.onLine) {
            try {
              const response = await fetch(`/api/oracle/preco?codProd=${produto.CODPROD}&tabelaPreco=${encodeURIComponent(tab.CODTAB)}`)
              if (response.ok) {
                const data = await response.json()
                preco = data.preco || 0
              }
            } catch (e) {
              console.warn(`Erro no fallback de API para CODTAB ${tab.CODTAB}:`, e)
            }
          }

          return {
            ...tab,
            PRECO: isNaN(preco) ? 0 : preco
          }
        })
      )
      setPrecos(precosCalculados)
    } catch (error) {
      console.error("Erro ao carregar preços das tabelas:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPrecos = precos.filter(p => 
    p.DESCRICAO.toLowerCase().includes(search.toLowerCase()) ||
    p.CODTAB.toString().includes(search)
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full p-4 sm:p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-1">
          <DialogTitle>Escolher Preço de Tabela</DialogTitle>
          {produto && (
            <div className="mt-2">
              <h3 className="font-semibold text-base sm:text-lg leading-tight">{produto.DESCRPROD}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Cód: {produto.CODPROD}</p>
            </div>
          )}
        </DialogHeader>

        <div className="relative my-3 sm:my-4 px-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar tabela..." 
            className="pl-10 h-10 sm:h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : filteredPrecos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma tabela encontrada.
              </div>
            ) : (
              <div className="min-w-full inline-block align-middle">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left border-b pb-2">
                      <th className="font-medium py-2">Tabela</th>
                      <th className="font-medium py-2 text-right">Preço</th>
                      <th className="font-medium py-2 w-20 sm:w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrecos.map((p) => (
                      <tr key={p.CODTAB} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-2 sm:py-3 pr-2">
                          <div className="font-medium line-clamp-1 sm:line-clamp-none">{p.DESCRICAO}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">
                            {p.CODTAB}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 text-right whitespace-nowrap">
                          {p.PRECO > 0 ? (
                            <span className="font-semibold">{formatCurrency(p.PRECO)}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px] sm:text-xs">Sem preço</span>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 text-right">
                          <Button 
                            size="sm" 
                            variant={p.PRECO > 0 ? "outline" : "ghost"}
                            disabled={p.PRECO === 0}
                            onClick={() => onSelect(p)}
                            className="h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
                          >
                            {p.PRECO > 0 ? "Selecionar" : "Indisp."}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
