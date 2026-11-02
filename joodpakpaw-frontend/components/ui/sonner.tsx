'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'
import { CircleCheck } from 'lucide-react'

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      duration={5000}
      toastOptions={{
        style: {
          background: 'white',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
          color: 'black',
        },
        classNames: {
          toast:
            'flex items-start gap-3 text-sm font-medium leading-tight transition-opacity duration-300 ease-in-out',
          description: 'text-sm text-neutral-500 mt-0.5',
          icon: 'w-6 h-6 flex items-center justify-center',
          actionButton: 'bg-black text-white px-3 py-1 rounded-md text-sm',
          cancelButton:
            'bg-neutral-100 text-neutral-600 px-3 py-1 rounded-md text-sm',
        },
      }}
      icons={{
        success: <CircleCheck className="w-full h-full text-green-600" />,
      }}
      {...props}
    />
  )
}
