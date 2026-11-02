export function InfoRow({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex justify-between items-start py-2.5 gap-4">
      <dt className="text-xs text-gray-400 shrink-0">{label}</dt>
      <dd className="text-xs font-medium text-gray-800 text-right">
        {value}
        {sub && <span className="block text-gray-400 font-normal">{sub}</span>}
      </dd>
    </div>
  )
}
