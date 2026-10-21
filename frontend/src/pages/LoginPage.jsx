import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Download, Smartphone, Lock, X } from 'lucide-react';

const GoogleSignInButton = ({ onSuccess, onError }) => {
  const buttonRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showIpGuide, setShowIpGuide] = useState(false);

  const isIpAddress = typeof window !== 'undefined' && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname);

  useEffect(() => {
    let interval;
    let timeout;

    if (isIpAddress) {
      setScriptFailed(true);
      return;
    }

    const loadGoogleScript = () => {
      if (!document.getElementById('google-gsi-client')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          console.log('[Google Sign-In] Script loaded via dynamic injection');
          initGoogleButton();
        };
        script.onerror = () => {
          console.error('[Google Sign-In] Failed to load Google Identity script');
          setScriptFailed(true);
        };
        document.head.appendChild(script);
      }
    };

    const initGoogleButton = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com';
          console.log('[Google Sign-In] Initializing with Client ID:', clientId.substring(0, 20) + '...');
          
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              console.log('[Google Sign-In] Callback received');
              if (response.credential) {
                console.log('[Google Sign-In] Credential received, token length:', response.credential.length);
                onSuccess(response.credential);
              } else {
                console.error('[Google Sign-In] No credential in response');
                onError?.('Google sign-in failed - no credential received');
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'medium',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 360,
          });
          
          console.log('[Google Sign-In] Button rendered successfully');
          setScriptLoaded(true);
          setScriptFailed(false);
        } catch (err) {
          console.error('[Google Sign-In] Initialization error:', err);
          setScriptFailed(true);
        }
      }
    };

    if (window.google?.accounts?.id) {
      console.log('[Google Sign-In] Library already available');
      initGoogleButton();
    } else {
      loadGoogleScript();
      interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          console.log('[Google Sign-In] Library loaded');
          clearInterval(interval);
          clearTimeout(timeout);
          initGoogleButton();
        }
      }, 200);

      timeout = setTimeout(() => {
        if (!window.google?.accounts?.id) {
          console.warn('[Google Sign-In] Library failed to load after 8 seconds (check adblocker or connection)');
          clearInterval(interval);
          setScriptFailed(true);
        }
      }, 8000);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onSuccess, onError, isIpAddress]);

  const handleFallbackClick = async () => {
    if (isIpAddress) {
      setShowIpGuide(true);
      return;
    }

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

  const handleDownloadApk = () => {
    const downloadLink = document.createElement('a');
    downloadLink.href = '/downloads/BeniAid.apk';
    downloadLink.download = 'BeniAid.apk';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  return (
    <div>
      <div ref={buttonRef} className={`w-full flex justify-center ${scriptLoaded && !isIpAddress ? '' : 'hidden'}`} />

      {!scriptLoaded && !scriptFailed && !isIpAddress && (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-700 rounded-2xl bg-slate-800/50 text-slate-500 font-medium cursor-wait"
        >
          <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading Google Sign-In...
        </button>
      )}

      {(isIpAddress || (!scriptLoaded && scriptFailed)) && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleFallbackClick}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-700 rounded-2xl hover:bg-slate-800 transition-all duration-200 text-slate-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Sign in with Google'}
          </button>
        </div>
      )}

      {isIpAddress && (
        <div className="mt-3 rounded-2xl bg-blue-950/60 border border-blue-800/40 p-3 text-left">
          <div className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-300">
              <span className="font-bold text-white">Gamit ang Cellphone (CP)?</span>
              <p className="mt-0.5 text-slate-400 text-[11px]">
                Pinagbabawalan ng Google ang direct IP (<code className="font-mono text-blue-300">{window.location.hostname}</code>) sa web browser.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadApk}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[11px] transition"
                >
                  <Download className="w-3.5 h-3.5" /> I-download ang BeniAid APK
                </button>
                <button
                  type="button"
                  onClick={() => setShowIpGuide(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-[11px] transition border border-slate-700"
                >
                  Paano mag-login?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIpGuide && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 relative border border-slate-800 text-slate-200">
            <button
              type="button"
              onClick={() => setShowIpGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-400 mb-2 border border-blue-500/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Google Sign-In sa Cellphone (CP)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Dahil naka-access ka sa IP (<span className="font-mono text-blue-300">{window.location.hostname}</span>), hinaharang ito ng Google OAuth policy sa web browser.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-blue-950/50 rounded-2xl border border-blue-900/50">
                <p className="font-bold text-blue-300 text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> Solusyon 1 (Inirerekomenda): BeniAid Mobile App
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  I-download ang official BeniAid Android app. Sa mobile app, suportado ang Android Google Play Services at may digital QR pass!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowIpGuide(false);
                    handleDownloadApk();
                  }}
                  className="mt-2.5 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-center text-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> I-download ang BeniAid APK
                </button>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60">
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Solusyon 2: Email &amp; Password
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Maaari kang mag-login gamit ang Username o Email sa form sa itaas.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIpGuide(false)}
                  className="mt-2.5 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition text-center text-xs"
                >
                  Mag-sign In gamit ang Form
                </button>
              </div>

              <p className="text-[10px] text-slate-500 text-center pt-1">
                Tip: Sa PC/Laptop, buksan ang <span className="font-mono text-slate-400">http://localhost:3000</span> upang gumana ang Google popup.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default function LoginPage() {
  const navigate = useNavigate();
  const { login, googleLogin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [googleError, setGoogleError] = useState(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('expired') === '1';
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setGoogleError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to login');
    }
  };

  const handleGoogleSuccess = useCallback(async (credential) => {
    setError(null);
    setGoogleError(null);
    console.log('[Login] Google credential received, sending to backend...');
    try {
      await googleLogin(credential);
      console.log('[Login] Google login successful, redirecting to dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('[Login] Google login error:', err);
      const msg = err.response?.data?.message || err.message || 'Google sign-in failed';
      const detail = err.response?.data?.error_detail || '';
      console.error('[Login] Error detail:', detail);
      setGoogleError(msg + (detail ? ` (${detail})` : ''));
    }
  }, [googleLogin, navigate]);

  const handleGoogleError = useCallback((msg) => {
    console.error('[Login] Google error callback:', msg);
    setGoogleError(msg || 'Google sign-in failed');
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-950/90 p-8 shadow-2xl shadow-slate-900/40 backdrop-blur-xl">
        <img src="/beniaid-logo.png" alt="BeniAid logo" className="mb-5 h-16 w-16 rounded-full bg-white object-contain shadow-md" />
        <h1 className="text-3xl font-semibold">BeniAid Login</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to access the beneficiary management system.</p>
        {sessionExpiredNotice && (
          <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center justify-between">
            <span>Your session has expired. Please log in again to continue.</span>
            <button
              type="button"
              onClick={() => setSessionExpiredNotice(false)}
              className="text-amber-300 hover:text-white text-xs font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Username or Email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Username or Email (e.g. maria_santos)"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-950 text-slate-500 font-medium">or continue with</span>
          </div>
        </div>

        {/* Google Sign-In */}
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
        />

        {googleError && (
          <div className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{googleError}</div>
        )}
      </div>
    </div>
  );
}
