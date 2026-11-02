import { Bell, User, Home, CalendarPlus, CreditCard, Star, CalendarX, Clock, Flag, ShieldCheck, Ticket } from 'lucide-react'
import React from 'react'

export type Tab = 'all' | 'guest' | 'host'

export const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'all', label: 'All', Icon: Bell },
  { id: 'guest', label: 'Guest', Icon: User },
  { id: 'host', label: 'Host', Icon: Home },
]

export const ACTION_CONFIG: Record<
  string,
  {
    guest: { Icon: React.ElementType; color: string; bg: string }
    host:  { Icon: React.ElementType; color: string; bg: string }
  }
> = {
  booking: {
    guest: { Icon: CalendarPlus, color: 'text-blue-500',    bg: 'bg-blue-100' },
    host:  { Icon: CalendarPlus, color: 'text-deep-teal',   bg: 'bg-deep-teal/10' },
  },
  payment: {
    guest: { Icon: CreditCard,   color: 'text-purple-500',  bg: 'bg-purple-100' },
    host:  { Icon: CreditCard,   color: 'text-emerald-600', bg: 'bg-emerald-100' },
  },
  review: {
    guest: { Icon: Star,         color: 'text-yellow-500',  bg: 'bg-yellow-100' },
    host:  { Icon: Star,         color: 'text-yellow-500',  bg: 'bg-yellow-100' },
  },
  cancel: {
    guest: { Icon: CalendarX,    color: 'text-red-500',     bg: 'bg-red-100' },
    host:  { Icon: CalendarX,    color: 'text-red-500',     bg: 'bg-red-100' },
  },
  reminder: {
    guest: { Icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-100' },
    host:  { Icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-100' },
  },
  report: {
    guest: { Icon: Flag,         color: 'text-orange-500',  bg: 'bg-orange-100' }, // reporter submitted a report
    host:  { Icon: Ticket,       color: 'text-red-500',     bg: 'bg-red-100' },    // host received report/appeal decision
  },
  verification: {
    guest: { Icon: ShieldCheck,  color: 'text-blue-500',    bg: 'bg-blue-100' },
    host:  { Icon: ShieldCheck,  color: 'text-blue-500',    bg: 'bg-blue-100' },
  },
}

/** Actions that navigate to the booking detail page when tapped */
export const BOOKING_DETAIL_ACTIONS = new Set([
  'booking',
  'payment',
  'review',
  'reminder',
  'cancel',
])
