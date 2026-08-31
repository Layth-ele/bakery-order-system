import { useState, useEffect, useCallback } from 'react';
import {User as UserIcon, Building2, Mail, Phone, MapPin, Save, Eye, EyeOff, Lock} from 'lucide-react'
import { toast } from 'sonner';
import { useAlert } from '../../contexts/AlertContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { scrollToTop } from '../../utils/scrollUtils';
import { CustomerPageLayout } from './CustomerPageLayout';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { getCustomerByEmail, updateCustomer } from '../../services/customersService';

interface MyProfileProps {
  user: any;
  onProfileUpdate: (updatedUser: any) => void;
  onNavigateBack?: () => void;
}

export function MyProfile({ user, onProfileUpdate, onNavigateBack }: MyProfileProps): JSX.Element | null {
  const { showAlert } = useAlert();
  
  // Profile fields
  const [contactPerson, setContactPerson] = useState(user.contactPerson || '');
  const [storeName, setStoreName] = useState(user.storeName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [storeAddress, setStoreAddress] = useState(user.storeAddress || '');

  // DOUBLE-SUBMIT GUARDS: prevent duplicate Firebase writes when user clicks
  // the button multiple times before the async operation completes.
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    scrollToTop();
  }, []);

  useEffect(() => {
    // Reload user data when component mounts
    setContactPerson(user.contactPerson || '');
    setStoreName(user.storeName || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setStoreAddress(user.storeAddress || '');
  }, [user]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!user.email) return;
    setIsRefreshing(true);
    try {
      const freshData = await getCustomerByEmail(user.email);
      if (freshData) {
        setContactPerson(freshData.contactPerson || '');
        setStoreName(freshData.storeName || '');
        setEmail(freshData.email || '');
        setPhone(freshData.phone || '');
        setStoreAddress(freshData.storeAddress || '');
        onProfileUpdate(freshData);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [user.email, onProfileUpdate]);

  const validateBCPhone = (phoneNumber: string): boolean => {
    // BC phone validation - accepts all BC area codes (236, 250, 604, 672, 778)
    const phonePattern = /^(\+1|1)?[\s.-]?\(?(236|250|604|672|778)\)?[\s.-]?([2-9][0-9]{2})[\s.-]?([0-9]{4})$/;
    return phonePattern.test(phoneNumber);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProfile) return; // DOUBLE-SUBMIT GUARD

    // Validate required fields
    if (!contactPerson.trim()) {
      showAlert({
        title: 'Validation Error',
        message: 'Contact person name is required.',
        icon: 'error'
      });
      return;
    }

    // Business name is only required for commercial accounts
    if (user.customerType === 'commercial' && !storeName.trim()) {
      showAlert({
        title: 'Validation Error',
        message: 'Business/Store name is required for commercial accounts.',
        icon: 'error'
      });
      return;
    }

    if (!email.trim()) {
      showAlert({
        title: 'Validation Error',
        message: 'Email address is required.',
        icon: 'error'
      });
      return;
    }

    if (!phone.trim()) {
      showAlert({
        title: 'Validation Error',
        message: 'Phone number is required.',
        icon: 'error'
      });
      return;
    }

    // Validate BC phone number
    if (!validateBCPhone(phone)) {
      showAlert({
        title: 'Invalid Phone Number',
        message: 'Please enter a valid British Columbia phone number.\n\nAccepted formats:\n• (604) 555-1234\n• 604-555-1234\n• 604.555.1234\n• 6045551234\n\nBC Area Codes: 236, 250, 604, 672, 778',
        icon: 'error'
      });
      return;
    }

    if (!storeAddress.trim()) {
      showAlert({
        title: 'Validation Error',
        message: 'Address is required.',
        icon: 'error'
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      // Check if email is being changed to one that already exists
      const emailAlreadyExists = await getCustomerByEmail(email);
      if (emailAlreadyExists && emailAlreadyExists.id !== user.id) {
        showAlert({
          title: 'Email Already Exists',
          message: 'Another account is already using this email address. Please use a different email.',
          icon: 'error'
        });
        return;
      }

      // Update user data
      const updates = {
        contactPerson,
        storeName,
        email,
        phone,
        storeAddress,
      };

      await updateCustomer({ id: user.id, ...updates } as any);

      // Create updated user object for session
      const updatedUser = {
        ...user,
        ...updates,
      };

      // Call parent update
      onProfileUpdate(updatedUser);

      toast.success('Profile updated successfully!', { duration: 3000 });
    } catch (error) {
      console.error('Failed to update profile:', error);
      showAlert({
        title: 'Update Failed',
        message: 'Failed to update profile. Please try again.',
        icon: 'error'
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return; // DOUBLE-SUBMIT GUARD

    // Validate all password fields are filled
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({
        title: 'Validation Error',
        message: 'Please fill in all password fields.',
        icon: 'error'
      });
      return;
    }

    // Verify current password
    if (currentPassword !== user.password) {
      showAlert({
        title: 'Incorrect Password',
        message: 'The current password you entered is incorrect.',
        icon: 'error'
      });
      return;
    }

    // Validate new password length
    if (newPassword.length < 6) {
      showAlert({
        title: 'Weak Password',
        message: 'New password must be at least 6 characters long.',
        icon: 'error'
      });
      return;
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      showAlert({
        title: 'Passwords Don\'t Match',
        message: 'New password and confirmation password do not match.',
        icon: 'error'
      });
      return;
    }

    // Check if new password is same as current
    if (newPassword === currentPassword) {
      showAlert({
        title: 'Same Password',
        message: 'New password must be different from your current password.',
        icon: 'error'
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updateCustomer({ id: user.id, password: newPassword } as any);

      // Create updated user object for session
      const updatedUser = {
        ...user,
        password: newPassword,
      };

      // Call parent update
      onProfileUpdate(updatedUser);

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast.success('Password changed successfully!', { duration: 3000 });
    } catch (error) {
      console.error('Failed to change password:', error);
      showAlert({
        title: 'Change Failed',
        message: 'Failed to change password. Please try again.',
        icon: 'error'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Calculate profile completeness
  const profileCompleteness = () => {
    const fields = [contactPerson, email, phone, storeAddress];
    if (user.customerType === 'commercial') fields.push(storeName);
    const filledFields = fields.filter(f => f && f.trim()).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  return (
    <CustomerPageLayout
      icon={UserIcon}
      title="My Profile"
      subtitle="Manage your account information and settings"
      sectionTitle="Profile Overview"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {/* Profile Information Card */}
      <Card className="bg-white backdrop-blur-sm border-[#D4A574]/30 shadow-lg border-2 mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="icon-container-lg flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
              <UserIcon className="icon-lg text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-[#8B6F47]" style={{ letterSpacing: '0.05em' }}>
                Profile Information
              </CardTitle>
              <CardDescription className="text-neutral-600 mt-1">
                Update your personal and business details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Person */}
              <div className="space-y-2">
                <Label htmlFor="contactPerson" className="text-neutral-700 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[#D4A574]" />
                  <span style={{ letterSpacing: '0.05em' }}>CONTACT PERSON</span>
                </Label>
                <Input
                  id="contactPerson"
                  type="text"
                  placeholder="Full Name"
                  value={contactPerson}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPerson(e.target.value)}
                  required
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg"
                />
              </div>

              {/* Business Name - Only show for commercial accounts */}
              {user.customerType === 'commercial' && (
                <div className="space-y-2">
                  <Label htmlFor="storeName" className="text-neutral-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4A574]" />
                    <span style={{ letterSpacing: '0.05em' }}>BUSINESS NAME</span>
                  </Label>
                  <Input
                    id="storeName"
                    type="text"
                    placeholder="Store or Business Name"
                    value={storeName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreName(e.target.value)}
                    required
                    className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#D4A574]" />
                  <span style={{ letterSpacing: '0.05em' }}>EMAIL ADDRESS</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-neutral-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#D4A574]" />
                  <span style={{ letterSpacing: '0.05em' }}>PHONE NUMBER</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(604) 555-1234"
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  required
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg"
                />
              </div>
            </div>

            {/* Address - Full Width */}
            <div className="space-y-2">
              <Label htmlFor="storeAddress" className="text-neutral-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4A574]" />
                <span style={{ letterSpacing: '0.05em' }}>BUSINESS ADDRESS</span>
              </Label>
              <AddressAutocomplete
                value={storeAddress}
                onChange={setStoreAddress}
                placeholder="123 Main St, Vancouver, BC"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:border-[#D4A574] focus:ring-[#D4A574]/30 transition text-sm h-11"
              />
            </div>

            {/* Customer Type Badge */}
            <div className="flex items-center gap-2 p-3 bg-[#FFF8E7] border border-[#D4A574]/30 rounded-lg">
              <span className="text-sm text-neutral-700 font-medium" style={{ letterSpacing: '0.05em' }}>ACCOUNT TYPE:</span>
              <span className="px-3 py-1 bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-full text-sm text-white font-medium" style={{ letterSpacing: '0.05em' }}>
                {user.customerType === 'commercial' ? 'COMMERCIAL' : 'INDIVIDUAL'}
              </span>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              disabled={isSavingProfile}
              className="w-full bg-gradient-to-r from-[#8B6F47] to-[#D4A574] hover:from-[#7A5F3C] hover:to-[#C8A882] text-white transition-all duration-300 hover:scale-105 border border-[#D4A574]/30 h-12 rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              style={{ letterSpacing: '0.1em' }}
            >
              <Save className="w-5 h-5 mr-2" />
              {isSavingProfile ? 'SAVING…' : 'SAVE PROFILE'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="bg-white backdrop-blur-sm border-[#D4A574]/30 shadow-lg border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="icon-container-lg flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
              <Lock className="icon-lg text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-[#8B6F47]" style={{ letterSpacing: '0.05em' }}>
                Change Password
              </CardTitle>
              <CardDescription className="text-neutral-600 mt-1">
                Update your account password for enhanced security
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-neutral-700" style={{ letterSpacing: '0.05em' }}>
                CURRENT PASSWORD
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[#D4A574] transition-colors"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-neutral-700" style={{ letterSpacing: '0.05em' }}>
                NEW PASSWORD
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[#D4A574] transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-neutral-600 mt-1">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-neutral-700" style={{ letterSpacing: '0.05em' }}>
                CONFIRM NEW PASSWORD
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  className="bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-[#D4A574] h-11 rounded-lg pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[#D4A574] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Change Password Button */}
            <Button
              type="submit"
              disabled={isChangingPassword}
              className="w-full bg-gradient-to-r from-[#8B6F47] to-[#D4A574] hover:from-[#7A5F3C] hover:to-[#C8A882] text-white transition-all duration-300 hover:scale-105 border border-[#D4A574]/30 h-12 rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              style={{ letterSpacing: '0.1em' }}
            >
              <Lock className="w-5 h-5 mr-2" />
              {isChangingPassword ? 'UPDATING…' : 'UPDATE PASSWORD'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CustomerPageLayout>
  );
}