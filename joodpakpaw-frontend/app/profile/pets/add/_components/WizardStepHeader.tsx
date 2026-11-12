import React from 'react'

interface WizardStepHeaderProps {
  title: string
  description: string
}

export function WizardStepHeader({ title, description }: WizardStepHeaderProps) {
  return (
    <header className="text-center mb-8">
      <h2 className="text-2xl font-medium tracking-tight text-deep-teal">
        {title}
      </h2>
      <p className="mt-2 text-sm text-neutral-gray max-w-md mx-auto">
        {description}
      </p>
    </header>
  )
}
