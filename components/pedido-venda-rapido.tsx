"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PedidoVendaFromLead from "@/components/pedido-venda-from-lead"
import { useToast } from "@/components/ui/use-toast"
import { PedidoSyncService } from "@/lib/pedido-sync"
import { useState, useEffect, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CatalogoProdutosPedido } from "@/components/catalogo-produtos-pedido"
import { CarrinhoPedidoRapido } from "@/components/carrinho-pedido-rapido"
import { Package, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PedidoVendaRapidoProps {
  isOpen: boolean
  onClose: () => void
  pedidoBase?: any
}

interface TipoPedido {
  CODTIPOPEDIDO: number
  NOME: string
  DESCRICAO?: string
  CODTIPOPER: number
  MODELO_NOTA: number
  TIPMOV: string
  CODTIPVENDA: number
  COR?: string
}

export default function PedidoVendaRapido({ isOpen, onClose, pedidoBase }: PedidoVendaRapidoProps) {
  const { toast } = useToast()

  // Obter CODVEND do cookie IMEDIATAMENTE na inicialização
  const getCodVendFromCookie = () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr))
          return user.codVendedor ? String(user.codVendedor) : "0"
        } catch (parseError) {
          console.warn('⚠️ Cookie de usuário malformado, ignorando...', parseError)
          return "0"
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao processar cookie de usuário:', error)
    }
    return "0"
  }

  const [codVendUsuario, setCodVendUsuario] = useState(() => getCodVendFromCookie())
  const [pedido, setPedido] = useState<any>(null)
  const [tiposPedido, setTiposPedido] = useState<TipoPedido[]>([])
  const [tipoPedidoSelecionado, setTipoPedidoSelecionado] = useState<string>("")
  const [vendedores, setVendedores] = useState<any[]>([])
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [nomeVendedor, setNomeVendedor] = useState<string>('')
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const salvarPedidoRef = useRef<(() => Promise<boolean>) | null>(null)
  const [condicaoComercialManual, setCondicaoComercialManual] = useState<string | null>(null)
  const [showCatalogoModal, setShowCatalogoModal] = useState(false)
  
  // Estados para impostos
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [loadingImpostos, setLoadingImpostos] = useState<boolean>(false)
  const [impostosItens, setImpostosItens] = useState<any[]>([])

  // Helper para obter iniciais do tipo de pedido
  const getTipoPedidoInitials = (nome: string) => {
    if (!nome) return '??'
    const words = nome.trim().split(' ').filter(word => word.length > 0)
    if (words.length === 0) return '??'
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const calcularTotal = (item: any) => {
    const vlrUnit = Number(item.VLRUNIT) || 0
    const qtd = Number(item.QTDNEG) || 0
    const percdesc = Number(item.PERCDESC) || 0
    const vlrDesc = (vlrUnit * qtd * percdesc) / 100
    return vlrUnit * qtd - vlrDesc
  }

  const calcularTotalPedido = () => {
    if (!pedido?.itens || !Array.isArray(pedido.itens)) return 0
    return pedido.itens.reduce((acc: number, item: any) => acc + calcularTotal(item), 0)
  }

  // Hook para verificar o status online
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      carregarVendedorUsuario()
      carregarTabelasPrecos()
      carregarTiposPedido()
    }
  }, [isOpen])

  useEffect(() => {
    if (pedidoBase && isOpen) {
      console.log('📋 Carregando pedido base para duplicação:', pedidoBase)
      const cabecalho = pedidoBase.cabecalho || pedidoBase
      const itensBase = pedidoBase.itens || []
      
      setPedido({
        ...cabecalho,
        NUNOTA: null,
        itens: itensBase.map((item: any, index: number) => ({
          ...item,
          SEQUENCIA: index + 1
        }))
      })

      if (cabecalho.CODTIPOPEDIDO) {
        setTipoPedidoSelecionado(String(cabecalho.CODTIPOPEDIDO))
      }
      if (cabecalho.CODVEND) {
        setCodVendUsuario(String(cabecalho.CODVEND))
      }

      toast({
        title: "Pedido duplicado",
        description: "Os dados do pedido foram carregados. Revise e salve como novo pedido."
      })
    }
  }, [pedidoBase, isOpen])

  // Atualizar nome do vendedor quando a lista estiver carregada
  useEffect(() => {
    if (codVendUsuario !== "0" && vendedores.length > 0) {
      const vendedor = vendedores.find((v: any) => String(v.CODVEND) === codVendUsuario)
      if (vendedor) {
        setNomeVendedor(vendedor.APELIDO)
        console.log('✅ Nome do vendedor atualizado:', vendedor.APELIDO)
      }
    }
  }, [codVendUsuario, vendedores])

  const carregarTiposPedido = async () => {
    try {
      setLoadingTipos(true)

      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tipos = await OfflineDataService.getTiposPedido()

      setTiposPedido(tipos)
      console.log('✅ Tipos de pedido carregados do IndexedDB:', tipos.length)

      // Selecionar o primeiro tipo por padrão
      if (tipos.length > 0) {
        setTipoPedidoSelecionado(String(tipos[0].CODTIPOPEDIDO))
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de pedido:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar tipos de pedido. Configure-os em Configurações.",
        variant: "destructive"
      })
    } finally {
      setLoadingTipos(false)
    }
  }

  const carregarVendedores = async () => {
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const vendedoresList = await OfflineDataService.getVendedores()

      // Filtrar apenas vendedores ativos
      const vendedoresAtivos = vendedoresList.filter((v: any) =>
        v.ATIVO === 'S' && v.TIPVEND === 'V'
      )

      setVendedores(vendedoresAtivos)
      console.log('✅ Vendedores carregados do IndexedDB:', vendedoresAtivos.length)
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error)
      setVendedores([])
    }
  }

  const handleSelecionarVendedor = (vendedor: any) => {
    const codVend = String(vendedor.CODVEND)
    setCodVendUsuario(codVend)
    setNomeVendedor(vendedor.APELIDO)

    // Atualizar pedido se já existir
    if (pedido) {
      setPedido({ ...pedido, CODVEND: codVend })
    }

    setShowVendedorModal(false)
    toast({
      title: "Vendedor selecionado",
      description: `${vendedor.APELIDO} (Cód: ${codVend})`
    })
  }

  const carregarVendedorUsuario = async () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))

        if (user.codVendedor) {
          const codVend = String(user.codVendedor)
          setCodVendUsuario(codVend)
          console.log('✅ Vendedor do usuário carregado:', codVend)

          // Carregar lista de vendedores primeiro
          await carregarVendedores()

          // Buscar nome do vendedor do IndexedDB
          try {
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            const vendedoresList = await OfflineDataService.getVendedores()
            const vendedor = vendedoresList.find((v: any) => String(v.CODVEND) === codVend)

            if (vendedor) {
              setNomeVendedor(vendedor.APELIDO)
              console.log('✅ Nome do vendedor do IndexedDB:', vendedor.APELIDO)
            }
          } catch (error) {
            console.error('❌ Erro ao buscar vendedor do IndexedDB:', error)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendedor do usuário:', error)
    }
  }

  const carregarTabelasPrecos = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const configs = await OfflineDataService.getTabelasPrecosConfig()

      // Converter formato de configuração para formato de tabela
      const tabelasFormatadas = configs.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      setTabelasPrecos(tabelasFormatadas)
      console.log('✅ Tabelas de preços configuradas carregadas do IndexedDB:', tabelasFormatadas.length)
    } catch (error) {
      console.error('Erro ao carregar tabelas de preços:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar tabelas de preços. Verifique sua conexão.",
        variant: "destructive"
      })
      setTabelasPrecos([])
    }
  }


  // Atualizar pedido quando tipo de pedido for selecionado
  useEffect(() => {
    if (tipoPedidoSelecionado && tiposPedido.length > 0) {
      const tipoSelecionado = tiposPedido.find(t => String(t.CODTIPOPEDIDO) === tipoPedidoSelecionado)

      if (tipoSelecionado) {
        console.log('📋 Criando pedido com:', {
          tipoPedido: tipoSelecionado.NOME,
          codVendUsuario: codVendUsuario
        })

        setPedido({
          CODEMP: "1",
          CODCENCUS: "0",
          NUNOTA: "",
          MODELO_NOTA: String(tipoSelecionado.MODELO_NOTA),
          DTNEG: new Date().toISOString().split('T')[0],
          DTFATUR: "",
          DTENTSAI: "",
          CODPARC: "",
          CODTIPOPER: String(tipoSelecionado.CODTIPOPER),
          TIPMOV: tipoSelecionado.TIPMOV,
          CODTIPVENDA: String(tipoSelecionado.CODTIPVENDA),
          CODVEND: codVendUsuario,
          OBSERVACAO: "",
          VLOUTROS: 0,
          VLRDESCTOT: 0,
          VLRFRETE: 0,
          TIPFRETE: "S",
          ORDEMCARGA: "",
          CODPARCTRANSP: "0",
          PERCDESC: 0,
          CODNAT: "0",
          TIPO_CLIENTE: "PJ",
          CPF_CNPJ: "",
          IE_RG: "",
          RAZOAO_SOCIAL: "",
          RAZAOSOCIAL: "",
          itens: [] as any[]
        })
        console.log('✅ Pedido criado com CODVEND:', codVendUsuario)
      }
    }
  }, [tipoPedidoSelecionado, tiposPedido, codVendUsuario])

  // Sincronizar itens do PedidoVendaFromLead com o estado local quando mudarem
  useEffect(() => {
    if (pedido?.itens) {
      console.log('🔄 Itens do pedido atualizados:', {
        totalItens: pedido.itens.length,
        total: calcularTotalPedido()
      })
    }
  }, [pedido?.itens])

  const handlePedidoSucesso = () => {
    toast({
      title: "Sucesso",
      description: "Pedido criado com sucesso!"
    })
    onClose()
  }

  const handleCancelar = () => {
    onClose()
  }

  const handleCriarPedido = async () => {
    console.log('🔍 DEBUG - Estado do pedido:', {
      pedido,
      salvarPedidoRef: !!salvarPedidoRef.current,
      itensCount: pedido?.itens?.length
    })

    if (!salvarPedidoRef.current) {
      console.error('❌ salvarPedidoRef.current não está definido')
      toast({
        title: "Erro Inesperado",
        description: "A função de salvar não está disponível. Tente reabrir o modal.",
        variant: "destructive"
      })
      return
    }

    if (!pedido) {
      console.error('❌ Pedido não está definido')
      toast({
        title: "Erro",
        description: "Pedido não foi inicializado corretamente",
        variant: "destructive"
      })
      return
    }

    if (!pedido.itens || pedido.itens.length === 0) {
      console.error('❌ Pedido sem itens')
      toast({
        title: "Atenção",
        description: "Adicione pelo menos um produto ao pedido",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      console.log('🚀 Iniciando criação do pedido rápido...')
      const sucesso = await salvarPedidoRef.current()

      console.log('📊 Resultado da criação:', sucesso)

      if (sucesso) {
        console.log('✅ Pedido criado com sucesso, fechando modal...')

        // Aguardar um momento para o usuário ver a notificação
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Fechar modal
        onClose()
      } else {
        console.error('❌ Pedido não foi criado')
        // Notificação já foi exibida pelo PedidoSyncService
        // NÃO fechar modal em caso de erro - deixar usuário ver a mensagem
      }
    } catch (error: any) {
      console.error("❌ Erro inesperado ao criar pedido:", error)

      // Notificação de erro já foi exibida
      // NÃO fechar modal - deixar usuário ver o erro
    } finally {
      setLoading(false)
    }
  }

  const tipoSelecionadoObj = tiposPedido.find(t => String(t.CODTIPOPEDIDO) === tipoPedidoSelecionado)

  // Função para calcular impostos automaticamente
  const calcularImpostos = async () => {
    if (!isOnline) {
      console.log("⚠️ Offline - impostos não serão calculados");
      return;
    }
    if (!pedido?.itens || pedido.itens.length === 0) {
      setImpostosItens([]); // Limpar se não há itens
      return;
    }

    setLoadingImpostos(true);

    try {
      const produtosParaAPI = pedido.itens.map((item: any) => ({
        codigoProduto: Number(item.CODPROD),
        quantidade: item.QTDNEG,
        valorUnitario: item.VLRUNIT,
        valorDesconto: (item.VLRUNIT * item.QTDNEG * item.PERCDESC) / 100,
        unidade: item.CODVOL || "UN"
      }));

      const payload = {
        produtos: produtosParaAPI,
        notaModelo: Number(pedido.MODELO_NOTA),
        codigoCliente: Number(pedido.CODPARC || 0),
        codigoEmpresa: Number(pedido.CODEMP),
        codigoTipoOperacao: Number(pedido.CODTIPOPER)
      };

      console.log("🚀 Calculando impostos automaticamente (Pedido Rápido):", payload);

      const response = await fetch('/api/sankhya/impostos/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao calcular impostos');
      }

      const data = await response.json();
      console.log("✅ Impostos calculados (Pedido Rápido):", data);

      // Mapear os resultados para o estado
      if (data.produtos && data.produtos.length > 0) {
        setImpostosItens(data.produtos.map((prod: any) => ({
          codigoProduto: prod.codigoProduto,
          quantidade: prod.quantidade,
          valorTotal: prod.valorTotal,
          impostos: prod.impostos || []
        })));
      } else {
        setImpostosItens([]);
      }

    } catch (error: any) {
      console.error("❌ Erro ao calcular impostos (Pedido Rápido):", error);
      setImpostosItens([]);
    } finally {
      setLoadingImpostos(false);
    }
  };

  // Calcular impostos automaticamente quando os itens mudarem
  useEffect(() => {
    if (pedido?.itens && isOnline) {
      calcularImpostos();
    }
  }, [pedido?.itens, isOnline]);

  const handleAdicionarItemCarrinho = (produto: any, quantidade: number, desconto?: number) => {
    console.log('🛒 Adicionando item ao carrinho do pedido rápido:', { produto, quantidade, desconto })
    
    const vlrUnitario = produto.VLRUNIT || produto.preco || 0
    const vlrSubtotal = vlrUnitario * quantidade
    const vlrDesconto = desconto ? (vlrSubtotal * desconto) / 100 : 0
    const vlrTotal = vlrSubtotal - vlrDesconto

    const novoItem = {
      CODPROD: String(produto.CODPROD),
      DESCRPROD: produto.DESCRPROD,
      QTDNEG: quantidade,
      VLRUNIT: vlrUnitario,
      VLRTOT: vlrTotal,
      PERCDESC: desconto || 0,
      VLRDESC: vlrDesconto,
      CODLOCALORIG: "700",
      CODVOL: produto.CODVOL || produto.UNIDADE || "UN",
      CONTROLE: "007",
      IDALIQICMS: "0",
      SEQUENCIA: (pedido?.itens?.length || 0) + 1,
      MARCA: produto.MARCA,
      UNIDADE: produto.CODVOL || produto.UNIDADE || "UN"
    }

    console.log('✅ Novo item criado:', novoItem)

    // Atualizar o estado do pedido
    setPedido((prev: any) => {
      const novosItens = [...(prev?.itens || [])]
      
      // Verificar se o item já existe para atualizar ou adicionar
      const indexExistente = novosItens.findIndex(item => String(item.CODPROD) === String(novoItem.CODPROD))
      if (indexExistente >= 0) {
        novosItens[indexExistente] = novoItem
      } else {
        novosItens.push(novoItem)
      }

      console.log('📦 Itens atualizados no pedido:', novosItens.length)
      return {
        ...prev,
        itens: novosItens
      }
    })

    toast({
      title: "Produto adicionado",
      description: `${produto.DESCRPROD} adicionado ao carrinho`
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-full h-full md:max-w-[95vw] md:h-[95vh] p-0 overflow-hidden flex flex-col m-0 rounded-none md:rounded-lg" showCloseButton={false}>
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-foreground">Criando pedido de venda...</p>
                <p className="text-sm text-muted-foreground">Aguarde, não feche esta janela</p>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo - Header já está dentro do PedidoVendaFromLead */}
        <div className="flex-1 overflow-hidden relative">
          {pedido && tipoPedidoSelecionado ? (
            <PedidoVendaFromLead
              dadosIniciais={pedido}
              onSuccess={handlePedidoSucesso}
              onCancel={handleCancelar}
              onSalvarPedido={(salvarFn) => {
                salvarPedidoRef.current = salvarFn
              }}
              isLeadVinculado={false}
              tipoPedidoInicial={tipoPedidoSelecionado}
              onTipoPedidoChange={setTipoPedidoSelecionado}
              showGraficos={true}
              onAdicionarItem={handleAdicionarItemCarrinho}
              isRapido={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Carrinho do Pedido Rápido */}
      <CarrinhoPedidoRapido
        isOpen={showCatalogoModal}
        onClose={() => setShowCatalogoModal(false)}
        itens={pedido?.itens || []}
        total={calcularTotalPedido()}
        formatCurrency={formatCurrency}
        removerItem={(index: number) => {
          const novosItens = pedido.itens.filter((_: any, i: number) => i !== index)
          setPedido({ ...pedido, itens: novosItens })
        }}
        editarItem={(index: number, novoItem: any) => {
          const novosItens = [...pedido.itens]
          novosItens[index] = novoItem
          setPedido({ ...pedido, itens: novosItens })
        }}
        onCancelar={() => setShowCatalogoModal(false)}
        onCriarPedido={handleCriarPedido}
        loading={loading}
      />
    </Dialog>
  )
}