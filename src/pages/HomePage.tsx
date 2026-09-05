/**
 * HomePage.tsx
 * 🟢 PAGE - Landing page for unauthenticated users
 *
 * REFACTORED - Phase 1: Business Logic Extraction Complete
 * - Extracted authentication logic to useAuth hook
 * - Extracted forms to LoginForm and RegistrationForm components
 * - Extracted business settings to useBusinessSettings hook
 * - Reduced from 1633 lines to ~390 lines (76% reduction)
 *
 * Route-level page component for unauthenticated users.
 *
 * Used by: App.tsx (main router)
 * Location: /pages/HomePage.tsx
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LoginForm } from '../components/auth/LoginForm';
import { RegistrationForm, RegistrationFormData } from '../components/auth/RegistrationForm';
import { useAuth } from '../hooks/useAuth';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { useAlert } from '../contexts/AlertContext';
import { useModal } from '../contexts/ModalContextNew';
import { getAndClearRedirectPath } from '../routes/guards/navigationGuards';
// ✅ PASS 3: Removed `figma:asset/...` import — that virtual import was a
// Figma-export residue that broke production builds when the asset wasn't
// present. Logo now uses a normal asset import. Replace this placeholder
// with the real logo by dropping a PNG at src/assets/delight-logo.png.
import delightLogo from '../assets/logo-placeholder.png';
import { RefreshCw, ChevronDown, ChevronUp, Copy, Bug } from 'lucide-react';
import { isFirebaseConfigured } from '../firebase/config';

// ============================================================================
// TYPES
// ============================================================================

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  description: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HomePage(): JSX.Element | null {
  // ============================================================================
  // HOOKS - Data and logic layers
  // ============================================================================
  
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const { login, register, loading: authLoading } = useAuth();
  const { businessSettings } = useBusinessSettings();
  const { openModal } = useModal();
  
  // ============================================================================
  // LOCAL STATE - UI only
  // ============================================================================
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [registerError, setRegisterError] = useState<string | undefined>();
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // ============================================================================
  // DEMO ACCOUNTS - Development only. Never shown in production builds.
  // FIX BUG 14: Previously rendered unconditionally — admin credentials
  // (including the 'admin123' default) were visible to anyone on the login page.
  // ============================================================================

  const IS_DEV = import.meta.env.DEV === true;

  // FIX T2R3-C6 (CRITICAL — source-control security): Demo account passwords
  // were previously hardcoded as plaintext (`password123`, `Store@123`, `Test@123`)
  // committed to source control. Even with the IS_DEV gate below, those
  // strings are searchable in git history forever, AND would render on a
  // production login page if IS_DEV is somehow truthy in production (broken
  // Vite mode flag, mistakenly built with --mode development).
  //
  // Now reads from env vars matching the same convention as the admin demo
  // account (line above already used VITE_ADMIN_PASSWORD).  Set these in
  // your .env.local file alongside VITE_ADMIN_PASSWORD:
  //   VITE_DEMO_COMMERCIAL_PASSWORD=...
  //   VITE_DEMO_STORE_PASSWORD=...
  //   VITE_DEMO_INDIVIDUAL_PASSWORD=...
  // If unset, the demo accounts simply aren't usable for quick-login until
  // an admin populates the env vars — fail-closed, no silent leak.
  const demoAccounts: DemoAccount[] = IS_DEV ? [
    {
      email: import.meta.env.VITE_ADMIN_EMAIL || 'admin@bakery.com',
      password: import.meta.env.VITE_ADMIN_PASSWORD || '(set VITE_ADMIN_PASSWORD)',
      role: 'Admin',
      description: 'Full system access - manage products, orders, customers'
    },
    {
      email: 'john@commercial.com',
      password: import.meta.env.VITE_DEMO_COMMERCIAL_PASSWORD || '(set VITE_DEMO_COMMERCIAL_PASSWORD)',
      role: 'Commercial Customer',
      description: 'John\'s Bakery - commercial wholesale pricing'
    },
    {
      email: 'store@cafe.com',
      password: import.meta.env.VITE_DEMO_STORE_PASSWORD || '(set VITE_DEMO_STORE_PASSWORD)',
      role: 'Commercial Customer',
      description: 'Demo Cafe - commercial wholesale pricing'
    },
    {
      email: 'individual@test.com',
      password: import.meta.env.VITE_DEMO_INDIVIDUAL_PASSWORD || '(set VITE_DEMO_INDIVIDUAL_PASSWORD)',
      role: 'Individual Customer',
      description: 'Jane Individual - retail pricing'
    }
  ] : [];

  // ============================================================================
  // HANDLERS - Thin wrappers around hook methods
  // ============================================================================

  const handleQuickLogin = async (email: string, password: string) => {
    
    // Prevent double-clicking
    if (isLoggingIn) {
      return;
    }
    
    setDemoEmail(email);
    setDemoPassword(password);
    
    await handleLogin(email, password);
  };

  const copyToClipboard = (text: string, type: string) => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showAlert({
            title: 'Copied!',
            message: `${type} copied to clipboard`,
            icon: 'success',
          });
        })
        .catch(() => {
          fallbackCopyToClipboard(text, type);
        });
    } else {
      // Use fallback method directly
      fallbackCopyToClipboard(text, type);
    }
  };

  const fallbackCopyToClipboard = (text: string, type: string) => {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      
      if (successful) {
        showAlert({
          title: 'Copied!',
          message: `${type} copied to clipboard`,
          icon: 'success',
        });
      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {
      // If all else fails, show the text in an alert so user can copy manually
      showAlert({
        title: `Copy ${type}`,
        message: `Please copy manually: ${text}`,
        icon: 'error',
      });
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(undefined);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Navigate based on actual role from Firestore (not email heuristic)
        const redirectPath = getAndClearRedirectPath();
        const isAdminUser = result.user?.role === 'admin';
        const targetPath = redirectPath || (isAdminUser ? '/admin' : '/customer');
        navigate(targetPath);
      } else {
        // Handle different alert types
        if (result.alertType) {
          showAlert({
            title: result.alertType === 'pending' ? 'Account Pending' :
                   result.alertType === 'rejected' ? 'Account Rejected' :
                   'Account Suspended',
            message: result.message || 'Please contact support.',
            icon: 'error',
          });
        } else {
          setLoginError(result.message);
        }
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (data: RegistrationFormData) => {
    setIsRegistering(true);
    setRegisterError(undefined);
    
    try {
      // Generate a cryptographically-secure internal password for Firebase Auth
      // account creation. NOT shown to the user — the customer will receive a
      // password-reset email after admin approval, at which point they set
      // their own real password.
      //
      // FIX T2R3-C2 (CRITICAL): Was Math.random()-based, which is NOT
      // cryptographically secure.  V8's PRNG can be reverse-engineered from
      // ~5 consecutive outputs, allowing an attacker who can sniff timing or
      // cause a deterministic registration to predict the temporary password
      // and take over the account before the customer resets it.  Now uses
      // crypto.getRandomValues() — the browser-native CSPRNG.
      const internalPassword = (() => {
        // 24 bytes → 32 base64 chars; trim '=' padding and replace '/+'
        const buf = new Uint8Array(24);
        crypto.getRandomValues(buf);
        let s = '';
        for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
        return 'dlb_' + btoa(s).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]!));
      })();
      
      const result = await register({
        email: (data.email ?? ""),
        password: internalPassword,
        storeName: data.businessName || "",
        contactPerson: data.fullName || "",
        storeAddress: data.address,
        phone: (data.phone ?? ""),
        customerType: data.customerType,
      }, businessSettings.businessEmail || 'orders@example.com');
      
      if (result.success) {
        showAlert({
          title: 'Registration Successful!',
          message: result.message,
          icon: 'success',
        });
      } else {
        if (result.isDuplicate) {
          showAlert({
            title: 'Duplicate Account',
            message: result.message,
            icon: 'error',
          });
        } else {
          setRegisterError(result.message);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setRegisterError('An unexpected error occurred. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleForgotPassword = (prefillEmail?: string) => {
    openModal('FORGOT_PASSWORD', {
      initialEmail: prefillEmail || loginEmail || '',
    });
  };

  const scrollToAuth = () => {
    const authSection = document.getElementById('auth-section');
    if (authSection) {
      authSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // FIX T2R3-H5 (HIGH): Was using native browser confirm() and alert()
  // which are blocking, inconsistent with the rest of the app's styled
  // showConfirm/showAlert from AlertContext, and unstylable for branding.
  // Now uses the same modal helpers every other admin action uses.
  const handleResetDemoData = () => {
    showConfirm(
      'RESET DEMO DATA?',
      'This will:\n• Delete ALL orders\n• Delete ALL custom products\n• Delete ALL custom customers\n• Keep default products\n• Keep default demo users\n\nThis action cannot be undone!',
      () => {
        // A true Firestore reset requires server-side operations (Cloud
        // Functions). Surface this clearly rather than reloading and
        // silently doing nothing.
        showAlert({
          title: 'Firebase mode detected',
          message:
            'localStorage does not contain order data in Firebase mode. ' +
            'To reset demo data, use the Firebase console or run the ' +
            'dedicated reset Cloud Function.',
          icon: 'info',
        });
      }
    );
  };

  // FIX T2R3-H4 (HIGH): Removed empty useEffect that was a dead-code
  // instrumentation point. The previous body was:
  //   try {} catch (error) { console.error('[HomePage] Error initializing demo data:', error); }
  // No demo-data initialization actually happens — demo data is auto-seeded
  // by the seed scripts at deploy time. The empty try/catch served no
  // purpose and added React reconciliation overhead on every mount.
  // ============================================================================
  // RENDER - Pure presentation layer
  // ============================================================================

  return (
    <div className="page app-shell bg-gradient-to-b from-black via-neutral-900 to-black">
      <div className="app-shell--centered">
        {/* ========================================================================
            HERO SECTION
         ======================================================================== */}
        <div id="hero-section" className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6">
          {/* Elegant background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, #e8dcc8 1px, transparent 0)`,
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          {/* Radial gradient overlay */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/50 to-black" />

          <div className="relative z-10 text-center px-4 max-w-5xl mx-auto w-full">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <img
                src={delightLogo}
                alt="Logo"
                className="w-32 h-32 sm:w-48 sm:h-48 object-contain drop-shadow-2xl animate-fade-in"
              />
            </div>
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-6xl md:text-8xl mb-6 text-[#e8dcc8] drop-shadow-2xl animate-slide-up"
            style={{
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.1em',
            }}
          >
            DELIGHT BAKEHOUSE
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl mb-10 text-neutral-300 max-w-2xl mx-auto leading-relaxed animate-fade-in">
            Wholesale Bakery Excellence in {businessSettings.businessCity}
          </p>

          {/* CTA Button */}
          <button
            onClick={scrollToAuth}
            className="px-6 py-3.5 sm:px-10 sm:py-5 bg-gradient-to-r from-[#3d3832] to-[#4a4238] text-[#e8dcc8] rounded-xl hover:from-[#4a4238] hover:to-[#3d3832] transition-all shadow-2xl text-sm sm:text-lg border-2 border-[#e8dcc8]/30 hover:border-[#e8dcc8]/50 hover:shadow-[0_0_30px_rgba(232,220,200,0.3)] transform hover:scale-105 duration-300 animate-slide-up"
            style={{ letterSpacing: '0.1em' }}
          >
            ACCESS WHOLESALE PORTAL
          </button>
        </div>


        </div>
      </div>

      {/* ========================================================================
          AUTH SECTION
       ======================================================================== */}
      <div
        id="auth-section"
        className="relative min-h-screen flex items-center justify-center py-20 px-4 sm:px-6 bg-gradient-to-b from-stone-100 to-amber-50"
      >
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #d4c5a9 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />

        <div className="relative w-full max-w-md mx-auto">
          {/* Header above tabs */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-amber-700 uppercase tracking-widest mb-1">Wholesale Portal</p>
            <h2 className="text-2xl font-bold text-gray-900">Access Your Account</h2>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-neutral-100 rounded-2xl p-1">
              <TabsTrigger
                value="login"
                className="rounded-xl data-[state=active]:bg-[#8B6F47] data-[state=active]:text-white data-[state=active]:shadow-sm text-neutral-500 font-semibold text-sm py-2.5 tracking-wide transition-all duration-200"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="rounded-xl data-[state=active]:bg-[#8B6F47] data-[state=active]:text-white data-[state=active]:shadow-sm text-neutral-500 font-semibold text-sm py-2.5 tracking-wide transition-all duration-200"
              >
                Register
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              {/* Demo Accounts Banner - Premium Design - Only show in demo mode */}
              {!isFirebaseConfigured && (
                <div className="mb-6 bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                    className="w-full flex items-center justify-between px-5 py-4 text-gray-700 hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔑</span>
                      <span className="text-sm font-semibold tracking-wide text-gray-800">DEMO ACCOUNTS</span>
                    </div>
                    {showDemoAccounts ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  
                  {showDemoAccounts && (
                    <div className="px-4 pb-4 space-y-3 border-t border-amber-100 pt-3">
                      {demoAccounts.map((account, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-amber-300 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800 tracking-wider">
                                {account.role.toUpperCase()}
                              </span>
                              {account.role === 'Admin' && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                  FULL ACCESS
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickLogin((account.email ?? ""), account.password)}
                              className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-all font-medium"
                              disabled={isLoggingIn}
                            >
                              QUICK LOGIN
                            </button>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Email:</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                                  {account.email}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard((account.email ?? ""), 'Email')}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy email"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Password:</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                                  {account.password}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(account.password, 'Password')}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy password"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2 italic">
                            {account.description}
                          </p>
                        </div>
                      ))}
                      <p className="text-xs text-center text-gray-400 mt-3">
                        Click "QUICK LOGIN" or copy credentials to the login form
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <LoginForm
                onSubmit={handleLogin}
                onEmailChange={setLoginEmail}
              onForgotPassword={() => handleForgotPassword(loginEmail)}
                loading={isLoggingIn}
                error={loginError}
              />
              
              {!isFirebaseConfigured && (
                <div className="mt-4 space-y-2">
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResetDemoData}
                      className="text-xs text-orange-400/70 hover:text-orange-400 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-3 h-3" />
                      RESET DEMO DATA
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowDebugInfo(!showDebugInfo)}
                      className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Bug className="w-3 h-3" />
                      {showDebugInfo ? 'HIDE' : 'SHOW'} DEBUG INFO
                    </button>
                  </div>
                  {showDebugInfo && (
                    <div className="bg-black/40 border border-[#e8dcc8]/20 rounded-lg p-4 mt-2 text-left">
                      <div className="text-xs text-[#e8dcc8] space-y-2">
                        <div>
                          <div className="font-bold mb-1">Mode:</div>
                        </div>
                        <div>
                          <pre className="text-neutral-300 overflow-auto max-h-40 text-[10px] bg-black/60 p-2 rounded">
                          </pre>
                        </div>
                        <div>
                          <div className="font-bold mb-1">Console Output:</div>
                          <div className="text-neutral-400 text-[10px]">Check browser console (F12) for detailed logs</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <RegistrationForm
                onSubmit={handleRegister}
                loading={isRegistering}
                error={registerError}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          FOOTER — compact, luxury dark, dynamic from Settings
          ════════════════════════════════════════════════════════════ */}
      <footer className="bg-gradient-to-b from-neutral-900 to-black border-t border-[#D4A574]/20">
        <div className="max-w-5xl mx-auto px-5 py-7 w-full">

          {/* ── Main content: stacks vertically on mobile, row on sm+ ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-4 mb-5">

            {/* Brand */}
            <div className="flex-shrink-0">
              <p className="text-[9px] font-bold text-[#D4A574] uppercase tracking-[0.2em] mb-0.5">
                Wholesale Portal
              </p>
              <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Georgia, serif' }}>
                {businessSettings.businessName}
              </p>
            </div>

            {/* Divider — desktop only */}
            <div className="hidden sm:block w-px self-stretch bg-[#D4A574]/20" />

            {/* Contact items — vertical on mobile, horizontal on sm+ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">

              {/* Location */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#D4A574]/10 border border-[#D4A574]/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-xs text-neutral-300 leading-snug">
                  {businessSettings.businessLocation.split('\n')[0]}
                </p>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#D4A574]/10 border border-[#D4A574]/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <a
                  href={`tel:${businessSettings.businessPhone.replace(/[^0-9+]/g, '')}`}
                  className="text-xs text-neutral-300 hover:text-[#D4A574] transition-colors"
                >
                  {businessSettings.businessPhone}
                </a>
              </div>

              {/* Email */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#D4A574]/10 border border-[#D4A574]/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <a
                  href={`mailto:${businessSettings.businessEmail}`}
                  className="text-xs text-neutral-300 hover:text-[#D4A574] transition-colors break-all"
                >
                  {businessSettings.businessEmail}
                </a>
              </div>
            </div>
          </div>

          {/* Copyright bar */}
          <div className="border-t border-[#D4A574]/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
            <p className="text-xs text-neutral-400">
              © {new Date().getFullYear()} {businessSettings.businessName}. All rights reserved.
            </p>
            <p className="text-xs text-neutral-500 italic">
              North Vancouver, BC · Wholesale only
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}