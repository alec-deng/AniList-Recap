import React from "react"
import { useAuth } from "../hooks/useAuth"

export const LoginPage: React.FC = () => {
  const { login, loading } = useAuth()

  const handleLogin = async () => {
    try {
      await login()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <div className="w-[400px] min-h-[400px] bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray mb-2">AniList Recap</h1>
          <p className="text-gray/70">Track your anime progress</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray/20 rounded-xl p-8 shadow-sm">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray mb-2">Welcome Back</h2>
              <p className="text-sm text-gray/70">Connect your AniList account to get started</p>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className={`
                w-full py-3 px-4 rounded-lg font-medium text-white-100 transition-all duration-200
                ${loading 
                  ? 'bg-gray/50 cursor-not-allowed' 
                  : 'bg-blue hover:bg-blue/90 hover:scale-105'
                }
              `}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white-100/30 border-t-white-100 rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                'Login with AniList'
              )}
            </button>

            <p className="text-xs text-gray/50 leading-relaxed">
              By logging in, you agree to connect this extension with your AniList account. 
              We only access your public profile and anime list data.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}