'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Send,
  Check,
  CheckCheck,
  Trash2,
  ImagePlus,
  ChevronLeft,
  X,
  BadgeCheck,
  Calendar,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { cn, getDisplayName } from '@/lib/utils'
import type { ChatMessage } from '@/types/chat'

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr.replace(' ', 'T')).toDateString()
}

function formatTime(dateStr: string): string {
  return new Date(dateStr.replace(' ', 'T')).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatReadAt(readAt: string): string {
  const date = new Date(readAt.replace(' ', 'T'))
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return 'Read just now'
  return `Read ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
}

function PendingImageThumb({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const src = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => {
    return () => URL.revokeObjectURL(src)
  }, [src])

  return (
    <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Pending attachment" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute top-1 right-1 w-5 h-5 bg-foreground/80 hover:bg-foreground rounded-full flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  showReadAt,
  showIcon,
  showAvatar,
}: {
  message: ChatMessage
  isOwn: boolean
  showReadAt: boolean
  showIcon: boolean
  showAvatar: boolean
}) {
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const senderDisplayName = getDisplayName(message.sender) || 'User'

  const attachmentUrls = (message.attachments ?? []).map((att) =>
    typeof att === 'string'
      ? att
      : (att.url ?? att.path ?? att.filePath ?? att.file ?? '')
  )

  return (
    <div
      className={cn(
        'flex items-end gap-2',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className="w-7 h-7 lg:w-8 lg:h-8 shrink-0 mb-1">
        {!isOwn &&
          showAvatar &&
          (message.sender.avatar ? (
            <div className="relative w-7 h-7 lg:w-8 lg:h-8 rounded-full overflow-hidden border border-border">
              <Image
                src={message.sender.avatar}
                alt={senderDisplayName}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-deep-teal/10 flex items-center justify-center">
              <span className="text-deep-teal text-xs font-semibold">
                {senderDisplayName.charAt(0).toUpperCase()}
              </span>
            </div>
          ))}
      </div>

      <div
        className={cn(
          'max-w-[70%] lg:max-w-[58%] min-w-0 flex flex-col gap-1',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {attachmentUrls.length > 0 && (
          <>
            <div
              className={cn(
                'flex flex-wrap gap-1.5',
                message.content && 'mb-0.5'
              )}
            >
              {attachmentUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="rounded-2xl overflow-hidden border border-border hover:opacity-95 transition-opacity cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Attachment ${i + 1}`}
                    className={cn(
                      'object-cover',
                      attachmentUrls.length === 1
                        ? 'w-52 h-52 lg:w-64 lg:h-64'
                        : 'w-36 h-36 lg:w-44 lg:h-44'
                    )}
                  />
                </button>
              ))}
            </div>
            <Lightbox
              open={lightboxIndex >= 0}
              close={() => setLightboxIndex(-1)}
              index={lightboxIndex}
              slides={attachmentUrls.map((src) => ({ src }))}
              on={{ view: ({ index }) => setLightboxIndex(index) }}
              carousel={{
                finite: attachmentUrls.length <= 1,
                imageFit: 'contain',
              }}
              controller={{ closeOnBackdropClick: true }}
              render={{ buttonPrev: () => null, buttonNext: () => null }}
              styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.9)' } }}
            />
          </>
        )}

        {message.content && (
          <div
            className={cn(
              'px-3.5 py-2 lg:px-4 lg:py-2.5 text-sm leading-relaxed break-words max-w-full whitespace-pre-wrap',
              isOwn
                ? 'bg-accent-orange text-white rounded-2xl rounded-br-md'
                : 'bg-white border border-border text-foreground rounded-2xl rounded-bl-md'
            )}
          >
            {message.content}
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-1 px-1',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="text-[11px] text-neutral-gray tabular-nums">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && showIcon && !message.readAt && (
            <Check className="w-3.5 h-3.5 text-neutral-gray/50" />
          )}
        </div>

        {isOwn && showReadAt && message.readAt && (
          <div className="flex items-center gap-1 px-1">
            <CheckCheck className="w-3.5 h-3.5 text-deep-teal" />
            <span className="text-[11px] text-deep-teal font-medium tabular-nums">
              {formatReadAt(message.readAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6 py-4 animate-pulse motion-reduce:animate-none">
      {[false, true, false, false, true, true].map((isOwn, i) => (
        <div
          key={i}
          className={cn(
            'flex items-end gap-2',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {!isOwn && (
            <div className="w-7 h-7 rounded-full bg-neutral-200 shrink-0 mb-1" />
          )}
          <div
            className={cn(
              'h-9 rounded-2xl bg-neutral-200',
              isOwn ? 'rounded-br-md' : 'rounded-bl-md'
            )}
            style={{ width: `${[38, 26, 50, 32, 20, 44][i]}%` }}
          />
        </div>
      ))}
    </div>
  )
}

export default function ChatRoomPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = Number(id)
  const { roomMessages, loadRoom, sendMessage, markAsRead, deleteRoom, rooms } =
    useChat()
  const { user, requireAuth, isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [fileSizeError, setFileSizeError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const initialScrollDone = useRef(false)
  const prevMessagesLengthRef = useRef(0)

  const messages = roomMessages[roomId] ?? []
  const room = rooms.find((r) => r.id === roomId)
  const otherUserName = room
    ? getDisplayName(room.otherUser) || 'User'
    : 'Conversation'

  useEffect(() => {
    if (authLoading) return
    if (!requireAuth()) return
    let active = true
    initialScrollDone.current = false
    prevMessagesLengthRef.current = 0
    Promise.resolve().then(() => {
      if (active) setIsLoading(true)
    })
    loadRoom(roomId).finally(() => {
      if (active) setIsLoading(false)
    })
    markAsRead(roomId)
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isAuthenticated, authLoading])

  useEffect(() => {
    if (isLoading || messages.length === 0) return
    if (
      messages.length > prevMessagesLengthRef.current &&
      initialScrollDone.current
    ) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.sender.id !== user?.id) markAsRead(roomId)
    }
    prevMessagesLengthRef.current = messages.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading, roomId])

  useLayoutEffect(() => {
    if (messages.length === 0 || isLoading) return
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    initialScrollDone.current = true
  }, [messages.length, isLoading])

  async function handleSend() {
    const content = input.trim()
    if ((!content && pendingImages.length === 0) || isSending) return
    const prevInput = input
    const prevImages = pendingImages
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '40px'
    setPendingImages([])
    setIsSending(true)
    try {
      await sendMessage(
        roomId,
        content,
        prevImages.length > 0 ? prevImages : undefined
      )
    } catch (e) {
      setInput(prevInput)
      setPendingImages(prevImages)
      toast.error(
        e instanceof Error
          ? e.message
          : 'Failed to send message. Please try again.'
      )
    } finally {
      setIsSending(false)
    }
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024
  const MAX_MESSAGE_LENGTH = 1000

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const tooBig = files.filter((f) => f.size > MAX_FILE_SIZE)
    const sizeOk = files.filter((f) => f.size <= MAX_FILE_SIZE)

    const slots = 5 - pendingImages.length
    const accepted = sizeOk.slice(0, slots)
    const tooMany = sizeOk.length - accepted.length

    const msgs: string[] = []
    if (tooBig.length > 0)
      msgs.push(
        `${tooBig.length} ${tooBig.length > 1 ? 'files' : 'file'} exceeded 5 MB`
      )
    if (tooMany > 0)
      msgs.push(
        `${tooMany} ${tooMany > 1 ? 'files' : 'file'} exceeded the 5-image limit`
      )

    if (msgs.length > 0) {
      setFileSizeError(msgs.join(', '))
      setTimeout(() => setFileSizeError(''), 3500)
    }

    if (accepted.length > 0) {
      setPendingImages((prev) => [...prev, ...accepted])
    }
    e.target.value = ''
  }

  async function handleDelete() {
    await deleteRoom(roomId)
    router.push('/chat')
  }

  const canSend =
    (input.trim().length > 0 || pendingImages.length > 0) && !isSending

  return (
    <div className="flex flex-col h-[100dvh] lg:h-full bg-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 lg:px-5 py-3 bg-white border-b border-border">
        <button
          type="button"
          aria-label="Back to messages"
          onClick={() =>
            router.push(from && !from.startsWith('/chat') ? from : '/chat')
          }
          className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-deep-teal hover:bg-off-white transition-colors shrink-0 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="relative shrink-0">
          {room?.otherUser.avatar ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border">
              <Image
                src={room.otherUser.avatar}
                alt={otherUserName}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-deep-teal/10 flex items-center justify-center">
              <span className="text-deep-teal font-semibold text-sm">
                {otherUserName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {room?.otherUser?.isHost ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/hosts/${room.otherUser.id}?from=${encodeURIComponent(`/chat/${roomId}`)}`
                )
              }
              className="font-semibold text-deep-teal text-sm lg:text-base truncate cursor-pointer hover:underline inline-flex items-center gap-1.5 max-w-full"
            >
              <span className="truncate">{otherUserName}</span>
              {room.otherUser.isVerifiedHost && (
                <BadgeCheck className="w-4 h-4 text-deep-teal shrink-0" />
              )}
            </button>
          ) : (
            <p className="font-semibold text-deep-teal text-sm lg:text-base truncate">
              {otherUserName}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label="Delete conversation"
          onClick={() => setShowDeleteModal(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-gray hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Sticky Context Banner */}
      {room?.activeBooking ? (
        <div className="shrink-0 bg-off-white/75 border-b border-border px-3 lg:px-5 py-2.5 flex items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-orange/15 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-accent-orange" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-deep-teal truncate">
                  {room.activeBooking.propertyTitle}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-orange/15 text-accent-orange capitalize shrink-0">
                  {room.activeBooking.bookingStatus}
                </span>
              </div>
              <p className="text-neutral-gray text-[11px] mt-0.5 truncate tabular-nums">
                {new Date(room.activeBooking.checkInDate).toLocaleDateString(
                  'en-GB',
                  { day: 'numeric', month: 'short' }
                )}{' '}
                –{' '}
                {new Date(room.activeBooking.checkOutDate).toLocaleDateString(
                  'en-GB',
                  { day: 'numeric', month: 'short', year: 'numeric' }
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const isHostView =
                user?.role?.some((r) => r.name === 'host') &&
                !room.otherUser?.isHost
              router.push(
                isHostView
                  ? `/profile/host/booking/${room.activeBooking!.id}`
                  : `/profile/bookings/${room.activeBooking!.id}`
              )
            }}
            className="shrink-0 text-xs font-semibold text-deep-teal hover:bg-off-white bg-white border border-border rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
          >
            View booking
          </button>
        </div>
      ) : room?.contextProperty ? (
        <div className="shrink-0 bg-off-white/60 border-b border-border px-3 lg:px-5 py-2.5 flex items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {room.contextProperty.thumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={room.contextProperty.thumbnail}
                alt={room.contextProperty.title}
                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-deep-teal/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-deep-teal" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[11px] text-neutral-gray block">
                Inquiring about stay
              </span>
              <span className="font-semibold text-deep-teal truncate block">
                {room.contextProperty.title}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              router.push(`/detail/${room.contextProperty!.id}`)
            }
            className="shrink-0 text-xs font-semibold text-deep-teal hover:bg-off-white bg-white border border-border rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
          >
            View stay
          </button>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete your conversation with <strong>${otherUserName}</strong>? This cannot be undone.`}
        confirmButtonClassName="bg-red-600 hover:bg-red-700 text-white"
      />

      {/* Messages Canvas */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain modern-scrollbar px-3 lg:px-5 py-4 space-y-1.5 bg-off-white/35"
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : (
          (() => {
            const lastReadOwnIdx = messages.reduce(
              (acc, msg, i) =>
                msg.sender.id === user?.id && msg.readAt ? i : acc,
              -1
            )
            const lastOwnIdx = messages.reduce(
              (acc, msg, i) => (msg.sender.id === user?.id ? i : acc),
              -1
            )
            let lastDateKey = ''
            return messages.flatMap((msg, i) => {
              const dateKey = getDateKey(msg.createdAt)
              const items: React.ReactNode[] = []

              if (dateKey !== lastDateKey) {
                lastDateKey = dateKey
                items.push(
                  <div
                    key={`date-${dateKey}`}
                    className="flex justify-center my-4"
                  >
                    <span className="text-[11px] font-medium text-neutral-gray bg-white border border-border rounded-full px-3 py-1 select-none tabular-nums">
                      {formatDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )
              }

              const nextMsg = messages[i + 1]
              const showAvatar =
                !nextMsg || nextMsg.sender.id !== msg.sender.id

              items.push(
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender.id === user?.id}
                  showReadAt={i === lastReadOwnIdx}
                  showIcon={i === lastOwnIdx}
                  showAvatar={showAvatar}
                />
              )
              return items
            })
          })()
        )}
      </div>

      {/* Pending image strip */}
      {pendingImages.length > 0 && (
        <div className="shrink-0 overflow-hidden bg-white border-t border-border">
          <div className="flex gap-2 px-4 lg:px-6 py-2.5 overflow-x-auto scrollbar-hide">
            {pendingImages.map((file, i) => (
              <PendingImageThumb
                key={i}
                file={file}
                onRemove={() =>
                  setPendingImages((prev) => prev.filter((_, idx) => idx !== i))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* File size error */}
      {fileSizeError && (
        <div className="shrink-0 overflow-hidden bg-white">
          <p className="text-xs text-red-600 px-5 py-1.5 border-t border-red-100 bg-red-50">
            {fileSizeError}
          </p>
        </div>
      )}

      {/* Composer Bar */}
      <div className="shrink-0 flex items-end gap-2 px-3 lg:px-5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:py-3 bg-white border-t border-border">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImagePick}
        />

        <button
          type="button"
          aria-label="Attach photo"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-neutral-gray hover:text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            maxLength={MAX_MESSAGE_LENGTH}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              const el = e.target
              el.style.height = '40px'
              el.style.height = `${Math.min(el.scrollHeight, 104)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message..."
            style={{ height: '40px' }}
            className={cn(
              'w-full rounded-2xl bg-off-white/60 border border-border px-4 py-2 text-sm outline-none resize-none overflow-y-auto scrollbar-hide transition-colors leading-normal focus:bg-white focus:border-deep-teal',
              input.length >= MAX_MESSAGE_LENGTH * 0.8 && 'pb-5'
            )}
          />
          {input.length >= MAX_MESSAGE_LENGTH * 0.8 && (
            <span className="absolute bottom-1.5 right-3 text-[10px] font-medium pointer-events-none text-neutral-gray tabular-nums">
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'shrink-0 w-10 h-10 rounded-full bg-accent-orange flex items-center justify-center hover:bg-accent-orange/90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  )
}
