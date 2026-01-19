"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { OfflineDataService } from '@/lib/offline-data-service'

interface EstoqueModalProps {
  isOpen: boolean
  onClose: () => void
  product: any
  onConfirm?: (product: any, preco: number, quantidade: number) => void
  estoqueTotal?: number
  preco?: number
  quantidadeInicial?: number // Quantidade inicial ao editar
  viewMode?: boolean // Modo de visualização (somente leitura)
}

export function EstoqueModal({ isOpen, onClose, product, onConfirm, estoqueTotal: estoqueInicial, preco: precoInicial, quantidadeInicial, viewMode = false }: EstoqueModalProps) {
  const [estoqueTotal, setEstoqueTotal] = useState<number>(estoqueInicial || 0)
  const [preco, setPreco] = useState<number>(precoInicial || 0)
  const [quantidade, setQuantidade] = useState<number>(quantidadeInicial || 1)
  const [controle, setControle] = useState<string>("007")
  const [codigoLocalEstoque, setCodigoLocalEstoque] = useState<number>(700)
  const [loading, setLoading] = useState(false)
  const [estoque, setEstoque] = useState<any[]>([])


  useEffect(() => {
    if (isOpen && product) {
      setEstoqueTotal(estoqueInicial || 0)
      setPreco(precoInicial || 0)
      setQuantidade(quantidadeInicial || 1)
      carregarEstoque()
    }
  }, [isOpen, product, estoqueInicial, precoInicial, quantidadeInicial])

  const carregarEstoque = async () => {
    if (!product) return

    try {
      setLoading(true)

      // Modo offline - buscar do IndexedDB
      if (!navigator.onLine) {
        console.log('📱 Modo offline - carregando estoque do cache local')
        const estoqueOffline = await OfflineDataService.getEstoque(product.CODPROD)
        setEstoque(estoqueOffline)
        return
      }

      // Modo online - buscar da API
      const response = await fetch(`/api/sankhya/produtos/estoque?codProd=${product.CODPROD}`)
      if (!response.ok) throw new Error('Erro ao carregar estoque')

      const data = await response.json()
      setEstoque(data.estoque || [])
    } catch (error) {
      console.error('Erro ao carregar estoque:', error)

      // Fallback para dados offline
      const estoqueOffline = await OfflineDataService.getEstoque(product.CODPROD)
      if (estoqueOffline.length > 0) {
        setEstoque(estoqueOffline)
        toast.warning('Usando estoque do cache local')
      } else {
        toast.error('Erro ao carregar estoque')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (quantidade <= 0) {
      alert('A quantidade deve ser maior que zero')
      return
    }
    if (onConfirm) {
      onConfirm(product, preco, quantidade, undefined, controle, codigoLocalEstoque)
    }
    // Não chamar onClose aqui - deixar o componente pai controlar
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calcularTotal = () => {
    return preco * quantidade
  }

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 flex flex-col h-full">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{viewMode ? 'Detalhes do Produto' : 'Adicionar Produto'}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{product.CODPROD} - {product.DESCRPROD}</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {/* Informações do Produto */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Marca</Label>
                <p className="font-medium">{product.MARCA || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unidade</Label>
                <p className="font-medium">{product.UNIDADE || 'MM'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estoque Total</Label>
                <p className="font-medium text-green-600">
                  {estoqueTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Preço Unit.</Label>
                <p className="font-medium text-green-700">
                  {formatCurrency(preco)}
                </p>
              </div>
            </div>

            {/* Quantidade - apenas se não for modo de visualização */}
            {!viewMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    step="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    placeholder="Digite a quantidade"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigoLocalEstoque">Local Estoque *</Label>
                    <Input
                      id="codigoLocalEstoque"
                      type="number"
                      value={codigoLocalEstoque}
                      onChange={(e) => setCodigoLocalEstoque(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="controle">Controle (Lote/Série) *</Label>
                    <Input
                      id="controle"
                      value={controle}
                      onChange={(e) => setControle(e.target.value)}
                    />
                  </div>
                </div>

                {/* Total */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <Label className="text-sm text-muted-foreground">Total</Label>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(calcularTotal())}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quantidade} × {formatCurrency(preco)}
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-auto flex gap-2">
            {viewMode ? (
              <Button onClick={onClose} className="w-full">
                Fechar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="bg-green-600 hover:bg-green-700 flex-1"
                  disabled={quantidade <= 0}
                >
                  ADICIONAR PRODUTO
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}