"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  BarChart3,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react"
import { ptBR } from "date-fns/locale"
import { format, subDays } from "date-fns"
import { toast } from "sonner"

interface DashboardData {
  kpis: {
    faturamento: number
    ticketMedio: number
    volumePedidos: number
    totalClientes: number
  }
}

export default function DashboardHome() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user) {
      setCurrentUser(user)
    }
    
    setIsOnline(navigator.onLine)
    setIsMobile(window.innerWidth < 768)
    setLoading(false)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleResize = () => setIsMobile(window.innerWidth < 768)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Desktop */}
      <div className="hidden md:block border-b p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-3xl font-bold tracking-tight">Início</h1>
        <p className="text-muted-foreground">
          Análise estratégica de performance comercial
        </p>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden border-b px-3 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-lg font-bold">Início</h1>
        <p className="text-xs text-muted-foreground">
          Análise estratégica de performance comercial
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 animate-pulse">
              Iniciando PredictSales AI...
            </p>
          </div>
        ) : (
          <>
            {/* Seção Principal de IA - Destaque Máximo */}
            <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full py-2 md:py-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
                {/* PredictChat AI */}
                <button 
                  onClick={() => isOnline && router.push('/dashboard/chat')}
                  disabled={!isOnline}
                  className="text-left w-full group"
                >
                  <Card className={`relative overflow-hidden transition-all duration-300 border-none shadow-lg md:shadow-2xl ${
                    isOnline 
                      ? 'bg-gradient-to-br from-[#00A859] to-[#008F4C] active:scale-[0.98] md:hover:scale-[1.02] cursor-pointer' 
                      : 'bg-slate-400 cursor-not-allowed opacity-60'
                  }`}>
                    <CardContent className="p-6 md:p-12 flex flex-col h-full min-h-[160px] md:min-h-[350px] justify-between relative z-10">
                      <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                            <MessageSquare className="h-6 w-6 md:h-10 md:w-10 text-white" />
                          </div>
                          <div className="px-3 py-1 md:px-5 md:py-2 rounded-full bg-white/20 backdrop-blur-md text-[10px] md:text-[12px] font-bold text-white uppercase tracking-widest border border-white/30">
                            Assistente IA
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl md:text-4xl font-black text-white leading-tight">PredictChat AI</h3>
                          <p className="text-sm md:text-lg text-green-50 mt-2 md:mt-4 font-medium opacity-90 leading-relaxed line-clamp-2 md:line-clamp-none">
                            Tire dúvidas sobre leads, pedidos e performance. Seu consultor estratégico 24/7.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 md:mt-10 flex items-center text-white text-xs md:text-base font-bold">
                        Começar agora <ChevronRight className="h-4 w-4 md:h-6 md:w-6 ml-1 md:ml-2" />
                      </div>
                    </CardContent>
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 md:-mr-20 md:-mt-20 w-48 h-48 md:w-80 md:h-80 bg-white/10 rounded-full blur-2xl md:blur-3xl" />
                  </Card>
                </button>

                {/* IA Análise de Dados */}
                <button 
                  onClick={() => isOnline && router.push('/dashboard/analise')}
                  disabled={!isOnline}
                  className="text-left w-full group"
                >
                  <Card className={`relative overflow-hidden transition-all duration-300 border-none shadow-lg md:shadow-2xl ${
                    isOnline 
                      ? 'bg-gradient-to-br from-[#1E293B] to-[#0F172A] active:scale-[0.98] md:hover:scale-[1.02] cursor-pointer' 
                      : 'bg-slate-400 cursor-not-allowed opacity-60'
                  }`}>
                    <CardContent className="p-6 md:p-12 flex flex-col h-full min-h-[160px] md:min-h-[350px] justify-between relative z-10">
                      <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
                            <BarChart3 className="h-6 w-6 md:h-10 md:w-10 text-white" />
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 md:px-5 md:py-2 rounded-full bg-primary/20 backdrop-blur-md text-[10px] md:text-[12px] font-bold text-primary uppercase tracking-widest border border-primary/30">
                            <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                            Insights
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl md:text-4xl font-black text-white leading-tight">Análise de Dados</h3>
                          <p className="text-sm md:text-lg text-slate-300 mt-2 md:mt-4 font-medium opacity-90 leading-relaxed line-clamp-2 md:line-clamp-none">
                            Visualize tendências e indicadores estratégicos processados por IA avançada.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 md:mt-10 flex items-center text-white text-xs md:text-base font-bold">
                        Explorar insights <ChevronRight className="h-4 w-4 md:h-6 md:w-6 ml-1 md:ml-2" />
                      </div>
                    </CardContent>
                    <div className="absolute bottom-0 right-0 -mb-16 -mr-16 md:-mb-20 md:-mr-20 w-48 h-48 md:w-80 md:h-80 bg-primary/10 rounded-full blur-2xl md:blur-3xl" />
                  </Card>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
