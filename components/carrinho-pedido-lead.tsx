"use client"

import { useState, useEffect } from "react"
import { ShoppingCart, X, Edit, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfiguracaoProdutoModal, ConfiguracaoProduto, UnidadeVolume } from "@/components/configuracao-produto-modal"
import { OfflineDataService } from "@/lib/offline-data-service"
import { toast } from "sonner"

interface CarrinhoPedidoLeadProps {
  itens: any[]
  total?: number
  formatCurrency?: (value: number) => string
  removerItem: (index: number) => void
  editarItem: (index: number, updatedItem: any) => void
  onCancelar: () => void
  onCriarPedido: () => void
  isOpen: boolean
  onClose: () => void
  loading?: boolean
}

export function CarrinhoPedidoLead({
  itens = [],
  total,
  formatCurrency: formatCurrencyProp,
  removerItem,
  editarItem,
  onCancelar,
  onCriarPedido,
  isOpen,
  onClose,
  loading = false
}: CarrinhoPedidoLeadProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<any>(null)
  const [indexEditando, setIndexEditando] = useState<number | null>(null)
  const [unidadesProduto, setUnidadesProduto] = useState<UnidadeVolume[]>([])
  const [configInicial, setConfigInicial] = useState<Partial<ConfiguracaoProduto>>({})
  const [loadingEdit, setLoadingEdit] = useState(false)

  const calcularTotal = () => {
    if (total !== undefined && total !== null) return total

    const itensArray = Array.isArray(itens) ? itens : []
    if (itensArray.length === 0) return 0

    return itensArray.reduce((acc, item) => {
      const vlrUnit = Number(item.VLRUNIT) || 0
      const qtd = Number(item.QTDNEG) || 0
      const percdesc = Number(item.PERCDESC) || 0
      const vlrDesc = (vlrUnit * qtd * percdesc) / 100
      return acc + (vlrUnit * qtd - vlrDesc)
    }, 0)
  }

  const formatCurrency = formatCurrencyProp || ((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  })

  const itensArray = Array.isArray(itens) ? itens : []
  const totalItens = itensArray.length
  const totalValor = calcularTotal()

  const handleEditarClick = async (item: any, index: number) => {
    setLoadingEdit(true)
    try {
      const volumes = await OfflineDataService.getVolumes(item.CODPROD)
      const unidades: UnidadeVolume[] = [
        {
          CODVOL: item.UNIDADE || item.CODVOL || 'UN',
          DESCRICAO: `${item.UNIDADE || item.CODVOL || 'UN'} - Unidade Padrão`,
          QUANTIDADE: 1,
          isPadrao: true
        },
        ...volumes.filter((v: any) => v.ATIVO === 'S').map((v: any) => ({
          CODVOL: v.CODVOL,
          DESCRICAO: v.DESCRDANFE || v.CODVOL,
          QUANTIDADE: v.QUANTIDADE || 1,
          isPadrao: false
        }))
      ]

      setUnidadesProduto(unidades)
      setProdutoEditando(item)
      setIndexEditando(index)
      setConfigInicial({
        quantidade: Number(item.QTDNEG) || 1,
        desconto: Number(item.PERCDESC) || 0,
        unidade: item.CODVOL || item.UNIDADE || 'UN',
        preco: Number(item.VLRUNIT) || 0
      })
      setShowEditModal(true)
    } catch (error) {
      console.error('Erro ao carregar dados para edição:', error)
      toast.error('Erro ao carregar dados do produto')
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleConfirmEdit = (config: ConfiguracaoProduto) => {
    if (indexEditando !== null && produtoEditando) {
      const vlrSubtotal = config.preco * config.quantidade
      const vlrDesconto = (vlrSubtotal * config.desconto) / 100
      const vlrTotal = vlrSubtotal - vlrDesconto

      const updatedItem = {
        ...produtoEditando,
        CODVOL: config.unidade,
        UNIDADE: config.unidade,
        VLRUNIT: config.preco,
        QTDNEG: config.quantidade,
        PERCDESC: config.desconto,
        VLRDESC: vlrDesconto,
        VLRTOT: vlrTotal
      }
      editarItem(indexEditando, updatedItem)
      toast.success("Item atualizado com sucesso")
    }
    setShowEditModal(false)
    setProdutoEditando(null)
    setIndexEditando(null)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setProdutoEditando(null)
    setIndexEditando(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-full h-full md:max-w-md md:max-h-[90vh] p-0 flex flex-col m-0 rounded-none md:rounded-lg">
        {/* Header */}
        <DialogHeader className="border-b p-4 flex-shrink-0 bg-gradient-to-r from-green-600 to-green-500 text-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {totalItens > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center">
                  {totalItens}
                </Badge>
              )}
            </div>
            <div>
              <DialogTitle className="text-white">Carrinho</DialogTitle>
              <p className="text-xs opacity-90">
                {totalItens} {totalItens === 1 ? 'item' : 'itens'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Lista de Itens */}
        <ScrollArea className="flex-1 p-4 md:max-h-[50vh]">
          {totalItens === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Carrinho vazio</p>
              <p className="text-sm text-gray-400 mt-1">Adicione produtos ao carrinho</p>
            </div>
          ) : (
            <div className="space-y-3">
              {itensArray.map((item, index) => (
                <div key={index} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <div className="flex gap-3">
                    {/* Imagem do Produto */}
                    <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border">
                      <img
                        src={`/api/sankhya/produtos/imagem?codProd=${item.CODPROD}`}
                        alt={item.DESCRPROD}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `<div class="text-2xl text-gray-300 font-bold">${item.DESCRPROD?.charAt(0) || 'P'}</div>`
                          }
                        }}
                      />
                    </div>

                    {/* Informações do Produto */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-sm line-clamp-2 text-gray-900">
                          {item.DESCRPROD}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.MARCA || 'Sem marca'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Qtd: {item.QTDNEG} un
                        </p>
                        <p className="text-base font-bold text-green-600 mt-1">
                          {formatCurrency(item.VLRUNIT)}
                        </p>
                      </div>

                      {/* Controles */}
                      <div className="flex items-center justify-end gap-2 mt-2">
                        {/* Botão Editar */}
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleEditarClick(item, index)}
                          className="h-8 w-8 border-blue-300 text-blue-600 hover:bg-blue-50"
                          title="Editar item"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        {/* Botão Remover */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removerItem(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                          title="Remover item"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer com Total e Botões */}
        <div className="border-t p-4 bg-white space-y-3 flex-shrink-0">
          {totalItens > 0 && (
            <div className="space-y-2 pb-2 border-b">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total de Itens:</span>
                <span className="font-semibold">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Quantidade Total:</span>
                <span className="font-semibold">
                  {itensArray.reduce((sum, item) => sum + (Number(item.QTDNEG) || 0), 0)} unidades
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Valor Total</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(totalValor)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancelar}
              className="w-full"
              disabled={loading}
            >
              Voltar
            </Button>
          </div>
        </div>
      </DialogContent>
      {produtoEditando && (
        <ConfiguracaoProdutoModal
          open={showEditModal}
          onOpenChange={handleCloseEditModal}
          produto={produtoEditando}
          unidades={unidadesProduto}
          configInicial={configInicial}
          onConfirmar={handleConfirmEdit}
          modo="editar"
          disabled={loadingEdit}
        />
      )}
    </Dialog>
  )
}