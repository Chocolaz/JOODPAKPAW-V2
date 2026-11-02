'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { LogOut } from 'lucide-react'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" strokeWidth={1.75} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-[18px] h-[18px]"
        strokeWidth={1.75}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3h18v13H3z" />
        <path d="M12 16v5M8 21h8" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="13" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Verifications',
    href: '/admin/verifications',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-[18px] h-[18px]"
        strokeWidth={1.75}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    label: 'Action Log',
    href: '/admin/action-logs',
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-[18px] h-[18px]"
        strokeWidth={1.75}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isAdmin = user?.role?.some((r) => r.name === 'admin')

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isAdmin)) router.replace('/')
  }, [loading, isAuthenticated, isAdmin, router])

  if (loading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 min-w-60 flex flex-col bg-white border-r border-gray-100">
        {/* Logo */}
        <div className="px-6 h-16 flex items-center gap-2.5 border-b border-gray-100">
          <span className="w-2 h-2 rounded-full bg-accent-orange shrink-0" />
          <span className="font-bold text-[15px] text-gray-900 font-baloo2 tracking-tight">
            JoodPakPaw
          </span>
          <span className="ml-auto text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pb-2">
            Management
          </p>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100 ${
                  active
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span className={active ? 'text-accent-orange' : ''}>
                  {item.icon}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-orange" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-deep-teal flex items-center justify-center text-white text-xs font-bold font-baloo2 shrink-0">
            {user?.firstName?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-gray-400">Administrator</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="font-bold text-[17px] text-gray-900 font-baloo2 leading-none">
              {NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label ??
                'Admin'}
            </h1>
            <p className="text-[11px] text-gray-400 mt-1">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[13px] font-semibold text-gray-800 leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Administrator</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-deep-teal flex items-center justify-center text-white text-xs font-bold font-baloo2 shrink-0">
              {user?.firstName?.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-7 lg:p-8">{children}</div>
      </div>
    </div>
  )
}
