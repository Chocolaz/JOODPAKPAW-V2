export const getStaticMapUrl = ({
  latitude,
  longitude,
  width = 600,
  height = 600,
  zoom = 15,
}: {
  latitude: number | string
  longitude: number | string
  width?: number
  height?: number
  zoom?: number
}) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('Google Maps API key is not configured.')
    return ''
  }
  return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&markers=color:red|${latitude},${longitude}&key=${apiKey}`
}
