import { redirect } from "next/navigation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PageProps = {
  params?: {
    token?: string | string[]
  }
}

export default function ConviteTokenRedirectPage({ params }: PageProps) {
  const rawToken = Array.isArray(params?.token) ? params?.token[0] : params?.token
  const token = typeof rawToken === "string" ? rawToken.trim() : ""

  redirect(token ? `/auth/invite?token=${encodeURIComponent(token)}` : "/auth/invite")
}
