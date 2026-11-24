import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface PropertyFilterDropdownProps {
  value: string
  onChange: (value: string) => void
  propertyNames: string[]
  className?: string
}

export function PropertyFilterDropdown({
  value,
  onChange,
  propertyNames,
  className,
}: PropertyFilterDropdownProps) {
  if (propertyNames.length <= 1) return null

  const isFiltered = value !== 'ALL'

  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by property"
        className={cn(
          'appearance-none pl-3.5 pr-8 py-1.5 rounded-full text-xs font-medium border cursor-pointer outline-none transition-colors duration-150',
          isFiltered
            ? 'bg-deep-teal text-white border-deep-teal'
            : 'bg-white text-neutral-gray border-border hover:border-deep-teal'
        )}
      >
        <option value="ALL">All Properties</option>
        {propertyNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          'absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none',
          isFiltered ? 'text-white' : 'text-neutral-gray'
        )}
      />
    </div>
  )
}
