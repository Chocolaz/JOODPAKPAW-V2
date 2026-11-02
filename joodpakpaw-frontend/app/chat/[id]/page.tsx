'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Check, CheckCheck, Trash2, ImagePlus, ArrowLeft, X } from 'lucide-react'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import type { ChatMessage } from '@/types/chat'

/* ─── helpers ─── */

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: diffDays > 365 ? 'numeric' : undefined })
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr.replace(' ', 'T')).toDateString()
}

function formatTime(dateStr: string): string {
  return new Date(dateStr.replace(' ', 'T')).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatReadAt(readAt: string): string {
  const date = new Date(readAt.replace(' ', 'T'))
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return 'Read just now'
  return `Read ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
}

/* ─── pending image thumbnail ─── */

function PendingImageThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (!src) return null
  return (
    <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <img src={src} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  )
}

/* ─── message bubble ─── */

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

  const attachmentUrls = (message.attachments ?? []).map((att) =>
    typeof att === 'string' ? att : (att.url ?? att.path ?? att.filePath ?? att.file ?? '')
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Other user avatar — placeholder keeps spacing consistent */}
      <div className="w-7 h-7 lg:w-8 lg:h-8 shrink-0 mb-1">
        {!isOwn && showAvatar && (
          message.sender.avatar ? (
            <div className="relative w-7 h-7 lg:w-8 lg:h-8">
              <Image
                src={message.sender.avatar}
                alt={message.sender.firstName}
                fill
                unoptimized
                className="rounded-full object-cover"
              />
            </div>
          ) : (
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-deep-teal/10 flex items-center justify-center">
              <span className="text-deep-teal text-xs font-semibold">
                {message.sender.firstName.charAt(0)}
              </span>
            </div>
          )
        )}
      </div>

      <div className={`max-w-[65%] lg:max-w-[55%] min-w-0 flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Attachments */}
        {attachmentUrls.length > 0 && (
          <>
            <div className={`flex flex-wrap gap-1.5 ${message.content ? 'mb-1' : ''}`}>
              {attachmentUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="rounded-2xl overflow-hidden shadow-sm hover:opacity-95 transition-opacity"
                >
                  <img
                    src={url}
                    alt="attachment"
                    className={`object-cover ${
                      attachmentUrls.length === 1
                        ? 'w-52 h-52 lg:w-64 lg:h-64'
                        : 'w-36 h-36 lg:w-44 lg:h-44'
                    }`}
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
              carousel={{ finite: attachmentUrls.length <= 1, imageFit: 'contain' }}
              controller={{ closeOnBackdropClick: true }}
              render={{ buttonPrev: () => null, buttonNext: () => null }}
              styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.9)' } }}
            />
          </>
        )}

        {/* Text bubble */}
        {message.content && (
          <div
            className={`px-3.5 py-2 lg:px-4 lg:py-2.5 text-sm leading-relaxed shadow-sm break-words max-w-full whitespace-pre-wrap ${
              isOwn
                ? 'bg-accent-orange text-white rounded-2xl rounded-br-md'
                : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Time + unread check */}
        <div className={`flex items-center gap-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] lg:text-xs text-neutral-gray/70">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && showIcon && !message.readAt && (
            <Check className="w-3.5 h-3.5 text-neutral-gray/40" />
          )}
        </div>

        {/* Read receipt: double-check + time together */}
        {isOwn && showReadAt && message.readAt && (
          <div className="flex items-center gap-1 px-1">
            <CheckCheck className="w-3.5 h-3.5 text-accent-orange" />
            <span className="text-[10px] lg:text-xs text-accent-orange/80">
              {formatReadAt(message.readAt)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ─── skeleton ─── */

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6 py-4 animate-pulse">
      {[false, true, false, false, true, true].map((isOwn, i) => (
        <div key={i} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {!isOwn && <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 mb-1" />}
          <div
            className={`h-9 rounded-2xl bg-gray-200 ${
              isOwn ? 'rounded-br-md' : 'rounded-bl-md'
            }`}
            style={{ width: `${[38, 26, 50, 32, 20, 44][i]}%` }}
          />
        </div>
      ))}
    </div>
  )
}

/* ─── main page ─── */

export default function ChatRoomPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = Number(id)
  const { roomMessages, loadRoom, sendMessage, markAsRead, deleteRoom, rooms } = useChat()
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
  const otherUserName = room ? `${room.otherUser.firstName} ${room.otherUser.lastName}` : '...'

  useEffect(() => {
    if (authLoading) return
    if (!requireAuth()) return
    initialScrollDone.current = false
    prevMessagesLengthRef.current = 0
    setIsLoading(true)
    loadRoom(roomId).finally(() => setIsLoading(false))
    markAsRead(roomId)
  }, [roomId, isAuthenticated, authLoading])

  useEffect(() => {
    if (isLoading || messages.length === 0) return
    if (messages.length > prevMessagesLengthRef.current && initialScrollDone.current) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.sender.id !== user?.id) markAsRead(roomId)
    }
    prevMessagesLengthRef.current = messages.length
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
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '40px'
    const images = pendingImages
    setPendingImages([])
    setIsSending(true)
    try {
      await sendMessage(roomId, content, images.length > 0 ? images : undefined)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSending(false)
    }
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
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
      msgs.push(`${tooBig.length} file${tooBig.length > 1 ? 's' : ''} exceeded 5 MB`)
    if (tooMany > 0)
      msgs.push(`${tooMany} file${tooMany > 1 ? 's' : ''} exceeded the 5-image limit`)

    if (msgs.length > 0) {
      setFileSizeError(msgs.join(' · '))
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

  const canSend = (input.trim().length > 0 || pendingImages.length > 0) && !isSending

  return (
    <motion.div
      className="flex flex-col h-[100dvh] lg:h-full bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ willChange: 'opacity' }}
    >

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-3 lg:px-5 py-2.5 lg:py-3 bg-white border-b border-gray-100 shadow-sm">
        {/* Back — always visible */}
        <button
          onClick={() => router.push(from && !from.startsWith('/chat') ? from : '/chat')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          {room?.otherUser.avatar ? (
            <div className="relative w-10 h-10 lg:w-11 lg:h-11">
              <Image
                src={room.otherUser.avatar}
                alt={otherUserName}
                fill
                unoptimized
                className="rounded-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-deep-teal/10 flex items-center justify-center">
              <span className="text-deep-teal font-semibold text-sm">{otherUserName.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-deep-teal text-base lg:text-lg truncate cursor-pointer hover:underline"
            onClick={() => room && router.push(`/hosts/${room.otherUser.id}?from=${encodeURIComponent(`/chat/${roomId}`)}`)}
          >
            {otherUserName}
          </p>
        </div>

        {/* Delete */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete your conversation with <strong>${otherUserName}</strong>? This cannot be undone.`}
        confirmButtonClassName="bg-red-500 hover:bg-red-600 text-white"
      />

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 lg:px-5 py-3 space-y-1"
        style={{ background: 'linear-gradient(180deg, #f9f7f4 0%, #f4f2ef 100%)' }}
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : (
          <AnimatePresence initial={false}>
            {(() => {
              const lastReadOwnIdx = messages.reduce(
                (acc, msg, i) => (msg.sender.id === user?.id && msg.readAt ? i : acc),
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
                    <div key={`date-${dateKey}`} className="flex justify-center my-4">
                      <span className="text-[11px] text-neutral-gray bg-black/6 rounded-full px-3 py-1 select-none">
                        {formatDateLabel(msg.createdAt)}
                      </span>
                    </div>
                  )
                }

                // Show avatar only on the last consecutive message from same sender
                const nextMsg = messages[i + 1]
                const showAvatar = !nextMsg || nextMsg.sender.id !== msg.sender.id

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
            })()}
          </AnimatePresence>
        )}
      </div>

      {/* ── Pending image strip ── */}
      <AnimatePresence>
        {pendingImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden bg-white border-t border-gray-100"
          >
            <div className="flex gap-2 px-4 lg:px-6 py-2.5 overflow-x-auto scrollbar-hide">
              {pendingImages.map((file, i) => (
                <PendingImageThumb
                  key={i}
                  file={file}
                  onRemove={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── File size error ── */}
      <AnimatePresence>
        {fileSizeError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden bg-white"
          >
            <p className="text-xs text-red-500 px-5 py-1.5 border-t border-red-100 bg-red-50">
              {fileSizeError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input bar ── */}
      <div className="shrink-0 flex items-end gap-2 px-3 lg:px-5 py-2.5 lg:py-3 bg-white border-t border-gray-100">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Image attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-neutral-gray hover:text-deep-teal hover:bg-gray-100 transition-colors"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        {/* Text input */}
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
            placeholder="Type a message…"
            style={{ height: '40px' }}
            className={`w-full rounded-2xl bg-gray-100 border px-4 py-2.5 text-sm outline-none resize-none overflow-y-auto scrollbar-hide transition-colors leading-normal border-transparent focus:bg-white focus:border-accent-orange/40 ${
              input.length >= MAX_MESSAGE_LENGTH * 0.8 ? 'pb-5' : ''
            }`}
          />
          {input.length >= MAX_MESSAGE_LENGTH * 0.8 && (
            <span className="absolute bottom-1.5 right-3 text-[10px] font-medium pointer-events-none text-neutral-gray/50">
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        {/* Send */}
        <motion.button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          animate={{ scale: canSend ? 1 : 0.9, opacity: canSend ? 1 : 0.4 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-accent-orange flex items-center justify-center hover:bg-accent-orange/90 transition-colors"
        >
          <Send className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
        </motion.button>
      </div>
    </motion.div>
  )
}
