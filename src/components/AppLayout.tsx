import type { ReactNode } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { IconDashboard, IconListDetails, IconChartBar } from "@tabler/icons-react"
import { Bot } from "lucide-react"

interface AppLayoutProps {
  children: ReactNode
  pageTitle?: string
}

export function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
  }

  // Determine current page title from location
  const getPageTitle = () => {
    if (pageTitle) return pageTitle
    if (location.pathname === "/dashboard") return "Dashboard"
    if (location.pathname === "/tasks") return "Tasks"
    if (location.pathname === "/analytics") return "Analytics"
    if (location.pathname === "/chat-assistant") return "Task Assistant"
    return "Dashboard"
  }

  // Sidebar data
  const sidebarData = {
    user: {
      name: user?.user_metadata?.name || user?.email?.split('@')[0] || "User",
      email: user?.email || "user@example.com",
      avatar: undefined,
      onLogout: handleSignOut,
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: IconDashboard,
      },
      {
        title: "Tasks",
        url: "/tasks",
        icon: IconListDetails,
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: IconChartBar,
      },
    ],
    navSecondary: [
      {
        title: "Task Assistant",
        url: "/chat-assistant",
        icon: Bot,
      },
    ],
    documents: [],
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" data={sidebarData} />
      <SidebarInset>
        <SiteHeader pageTitle={getPageTitle()} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
