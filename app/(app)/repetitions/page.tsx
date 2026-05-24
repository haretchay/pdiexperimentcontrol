import { redirect } from "next/navigation"

// Mantido apenas para compatibilidade com arquivos antigos não utilizados durante a limpeza gradual.
export type UIRepetition = {
  experimentId: string
  experimentNumber: string
  strain: string
  startDate: string
  repetitionNumber: number
  testCount: number
}

export default function RepetitionsPage() {
  redirect("/tests")
}
