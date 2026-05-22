import { acceptInvitationRequest, invitationOptionsResponse } from "@/lib/pdi/accept-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return acceptInvitationRequest(request)
}

export async function OPTIONS() {
  return invitationOptionsResponse()
}
