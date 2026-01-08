import { AppLayout } from "@/components/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp } from "lucide-react"

export function Analytics() {
  return (
    <AppLayout pageTitle="Analytics">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Analytics
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your productivity and analyze task completion trends.
              </p>
            </div>
          </div>

          {/* Placeholder Content */}
          <Card className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Analytics Dashboard
              </CardTitle>
              <CardDescription>
                Comprehensive analytics and insights coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                <p className="text-muted-foreground">
                  We're working on bringing you detailed analytics and insights.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  )
}
