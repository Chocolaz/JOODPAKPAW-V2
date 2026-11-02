'use client'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface FormSubmitButtonProps {
  isSubmitting: boolean
  buttonText: string
  onClick?: () => void // For non-submit actions if needed
  type?: 'submit' | 'button'
}

export function FormSubmitButton({
  isSubmitting,
  buttonText,
  onClick,
  type = 'submit',
}: FormSubmitButtonProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 w-full p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          type={type}
          onClick={onClick}
          disabled={isSubmitting}
          className="w-full h-12 text-lg bg-positive-green"
        >
          {isSubmitting ? <Spinner /> : buttonText}
        </Button>
      </div>
    </div>
  )
}
