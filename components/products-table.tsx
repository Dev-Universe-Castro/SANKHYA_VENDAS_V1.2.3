"use client"

import { useState, useEffect, useRef } from "react"
import { Search, ChevronLeft, ChevronRight, Package, Eye, ChevronDown, ChevronUp, WifiOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OfflineDataService } from '@/lib/offline-data-service'
import { ProdutoDetalhesModal } from "@/components/produto-detalhes-modal"


interface Produto {
  _id: string
  CODPROD: string
  DESCRPROD: string
  ATIVO: string
  LOCAL?: string
  MARCA?: string
  CARACTERISTICAS?: string
  UNIDADE?: string
  VLRCOMERC?: string
  ESTOQUE?: string
  estoqueTotal?: number // Adicionado para o modal
  preco?: number       // Adicionado para o modal
  estoques?: any[]     // Adicionado para o modal
}

interface PaginatedResponse {
  produtos: Produto[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ITEMS_PER_PAGE = 20

export default function ProductsTable() {
  const [produtos, setProdutos] = useState<any[]>([])
  const [produtosFiltrados, setProdutosFiltrados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [appliedSearchName, setAppliedSearchName] = useState("") // Estado para o nome de busca aplicado
  const [appliedSearchCode, setAppliedSearchCode] = useState("") // Estado para o código de busca aplicado
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const { toast } = useToast()
  const loadingRef = useRef(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false) // Estado para controlar filtros colapsáveis
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [produtoSelecionado, setSelectedProduct] = useState<Produto | null>(null)
  const [showDetalhesModal, setShowDetalhesModal] = useState(false)


  useEffect(() => {
    const handleOnline = () => {
      console.log("✅ Conexão restabelecida!")
      setIsOffline(false)
      // Tenta recarregar os produtos quando a conexão volta
      loadProducts().finally(() => {
        toast({
          title: "Conectado",
          description: "Sua conexão foi restabelecida. Os dados foram atualizados.",
          variant: "default",
        });
      })
    }
    const handleOffline = () => {
      console.log("⚠️ Modo Offline!")
      setIsOffline(true)
      // Ao ficar offline, carrega os dados do cache local
      loadProducts().finally(() => {
        toast({
          title: "Modo Offline",
          description: "Você está sem conexão. Exibindo dados em cache.",
          variant: "default",
        });
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verifica o estado inicial da conexão ao montar o componente
    if (navigator.onLine) {
      handleOnline()
    } else {
      handleOffline()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])


  useEffect(() => {
    if (loadingRef.current) {
      console.log('⏭️ Pulando requisição duplicada (Strict Mode)')
      return
    }

    loadingRef.current = true
    loadProducts().finally(() => {
      loadingRef.current = false
    })
  }, [currentPage, isOffline]) // Requisita novamente se a página ou o status offline mudar


  // Carregar produtos do cache ao montar o componente (apenas se já estiver offline)
  useEffect(() => {
    if (isOffline) {
      const cached = sessionStorage.getItem('cached_produtos');
      if (cached) {
        try {
          const parsedData = JSON.parse(cached)
          const allProdutos = Array.isArray(parsedData) ? parsedData : (parsedData.produtos || [])

          if (allProdutos.length > 0) {
            console.log('✅ Carregando produtos iniciais do cache (offline):', allProdutos.length)
            setProdutos(allProdutos.slice(0, ITEMS_PER_PAGE));
            setTotalPages(Math.ceil(allProdutos.length / ITEMS_PER_PAGE));
            setTotalRecords(allProdutos.length);
            setLoading(false); // Altera o estado de loading
          }
        } catch (e) {
          console.error('Erro ao carregar cache inicial de produtos (offline):', e)
          sessionStorage.removeItem('cached_produtos');
        }
      } else {
        // Se não houver cache e estiver offline, tenta carregar do serviço offline
        loadProductsOfflineFallback();
      }
    }
  }, [isOffline]); // Executa apenas uma vez ao montar o componente ou quando o status offline muda para true


  


  // Função para aplicar filtros ao clicar no botão
  const handleSearch = () => {
    setAppliedSearchName(searchName)
    setAppliedSearchCode(searchCode)
    setCurrentPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalRecords)

  // Função para carregar produtos do IndexedDB e aplicar filtros
  const loadProducts = async (retryCount = 0) => {
    try {
      setLoading(true)

      console.log('📦 Carregando produtos do IndexedDB...')

      // Buscar TODOS os produtos do IndexedDB
      const todosProdutos = await OfflineDataService.getProdutos()

      if (todosProdutos.length === 0) {
        if (retryCount < 3) {
          console.warn(`⚠️ Nenhum produto encontrado. Tentativa ${retryCount + 1} de 3...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadProducts(retryCount + 1)
        }
        console.warn('⚠️ Nenhum produto encontrado no IndexedDB após retentativas')
        setProdutos([])
        setTotalRecords(0)
        setTotalPages(0)
        setProdutosFiltrados([])
        return
      }

      // Carregar produtos
      setProdutos(todosProdutos)
      console.log(`✅ ${todosProdutos.length} produtos carregados do IndexedDB`)

      // Aplicar filtros localmente com base nos termos aplicados
      aplicarFiltros(todosProdutos, currentPage)

    } catch (error) {
      console.error('❌ Erro ao carregar produtos do IndexedDB:', error)
      setProdutos([])
      setProdutosFiltrados([])
    } finally {
      setLoading(false)
    }
  }

  // Fallback para carregar produtos do serviço offline (se aplicável)
  const loadProductsOfflineFallback = async () => {
    console.warn("⚠️ Tentando carregar produtos do serviço offline como fallback...")
    // Implemente a lógica de carregamento do serviço offline aqui, se necessário
    // Por enquanto, apenas exibe um aviso
      toast({
        title: "Modo Offline",
        description: "Não foi possível carregar dados do cache. Verifique sua conexão.",
        variant: "destructive",
      });
  }

  // Nova função para aplicar filtros localmente e gerenciar paginação
  const aplicarFiltros = (todosProdutos: any[], page: number) => {
    let produtosFiltrados = [...todosProdutos]

    // Filtrar por nome aplicado
    if (appliedSearchName.trim()) {
      const searchLower = appliedSearchName.toLowerCase()
      produtosFiltrados = produtosFiltrados.filter(p =>
        p.DESCRPROD?.toLowerCase().includes(searchLower)
      )
    }

    // Filtrar por código aplicado
    if (appliedSearchCode.trim()) {
      produtosFiltrados = produtosFiltrados.filter(p =>
        p.CODPROD?.toString().includes(appliedSearchCode)
      )
    }

    // Paginação
    const total = produtosFiltrados.length
    const totalPgs = Math.ceil(total / ITEMS_PER_PAGE)
    const startIdx = (page - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    const produtosPaginados = produtosFiltrados.slice(startIdx, endIdx)

    setProdutosFiltrados(produtosPaginados)
    setTotalRecords(total)
    setTotalPages(totalPgs)
    setCurrentPage(page)

    console.log(`📊 Filtros aplicados: ${total} produtos encontrados (exibindo ${produtosPaginados.length})`)
  }

  // Carrega produtos iniciais ao montar o componente
  useEffect(() => {
    loadProducts()
  }, []) // Executa apenas uma vez ao montar

  // Aplica filtros quando os termos de busca ATUAIS (aplicados) mudam
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (produtos.length > 0) {
        // Aplica filtros com base nos termos JÁ DEFINIDOS (appliedSearchName, appliedSearchCode)
        aplicarFiltros(produtos, 1) // Reseta para a página 1 ao mudar filtros aplicados
      } else {
        loadProducts() // Carrega produtos se a lista estiver vazia
      }
    }, 500) // Atraso de 500ms para debounce

    return () => clearTimeout(delayDebounceFn)
  }, [appliedSearchName, appliedSearchCode]) // Depende dos termos de busca aplicados

  // Atualiza a lista de produtos exibidos quando a paginação muda
  useEffect(() => {
    // Só aplica filtros se houver produtos carregados
    if (produtos.length > 0) {
      aplicarFiltros(produtos, currentPage)
    }
  }, [currentPage, produtos.length]) // Depende da página e do tamanho da lista de produtos

  const abrirModal = async (produto: any) => {
    // Verificar se existe um parceiro selecionado (via sessionStorage ou contexto)
    const orderHeader = sessionStorage.getItem('novo_pedido_header')
    const headerData = orderHeader ? JSON.parse(orderHeader) : null
    const codParc = headerData?.CODPARC

    if (!codParc || codParc === "0") {
      toast({
        title: "Atenção",
        description: "Selecione um parceiro no cabeçalho antes de adicionar produtos ao catálogo.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Buscar dados do parceiro para obter a tabela de preço preferencial
      const parceiros = await OfflineDataService.getParceiros()
      const parceiro = parceiros.find(p => String(p.CODPARC) === String(codParc))
      
      let codTabFinal: string | null = null
      if (parceiro?.CODTAB && Number(parceiro.CODTAB) > 0) {
        codTabFinal = String(parceiro.CODTAB)
      } else {
        const configs = await OfflineDataService.getTabelasPrecosConfig()
        if (configs && configs.length > 0) {
          codTabFinal = String(configs[0].CODTAB)
        }
      }

      // Anexar informações de preço baseadas na tabela ao produto para o modal
      if (codTabFinal) {
        const precos = await OfflineDataService.getPrecos(Number(produto.CODPROD))
        const tabelas = await OfflineDataService.getTabelasPrecos()
        const tabela = tabelas.find(t => String(t.CODTAB) === String(codTabFinal))
        
        if (tabela && tabela.NUTAB) {
          // Usar a mesma lógica de busca resiliente do modal
          const precoEncontrado = precos.find(p => {
            const pNutab = p.NUTAB !== undefined ? p.NUTAB : p.nutab;
            return pNutab !== undefined && pNutab !== null && Number(pNutab) === Number(tabela.NUTAB);
          });

          if (precoEncontrado) {
            const valorRaw = precoEncontrado.VLRVENDA !== undefined ? precoEncontrado.VLRVENDA : 
                             precoEncontrado.vlrVenda !== undefined ? precoEncontrado.vlrVenda : 
                             precoEncontrado.PRECO;

            if (valorRaw != null) {
              const valor = typeof valorRaw === 'string' 
                ? parseFloat(valorRaw.replace(',', '.')) 
                : parseFloat(valorRaw)
              
              if (!isNaN(valor)) {
                produto.preco = valor
                console.log(`✅ Preço do catálogo definido por CODTAB ${codTabFinal} (NUTAB ${tabela.NUTAB}):`, produto.preco)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro ao processar tabela de preço no catálogo:", error)
    } finally {
      setLoading(false)
    }

    setSelectedProduct(produto)
    setShowDetalhesModal(true)
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
      '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
      '#A855F7', '#EC4899', '#F43F5E'
    ];
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  }

  // Filtra produtos com base no termo de busca, considerando todos os campos relevantes
  // Esta parte parece redundante com aplicarFiltros, mas pode ser usada para pré-visualização
  const filteredProducts = searchName || searchCode
    ? produtosFiltrados.filter(produto =>
        (searchCode ? produto.CODPROD?.toString().includes(searchCode) : true) &&
        (searchName ? produto.DESCRPROD?.toLowerCase().includes(searchName.toLowerCase()) : true)
      )
    : produtosFiltrados; // Usa a lista já filtrada e paginada

  return (
    <div className="h-full flex flex-col">
      {/* Header - Desktop */}
      <div className="hidden md:block border-b p-6">
        <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
        <p className="text-muted-foreground">
          Consulta e gerenciamento de produtos
        </p>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden border-b px-3 py-3">
        <h1 className="text-lg font-bold">Produtos</h1>
        <p className="text-xs text-muted-foreground">
          Consulta e gerenciamento de produtos
        </p>
      </div>

      {/* Filtros de Busca - Desktop */}
      <div className="hidden md:block border-b p-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="searchCode" className="text-xs md:text-sm font-medium">
                  Código
                </Label>
                <Input
                  id="searchCode"
                  type="text"
                  placeholder="Buscar por código"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="searchName" className="text-xs md:text-sm font-medium">
                  Descrição
                </Label>
                <Input
                  id="searchName"
                  type="text"
                  placeholder="Buscar por descrição"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5 md:self-end">
                <Label className="text-xs md:text-sm font-medium opacity-0 hidden md:block">Ação</Label>
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Buscando...' : 'Buscar Produtos'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros de Busca - Mobile (Colapsável) */}
      <div className="md:hidden border-b">
        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
            >
              <span className="font-medium">Filtros de Busca</span>
              {filtrosAbertos ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card>
              <CardContent className="p-4 space-y-4 bg-muted/30">
                <div className="space-y-1.5">
                  <Label htmlFor="searchCodeMobile" className="text-xs md:text-sm font-medium">
                    Código
                  </Label>
                  <Input
                    id="searchCodeMobile"
                    type="text"
                    placeholder="Buscar por código"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="searchNameMobile" className="text-xs md:text-sm font-medium">
                    Descrição
                  </Label>
                  <Input
                    id="searchNameMobile"
                    type="text"
                    placeholder="Buscar por descrição"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Buscando...' : 'Buscar Produtos'}
                </Button>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {(appliedSearchName || appliedSearchCode) && (
        <div className="md:hidden p-4">
          <Button
            onClick={() => {
              setSearchName("")
              setSearchCode("")
              setAppliedSearchName("")
              setAppliedSearchCode("")
              setCurrentPage(1)
              setTimeout(() => {
                loadProducts() // Recarrega todos os produtos sem filtros aplicados
              }, 0)
            }}
            variant="outline"
            className="w-full"
          >
            Limpar Filtros
          </Button>
        </div>
      )}

      {/* Lista de Produtos - Grid Responsivo */}
      <div className="flex-1 overflow-auto p-4 md:p-6 mt-4 md:mt-0">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-sm font-medium text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {isOffline ? "Nenhum produto encontrado em cache." : "Nenhum produto encontrado"}
          </div>
        ) : (
          <>
            {/* Grid Desktop */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {produtosFiltrados.map((product) => {
                const avatarColor = getAvatarColor(product.DESCRPROD || 'P');
                const initials = (product.DESCRPROD || 'P')
                  .split(' ')
                  .filter((word: string) => word.length > 0)
                  .slice(0, 2)
                  .map((word: string) => word[0])
                  .join('')
                  .toUpperCase();

                return (
                  <Card key={product._id || product.CODPROD} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="relative">
                      {/* Placeholder com inicial e botão de imagem */}
                      <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 border-b flex flex-col items-center justify-center gap-2">
                        <div className="text-4xl text-gray-300 font-bold">
                          {product.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirModal(product)}
                          className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 h-auto py-1 px-2"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Abrir imagem
                        </Button>
                      </div>
                    </div>

                    <CardContent className="p-3 space-y-2">
                      {/* Status Badge */}
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-[10px] text-green-600 font-medium">Ativo</span>
                      </div>

                      {/* Nome e Código */}
                      <div>
                        <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">
                          {product.DESCRPROD}
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Cód: {product.CODPROD}
                        </p>
                      </div>

                      {/* Informações adicionais */}
                      {(product.MARCA || product.UNIDADE) && (
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          {product.MARCA && <p>Marca: {product.MARCA}</p>}
                          {product.UNIDADE && <p>Un: {product.UNIDADE}</p>}
                        </div>
                      )}

                      {/* Botão Detalhes */}
                      <Button
                        size="sm"
                        onClick={() => abrirModal(product)}
                        className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Detalhes
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Lista Mobile */}
            <div className="md:hidden space-y-2">
              {produtosFiltrados.map((product) => {
                const avatarColor = getAvatarColor(product.DESCRPROD || 'P');
                const initials = (product.DESCRPROD || 'P')
                  .split(' ')
                  .filter((word: string) => word.length > 0)
                  .slice(0, 2)
                  .map((word: string) => word[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={product._id || product.CODPROD}
                    className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-3">
                      {/* Placeholder com inicial */}
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 border rounded-lg flex items-center justify-center flex-shrink-0">
                        <div className="text-xl text-gray-400 font-bold">
                          {product.DESCRPROD?.charAt(0).toUpperCase() || 'P'}
                        </div>
                      </div>

                      {/* Informações do Produto */}
                      <div className="flex-1 min-w-0">
                        {/* Status Badge */}
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-[10px] text-green-600 font-medium">Ativo</span>
                        </div>

                        {/* Nome do Produto */}
                        <h3 className="font-semibold text-sm line-clamp-2 mb-0.5">
                          {product.DESCRPROD}
                        </h3>

                        {/* Código do Produto */}
                        <p className="text-xs text-muted-foreground">
                          Cód: {product.CODPROD}
                        </p>
                        
                        {/* Botão Ver Imagem */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirModal(product)}
                          className="text-[10px] text-green-600 hover:text-green-700 h-auto py-0.5 px-1 mt-1"
                        >
                          <Eye className="w-3 h-3 mr-0.5" />
                          Ver imagem
                        </Button>
                      </div>

                      {/* Botão de Detalhes */}
                      <Button
                        size="icon"
                        onClick={() => abrirModal(product)}
                        className="h-10 w-10 rounded-full bg-green-600 hover:bg-green-700 flex-shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalRecords > 0 && (
        <div className="flex flex-col items-center justify-center gap-3 bg-card rounded-lg shadow px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {endIndex} de {totalRecords} produtos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)} // Ajustado para usar handlePageChange
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)} // Ajustado para usar handlePageChange
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Função auxiliar para lidar com a mudança de página */}
      {/* Essa função foi movida para fora do return e é chamada pelos botões de paginação */}
      {/* A lógica de atualização da tabela é feita no useEffect de currentPage */}

      <ProdutoDetalhesModal
        produto={produtoSelecionado}
        isOpen={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
      />
    </div>
  )
}