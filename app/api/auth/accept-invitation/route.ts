import { acceptInvitationRequest, invitationOptionsResponse, methodNotAllowedResponse } from "@/lib/pdi/accept-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  return acceptInvitationRequest(request)
}

export async function OPTIONS() {
  return invitationOptionsResponse()
}

export async function GET() {
  return methodNotAllowedResponse()
}

export async function PUT() {
  return methodNotAllowedResponse()
}

export async function PATCH() {
  return methodNotAllowedResponse()
}

export async function DELETE() {
  return methodNotAllowedResponse()
}
