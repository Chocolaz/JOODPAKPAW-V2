'use client'

import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
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
}

export function ContactHostButton({ hostId, compact, chatRoomId, onSuccess }: ContactHostButtonProps) {
  const { requireAuth, user } = useAuth()
  const { refreshRooms } = useChat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
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
      const room = await createChatRoom(hostId, message.trim())
      await refreshRooms()
      setOpen(false)
      setMessage('')
      toast.success('Message sent!')
      onSuccess?.(room.id)
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const messageForm = (
    <textarea
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
      placeholder="Type your message..."
      rows={4}
      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-accent-orange transition-colors resize-none"
    />
  )

  const sendButton = (
    <Button
      className="bg-accent-orange gap-2"
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
        className={compact
          ? 'shrink-0 border-accent-orange text-accent-orange hover:bg-accent-orange/5 gap-2 px-4'
          : 'w-full border-accent-orange text-accent-orange hover:bg-accent-orange/5 gap-2'
        }
        onClick={handleOpen}
      >
        <MessageCircle className="w-4 h-4" />
        {chatRoomId ? 'View Chat' : compact ? 'Message' : 'Message Host'}
      </Button>

      {/* Desktop: Dialog */}
      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-deep-teal">Message Host</DialogTitle>
              <DialogDescription>
                Send a message to the host before booking.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">{messageForm}</div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {sendButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        /* Mobile: Drawer */
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-2xl">
              <DrawerHeader>
                <DrawerTitle>Message Host</DrawerTitle>
                <DrawerDescription>
                  Send a message to the host before booking.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-5 pb-2">{messageForm}</div>
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
