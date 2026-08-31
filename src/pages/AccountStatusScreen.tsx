/**
 * AccountStatusScreen.tsx
 * 
 * Displays appropriate messages for non-approved customer accounts.
 * Handles: pending, rejected, and suspended account statuses.
 * 
 * ✅ MARCH 7, 2026: Updated for route-driven architecture
 * - Now uses useLoaderData() to get user and status
 * - Uses useNavigate() for logout
 * - No props required (data comes from route loader)
 * 
 * SECURITY ALIGNMENT:
 * - Matches Firestore rule: isApproved() checks status == 'approved'
 * - Client-side UX for non-approved statuses
 * - Server still enforces via Firestore rules
 */

import { AlertTriangle, Clock, XCircle, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useLoaderData, useNavigate } from 'react-router';
import { getAuth, signOut } from 'firebase/auth';
import { useCachedSettings } from '../hooks/useCachedFirebase';

export type AccountStatus = 'pending' | 'rejected' | 'suspended' | 'approved';

interface AccountStatusLoaderData {
  user: {
    email: string;
    status: AccountStatus;
  };
  status: AccountStatus;
}

export function AccountStatusScreen(): JSX.Element | null {
  const { user, status } = useLoaderData() as AccountStatusLoaderData;
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
    navigate('/');
  };
  
  const email = user.email;

  // ✅ Live settings for dynamic contact info
  const { data: settings } = useCachedSettings();
  const contactEmail = settings?.businessEmail || 'orders@example.com';
  const contactPhone = settings?.businessPhone || '(555) 555-0100';
  // FIX T2R3-C1: brand name now interpolated from settings (was hardcoded)
  const bizName = settings?.businessName || 'Your Bakery';

  // Configuration for each status
  const statusConfig = {
    pending: {
      icon: Clock,
      iconColor: 'text-yellow-500',
      bgColor: 'from-yellow-500/20 to-orange-500/20',
      borderColor: 'border-yellow-500/40',
      title: 'Account Pending Approval',
      description: 'Your registration is being reviewed by our team',
      message: `Thank you for registering with ${bizName} Wholesale!

Your account (${email}) has been successfully created and is currently awaiting administrator approval.

What happens next:
• Our team will review your registration details
• You'll receive an email notification once your account is approved
• Approval typically takes 1-2 business days

In the meantime, feel free to browse our product catalog or contact us if you have any questions.`,
      supportMessage: `Questions? Contact us at: ${contactEmail} or ${contactPhone}`,
    },
    rejected: {
      icon: XCircle,
      iconColor: 'text-red-500',
      bgColor: 'from-red-500/20 to-pink-500/20',
      borderColor: 'border-red-500/40',
      title: 'Registration Not Approved',
      description: 'Unfortunately, your registration was not approved',
      message: `We're sorry, but your registration (${email}) was not approved at this time.

This could be due to:
• Incomplete or incorrect information provided
• Business verification requirements not met
• Duplicate account detected
• Other administrative reasons

Next steps:
• Contact our support team to discuss your application
• Provide any additional documentation if requested
• Re-apply with updated information if appropriate`,
      supportMessage: `Please contact us at: ${contactEmail} or ${contactPhone}`,
    },
    suspended: {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      bgColor: 'from-orange-500/20 to-red-500/20',
      borderColor: 'border-orange-500/40',
      title: 'Account Suspended',
      description: 'Your account has been temporarily suspended',
      message: `Your account (${email}) has been suspended.

This may be due to:
• Payment-related issues
• Violation of terms of service
• Administrative hold
• Account security concerns

To resolve this:
• Contact our support team immediately
• Review any emails sent to your registered address
• Provide any requested information or documentation
• Discuss reinstatement options

We're here to help resolve this matter as quickly as possible.`,
      supportMessage: `Urgent: Contact us at ${contactEmail} or ${contactPhone}`,
    },
    approved: {
      icon: Clock,
      iconColor: 'text-green-500',
      bgColor: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/40',
      title: 'Account Approved!',
      description: 'Your account is ready',
      message: 'Your account has been approved. Please sign out and sign back in to access your dashboard.',
      supportMessage: `Contact us at: ${contactEmail} or ${contactPhone}`,
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-900 to-black flex items-center justify-center p-6">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #e8dcc8 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-[#e8dcc8]/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#D4A574]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-2xl">
        <Card className={`bg-gradient-to-br ${config.bgColor} backdrop-blur-sm border-2 ${config.borderColor} shadow-2xl`}>
          <CardHeader className="text-center pb-6">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className={`w-24 h-24 rounded-full bg-neutral-900/50 flex items-center justify-center border-2 ${config.borderColor}`}>
                <Icon className={`w-12 h-12 ${config.iconColor}`} />
              </div>
            </div>

            {/* Title */}
            <CardTitle className="text-3xl md:text-4xl text-[#e8dcc8] mb-3" style={{ letterSpacing: '0.05em' }}>
              {config.title}
            </CardTitle>

            {/* Divider */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-1 h-1 bg-[#e8dcc8] rounded-full"></div>
              <div className="w-1 h-1 bg-[#e8dcc8] rounded-full"></div>
              <div className="w-1 h-1 bg-[#e8dcc8] rounded-full"></div>
            </div>

            <CardDescription className="text-neutral-300 text-lg">
              {config.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Main Message */}
            <div className="bg-neutral-900/50 border border-neutral-700/50 rounded-lg p-6">
              <p className="text-neutral-200 text-base leading-relaxed whitespace-pre-line">
                {config.message}
              </p>
            </div>

            {/* Support Information */}
            <div className={`bg-gradient-to-r ${config.bgColor} border-2 ${config.borderColor} rounded-lg p-4`}>
              <p className={`${config.iconColor} font-semibold text-sm mb-2`} style={{ letterSpacing: '0.05em' }}>
                SUPPORT
              </p>
              <p className="text-neutral-200 text-sm">
                {config.supportMessage}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="lg"
                className="flex-1 bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 hover:text-[#e8dcc8] hover:border-[#e8dcc8]/50 transition-all"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>

              {/* Contact Support Button */}
              <Button
                onClick={() => window.location.href = `mailto:${contactEmail}`}
                size="lg"
                className="flex-1 bg-gradient-to-r from-[#3d3832] to-[#4a4238] hover:from-[#4a4238] hover:to-[#3d3832] text-[#e8dcc8] border border-[#e8dcc8]/30"
                style={{ letterSpacing: '0.05em' }}
              >
                CONTACT SUPPORT
              </Button>
            </div>

            {/* Check Status / Refresh */}
            <div className="text-center pt-4 border-t border-neutral-700/50 space-y-3">
              {status === 'pending' && (
                <p className="text-sm text-neutral-400 italic">
                  Once approved by our team, sign out and sign back in to access your dashboard.
                </p>
              )}
              <button
                onClick={async () => {
                  try { await signOut(getAuth()); } catch {}
                  navigate('/');
                }}
                className="text-sm text-[#D4A574] hover:text-[#e8dcc8] underline transition-colors"
              >
                ← Back to Login
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-neutral-500">
            {bizName} • {settings?.businessLocation?.split('\n')[0] || '123 Example St, City, BC V0V 0V0'}
          </p>
        </div>
      </div>
    </div>
  );
}