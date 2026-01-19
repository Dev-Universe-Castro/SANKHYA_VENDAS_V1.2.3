"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import DashboardLayout from "@/components/dashboard-layout"
import RotasManager from "@/components/rotas-manager"
import { WifiOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function RotasPage() {
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      router.push("/")
      return
    }

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

  if (!isOnline) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Rotas Indisponível Offline</h3>
                <p className="text-sm text-muted-foreground">
                  O sistema de Rotas requer conexão com a internet para funcionar. Por favor, conecte-se à internet para acessar esta funcionalidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <h3 className="text-lg font-semibold">Acesso Negado</h3>
              <p className="text-sm text-muted-foreground">
                Você não tem permissão para acessar o sistema de Rotas.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RotasManager />
    </DashboardLayout>
  )
}
