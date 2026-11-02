'use client'

export const ErrorState = ({ message }: { message: string }) => (
  <div className="flex justify-center items-center h-screen">
    <p className="text-red-500">{message}</p>
  </div>
)
