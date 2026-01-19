"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService } from "@/lib/auth-service"
import { toast } from "@/components/ui/use-toast"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { prefetchLoginData } from "@/lib/prefetch-login-service"
import { SplashScreen } from "@/components/splash-screen"
import { useIsMobile } from "@/hooks/use-mobile"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPrefetchSplash, setShowPrefetchSplash] = useState(false)
  const [isPrefetching, setIsPrefetching] = useState(false)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [showSplash, setShowSplash] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Detectar que está no cliente para evitar flash de conteúdo
  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (navigator.onLine) {
        // Login Online
        console.log('🌐 Modo online - tentando login na API...')
        const user = await authService.login(email, password)

        if (user) {
          // Preparar dados do usuário no formato correto
          const userData = {
            id: user.id || user.CODUSUARIO,
            name: user.name || user.NOME,
            email: user.email || user.EMAIL,
            role: user.role || user.FUNCAO,
            avatar: user.avatar || user.AVATAR || '',
            codVendedor: user.codVendedor || user.CODVEND,
            ID_EMPRESA: user.ID_EMPRESA
          }

          console.log('✅ Login online bem-sucedido:', userData.email)

          // Salvar credenciais para login offline futuro
          console.log('💾 Salvando credenciais para login offline...')
          try {
            const { OfflineAuth } = await import('@/lib/auth-offline')
            await OfflineAuth.salvarCredenciais(userData, password)
            console.log('✅ Credenciais salvas para login offline')
          } catch (error) {
            console.error('⚠️ Erro ao salvar credenciais offline:', error)
            // Não bloquear o login se falhar ao salvar offline
          }

          // Garantir persistência no localStorage e cookie
          localStorage.setItem("currentUser", JSON.stringify(userData))
          localStorage.setItem("isAuthenticated", "true")
          localStorage.setItem("lastLoginTime", new Date().toISOString())
          document.cookie = `user=${JSON.stringify(userData)}; path=/; max-age=${60 * 60 * 24 * 7}`

          toast({
            title: "Login realizado com sucesso!",
            description: `Bem-vindo(a), ${userData.name}!`,
          })

          // Mostrar splash de prefetch
          setShowPrefetchSplash(true)
          setIsPrefetching(true)

          // Iniciar prefetch de dados E cache de rotas EM PARALELO
          console.log('🚀 Iniciando prefetch de dados após login...')

          try {
            // Executar prefetch, cache de rotas e sincronização do IndexedDB
            const [prefetchData] = await Promise.all([
              (async () => {
                const response = await fetch('/api/prefetch', { method: 'POST' });
                return response.ok ? await response.json() : null;
              })(),
              (async () => {
                const { OfflineRouter } = await import('@/lib/offline-router')
                await OfflineRouter.precacheRoutes()
              })()
            ]);

            // Sincronizar IndexedDB com dados do prefetch
            if (prefetchData && prefetchData.success) {
              const { OfflineDataService } = await import('@/lib/offline-data-service');
              await OfflineDataService.sincronizarTudo(prefetchData);
              console.log('✅ IndexedDB sincronizado com sucesso');
            }

            console.log('✅ Prefetch e cache concluídos com sucesso')
          } catch (error) {
            console.error('⚠️ Erro no prefetch, continuando mesmo assim:', error)
          } finally {
            setIsPrefetching(false)
          }

        } else {
          toast({
            title: "Erro no login",
            description: "Email ou senha inválidos.",
            variant: "destructive",
          })
        }
      } else {
        // Login Offline
        console.log('🔌 Modo offline detectado, tentando login offline...')

        const { OfflineAuth } = await import('@/lib/auth-offline')
        const userOffline = await OfflineAuth.validarLoginOffline(email, password)

        if (userOffline && userOffline.dados) {
          const userData = userOffline.dados

          console.log('✅ Login offline bem-sucedido:', userData.name)

          // Salvar dados do usuário
          localStorage.setItem("currentUser", JSON.stringify(userData))
          localStorage.setItem("isAuthenticated", "true")
          localStorage.setItem("lastLoginTime", new Date().toISOString())
          document.cookie = `user=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=${60 * 60 * 24 * 7}`

          toast({
            title: "🔌 Modo Offline",
            description: `Bem-vindo(a), ${userData.name}! Você está trabalhando offline.`,
          })

          // Delay para garantir persistência
          await new Promise(resolve => setTimeout(resolve, 300))

          router.push("/dashboard")
        } else {
          console.error('❌ Credenciais offline inválidas')
          toast({
            title: "Login offline não disponível",
            description: "Você precisa fazer login online pelo menos uma vez antes de usar o modo offline.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('❌ Erro geral no login:', error)
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro ao tentar fazer login. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrefetchFinish = () => {
    // Redirecionar para o dashboard
    console.log('✅ Prefetch finalizado, redirecionando para dashboard...')
    router.push("/dashboard")
  }

  if (showPrefetchSplash) {
    return (
      <SplashScreen 
        onFinish={handlePrefetchFinish}
        duration={isPrefetching ? 60000 : 500}
        forceStay={isPrefetching}
      />
    )
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} duration={2000} />
  }

  // Mostrar loading enquanto detecta mobile para evitar flash
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#24292E]">
        <div className="h-screen flex flex-col items-center justify-center p-6">
          {/* Logo Mobile */}
          <div className="mb-8">
            <div className="relative w-64 h-32 mx-auto">
              <Image
                src="/logo-mobile.png"
                alt="PredictSales Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-xl font-bold font-montserrat text-white mb-8">Entre na sua conta</h1>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm font-bold font-montserrat text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-gray-50/10 border-gray-700 rounded-lg text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm font-bold font-montserrat text-gray-300">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-gray-50/10 border-gray-700 rounded-lg pr-10 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 rounded-lg font-bold font-montserrat text-white" 
              disabled={isLoading}
              style={{ backgroundColor: '#2ECC71' }}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          {/* Link para registro */}
          <div className="mt-8 text-center text-sm">
            <span className="text-gray-400">Não tem uma conta? </span>
            <Link href="/register" className="font-bold" style={{ color: '#2ECC71' }}>
              Solicitar acesso
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Desktop Layout (original)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#24292E]">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-4 pt-8">
          <div className="flex justify-center mb-2">
            <div className="relative w-full h-32 mx-auto">
              <Image
                src="/logo-login.png"
                alt="PredictSales Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <CardDescription className="text-center">
            Aumente seu desempenho comercial com IA
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-montserrat font-bold text-[#24292E]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-montserrat font-bold text-[#24292E]">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-lg border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 bg-[#2ECC71] hover:bg-[#27ae60] text-white font-montserrat font-bold rounded-lg shadow-md transition-all" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Acessar Sistema"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <Link href="/register" className="text-[#2ECC71] font-bold hover:underline">
              Solicitar acesso
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}