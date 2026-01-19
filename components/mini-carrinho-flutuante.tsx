"use client"

import { useState, useEffect } from "react"
import { ShoppingCart, X, ChevronUp, AlertTriangle, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface MiniCarrinhoFlutuanteProps {
  itens: any[]
  total?: number
  formatCurrency?: (value: number) => string
  removerItem?: (index: number) => void
  editarItem?: (index: number) => void
  onRemoverItem?: (index: number) => void
  onEditarItem?: (index: number) => void
  onFinalizarPedido?: () => void
  limiteCredito?: number
  titulosVencidos?: number
  clienteBloqueado?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export function MiniCarrinhoFlutuante({
  itens = [],
  total,
  formatCurrency: formatCurrencyProp,
  removerItem,
  editarItem,
  onRemoverItem,
  onEditarItem,
  onFinalizarPedido,
  limiteCredito = 0,
  titulosVencidos = 0,
  clienteBloqueado = false,
  isOpen,
  onClose
}: MiniCarrinhoFlutuanteProps) {
  const [expandido, setExpandido] = useState(false)
  const [alertas, setAlertas] = useState<string[]>([])

  // Se isOpen está definido, usar como modal controlado
  const isModalMode = isOpen !== undefined
  const isVisible = isModalMode ? isOpen : expandido

  // Log de debug quando componente recebe props
  useEffect(() => {
    console.log('🛒 MiniCarrinhoFlutuante atualizado:', {
      isOpen,
      totalItens: itens?.length,
      itensIsArray: Array.isArray(itens),
      itens,
      total
    })
  }, [isOpen, itens, total])

  const calcularTotal = () => {
    if (total !== undefined && total !== null) return total

    // Garantir que itens é um array
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

  const handleRemoverItem = removerItem || onRemoverItem || (() => {})
  const handleEditarItem = editarItem || onEditarItem || (() => {})

  // Validações em tempo real
  useEffect(() => {
    const novosAlertas: string[] = []

    if (clienteBloqueado) {
      novosAlertas.push('⛔ Cliente BLOQUEADO - não é possível finalizar pedido')
    }

    if (titulosVencidos > 0) {
      novosAlertas.push(`⚠️ ${titulosVencidos} título(s) vencido(s)`)
    }

    const total = calcularTotal()
    if (limiteCredito > 0 && total > limiteCredito) {
      novosAlertas.push(`💳 Limite de crédito excedido! (Disponível: ${formatCurrency(limiteCredito)})`)
    }

    setAlertas(novosAlertas)
  }, [itens, limiteCredito, titulosVencidos, clienteBloqueado])

  // Garantir que itens seja sempre um array
  const itensArray = Array.isArray(itens) ? itens : []
  const totalItens = itensArray.length
  const totalValor = calcularTotal()
  const podeFinalizarPedido = totalItens > 0 && !clienteBloqueado

  console.log('🔍 Renderizando carrinho:', { totalItens, itensArray, isModalMode, isOpen })

  if ((totalItens === 0 && !isModalMode) || !isModalMode) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] p-0">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between bg-green-600 text-white">
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
              <h3 className="font-semibold">Carrinho</h3>
              <p className="text-xs opacity-90">
                {totalItens} {totalItens === 1 ? 'item' : 'itens'}
              </p>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="border-b bg-yellow-50 p-3 space-y-2">
            {alertas.map((alerta, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-2 text-xs",
                  alerta.includes('BLOQUEADO') ? 'text-red-600 font-semibold' : 'text-yellow-800'
                )}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{alerta}</span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de Itens */}
        <ScrollArea className="flex-1 p-4 max-h-[50vh]">
          {totalItens === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Carrinho vazio</p>
              <p className="text-sm text-gray-400 mt-1">Adicione produtos ao carrinho</p>
            </div>
          ) : (
            <div className="space-y-3">
              {itensArray.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">
                        {item.DESCRPROD}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cód: {item.CODPROD}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {item.QTDNEG}x
                        </Badge>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(item.VLRUNIT)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="font-bold text-green-700">
                        {formatCurrency(item.QTDNEG * item.VLRUNIT)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditarItem(index)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 w-7 p-0"
                          title="Editar item"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoverItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                          title="Remover item"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer com Total */}
        <div className="border-t p-4 bg-white space-y-3">
          {/* Resumo do Pedido */}
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

          {/* Valor Total */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Valor Total</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(totalValor)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}