import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function InviteRedirectPage({ searchParams }: { searchParams?: { token?: string } }) {
  const token = searchParams?.token?.trim() ?? ""
  const suffix = token ? `?token=${encodeURIComponent(token)}` : ""
  redirect(`/auth/cadastro-convite${suffix}`)
}
