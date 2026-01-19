"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ShoppingCart, Plus, Package, Grid3x3, List, Eye, DollarSign, Boxes } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OfflineDataService } from "@/lib/offline-data-service"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProdutoDetalhesModal } from "@/components/produto-detalhes-modal"
import { ConfiguracaoProdutoModal, ConfiguracaoProduto, UnidadeVolume } from "@/components/configuracao-produto-modal"

interface CatalogoProdutosPedidoProps {
  onAdicionarItem: (produto: any, quantidade: number, desconto?: number) => void
  tabelaPreco?: string
  tabelasPrecos?: any[]
  itensCarrinho: any[]
  onAbrirCarrinho?: () => void
  isPedidoLeadMobile?: boolean
}

export function CatalogoProdutosPedido({
  onAdicionarItem,
  tabelaPreco,
  tabelasPrecos = [],
  itensCarrinho = [],
  onAbrirCarrinho,
  isPedidoLeadMobile = false
}: CatalogoProdutosPedidoProps) {
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState("")
  const [buscaAplicada, setBuscaAplicada] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS")
  const [categorias, setCategorias] = useState<string[]>([])
  const [quantidades, setQuantidades] = useState<{ [key: string]: number }>({})
  const [descontos, setDescontos] = useState<{ [key: string]: number }>({})
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [produtoPrecos, setProdutoPrecos] = useState<any>(null)
  const [showPrecosModal, setShowPrecosModal] = useState(false)
  const [showCarrinhoModal, setShowCarrinhoModal] = useState(false)
  const [showUnidadesModal, setShowUnidadesModal] = useState(false)
  const [produtoUnidades, setProdutoUnidades] = useState<any>(null)
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<{ [key: string]: string }>({})
  const [produtoDetalhes, setProdutoDetalhes] = useState<any>(null)
  const [showDetalhesModal, setShowDetalhesModal] = useState(false)
  const [produtoSelecionadoConfig, setProdutoSelecionadoConfig] = useState<any>(null)
  const [showConfigProdutoModal, setShowConfigProdutoModal] = useState(false)
  const [unidadesProdutoConfig, setUnidadesProdutoConfig] = useState<UnidadeVolume[]>([])
  const [configProdutoInicial, setConfigProdutoInicial] = useState<Partial<ConfiguracaoProduto>>({
    quantidade: 1,
    desconto: 0,
    unidade: 'UN',
    preco: 0
  })
  const [modoVisualizacao, setModoVisualizacao] = useState<'grid' | 'tabela'>('grid')
  const ITENS_POR_PAGINA = 12

  // Estado para gerenciar o carregamento e URL das imagens
  const [produtoImagens, setProdutoImagens] = useState<{ [key: string]: { url: string | null, loading: boolean, loaded: boolean } }>({})

  useEffect(() => {
    carregarProdutos()
  }, [tabelaPreco])

  const buscarImagemProduto = async (codProd: string) => {
    // Retorna imediatamente se a imagem já foi carregada ou está em carregamento
    if (produtoImagens[codProd]?.loaded || produtoImagens[codProd]?.loading) {
      return produtoImagens[codProd]?.url
    }

    // Apenas buscar se estiver online
    if (!navigator.onLine) {
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: null, loading: false, loaded: true }
      }))
      return null
    }

    // Marca como carregando
    setProdutoImagens(prev => ({
      ...prev,
      [codProd]: { url: null, loading: true, loaded: false }
    }))

    try {
      const response = await fetch(`/api/sankhya/produtos/imagem?codProd=${codProd}`)

      if (!response.ok) {
        console.warn(`Imagem não encontrada para produto ${codProd}`)
        setProdutoImagens(prev => ({
          ...prev,
          [codProd]: { url: null, loading: false, loaded: true }
        }))
        return null
      }

      const blob = await response.blob()
      const imageUrl = URL.createObjectURL(blob)

      // Armazena a URL da imagem e marca como carregada
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: imageUrl, loading: false, loaded: true }
      }))

      return imageUrl
    } catch (error) {
      console.error(`Erro ao buscar imagem do produto ${codProd}:`, error)
      setProdutoImagens(prev => ({
        ...prev,
        [codProd]: { url: null, loading: false, loaded: true }
      }))
      return null
    }
  }

  const carregarProdutos = async () => {
    setLoading(true)
    try {
      const produtosData = await OfflineDataService.getProdutos()

      const produtosComDados = produtosData.map((produto: any) => ({
        ...produto,
        preco: parseFloat(produto.AD_VLRUNIT || 0)
      }))

      setProdutos(produtosComDados)

      const categoriasUnicas = [...new Set(
        produtosComDados
          .map(p => p.MARCA || 'SEM MARCA')
          .filter(Boolean)
      )] as string[]

      setCategorias(['TODAS', ...categoriasUnicas.sort()])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  const normalizarTexto = (texto: string) => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  const produtosFiltrados = useMemo(() => {
    const filtrados = produtos.filter(produto => {
      const buscaNormalizada = normalizarTexto(buscaAplicada)
      const descricaoNormalizada = normalizarTexto(produto.DESCRPROD || '')

      const matchBusca = buscaAplicada === "" ||
        descricaoNormalizada.includes(buscaNormalizada) ||
        produto.CODPROD?.toString().includes(buscaAplicada)

      const matchCategoria = categoriaFiltro === "TODAS" ||
        (produto.MARCA || 'SEM MARCA') === categoriaFiltro

      return matchBusca && matchCategoria
    })

    return filtrados
  }, [produtos, buscaAplicada, categoriaFiltro])

  const totalPaginas = Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA)

  const produtosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    const fim = inicio + ITENS_POR_PAGINA
    const pagina = produtosFiltrados.slice(inicio, fim)
    console.log(`📄 Página ${paginaAtual}: mostrando ${pagina.length} produtos (${inicio + 1} a ${Math.min(fim, produtosFiltrados.length)} de ${produtosFiltrados.length})`)
    return pagina
  }, [produtosFiltrados, paginaAtual])

  useEffect(() => {
    setPaginaAtual(1)
  }, [busca, categoriaFiltro])

  // Função para carregar a imagem de um produto específico sob demanda
  const carregarImagemProdutoUnica = (codProd: string) => {
    if (!produtoImagens[codProd]?.url && !produtoImagens[codProd]?.loading) {
      buscarImagemProduto(codProd)
    }
  }

  const getQuantidadeCarrinho = (codProd: string) => {
    const itemCarrinho = itensCarrinho.find(item =>
      String(item.CODPROD) === String(codProd)
    )
    return itemCarrinho?.QTDNEG || 0
  }

  const handleQuantidadeChange = (codProd: string, delta: number) => {
    setQuantidades(prev => {
      const atual = prev[codProd] || 0
      const novo = Math.max(0, atual + delta)
      return { ...prev, [codProd]: novo }
    })
  }

  const handleSelecionarProdutoConfig = async (produto: any) => {
    if (!tabelaPreco || tabelaPreco === '') {
      toast.error('Selecione uma tabela de preço primeiro')
      return
    }
    
    setLoading(true)
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const codProdNumber = Number(produto.CODPROD)
      
      // Buscar no IndexedDB
      const precos = await OfflineDataService.getPrecos(codProdNumber)
      const tabela = tabelasPrecos.find(t => String(t.CODTAB) === String(tabelaPreco))
      
      let precoFinal = parseFloat(produto.AD_VLRUNIT || 0)
      let tabelaPrecoInicial = String(tabelaPreco)
      
      if (tabela && tabela.NUTAB) {
        const precoEncontrado = precos.find(p => Number(p.NUTAB) === Number(tabela.NUTAB))
        if (precoEncontrado && precoEncontrado.VLRVENDA) {
          precoFinal = parseFloat(String(precoEncontrado.VLRVENDA).replace(/,/g, '.'))
          console.log(`✅ Preço inicial do catálogo encontrado no IndexedDB para NUTAB ${tabela.NUTAB}:`, precoFinal)
        }
      }
      
      if (precoFinal === 0) {
        // Fallback para API removido por preferência IndexedDB
        console.warn(`Preço não encontrado no IndexedDB para CODTAB ${tabelaPreco}`)
      }
      
      const volumes = await OfflineDataService.getVolumes(produto.CODPROD)
      const unidades: UnidadeVolume[] = [
        {
          CODVOL: produto.UNIDADE || 'UN',
          DESCRICAO: `${produto.UNIDADE || 'UN'} - Unidade Padrão`,
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
      
      setUnidadesProdutoConfig(unidades)
      setConfigProdutoInicial({
        quantidade: 1,
        desconto: 0,
        unidade: produto.UNIDADE || 'UN',
        preco: 0
      })
      setProdutoSelecionadoConfig({ ...produto, preco: 0 })
      setShowConfigProdutoModal(true)
    } catch (error) {
      console.error('Erro ao carregar preço para configuração:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerUnidades = async (produto: any) => {
    try {
      const volumes = await OfflineDataService.getVolumes(produto.CODPROD)
      console.log('🔍 Volumes alternativos encontrados:', volumes)

      const unidades = [
        {
          CODVOL: produto.UNIDADE || 'UN',
          DESCRICAO: `${produto.UNIDADE || 'UN'} - Unidade Padrão`,
          QUANTIDADE: 1,
          isPadrao: true
        },
        ...volumes.filter((v: any) => v.ATIVO === 'S').map((v: any) => ({
          CODVOL: v.CODVOL,
          DESCRICAO: v.DESCRDANFE || v.CODVOL,
          QUANTIDADE: v.QUANTIDADE || 1,
          isPadrao: false,
          ...v
        }))
      ]

      setProdutoUnidades({ produto, unidades })
      setShowUnidadesModal(true)
    } catch (error) {
      console.error('❌ Erro ao buscar unidades:', error)
      toast.error('Erro ao buscar unidades alternativas')
    }
  }

  const handleVerPrecos = async (produto: any) => {
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      
      // 1. Buscar CODTAB do parceiro (assumindo que está disponível no contexto ou via props)
      // Como CatalogoProdutosPedido não recebe codParc diretamente, vamos tentar pegar o CODTAB do parceiro atual no IndexedDB
      const parceiros = await OfflineDataService.getParceiros()
      // Aqui precisamos de uma forma de saber qual parceiro está selecionado. 
      // Geralmente o codParc está no componente pai ou no state global.
      // Vou buscar o CODTAB da tabelaPreco atual como fallback se não achar o parceiro
      
      const tabelasConfig = await OfflineDataService.getTabelasPrecosConfig()
      const allTabelas = await OfflineDataService.getTabelasPrecos()
      
      // Filtrar tabelas baseadas no CODTAB do parceiro se possível
      // Se tabelaPreco (prop) estiver definida, usamos ela para achar o CODTAB correspondente
      const tabelaAtual = allTabelas.find(t => String(t.CODTAB) === String(tabelaPreco))
      const codTabFiltro = tabelaAtual?.CODTAB || tabelaPreco

      let tabelasParaExibir = allTabelas
      if (codTabFiltro) {
        tabelasParaExibir = allTabelas.filter(t => String(t.CODTAB) === String(codTabFiltro))
      }

      // Se não achou nenhuma tabela específica, usa as configurações padrão
      if (tabelasParaExibir.length === 0) {
        tabelasParaExibir = tabelasConfig
      }

      const precosPromises = tabelasParaExibir.map(async (tabela: any) => {
        const codProdNumber = Number(produto.CODPROD)
        const nutabNumber = Number(tabela.NUTAB)

        const precos = await OfflineDataService.getPrecos(codProdNumber)
        const precoEncontrado = precos.find(p => Number(p.NUTAB) === nutabNumber)

        let preco = 0
        if (precoEncontrado && precoEncontrado.VLRVENDA) {
          let vlrVendaStr = String(precoEncontrado.VLRVENDA).trim()
          vlrVendaStr = vlrVendaStr.replace(/,/g, '.').replace(/\s/g, '')
          preco = parseFloat(vlrVendaStr)
        }

        return {
          tabela: tabela.DESCRICAO || `Tabela ${tabela.CODTAB} (NUTAB ${tabela.NUTAB})`,
          nutab: nutabNumber,
          codtab: tabela.CODTAB,
          preco: preco
        }
      })

      const precosData = await Promise.all(precosPromises)
      setProdutoPrecos({ produto, precos: precosData })
      setShowPrecosModal(true)
    } catch (error) {
      console.error('❌ Erro ao buscar preços:', error)
      toast.error('Erro ao buscar preços')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calcularPrecoComUnidade = (produto: any, unidade: any, precoBase?: number) => {
    const preco = precoBase || produto.preco;
    let precoAjustado;
    let mensagemCalculo = '';

    if (unidade.isPadrao) {
      precoAjustado = preco;
      mensagemCalculo = 'Preço padrão mantido';
    } else {
      if (unidade.QUANTIDADE > 1) {
        precoAjustado = preco * unidade.QUANTIDADE;
        mensagemCalculo = `Preço × ${unidade.QUANTIDADE}`;
      } else if (unidade.QUANTIDADE < 1) {
        precoAjustado = preco * unidade.QUANTIDADE;
        const divisor = Math.round(1 / unidade.QUANTIDADE);
        mensagemCalculo = `Preço ÷ ${divisor}`;
      } else {
        precoAjustado = preco;
        mensagemCalculo = 'Preço mantido';
      }
    }

    return { precoAjustado, mensagemCalculo };
  }

  const handleConfirmarProduto = (config: ConfiguracaoProduto) => {
    if (!produtoSelecionadoConfig) return
    
    const vlrSubtotal = config.preco * config.quantidade
    const vlrDesconto = (vlrSubtotal * config.desconto) / 100
    const vlrTotal = vlrSubtotal - vlrDesconto

    onAdicionarItem({
      ...produtoSelecionadoConfig,
      CODPROD: String(produtoSelecionadoConfig.CODPROD),
      DESCRPROD: produtoSelecionadoConfig.DESCRPROD,
      CODVOL: config.unidade,
      UNIDADE: config.unidade,
      VLRUNIT: config.preco,
      preco: config.preco,
      VLRTOT: vlrTotal,
      VLRDESC: vlrDesconto,
      PERCDESC: config.desconto,
      QTDNEG: config.quantidade,
      CONTROLE: config.controle || ' ',
      TABELA_PRECO: config.tabelaPreco || 'PADRAO',
      MARCA: produtoSelecionadoConfig.MARCA
    }, config.quantidade, config.desconto)

    toast.success("Produto adicionado ao carrinho", {
      description: `${produtoSelecionadoConfig.DESCRPROD} - ${config.quantidade} ${config.unidade}`
    })
    
    setShowConfigProdutoModal(false)
    setProdutoSelecionadoConfig(null)
  }
  
  const handleVerPrecosConfig = () => {
    if (produtoSelecionadoConfig) {
      handleVerPrecos(produtoSelecionadoConfig)
    }
  }

  const handleVerDetalhes = (produto: any) => {
    setProdutoDetalhes(produto)
    setShowDetalhesModal(true)
  }

  const handleSelecionarUnidade = async (produto: any, unidade: any) => {
    setProdutoSelecionadoConfig(produto)
    
    // Calcular preço ajustado baseado na unidade
    const { precoAjustado } = calcularPrecoComUnidade(produto, unidade, produto.preco)
    
    setConfigProdutoInicial({
      quantidade: 1,
      desconto: 0,
      unidade: unidade.CODVOL,
      preco: precoAjustado
    })
    setUnidadesProdutoConfig(produtoUnidades?.unidades || [])
    setShowUnidadesModal(false)
    setShowConfigProdutoModal(true)
  }

  if (loading && produtosPaginados.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="ml-3 text-sm font-medium text-green-600">Carregando produtos...</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Loading Unificado - Mais Visível */}
        {(!Object.values(produtoImagens).every(img => img.loaded) || loading) && produtosPaginados.length > 0 && (
          <div className="sticky top-0 z-10 bg-green-50 border border-green-200 rounded-lg p-3 shadow-md">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-green-700">
                {loading ? 'Carregando produtos...' : 'Carregando imagens...'}
              </p>
            </div>
          </div>
        )}

        {/* Cabeçalho com Busca e Modo de Visualização */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setBuscaAplicada(busca)
                  setPaginaAtual(1)
                }
              }}
              className="pl-10"
            />
          </div>

          {/* Botões de Modo de Visualização - Apenas Desktop */}
          <div className="hidden md:flex gap-1 border rounded-md p-1">
            <Button
              variant={modoVisualizacao === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('grid')}
              className={modoVisualizacao === 'grid' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={modoVisualizacao === 'tabela' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('tabela')}
              className={modoVisualizacao === 'tabela' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="default"
            size="default"
            onClick={() => {
              setBuscaAplicada(busca)
              setPaginaAtual(1)
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Search className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtrar</span>
          </Button>
        </div>

        {/* Filtros Rápidos - Estilo Stories */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categorias.map((categoria) => (
              <Button
                key={categoria}
                variant={categoriaFiltro === categoria ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoriaFiltro(categoria)}
                className={`
                  rounded-full px-4 flex-shrink-0 transition-all
                  ${categoriaFiltro === categoria
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
                    : 'hover:scale-105'
                  }
                `}
              >
                {categoria}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Modo Tabela - Apenas Desktop */}
        {modoVisualizacao === 'tabela' && (
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[80px] text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosPaginados.map((produto) => {
                  const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)

                  return (
                    <TableRow key={produto.CODPROD}>
                      <TableCell className="font-mono text-xs">
                        {produto.CODPROD}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm line-clamp-2">
                            {produto.DESCRPROD}
                          </span>
                          {qtdCarrinho > 0 && (
                            <span className="text-xs text-green-600">
                              {qtdCarrinho} no carrinho
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setProdutoSelecionadoConfig(produto)
                            setShowConfigProdutoModal(true)
                          }}
                          className="bg-green-600 hover:bg-green-700 h-8 w-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {produtosFiltrados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            )}
          </div>
        )}

        {/* Grade de Produtos - Desktop */}
        {modoVisualizacao === 'grid' && (
          <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {produtosPaginados.map((produto) => {
              const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)

              return (
                <Card key={produto.CODPROD} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="relative">
                    <div
                      className="w-full h-32 bg-white border-b flex items-center justify-center overflow-hidden relative cursor-pointer"
                    >
                      {produtoImagens[produto.CODPROD]?.loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : produtoImagens[produto.CODPROD]?.url ? (
                        <img
                          src={produtoImagens[produto.CODPROD].url || undefined}
                          alt={produto.DESCRPROD}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                            // Marca como erro para não tentar carregar de novo
                            setProdutoImagens(prev => ({
                              ...prev,
                              [produto.CODPROD]: { url: null, loading: false, loaded: true }
                            }))
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center bg-white w-full h-full relative group">
                          <div className="text-6xl text-gray-300 font-bold">
                            {produto.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">Sem imagem</div>
                          
                          {/* Botão para carregar imagem manualmente se não houver */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute inset-0 m-auto w-24 h-8 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              carregarImagemProdutoUnica(produto.CODPROD);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Ver Imagem
                          </Button>
                        </div>
                      )}
                    </div>

                        {/* Botão "Abrir Imagem" */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white hover:bg-black/70 backdrop-blur-sm rounded-full h-8 px-3"
                          onClick={() => {
                            carregarImagemProdutoUnica(produto.CODPROD)
                          }}
                          disabled={produtoImagens[produto.CODPROD]?.loading}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          <span className="text-xs">Abrir</span>
                        </Button>
                  </div>

                  <CardContent className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">
                        {produto.DESCRPROD}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cód: {produto.CODPROD}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      onClick={() => {
                        setProdutoSelecionadoConfig(produto)
                        setShowConfigProdutoModal(true)
                      }}
                      className="w-full h-10 rounded-full bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>

                    {qtdCarrinho > 0 && (
                      <div className="text-[10px] text-center text-green-600 font-medium">
                        {qtdCarrinho} no carrinho
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Lista de Produtos - Mobile (Lista Vertical) */}
        <div className="md:hidden space-y-2 pb-4">
          {produtosPaginados.map((produto) => {
            const qtdCarrinho = getQuantidadeCarrinho(produto.CODPROD)
            const imagemUrl = produtoImagens[produto.CODPROD]?.url

            return (
              <Card key={produto.CODPROD} className="border-gray-100 overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-20 h-20 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                      {produtoImagens[produto.CODPROD]?.loading ? (
                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      ) : imagemUrl ? (
                        <img src={imagemUrl} alt={produto.DESCRPROD} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full group">
                          <span className="text-2xl font-bold text-gray-300">
                            {produto.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute inset-0 w-full h-full bg-black/5 opacity-0 active:opacity-100 transition-opacity"
                            onClick={() => carregarImagemProdutoUnica(produto.CODPROD)}
                          >
                            <Eye className="w-4 h-4 text-gray-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">
                          {produto.DESCRPROD}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-1">Cód: {produto.CODPROD}</p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {qtdCarrinho > 0 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] px-1.5 h-5 border-none">
                              {qtdCarrinho}
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            onClick={() => {
                              setProdutoSelecionadoConfig(produto)
                              setShowConfigProdutoModal(true)
                            }}
                            className="h-8 w-8 rounded-full bg-green-600 hover:bg-green-700 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {produtosFiltrados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum produto encontrado
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
              disabled={paginaAtual === 1}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
              disabled={paginaAtual === totalPaginas}
            >
              Próxima
            </Button>
          </div>
        )}

        {/* Modal de Preços */}
        <Dialog open={showPrecosModal} onOpenChange={setShowPrecosModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Escolher Preço de Tabela</DialogTitle>
            </DialogHeader>
            {produtoPrecos && (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">{produtoPrecos.produto.DESCRPROD}</p>
                  <p className="text-sm text-muted-foreground">Cód: {produtoPrecos.produto.CODPROD}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtoPrecos.precos.map((preco: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{preco.tabela}</span>
                            <span className="text-xs text-muted-foreground">
                              NUTAB: {preco.nutab} | CODTAB: {preco.codtab}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {preco.preco > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-green-600">
                                {formatCurrency(preco.preco)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem preço</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={preco.preco > 0 ? "default" : "outline"}
                            onClick={() => {
                              if (preco.preco > 0) {
                                const produto = produtoPrecos.produto;
                                const unidadeSelecionada = unidadesSelecionadas[produto.CODPROD];

                                if (unidadeSelecionada && produtoUnidades?.unidades) {
                                  const unidadeInfo = produtoUnidades.unidades.find((u: any) => u.CODVOL === unidadeSelecionada);
                                  if (unidadeInfo) {
                                    const { precoAjustado } = calcularPrecoComUnidade(
                                      { ...produto, preco: preco.preco },
                                      unidadeInfo,
                                      preco.preco
                                    );
                                    setQuantidades(prev => ({
                                      ...prev,
                                      [produto.CODPROD + '_preco']: precoAjustado
                                    }))
                                    toast.success(`Preço de ${preco.tabela} aplicado com unidade ${unidadeSelecionada}`, {
                                      description: formatCurrency(precoAjustado)
                                    })
                                  } else {
                                    setQuantidades(prev => ({
                                      ...prev,
                                      [produto.CODPROD + '_preco']: preco.preco
                                    }))
                                    toast.success(`Preço de ${preco.tabela} aplicado: ${formatCurrency(preco.preco)}`)
                                  }
                                } else {
                                  setQuantidades(prev => ({
                                    ...prev,
                                    [produto.CODPROD + '_preco']: preco.preco
                                  }))
                                  toast.success(`Preço de ${preco.tabela} aplicado: ${formatCurrency(preco.preco)}`)
                                }
                                setShowPrecosModal(false)
                              } else {
                                toast.warning('Esta tabela não possui preço cadastrado para este produto')
                              }
                            }}
                            disabled={preco.preco <= 0}
                            className="w-full"
                          >
                            {preco.preco > 0 ? 'Aplicar' : 'Sem Preço'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes do Produto */}
        <ProdutoDetalhesModal
          produto={produtoDetalhes}
          isOpen={showDetalhesModal}
          onClose={() => setShowDetalhesModal(false)}
        />

        {/* Modal de Unidades Alternativas */}
        <Dialog open={showUnidadesModal} onOpenChange={setShowUnidadesModal}>
          <DialogContent className="max-w-lg md:max-h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-green-600" />
                Unidades Disponíveis
              </DialogTitle>
            </DialogHeader>
            {produtoUnidades && (
              <div className="flex flex-col gap-3 md:min-h-0">
                <div className="flex-shrink-0">
                  <p className="font-semibold text-sm">{produtoUnidades.produto.DESCRPROD}</p>
                  <p className="text-xs text-muted-foreground">Cód: {produtoUnidades.produto.CODPROD}</p>
                </div>
                <div className="md:hidden space-y-2">
                  {produtoUnidades.unidades.map((unidade: any, index: number) => (
                    <Card key={index} className="border-green-100">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{unidade.CODVOL}</span>
                              {unidade.isPadrao && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  Padrão
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {unidade.DESCRICAO}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              Qtd: <span className="font-semibold">{unidade.QUANTIDADE}</span>
                              {unidade.QUANTIDADE > 1 && (
                                <span className="text-xs text-orange-600 ml-2">
                                  (Preço será ajustado)
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSelecionarUnidade(produtoUnidades.produto, unidade)}
                            className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-8"
                          >
                            Selecionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollArea className="hidden md:flex flex-1 -mx-6 px-6">
                  <div className="space-y-2 pr-4">
                    {produtoUnidades.unidades.map((unidade: any, index: number) => (
                      <Card key={index} className="border-green-100">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{unidade.CODVOL}</span>
                                {unidade.isPadrao && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Padrão
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {unidade.DESCRICAO}
                              </p>
                              <p className="text-xs text-green-600 mt-1">
                                Qtd: <span className="font-semibold">{unidade.QUANTIDADE}</span>
                                {unidade.QUANTIDADE > 1 && (
                                  <span className="text-xs text-orange-600 ml-2">
                                    (Preço será ajustado)
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSelecionarUnidade(produtoUnidades.produto, unidade)}
                              className="bg-green-600 hover:bg-green-700 flex-shrink-0 h-8"
                            >
                              Selecionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfiguracaoProdutoModal
          open={showConfigProdutoModal}
          onOpenChange={setShowConfigProdutoModal}
          produto={produtoSelecionadoConfig}
          imagemUrl={produtoSelecionadoConfig ? produtoImagens[produtoSelecionadoConfig.CODPROD]?.url : null}
          unidades={unidadesProdutoConfig}
          tabelasPrecos={tabelasPrecos}
          configInicial={configProdutoInicial}
          onConfirmar={handleConfirmarProduto}
          onVerPrecos={handleVerPrecosConfig}
        onTabelaPrecoChange={async (codTab) => {
          if (!produtoSelecionadoConfig) return
          try {
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            
            // 1. Buscar no IndexedDB primeiro
            const precos = await OfflineDataService.getPrecos(Number(produtoSelecionadoConfig.CODPROD))
            
            // Encontrar o NUTAB correspondente ao CODTAB
            const tabela = tabelasPrecos.find(t => String(t.CODTAB) === String(codTab))
            
            if (tabela && tabela.NUTAB) {
              const precoEncontrado = precos.find(p => Number(p.NUTAB) === Number(tabela.NUTAB))
              if (precoEncontrado && precoEncontrado.VLRVENDA) {
                const valor = parseFloat(String(precoEncontrado.VLRVENDA).replace(/,/g, '.'))
                console.log(`✅ Preço encontrado no IndexedDB para NUTAB ${tabela.NUTAB}:`, valor)
                setConfigProdutoInicial(prev => ({ ...prev, preco: valor, tabelaPreco: codTab }))
                return
              }
            }

            // 2. Fallback para API removido por preferência IndexedDB
            console.warn(`Preço não encontrado no IndexedDB para CODTAB ${codTab} (NUTAB ${tabela?.NUTAB})`)
          } catch (error) {
            console.error('Erro ao buscar preço da tabela no catálogo:', error)
          }
        }}
          modo="adicionar"
          disabled={!tabelaPreco}
        />

      </div>
    </>
  )
}