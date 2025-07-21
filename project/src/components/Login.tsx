import React, { useState } from 'react';
import { Book, User, UserCheck, Eye, EyeOff, Sparkles, Shield, Zap, Globe, Cpu, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [userType, setUserType] = useState<'faculty' | 'student'>('faculty');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    rollNo: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await signup(formData.email, formData.password, formData.name, 'faculty');
      } else {
        console.log('Attempting login with:', formData.email, 'User type:', userType);
        await login(formData.email, formData.password);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      rollNo: ''
    });
    setError('');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 flex items-center justify-center p-4">
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large Floating Circles */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-gradient-to-r from-blue-400/30 to-indigo-400/30 rounded-full blur-3xl animate-modern-float"></div>
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-r from-purple-400/25 to-blue-400/25 rounded-full blur-2xl animate-modern-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-32 -left-16 w-56 h-56 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl animate-modern-float" style={{ animationDelay: '4s' }}></div>
        <div className="absolute -bottom-16 -right-32 w-40 h-40 bg-gradient-to-r from-blue-400/35 to-purple-400/35 rounded-full blur-2xl animate-modern-float" style={{ animationDelay: '6s' }}></div>
        
        {/* Additional Large Circles */}
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-gradient-to-r from-purple-300/20 to-indigo-300/20 rounded-full blur-3xl animate-modern-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 -right-24 w-80 h-80 bg-gradient-to-r from-blue-300/15 to-purple-300/15 rounded-full blur-3xl animate-modern-float" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/2 -right-20 w-60 h-60 bg-gradient-to-r from-indigo-300/25 to-blue-300/25 rounded-full blur-3xl animate-modern-float" style={{ animationDelay: '5s' }}></div>
        
        {/* Medium Floating Circles */}
        <div className="absolute top-1/4 left-1/6 w-32 h-32 bg-gradient-to-r from-indigo-400/40 to-blue-400/40 rounded-full blur-xl animate-modern-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-purple-400/30 to-indigo-400/30 rounded-full blur-lg animate-modern-float" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-28 h-28 bg-gradient-to-r from-blue-400/35 to-purple-400/35 rounded-full blur-xl animate-modern-float" style={{ animationDelay: '5s' }}></div>
        <div className="absolute bottom-1/4 right-1/5 w-20 h-20 bg-gradient-to-r from-indigo-400/45 to-blue-400/45 rounded-full blur-lg animate-modern-float" style={{ animationDelay: '7s' }}></div>
        
        {/* Additional Medium Circles */}
        <div className="absolute top-1/6 left-1/2 w-36 h-36 bg-gradient-to-r from-purple-400/25 to-blue-400/25 rounded-full blur-xl animate-modern-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-2/3 left-1/6 w-44 h-44 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-2xl animate-modern-float" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-1/6 right-1/3 w-32 h-32 bg-gradient-to-r from-blue-400/30 to-indigo-400/30 rounded-full blur-xl animate-modern-float" style={{ animationDelay: '6s' }}></div>
        
        {/* Small Floating Dots - Increased quantity */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-4 h-4 bg-gradient-to-r from-blue-400/60 to-indigo-400/60 rounded-full animate-modern-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
        
        {/* Tiny Floating Particles */}
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={`tiny-${i}`}
            className="absolute w-2 h-2 bg-gradient-to-r from-purple-400/40 to-indigo-400/40 rounded-full animate-modern-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${3 + Math.random() * 5}s`,
            }}
          />
        ))}
        
        {/* Geometric Shapes - Enhanced */}
        <div className="absolute top-20 left-20 w-16 h-16 border-2 border-blue-400/40 rotate-45 animate-modern-float rounded-lg"></div>
        <div className="absolute top-32 right-32 w-12 h-12 bg-gradient-to-r from-purple-400/30 to-blue-400/30 rounded-full animate-modern-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-32 left-32 w-20 h-20 border-2 border-indigo-400/50 animate-modern-float rounded-xl" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-20 right-20 w-8 h-8 bg-gradient-to-r from-blue-400/40 to-indigo-400/40 rotate-45 animate-modern-float rounded-md" style={{ animationDelay: '6s' }}></div>
        
        {/* Additional Geometric Shapes */}
        <div className="absolute top-1/3 left-1/4 w-14 h-14 border-2 border-purple-400/35 rotate-12 animate-modern-float rounded-lg" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-3/4 right-1/4 w-18 h-18 bg-gradient-to-r from-indigo-400/25 to-blue-400/25 rotate-45 animate-modern-float rounded-xl" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/4 left-1/2 w-10 h-10 border-2 border-blue-400/45 animate-modern-float rounded-full" style={{ animationDelay: '5s' }}></div>
        <div className="absolute top-1/2 right-1/6 w-22 h-22 bg-gradient-to-r from-purple-400/20 to-indigo-400/20 rotate-30 animate-modern-float rounded-2xl" style={{ animationDelay: '7s' }}></div>
        
        {/* Curved Lines and Paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 1200 800">
          <defs>
            <linearGradient id="curveGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="curveGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="curveGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Main Curved Lines */}
          <path
            d="M0,200 Q300,100 600,200 T1200,200"
            stroke="url(#curveGradient1)"
            strokeWidth="3"
            fill="none"
            className="animate-mega-draw-line"
          />
          <path
            d="M0,400 Q400,250 800,400 T1600,400"
            stroke="url(#curveGradient2)"
            strokeWidth="2"
            fill="none"
            className="animate-mega-draw-line-delayed"
          />
          <path
            d="M200,0 Q500,300 800,100 T1400,200"
            stroke="url(#curveGradient3)"
            strokeWidth="2"
            fill="none"
            className="animate-mega-draw-line-slow"
          />
          
          {/* Additional Curved Paths */}
          <path
            d="M0,600 Q200,450 400,600 Q600,750 800,600 Q1000,450 1200,600"
            stroke="url(#curveGradient1)"
            strokeWidth="2"
            fill="none"
            className="animate-mega-draw-line"
            style={{ animationDelay: '2s' }}
          />
          <path
            d="M100,100 Q350,350 600,150 Q850,50 1100,250"
            stroke="url(#curveGradient2)"
            strokeWidth="1.5"
            fill="none"
            className="animate-mega-draw-line-delayed"
            style={{ animationDelay: '1s' }}
          />
          <path
            d="M0,300 Q150,150 300,300 Q450,450 600,300 Q750,150 900,300 Q1050,450 1200,300"
            stroke="url(#curveGradient3)"
            strokeWidth="2"
            fill="none"
            className="animate-mega-draw-line-slow"
            style={{ animationDelay: '3s' }}
          />
          
          {/* Wavy Lines */}
          <path
            d="M0,500 Q100,400 200,500 Q300,600 400,500 Q500,400 600,500 Q700,600 800,500 Q900,400 1000,500 Q1100,600 1200,500"
            stroke="url(#curveGradient1)"
            strokeWidth="1.5"
            fill="none"
            className="animate-mega-draw-line"
            style={{ animationDelay: '4s' }}
          />
          <path
            d="M0,700 Q150,550 300,700 Q450,850 600,700 Q750,550 900,700 Q1050,850 1200,700"
            stroke="url(#curveGradient2)"
            strokeWidth="2"
            fill="none"
            className="animate-mega-draw-line-delayed"
            style={{ animationDelay: '2.5s' }}
          />
        </svg>
        
        {/* Floating Curved Shapes */}
        <div className="absolute top-1/4 left-1/8 w-32 h-16 border-2 border-blue-400/30 rounded-full animate-modern-float" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-2/3 right-1/8 w-40 h-20 border-2 border-purple-400/25 rounded-full animate-modern-float" style={{ animationDelay: '3.5s' }}></div>
        <div className="absolute bottom-1/3 left-1/5 w-24 h-12 bg-gradient-to-r from-indigo-400/20 to-blue-400/20 rounded-full animate-modern-float" style={{ animationDelay: '5.5s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-36 h-18 border-2 border-indigo-400/35 rounded-full animate-modern-float" style={{ animationDelay: '7.5s' }}></div>
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/30 via-transparent to-purple-900/30"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-indigo-900/20"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-purple-900/10 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-in-down">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              {/* Outer glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 rounded-full blur-xl opacity-60 animate-pulse group-hover:opacity-100 transition-opacity duration-500"></div>
              {/* Icon container */}
              <div className="relative bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 p-4 rounded-full shadow-2xl transform group-hover:scale-110 transition-transform duration-500 border border-white/20">
                <Book className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white via-teal-100 to-cyan-100 bg-clip-text text-transparent">
            NBKR Institute of Science and Technology
          </h1>
          <p className="text-blue-200/90 text-lg font-medium mb-4">Artificial Intelligence  Laboratory</p>
          
          {/* Status Indicators */}
          <div className="flex justify-center items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2 text-green-300/90 bg-green-900/30 px-3 py-1 rounded-full backdrop-blur-sm border border-green-500/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">System Online</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-300/90 bg-blue-900/30 px-3 py-1 rounded-full backdrop-blur-sm border border-blue-500/20">
              <Shield className="h-3 w-3" />
              <span className="text-sm font-medium">Secure Connection</span>
            </div>
          </div>
          
          {/* Progress Dots */}
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '1.2s' }}></div>
          </div>
        </div>

        {/* Login Form */}
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 relative overflow-hidden group hover:bg-white/15 transition-all duration-500 animate-fade-in-scale">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5 rounded-2xl"></div>
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-indigo-400/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative z-10">
            {/* User Type Selection */}
            {!isSignup && (
              <div className="flex mb-6 bg-white/5 rounded-xl p-1 backdrop-blur-sm border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setUserType('faculty');
                    resetForm();
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                    userType === 'faculty'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Faculty</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('student');
                    resetForm();
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                    userType === 'student'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span>Student</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignup && (
                <div className="group">
                  <label className="block text-sm font-medium text-white/90 mb-2 flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-400" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/15 focus:scale-105"
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div className="group">
                <label className="block text-sm font-medium text-white/90 mb-2 flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-purple-400" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/15 focus:scale-105"
                  placeholder={userType === 'student' ? 'Enter your college email' : 'Enter your email'}
                />
                {userType === 'student' && !isSignup && (
                  <p className="text-xs text-blue-300/80 mt-2 flex items-center space-x-1">
                    <Cpu className="h-3 w-3" />
                    <span>Use your college email address provided by the faculty</span>
                  </p>
                )}
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-white/90 mb-2 flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-indigo-400" />
                  <span>Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/15 focus:scale-105"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-all duration-300 hover:scale-110"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {userType === 'student' && !isSignup && (
                  <p className="text-xs text-indigo-300/80 mt-2 flex items-center space-x-1">
                    <Wifi className="h-3 w-3" />
                    <span>Use the password provided by your faculty or your updated password</span>
                  </p>
                )}
              </div>

              {isSignup && (
                <div className="group">
                  <label className="block text-sm font-medium text-white/90 mb-2 flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-violet-400" />
                    <span>Confirm Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/15 focus:scale-105"
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-all duration-300 hover:scale-110"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-400/30 text-red-200 px-4 py-3 rounded-xl backdrop-blur-sm animate-shake">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 text-white py-4 rounded-xl font-medium hover:from-blue-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 transform hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white modern-spinner"></div>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                      <Sparkles className="h-4 w-4" />
                    </>
                  )}
                </div>
              </button>
            </form>

            {userType === 'faculty' && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    resetForm();
                  }}
                  className="text-blue-300 hover:text-white font-medium transition-all duration-300 relative group px-4 py-2 rounded-lg"
                >
                  <span className="relative z-10">
                    {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
                  </span>
                  <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 animate-slide-in-up">
          <div className="flex justify-center items-center space-x-6 text-white/60 text-sm">
            <div className="flex items-center space-x-2 bg-blue-900/30 px-3 py-1 rounded-full backdrop-blur-sm border border-blue-500/20">
              <Shield className="h-3 w-3 text-blue-400" />
              <span>Secure</span>
            </div>
            <div className="flex items-center space-x-2 bg-purple-900/30 px-3 py-1 rounded-full backdrop-blur-sm border border-purple-500/20">
              <Zap className="h-3 w-3 text-purple-400" />
              <span>Modern</span>
            </div>
            <div className="flex items-center space-x-2 bg-indigo-900/30 px-3 py-1 rounded-full backdrop-blur-sm border border-indigo-500/20">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              <span>Efficient</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}