import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Activity {
  id: string
  type: "experiment" | "test" | "photo"
  description: string
  date: string
  status?: "completed" | "pending" | "in-progress"
}

interface RecentActivityProps {
  activities: Activity[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade Recente</CardTitle>
        <CardDescription>Últimas ações realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.date}</p>
              </div>
              {activity.status && (
                <Badge
                  variant={
                    activity.status === "completed"
                      ? "default"
                      : activity.status === "in-progress"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {activity.status === "completed"
                    ? "Concluído"
                    : activity.status === "in-progress"
                      ? "Em Progresso"
                      : "Pendente"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
