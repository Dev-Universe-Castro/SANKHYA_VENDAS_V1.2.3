
import DashboardLayout from "@/components/dashboard-layout"
import PartnersTable from "@/components/partners-table"

export default function ParceirosPage() {
  return (
    <DashboardLayout hideFloatingMenu={true}>
      <PartnersTable />
    </DashboardLayout>
  )
}
