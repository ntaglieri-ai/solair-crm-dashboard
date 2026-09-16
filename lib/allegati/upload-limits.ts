export const MAX_ALLEGATO_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_ALLEGATO_UPLOAD_LABEL = "4 MB"

export function isAllegatoTooLarge(size: number): boolean {
  return size > MAX_ALLEGATO_UPLOAD_BYTES
}
