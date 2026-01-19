"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GenerateTestDataButton } from "@/components/generate-test-data-button"
import { PageTitle } from "@/components/page-title"
import { StatsCard } from "@/components/dashboard/stats-card"
import { ExperimentBarChart } from "@/components/dashboard/experiment-bar-chart"
import { TemperatureLineChart } from "@/components/dashboard/temperature-line-chart"
import { StrainComparisonChart } from "@/components/dashboard/strain-comparison-chart"
import { ExperimentProgressChart } from "@/components/dashboard/experiment-progress-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { FlaskConical, TestTube, Microscope, Calendar } from "lucide-react"

interface DashboardClientProps {
  experiments: any[]
  experimentData: any[]
}

export function DashboardClient({ experiments, experimentData }: DashboardClientProps) {
  // Calculate statistics
  const totalTests = experiments.reduce((sum, exp) => sum + exp.total_tests, 0)
  const completedTests = experimentData.reduce((sum, exp) => sum + exp.completedTests, 0)

  const stats = {
    totalExperiments: experiments.length,
    totalTests,
    completedTests,
    completionRate: totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0,
    uniqueStrains: [...new Set(experiments.map((exp) => exp.strain))].length,
    avgTemperature:
      experimentData.reduce((sum, exp) => {
        const testsData = exp.testsData || []
        const expTemp = testsData.reduce((tSum: number, test: any) => {
          return tSum + ((test.temp_7_chamber || 0) + (test.temp_14_chamber || 0)) / 2
        }, 0)
        return sum + expTemp / (testsData.length || 1)
      }, 0) / (experimentData.length || 1),
  }

  // Generate recent activities
  const recentActivities = generateRecentActivities(experimentData)

  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Dashboard" />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <GenerateTestDataButton />
      </div>

      {experiments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum dado disponível</CardTitle>
            <CardDescription>Adicione experimentos manualmente para começar a visualizar estatísticas.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total de Experimentos"
              value={stats.totalExperiments}
              icon={FlaskConical}
              description={`Com ${stats.uniqueStrains} cepas diferentes`}
            />
            <StatsCard
              title="Testes Realizados"
              value={stats.completedTests}
              icon={TestTube}
              description={`${stats.completionRate}% de conclusão`}
              trend={{
                value: 12,
                label: "em relação ao mês anterior",
                positive: true,
              }}
            />
            <StatsCard
              title="Temperatura Média"
              value={`${stats.avgTemperature.toFixed(1)}°C`}
              icon={Microscope}
              description="Média de todos os experimentos"
            />
            <StatsCard
              title="Último Experimento"
              value={experiments.length > 0 ? `#${experiments[experiments.length - 1].number}` : "N/A"}
              icon={Calendar}
              description={
                experiments.length > 0
                  ? `Iniciado em ${new Date(experiments[experiments.length - 1].start_date).toLocaleDateString("pt-BR")}`
                  : ""
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <ExperimentProgressChart totalTests={totalTests} completedTests={completedTests} />
            <div className="md:col-span-2">
              <StrainComparisonChart data={experimentData} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <ExperimentBarChart data={experimentData} />
            <TemperatureLineChart data={experimentData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Experimentos</CardTitle>
                  <CardDescription>Experimentos por cepa e status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...new Set(experiments.map((exp) => exp.strain))].map((strain, index) => {
                      const strainExperiments = experiments.filter((exp) => exp.strain === strain)
                      const strainTests = strainExperiments.reduce((sum, exp) => sum + exp.total_tests, 0)
                      const strainCompleted = experimentData
                        .filter((exp) => exp.strain === strain)
                        .reduce((sum, exp) => sum + exp.completedTests, 0)
                      const completionPercentage = Math.round((strainCompleted / strainTests) * 100)

                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">{strain}</span>
                            <span className="text-sm text-muted-foreground">
                              {strainCompleted} de {strainTests} testes concluídos
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${completionPercentage}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
            <RecentActivity activities={recentActivities} />
          </div>
        </>
      )}
    </div>
  )
}

function generateRecentActivities(data: any[]) {
  const activities: any[] = []

  data.forEach((experiment) => {
    if (experiment.testsData && experiment.testsData.length > 0) {
      experiment.testsData.slice(0, 2).forEach((test: any, testIndex: number) => {
        // Use test.id if available, otherwise create unique key with index
        const testId = test.id || `${experiment.id}-idx-${testIndex}`
        const repNum = test.repetition_number ?? testIndex
        const testNum = test.test_number ?? testIndex
        
        activities.push({
          id: `test-${testId}`,
          type: "test",
          description: `Teste #${testNum} da Repetição #${repNum} do Experimento #${experiment.number} foi concluído`,
          date: new Date(experiment.start_date).toLocaleDateString("pt-BR"),
          status: "completed",
        })
      })

      if (experiment.testsData[0].photos_7_day && experiment.testsData[0].photos_7_day.length > 0) {
        activities.push({
          id: `photo-${experiment.id}-7`,
          type: "photo",
          description: `Fotos do 7º dia adicionadas ao Experimento #${experiment.number}`,
          date: new Date(experiment.start_date).toLocaleDateString("pt-BR"),
          status: "completed",
        })
      }
    }

    activities.push({
      id: `exp-${experiment.id}`,
      type: "experiment",
      description: `Experimento #${experiment.number} com cepa ${experiment.strain} foi criado`,
      date: new Date(experiment.start_date).toLocaleDateString("pt-BR"),
      status: "in-progress",
    })
  })

  return activities.slice(0, 5)
}
