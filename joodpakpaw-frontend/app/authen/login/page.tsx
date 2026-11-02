import AuthHeader from '../_components/AuthHeader'
import LoginForm from '../_components/LoginForm'

export default function LoginPage() {
  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      <AuthHeader>
        <div className="mt-20 text-center mx-5">
          <h1 className="text-4xl font-bold text-accent-orange mb-[25px]">
            Login Here
          </h1>
          <div className="text-[20px]">
            Glad to see you again! <br />
            Let&apos;s find the perfect stay for your furry friend.
          </div>
        </div>
      </AuthHeader>

      {/* Desktop title */}
      <div className="hidden lg:block text-center mb-2 mt-2">
        <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">
          Login Here
        </h1>
        <p className="text-neutral-gray">
          Glad to see you again! Let&apos;s find the perfect stay for your furry
          friend.
        </p>
      </div>

      <LoginForm />
    </div>
  )
}
