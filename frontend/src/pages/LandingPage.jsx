import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi, barangayApi } from '../services/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
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
    try {
      await login(email, password);
      setShowLoginModal(false);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to login');
    }
  };

  const handleRegister = async (e) => {
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

    try {
      await authApi.registerBeneficiary({
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
      setRegSuccess(true);
      const savedEmail = regEmail;
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
      setTimeout(() => {
        setShowRegisterModal(false);
        setRegSuccess(false);
        setEmail(savedEmail);
        setPassword('');
        setShowLoginModal(true);
      }, 2000);
    } catch (err) {
      setRegError(err.message || 'Registration failed');
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className={`bg-white rounded-xl shadow-2xl w-full p-6 relative my-4 max-h-[90vh] overflow-y-auto ${showRegisterModal ? 'max-w-lg' : 'max-w-md'}`}>
            <button
              onClick={() => {
                setShowLoginModal(false);
                setShowRegisterModal(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
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

                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowRegisterModal(true);
                      setError(null);
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
              <form onSubmit={handleRegister} className="space-y-3 text-left">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <Button
                  type="submit"
                  disabled={regSuccess}
                  className="w-full bg-[#0038A8] hover:bg-[#002D87] text-white py-3 font-semibold rounded-lg"
                >
                  {regSuccess ? 'Account Created!' : 'Create Account'}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setShowLoginModal(true);
                      setRegError(null);
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
    </div>
  );
};

export default LandingPage;
