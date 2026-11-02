import AuthHeader from '../_components/AuthHeader'
import VerifyOtpForm from '../_components/VerifyOtpForm'

export default function VerifyOtpPage() {
  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      <AuthHeader>
        <div className="z-10 mt-20 mx-5 text-center">
          <h1 className="text-4xl font-bold text-accent-orange">
            Verify your email
          </h1>
        </div>
      </AuthHeader>

      {/* Desktop title */}
      <div className="hidden lg:block text-center mb-2 mt-2">
        <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">Verify your email</h1>
        <p className="text-neutral-gray">Enter the 6-digit code we sent to your email.</p>
      </div>

      <VerifyOtpForm />
    </div>
  )
}
