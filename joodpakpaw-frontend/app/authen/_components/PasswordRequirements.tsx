'use client'

import { useState } from 'react'
import { validatePassword } from '@/lib/utils'

const requirements = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasUppercase', label: 'Uppercase letter (A-Z)' },
  { key: 'hasLowercase', label: 'Lowercase letter (a-z)' },
  { key: 'hasNumber', label: 'Number (0-9)' },
  { key: 'hasSpecialChar', label: 'Special character' },
  { key: 'isAsciiOnly', label: 'English characters only' },
] as const

const SPECIAL_CHARS = '! @ # $ % ^ & * ( ) _ + - = [ ] { } ; \' : " \\ | , . < > / ?'

export default function PasswordRequirements({
  password,
}: {
  password: string
}) {
  const validation = validatePassword(password)
  const [showSpecialChars, setShowSpecialChars] = useState(false)

  if (!password) return null

  return (
    <ul className="mt-2 space-y-1 text-left text-sm">
      {requirements.map(({ key, label }) => {
        const met = validation[key]
        return (
          <li key={key}>
            <div className="flex items-center gap-2">
              <span className={met ? 'text-green-500' : 'text-gray-400'}>
                {met ? '\u2713' : '\u25CB'}
              </span>
              {key === 'hasSpecialChar' ? (
                <span
                  className={`cursor-pointer underline ${met ? 'text-green-600' : 'text-gray-500'}`}
                  onClick={() => setShowSpecialChars(!showSpecialChars)}
                >
                  {label}
                </span>
              ) : (
                <span className={met ? 'text-green-600' : 'text-gray-500'}>
                  {label}
                </span>
              )}
            </div>
            {key === 'hasSpecialChar' && showSpecialChars && (
              <p className="ml-6 mt-1 text-xs text-gray-400 tracking-wider">
                {SPECIAL_CHARS}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
