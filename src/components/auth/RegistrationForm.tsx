/**
 * RegistrationForm.tsx
 * ✅ Clean registration form — no temp password shown to user
 * ✅ Address autocomplete via OpenStreetMap (no API key)
 * ✅ Single MapPin icon (AddressAutocomplete handles its own icon)
 * ✅ BC phone validation with clear error
 * ✅ Address required validation
 */

import { useState, FormEvent } from 'react';
import { AlertTriangle, Mail, User, Building2, Phone } from 'lucide-react';
import { AddressAutocomplete } from '../AddressAutocomplete';

export interface RegistrationFormData {
  email: string;
  fullName: string;
  businessName: string;
  phone: string;
  address: string;
  customerType: 'commercial' | 'individual';
}

export interface RegistrationFormProps {
  onSubmit: (data: RegistrationFormData) => Promise<void>;
  loading?: boolean;
  error?: string;
}

// BC area codes — includes all valid BC/Yukon numbers
const BC_PHONE_PATTERN = /^(\+1|1)?[\s.\-()]*(236|250|604|672|778)[\s.\-(]*[2-9][0-9]{2}[\s.\-)]?[0-9]{4}$/;

export function RegistrationForm({ onSubmit, loading = false, error }: RegistrationFormProps): JSX.Element | null {
  const [email, setEmail]               = useState('');
  const [fullName, setFullName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone]               = useState('');
  const [address, setAddress]           = useState('');
  const [customerType, setCustomerType] = useState<'commercial' | 'individual'>('commercial');
  const [phoneError, setPhoneError]     = useState('');
  const [addressError, setAddressError] = useState('');
  const [addressValid, setAddressValid] = useState(false);

  const inputClass = "w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition disabled:opacity-50 text-sm";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    // Phone validation
    const rawPhone = phone.replace(/[\s.\-()]/g, '');
    if (!BC_PHONE_PATTERN.test(phone)) {
      setPhoneError('Please enter a valid BC phone number (area codes: 236, 250, 604, 672, 778).');
      valid = false;
    } else {
      setPhoneError('');
    }

    // Address validation
    if (!address.trim()) {
      setAddressError('Please enter your delivery address.');
      valid = false;
    } else if (address.trim().length < 5) {
      setAddressError('Please enter a complete address.');
      valid = false;
    } else {
      setAddressError('');
    }

    if (!valid) return;

    await onSubmit({ email, fullName, businessName, phone, address, customerType });

    // Reset on success
    setEmail(''); setFullName(''); setBusinessName('');
    setPhone(''); setAddress(''); setCustomerType('commercial');
    setPhoneError(''); setAddressError('');
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h2>
        <p className="text-gray-500 text-sm">Start ordering from your bakery</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Account Type */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Account Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['commercial', 'individual'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCustomerType(type)}
                disabled={loading}
                className={`py-2.5 px-4 rounded-xl text-sm font-medium border-2 transition-all ${
                  customerType === type
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                {type === 'commercial' ? '🏢 Commercial' : '👤 Individual'}
              </button>
            ))}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="reg-email" type="email" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required disabled={loading} className={inputClass}
            />
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="reg-name" type="text" placeholder="John Doe"
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              required disabled={loading} className={inputClass}
            />
          </div>
        </div>

        {/* Business Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg-business" className="block text-sm font-medium text-gray-700">
            {customerType === 'commercial' ? 'Business Name' : 'Business Name'}
            {customerType === 'individual' && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="reg-business" type="text"
              placeholder={customerType === 'commercial' ? 'ABC Company Inc.' : 'Optional'}
              value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              required={customerType === 'commercial'} disabled={loading} className={inputClass}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700">
            Phone <span className="text-gray-400 font-normal">(BC only)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="reg-phone" type="tel" placeholder="(604) 123-4567"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
              required disabled={loading}
              className={`${inputClass} ${phoneError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            />
          </div>
          {phoneError && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{phoneError}</span>
            </div>
          )}
        </div>

        {/* Address — AddressAutocomplete has its OWN MapPin icon, no wrapper needed */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Delivery Address <span className="text-red-500">*</span>
          </label>
          <AddressAutocomplete
            value={address}
            onChange={(val) => { setAddress(val); setAddressError(''); }}
            placeholder="Start typing your address..."
            disabled={loading}
            required
            onValidationChange={setAddressValid}
          />
          {addressError && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{addressError}</span>
            </div>
          )}
        </div>

        {/* Global error */}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit" disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating account…
            </span>
          ) : 'Request Account'}
        </button>

        {/* Approval notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-amber-800 font-medium">
            ⏳ Your account will be reviewed by an admin.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            You'll receive login credentials once approved.
          </p>
        </div>
      </form>
    </div>
  );
}
