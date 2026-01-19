"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Save, Search, ChevronDown, ShoppingCart, Package, X, Edit, TrendingUp, Percent, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { EstoqueModal } from "@/components/estoque-modal"
import { ProdutoSelectorModal } from "@/components/produto-selector-modal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { PedidoSyncService } from "@/lib/pedido-sync"
import { PedidoClienteHeader } from "@/components/pedido-cliente-header"
import { CatalogoProdutosPedido } from "@/components/catalogo-produtos-pedido"
import { CarrinhoPedidoLead } from "@/components/carrinho-pedido-lead"
import { MixProdutosIA } from "@/components/mix-produtos-ia"
import { TabelaPreco } from "@/components/configuracao-produto-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { useEffect as useReactEffect } from "react"


interface ItemPedido {
  CODPROD: string
  DESCRPROD?: string
  QTDNEG: number
  VLRUNIT: number
  PERCDESC: number
  CODLOCALORIG: string
  CONTROLE: string
  CODVOL?: string
  IDALIQICMS?: string
  SEQUENCIA?: number // Adicionado para o ProdutoSelectorModal
  // Propriedades para o cálculo de impostos
  valorImposto?: number;
  tipoImposto?: string;
  // Adicionado para manter VLRDESC e VLRTOT
  VLRDESC?: number;
  VLRTOT?: number;
  // Adicionado para manter MARCA e UNIDADE para exibição
  MARCA?: string;
  UNIDADE?: string;
}

interface PedidoVendaFromLeadProps {
  dadosIniciais?: any
  onSuccess?: () => void
  onCancel?: () => void
  onSalvarPedido?: (salvarFn: () => Promise<boolean>) => void
  isLeadVinculado?: boolean // Se true, sincroniza com o lead. Se false, pedido independente
  tipoPedidoInicial?: string
  onTipoPedidoChange?: (tipoPedido: string) => void
  showGraficos?: boolean
  onAbrirCatalogo?: () => void
  onAdicionarItem?: (produto: any, quantidade: number, desconto?: number) => void
  isRapido?: boolean
}

export default function PedidoVendaFromLead({
  dadosIniciais = {},
  onSuccess,
  onCancel,
  onSalvarPedido,
  isLeadVinculado = false, // Padrão false para não tentar sincronizar com lead
  tipoPedidoInicial,
  onTipoPedidoChange,
  showGraficos = true,
  onAbrirCatalogo,
  onAdicionarItem, // Destruturação do onAdicionarItem
  isRapido = false
}: PedidoVendaFromLeadProps) {
  const [loading, setLoading] = useState(false)
  const [parceiros, setParceiros] = useState<any[]>([])
  const [showProdutoModal, setShowProdutoModal] = useState(false)
  const [showEstoqueModal, setShowEstoqueModal] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null)
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const [dadosInicializados, setDadosInicializados] = useState(false)

  // Inicializar pedido e vendedor a partir dos dados iniciais - APENAS UMA VEZ
  useEffect(() => {
    if (dadosInicializados) return

    console.log('📦 Dados iniciais do pedido recebidos:', dadosIniciais)

    // Apenas setar itens - CODVEND já foi definido no useState inicial
    setItens(dadosIniciais.itens || [])

    // Buscar nome do vendedor se já tiver vendedores carregados
    if (pedido.CODVEND !== "0" && vendedores.length > 0) {
      const vendedor = vendedores.find(v => String(v.CODVEND) === pedido.CODVEND)
      if (vendedor) {
        setNomeVendedor(vendedor.APELIDO)
      }
    }

    setDadosInicializados(true)
  }, [])

  const [parceiroSearch, setParceiroSearch] = useState("")
  const [showParceirosDropdown, setShowParceirosDropdown] = useState(false)

  const [vendedores, setVendedores] = useState<any[]>([])
  const [tiposNegociacao, setTiposNegociacao] = useState<any[]>([])
  const [tiposOperacao, setTiposOperacao] = useState<any[]>([])
  const [condicaoComercialBloqueada, setCondicaoComercialBloqueada] = useState(false)
  const [condicaoComercialPorModelo, setCondicaoComercialPorModelo] = useState(false)
  const [tipoOperacaoBloqueado, setTipoOperacaoBloqueado] = useState(false)
  const [modeloNota, setModeloNota] = useState<string>("")
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([]) // Estado para tabelas de preço
  const [condicaoComercialManual, setCondicaoComercialManual] = useState<string | null>(null) // Rastrear escolha manual

  // Estados adicionados para produto selecionado, estoque e preço
  const [produtoSelecionado, setProdutoSelecionado] = useState<any | null>(null)
  const [produtoEstoqueSelecionado, setProdutoEstoqueSelecionado] = useState<any | null>(null)
  const [produtoEstoque, setProdutoEstoque] = useState<number>(0)
  const [produtoPreco, setProdutoPreco] = useState<number>(0)
  const [tabelaSelecionada, setTabelaSelecionada] = useState<string>(""); // Estado para a tabela de preço selecionada
  const [isLoading, setIsLoading] = useState(false) // Estado de loading para busca de produto

  // Estados para Tipos de Pedido
  const [tiposPedido, setTiposPedido] = useState<any[]>([])
  const [tipoPedidoSelecionado, setTipoPedidoSelecionado] = useState<string>("")

  // Estados para Regras de Impostos
  const [regrasImpostos, setRegrasImpostos] = useState<any[]>([])
  const [regraImpostoSelecionada, setRegraImpostoSelecionada] = useState<string>("")

  // Inicializar estado do pedido DIRETAMENTE no useState (SEM useMemo)
  const [pedido, setPedido] = useState(() => {
    console.log('🔧 Inicializando estado do pedido com dados:', dadosIniciais)

    const codParcLead = String(dadosIniciais.CODPARC || '').trim()
    const cpfCnpj = String(dadosIniciais.CPF_CNPJ || '').trim()
    const ieRg = String(dadosIniciais.IE_RG || '').trim()
    const razaoSocial = String(dadosIniciais.RAZAOSOCIAL || dadosIniciais.RAZAO_SOCIAL || '').trim()
    const tipoCliente = dadosIniciais.TIPO_CLIENTE || 'PJ'

    // Obter CODVEND do usuário logado IMEDIATAMENTE - com prioridade sobre dadosIniciais
    let codVendInicial = "0"
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr))
          if (user.codVendedor) {
            codVendInicial = String(user.codVendedor)
            console.log('✅ CODVEND inicial obtido do cookie (usuário logado):', codVendInicial)
          }
        } catch (parseError) {
          console.warn('⚠️ Cookie de usuário malformado, ignorando...', parseError)
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao processar cookie de usuário:', error)
    }

    // Se não conseguiu do cookie, tenta dos dadosIniciais
    if (codVendInicial === "0" && dadosIniciais.CODVEND) {
      codVendInicial = String(dadosIniciais.CODVEND)
      console.log('✅ CODVEND inicial obtido dos dadosIniciais:', codVendInicial)
    }

    console.log('📋 Dados do parceiro para estado inicial:', {
      CODPARC: codParcLead,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      TIPO_CLIENTE: tipoCliente
    })

    return {
      CODEMP: dadosIniciais.CODEMP || "1",
      CODCENCUS: dadosIniciais.CODCENCUS || "0",
      NUNOTA: dadosIniciais.NUNOTA || "",
      DTNEG: new Date().toISOString().split('T')[0],
      DTFATUR: dadosIniciais.DTFATUR || "",
      DTENTSAI: dadosIniciais.DTENTSAI || "",
      CODPARC: codParcLead,
      CODTIPOPER: dadosIniciais.CODTIPOPER || "974",
      TIPMOV: dadosIniciais.TIPMOV || "P",
      CODTIPVENDA: dadosIniciais.CODTIPVENDA || "1",
      CODVEND: codVendInicial,
      OBSERVACAO: dadosIniciais.OBSERVACAO || "",
      VLOUTROS: dadosIniciais.VLOUTROS || 0,
      VLRDESCTOT: dadosIniciais.VLRDESCTOT || 0,
      VLRFRETE: dadosIniciais.VLRFRETE || 0,
      TIPFRETE: dadosIniciais.TIPFRETE || "S",
      ORDEMCARGA: dadosIniciais.ORDEMCARGA || "",
      CODPARCTRANSP: dadosIniciais.CODPARCTRANSP || "0",
      CODNAT: dadosIniciais.CODNAT || "0",
      TIPO_CLIENTE: tipoCliente,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      VLRNOTA: 0,
      itens: [] as ItemPedido[]
    }
  })
  const [itens, setItens] = useState<ItemPedido[]>(() => {
    // Inicializar itens diretamente no useState
    if (dadosIniciais.itens && Array.isArray(dadosIniciais.itens) && dadosIniciais.itens.length > 0) {
      return dadosIniciais.itens.map((item: any, index: number) => ({
        CODPROD: String(item.CODPROD),
        DESCRPROD: item.DESCRPROD || '',
        QTDNEG: Number(item.QTDNEG) || 1,
        VLRUNIT: Number(item.VLRUNIT) || 0,
        PERCDESC: Number(item.PERCDESC) || 0,
        CODLOCALORIG: item.CODLOCALORIG || "700",
        CONTROLE: item.CONTROLE || "007",
        CODVOL: item.CODVOL || "UN",
        IDALIQICMS: item.IDALIQICMS || "0",
        SEQUENCIA: item.SEQUENCIA || index + 1,
        VLRDESC: item.VLRDESC || 0,
        VLRTOT: item.VLRTOT || 0
      })) as ItemPedido[]
    }
    return [] as ItemPedido[]
  })

  const calcularTotal = (item: any) => {
    const vlrUnit = Number(item.VLRUNIT) || 0
    const qtd = Number(item.QTDNEG) || 0
    const percdesc = Number(item.PERCDESC) || 0
    const vlrDesc = (vlrUnit * qtd * percdesc) / 100
    return (vlrUnit * qtd) - vlrDesc
  }

  const calcularTotalPedido = useCallback(() => {
    if (!Array.isArray(itens)) return 0
    const total = itens.reduce((acc, item) => acc + calcularTotal(item), 0)
    return Number(total.toFixed(2))
  }, [itens])

  // Atualizar valor total sempre que os itens mudarem
  useEffect(() => {
    if (!Array.isArray(itens)) {
      setItens([]) 
      return
    }

    const total = calcularTotalPedido()
    console.log('💰 Total calculado final (useEffect):', total)

    // Sincronizar o estado do pedido com os itens atuais
    setPedido((prev: any) => ({
      ...prev,
      VLRNOTA: total,
      itens: [...itens]
    }))
    
    // Sincronização com lead removida - agora é feito diretamente no handleAdicionarItemCarrinho

    console.log('🔄 Sincronização de rodapé executada:', { itens: itens.length, total })
  }, [itens, calcularTotalPedido, dadosIniciais?.CODLEAD])

  const totalRodape = useMemo(() => {
    const total = (itens || []).reduce((acc: number, item: any) => {
      const vlrUnit = Number(item.VLRUNIT) || 0
      const qtd = Number(item.QTDNEG) || 0
      const percdesc = Number(item.PERCDESC) || 0
      const vlrDesc = (vlrUnit * qtd * percdesc) / 100
      return acc + ((vlrUnit * qtd) - vlrDesc)
    }, 0);
    return Number(total.toFixed(2));
  }, [itens]);

  const qtdRodape = useMemo(() => {
    return (itens || []).reduce((acc: number, item: any) => acc + (Number(item.QTDNEG) || 0), 0);
  }, [itens]);

  // useEffect APENAS para inicialização da UI (campo de busca)
  useEffect(() => {
    console.log('🔄 Inicializando UI do componente')

    // Garantir que itens seja sempre um array
    if (!Array.isArray(itens)) {
      console.warn('⚠️ Corrigindo itens para array vazio')
      setItens([])
    }

    // Preencher campo de busca da UI (APENAS SE TEM CODPARC)
    const codParcLead = String(dadosIniciais.CODPARC || "").trim()
    const razaoSocialLead = dadosIniciais.RAZAOSOCIAL || dadosIniciais.RAZAO_SOCIAL || ""

    if (codParcLead !== "" && codParcLead !== "0") {
      setParceiroSearch(`${razaoSocialLead} (✓ Código: ${codParcLead})`)
    }

    // Garantir que a Condição Comercial não está bloqueada na inicialização
    setCondicaoComercialBloqueada(false)
    setCondicaoComercialPorModelo(false)
    setTipoOperacaoBloqueado(false)

  }, []) // Array vazio - executa APENAS UMA VEZ na montagem

  const handleAdicionarItemCarrinho = (produto: any, quantidade: number, desconto?: number) => {
    // Lógica para adicionar o item ao estado local
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
      CODVOL: produto.CODVOL || "UN",
      CONTROLE: "007",
      IDALIQICMS: "0",
      SEQUENCIA: (itens?.length || 0) + 1,
      MARCA: produto.MARCA,
      UNIDADE: produto.UNIDADE || produto.CODVOL
    }

    setItens((prev: any) => [...prev, novoItem])
    
    // Atualizar o pedido imediatamente para garantir que o rodapé e o botão Criar Pedido reflitam a mudança
    setPedido((prev: any) => {
      const novosItens = [...(prev.itens || []), novoItem];
      const novoTotal = novosItens.reduce((acc: number, item: any) => {
        const vlrUnit = Number(item.VLRUNIT) || 0;
        const qtd = Number(item.QTDNEG) || 0;
        const percdesc = Number(item.PERCDESC) || 0;
        const vlrDesc = (vlrUnit * qtd * percdesc) / 100;
        return acc + ((vlrUnit * qtd) - vlrDesc);
      }, 0);
      
      const pedidoAtualizado = {
        ...prev,
        VLRNOTA: Number(novoTotal.toFixed(2)),
        itens: novosItens
      };
      
      console.log('✅ Pedido atualizado no handleAdicionarItemCarrinho:', { 
        itens: pedidoAtualizado.itens.length, 
        total: pedidoAtualizado.VLRNOTA 
      });
      
      return pedidoAtualizado;
    })

    toast.success("Produto adicionado", {
      description: `${produto.DESCRPROD} - ${quantidade} unidades`
    })
  }

  const itemAtual: ItemPedido = {
    CODPROD: "",
    QTDNEG: 1,
    VLRUNIT: 0,
    PERCDESC: 0,
    CODLOCALORIG: "700",
    CONTROLE: "007",
    CODVOL: "UN",
    IDALIQICMS: "0",
    VLRDESC: 0,
    VLRTOT: 0
  }
  const [showCatalogoModal, setShowCatalogoModal] = useState(false); // Estado para controlar o modal do catálogo

  const [isMobile, setIsMobile] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const [isAdminUser, setIsAdminUser] = useState(false) // Verificar se é administrador
  const [nomeVendedor, setNomeVendedor] = useState<string>('') // Estado para o nome do vendedor

  // Estados para impostos
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [loadingImpostos, setLoadingImpostos] = useState<boolean>(false)
  const [impostosItens, setImpostosItens] = useState<any[]>([])
  const [dadosFinanceiros, setDadosFinanceiros] = useState({
    limiteCredito: 0,
    titulosVencidos: 0,
    clienteBloqueado: false
  })

  // Estados para modais
  const [showCarrinhoModalPedido, setShowCarrinhoModalPedido] = useState(false)
  const [showUnidadesModal, setShowUnidadesModal] = useState(false)
  const [produtoUnidades, setProdutoUnidades] = useState<any>(null)


  useEffect(() => {
    carregarDadosIniciais()
  }, [])

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

  // Atualizar nome do vendedor quando a lista estiver carregada
  useEffect(() => {
    if (pedido.CODVEND !== "0" && vendedores.length > 0) {
      const vendedor = vendedores.find((v: any) => String(v.CODVEND) === pedido.CODVEND)
      if (vendedor) {
        setNomeVendedor(vendedor.APELIDO)
        console.log('✅ Nome do vendedor atualizado:', vendedor.APELIDO)
      }
    }
  }, [pedido.CODVEND, vendedores])

  // Atualizar tabelas de preço quando o parceiro mudar
  useEffect(() => {
    if (pedido.CODPARC && pedido.CODPARC !== "0") {
      carregarTabelasPrecos()
    }
  }, [pedido.CODPARC])

  const carregarDadosIniciais = async () => {
    setIsInitialLoading(true)
    try {
      // Carregar apenas vendedor do usuário inicialmente
      await carregarVendedorUsuario()

      // Carregar outros dados em background sem bloquear a UI
      Promise.all([
        carregarTiposNegociacao(),
        carregarTiposOperacao(),
        carregarTabelasPrecos(), // Chamada para carregar tabelas de preço
        carregarTiposPedido(), // Carregar tipos de pedido
        carregarRegrasImpostos() // Carregar regras de impostos
      ]).catch(error => {
        console.error('Erro ao carregar dados complementares:', error)
      })

      // Parceiros serão carregados sob demanda quando o usuário abrir o seletor
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error)
      toast.error('Erro ao carregar dados. Tente novamente.')
    } finally {
      setIsInitialLoading(false)
    }
  }

  const carregarTiposPedido = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tipos = await OfflineDataService.getTiposPedido()

      setTiposPedido(tipos)
      console.log('✅ Tipos de pedido carregados do IndexedDB:', tipos.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de pedido:', error)
      setTiposPedido([])
    }
  }

  const carregarRegrasImpostos = async () => {
    try {
      // Buscar do IndexedDB primeiro (offline-first)
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      let regras = await OfflineDataService.getRegrasImpostos()

      // Se IndexedDB estiver vazio, tentar buscar da API
      if (!regras || regras.length === 0) {
        console.log('ℹ️ Nenhuma regra no IndexedDB, buscando da API...')
        try {
          const response = await fetch('/api/regras-impostos', { cache: 'no-store' })
          if (response.ok) {
            const data = await response.json()
            regras = data.regras || []
            // Sincronizar com IndexedDB para uso futuro
            if (regras.length > 0) {
              OfflineDataService.sincronizarTudo({
                regrasImpostos: { count: regras.length, data: regras }
              })
            }
          }
        } catch (apiError) {
          console.warn('⚠️ Falha ao buscar regras da API:', apiError)
        }
      }

      // Filtrar apenas regras ativas
      const regrasAtivas = regras.filter((r: any) => 
        (r.ATIVO || r.ativo || 'S') === 'S'
      )

      setRegrasImpostos(regrasAtivas)
      console.log('✅ Regras de impostos carregadas:', regrasAtivas.length)
    } catch (error) {
      console.error('Erro ao carregar regras de impostos:', error)
      setRegrasImpostos([])
    }
  }

  const aplicarConfiguracoesTipoPedido = (tipoPedido: any) => {
    console.log('🔧 Aplicando configurações do tipo de pedido:', tipoPedido)

    setPedido(prev => ({
      ...prev,
      CODTIPOPER: Number(tipoPedido.CODTIPOPER),
      TIPMOV: tipoPedido.TIPMOV,
      // Só aplica condição comercial se o usuário não escolheu manualmente
      CODTIPVENDA: condicaoComercialManual !== null ? prev.CODTIPVENDA : Number(tipoPedido.CODTIPVENDA)
    }))

    setModeloNota(String(tipoPedido.MODELO_NOTA))
    setTipoOperacaoBloqueado(true)
    // NÃO bloquear mais a Condição Comercial - usuário pode alterar
    setCondicaoComercialBloqueada(false)
    setCondicaoComercialPorModelo(false)

    toast.success(`Tipo de pedido "${tipoPedido.NOME}" aplicado`, {
      description: 'Condição Comercial pode ser alterada manualmente se necessário'
    })
  }

  const carregarVendedorUsuario = async () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        let user
        try {
          user = JSON.parse(decodeURIComponent(userStr))
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do cookie:', parseError)
          console.log('Cookie bruto:', userStr)
          return
        }

        // Verificar se é administrador
        const isAdmin = user.role === 'Administrador' || user.role === 'Admin'
        setIsAdminUser(isAdmin)

        console.log('👤 Dados do usuário logado:', {
          codVendedor: user.codVendedor,
          role: user.role,
          isAdmin
        })

        if (user.codVendedor) {
          const codVend = String(user.codVendedor)

          // SEMPRE atualizar o estado do pedido com CODVEND do usuário
          setPedido(prev => {
            const updated = { ...prev, CODVEND: codVend }
            console.log('✅ CODVEND atualizado no pedido:', codVend)
            return updated
          })

          console.log('✅ Vendedor automático do usuário:', codVend, '| Admin:', isAdmin)

          // Carregar lista de vendedores
          try {
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            const vendedoresList = await OfflineDataService.getVendedores()
            setVendedores(vendedoresList)

            const vendedor = vendedoresList.find((v: any) => String(v.CODVEND) === codVend)

            if (vendedor) {
              setNomeVendedor(vendedor.APELIDO)
              console.log('✅ Nome do vendedor do IndexedDB:', vendedor.APELIDO)
            } else {
              console.warn('⚠️ Vendedor não encontrado no IndexedDB:', codVend)
            }
          } catch (error) {
            console.error('❌ Erro ao buscar vendedor do IndexedDB:', error)
          }
        } else if (!isAdmin) {
          console.warn('⚠️ Usuário sem vendedor vinculado')
          setPedido(prev => ({ ...prev, CODVEND: "0" }))
        }
      } else {
        console.error('❌ Cookie de usuário não encontrado')
      }
    } catch (error) {
      console.error('❌ Erro ao carregar vendedor do usuário:', error)
    }
  }

  const loadVendedorNome = async (codVend: number) => {
    try {
      // Buscar direto do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const vendedoresList = await OfflineDataService.getVendedores()
      const vendedor = vendedoresList.find((v: any) => parseInt(v.CODVEND) === codVend)

      if (vendedor) {
        setNomeVendedor(vendedor.APELIDO)
        console.log('✅ Nome do vendedor carregado do IndexedDB:', vendedor.APELIDO)
      } else {
        console.warn('⚠️ Vendedor não encontrado no IndexedDB:', codVend)
        setNomeVendedor("")
      }
    } catch (error) {
      console.error('❌ Erro ao carregar nome do vendedor:', error)
      setNomeVendedor("")
    }
  }

  const carregarParceiros = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const parceirosList = await OfflineDataService.getParceiros()

      setParceiros(parceirosList)
      console.log('✅ Parceiros carregados do IndexedDB:', parceirosList.length)
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error)
      setParceiros([])
    }
  }

  const carregarVendedores = async () => {
    try {
      // Buscar do IndexedDB
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

  const carregarTiposNegociacao = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tiposNegociacaoList = await OfflineDataService.getTiposNegociacao()

      setTiposNegociacao(tiposNegociacaoList)
      console.log('✅ Tipos de negociação carregados do IndexedDB:', tiposNegociacaoList.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de negociação:', error)
      setTiposNegociacao([])
    }
  }

  const carregarTiposOperacao = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tiposOperacaoList = await OfflineDataService.getTiposOperacao()

      setTiposOperacao(tiposOperacaoList)
      console.log('✅ Tipos de operação carregados do IndexedDB:', tiposOperacaoList.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de operação:', error)
      setTiposOperacao([])
    }
  }

  // Função atualizada para carregar tabelas de preço configuradas do IndexedDB
  const carregarTabelasPrecos = async () => {
    try {
      // 1. Buscar parceiro no IndexedDB para pegar o CODTAB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const codParc = pedido.CODPARC
      let codTabParceiro = null
      
      if (codParc && codParc !== "0") {
        const parceiros = await OfflineDataService.getParceiros()
        const parceiro = parceiros.find(p => String(p.CODPARC) === String(codParc))
        codTabParceiro = parceiro?.CODTAB
      }

      // 2. Buscar tabelas de preço configuradas no sistema (padrão)
      const configs = await OfflineDataService.getTabelasPrecosConfig()
      let tabelasFormatadas: TabelaPreco[] = configs.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      // 3. Se o parceiro tiver CODTAB, buscar as tabelas reais (NUTABs) vinculadas a esse CODTAB no Oracle
      if (codTabParceiro) {
        const responseTabs = await fetch(`/api/oracle/tabelas-precos?codTab=${codTabParceiro}`)
        if (responseTabs.ok) {
          const dataTabs = await responseTabs.json()
          const tabelasParceiro = dataTabs.tabelas || []

          if (tabelasParceiro.length > 0) {
            const novasTabelas: TabelaPreco[] = tabelasParceiro.map((t: any) => ({
              NUTAB: t.NUTAB,
              CODTAB: String(t.CODTAB),
              DESCRICAO: `Tabela ${t.CODTAB} (Parceiro)`,
              ATIVO: 'S'
            }))

            const IDsParceiro = new Set(novasTabelas.map(t => t.CODTAB))
            const configsFiltradas = tabelasFormatadas.filter(c => !IDsParceiro.has(c.CODTAB))
            tabelasFormatadas = [...novasTabelas, ...configsFiltradas]
            
            // Definir a primeira tabela do parceiro como selecionada
            setTabelaSelecionada(String(novasTabelas[0].NUTAB))
          }
        }
      }

      setTabelasPrecos(tabelasFormatadas)
      
      if (tabelasFormatadas.length > 0 && !tabelaSelecionada && !codTabParceiro) {
        setTabelaSelecionada(String(tabelasFormatadas[0].NUTAB))
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tabelas de preços:', error)
      setTabelasPrecos([])
    }
  }

  const _carregarTabelasPrecosLegacy = async () => {
    try {
      // Código antigo mantido para referência
      const cached = sessionStorage.getItem('cached_tabelasPrecos')
      if (cached) {
        try {
          const cachedData = JSON.parse(cached)
          const tabelas = Array.isArray(cachedData) ? cachedData : (cachedData.tabelas || [])
          setTabelasPrecos(tabelas)
          console.log('✅ Tabelas de preços carregadas do cache:', tabelas.length)

          if (tabelas.length > 0 && !tabelaSelecionada) {
            setTabelaSelecionada(String(tabelas[0].NUTAB));
          }
          return
        } catch (e) {
          console.warn('⚠️ Erro ao processar cache de tabelas de preços')
          sessionStorage.removeItem('cached_tabelasPrecos')
        }
      }

      const response = await fetch('/api/oracle/tabelas-precos')
      if (!response.ok) throw new Error('Erro ao carregar tabelas de preços')
      const data = await response.json()
      const tabelas = data.tabelas || []
      setTabelasPrecos(tabelas)

      if (tabelas.length > 0) {
        sessionStorage.setItem('cached_tabelasPrecos', JSON.stringify(tabelas))
      }

      // Definir a primeira tabela como selecionada por padrão, se houver
      if (tabelas.length > 0 && !tabelaSelecionada) {
        setTabelaSelecionada(String(tabelas[0].NUTAB));
      }
    } catch (error) {
      console.error('Erro ao carregar tabelas de preços:', error)
      toast.error("Falha ao carregar tabelas de preços. Verifique sua conexão.")
      setTabelasPrecos([]) // Garantir array vazio em caso de erro
    }
  }

  const [searchParceiroTimeout, setSearchParceiroTimeout] = useState<NodeJS.Timeout | null>(null)

  const buscarParceiros = async (search: string) => {
    // Só buscar se tiver 2+ caracteres
    if (search.length < 2) {
      setParceiros([])
      setShowParceirosDropdown(false)
      return
    }

    try {
      console.log('🔍 Buscando parceiros no IndexedDB para:', search)

      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const allParceiros = await OfflineDataService.getParceiros({ search })

      console.log(`✅ ${allParceiros.length} parceiros filtrados do IndexedDB`)

      if (allParceiros.length > 0) {
        console.log('📋 Primeiros 3 parceiros filtrados:', allParceiros.slice(0, 3).map(p => ({
          CODPARC: p.CODPARC,
          NOMEPARC: p.NOMEPARC,
          CGC_CPF: p.CGC_CPF
        })))
      }

      setParceiros(allParceiros)
      setShowParceirosDropdown(allParceiros.length > 0)

    } catch (error) {
      console.error('❌ Erro ao buscar parceiros no IndexedDB:', error)
      setParceiros([])
      setShowParceirosDropdown(false)
    }
  }

  const handleParceiroSearchDebounced = (search: string) => {
    setParceiroSearch(search)

    // Limpar timeout anterior
    if (searchParceiroTimeout) {
      clearTimeout(searchParceiroTimeout)
    }

    // Se campo vazio ou menos de 2 caracteres, limpar parceiros e fechar dropdown
    if (search.length < 2) {
      setParceiros([])
      setShowParceirosDropdown(false)
      return
    }

    console.log('⌨️ Digitando busca de parceiro:', search)

    // Aguardar 300ms após parar de digitar (mais responsivo)
    setSearchParceiroTimeout(setTimeout(() => {
      buscarParceiros(search)
    }, 300))
  }


  const buscarDadosModeloNota = async (nunota: string) => {
    if (!nunota || nunota.trim() === '') {
      // Se limpar o modelo, desbloquear tipo de operação e condição comercial
      setTipoOperacaoBloqueado(false)
      if (!condicaoComercialBloqueada) {
        setCondicaoComercialPorModelo(false)
      }
      return
    }

    try {
      console.log('🔍 Buscando dados do modelo NUNOTA:', nunota)
      const response = await fetch('/api/sankhya/tipos-negociacao?tipo=modelo&nunota=' + nunota)
      const data = await response.json()

      if (data.codTipOper) {
        console.log('✅ Dados do modelo encontrados:', data)

        // Atualizar APENAS os campos do modelo, preservando dados do parceiro
        setPedido(prev => {
          const novoEstado = {
            ...prev, // Preservar TODO o estado anterior
            CODTIPOPER: String(data.codTipOper)
          }

          // PRIORIDADE 1: Se tiver condição comercial do parceiro, NÃO atualiza
          if (!condicaoComercialBloqueada && data.codTipVenda) {
            novoEstado.CODTIPVENDA = String(data.codTipVenda)
          }

          console.log('🔄 Atualizando estado com dados do modelo (preservando parceiro):', {
            CODPARC: novoEstado.CODPARC,
            CPF_CNPJ: novoEstado.CPF_CNPJ,
            IE_RG: novoEstado.IE_RG,
            RAZAO_SOCIAL: novoEstado.RAZAO_SOCIAL,
            CODTIPOPER: novoEstado.CODTIPOPER,
            CODTIPVENDA: novoEstado.CODTIPVENDA
          })

          return novoEstado
        })

        // Bloquear tipo de operação quando vier do modelo
        setTipoOperacaoBloqueado(true)

        // PRIORIDADE 2: Só marca como "por modelo" se NÃO tiver do parceiro
        if (!condicaoComercialBloqueada && data.codTipVenda && data.codTipVenda !== '0') {
          setCondicaoComercialPorModelo(true)
          toast.success('Tipo de operação definido pelo modelo')
        } else if (condicaoComercialBloqueada) {
          toast.info('Tipo de operação definido pelo modelo. Condição comercial mantida do parceiro.')
        } else {
          toast.success('Tipo de operação definido pelo modelo')
          setCondicaoComercialPorModelo(false)
        }
      } else {
        console.log('ℹ️ Nenhum dado encontrado para este NUNOTA')
        toast.warning('Modelo da nota não encontrado')
        setTipoOperacaoBloqueado(false)
        setCondicaoComercialPorModelo(false)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do modelo da nota:', error)
      toast.error('Erro ao buscar dados do modelo')
      setTipoOperacaoBloqueado(false)
    }
  }

  const selecionarParceiro = async (parceiro: any) => {
    console.log('✅ Parceiro selecionado:', parceiro)

    const codParc = String(parceiro.CODPARC).trim()
    const nomeParc = parceiro.NOMEPARC || parceiro.RAZAOSOCIAL || ''
    const razaoSocial = parceiro.RAZAOSOCIAL || parceiro.NOMEPARC || ''

    // Validar dados essenciais antes de prosseguir
    if (!parceiro.CGC_CPF || !parceiro.CGC_CPF.trim()) {
      console.error('⚠️ Parceiro sem CPF/CNPJ:', parceiro)
      toast.error("Este parceiro não possui CPF/CNPJ cadastrado. Complete o cadastro antes de continuar.")
      return
    }

    if (!parceiro.IDENTINSCESTAD || !parceiro.IDENTINSCESTAD.trim()) {
      console.error('⚠️ Parceiro sem IE/RG:', parceiro)
      toast.error("Este parceiro não possui IE/RG cadastrado. Complete o cadastro antes de continuar.")
      return
    }

    // Fechar dropdown e limpar lista PRIMEIRO
    setShowParceirosDropdown(false)
    setParceiros([])

    // Preencher dados básicos do parceiro
    const tipPessoa = parceiro.TIPPESSOA === 'J' ? 'PJ' : 'PF'
    const dadosParceiro = {
      CODPARC: codParc,
      TIPO_CLIENTE: tipPessoa,
      CPF_CNPJ: parceiro.CGC_CPF,
      IE_RG: parceiro.IDENTINSCESTAD,
      RAZAO_SOCIAL: razaoSocial
    }

    // Atualizar estado do pedido
    setPedido(prev => {
      const novoEstado = {
        ...prev,
        ...dadosParceiro
      }
      console.log('🔄 Estado ANTERIOR do pedido:', prev)
      console.log('🔄 Estado NOVO do pedido:', novoEstado)
      return novoEstado
    })

    // Atualizar campo de busca com nome do parceiro
    setParceiroSearch(`${nomeParc} (✓ Código: ${codParc})`)

    console.log('✅ Dados do parceiro salvos no estado:', dadosParceiro)

    // Sincronizar com o lead quando tiver CODLEAD (independente de isLeadVinculado)
    if (dadosIniciais?.CODLEAD) {
      try {
        console.log('🔄 Atualizando parceiro do lead no banco:', {
          CODLEAD: dadosIniciais.CODLEAD,
          CODPARC: codParc,
          NOMEPARC: nomeParc
        })

        const response = await fetch('/api/leads/atualizar-parceiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codLead: dadosIniciais.CODLEAD,
            codParc: codParc
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao atualizar parceiro do lead')
        }

        const result = await response.json()
        console.log('✅ Parceiro do lead atualizado com sucesso no Oracle:', result)

        toast.success(`Parceiro vinculado ao lead!`, {
          description: `${nomeParc} (Cód: ${codParc})`,
          duration: 3000
        })
      } catch (error: any) {
        console.error('❌ Erro ao sincronizar parceiro com o lead:', error)
        toast.error('Erro ao atualizar parceiro do lead', {
          description: error.message,
          duration: 5000
        })
      }
    } else {
      // Pedido sem vinculação com lead
      toast.success(`Parceiro selecionado: ${nomeParc}`, {
        description: `Código: ${codParc}`
      })
    }
  }



  const handleSelecionarProduto = async (produto: any) => {
    console.log('🔍 Selecionando produto:', produto.CODPROD)
    setProdutoSelecionado(produto)
    setIsLoading(true)

    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')

      let estoqueTotal = 0;
      let preco = produto.AD_VLRUNIT || 0;

      // Buscar estoque do IndexedDB
      const estoques = await OfflineDataService.getEstoque(produto.CODPROD);
      estoqueTotal = estoques.reduce((sum: number, e: any) => sum + (parseFloat(e.ESTOQUE) || 0), 0);
      console.log('📦 Estoque do IndexedDB:', estoqueTotal);

      // Buscar preço do IndexedDB
      if (tabelaSelecionada) {
        const precos = await OfflineDataService.getPrecos(produto.CODPROD, Number(tabelaSelecionada));
        if (precos.length > 0 && precos[0].VLRVENDA) {
          preco = parseFloat(precos[0].VLRVENDA);
          console.log('💰 Preço da exceção do IndexedDB:', preco);
        }
      }

      setProdutoEstoque(estoqueTotal)
      setProdutoPreco(preco)
      setShowEstoqueModal(true)

      console.log('✅ Usando dados do IndexedDB - Estoque:', estoqueTotal, 'Preço:', preco);

    } catch (error: any) {
      console.error('❌ Erro ao carregar dados do produto:', error)

      // Usar valores padrão
      console.warn('⚠️ Usando valores padrão')
      setProdutoEstoque(0)
      setProdutoPreco(produto.AD_VLRUNIT || 0)
      setShowEstoqueModal(true)
      toast.error('Usando valores padrão do produto')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRepetirPedido = (produtosPedidoAnterior: any[]) => {
    console.log('🔄 Repetindo pedido anterior:', produtosPedidoAnterior)

    const novosItens = produtosPedidoAnterior.map((item: any, index: number) => ({
      CODPROD: String(item.CODPROD),
      DESCRPROD: item.DESCRPROD || item.DESCRICAO,
      QTDNEG: Number(item.QTDNEG || item.QUANTIDADE || 1),
      VLRUNIT: Number(item.VLRUNIT || item.PRECO || 0),
      PERCDESC: 0,
      CODLOCALORIG: "700",
      CONTROLE: "007",
      CODVOL: "UN",
      IDALIQICMS: "0",
      SEQUENCIA: index + 1,
      // Garantir que VLRDESC e VLRTOT estejam presentes
      VLRDESC: 0,
      VLRTOT: 0
    }))

    setItens(novosItens)
    setPedido(prev => ({ ...prev, itens: novosItens }))

    toast.success(`${novosItens.length} produto(s) adicionado(s) do pedido anterior!`)
  }

  const handleEditarItem = (index: number) => {
    const itemParaEditar = itens[index]

    // Buscar produto completo do IndexedDB
    const buscarProdutoCompleto = async () => {
      try {
        const { OfflineDataService } = await import('@/lib/offline-data-service')
        const produtosData = await OfflineDataService.getProdutos()
        const produtoCompleto = produtosData.find((p: any) => String(p.CODPROD) === String(itemParaEditar.CODPROD))

        if (produtoCompleto) {
          setProdutoSelecionado(produtoCompleto)
          setProdutoEstoqueSelecionado(produtoCompleto)
          setProdutoPreco(itemParaEditar.VLRUNIT)
          setCurrentItemIndex(index)
          setShowEstoqueModal(true)
        }
      } catch (error) {
        console.error('Erro ao buscar produto:', error)
        toast.error('Erro ao carregar dados do produto')
      }
    }

    buscarProdutoCompleto()
  }

  const removerItem = (index: number) => {
    const novosItens = itens.filter((_, i) => i !== index)
    setItens(novosItens)
    setPedido(prev => ({ ...prev, itens: novosItens }))
    toast.success('Item removido do carrinho')
  }

  const handleConfirmarProdutoEstoque = async (produto: any, preco: number, quantidade: number, desconto?: number, controle?: string, local?: number) => {
    // Fechar modais
    setShowEstoqueModal(false)
    setShowProdutoModal(false)

    if (currentItemIndex !== null) {
      // Editando item existente
      const itemExistente = itens[currentItemIndex]
      const vlrSubtotal = preco * quantidade
      const vlrDesconto = desconto ? (vlrSubtotal * desconto) / 100 : 0
      const vlrTotal = vlrSubtotal - vlrDesconto

      const novoItem: ItemPedido = {
        ...itemExistente, // Preserva todos os campos existentes
        QTDNEG: quantidade,
        VLRUNIT: preco,
        PERCDESC: desconto || 0,
        VLRDESC: vlrDesconto,
        VLRTOT: vlrTotal,
        CONTROLE: controle || itemExistente.CONTROLE || "007",
        CODLOCALORIG: local ? String(local) : (itemExistente.CODLOCALORIG || "700")
      }

      const novosItens = [...itens]
      novosItens[currentItemIndex] = novoItem
      setItens(novosItens)
      setPedido(prev => {
        const updatedItens = [...prev.itens]
        updatedItens[currentItemIndex] = novoItem
        return { ...prev, itens: updatedItens }
      })

      // Limpar o index de edição imediatamente para evitar que modais subsequentes achem que ainda estamos editando
      setCurrentItemIndex(null);

      // Sincronizar edição com o lead SEMPRE quando tiver CODLEAD
      if (dadosIniciais?.CODLEAD) {
        try {
          console.log('🔄 Sincronizando edição com lead:', dadosIniciais.CODLEAD);

          const responseProdutos = await fetch(`/api/leads/produtos?codLead=${dadosIniciais.CODLEAD}`);

          if (!responseProdutos.ok) {
            throw new Error('Erro ao buscar produtos do lead');
          }

          const produtosLead = await responseProdutos.json();
          const produtoLead = produtosLead[currentItemIndex];

          if (produtoLead?.CODITEM) {
            console.log('🔄 Atualizando produto do lead - CODITEM:', produtoLead.CODITEM);

            const response = await fetch('/api/leads/produtos/atualizar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codItem: produtoLead.CODITEM,
                codLead: dadosIniciais.CODLEAD,
                quantidade: quantidade,
                vlrunit: preco,
                vlrDesconto: vlrDesconto, // Enviar valor do desconto
                percDesconto: desconto || 0 // Enviar percentual do desconto
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erro ao atualizar produto no lead');
            }

            const result = await response.json();
            console.log('✅ Lead atualizado. Novo total:', result.novoValorTotal);

            toast.success("Produto atualizado!", {
              description: `Valor do lead: R$ ${result.novoValorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            });
          } else {
            console.warn('⚠️ Produto não encontrado no lead');
            toast.success("Produto atualizado localmente!");
          }
        } catch (error: any) {
          console.error('❌ Erro ao sincronizar com lead:', error);
          toast.error('Produto atualizado localmente, mas erro ao sincronizar lead');
        }
      } else {
        toast.success("Item atualizado!");
      }
    } else {
      // Adicionando novo item
      const vlrUnitario = preco
      const vlrSubtotal = vlrUnitario * quantidade
      const vlrDesconto = desconto ? (vlrSubtotal * desconto) / 100 : 0
      const vlrTotal = vlrSubtotal - vlrDesconto

      console.log('📦 Adicionando novo item ao pedido:', {
        produto: produto.DESCRPROD,
        vlrUnitario,
        quantidade,
        desconto,
        vlrSubtotal,
        vlrDesconto,
        vlrTotal
      })

      const novoItem: ItemPedido = {
        CODPROD: String(produto.CODPROD),
        DESCRPROD: produto.DESCRPROD,
        QTDNEG: quantidade,
        VLRUNIT: vlrUnitario,
        PERCDESC: desconto || 0,
        VLRDESC: vlrDesconto,
        VLRTOT: vlrTotal,
        CODLOCALORIG: local ? String(local) : "700",
        CONTROLE: controle || "007",
        CODVOL: "UN",
        IDALIQICMS: "0",
        SEQUENCIA: itens.length + 1,
        MARCA: produto.MARCA,
        UNIDADE: produto.UNIDADE
      }
      setItens([...itens, novoItem])
      setPedido(prev => ({ ...prev, itens: [...prev.itens, novoItem] }))

      // SEMPRE adicionar produto ao lead quando tiver CODLEAD (independente de isLeadVinculado)
      if (dadosIniciais?.CODLEAD) {
        try {
          console.log('➕ Adicionando produto ao lead:', {
            CODLEAD: dadosIniciais.CODLEAD,
            CODPROD: produto.CODPROD,
            DESCRPROD: produto.DESCRPROD,
            QUANTIDADE: quantidade,
            VLRUNIT: vlrUnitario,
            VLRTOTAL: vlrTotal,
            PERCDESC: desconto || 0,
            VLRDESCONTO: vlrDesconto
          });

          const response = await fetch('/api/leads/produtos/adicionar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              CODLEAD: dadosIniciais.CODLEAD,
              CODPROD: produto.CODPROD,
              DESCRPROD: produto.DESCRPROD,
              QUANTIDADE: quantidade,
              VLRUNIT: vlrUnitario,
              VLRTOTAL: vlrTotal,
              PERCDESC: desconto || 0,
              VLRDESCONTO: vlrDesconto
            })
          })

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao adicionar produto ao lead');
          }

          const result = await response.json()
          console.log('✅ Produto adicionado ao lead. Novo total do lead:', result.novoValorTotal)

          toast.success("Produto adicionado!", {
            description: `Valor do lead: R$ ${result.novoValorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 3000
          })
        } catch (error: any) {
          console.error('❌ Erro ao sincronizar produto com lead:', error)
          toast.error('Erro ao adicionar produto ao lead', {
            description: error.message || 'Tente novamente',
            duration: 5000
          })

          // Reverter adição local se falhar no banco
          setItens(itens)
          setPedido(prev => ({ ...prev, itens: itens }))
        }
      } else {
        toast.success("Item adicionado")
      }
    }

    setCurrentItemIndex(null)
  }

  const abrirModalEstoque = (produto: any) => {
    setProdutoEstoqueSelecionado(produto)
    setShowEstoqueModal(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const onClose = async () => {
    // Se tem CODLEAD e está vinculado a lead, recarregar dados antes de fechar
    if (isLeadVinculado && dadosIniciais.CODLEAD) {
      try {
        console.log('🔄 Recarregando dados do lead antes de fechar modal...')
        if (onSuccess) {
          await onSuccess()
        }
      } catch (error) {
        console.error('❌ Erro ao recarregar dados do lead:', error)
      }
    }
    onCancel?.()
  }

  // Função para calcular impostos
  const calcularImpostos = async () => {
    if (!isOnline) {
      console.log("⚠️ Offline - impostos não serão calculados");
      return;
    }
    if (itens.length === 0) {
      setImpostosItens([]); // Limpar se não há itens
      return;
    }

    setLoadingImpostos(true);

    try {
      const produtosParaAPI = itens.map(item => ({
        codigoProduto: Number(item.CODPROD),
        quantidade: item.QTDNEG,
        valorUnitario: item.VLRUNIT,
        valorDesconto: (item.VLRUNIT * item.QTDNEG * item.PERCDESC) / 100,
        unidade: item.CODVOL || "UN"
      }));

      const payload = {
        produtos: produtosParaAPI,
        notaModelo: Number(modeloNota),
        codigoCliente: Number(pedido.CODPARC),
        codigoEmpresa: Number(pedido.CODEMP),
        codigoTipoOperacao: Number(pedido.CODTIPOPER)
      };

      console.log("🚀 Calculando impostos automaticamente:", payload);

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
      console.log("✅ Impostos calculados:", data);

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
      console.error("❌ Erro ao calcular impostos:", error);
      setImpostosItens([]);
    } finally {
      setLoadingImpostos(false);
    }
  };

  // Calcular impostos automaticamente quando os itens mudarem
  useEffect(() => {
    calcularImpostos();
  }, [itens, isOnline]);


  const salvarPedido = useCallback(async (): Promise<boolean> => {
    console.log('🔍 Iniciando validação do pedido...')

    // Validar tipo de pedido selecionado
    if (!tipoPedidoSelecionado) {
      console.error('❌ Validação falhou: Tipo de Pedido não selecionado')
      toast.error("Tipo de Pedido é obrigatório", {
        description: "Selecione um tipo de pedido antes de salvar."
      })
      return false
    }

    // Usar valores atuais dos estados diretamente (useCallback garante que serão os mais recentes)
    const dadosAtuaisPedido = { ...pedido }

    console.log('📋 Dados capturados da tela:', {
      CODPARC: dadosAtuaisPedido.CODPARC,
      CPF_CNPJ: dadosAtuaisPedido.CPF_CNPJ,
      IE_RG: dadosAtuaisPedido.IE_RG,
      RAZAO_SOCIAL: dadosAtuaisPedido.RAZAO_SOCIAL,
      CODVEND: dadosAtuaisPedido.CODVEND,
      CODTIPOPER: dadosAtuaisPedido.CODTIPOPER,
      CODTIPVENDA: dadosAtuaisPedido.CODTIPVENDA,
      DTNEG: dadosAtuaisPedido.DTNEG,
      TIPO_PEDIDO: tipoPedidoSelecionado
    })

    // Validar dados diretamente dos dados capturados
    const codParc = String(dadosAtuaisPedido.CODPARC || '').trim()
    const cpfCnpj = String(dadosAtuaisPedido.CPF_CNPJ || '').trim()
    const ieRg = String(dadosAtuaisPedido.IE_RG || '').trim()
    // Buscar RAZAO_SOCIAL
    const razaoSocial = String(dadosAtuaisPedido.RAZAO_SOCIAL || '').trim()
    
    // Fallback: se razaoSocial ainda estiver vazia, tentar buscar do parceiroSearch
    let razaoSocialFinal = razaoSocial
    if (!razaoSocialFinal && parceiroSearch) {
      const match = parceiroSearch.match(/^(.*?)\s*\(✓ Código:/)
      if (match && match[1]) {
        razaoSocialFinal = match[1].trim()
        console.log('🔄 Razão Social recuperada do campo de busca:', razaoSocialFinal)
      }
    }

    console.log('📋 Dados extraídos para validação:', {
      CODPARC: codParc,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      RAZAO_SOCIAL_original: dadosAtuaisPedido.RAZAO_SOCIAL
    })

    console.log('🔍 Verificando se dados do parceiro estão presentes:', {
      temCODPARC: !!codParc && codParc !== '0',
      temCPF_CNPJ: !!cpfCnpj,
      temIE_RG: !!ieRg,
      temRAZAO_SOCIAL: !!razaoSocial
    })

    console.log('\n🔍 DEBUG - Valores do modelo da nota:')
    console.log(`   - Estado modeloNota: "${modeloNota}"`)

    const modeloNotaTrimmed = String(modeloNota).trim()

    // Validar que modelo da nota foi preenchido
    if (!modeloNotaTrimmed || modeloNotaTrimmed === '' || modeloNotaTrimmed === '0') {
      console.error('❌ Validação falhou: Modelo da Nota vazio ou inválido')
      toast.error("Modelo da Nota é obrigatório", {
        description: "Preencha o número do modelo da nota antes de salvar."
      })
      return false
    }

    const modeloNotaNumero = Number(modeloNotaTrimmed)

    if (isNaN(modeloNotaNumero) || modeloNotaNumero <= 0) {
      console.error('❌ Validação falhou: Modelo da Nota com valor inválido:', modeloNotaTrimmed)
      toast.error("Modelo da Nota inválido", {
        description: "Informe um número válido para o modelo da nota."
      })
      return false
    }

    console.log(`✅ Modelo da Nota validado com sucesso: ${modeloNotaNumero}`)

    // Validar CODPARC
    if (!codParc || codParc === '0') {
      console.error('❌ Validação falhou: CODPARC inválido ou vazio')
      toast.error("Parceiro não selecionado", {
        description: "Selecione um parceiro válido antes de salvar."
      })
      return false
    }

    // Validar CPF/CNPJ
    if (!cpfCnpj) {
      console.error('❌ Validação falhou: CPF/CNPJ vazio')
      toast.error("CPF/CNPJ não encontrado", {
        description: "Preencha o CPF/CNPJ do parceiro."
      })
      return false
    }

    // Validar IE/RG
    if (!ieRg) {
      console.error('❌ Validação falhou: IE/RG vazio')
      toast.error("IE/RG não encontrado", {
        description: "Preencha a IE/RG do parceiro."
      })
      return false
    }

    // Validar Razão Social
    if (!razaoSocialFinal) {
      console.error('❌ Validação falhou: Razão Social vazia')
      toast.error("Razão Social não encontrada", {
        description: "Preencha a Razão Social do parceiro ou selecione o parceiro novamente."
      })
      return false
    }

    // Validar vendedor (usando dados capturados)
    if (!dadosAtuaisPedido.CODVEND || dadosAtuaisPedido.CODVEND === "0") {
      toast.error("Vendedor não vinculado. Entre em contato com o administrador.")
      return false
    }

    // Itens do pedido - usar itens do estado local
    const itensParaEnviar = itens.length > 0 ? itens : []

    if (itensParaEnviar.length === 0) {
      console.log('❌ Validação de itens falhou')
      toast.error("Adicione pelo menos um item ao pedido")
      return false
    }

    setLoading(true)

    try {
      console.log('📦 Criando pedido de venda...')
      console.log('📋 Dados CAPTURADOS DA TELA para envio:', {
        CODPARC: codParc,
        CPF_CNPJ: cpfCnpj,
        IE_RG: ieRg,
        RAZAO_SOCIAL: razaoSocial,
        CODVEND: dadosAtuaisPedido.CODVEND,
        CODTIPOPER: dadosAtuaisPedido.CODTIPOPER,
        CODTIPVENDA: dadosAtuaisPedido.CODTIPVENDA,
        DTNEG: dadosAtuaisPedido.DTNEG,
        MODELO_NOTA: modeloNotaNumero,
        itensCount: itensParaEnviar.length
      })

      // Usar valores atuais dos estados diretamente (useCallback garante que serão os mais recentes)
      const codTipVendaFinal = condicaoComercialManual !== null
        ? condicaoComercialManual
        : dadosAtuaisPedido.CODTIPVENDA

      console.log('📋 Condição Comercial final:', {
        manual: condicaoComercialManual,
        tipoPedido: dadosAtuaisPedido.CODTIPVENDA,
        final: codTipVendaFinal
      })

      // Buscar regra de imposto selecionada (se houver)
      let regraImpostoParaEnviar = null
      if (regraImpostoSelecionada && regraImpostoSelecionada !== "0") {
        const regra = regrasImpostos.find(r => 
          String(r.ID_REGRA || r.id_regra) === regraImpostoSelecionada
        )
        if (regra) {
          regraImpostoParaEnviar = {
            ID_REGRA: regra.ID_REGRA || regra.id_regra,
            NOME: regra.NOME || regra.nome,
            NOTA_MODELO: regra.NOTA_MODELO || regra.nota_modelo,
            CODIGO_EMPRESA: regra.CODIGO_EMPRESA || regra.codigo_empresa,
            FINALIDADE_OPERACAO: regra.FINALIDADE_OPERACAO || regra.finalidade_operacao,
            CODIGO_NATUREZA: regra.CODIGO_NATUREZA || regra.codigo_natureza
          }
          console.log('📋 Regra de imposto selecionada para cálculo:', regraImpostoParaEnviar)
        }
      }

      // Montar payload com dados CAPTURADOS DA TELA
      const pedidoCompleto = {
        CODEMP: dadosAtuaisPedido.CODEMP,
        CODCENCUS: dadosAtuaisPedido.CODCENCUS,
        NUNOTA: dadosAtuaisPedido.NUNOTA,
        DTNEG: dadosAtuaisPedido.DTNEG,
        DTFATUR: dadosAtuaisPedido.DTFATUR,
        DTENTSAI: dadosAtuaisPedido.DTENTSAI,
        CODPARC: codParc,
        CODTIPOPER: Number(dadosAtuaisPedido.CODTIPOPER),
        TIPMOV: dadosAtuaisPedido.TIPMOV,
        CODTIPVENDA: Number(codTipVendaFinal), // Usar a condição comercial final
        CODVEND: dadosAtuaisPedido.CODVEND,
        OBSERVACAO: dadosAtuaisPedido.OBSERVACAO,
        VLOUTROS: dadosAtuaisPedido.VLOUTROS,
        VLRDESCTOT: dadosAtuaisPedido.VLRDESCTOT,
        VLRFRETE: dadosAtuaisPedido.VLRFRETE,
        TIPFRETE: dadosAtuaisPedido.TIPFRETE,
        ORDEMCARGA: dadosAtuaisPedido.ORDEMCARGA,
        CODPARCTRANSP: dadosAtuaisPedido.CODPARCTRANSP,
        CODNAT: dadosAtuaisPedido.CODNAT,
        TIPO_CLIENTE: dadosAtuaisPedido.TIPO_CLIENTE,
        CPF_CNPJ: cpfCnpj,
        IE_RG: ieRg,
        RAZAO_SOCIAL: razaoSocialFinal,
        RAZAOSOCIAL: razaoSocialFinal, // Enviar ambas as propriedades para compatibilidade
        MODELO_NOTA: Number(modeloNotaNumero),
        REGRA_IMPOSTO: regraImpostoParaEnviar, // Adicionar regra de imposto ao payload
        itens: itensParaEnviar.map(item => ({
          CODPROD: item.CODPROD,
          QTDNEG: item.QTDNEG,
          VLRUNIT: item.VLRUNIT,
          PERCDESC: item.PERCDESC,
          VLRDESC: item.VLRDESC, // Enviar valor do desconto
          CODLOCALORIG: item.CODLOCALORIG,
          CONTROLE: item.CONTROLE,
          CODVOL: item.CODVOL,
          IDALIQICMS: item.IDALIQICMS,
          VLRTOT: item.VLRTOT // Enviar valor total do item
        }))
      }

      console.log('📦 Dados completos sendo enviados para API:', pedidoCompleto)
      console.log('🔍 Dados do tipo de pedido:', {
        CODTIPOPER: pedidoCompleto.CODTIPOPER,
        CODTIPVENDA: pedidoCompleto.CODTIPVENDA,
        MODELO_NOTA: pedidoCompleto.MODELO_NOTA,
        TIPMOV: pedidoCompleto.TIPMOV
      })

      // Usar serviço de sincronização híbrida
      // Definir origem correta baseado na vinculação com lead
      const origem = isLeadVinculado && dadosIniciais?.CODLEAD ? 'LEAD' : 'RAPIDO'
      const result = await PedidoSyncService.salvarPedido(pedidoCompleto, origem)

      if (!result.success) {
        console.error('❌ Erro ao salvar pedido:', result.error);

        // Se for erro de validação ou qualquer erro da API
        if (result.validationError) {
          // Exibir notificação de ERRO na tela
          toast.error("❌ Erro ao criar pedido", {
            description: result.error || "Verifique os dados e tente novamente.",
            duration: 8000,
            position: 'top-center'
          });

          return false;
        }

        // Se foi salvo offline (sem erro de validação)
        if (result.offline) {
          toast.info("📱 Pedido salvo offline", {
            description: "Será sincronizado quando houver conexão.",
            duration: 5000,
            position: 'top-center'
          });

          return false;
        }

        // Erro genérico
        toast.error("❌ Erro ao criar pedido", {
          description: result.error || "Tente novamente.",
          duration: 5000,
          position: 'top-center'
        });

        return false;
      }

      // Extrair nunota corretamente - PedidoSyncService retorna { success: true, nunota }
      const nunotaGerado = result.nunota
      console.log('✅ Pedido criado com NUNOTA:', nunotaGerado)

      // Atualizar lead para GANHO apenas se estiver vinculado
      console.log('🔍 Verificando vinculação do lead:', {
        isLeadVinculado,
        temCODLEAD: !!dadosIniciais?.CODLEAD,
        CODLEAD: dadosIniciais?.CODLEAD
      })

      if (isLeadVinculado === true && dadosIniciais?.CODLEAD) {
        console.log('🔄 Atualizando lead para status GANHO...')
        console.log('📋 CODLEAD do lead:', dadosIniciais.CODLEAD)

        try {
          const responseStatus = await fetch('/api/leads/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codLead: String(dadosIniciais.CODLEAD),
              status: 'GANHO'
            })
          })

          const statusResult = await responseStatus.json()

          if (!responseStatus.ok) {
            console.error('❌ Erro ao atualizar status do lead:', statusResult)
            throw new Error(statusResult.error || 'Erro ao atualizar status do lead')
          }

          console.log('✅ Lead atualizado para GANHO no Oracle:', statusResult)

          toast.success("✅ Pedido criado e lead marcado como GANHO!", {
            description: `NUNOTA: ${nunotaGerado}`,
            duration: 5000,
            position: 'top-center'
          })

          // Pequena pausa para o usuário ver a mensagem
          await new Promise(resolve => setTimeout(resolve, 300))

          console.log('🔄 Chamando onSuccess para atualizar kanban...')
          if (onSuccess) {
            await onSuccess()
          }

          console.log('✅ onSuccess executado com sucesso')

        } catch (syncError: any) {
          console.error('❌ Erro ao sincronizar lead:', syncError)
          console.error('❌ Stack trace:', syncError.stack)
          toast.error('Erro ao atualizar lead', {
            description: syncError.message || 'O pedido foi criado mas houve erro ao atualizar o lead',
            duration: 5000
          })
          throw syncError
        }
      } else {
        // Pedido rápido (sem lead vinculado)
        console.log('✅ Pedido rápido criado (sem vinculação com lead)')

        toast.success("✅ Pedido criado com sucesso!", {
          description: `NUNOTA: ${nunotaGerado}`,
          duration: 5000,
          position: 'top-center'
        })

        // Pequena pausa para o usuário ver a mensagem
        await new Promise(resolve => setTimeout(resolve, 300))

        // Chamar onSuccess se existir (para fechar o modal)
        if (onSuccess) {
          await onSuccess()
        }
      }

      return true
    } catch (error: any) {
      console.error('❌ Erro ao criar pedido:', error)
      // Não mostrar toast aqui - o erro já foi registrado no controle FDV
      return false
    } finally {
      setLoading(false)
    }
  }, [ // Dependências corretas para useCallback
    modeloNota,
    pedido,
    itens,
    dadosIniciais,
    onSuccess,
    setLoading,
    tipoPedidoSelecionado,
    condicaoComercialManual, // Adicionado para garantir que a condição comercial manual seja considerada
    isLeadVinculado,
    regraImpostoSelecionada, // Adicionado para regra de imposto
    regrasImpostos
  ])

  // Passar a função salvarPedido para o componente pai quando disponível
  useEffect(() => {
    if (onSalvarPedido) {
      onSalvarPedido(salvarPedido)
    }
  }, [onSalvarPedido, salvarPedido])

  // Comunicação global com o Header para o carrinho
  useEffect(() => {
    console.log('🔄 useEffect carrinho disparado. Itens:', itens?.length)

    if (typeof window !== 'undefined') {
      const totalItens = Array.isArray(itens) ? itens.length : 0
      console.log('🔔 Atualizando badge do carrinho (From Lead):', totalItens)
      console.log('📦 Itens atuais:', itens)

      ;(window as any).__carrinhoItens = totalItens
      ;(window as any).__abrirCarrinho = (e?: Event) => {
        if (e) {
          e.preventDefault()
          e.stopPropagation()
        }
        console.log('🛒 [LEAD GANHO] Abrindo carrinho - Total itens:', totalItens)
        setShowCarrinhoModalPedido(true)
      }

      // Forçar atualização do header
      const event = new CustomEvent('carrinhoUpdated', {
        detail: {
          total: totalItens,
          itens: itens,
          tipo: 'lead-ganho' // Identificador do tipo de carrinho
        }
      })
      window.dispatchEvent(event)
      console.log('✅ Evento carrinhoUpdated disparado (LEAD GANHO)')
    }

    return () => {
      if (typeof window !== 'undefined') {
        console.log('🧹 Limpando listeners do carrinho')
      }
    }
  }, [itens, itens?.length, setShowCarrinhoModalPedido])

  const handleCancelar = () => {
    // Implementar lógica de cancelamento se necessário, por enquanto chama onCancel
    onCancel?.();
  };

  const handleCriarPedido = async () => {
    const success = await salvarPedido();
    // A navegação ou fechamento do modal é tratado dentro de salvarPedido (via onSuccess)
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <style jsx global>{`
        /* Barra de rolagem customizada para Desktop */
        @media (min-width: 768px) {
          .custom-scroll {
            overflow-y: auto !important;
          }
          .custom-scroll::-webkit-scrollbar {
            width: 8px;
            display: block !important;
          }
          .custom-scroll::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }
          .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        }
        
        /* Sem barra de rolagem para Mobile, mas com scroll ativo */
        @media (max-width: 767px) {
          .custom-scroll {
            overflow-y: auto !important;
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          .custom-scroll::-webkit-scrollbar {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Padronizado - Mobile e Desktop */}
      <div className="flex-shrink-0 bg-[#24292E] border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/20">
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                {isLeadVinculado ? 'Criar Pedido - Lead Ganho' : 'Pedido de Venda'}
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 font-bold">
                  {isLeadVinculado ? 'LEAD' : 'RAPIDO'}
                </Badge>
              </h2>
              <p className="text-xs md:text-sm text-gray-400 font-medium uppercase tracking-wider">
                {pedido.RAZAO_SOCIAL || 'Selecione um parceiro'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Carrinho */}
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🛒 [CARRINHO] Abrindo carrinho lead - Total itens:', itens?.length)
                setShowCarrinhoModalPedido(true)
              }}
              className="relative h-10 w-10 md:h-11 md:w-11 border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <ShoppingCart className="w-5 h-5" />
              {itens && Array.isArray(itens) && itens.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-green-600 text-white text-[10px] font-bold border-2 border-[#24292E] rounded-full shadow-sm">
                  {itens.length}
                </Badge>
              )}
            </Button>
            
            <button 
              onClick={onCancel}
              className="hidden md:flex w-10 h-10 md:w-11 md:h-11 rounded-md bg-white/5 items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="cabecalho" className="flex-1 flex flex-col min-h-0">
        {/* Abas de Navegação - Abaixo do Título */}
        <div className="flex-shrink-0 bg-white border-b shadow-sm overflow-x-auto hide-scrollbar">
          <TabsList className="grid w-full grid-cols-6 h-auto gap-0.5 rounded-none bg-gray-50 flex-shrink-0 border-b border-gray-100">
            <TabsTrigger value="cabecalho" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Cabeçalho
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="mixprodutos" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Mix IA
            </TabsTrigger>
            <TabsTrigger value="impostos" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Impostos
            </TabsTrigger>
            <TabsTrigger value="resumo" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] md:text-sm px-1 md:px-2 py-2 md:py-2.5 rounded-none uppercase font-bold">
              Relatório
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Conteúdo das Abas - Scrollável - Ajustado para ocupar o espaço disponível */}
        <div className="flex-1 custom-scroll bg-gray-50 min-h-0 overflow-y-auto pb-24 md:pb-28">
          <TabsContent value="cabecalho" className="space-y-3 p-4 mt-0 focus-visible:outline-none">
          {/* Seletor de Tipo de Pedido - Movido para dentro do Cabeçalho */}
          <Card className="border-green-200">
            <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">Tipo de Pedido *</Label>
                <Select
                  value={tipoPedidoSelecionado}
                  onValueChange={(value) => {
                    setTipoPedidoSelecionado(value)
                    const tipo = tiposPedido.find(t => String(t.CODTIPOPEDIDO) === value)
                    if (tipo) {
                      aplicarConfiguracoesTipoPedido(tipo)
                    }
                  }}
                >
                  <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                    <SelectValue placeholder="Selecione o tipo de pedido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposPedido.map((tipo) => (
                      <SelectItem key={tipo.CODTIPOPEDIDO} value={String(tipo.CODTIPOPEDIDO)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tipo.COR || '#3b82f6' }}
                          />
                          <span>{tipo.NOME}</span>
                          {tipo.DESCRICAO && (
                            <span className="text-xs text-muted-foreground">- {tipo.DESCRICAO}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Seletor de Regra de Imposto */}
          <Card className="border-blue-200">
            <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">Regra de Imposto (opcional)</Label>
                <Select
                  value={regraImpostoSelecionada}
                  onValueChange={(value) => {
                    setRegraImpostoSelecionada(value)
                    const regra = regrasImpostos.find(r => String(r.ID_REGRA || r.id_regra) === value)
                    if (regra) {
                      console.log('📋 Regra de imposto selecionada:', regra)
                      toast.success(`Regra "${regra.NOME || regra.nome}" selecionada`, {
                        description: `Modelo: ${regra.NOTA_MODELO || regra.nota_modelo} | Natureza: ${regra.CODIGO_NATUREZA || regra.codigo_natureza}`
                      })
                    }
                  }}
                >
                  <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                    <SelectValue placeholder="Selecione a regra de imposto (para cálculo automático)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">
                      <span className="text-gray-500">Nenhuma (não calcular impostos)</span>
                    </SelectItem>
                    {regrasImpostos.map((regra) => {
                      const id = regra.ID_REGRA || regra.id_regra
                      const nome = regra.NOME || regra.nome
                      const descricao = regra.DESCRICAO || regra.descricao
                      const notaModelo = regra.NOTA_MODELO || regra.nota_modelo
                      const codigoNatureza = regra.CODIGO_NATUREZA || regra.codigo_natureza
                      return (
                        <SelectItem key={id} value={String(id)}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span>{nome}</span>
                            {descricao && (
                              <span className="text-xs text-muted-foreground">- {descricao}</span>
                            )}
                            <span className="text-[10px] text-gray-400 ml-2">
                              (Mod: {notaModelo} | Nat: {codigoNatureza})
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {regraImpostoSelecionada && regraImpostoSelecionada !== "0" && (
                  <p className="text-xs text-blue-600 mt-1">
                    O cálculo de impostos será realizado automaticamente ao criar o pedido.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded"></div>
                <span className="text-sm md:text-base font-semibold text-green-800">Dados do Parceiro</span>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div className="space-y-1 md:space-y-2 md:col-span-2">
                  <Label className="text-xs">
                    Parceiro *
                    {pedido.CODPARC && pedido.CODPARC !== "0" && (
                      <span className="ml-2 text-[10px] text-green-600 font-semibold">
                        (✓ Selecionado - Código: {pedido.CODPARC})
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      value={parceiroSearch}
                      onChange={(e) => {
                        const value = e.target.value
                        handleParceiroSearchDebounced(value)
                        // O estado do pedido (CODPARC, CPF_CNPJ, etc.) só deve ser
                        // alterado pela função 'selecionarParceiro' ou pelo 'useEffect'
                      }}
                      onFocus={() => {
                        if (parceiroSearch.length >= 2 && parceiros.length > 0) {
                          setShowParceirosDropdown(true)
                        }
                      }}
                      onBlur={() => {
                        // Aguardar um pouco antes de fechar para permitir o clique
                        setTimeout(() => setShowParceirosDropdown(false), 200)
                      }}
                      placeholder={pedido.CODPARC && pedido.CODPARC !== "0" ? "Parceiro selecionado - clique para alterar" : "Digite o nome do parceiro (min. 2 caracteres)..."}
                      className={`text-sm ${pedido.CODPARC && pedido.CODPARC !== "0" ? 'border-green-500 bg-green-50 font-medium' : ''}`}
                    />

                    {/* Dropdown de parceiros */}
                    {showParceirosDropdown && parceiros.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {parceiros.map((parceiro: any) => (
                          <div
                            key={parceiro.CODPARC}
                            onClick={() => selecionarParceiro(parceiro)}
                            className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            <div className="font-medium">{parceiro.NOMEPARC || parceiro.RAZAOSOCIAL}</div>
                            <div className="text-xs text-gray-500">
                              Código: {parceiro.CODPARC} | {parceiro.CGC_CPF}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">Tipo Cliente *</Label>
                  <Select value={pedido.TIPO_CLIENTE} onValueChange={(value) => setPedido({ ...pedido, TIPO_CLIENTE: value })}>
                    <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                      <SelectItem value="PF">Pessoa Física</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">CPF/CNPJ *</Label>
                  <Input
                    value={pedido.CPF_CNPJ || ''}
                    onChange={(e) => {
                      const valor = e.target.value
                      setPedido(prev => ({ ...prev, CPF_CNPJ: valor }))
                      console.log('📝 CPF/CNPJ atualizado:', valor)
                    }}
                    placeholder="Digite o CPF/CNPJ"
                    className="text-xs md:text-sm h-8 md:h-10"
                  />
                </div>

                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">IE/RG *</Label>
                  <Input
                    value={pedido.IE_RG || ''}
                    onChange={(e) => {
                      const valor = e.target.value
                      setPedido(prev => ({ ...prev, IE_RG: valor }))
                      console.log('📝 IE/RG atualizado:', valor)
                    }}
                    placeholder="Digite a IE/RG"
                    className="text-xs md:text-sm h-8 md:h-10"
                  />
                </div>

                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">Razão Social *</Label>
                  <Input
                    value={pedido.RAZAO_SOCIAL || ''}
                    onChange={(e) => {
                      const valor = e.target.value
                      setPedido(prev => ({ ...prev, RAZAO_SOCIAL: valor }))
                      console.log('📝 Razão Social atualizada:', valor)
                    }}
                    placeholder="Digite a Razão Social"
                    className="text-xs md:text-sm h-8 md:h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded"></div>
                <span className="text-sm md:text-base font-semibold text-green-800">Dados da Nota</span>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">Data Negociação *</Label>
                  <Input
                    type="date"
                    value={pedido.DTNEG}
                    onChange={(e) => setPedido({ ...pedido, DTNEG: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="text-xs md:text-sm h-8 md:h-10"
                  />
                </div>

                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">Vendedor *</Label>
                  <div className="flex gap-1">
                    <Input
                      value={nomeVendedor ? `${nomeVendedor} (${pedido.CODVEND})` : pedido.CODVEND !== "0" ? pedido.CODVEND : "Nenhum vendedor selecionado"}
                      readOnly
                      placeholder="Selecione um vendedor"
                      className="text-xs md:text-sm h-8 md:h-10 bg-gray-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        await carregarVendedores()
                        setShowVendedorModal(true)
                      }}
                      className="h-8 w-8 md:h-10 md:w-10"
                    >
                      <Search className="w-3 h-3 md:w-4 md:h-4" />
                    </Button>
                  </div>
                </div>

                {/* Mensagem de configuração automática */}
                {tipoPedidoSelecionado && (
                  <div className="space-y-1 md:space-y-2 md:col-span-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800">
                        ℹ️ <span className="font-semibold">Configuração automática:</span> Os campos Tipo de Operação, Modelo da Nota e Tipo de Movimento foram configurados automaticamente pelo Tipo de Pedido selecionado.
                      </p>
                    </div>
                  </div>
                )}

                {/* Campo de Condição Comercial - Sempre visível */}
                <div className="space-y-1 md:space-y-2">
                  <Label className="text-xs">
                    Condição Comercial {condicaoComercialManual !== null && (
                      <span className="text-green-600 font-semibold">(Manual)</span>
                    )}
                  </Label>
                  <Select
                    value={pedido.CODTIPVENDA}
                    onValueChange={(value) => {
                      setPedido({ ...pedido, CODTIPVENDA: value })
                      setCondicaoComercialManual(value) // Marcar como escolha manual
                      console.log('✅ Condição Comercial selecionada manualmente:', value)
                    }}
                  >
                    <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                      <SelectValue placeholder="Selecione a condição comercial" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposNegociacao.map((tipo) => (
                        <SelectItem key={tipo.CODTIPVENDA} value={String(tipo.CODTIPVENDA)}>
                          {tipo.CODTIPVENDA} - {tipo.DESCRTIPVENDA}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 md:space-y-2 md:col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Textarea
                    value={pedido.OBSERVACAO}
                    onChange={(e) => setPedido({ ...pedido, OBSERVACAO: e.target.value })}
                    className="text-xs md:text-sm resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Catálogo de Produtos */}
          <TabsContent value="catalogo" className="space-y-3 p-4 mt-0 h-full overflow-y-auto pb-24 md:pb-4">
          <CatalogoProdutosPedido
            // Passar onAdicionarItem para o componente do catálogo
            onAdicionarItem={handleAdicionarItemCarrinho}
            tabelaPreco={tabelaSelecionada}
            tabelasPrecos={tabelasPrecos}
            itensCarrinho={itens || []}
            onAbrirCarrinho={() => setShowCarrinhoModalPedido(true)}
            isPedidoLeadMobile={isMobile}
          />
        </TabsContent>

        {/* Aba Mix de Produtos IA */}
          <TabsContent value="mixprodutos" className="space-y-3 p-4 mt-0 h-full overflow-y-auto pb-24 md:pb-4">
                    <MixProdutosIA
                      codParc={pedido.CODPARC}
                      nomeParceiro={pedido.RAZAO_SOCIAL || (pedido as any).RAZAOSOCIAL || ''}
                      onAdicionarItem={(produto, quantidade, desconto) => {
                        handleAdicionarItemCarrinho(produto, quantidade, desconto)
                      }}
                      onVerPrecos={() => {
                        setShowProdutoModal(false)
                      }}
                      itensCarrinho={itens || []}
                      isPedidoLeadMobile={isMobile}
                    />
          </TabsContent>

        {/* Aba Impostos */}
          <TabsContent value="impostos" className="space-y-3 p-4 mt-0 h-full overflow-y-auto">
            <Card className="border-green-200">
            <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded"></div>
                <span className="text-sm md:text-base font-semibold text-green-800">
                  Impostos {!isOnline && <span className="text-xs text-red-600">(Offline)</span>}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
              {!isOnline ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-sm text-red-800 font-semibold">Modo Offline</p>
                  <p className="text-xs text-red-600 mt-1">Conecte-se à internet para calcular impostos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Aviso de cálculo demonstrativo */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800">
                      ℹ️ <span className="font-semibold">Cálculo Automático:</span> Os impostos são calculados automaticamente a cada alteração nos itens. Os valores são apenas para referência e não serão enviados no pedido.
                    </p>
                  </div>

                  {/* Indicador de carregamento */}
                  {loadingImpostos && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-800">Calculando impostos...</span>
                    </div>
                  )}

                  {/* Tabela de impostos por item */}
                  {impostosItens.length > 0 && (
                    <div className="space-y-3">
                      {impostosItens.map((itemImposto, index) => {
                        const itemOriginal = itens.find(i => Number(i.CODPROD) === itemImposto.codigoProduto)

                        return (
                          <div key={index} className="border border-green-200 rounded-lg overflow-hidden">
                            <div className="bg-green-50 px-3 py-2 border-b border-green-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-semibold text-green-900">
                                    {itemOriginal?.DESCRPROD || `Produto ${itemImposto.codigoProduto}`}
                                  </p>
                                  <p className="text-xs text-green-600">Código: {itemImposto.codigoProduto}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-green-600">Qtd: {itemImposto.quantidade}</p>
                                  <p className="text-xs text-green-600">Valor: {formatCurrency(itemImposto.valorTotal)}</p>
                                </div>
                              </div>
                            </div>

                            {itemImposto.impostos && itemImposto.impostos.length > 0 ? (
                              <div className="p-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Tipo</TableHead>
                                      <TableHead className="text-xs">CST</TableHead>
                                      <TableHead className="text-xs text-right">Alíquota</TableHead>
                                      <TableHead className="text-xs text-right">Base</TableHead>
                                      <TableHead className="text-xs text-right">Valor</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {itemImposto.impostos.map((imposto: any, idx: number) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-xs font-medium">{imposto.tipo}</TableCell>
                                        <TableCell className="text-xs">{imposto.cst}</TableCell>
                                        <TableCell className="text-xs text-right">{imposto.aliquota}%</TableCell>
                                        <TableCell className="text-xs text-right">{formatCurrency(imposto.valorBase)}</TableCell>
                                        <TableCell className="text-xs text-right font-semibold text-blue-700">
                                          {formatCurrency(imposto.valorImposto)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>

                                {/* Total de impostos do item */}
                                <div className="mt-2 pt-2 border-t border-green-200 flex justify-between items-center">
                                  <span className="text-xs font-semibold text-green-800">Total de Impostos:</span>
                                  <span className="text-sm font-bold text-green-700">
                                    {formatCurrency(
                                      itemImposto.impostos.reduce((sum: number, imp: any) => sum + (imp.valorImposto || 0), 0)
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 text-center text-xs text-muted-foreground">
                                Nenhum imposto calculado para este item
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Total geral de impostos */}
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-green-900">Total de Impostos:</span>
                          <span className="text-lg font-bold text-green-700">
                            {formatCurrency(
                              impostosItens.reduce((sum, item) =>
                                sum + (item.impostos?.reduce((s: number, imp: any) => s + (imp.valorImposto || 0), 0) || 0), 0
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Resumo (com gráficos) */}
        {showGraficos && (
          <TabsContent value="resumo" className="space-y-3 p-4 mt-0 h-full overflow-y-auto">
            {itens.length === 0 ? (
              <Card className="border-gray-200">
                <CardContent className="py-10">
                  <div className="text-center text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Adicione produtos ao pedido para ver o resumo</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cards de Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Total de Itens</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-700">{itens.length}</p>
                      <p className="text-xs text-green-500 mt-1">
                        {itens.reduce((sum, item) => sum + item.QTDNEG, 0)} unidades
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Valor Total</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-700">
                        {formatCurrency(calcularTotalPedido())}
                      </p>
                      <p className="text-xs text-green-500 mt-1">Sem descontos</p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Percent className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Desconto Total</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-700">
                        {formatCurrency(
                          itens.reduce((sum, item) => {
                            const vlrDesc = (item.VLRUNIT * item.QTDNEG * item.PERCDESC) / 100
                            return sum + vlrDesc
                          }, 0)
                        )}
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        {(
                          (itens.reduce((sum, item) => sum + (item.VLRUNIT * item.QTDNEG * item.PERCDESC) / 100, 0) /
                            itens.reduce((sum, item) => sum + item.VLRUNIT * item.QTDNEG, 0)) *
                          100
                        ).toFixed(1)}% médio
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Ticket Médio</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-700">
                        {formatCurrency(calcularTotalPedido() / itens.length)}
                      </p>
                      <p className="text-xs text-green-500 mt-1">Por item</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico de Distribuição por Produto */}
                <Card className="border-green-200">
                  <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-green-600 rounded"></div>
                      <span className="text-sm md:text-base font-semibold text-green-800">
                        Distribuição por Produto (Valor)
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
                    <div className="h-[300px] md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={itens.map((item, index) => ({
                              name: item.DESCRPROD?.substring(0, 20) || `Produto ${index + 1}`,
                              value: calcularTotal(item),
                              fill: `hsl(${(index * 360) / itens.length}, 70%, 60%)`
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {itens.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / itens.length}, 70%, 60%)`} />
                            ))}
                          </Pie>
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
                                    <p className="text-xs font-semibold">{payload[0].name}</p>
                                    <p className="text-xs text-green-600">{formatCurrency(payload[0].value as number)}</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico de Barras - Quantidade por Produto */}
                <Card className="border-green-200">
                  <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-green-600 rounded"></div>
                      <span className="text-sm md:text-base font-semibold text-green-800">
                        Quantidade por Produto
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
                    <div className="h-[300px] md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={itens.map((item, index) => ({
                            name: item.DESCRPROD?.substring(0, 15) || `Item ${index + 1}`,
                            quantidade: item.QTDNEG,
                            valor: calcularTotal(item)
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
                                    <p className="text-xs font-semibold">{payload[0].payload.name}</p>
                                    <p className="text-xs text-blue-600">Qtd: {payload[0].value}</p>
                                    <p className="text-xs text-green-600">
                                      Valor: {formatCurrency(payload[0].payload.valor)}
                                    </p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend />
                          <Bar dataKey="quantidade" fill="#16a34a" name="Quantidade" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabela Resumida de Produtos */}
                <Card className="border-green-200">
                  <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-green-600 rounded"></div>
                      <span className="text-sm md:text-base font-semibold text-green-800">
                        Detalhamento dos Itens
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs md:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 font-semibold">Produto</th>
                            <th className="text-center p-2 font-semibold">Qtd</th>
                            <th className="text-right p-2 font-semibold">Vlr. Unit.</th>
                            <th className="text-center p-2 font-semibold">Desc %</th>
                            <th className="text-right p-2 font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((item, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-2">{item.DESCRPROD}</td>
                              <td className="p-2 text-center">{item.QTDNEG}</td>
                              <td className="p-2 text-right">{formatCurrency(item.VLRUNIT)}</td>
                              <td className="p-2 text-center">
                                {item.PERCDESC > 0 ? (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                                    {item.PERCDESC}%
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-2 text-right font-semibold text-green-700">
                                {formatCurrency(calcularTotal(item))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                          <tr>
                            <td className="p-2" colSpan={4}>TOTAL DO PEDIDO:</td>
                            <td className="p-2 text-right text-green-700 text-base">
                              {formatCurrency(calcularTotalPedido())}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

        {/* Aba Relatório */}
        <TabsContent value="relatorio" className="space-y-3 p-4 mt-0 h-full overflow-y-auto">
          <Card className="border-green-200">
            <CardHeader className="px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-green-50 to-green-100">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded"></div>
                <span className="text-sm md:text-base font-semibold text-green-800">Relatório do Pedido</span>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
              {itens.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                  <p className="text-sm text-muted-foreground">Adicione produtos ao pedido para gerar o relatório</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview do Relatório */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
                    <div className="text-center border-b pb-3">
                      <h2 className="text-xl font-bold text-gray-800">PEDIDO DE VENDA</h2>
                      <p className="text-sm text-gray-600 mt-1">Data: {new Date(pedido.DTNEG).toLocaleDateString('pt-BR')}</p>
                    </div>

                    {/* Dados do Cliente */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 border-b pb-1">Dados do Cliente</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Código:</span> {pedido.CODPARC || '-'}
                        </div>
                        <div>
                          <span className="font-medium">Tipo:</span> {pedido.TIPO_CLIENTE || '-'}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Razão Social:</span> {pedido.RAZAO_SOCIAL || '-'}
                        </div>
                        <div>
                          <span className="font-medium">CPF/CNPJ:</span> {pedido.CPF_CNPJ || '-'}
                        </div>
                        <div>
                          <span className="font-medium">IE/RG:</span> {pedido.IE_RG || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Dados do Pedido */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 border-b pb-1">Dados do Pedido</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Vendedor:</span> {nomeVendedor || pedido.CODVEND}
                        </div>
                        <div>
                          <span className="font-medium">Tipo de Operação:</span> {pedido.CODTIPOPER}
                        </div>
                        <div>
                          <span className="font-medium">Condição Comercial:</span> {pedido.CODTIPVENDA}
                        </div>
                        <div>
                          <span className="font-medium">Modelo Nota:</span> {modeloNota || '-'}
                        </div>
                      </div>
                      {pedido.OBSERVACAO && (
                        <div className="text-sm">
                          <span className="font-medium">Observação:</span> {pedido.OBSERVACAO}
                        </div>
                      )}
                    </div>

                    {/* Itens do Pedido */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-700 border-b pb-1">Itens do Pedido</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-2">Produto</th>
                              <th className="text-center p-2">Qtd</th>
                              <th className="text-right p-2">Vlr. Unit.</th>
                              <th className="text-center p-2">Desc %</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itens.map((item, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2">{item.DESCRPROD}</td>
                                <td className="p-2 text-center">{item.QTDNEG}</td>
                                <td className="p-2 text-right">{formatCurrency(item.VLRUNIT)}</td>
                                <td className="p-2 text-center">{item.PERCDESC || 0}%</td>
                                <td className="p-2 text-right">{formatCurrency(calcularTotal(item))}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-bold">
                            <tr>
                              <td colSpan={4} className="p-2 text-right">TOTAL:</td>
                              <td className="p-2 text-right text-green-700">{formatCurrency(calcularTotalPedido())}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Botão para Download */}
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => {
                        try {
                          const doc = new jsPDF()
                          const pageWidth = doc.internal.pageSize.getWidth()

                          // Título
                          doc.setFontSize(18)
                          doc.setFont('helvetica', 'bold')
                          doc.text('PEDIDO DE VENDA', pageWidth / 2, 20, { align: 'center' })

                          doc.setFontSize(10)
                          doc.setFont('helvetica', 'normal')
                          doc.text(`Data: ${new Date(pedido.DTNEG).toLocaleDateString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' })

                          // Dados do Cliente
                          doc.setFontSize(12)
                          doc.setFont('helvetica', 'bold')
                          doc.text('DADOS DO CLIENTE', 14, 40)

                          doc.setFontSize(10)
                          doc.setFont('helvetica', 'normal')
                          let y = 48
                          doc.text(`Código: ${pedido.CODPARC || '-'}`, 14, y)
                          doc.text(`Tipo: ${pedido.TIPO_CLIENTE || '-'}`, 100, y)
                          y += 6
                          doc.text(`Razão Social: ${pedido.RAZAO_SOCIAL || '-'}`, 14, y)
                          y += 6
                          doc.text(`CPF/CNPJ: ${pedido.CPF_CNPJ || '-'}`, 14, y)
                          doc.text(`IE/RG: ${pedido.IE_RG || '-'}`, 100, y)

                          // Dados do Pedido
                          y += 10
                          doc.setFontSize(12)
                          doc.setFont('helvetica', 'bold')
                          doc.text('DADOS DO PEDIDO', 14, y)

                          y += 8
                          doc.setFontSize(10)
                          doc.setFont('helvetica', 'normal')
                          doc.text(`Vendedor: ${nomeVendedor || pedido.CODVEND}`, 14, y)
                          doc.text(`Tipo Operação: ${pedido.CODTIPOPER}`, 100, y)
                          y += 6
                          doc.text(`Condição Comercial: ${pedido.CODTIPVENDA}`, 14, y)
                          doc.text(`Modelo Nota: ${modeloNota || '-'}`, 100, y)

                          if (pedido.OBSERVACAO) {
                            y += 6
                            doc.text(`Observação: ${pedido.OBSERVACAO}`, 14, y)
                          }

                          // Tabela de Itens
                          y += 10
                          const tableData = itens.map(item => [
                            item.DESCRPROD || '-',
                            item.QTDNEG.toString(),
                            formatCurrency(item.VLRUNIT),
                            `${item.PERCDESC || 0}%`,
                            formatCurrency(calcularTotal(item))
                          ])

                          autoTable(doc, {
                            head: [['Produto', 'Qtd', 'Vlr. Unit.', 'Desc %', 'Total']],
                            body: tableData,
                            startY: y,
                            theme: 'grid',
                            headStyles: { fillColor: [22, 163, 74], textColor: 255 },
                            styles: { fontSize: 9 },
                            columnStyles: {
                              1: { halign: 'center' },
                              2: { halign: 'right' },
                              3: { halign: 'center' },
                              4: { halign: 'right' }
                            },
                            foot: [[
                              { content: 'TOTAL DO PEDIDO:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                              { content: formatCurrency(calcularTotalPedido()), styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } }
                            ]],
                            showFoot: 'lastPage'
                          })

                          // Salvar PDF
                          const fileName = `pedido_${pedido.CODPARC || 'novo'}_${new Date().toISOString().split('T')[0]}.pdf`
                          doc.save(fileName)

                          toast.success('PDF gerado com sucesso!', {
                            description: `Arquivo: ${fileName}`
                          })
                        } catch (error) {
                          console.error('Erro ao gerar PDF:', error)
                          toast.error('Erro ao gerar PDF', {
                            description: 'Tente novamente'
                          })
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Baixar Relatório em PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </div>
      </Tabs>

      {/* Modais */}
      <ProdutoSelectorModal
        isOpen={showProdutoModal}
        onClose={() => setShowProdutoModal(false)}
        onConfirm={handleConfirmarProdutoEstoque}
        titulo="Buscar Produto"
      />

      {/* Modal de Estoque */}
      <EstoqueModal
        isOpen={showEstoqueModal}
        onClose={() => {
          setShowEstoqueModal(false)
          setCurrentItemIndex(null)
        }}
        product={produtoEstoqueSelecionado}
        estoqueTotal={produtoEstoque}
        preco={produtoPreco}
        quantidadeInicial={currentItemIndex !== null ? itens[currentItemIndex]?.QTDNEG : 1}
        onConfirm={handleConfirmarProdutoEstoque}
      />

      {/* Modal de Seleção de Vendedor */}
      <Dialog open={showVendedorModal} onOpenChange={setShowVendedorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg text-white">Selecionar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-96 overflow-y-auto space-y-2">
              {vendedores.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Carregando vendedores...
                </div>
              ) : (
                vendedores.map((vendedor) => (
                  <Card
                    key={vendedor.CODVEND}
                    className="cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => {
                      const codVend = String(vendedor.CODVEND)
                      setPedido({ ...pedido, CODVEND: codVend })
                      setNomeVendedor(vendedor.APELIDO)
                      setShowVendedorModal(false)
                      toast.success(`Vendedor ${vendedor.APELIDO} selecionado`)
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{vendedor.APELIDO}</p>
                          <p className="text-xs text-muted-foreground">Cód: {vendedor.CODVEND}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Carrinho do Pedido Lead - Único modal de carrinho */}
      <CarrinhoPedidoLead
        isOpen={showCarrinhoModalPedido}
        onClose={() => setShowCarrinhoModalPedido(false)}
        itens={Array.isArray(itens) ? itens : []}
        total={calcularTotalPedido()}
        formatCurrency={formatCurrency}
        removerItem={removerItem}
        editarItem={handleEditarItem}
        onCancelar={() => {
          setShowCarrinhoModalPedido(false)
        }}
        onCriarPedido={async () => {
          setShowCarrinhoModalPedido(false)
          await handleCriarPedido()
        }}
        loading={loading}
      />

      {/* Modal de Seleção de Unidades */}
      <Dialog open={showUnidadesModal} onOpenChange={setShowUnidadesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Selecionar Unidade</DialogTitle>
          </DialogHeader>
          {produtoUnidades && (
            <div className="space-y-3">
              {produtoUnidades.unidades?.map((unidade: any) => (
                <Card
                  key={unidade.CODVOL}
                  className="cursor-pointer hover:bg-green-50 transition-colors"
                  onClick={() => {
                    // Implementar lógica de seleção de unidade
                    setShowUnidadesModal(false)
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{unidade.CODVOL}</p>
                        <p className="text-xs text-muted-foreground">
                          {unidade.DESCRICAO}
                        </p>
                      </div>
                      <Badge>{unidade.QTDPORCX || 1}x</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Rodapé - Sempre visível */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#24292E] border-t border-white/10 p-2 md:p-3 flex justify-between items-center z-[100]">
        <div className="flex gap-4 md:gap-8 ml-2 md:ml-4">
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Itens</p>
            <p className="text-sm md:text-base font-bold text-white">{itens.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Qtd</p>
            <p className="text-sm md:text-base font-bold text-white">
              {qtdRodape}
            </p>
          </div>
          <div className="bg-green-600/20 px-3 py-1 rounded-md border border-green-500/30">
            <p className="text-[10px] text-green-400 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-sm md:text-lg font-black text-green-400">
              {formatCurrency(totalRodape)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mr-2 md:mr-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold text-xs h-9 px-4 shadow-sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              console.log('🔘 Botão Criar Pedido clicado');
              if (isRapido && onSalvarPedido) {
                console.log('🚀 Disparando onSalvarPedido do pai');
                await salvarPedido();
              } else {
                console.log('🚀 Disparando salvarPedido local');
                await salvarPedido();
              }
            }}
            disabled={loading || itens.length === 0 || totalRodape <= 0}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-9 px-6 shadow-lg shadow-green-900/20"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Criando...
              </>
            ) : (
              'Criar Pedido'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444']