"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, ArrowLeft, BarChart3, TrendingUp, Package, Users, CalendarIcon, Loader2 } from "lucide-react"
import Image from "next/image"
import { WidgetRenderer } from "@/components/widget-renderer"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Widget {
  tipo: "card" | "grafico_barras" | "grafico_linha" | "grafico_pizza" | "tabela" | "explicacao"
  titulo: string
  dados: any
  metadados?: any
}

const SUGGESTED_PROMPTS = [
  {
    label: "Performance de Vendas",
    prompt: "Analise o desempenho de vendas dos últimos 6 meses com evolução temporal e mostre os top 5 produtos mais vendidos",
    icon: TrendingUp
  },
  {
    label: "Análise de Leads",
    prompt: "Mostre uma análise completa dos meus leads: distribuição por estágio ao longo do tempo, taxa de conversão e evolução mensal",
    icon: BarChart3
  },
  {
    label: "Estoque Crítico",
    prompt: "Identifique produtos com estoque baixo, mostre a evolução do estoque nos últimos meses e sugira ações de reposição",
    icon: Package
  },
  {
    label: "Análise de Clientes",
    prompt: "Analise o perfil dos meus clientes com evolução temporal, identifique padrões de compra e correlações entre valor e frequência",
    icon: Users
  }
]

export default function AnalisePage() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [showInitial, setShowInitial] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const { toast } = useToast()

  // Filtro de data (padrão: últimos 30 dias)
  const hoje = new Date()
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const [filtro, setFiltro] = useState({
    dataInicio: trintaDiasAtras,
    dataFim: hoje
  })

  // Estados do modal de data
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState("")
  const [tempDates, setTempDates] = useState({
    dataInicio: trintaDiasAtras,
    dataFim: hoje
  })

  // Adicionar estados de progresso na análise
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      router.push("/")
    }

    // Verificar status de conexão
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  const startAnalysisFlow = (prompt: string) => {
    if (!prompt.trim() || isLoading) return
    setPendingPrompt(prompt)
    setTempDates({
      dataInicio: filtro.dataInicio,
      dataFim: filtro.dataFim
    })
    setIsDateModalOpen(true)
  }

  const confirmDateAndAnalyze = async () => {
    const prompt = pendingPrompt
    const dataInicioStr = format(tempDates.dataInicio, 'yyyy-MM-dd')
    const dataFimStr = format(tempDates.dataFim, 'yyyy-MM-dd')

    // Validar intervalo de 6 meses
    const diffTime = Math.abs(tempDates.dataFim.getTime() - tempDates.dataInicio.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays > 186) {
      toast({
        title: "Erro",
        description: "O intervalo máximo permitido é de 6 meses",
        variant: "destructive"
      })
      return
    }

    if (tempDates.dataInicio > tempDates.dataFim) {
      toast({
        title: "Erro",
        description: "A data de início não pode ser posterior à data de fim",
        variant: "destructive"
      })
      return
    }

    setFiltro({
      dataInicio: tempDates.dataInicio,
      dataFim: tempDates.dataFim
    })
    setIsDateModalOpen(false)
    
    // Iniciar análise propriamente dita
    setInput("")
    setIsLoading(true)
    setShowInitial(false)
    setWidgets([])
    setLoadingProgress(0);
    setLoadingMessage('Iniciando análise...');
    setIsLoadingData(true);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 5;
      });
    }, 300);

    try {
      setLoadingMessage('Carregando dados do período...');
      const response = await fetch(`/api/gemini/analise?t=${Date.now()}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
        body: JSON.stringify({ 
          prompt,
          dataInicio: dataInicioStr,
          dataFim: dataFimStr
        })
      })

      clearInterval(progressInterval);
      setLoadingProgress(95);
      setLoadingMessage('Processando análise com IA...');

      if (!response.ok) throw new Error("Erro na análise")

      setLoadingProgress(100);
      setLoadingMessage('Análise concluída!');

      const data = await response.json()

      if (data.widgets && data.widgets.length > 0) {
        const temExplicacao = data.widgets.some((w: any) => w.tipo === 'explicacao')
        if (!temExplicacao) {
          setWidgets([
            {
              tipo: 'explicacao',
              titulo: 'Análise Realizada',
              dados: {
                texto: `Análise do período de ${format(tempDates.dataInicio, 'dd/MM/yyyy')} a ${format(tempDates.dataFim, 'dd/MM/yyyy')}`
              }
            },
            ...data.widgets
          ])
        } else {
          setWidgets(data.widgets)
        }

        setTimeout(() => {
          setIsLoadingData(false);
        }, 500);
      } else {
        setIsLoadingData(false);
        toast({
          title: "Aviso",
          description: "Nenhum dado encontrado para análise.",
          variant: "default"
        })
      }
    } catch (error) {
      console.error("Erro ao analisar dados:", error)
      toast({
        title: "Erro",
        description: "Não foi possível analisar seus dados. Tente novamente.",
        variant: "destructive"
      })
      clearInterval(progressInterval);
      setIsLoadingData(false);
      setLoadingProgress(0);
      setLoadingMessage('');
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOnline) {
    return (
      <DashboardLayout hideFloatingMenu={true}>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">IA Análise Indisponível Offline</h3>
                <p className="text-sm text-muted-foreground">
                  A Análise de Dados com IA requer conexão com a internet para funcionar. Por favor, conecte-se à internet para acessar esta funcionalidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout hideFloatingMenu={true}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para escolhas de IA
          </Button>

          {/* Filtro de Data removido do topo conforme solicitado */}
        </div>

        {/* Área Principal */}
        <div className={`flex-1 px-4 py-6 ${!showInitial ? 'overflow-y-auto scrollbar-hide' : ''}`}>
          {showInitial ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-8 h-8">
                  <Image
                    src="/1.png"
                    alt="AI Icon"
                    fill
                    className="object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold text-primary">IA Análise de Dados</h1>
              </div>
              <p className="text-center text-muted-foreground max-w-md mb-8">
                Faça perguntas sobre seus dados e receba análises visuais em tempo real com gráficos, tabelas e insights automáticos.
              </p>

              {/* Chips de Sugestões */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl w-full">
                {SUGGESTED_PROMPTS.map((promptData) => {
                  const Icon = promptData.icon
                  return (
                    <Card
                      key={promptData.label}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => startAnalysisFlow(promptData.prompt)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {promptData.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">{promptData.prompt}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto">
              {isLoadingData && (
                <Card className="p-8">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <div className="w-full max-w-md space-y-2">
                      <Progress value={loadingProgress} className="w-full" />
                      <p className="text-sm text-center text-muted-foreground">
                        {loadingMessage} ({loadingProgress}%)
                      </p>
                    </div>
                  </div>
                </Card>
              )}
              {!isLoadingData && widgets.map((widget, index) => (
                <WidgetRenderer key={index} widget={widget} />
              ))}
            </div>
          )}
        </div>

        {/* Barra de Input Fixa */}
        <div className="border-t bg-background p-4 flex-shrink-0">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && startAnalysisFlow(input)}
              placeholder="Faça uma pergunta sobre seus dados..."
              disabled={isLoading || isLoadingData}
              className="flex-1"
            />
            <Button
              onClick={() => startAnalysisFlow(input)}
              disabled={!input.trim() || isLoading || isLoadingData}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Data */}
      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className="max-w-3xl sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Selecione o período da análise</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium">Data de Início</span>
              <Calendar
                mode="single"
                selected={tempDates.dataInicio}
                onSelect={(date) => date && setTempDates(prev => ({ ...prev, dataInicio: date }))}
                locale={ptBR}
                className="rounded-md border"
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium">Data de Fim</span>
              <Calendar
                mode="single"
                selected={tempDates.dataFim}
                onSelect={(date) => date && setTempDates(prev => ({ ...prev, dataFim: date }))}
                locale={ptBR}
                className="rounded-md border"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Período: {format(tempDates.dataInicio, "dd/MM/yyyy")} até {format(tempDates.dataFim, "dd/MM/yyyy")}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmDateAndAnalyze}>
                Gerar Análise
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
