"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Users, ChevronLeft, ChevronRight, LogOut, UserCircle, LayoutGrid, Package, ShoppingCart, Calendar, DollarSign, Settings, Download, Loader2, Cloud, CloudOff, Menu, Route, Table } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { authService } from "@/lib/auth-service"
import { useState, useEffect } from "react"
import type { User } from "@/lib/users-service"
import { useOfflineLoad } from "@/hooks/use-offline-load"
import { toast } from "sonner"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const { realizarCargaOffline, isLoading } = useOfflineLoad()

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser())

    // Verificar status da conexão
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("Você está offline. Os dados serão salvos localmente.")
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const menuItems = [
    { href: "/dashboard", label: "Início", icon: Home },
    { href: "/dashboard/pedidos", label: "Pedidos de Vendas", icon: ShoppingCart },
    { href: "/dashboard/leads", label: "Negócios", icon: LayoutGrid },
    { href: "/dashboard/rotas", label: "Rotas", icon: Route },
    { href: "/dashboard/calendario", label: "Tarefas", icon: Calendar },
    { href: "/dashboard/parceiros", label: "Clientes", icon: Users },
    { href: "/dashboard/produtos", label: "Produtos", icon: Package },
    { href: "/dashboard/tabelas-precos", label: "Tabelas de Preços", icon: Table },
    ...(currentUser?.role === "Administrador"
      ? [{ href: "/dashboard/usuarios", label: "Usuários", icon: UserCircle }]
      : []),
    ...(currentUser?.role === "Gerente"
      ? [{ href: "/dashboard/equipe", label: "Equipe Comercial", icon: Users }]
      : []),
    ...(currentUser?.role === "Administrador"
      ? [{ href: "/dashboard/configuracoes", label: "Configurações", icon: Settings }]
      : []),
  ]

  const handleLogout = () => {
    authService.logout()
    router.push("/")
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed inset-y-0 left-0 z-20 bg-sidebar transform transition-all duration-200 ease-in-out flex-col h-screen",
        isCollapsed ? "w-20 min-w-[80px] max-w-[80px]" : "w-64 min-w-[256px] max-w-[256px]",
      )}
    >
      {/* Logo */}
      <div className="border-b border-sidebar-border shrink-0 relative bg-white">
        <div
          className={cn(
            "flex items-center justify-between",
            isCollapsed ? "p-3" : "p-2",
          )}
        >
          <div className={cn("flex items-center justify-center w-full", isCollapsed ? "" : "py-0")}>
            {isCollapsed ? (
              <Image src="/logo-icon-collapsed.png" alt="PredictSales" width={36} height={36} className="object-contain" />
            ) : (
              <div className="flex items-center justify-center w-full">
                <Image
                  src="/logo-predictsales-expanded.png"
                  alt="PredictSales"
                  width={140}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
            )}
          </div>
        </div>

        {/* Toggle button on the border - Desktop only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent absolute -right-3 top-1/2 -translate-y-1/2 bg-sidebar border border-sidebar-border rounded-full w-6 h-6 p-0 z-[40] shadow-sm"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Menu section */}
      <div className="flex-1 p-4 flex flex-col overflow-y-auto min-h-0 scrollbar-hide">
        <nav className="space-y-1 flex-shrink-0 pb-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  isCollapsed && "justify-center",
                  isActive
                    ? "bg-primary text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Botão Sair - Apenas Desktop */}
      <div className="hidden lg:block p-3 border-t border-sidebar-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground whitespace-nowrap h-9",
            isCollapsed && "justify-center px-0",
          )}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">Sair</span>}
        </Button>
      </div>
    </aside>
  )
}