import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi, barangayApi } from '../services/api';
import {
  ShieldCheck, Sparkles, CreditCard, QrCode, Search, Users, CheckCircle2,
  ArrowRight,
  HandHeart, Award, Zap, Lock, FileText, Check,
  Smartphone, Radio, Eye, EyeOff,
  AlertCircle, ChevronDown, RefreshCw, X
} from 'lucide-react';

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

    if (window.google?.accounts?.id) {
      initGoogleButton();
    } else {
      loadGoogleScript();
      interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          clearTimeout(timeout);
          initGoogleButton();
        }
      }, 200);

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

  const handleFallbackClick = async () => {
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
      onError?.('Google Sign-In is not available. Please check your internet connection.');
    }
  };

  return (
    <div>
      <div ref={buttonRef} className={`w-full flex justify-center ${scriptLoaded ? '' : 'hidden'}`} />
      {!scriptLoaded && !scriptFailed && (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 font-medium cursor-wait text-sm"
        >
          <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting Google Sign-In...
        </button>
      )}
      {!scriptLoaded && scriptFailed && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 text-slate-700 font-medium text-sm shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
      await onResend();
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 text-[#00338D] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Verify Your Email</h3>
          <p className="text-sm text-slate-500 mt-2">
            We sent a 6-digit verification code to
          </p>
          <p className="text-sm font-bold text-[#00338D] mt-0.5">{email}</p>
        </div>

        <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
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
              className="w-12 h-14 text-center text-2xl font-bold border border-slate-200 rounded-xl focus:border-[#00338D] focus:ring-2 focus:ring-blue-100 outline-none transition text-slate-900 bg-slate-50 focus:bg-white"
            />
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 border border-red-200 mb-4 flex items-center gap-2 text-xs font-semibold text-[#E30613]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleVerify}
          disabled={verifying || otp.join('').length !== 6}
          className="w-full bg-[#00338D] hover:bg-[#002566] text-white py-3.5 font-bold rounded-xl disabled:opacity-50 shadow-md text-sm"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verifying Code...
            </span>
          ) : 'Confirm & Create Account'}
        </Button>

        <div className="text-center mt-5">
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-sm text-[#00338D] hover:underline font-bold"
            >
              Resend Code
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              Resend code in <span className="font-bold text-slate-600">{resendTimer}s</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { login, googleLogin, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Modals & Navigation
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic Content States
  const [barangays, setBarangays] = useState([]);
  const [activeFaq, setActiveFaq] = useState(null);

  // Interactive Eligibility Checker State
  const [eligCategory, setEligCategory] = useState('Senior Citizens (Social Pension)');
  const [eligBarangay, setEligBarangay] = useState('');
  const [eligResult, setEligResult] = useState(null);

  // Login Form
  const [email, setEmail] = useState('admin@ebms.local');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState(null);
  const [googleError, setGoogleError] = useState(null);

  // Registration Form
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regUsername, setRegUsername] = useState('');
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

  // Check URL query param
  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLoginModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const brgyRes = await barangayApi.publicList().catch(() => ({ data: { data: [] } }));
        setBarangays(brgyRes.data?.data || []);
      } catch (err) {
        console.error('Failed to load barangays:', err);
      }
    };
    fetchData();
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

  const handleRegisterStep1 = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(false);

    if (!regFirstName.trim() || !regLastName.trim() || !regUsername.trim() || !regBarangayId || !regPassword || !regConfirmPassword) {
      setRegError('Pakiusap punan ang First name, Last name, Username, Barangay, at Password');
      return;
    }

    if (regUsername.trim().length < 3) {
      setRegError('Ang Username ay dapat hindi bababa sa 3 characters');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Hindi magkatugma ang Password at Confirm Password');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Ang Password ay dapat hindi bababa sa 6 characters');
      return;
    }

    const selectedBrgy = barangays.find((b) => Number(b.id) === Number(regBarangayId));
    const selectedBrgyName = selectedBrgy ? selectedBrgy.barangay_name : '';
    const fullCombinedAddress = [
      regSitio ? regSitio.trim() : null,
      selectedBrgyName ? `Barangay ${selectedBrgyName}` : null,
      'Bongabong, Oriental Mindoro',
    ]
      .filter(Boolean)
      .join(', ');

    const regData = {
      first_name: regFirstName.trim(),
      last_name: regLastName.trim(),
      username: regUsername.trim(),
      email: regEmail && regEmail.trim() !== '' ? regEmail.trim() : undefined,
      password: regPassword,
      barangay_id: Number(regBarangayId),
      contact_number: regContactNumber ? regContactNumber.trim() : '',
      sex: regSex,
      birthdate: regBirthdate || undefined,
      category: regCategory,
      ip_classification: regIpClassification,
      sitio: regSitio ? regSitio.trim() : '',
      address: fullCombinedAddress,
    };

    // If email is provided, perform OTP verification
    if (regEmail && regEmail.trim() !== '') {
      setOtpSending(true);
      try {
        const response = await authApi.sendOtp({ email: regEmail.trim() });
        if (response.data.dev_otp) {
          setDevOtp(response.data.dev_otp);
        }

        setPendingRegData(regData);
        setOtpEmail(regEmail.trim());
        setShowOtpModal(true);
      } catch (err) {
        setRegError(err.response?.data?.message || 'Failed to send verification code');
      } finally {
        setOtpSending(false);
      }
    } else {
      // If NO email is provided, register directly without OTP verification (for IPs / elderly)
      setOtpSending(true);
      try {
        await authApi.registerBeneficiary(regData);
        setRegSuccess(true);
        const savedUsername = regUsername.trim();

        setRegFirstName('');
        setRegLastName('');
        setRegUsername('');
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
          setEmail(savedUsername);
          setPassword('');
          setShowLoginModal(true);
        }, 1800);
      } catch (err) {
        setRegError(err.response?.data?.message || 'Registration failed');
      } finally {
        setOtpSending(false);
      }
    }
  };

  const handleOtpVerified = async (otpToken) => {
    try {
      await authApi.registerBeneficiary({
        ...pendingRegData,
        otp_token: otpToken,
      });

      setShowOtpModal(false);
      setRegSuccess(true);
      setDevOtp(null);
      const savedIdentifier = pendingRegData.username || pendingRegData.email;

      setRegFirstName('');
      setRegLastName('');
      setRegUsername('');
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
        setEmail(savedIdentifier);
        setPassword('');
        setShowLoginModal(true);
      }, 1800);
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

  // Eligibility Checker Evaluation
  const runEligibilityCheck = (e) => {
    e.preventDefault();
    if (!eligCategory) return;

    let programs = [];
    let benefits = '';
    let requirements = [];

    if (eligCategory.includes('4Ps')) {
      programs = ['Regular Cash Grant', 'Education Assistance', 'Health Subsidy', 'Rice Grant'];
      benefits = 'Monthly cash assistance, educational support up to Senior High, and healthcare subsidies.';
      requirements = ['Valid Government ID', '4Ps Household ID', 'Barangay Certificate of Indigency', 'PSA Birth Certificates of Children'];
    } else if (eligCategory.includes('Senior')) {
      programs = ['Social Pension for Indigent Seniors (SocPen)', 'Centenarian Benefits', 'Medical Assistance', 'Assistive Devices'];
      benefits = '₱1,000 monthly social pension, free medical checkups, and assistive devices.';
      requirements = ['OSCA ID / Senior Citizen Card', 'Barangay Certificate of Indigency', 'PSA Birth Certificate (proving 60+ years old)', 'Valid Government ID'];
    } else if (eligCategory.includes('PWD')) {
      programs = ['PWD ID Registration & Renewal', 'Livelihood Assistance', 'Assistive Devices (Wheelchair/Cane)', 'Medical & Educational Support'];
      benefits = 'Direct financial aid, priority healthcare support, 20% statutory discounts, and assistive mobility equipment.';
      requirements = ['Medical Certificate from Municipal Health Officer', 'Barangay Certificate of Residency', '1x1 ID Photos', 'Valid Government ID'];
    } else {
      programs = ['Crisis Assistance (AICS)', 'Emergency Financial Aid', 'Food & Non-Food Relief'];
      benefits = 'One-time emergency financial aid, hospital bill subsidies, and calamity assistance.';
      requirements = ['Barangay Certificate of Indigency', 'Medical Abstract / Hospital Bill (if medical)', 'Valid Government ID'];
    }

    setEligResult({
      category: eligCategory,
      barangay: barangays.find(b => String(b.id) === String(eligBarangay))?.barangay_name || 'Bongabong',
      programs,
      benefits,
      requirements,
    });
  };

  const programsData = [
    {
      id: '4ps',
      category: '4Ps Household Beneficiaries',
      title: 'Pantawid Pamilyang Pilipino Program (4Ps)',
      tag: 'Conditional Cash Transfer',
      badge: 'bg-blue-50 text-[#00338D] border border-blue-100',
      icon: Users,
      grants: 'Cash & Education Grants',
      desc: 'National poverty reduction strategy providing conditional cash grants to extremely poor households to improve health, nutrition, and education of children aged 0-18.',
      perks: ['Health & Nutrition Grant (₱750)', 'Education Grants per Child', 'Rice Subsidy Allowance (₱600)', 'Family Development Sessions (FDS)']
    },
    {
      id: 'socpen',
      category: 'Senior Citizens (Social Pension)',
      title: 'Social Pension for Indigent Senior Citizens',
      tag: 'Elderly Welfare',
      badge: 'bg-amber-50 text-amber-800 border border-amber-100',
      icon: Award,
      grants: '₱1,000 / month',
      desc: 'Periodic monetary grant provided to indigent seniors aged 60 and above to augment daily subsistence and medical needs.',
      perks: ['Regular Payouts (₱1,000/mo)', 'Expanded Centenarian Milestones (₱10k)', 'Assistive Devices Allocation', 'Centenarian Gift (₱100,000)']
    },
    {
      id: 'pwd',
      category: 'Persons with Disabilities (PWD)',
      title: 'PWD Comprehensive Welfare & Support',
      tag: 'Disability Assistance',
      badge: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
      icon: HandHeart,
      grants: 'Livelihood & Medical Grants',
      desc: 'Empowers persons with disabilities through digitized ID issuance, assistive device distribution, skills training, and livelihood subsidies.',
      perks: ['Free Wheelchairs & Assistive Tech', 'Medical & Therapy Subsidies', 'Livelihood Capital Assistance', 'Emergency Relief Priority']
    },
    {
      id: 'aics',
      category: 'Crisis & Emergency',
      title: 'Assistance to Individuals in Crisis Situations (AICS)',
      tag: 'Emergency Relief',
      badge: 'bg-red-50 text-[#E30613] border border-red-100',
      icon: Zap,
      grants: 'Immediate Cash Aid',
      desc: 'Social safety net providing immediate financial, medical, funeral, and food assistance to individuals and families facing sudden crises or natural disasters.',
      perks: ['Hospitalization Bill Subsidies', 'Burial & Funeral Assistance', 'Disaster Calamity Relief', 'Direct Barangay Coordination']
    }
  ];

  const faqs = [
    {
      q: 'How does the RFID Beneficiary Card work during payouts?',
      a: 'Each verified beneficiary receives a smart RFID card. During distribution events at your Barangay hall or Municipal gymnasium, simply tap your card on the scanner. The system instantly verifies your identity and releases your grant in under 2 seconds.'
    },
    {
      q: 'How long does it take for an online application to be reviewed?',
      a: 'Online applications are reviewed by your assigned Barangay Staff and Municipal Social Welfare Officers within 2 to 5 working days. You can monitor your application status in real-time through the portal.'
    },
    {
      q: 'What should I do if I lose my RFID Card?',
      a: 'Report your lost card immediately to your Barangay Hall or via the in-app Assistance Request module. Your old card will be deactivated instantly to prevent fraud, and a replacement card will be issued.'
    },
    {
      q: 'Can family members claim benefits on behalf of bedridden beneficiaries?',
      a: 'Yes. Qualified authorized representatives listed during enrollment can claim assistance by presenting the beneficiary RFID card, authorization letter, and valid IDs.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#00338D] selection:text-white relative">
      
      {/* ━━━ TOP ACCENT STRIP ━━━ */}
      <div className="h-1 w-full bg-gradient-to-r from-[#00338D] via-[#E30613] to-[#FFD100]" />

      {/* ━━━ CLEAN MINIMALIST NAVBAR ━━━ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="h-11 w-11 rounded-2xl bg-[#00338D] text-white flex items-center justify-center font-bold text-xl shadow-sm">
              <ShieldCheck className="w-6 h-6 text-[#FFD100]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">DSWD EBMS</span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-[#00338D] border border-blue-100">Bongabong</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Beneficiary Management Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-700">
            <a href="#features" className="hover:text-[#00338D] transition-colors">Features</a>
            <a href="#programs" className="hover:text-[#00338D] transition-colors">Programs</a>
            <a href="#eligibility" className="hover:text-[#00338D] transition-colors flex items-center gap-1.5 text-[#00338D]">
              <Sparkles className="w-4 h-4 text-amber-500" /> Eligibility Checker
            </a>
            <a href="#rfid-tech" className="hover:text-[#00338D] transition-colors">Smart RFID</a>
            <a href="#faq" className="hover:text-[#00338D] transition-colors">FAQ</a>
          </nav>

          {/* Action Login Button */}
          <div className="flex items-center">
            <Button
              onClick={() => {
                setShowRegisterModal(false);
                setShowLoginModal(true);
                setError(null);
              }}
              className="bg-[#0038A8] hover:bg-[#002D87] text-white px-8 py-2.5 text-sm font-semibold rounded-xl shadow-xs transition"
            >
              🔒 Login
            </Button>
          </div>
        </div>
      </header>

      {/* ━━━ HERO SECTION (MINIMALIST & SPACIOUS) ━━━ */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-28 overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/60 to-[#F8FAFC]">
        
        {/* Soft Background Radial Glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            
            {/* Left Column — Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#00338D] text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-[#00338D]" />
                <span>DSWD Aid & Grants Management System</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Empowering Lives. Building{' '}
                <span className="text-[#00338D]">Stronger </span>
                <span className="text-[#E30613]">Communities.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto lg:mx-0">
                A digitized, contactless social welfare system for transparent grant disbursements, RFID attendance, and direct citizen support across all 37 Barangays of Bongabong.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                  className="px-8 py-4 rounded-xl bg-[#00338D] hover:bg-[#002566] text-white font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                >
                  <Users className="w-5 h-5" />
                  Apply as Beneficiary
                  <ArrowRight className="w-5 h-5" />
                </button>

                <a
                  href="#eligibility"
                  className="px-7 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 shadow-xs transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Check Eligibility
                </a>
              </div>

              {/* Metrics Row */}
              <div className="pt-6 grid grid-cols-3 gap-6 border-t border-slate-200 text-left max-w-lg mx-auto lg:mx-0">
                <div>
                  <p className="text-2xl lg:text-3xl font-extrabold text-slate-900">5,000+</p>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Beneficiaries</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-extrabold text-[#00338D]">&lt;2 sec</p>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">RFID Scan Speed</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-extrabold text-emerald-600">37/37</p>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Barangays Active</p>
                </div>
              </div>
            </div>

            {/* Right Column — DSWD RFID Card Specimen */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md">
                
                {/* Sample Card */}
                <div className="relative rounded-3xl p-7 bg-gradient-to-br from-[#00338D] via-[#002566] to-[#0A192F] text-white border-2 border-white shadow-2xl space-y-6">
                  
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E30613] text-white flex items-center justify-center font-bold text-xs shadow">
                        DSWD
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-[#FFD100] uppercase">REPUBLIC OF THE PHILIPPINES</p>
                        <p className="text-xs font-bold text-white">MUNICIPALITY OF BONGABONG</p>
                      </div>
                    </div>
                    <Radio className="w-6 h-6 text-[#FFD100] opacity-90" />
                  </div>

                  {/* Gold Chip */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="w-11 h-8 rounded bg-gradient-to-br from-[#FFD100] to-amber-400 p-1 flex flex-col justify-between shadow border border-amber-300">
                      <div className="w-full h-1 bg-amber-800/30 rounded" />
                      <div className="w-full h-1 bg-amber-800/30 rounded" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> CONTACTLESS VERIFIED
                    </span>
                  </div>

                  {/* Beneficiary Details */}
                  <div className="space-y-2 pt-1">
                    <div>
                      <p className="text-[10px] font-mono text-blue-200/90 uppercase">SMART RFID NUMBER</p>
                      <p className="text-xl font-mono font-bold tracking-widest text-white">
                        8820 •••• •••• 1001
                      </p>
                    </div>

                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <p className="text-[10px] text-blue-200/90 uppercase font-medium">Beneficiary Name</p>
                        <p className="text-sm font-bold text-white tracking-wide">JUAN D. DELA CRUZ</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-blue-200/90 uppercase font-medium">Category</p>
                        <p className="text-xs font-bold text-[#FFD100]">4Ps Household Beneficiary</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Strip */}
                  <div className="pt-4 border-t border-white/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-6 h-6 text-blue-200" />
                      <span className="text-[10px] text-blue-200 font-mono">SPECIMEN-BEN-0001</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 bg-[#FFD100] px-3 py-1 rounded-lg shadow-sm">
                      ⚡ Instant Aid Release
                    </span>
                  </div>
                </div>

                {/* Feature Badge */}
                <div className="absolute -bottom-5 -left-3 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-lg flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Automated SMS Notification</p>
                    <p className="text-[11px] text-slate-500">Real-time disbursement receipt</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ━━━ BENEFIT ELIGIBILITY CHECKER ━━━ */}
      <section id="eligibility" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#00338D] text-xs font-bold border border-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Citizen Evaluation Tool
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Benefit & Grant Eligibility Checker
            </h2>
            <p className="text-sm text-slate-600">
              Select your sector and barangay to instantly view all matching government programs and required documents.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Input Form Card */}
            <div className="lg:col-span-5 bg-slate-50/80 border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-[#00338D]" /> Check Your Qualification
              </h3>

              <form onSubmit={runEligibilityCheck} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    1. Select Sector Classification
                  </label>
                  <select
                    value={eligCategory}
                    onChange={(e) => setEligCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-[#00338D] focus:border-transparent outline-none shadow-xs"
                  >
                    <option value="4Ps Household Beneficiaries">4Ps Household Beneficiary</option>
                    <option value="Senior Citizens (Social Pension)">Senior Citizen (Aged 60+)</option>
                    <option value="Persons with Disabilities (PWD)">Person with Disability (PWD)</option>
                    <option value="Crisis & Emergency">Crisis / Indigent / Solo Parent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    2. Select Your Barangay
                  </label>
                  <select
                    value={eligBarangay}
                    onChange={(e) => setEligBarangay(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-[#00338D] focus:border-transparent outline-none shadow-xs"
                  >
                    <option value="">Choose Barangay (Optional)</option>
                    {barangays.map((b) => (
                      <option key={b.id} value={b.id}>{b.barangay_name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#00338D] hover:bg-[#002566] text-white font-bold text-sm rounded-2xl shadow-xs transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-[#FFD100]" />
                  Evaluate Programs
                </button>
              </form>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-7">
              {eligResult ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Qualified for Subsidies
                      </span>
                      <h4 className="text-xl font-bold text-slate-900 mt-2">{eligResult.category}</h4>
                      <p className="text-xs text-slate-500">Municipality of Bongabong • {eligResult.barangay}</p>
                    </div>
                  </div>

                  {/* Qualified Programs */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#00338D] mb-2">Available Programs</p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {eligResult.programs.map((prog, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs font-bold text-[#00338D]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">{prog}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grant Coverage */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <strong className="text-slate-900 block mb-1">Grant Coverage:</strong>
                    {eligResult.benefits}
                  </div>

                  {/* Requirements */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Documentary Checklist</p>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600">
                      {eligResult.requirements.map((req, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E30613]" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Apply Button */}
                  <button
                    onClick={() => {
                      setRegCategory(eligResult.category);
                      if (eligBarangay) setRegBarangayId(eligBarangay);
                      setShowRegisterModal(true);
                    }}
                    className="w-full py-3.5 bg-[#00338D] hover:bg-[#002566] text-white font-bold text-sm rounded-2xl shadow-xs transition flex items-center justify-center gap-2"
                  >
                    Proceed with Registration as {eligResult.category.split(' ')[0]} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50/60 border border-dashed border-slate-300 rounded-3xl p-10 text-center space-y-2.5 flex flex-col items-center justify-center min-h-[320px]">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-1 shadow-xs">
                    <Search className="w-6 h-6 text-[#00338D]" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">Instant Eligibility Evaluation</h4>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
                    Select your sector classification on the left form and click "Evaluate Programs" to preview all financial aid, requirements, and grant amounts.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ━━━ CORE FEATURES ━━━ */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-[#00338D] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            System Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Designed for Speed, Security & Dignity
          </h2>
          <p className="text-sm text-slate-600">
            Automated digital infrastructure eliminating queues, preventing duplicates, and ensuring prompt aid delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-blue-300 hover:shadow-sm transition">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#00338D] border border-blue-100 flex items-center justify-center mb-4">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Contactless RFID</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Fast tap-to-scan beneficiary card processing. Payout verification in under 2 seconds.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-emerald-300 hover:shadow-sm transition">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Identity Verification</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Photo match and National ID cross-verification to prevent fraud and duplicate disbursements.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-purple-300 hover:shadow-sm transition">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">SMS Notifications</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Immediate SMS broadcast of distribution schedules and payout receipts.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-amber-300 hover:shadow-sm transition">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Transparent Reports</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Full transaction ledger, timestamped event tracking, and exportable audit reports.
            </p>
          </div>
        </div>
      </section>

      {/* ━━━ BENEFIT PROGRAMS CATALOG ━━━ */}
      <section id="programs" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#00338D] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Welfare Catalog
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-2">
                Municipal Aid & Assistance Programs
              </h2>
            </div>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-6 py-3 bg-[#00338D] hover:bg-[#002566] text-white font-bold text-xs rounded-xl shadow-xs transition self-start sm:self-auto flex items-center gap-1.5"
            >
              Enroll into a Program <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {programsData.map((prog) => {
              const Icon = prog.icon;
              return (
                <div
                  key={prog.id}
                  className="bg-slate-50/70 border border-slate-200 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-5 hover:bg-white hover:shadow-xs transition"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#00338D] border border-blue-100 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500">{prog.tag}</span>
                          <h3 className="text-base font-bold text-slate-900">{prog.title}</h3>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${prog.badge}`}>
                        Active
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {prog.desc}
                    </p>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-800">Key Benefits:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {prog.perks.map((perk, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">{perk}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3.5 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Allocation</p>
                      <p className="text-sm font-bold text-[#00338D]">{prog.grants}</p>
                    </div>
                    <button
                      onClick={() => {
                        setRegCategory(prog.category);
                        setShowRegisterModal(true);
                      }}
                      className="text-xs font-bold text-[#00338D] hover:underline flex items-center gap-1"
                    >
                      Apply <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━ HOW RFID WORKS (4-STEP PIPELINE) ━━━ */}
      <section id="rfid-tech" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-[#00338D] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Process Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Contactless RFID Aid Release Works
          </h2>
          <p className="text-sm text-slate-600">
            From online registration to instant payout verification at your local Barangay hall.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              step: '01',
              title: 'Online Application',
              desc: 'Submit beneficiary details and upload valid IDs through this web portal.',
              icon: FileText
            },
            {
              step: '02',
              title: 'Verification & RFID Card',
              desc: 'Barangay Staff approves application and links an encrypted RFID smart card.',
              icon: CreditCard
            },
            {
              step: '03',
              title: 'Tap at Payout Venue',
              desc: 'Tap your RFID card on the scanner during payout events. No paperwork needed.',
              icon: Radio
            },
            {
              step: '04',
              title: 'Disburse & SMS Receipt',
              desc: 'Grant is released instantly and an automated SMS confirmation is dispatched.',
              icon: CheckCircle2
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 relative space-y-3.5 hover:shadow-xs transition">
                <span className="text-3xl font-extrabold text-slate-200 font-mono absolute top-4 right-5">
                  {item.step}
                </span>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#00338D] border border-blue-100 flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ━━━ FAQ ACCORDION ━━━ */}
      <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-1.5">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
            <p className="text-sm text-slate-600">Everything you need to know about beneficiary registration and claiming aid.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-6 py-4.5 flex items-center justify-between text-left text-sm sm:text-base font-bold text-slate-800 hover:text-[#00338D] transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${activeFaq === idx ? 'rotate-180 text-[#00338D]' : ''}`} />
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="bg-white border-t border-slate-200 py-12 text-slate-600 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-2.5 md:col-span-2">
              <div className="flex items-center gap-2.5 text-[#00338D] font-bold text-lg">
                <div className="w-7 h-7 rounded-lg bg-[#00338D] text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                DSWD EBMS
              </div>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
                Department of Social Welfare and Development — Municipal Beneficiary Management System for Bongabong, Oriental Mindoro.
              </p>
              <p className="text-xs text-slate-400">
                Municipal Social Welfare and Development Office (MSWDO), Municipal Hall, Bongabong.
              </p>
            </div>

            <div>
              <p className="text-slate-900 font-bold mb-3 uppercase tracking-wider text-xs">Navigation</p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-500">
                <li><a href="#eligibility" className="hover:text-[#00338D] transition">Eligibility Checker</a></li>
                <li><a href="#programs" className="hover:text-[#00338D] transition">Municipal Programs</a></li>
                <li><a href="#rfid-tech" className="hover:text-[#00338D] transition">RFID Technology</a></li>
                <li><a href="#faq" className="hover:text-[#00338D] transition">Help & FAQs</a></li>
              </ul>
            </div>

            <div>
              <p className="text-slate-900 font-bold mb-3 uppercase tracking-wider text-xs">Hotlines</p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="text-[#E30613]">📞</span> MSWDO: (043) 283-5000
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-[#00338D]">🚨</span> MDRRMO: 0917-123-4567
                </li>
                <li className="text-xs text-slate-400 mt-1">
                  Monday - Friday (8:00 AM - 5:00 PM)
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>© 2026 Republic of the Philippines — DSWD EBMS. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>Bongabong, Oriental Mindoro</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> System Online
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ━━━ LOGIN / REGISTER MODAL ━━━ */}
      {(showLoginModal || showRegisterModal) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3 overflow-y-auto">
          <div className={`bg-white rounded-3xl shadow-2xl w-full p-7 relative my-4 max-h-[92vh] overflow-y-auto ${showRegisterModal ? 'max-w-xl' : 'max-w-md'} animate-in fade-in zoom-in-95 duration-200 text-slate-900 border border-slate-100`}>
            
            {/* Close Button */}
            <button
              onClick={() => {
                setShowLoginModal(false);
                setShowRegisterModal(false);
                setGoogleError(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-[#00338D] mb-3 border border-blue-100 shadow-2xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {showLoginModal ? 'Sign in to DSWD EBMS' : 'Create Beneficiary Account'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {showLoginModal
                  ? 'Access your municipal benefits, RFID records & assistance'
                  : 'Join the Bongabong Social Welfare digital registry'}
              </p>
            </div>

            {/* LOGIN FORM */}
            {showLoginModal && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username o Email Address
                  </label>
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Username o Email (e.g. maria_santos o admin@ebms.local)"
                    className="w-full"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-3 border border-red-200 flex items-center gap-2 text-xs font-semibold text-[#E30613]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00338D] hover:bg-[#002566] text-white py-3.5 font-bold rounded-xl shadow-xs text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Signing In...
                    </span>
                  ) : 'Sign In'}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-slate-400 font-semibold">or continue with</span>
                  </div>
                </div>

                {/* Google Sign-In */}
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                />

                {googleError && (
                  <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs font-semibold text-amber-800">
                    {googleError}
                  </div>
                )}

                <p className="text-center text-xs text-slate-600 pt-2">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowRegisterModal(true);
                      setError(null);
                      setGoogleError(null);
                    }}
                    className="text-[#00338D] font-bold hover:underline"
                  >
                    Create Account
                  </button>
                </p>

                <p className="text-center text-xs text-slate-400 mt-2 pt-3 border-t border-slate-100">
                  Demo: <span className="font-mono text-slate-600 font-semibold">admin@ebms.local / Admin@123</span>
                </p>
              </form>
            )}

            {/* REGISTRATION FORM */}
            {showRegisterModal && (
              <form onSubmit={handleRegisterStep1} className="space-y-3.5 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="e.g. Maria"
                      className="w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="e.g. Santos"
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                      <span>Username <span className="text-red-500">*</span></span>
                      <span className="text-[10px] font-normal text-blue-600 lowercase bg-blue-50 px-1.5 py-0.2 rounded">pang-login</span>
                    </label>
                    <Input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="e.g. mariasantos"
                      className="w-full"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Gagamitin sa pag-login kahit walang Gmail.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-[10px] font-normal text-slate-400 lowercase bg-slate-100 px-1.5 py-0.2 rounded">opsyonal</span>
                    </label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. maria@gmail.com (Opsyonal)"
                      className="w-full"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">May OTP verification kung lalagyan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={regBarangayId}
                      onChange={(e) => setRegBarangayId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#00338D] focus:bg-white outline-none"
                      required
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.id}>{b.barangay_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sitio / Street</label>
                    <Input
                      type="text"
                      value={regSitio}
                      onChange={(e) => setRegSitio(e.target.value)}
                      placeholder="e.g. Sitio Centro"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sex</label>
                    <select
                      value={regSex}
                      onChange={(e) => setRegSex(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#00338D] focus:bg-white outline-none"
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Birthdate</label>
                    <Input
                      type="date"
                      value={regBirthdate}
                      onChange={(e) => setRegBirthdate(e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contact Number</label>
                    <Input
                      type="text"
                      value={regContactNumber}
                      onChange={(e) => setRegContactNumber(e.target.value)}
                      placeholder="0917xxxxxxx"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Sector Category</label>
                    <select
                      value={regCategory}
                      onChange={(e) => setRegCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#00338D] focus:bg-white outline-none"
                      required
                    >
                      <option value="4Ps Household Beneficiaries">4Ps Household Beneficiaries</option>
                      <option value="Senior Citizens (Social Pension)">Senior Citizens (Social Pension)</option>
                      <option value="Persons with Disabilities (PWD)">Persons with Disabilities (PWD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IP Classification</label>
                    <select
                      value={regIpClassification}
                      onChange={(e) => setRegIpClassification(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#00338D] focus:bg-white outline-none"
                      required
                    >
                      <option value="Non-IP">Non-IP (General)</option>
                      <option value="IP">IP (Indigenous People)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
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
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
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
                  <div className="rounded-xl bg-red-50 p-3 border border-red-200 flex items-center gap-2 text-xs font-semibold text-[#E30613]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>✓ Account created successfully! Redirecting to login...</span>
                  </div>
                )}

                {devOtp && !showOtpModal && (
                  <div className="rounded-xl bg-blue-50 p-3 border border-blue-200 text-xs font-bold text-[#00338D]">
                    🔧 Dev OTP Code: <span className="font-mono text-base font-black">{devOtp}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={regSuccess || otpSending}
                  className="w-full bg-[#00338D] hover:bg-[#002566] text-white py-3.5 font-bold rounded-xl shadow-sm text-sm transition-all"
                >
                  {otpSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {regEmail && regEmail.trim() !== '' ? 'Sending Verification Code...' : 'Creating Account...'}
                    </span>
                  ) : regSuccess ? (
                    'Account Created!'
                  ) : regEmail && regEmail.trim() !== '' ? (
                    'Send OTP & Verify Email'
                  ) : (
                    'Create Beneficiary Account'
                  )}
                </Button>

                <p className="text-center text-xs text-slate-600 pt-1">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setShowLoginModal(true);
                      setRegError(null);
                      setGoogleError(null);
                    }}
                    className="text-[#00338D] font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ━━━ OTP MODAL ━━━ */}
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
}
