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

type UIExperiment = {
  id: string
  number: number
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
}

type UITest = {
  id: string
  repetitionNumber?: number
  testNumber?: number
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  temp7Chamber?: number
  temp14Chamber?: number
  temp7Rice?: number
  temp14Rice?: number
  createdAt?: string
}

type ExperimentData = {
  id: string
  number: number
  strain: string
  startDate: string
  testsData?: UITest[]
  completedTests: number
}

interface DashboardClientProps {
  experiments: UIExperiment[]
  experimentData: ExperimentData[]
}

export function DashboardClient({ experiments, experimentData }: DashboardClientProps) {
  const totalTests = experiments.reduce((sum, exp) => sum + (exp.totalTests ?? exp.testCount * exp.repetitionCount), 0)
  const completedTests = experimentData.reduce((sum, exp) => sum + (exp.completedTests ?? 0), 0)

  const stats = {
    totalExperiments: experiments.length,
    totalTests,
    completedTests,
    completionRate: totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0,
    uniqueStrains: [...new Set(experiments.map((exp) => exp.strain))].length,
    avgTemperature:
      experimentData.reduce((sum, exp) => {
        const testsData = exp.testsData || []
        const denom = testsData.length || 1
        const expTemp =
          testsData.reduce((tSum: number, test: UITest) => {
            const t7 = test.temp7Chamber ?? 0
            const t14 = test.temp14Chamber ?? 0
            return tSum + (t7 + t14) / 2
          }, 0) / denom
        return sum + expTemp
      }, 0) / (experimentData.length || 1),
  }

  const recentActivities = generateRecentActivities(experimentData)
  const lastExperiment = experiments.length > 0 ? experiments[experiments.length - 1] : null

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
              trend={{ value: 12, label: "em relação ao mês anterior", positive: true }}
            />
            <StatsCard
              title="Temperatura Média"
              value={`${stats.avgTemperature.toFixed(1)}°C`}
              icon={Microscope}
              description="Média de todos os experimentos"
            />
            <StatsCard
              title="Último Experimento"
              value={lastExperiment ? `#${lastExperiment.number}` : "N/A"}
              icon={Calendar}
              description={
                lastExperiment ? `Iniciado em ${new Date(lastExperiment.startDate).toLocaleDateString("pt-BR")}` : ""
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
                      const strainTests = strainExperiments.reduce((sum, exp) => sum + exp.totalTests, 0)
                      const strainCompleted = experimentData
                        .filter((exp) => exp.strain === strain)
                        .reduce((sum, exp) => sum + exp.completedTests, 0)

                      const completionPercentage = strainTests > 0 ? Math.round((strainCompleted / strainTests) * 100) : 0

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

function generateRecentActivities(data: ExperimentData[]) {
  const activities: any[] = []

  data.forEach((experiment) => {
    const tests = experiment.testsData ?? []

    if (tests.length > 0) {
      tests.slice(0, 2).forEach((test, testIndex) => {
        const testId = test.id || `${experiment.id}-idx-${testIndex}`
        const repNum = test.repetitionNumber ?? testIndex + 1
        const testNum = test.testNumber ?? testIndex + 1

        activities.push({
          id: `test-${testId}`,
          type: "test",
          description: `Teste #${testNum} da Repetição #${repNum} do Experimento #${experiment.number} foi concluído`,
          date: new Date(experiment.startDate).toLocaleDateString("pt-BR"),
          status: "completed",
        })
      })
    }

    activities.push({
      id: `exp-${experiment.id}`,
      type: "experiment",
      description: `Experimento #${experiment.number} com cepa ${experiment.strain} foi criado`,
      date: new Date(experiment.startDate).toLocaleDateString("pt-BR"),
      status: "in-progress",
    })
  })

  return activities.slice(0, 5)
}
