
"use client"

import DashboardLayout from "@/components/dashboard-layout"
import PedidosFDVTable from "@/components/pedidos-fdv-table"
import PedidosSyncMonitor from "@/components/pedidos-sync-monitor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PedidosPage() {
  return (
    <DashboardLayout hideFloatingMenu={true}>
      <div className="flex flex-col h-full bg-background overflow-hidden scrollbar-hide">
        {/* Header - Desktop */}
        <div className="hidden md:block border-b p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-3xl font-bold tracking-tight">Pedidos de Vendas</h1>
          <p className="text-muted-foreground">
            Histórico e controle de pedidos criados pelo sistema
          </p>
        </div>

        {/* Header - Mobile */}
        <div className="md:hidden border-b px-3 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-lg font-bold">Pedidos de Vendas</h1>
          <p className="text-xs text-muted-foreground">
            Histórico e controle de pedidos
          </p>
        </div>

        <Tabs defaultValue="fdv" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-4 md:px-6 py-2">
            <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-gray-100/80 rounded-lg">
              <TabsTrigger value="fdv" className="text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="hidden sm:inline">Pedidos FDV</span>
                <span className="sm:hidden">PEDIDOS</span>
              </TabsTrigger>
              <TabsTrigger value="sincronizador" className="text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="hidden sm:inline">Sincronizador</span>
                <span className="sm:hidden">SYNC</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="fdv" className="flex-1 overflow-hidden m-0">
            <PedidosFDVTable />
          </TabsContent>
          
          <TabsContent value="sincronizador" className="flex-1 overflow-hidden m-0">
            <PedidosSyncMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
