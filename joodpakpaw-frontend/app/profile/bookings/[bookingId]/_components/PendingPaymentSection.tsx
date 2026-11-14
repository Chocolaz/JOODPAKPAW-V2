'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { confirmPayment } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { cn } from '@/lib/utils'
import { PromptPaySlipDropzone } from '@/components/booking/PromptPaySlipDropzone'
import {
  CheckCircle2,
  Clock,
  QrCode,
  Copy,
  Check,
  Building2,
  ShieldCheck,
} from 'lucide-react'

// =========================================================================
// EMVCo PromptPay CRC16 and Payload Generator
// =========================================================================
function calculateCrc16Ccitt(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildPromptPayPayload(targetPhoneOrId: string, amount?: number): string {
  const cleaned = targetPhoneOrId.replace(/[^0-9]/g, '')
  let formattedTarget = cleaned
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    formattedTarget = '0066' + cleaned.slice(1)
  }

  const aidTag = '0016A000000677010111'
  const targetTag = '01' + String(formattedTarget.length).padStart(2, '0') + formattedTarget
  const merchantAccountInfo = '29' + String(aidTag.length + targetTag.length).padStart(2, '0') + aidTag + targetTag

  let payload = '000201010212' + merchantAccountInfo + '5303764'
  if (typeof amount === 'number' && amount > 0) {
    const amountStr = amount.toFixed(2)
    payload += '54' + String(amountStr.length).padStart(2, '0') + amountStr
  }
  payload += '5802TH6304'
  const checksum = calculateCrc16Ccitt(payload)
  return payload + checksum
}

// =========================================================================
// Pure TypeScript QR Matrix Generator (Version 5 Level L - 37x37)
// =========================================================================
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
let gfX = 1
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfX
  GF_LOG[gfX] = i
  gfX <<= 1
  if (gfX & 0x100) gfX ^= 0x11d
}
for (let i = 255; i < 512; i++) {
  GF_EXP[i] = GF_EXP[i - 255]
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function rsGeneratorPoly(n: number): number[] {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0)
    const root = GF_EXP[i]
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j]
      next[j + 1] ^= gfMul(g[j], root)
    }
    g = next
  }
  return g
}

function rsCompute(data: number[], numEc: number): number[] {
  const gen = rsGeneratorPoly(numEc)
  const res = new Array(numEc).fill(0)
  for (const byte of data) {
    const factor = byte ^ res[0]
    res.shift()
    res.push(0)
    for (let i = 0; i < numEc; i++) {
      res[i] ^= gfMul(gen[i + 1], factor)
    }
  }
  return res
}

function generateQrMatrix(text: string): number[][] {
  const size = 37 // Version 5
  const dataCapacity = 108
  const ecCodewords = 26
  const bits: number[] = []

  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }

  pushBits(4, 4) // Byte mode
  pushBits(text.length, 8)
  for (let i = 0; i < text.length; i++) pushBits(text.charCodeAt(i), 8)
  pushBits(0, 4) // Terminator
  while (bits.length % 8 !== 0) bits.push(0)

  const dataBytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
    dataBytes.push(b)
  }

  let padToggle = 0
  while (dataBytes.length < dataCapacity) {
    dataBytes.push(padToggle === 0 ? 0xec : 0x11)
    padToggle ^= 1
  }

  const ecBytes = rsCompute(dataBytes, ecCodewords)
  const allCodewords = [...dataBytes, ...ecBytes]
  const allBits: number[] = []
  for (const byte of allCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((byte >> i) & 1)
  }

  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0))
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))

  function setFunc(r: number, c: number, val: number) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val
      isFunction[r][c] = true
    }
  }

  function addFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r
        const col = left + c
        if (row < 0 || row >= size || col < 0 || col >= size) continue
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          setFunc(row, col, 0)
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          setFunc(row, col, 1)
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          setFunc(row, col, 1)
        } else {
          setFunc(row, col, 0)
        }
      }
    }
  }

  addFinder(0, 0)
  addFinder(0, size - 7)
  addFinder(size - 7, 0)

  // Timing patterns
  for (let c = 8; c < size - 8; c++) {
    setFunc(6, c, c % 2 === 0 ? 1 : 0)
  }
  for (let r = 8; r < size - 8; r++) {
    setFunc(r, 6, r % 2 === 0 ? 1 : 0)
  }

  // Alignment patterns for Version 5: (6, 30), (30, 6), (30, 30)
  function addAlignment(centerR: number, centerC: number) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const val = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1
        setFunc(centerR + r, centerC + c, val)
      }
    }
  }
  addAlignment(6, 30)
  addAlignment(30, 6)
  addAlignment(30, 30)

  // Dark module
  setFunc(size - 8, 8, 1)

  // Format info mask: Level L (01), Mask 0 (000) => 111011111000100
  const formatStr = '111011111000100'
  const tlCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]
  for (let i = 0; i < 15; i++) {
    setFunc(tlCoords[i][0], tlCoords[i][1], parseInt(formatStr[i], 10))
  }
  for (let i = 0; i < 7; i++) {
    setFunc(size - 1 - i, 8, parseInt(formatStr[i], 10))
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 8 + i, parseInt(formatStr[7 + i], 10))
  }

  // Data modules with Mask 0
  let bitIdx = 0
  let goingUp = true
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--
    const rows = goingUp
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const r of rows) {
      for (const c of [rightCol, rightCol - 1]) {
        if (!isFunction[r][c]) {
          const rawBit = bitIdx < allBits.length ? allBits[bitIdx++] : 0
          const mask = (r + c) % 2 === 0 ? 1 : 0
          matrix[r][c] = rawBit ^ mask
        }
      }
    }
    goingUp = !goingUp
  }

  return matrix
}

interface PendingPaymentSectionProps {
  bookingId: number
  createdAt: string
  paymentDeadlineAt?: string | null
  totalPrice?: number
  onPaymentSuccess: () => void
  onExpired: () => void
}

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function PendingPaymentSection({
  bookingId,
  createdAt,
  paymentDeadlineAt,
  totalPrice,
  onPaymentSuccess,
  onExpired,
}: PendingPaymentSectionProps) {
  const [paymentState, setPaymentState] = useState<
    'idle' | 'processing' | 'success'
  >('idle')
function computeRemainingSeconds(
  createdAt: string,
  paymentDeadlineAt?: string | null
): number {
  const deadline = paymentDeadlineAt
    ? new Date(paymentDeadlineAt).getTime()
    : new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
  if (Number.isNaN(deadline)) return 0
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
}

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    computeRemainingSeconds(createdAt, paymentDeadlineAt)
  )
  const onExpiredRef = useRef(onExpired)

  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)

  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    const initialRemaining = computeRemainingSeconds(createdAt, paymentDeadlineAt)
    if (initialRemaining <= 0) {
      const zeroTimer = setTimeout(() => {
        setRemainingSeconds(0)
        onExpiredRef.current()
      }, 0)
      return () => clearTimeout(zeroTimer)
    }
    const interval = setInterval(() => {
      const remaining = computeRemainingSeconds(createdAt, paymentDeadlineAt)
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onExpiredRef.current()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [createdAt, paymentDeadlineAt])

  const isUrgent = remainingSeconds < 3600 // less than 1 hour

  // PromptPay configuration
  const promptPayId = '0105567012345'
  const promptPayAccountName = 'JoodPakPaw Co., Ltd.'

  const promptPayPayload = useMemo(() => {
    return buildPromptPayPayload(promptPayId, totalPrice && totalPrice > 0 ? totalPrice : undefined)
  }, [promptPayId, totalPrice])

  const qrMatrix = useMemo(() => {
    try {
      return generateQrMatrix(promptPayPayload)
    } catch {
      return []
    }
  }, [promptPayPayload])

  const handleCopyPromptPayId = () => {
    navigator.clipboard.writeText(promptPayId)
    setIsCopied(true)
    toast.success('PromptPay ID copied to clipboard')
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Submit payment confirmation
  const handlePayment = async () => {
    // Rapid double-submission lock
    if (paymentState !== 'idle') return

    setPaymentState('processing')

    try {
      // confirmPayment compresses slip to WebP and posts multipart with field 'slip'
      await confirmPayment(bookingId, slipFile || undefined)

      setPaymentState('success')
      toast.success('Payment slip uploaded successfully! Booking confirmed.')

      setTimeout(() => {
        onPaymentSuccess()
      }, 1500)
    } catch (err) {
      console.error('Payment failed:', err)
      let errorMessage = 'Payment failed. Please try again.'
      if (err instanceof ApiError) {
        errorMessage = err.message
      }
      toast.error(errorMessage)
      setPaymentState('idle')
    }
  }

  return (
    <div className="relative">
      {paymentState !== 'idle' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-border shadow-sm text-center flex flex-col items-center gap-4 max-w-sm w-full mx-auto">
            {paymentState === 'processing' && (
              <>
                <Spinner className="w-12 h-12 text-accent-orange" />
                <h3 className="text-base font-semibold text-foreground">
                  Processing payment slip...
                </h3>
                <p className="text-xs text-neutral-gray">
                  Compressing WebP slip and confirming reservation.
                </p>
              </>
            )}
            {paymentState === 'success' && (
              <>
                <div className="w-12 h-12 rounded-full bg-deep-teal/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-deep-teal" />
                </div>
                <h3 className="text-base font-semibold text-deep-teal">
                  Payment confirmed!
                </h3>
                <p className="text-xs text-neutral-gray">
                  Your reservation is now confirmed. Updating status...
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-border space-y-5">
        {/* Countdown banner */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-3 border',
            isUrgent
              ? 'bg-red-50/70 border-red-200 text-red-800'
              : 'bg-amber-50/70 border-amber-200 text-amber-800'
          )}
        >
          <Clock
            className={cn(
              'w-5 h-5 shrink-0',
              isUrgent ? 'text-red-600' : 'text-amber-600'
            )}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                isUrgent ? 'text-red-700' : 'text-amber-800'
              )}
            >
              {formatCountdown(remainingSeconds)} remaining
            </p>
            <p className="text-xs text-neutral-gray mt-0.5">
              Complete payment before the deadline or this booking will be automatically cancelled.
            </p>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-deep-teal">
              Complete payment
            </h4>
            <p className="text-xs text-neutral-gray mt-0.5">
              Scan PromptPay QR with your banking app and upload your transfer slip.
            </p>
          </div>
          <div className="flex items-center gap-1 text-deep-teal">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[11px] font-medium">PromptPay</span>
          </div>
        </div>

        {/* PromptPay QR Code Card */}
        <div className="bg-off-white/40 rounded-xl border border-border p-4 flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-1.5 text-deep-teal">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-semibold">
              PromptPay Official
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-border w-44 h-44 flex items-center justify-center">
            {qrMatrix.length > 0 ? (
              <svg
                viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                className="w-full h-full"
                shapeRendering="crispEdges"
              >
                <rect width={qrMatrix.length} height={qrMatrix.length} fill="#ffffff" />
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) =>
                    cell === 1 ? (
                      <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#1c4f4a" />
                    ) : null
                  )
                )}
              </svg>
            ) : (
              <QrCode className="w-10 h-10 text-neutral-gray/60" />
            )}
          </div>

          <div className="space-y-1 w-full max-w-xs">
            <p className="text-xs font-medium text-foreground">
              {promptPayAccountName}
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-gray">
              <span className="font-mono">{promptPayId}</span>
              <button
                type="button"
                onClick={handleCopyPromptPayId}
                className="p-1 hover:bg-off-white rounded text-deep-teal transition-colors"
                title="Copy PromptPay ID"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-positive-green" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {totalPrice !== undefined && totalPrice > 0 && (
              <div className="pt-2 border-t border-border mt-2">
                <span className="text-xs text-neutral-gray">Amount to pay: </span>
                <span className="text-sm font-bold text-deep-teal tabular-nums">
                  ฿{totalPrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Slip Upload Dropzone */}
        <PromptPaySlipDropzone
          slipFile={slipFile}
          onSlipChange={setSlipFile}
          amount={totalPrice}
        />

        {/* Action Button */}
        <Button
          onClick={handlePayment}
          disabled={paymentState !== 'idle' || !slipFile}
          className="w-full h-12 bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {paymentState === 'processing' ? (
            <Spinner className="w-4 h-4" />
          ) : slipFile ? (
            'Upload Slip & Confirm Payment'
          ) : (
            'Attach payment slip to confirm'
          )}
        </Button>
      </div>
    </div>
  )
}
