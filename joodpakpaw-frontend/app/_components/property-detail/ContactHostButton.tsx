'use client'

import { useState } from 'react'
import { MessageCircle, Send, Building, PawPrint, Clock, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/app/_components/AuthContext'
import { useChat } from '@/app/_components/ChatContext'
import { createChatRoom } from '@/lib/api'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

interface ContactHostButtonProps {
  hostId: number
  compact?: boolean
  chatRoomId?: number | null
  onSuccess?: (chatRoomId: number) => void
  propertyId?: number
  propertyTitle?: string
  propertyThumbnail?: string | null
  startingPrice?: number
}

const QUICK_CHIPS = [
  {
    icon: PawPrint,
    label: 'Check pet compatibility',
    text: "Hi! I'd like to ask if your property can accommodate my pet.",
  },
  {
    icon: Clock,
    label: 'Check-in & check-out times',
    text: 'Hi! What are the check-in and check-out times for this property?',
  },
  {
    icon: Camera,
    label: 'Daily photo updates',
    text: 'Hi! Do you provide daily photo or video updates during the stay?',
  },
]

export function ContactHostButton({
  hostId,
  compact,
  chatRoomId,
  onSuccess,
  propertyId,
  propertyTitle,
  propertyThumbnail,
  startingPrice,
}: ContactHostButtonProps) {
  const { requireAuth, user } = useAuth()
  const { refreshRooms } = useChat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fullPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (user?.id === hostId) return null

  const handleOpen = () => {
    if (!requireAuth()) return
    if (chatRoomId) {
      router.push(`/chat/${chatRoomId}?from=${encodeURIComponent(fullPath)}`)
      return
    }
    setOpen(true)
  }

  const handleSend = async () => {
    if (!message.trim() || isSending) return
    setIsSending(true)
    try {
      const room = await createChatRoom(hostId, message.trim(), propertyId)
      await refreshRooms()
      setOpen(false)
      setMessage('')
      toast.success('Inquiry sent to host!', {
        description: 'Your message has been delivered.',
        action: {
          label: 'Open Chat',
          onClick: () =>
            router.push(`/chat/${room.id}?from=${encodeURIComponent(fullPath)}`),
        },
      })
      onSuccess?.(room.id)
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const listingCard = propertyTitle ? (
    <div className="flex items-center gap-3 p-3 bg-off-white/60 rounded-xl border border-border mb-3">
      {propertyThumbnail ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={propertyThumbnail}
          alt={propertyTitle}
          className="w-14 h-14 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
          <Building className="w-6 h-6 text-neutral-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-deep-teal truncate">
          {propertyTitle}
        </p>
        {startingPrice !== undefined && (
          <p className="text-xs text-neutral-gray mt-0.5">
            From{' '}
            <span className="font-semibold text-accent-orange tabular-nums">
              ฿{startingPrice.toLocaleString()}
            </span>{' '}
            / night
          </p>
        )}
      </div>
    </div>
  ) : null

  const quickChipsSection = (
    <div className="space-y-1.5 mb-3">
      <p className="text-xs font-medium text-neutral-gray">Quick inquiries:</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip, idx) => {
          const Icon = chip.icon
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setMessage((prev) =>
                  prev ? `${prev}\n${chip.text}` : chip.text
                )
              }}
              className="inline-flex items-center gap-1.5 text-xs bg-off-white/80 hover:bg-accent-orange/10 hover:text-accent-orange hover:border-accent-orange/30 border border-border rounded-full px-3 py-1.5 text-foreground transition-colors text-left cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-deep-teal shrink-0" />
              <span>{chip.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const messageForm = (
    <textarea
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
      placeholder="Type your message..."
      rows={4}
      className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-deep-teal transition-colors resize-none"
    />
  )

  const sendButton = (
    <Button
      className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-2"
      onClick={handleSend}
      disabled={!message.trim() || isSending}
    >
      {isSending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
      Send
    </Button>
  )

  return (
    <>
      <Button
        variant="outline"
        className={
          compact
            ? 'w-full sm:w-auto shrink-0 border-deep-teal/30 text-deep-teal hover:bg-deep-teal/5 gap-2 px-4 rounded-xl cursor-pointer'
            : 'w-full border-deep-teal/30 text-deep-teal hover:bg-deep-teal/5 gap-2 rounded-xl cursor-pointer'
        }
        onClick={handleOpen}
      >
        <MessageCircle className="w-4 h-4" />
        {chatRoomId ? 'View Chat' : compact ? 'Message' : 'Message Host'}
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-deep-teal">Message Host</DialogTitle>
              <DialogDescription>
                Send a message to the host before booking.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {listingCard}
              {quickChipsSection}
              {messageForm}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {sendButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-2xl">
              <DrawerHeader>
                <DrawerTitle>Message Host</DrawerTitle>
                <DrawerDescription>
                  Send a message to the host before booking.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-5 pb-2">
                {listingCard}
                {quickChipsSection}
                {messageForm}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
                {sendButton}
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
