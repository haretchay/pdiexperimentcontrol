declare module "qrcode" {
  export type QRCodeErrorCorrectionLevel = "L" | "M" | "Q" | "H"

  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel
    margin?: number
    scale?: number
    small?: boolean
    type?: string
    width?: number
    color?: {
      dark?: string
      light?: string
    }
  }

  export function toDataURL(
    text: string | readonly unknown[],
    options?: QRCodeToDataURLOptions,
  ): Promise<string>

  export function toDataURL(
    canvasElement: HTMLCanvasElement,
    text: string | readonly unknown[],
    options?: QRCodeToDataURLOptions,
  ): Promise<string>

  const QRCode: {
    toDataURL: typeof toDataURL
  }

  export default QRCode
}
