const MAX_IMAGE_DIMENSION = 1920
const JPEG_QUALITY = 0.82

const loadImage = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Impossible de lire cette image.")) }
  image.src = url
})

export async function compressPhoto(file) {
  if (!file?.type?.startsWith("image/")) return file
  // Animated GIFs should not be flattened into a static JPEG.
  if (file.type === "image/gif") return file

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("La compression de l’image n’est pas disponible sur cet appareil.")

  // JPEG has no transparency: use a neutral white background for PNG/WebP photos.
  context.fillStyle = "#fff"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))
  if (!blob) throw new Error("Impossible de compresser cette image.")

  // Never make an already-small image larger.
  if (blob.size >= file.size) return file

  const baseName = (file.name || "photo").replace(/\.[^.]+$/, "")
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}
