import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi, barangayApi } from '../services/api';

// Google Sign-In Button component
const GoogleSignInButton = ({ onSuccess, onError, text = 'signin_with' }) => {
  const buttonRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let interval;
    let timeout;

    const loadGoogleScript = () => {
      if (!document.getElementById('google-gsi-client')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          initGoogleButton();
        };
        script.onerror = () => {
          setScriptFailed(true);
        };
        document.head.appendChild(script);
      }
    };

    const initGoogleButton = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
            callback: (response) => {
              if (response.credential) {
                onSuccess(response.credential);
              } else {
                onError?.('Google sign-in failed');
              }
            },
          });
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            width: 360,
            text: text,
            shape: 'rectangular',
            logo_alignment: 'center',
          });
          setScriptLoaded(true);
          setScriptFailed(false);
        } catch (err) {
          console.error('Google Sign-In init error:', err);
          setScriptFailed(true);
        }
      }
    };

    // Check if already loaded
    if (window.google?.accounts?.id) {
      initGoogleButton();
    } else {
      loadGoogleScript();
      // Poll for script loading
      interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          clearTimeout(timeout);
          initGoogleButton();
        }
      }, 200);

      // Timeout after 8 seconds — show fallback
      timeout = setTimeout(() => {
        if (!window.google?.accounts?.id) {
          clearInterval(interval);
          setScriptFailed(true);
        }
      }, 8000);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onSuccess, onError, text]);

  // Handle fallback click — trigger Google popup manually or show error
  const handleFallbackClick = async () => {
    // Try one more time to check if script loaded
    if (window.google?.accounts?.id) {
      setGoogleLoading(true);
      try {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
          callback: (response) => {
            setGoogleLoading(false);
            if (response.credential) {
              onSuccess(response.credential);
            } else {
              onError?.('Google sign-in failed');
            }
          },
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setGoogleLoading(false);
            onError?.('Google Sign-In popup was blocked. Please allow popups and try again.');
          }
        });
      } catch (err) {
        setGoogleLoading(false);
        onError?.('Google Sign-In is not available. Please try again later.');
      }
    } else {
      onError?.('Google Sign-In is not available. Please check your internet connection and refresh the page.');
    }
  };

  return (
    <div>
      {/* Google's rendered button (hidden when script hasn't loaded) */}
      <div ref={buttonRef} className={`w-full flex justify-center ${scriptLoaded ? '' : 'hidden'}`} />

      {/* Loading state while waiting for Google script */}
      {!scriptLoaded && !scriptFailed && (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-medium cursor-wait"
        >
          <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading Google Sign-In...
        </button>
      )}

      {/* Fallback button when Google script fails to load */}
      {!scriptLoaded && scriptFailed && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-gray-700 font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Connecting...' : (text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google')}
        </button>
      )}
    </div>
  );
};


// OTP Verification Modal
const OtpVerificationModal = ({ email, onVerified, onCancel, onResend }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const response = await authApi.verifyOtp({ email, otp: otpCode });
      if (response.data.success) {
        onVerified(response.data.otp_token);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setResendTimer(60);
    setError(null);
    try {
      const response = await onResend();
      if (response?.data?.dev_otp) {
        setError(null);
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-[fadeInUp_0.3s_ease-out]">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl transition-colors"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#0038A8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#0038A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Verify Your Email</h3>
          <p className="text-sm text-gray-500 mt-2">
            We've sent a 6-digit verification code to
          </p>
          <p className="text-sm font-semibold text-[#0038A8] mt-1">{email}</p>
        </div>

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20 outline-none transition-all duration-200"
            />
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 border border-red-200 mb-4">
            <p className="text-sm text-red-700 text-center">{error}</p>
          </div>
        )}

        <Button
          onClick={handleVerify}
          disabled={verifying || otp.join('').length !== 6}
          className="w-full bg-[#0038A8] hover:bg-[#002D87] text-white py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Verifying...
            </span>
          ) : 'Verify Email'}
        </Button>

        <div className="text-center mt-4">
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-sm text-[#0038A8] hover:underline font-semibold"
            >
              Resend Code
            </button>
          ) : (
            <p className="text-sm text-gray-400">
              Resend code in <span className="font-semibold text-gray-600">{resendTimer}s</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, googleLogin, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Check for login query parameter on component mount
  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true);
      // Remove the query parameter from URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  const [email, setEmail] = useState('admin@ebms.local');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState(null);
  const [googleError, setGoogleError] = useState(null);

  const [barangays, setBarangays] = useState([]);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBarangayId, setRegBarangayId] = useState('');
  const [regSitio, setRegSitio] = useState('');
  const [regSex, setRegSex] = useState('Male');
  const [regBirthdate, setRegBirthdate] = useState('');
  const [regCategory, setRegCategory] = useState('4Ps Household Beneficiaries');
  const [regContactNumber, setRegContactNumber] = useState('');
  const [regIpClassification, setRegIpClassification] = useState('Non-IP');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // OTP flow states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [pendingRegData, setPendingRegData] = useState(null);
  const [otpSending, setOtpSending] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const response = await barangayApi.publicList();
        setBarangays(response.data.data || []);
      } catch (err) {
        console.error('Failed to fetch barangays:', err);
      }
    };
    fetchBarangays();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setGoogleError(null);
    try {
      await login(email, password);
      setShowLoginModal(false);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to login');
    }
  };

  const handleGoogleSuccess = useCallback(async (credential) => {
    setError(null);
    setGoogleError(null);
    try {
      await googleLogin(credential);
      setShowLoginModal(false);
      setShowRegisterModal(false);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Google sign-in failed';
      setGoogleError(msg);
    }
  }, [googleLogin, navigate]);

  const handleGoogleError = useCallback((msg) => {
    setGoogleError(msg || 'Google sign-in failed');
  }, []);

  // Step 1: Validate registration form & send OTP
  const handleRegisterStep1 = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(false);

    if (!regFirstName || !regLastName || !regEmail || !regBarangayId || !regPassword || !regConfirmPassword) {
      setRegError('First name, last name, email, barangay, password, and confirm password are required');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }

    // Send OTP to email
    setOtpSending(true);
    try {
      const response = await authApi.sendOtp({ email: regEmail });
      if (response.data.dev_otp) {
        setDevOtp(response.data.dev_otp);
      }

      // Store pending registration data
      setPendingRegData({
        first_name: regFirstName,
        last_name: regLastName,
        email: regEmail,
        password: regPassword,
        barangay_id: Number(regBarangayId),
        contact_number: regContactNumber,
        sex: regSex,
        birthdate: regBirthdate || undefined,
        category: regCategory,
        ip_classification: regIpClassification,
        sitio: regSitio,
        address: `${regSitio}, Bongabong, Oriental Mindoro`,
      });

      setOtpEmail(regEmail);
      setShowOtpModal(true);
    } catch (err) {
      setRegError(err.response?.data?.message || 'Failed to send verification code');
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: OTP verified → complete registration
  const handleOtpVerified = async (otpToken) => {
    try {
      await authApi.registerBeneficiary({
        ...pendingRegData,
        otp_token: otpToken,
      });

      setShowOtpModal(false);
      setRegSuccess(true);
      setDevOtp(null);
      const savedEmail = pendingRegData.email;

      // Reset form
      setRegFirstName('');
      setRegLastName('');
      setRegEmail('');
      setRegBarangayId('');
      setRegSex('Male');
      setRegBirthdate('');
      setRegCategory('4Ps Household Beneficiaries');
      setRegContactNumber('');
      setRegIpClassification('Non-IP');
      setRegPassword('');
      setRegConfirmPassword('');
      setPendingRegData(null);

      setTimeout(() => {
        setShowRegisterModal(false);
        setRegSuccess(false);
        setEmail(savedEmail);
        setPassword('');
        setShowLoginModal(true);
      }, 2000);
    } catch (err) {
      setShowOtpModal(false);
      setRegError(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleResendOtp = async () => {
    try {
      const response = await authApi.sendOtp({ email: otpEmail });
      if (response.data.dev_otp) {
        setDevOtp(response.data.dev_otp);
      }
      return response;
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Bar with Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#0038A8]">EBMS</h1>
              <p className="text-sm text-gray-600">DSWD Aid & Grants Portal</p>
            </div>

            {/* Navigation Menu */}
            <nav className="flex gap-8 items-center">
              <a href="#home" className="text-[#C8102E] font-semibold hover:text-[#002D87] transition-colors">
                Home
              </a>
              <a href="#about" className="text-gray-700 font-medium hover:text-[#0038A8] transition-colors">
                About
              </a>
              <a href="#programs" className="text-gray-700 font-medium hover:text-[#0038A8] transition-colors">
                Programs
              </a>
              <a href="#services" className="text-gray-700 font-medium hover:text-[#0038A8] transition-colors">
                Services
              </a>
              <a href="#contact" className="text-gray-700 font-medium hover:text-[#0038A8] transition-colors">
                Contact
              </a>
            </nav>

            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#0038A8] hover:bg-[#002D87] text-white px-8 py-2 font-semibold"
            >
              🔒 Login
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-sm p-12 mb-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block bg-[#0038A8]/10 text-[#0038A8] px-4 py-2 rounded-full font-semibold text-sm mb-6">
                ✓ DSWD Electronic Beneficiary Management System
              </div>
              
              <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
                Empowering Lives. Building Stronger <span className="text-[#C8102E]">Communities.</span>
              </h1>
              
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                A modern and secure system for managing beneficiaries, delivering services, and ensuring transparency in social welfare programs.
              </p>
              
              <Button
                onClick={() => setShowLoginModal(true)}
                className="bg-[#0038A8] hover:bg-[#002D87] text-white px-8 py-4 font-semibold text-lg"
              >
                Get Started
              </Button>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-[#0038A8] to-[#C8102E] rounded-lg shadow-lg p-8 text-white">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-4">📱</div>
                  <h3 className="text-2xl font-bold mb-2">RFID Enabled</h3>
                  <p className="text-blue-100">Smart Beneficiary Identification</p>
                </div>

                <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div>
                      <div className="text-3xl font-bold text-[#FCD116]">50K+</div>
                      <div className="text-sm text-blue-100 mt-1">Users</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-[#FCD116]">99.9%</div>
                      <div className="text-sm text-blue-100 mt-1">Accuracy</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-[#FCD116]">&lt;2s</div>
                      <div className="text-sm text-blue-100 mt-1">Scan Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Secure & Reliable</h3>
            <p className="text-gray-600 text-sm">RFID-powered system ensures accurate beneficiary identification and data security.</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Efficient Management</h3>
            <p className="text-gray-600 text-sm">Streamlined processes for faster beneficiary registration, monitoring, and reporting.</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Transparent Services</h3>
            <p className="text-gray-600 text-sm">Promoting accountability and transparency in the delivery of social welfare programs.</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4">❤️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Empowering Communities</h3>
            <p className="text-gray-600 text-sm">Connecting beneficiaries to essential services and opportunities for a better tomorrow.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-lg shadow-sm p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-[#0038A8] mb-2">10M+</div>
              <div className="text-gray-600">Beneficiaries Served</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#C8102E] mb-2">500+</div>
              <div className="text-gray-600">Programs & Services</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#FCD116] mb-2">1,000+</div>
              <div className="text-gray-600">Partner Organizations</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#0038A8] mb-2">🌍</div>
              <div className="text-gray-600">Nationwide Coverage</div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-[#0038A8] mb-3">🎯 Mission</h3>
            <p className="text-gray-600">
              To provide efficient, transparent, and accountable social welfare services that empower beneficiaries and build stronger communities.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-[#C8102E] mb-3">🚀 Vision</h3>
            <p className="text-gray-600">
              A digitally-enabled social welfare system that leverages technology to ensure no Filipino is left behind.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-[#FCD116] mb-3">💡 Innovation</h3>
            <p className="text-gray-600">
              Continuous improvement through RFID technology, data analytics, and mobile accessibility for seamless service delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>&copy; 2026 Department of Social Welfare and Development. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* LOGIN/REGISTER MODAL */}
      {(showLoginModal || showRegisterModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className={`bg-white rounded-2xl shadow-2xl w-full p-6 relative my-4 max-h-[90vh] overflow-y-auto ${showRegisterModal ? 'max-w-lg' : 'max-w-md'}`}>
            <button
              onClick={() => {
                setShowLoginModal(false);
                setShowRegisterModal(false);
                setGoogleError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl transition-colors"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <h1 className="text-xl font-bold text-[#0038A8] mb-1">EBMS</h1>
              <p className="text-xs text-gray-600 mb-2">DSWD Aid & Grants Portal</p>
              <h2 className="text-lg font-bold text-gray-900">
                {showLoginModal ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {showLoginModal ? 'Sign in to your account' : 'Join the system to manage benefits'}
              </p>
            </div>

            {showLoginModal && (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0038A8] hover:bg-[#002D87] text-white py-3 font-semibold rounded-lg"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400 font-medium">or continue with</span>
                  </div>
                </div>

                {/* Google Sign-In */}
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                />

                {googleError && (
                  <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                    <p className="text-sm text-amber-700">{googleError}</p>
                  </div>
                )}

                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowRegisterModal(true);
                      setError(null);
                      setGoogleError(null);
                    }}
                    className="text-[#0038A8] hover:underline font-semibold"
                  >
                    Create Account
                  </button>
                </p>

                <p className="text-center text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
                  Demo: admin@ebms.local / Admin@123
                </p>
              </form>
            )}

             {showRegisterModal && (
              <form onSubmit={handleRegisterStep1} className="space-y-3 text-left">
                {/* Google Sign-Up Option */}
                <div className="mb-2">
                  <GoogleSignInButton
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    text="signup_with"
                  />
                  {googleError && (
                    <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 mt-2">
                      <p className="text-sm text-amber-700">{googleError}</p>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400 font-medium">or register with email</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                    <Input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                    <Input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                  <Input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Barangay</label>
                    <select
                      value={regBarangayId}
                      onChange={(e) => setRegBarangayId(e.target.value)}
                      className="w-full mt-2 px-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-[#0038A8] focus:border-transparent text-sm"
                      required
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.barangay_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label>
                    <Input
                      type="text"
                      value={regContactNumber}
                      onChange={(e) => setRegContactNumber(e.target.value)}
                      placeholder="0917xxxxxxx"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Sex</label>
                    <select
                      value={regSex}
                      onChange={(e) => setRegSex(e.target.value)}
                      className="w-full mt-2 px-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-[#0038A8] focus:border-transparent text-sm"
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Birthdate</label>
                    <Input
                      type="date"
                      value={regBirthdate}
                      onChange={(e) => setRegBirthdate(e.target.value)}
                      className="w-full animate-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">IP Classification</label>
                    <select
                      value={regIpClassification}
                      onChange={(e) => setRegIpClassification(e.target.value)}
                      className="w-full mt-2 px-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-[#0038A8] focus:border-transparent text-sm"
                      required
                    >
                      <option value="IP">IP (Indigenous People)</option>
                      <option value="Non-IP">Non-IP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value)}
                    className="w-full mt-2 px-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-[#0038A8] focus:border-transparent text-sm"
                    required
                  >
                    <option value="4Ps Household Beneficiaries">4Ps Household Beneficiaries</option>
                    <option value="Senior Citizens (Social Pension)">Senior Citizens (Social Pension)</option>
                    <option value="Persons with Disabilities (PWD)">Persons with Disabilities (PWD)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200 mt-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                    <Input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                    <Input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {regError && (
                  <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-sm text-red-700">{regError}</p>
                  </div>
                )}

                {regSuccess && (
                  <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                    <p className="text-sm text-green-700">✓ Account created successfully!</p>
                  </div>
                )}

                {devOtp && !showOtpModal && (
                  <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                    <p className="text-xs text-blue-700">🔧 Dev mode OTP: <span className="font-mono font-bold text-lg">{devOtp}</span></p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={regSuccess || otpSending}
                  className="w-full bg-[#0038A8] hover:bg-[#002D87] text-white py-3 font-semibold rounded-lg disabled:opacity-50"
                >
                  {otpSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Sending Verification Code...
                    </span>
                  ) : regSuccess ? 'Account Created!' : 'Verify Email & Create Account'}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setShowLoginModal(true);
                      setRegError(null);
                      setGoogleError(null);
                    }}
                    className="text-[#0038A8] hover:underline font-semibold"
                  >
                    Sign In
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <OtpVerificationModal
          email={otpEmail}
          onVerified={handleOtpVerified}
          onCancel={() => {
            setShowOtpModal(false);
            setDevOtp(null);
          }}
          onResend={handleResendOtp}
        />
      )}
    </div>
  );
};

export default LandingPage;
