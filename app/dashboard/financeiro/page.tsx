
import DashboardLayout from "@/components/dashboard-layout"
import TitulosReceberTable from "@/components/titulos-receber-table"

export default function FinanceiroPage() {
  return (
    <DashboardLayout hideFloatingMenu={true}>
      <TitulosReceberTable />
    </DashboardLayout>
  )
}
