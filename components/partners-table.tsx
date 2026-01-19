"use client"

import { useState, useEffect, useRef } from "react"
// Adicionado 'Plus' e 'User' (que é usado no código) às importações
import { 
  Search, 
  Pencil, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Plus,
  User as UserIcon 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PartnerModal } from "@/components/partner-modal"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/auth-service"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { OfflineDataService } from '@/lib/offline-data-service'

interface Partner {
  _id: string
  CODPARC: string
  NOMEPARC: string
  CGC_CPF: string
  CODCID?: string
  ATIVO?: string
  TIPPESSOA?: string
  CODVEND?: number
  CLIENTE?: string
}

const ITEMS_PER_PAGE = 50

export default function PartnersTable() {
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [appliedSearchName, setAppliedSearchName] = useState("")
  const [appliedSearchCode, setAppliedSearchCode] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [vendedoresMap, setVendedoresMap] = useState<Record<number, string>>({})
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const loadingRef = useRef(false);
  const [isOffline, setIsOffline] = useState(typeof window !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncDataOnReconnect();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: "Modo Offline",
        description: "Você está sem conexão. Os dados exibidos são do cache.",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  useEffect(() => {
    loadPartners();
  }, [currentPage, appliedSearchName, appliedSearchCode, isOffline]);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) setCurrentUser(user);
    loadVendedores();
  }, []);

  const syncDataOnReconnect = async () => {
    if (isOffline) return;
    try {
      const prefetchResponse = await fetch('/api/prefetch', { method: 'POST' });
      if (prefetchResponse.ok) {
        const prefetchData = await prefetchResponse.json();
        await OfflineDataService.sincronizarTudo(prefetchData);
        toast({ title: "Sincronização Concluída", description: "Dados atualizados com o servidor." });
        await loadPartners();
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
    }
  };

  const loadVendedores = async () => {
    try {
      const response = await fetch('/api/vendedores?tipo=todos');
      const vendedores = await response.json();
      const map: Record<number, string> = {};
      vendedores.forEach((v: any) => { map[v.CODVEND] = v.APELIDO; });
      setVendedoresMap(map);
    } catch (error) { console.error(error); }
  };

  const handleSearch = () => {
    setAppliedSearchName(searchName);
    setAppliedSearchCode(searchCode);
    setCurrentPage(1);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const loadPartners = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setIsLoading(true);
      let allParceiros: Partner[] = await OfflineDataService.getParceiros();

      let filteredParceiros = allParceiros;
      if (appliedSearchName.trim() || appliedSearchCode.trim()) {
        filteredParceiros = allParceiros.filter(p => {
          const matchName = !appliedSearchName || p.NOMEPARC?.toLowerCase().includes(appliedSearchName.toLowerCase());
          const matchCode = !appliedSearchCode || p.CODPARC?.toString().includes(appliedSearchCode);
          return matchName && matchCode;
        });
      }

      const total = filteredParceiros.length;
      const totalPgs = Math.ceil(total / ITEMS_PER_PAGE) || 1;
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedParceiros = filteredParceiros.slice(start, start + ITEMS_PER_PAGE);

      setPartners(paginatedParceiros);
      setTotalPages(totalPgs);
      setTotalRecords(total);
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao carregar clientes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  const handleSave = async (partnerData: any) => {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(partnerData).filter(([_, v]) => v !== '' && v !== null)
      );

      if (currentUser?.role === 'Vendedor' && !cleanData.CODVEND) {
        cleanData.CODVEND = currentUser.codVendedor;
      }

      const response = await fetch('/api/sankhya/parceiros/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      });

      if (!response.ok) throw new Error('Falha ao salvar parceiro');

      toast({ title: "Sucesso", description: "Parceiro salvo com sucesso." });
      setIsModalOpen(false);
      await loadPartners();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (partner: Partner) => {
    setSelectedPartner(partner);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPartner(null);
    setIsModalOpen(true);
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length === 0) return '??';
    return (words[0][0] + (words[words.length - 1]?.[0] || '')).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 md:p-6 bg-white">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Consulta e gerenciamento de clientes</p>
      </div>

      {/* Filtros Desktop */}
      <div className="hidden md:block border-b p-6 bg-slate-50">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Filtros de Busca</CardTitle>
            <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" /> Novo Cliente
            </Button>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input placeholder="Código..." value={searchCode} onChange={e => setSearchCode(e.target.value)} onKeyPress={handleSearchKeyPress} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Nome..." value={searchName} onChange={e => setSearchName(e.target.value)} onKeyPress={handleSearchKeyPress} />
            </div>
            <Button onClick={handleSearch} className="self-end bg-primary">
              <Search className="w-4 h-4 mr-2" /> Buscar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Mobile */}
      <div className="md:hidden p-3 border-b bg-white">
        <Button onClick={handleCreate} className="w-full bg-green-600 mb-2">
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              Filtros {filtrosAbertos ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <Input placeholder="Código..." value={searchCode} onChange={e => setSearchCode(e.target.value)} />
            <Input placeholder="Nome..." value={searchName} onChange={e => setSearchName(e.target.value)} />
            <Button onClick={handleSearch} className="w-full"><Search className="w-4 h-4 mr-2"/>Filtrar</Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Lista / Tabela */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center py-20 gap-2">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/>
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden md:block border rounded-lg overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-4 text-left">Código</th>
                    <th className="p-4 text-left">Nome</th>
                    <th className="p-4 text-left">CPF/CNPJ</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {partners.map(p => (
                    <tr key={p.CODPARC} className="hover:bg-slate-50">
                      <td className="p-4 font-mono">{p.CODPARC}</td>
                      <td className="p-4">{p.NOMEPARC}</td>
                      <td className="p-4">{p.CGC_CPF || '-'}</td>
                      <td className="p-4 text-center">
                        <Button size="sm" onClick={() => handleEdit(p)}>Detalhes</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="md:hidden space-y-3">
              {partners.map(p => (
                <div key={p.CODPARC} onClick={() => handleEdit(p)} className="p-4 bg-white border rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {getInitials(p.NOMEPARC)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.NOMEPARC}</p>
                    <p className="text-xs text-muted-foreground">{p.CGC_CPF || 'Sem documento'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground"/>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Paginação */}
      <div className="p-4 border-t bg-white flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
          <ChevronLeft className="w-4 h-4 mr-1"/> Anterior
        </Button>
        <span className="text-xs text-muted-foreground">Pág. {currentPage} de {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
          Próxima <ChevronRight className="w-4 h-4 ml-1"/>
        </Button>
      </div>

      <PartnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        partner={selectedPartner}
        onSave={handleSave}
        currentUser={currentUser}
      />
    </div>
  );
}