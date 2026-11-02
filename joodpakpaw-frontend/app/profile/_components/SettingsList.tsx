// components/SettingsList.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'
import { useState } from 'react'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'

import { ChevronRight } from 'lucide-react'
import LogoutIcon from '@/public/icons/setting/logout.svg' // Import as component
import LoginIcon from '@/public/icons/setting/login.svg' // Import as component

export function SettingsList() {
  const router = useRouter()
  const { isAuthenticated, logout } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/authen')
  }

  const handleLogin = () => {
    router.push('/authen')
  }

  const handleSignOutClick = () => {
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="w-full shadow-sm">
        <CardContent className="p-0">
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors duration-200 ease-in-out"
            onClick={isAuthenticated ? handleSignOutClick : handleLogin}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-6 h-6">
                {isAuthenticated ? (
                  <LogoutIcon className="w-6 h-6 text-red-500 transition-transform duration-200 ease-in-out transform hover:scale-110" />
                ) : (
                  <LoginIcon className="w-6 h-6 text-green-500 transition-colors duration-200 ease-in-out" />
                )}
              </div>
              <span className="font-medium text-neutral-gray transition-colors duration-200 ease-in-out">
                {isAuthenticated ? 'Sign out' : 'Sign in'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-gray transition-colors duration-200 ease-in-out" />
          </button>
        </CardContent>
      </Card>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleLogout}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out?"
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-accent-orange"
      />
    </>
  )
}
