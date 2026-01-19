
"use client"

import { Home, Route, ShoppingCart, LayoutGrid, Menu, Table } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { MenuBottomSheet } from "./menu-bottom-sheet"

export default function Footer() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const navigationItems = [
    { 
      icon: LayoutGrid, 
      label: "Negócios", 
      href: "/dashboard/leads",
      isActive: pathname === "/dashboard/leads",
      action: () => router.push("/dashboard/leads")
    },
    { 
      icon: Route, 
      label: "Rotas", 
      href: "/dashboard/rotas",
      isActive: pathname === "/dashboard/rotas",
      action: () => router.push("/dashboard/rotas")
    },
    { 
      icon: Home, 
      label: "Início", 
      isActive: pathname === "/dashboard",
      action: () => router.push("/dashboard")
    },
    { 
      icon: ShoppingCart, 
      label: "Pedidos", 
      href: "/dashboard/pedidos",
      isActive: pathname === "/dashboard/pedidos",
      action: () => router.push("/dashboard/pedidos")
    },
    { 
      icon: Table, 
      label: "Clientes", 
      href: "/dashboard/parceiros",
      isActive: pathname === "/dashboard/parceiros",
      action: () => router.push("/dashboard/parceiros")
    },
  ]

  return (
    <>
      <footer className="border-t border-white/10 lg:relative fixed bottom-0 left-0 right-0 z-40 bg-[#24292E] w-full transition-all duration-300">
        {/* Mobile Navigation */}
        <nav className="lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="grid grid-cols-5 gap-0 px-1 py-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={item.action}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-md transition-colors min-h-[56px]",
                    item.isActive 
                      ? "bg-white/10 text-white" 
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[10px] font-bold font-montserrat leading-tight text-center">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Desktop Footer */}
        <div className="hidden lg:flex items-center justify-between px-6 py-3 text-xs text-white/70">
          <p>© 2026 - Todos Direitos Reservados</p>
          <p>versão 1.2.2</p>
        </div>
      </footer>

      {/* Menu Bottom Sheet - Mobile Only */}
      <MenuBottomSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}
