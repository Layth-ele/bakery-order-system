/**
 * SystemSettingsView Component
 * 🟢 COMPONENT - View layer for SystemSettings page
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from SystemSettings.tsx (1328 lines)
 * - Pure presentation component
 * - No business logic
 * 
 * ✅ COMPLETED - Full form implementation with all settings sections:
 * - Business Information
 * - Delivery Settings
 * - Service Charge Settings
 * - Email & Notification Settings
 * - Payment Methods
 * - Order Policies
 * - System Maintenance
 * 
 * Used by: /pages/admin/SystemSettings.tsx
 * Location: /components/admin/system-settings/SystemSettingsView.tsx
 */

import React from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Database,
  CheckCircle,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  MapPin,
  Hash,
  DollarSign,
  Clock,
  Calendar,
  CreditCard,
  FileText,
  Bell,
  Truck,
  Wrench,
} from 'lucide-react';
import { ToastNotification } from '../../ToastNotification';
import type {
  StorageInfo,
  MemoryInfo,
  PerformanceStatus,
  ServerCleanupStatus,
} from '../../../hooks/admin/useSystemSettingsData';
import type { SystemSettings } from '../../../services/data/settingsDataService';
import { isFirebaseConfigured } from '../../../firebase/config';

// ============================================================================
// TYPES
// ============================================================================

export interface SystemSettingsViewProps {
  // Data
  settings: SystemSettings;
  storageInfo: StorageInfo | null;
  memoryInfo: MemoryInfo | null;
  performanceStatus: PerformanceStatus | null;
  serverCleanupStatus: ServerCleanupStatus | null;
  
  // Loading states
  loading: boolean;
  saving: boolean;
  cleanupRunning: boolean;
  timestampFixRunning?: boolean;
  // ❌ REMOVED MAR 14, 2026: serverCleanupRunning (Firebase cleanup button removed)
  
  // UI state
  notification: string;
  notificationType?: 'success' | 'error' | 'warning';
  
  // Actions
  onSettingsChange: (settings: SystemSettings) => void;
  onSave: () => void;
  onCleanup: () => void;
  onFixTimestamps?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  // ❌ REMOVED MAR 14, 2026: onFirebaseCleanup (Firebase cleanup button removed)
  onCloseNotification: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface FormSectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function FormSection({ icon: Icon, title, children }: FormSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon className="w-6 h-6 text-[#D4A574]" />
        <h2 className="text-[#333333] font-bold text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'number';
  placeholder?: string;
  required?: boolean;
  icon?: React.ElementType;
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  icon: Icon,
}: InputFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <input
          type={type}
          value={value || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent ${
            Icon ? 'pl-10' : ''
          }`}
        />
      </div>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  name?: string;
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  id,
  name,
}: TextAreaFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent resize-none"
      />
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

function CheckboxField({
  label,
  checked,
  onChange,
  description,
}: CheckboxFieldProps) {
  return (
    <div className="mb-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          className="mt-1 w-4 h-4 text-[#D4A574] border-gray-300 rounded focus:ring-[#D4A574]"
        />
        <div>
          <div className="text-sm font-medium text-gray-700">{label}</div>
          {description && (
            <div className="text-xs text-gray-500 mt-1">{description}</div>
          )}
        </div>
      </label>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SystemSettingsView({
  settings,
  storageInfo,
  memoryInfo,
  performanceStatus,
  serverCleanupStatus,
  loading,
  saving,
  cleanupRunning,
  timestampFixRunning,
  // ❌ REMOVED MAR 14, 2026: serverCleanupRunning (Firebase cleanup button removed)
  notification,
  notificationType,
  onSettingsChange,
  onSave,
  onCleanup,
  onFixTimestamps,
  onRefresh,
  isRefreshing = false,
  // ❌ REMOVED MAR 14, 2026: onFirebaseCleanup (Firebase cleanup button removed)
  onCloseNotification,
}: SystemSettingsViewProps) {
  
  // Helper to update a single field
  const updateField = <K extends keyof SystemSettings>(
    field: K,
    value: SystemSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [field]: value,
    });
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <ToastNotification
          message={notification}
          onClose={onCloseNotification}
          type={notificationType}
        />
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4 p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="icon-container-lg md:icon-container-xl flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
                <SettingsIcon className="icon-lg md:icon-xl text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="heading-3 md:heading-2 font-bold text-[#8B6F47] truncate leading-tight">
                  System Settings
                </h1>
                <p className="body-xs text-neutral-500 truncate mt-0.5">
                  Configure system preferences and options
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing || saving}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#D4A574]/10 border border-[#D4A574]/40 rounded-xl transition-all shadow-sm disabled:opacity-50 active:scale-95"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`icon-md text-[#D4A574] transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="body-xs text-[#8B6F47] font-semibold hidden md:inline whitespace-nowrap">Refresh</span>
                </button>
              )}
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#D4A574] text-white font-medium rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">
                  {saving ? 'Saving...' : 'Save Settings'}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-b-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                System Overview
              </h2>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Storage */}
          <div className="bg-gradient-to-br from-white to-[#E3F2FD] rounded-xl p-2.5 sm:p-4 border border-[#2196F3]/40 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
            <div className="p-1.5 sm:p-2.5 bg-[#2196F3]/15 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2.5">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 text-[#1976D2]" />
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5 sm:mb-1">
              Storage
            </div>
            <div className="text-lg sm:text-2xl font-bold leading-none text-[#1976D2]">
              {storageInfo ? `${storageInfo.percentage.toFixed(0)}%` : '-'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {storageInfo
                ? `${(storageInfo.used / 1024).toFixed(0)} KB used`
                : 'Calculating...'}
            </div>
          </div>

          {/* Memory */}
          <div className="bg-gradient-to-br from-white to-[#F3E5F5] rounded-xl p-2.5 sm:p-4 border border-[#9C27B0]/40 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
            <div className="p-1.5 sm:p-2.5 bg-[#9C27B0]/15 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2.5">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-[#7B1FA2]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5 sm:mb-1">
              Memory
            </div>
            <div className="text-lg sm:text-2xl font-bold leading-none text-[#7B1FA2]">
              {memoryInfo ? `${memoryInfo.percentage.toFixed(0)}%` : '-'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {memoryInfo
                ? `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(0)} MB`
                : 'Not available'}
            </div>
          </div>

          {/* Performance */}
          <div
            className={`bg-gradient-to-br from-white ${
              performanceStatus?.needsCleanup ? 'to-[#FFF3E0]' : 'to-[#E8F5E9]'
            } rounded-xl p-2.5 sm:p-4 border ${
              performanceStatus?.needsCleanup
                ? 'border-[#FF9800]/40'
                : 'border-[#4CAF50]/40'
            } shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center`}
          >
            <div
              className={`p-4 rounded-xl mb-3 ${
                performanceStatus?.needsCleanup
                  ? 'bg-[#FF9800]/15'
                  : 'bg-[#4CAF50]/15'
              }`}
            >
              {performanceStatus?.needsCleanup ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#F57C00]" />
              ) : (
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#388E3C]" />
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5 sm:mb-1">
              Performance
            </div>
            <div
              className={`text-lg sm:text-2xl font-bold leading-none ${
                performanceStatus?.needsCleanup
                  ? 'text-[#F57C00]'
                  : 'text-[#388E3C]'
              }`}
            >
              {performanceStatus?.needsCleanup ? '⚠️' : '✓'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {performanceStatus?.needsCleanup ? 'Needs cleanup' : 'Optimal'}
            </div>
          </div>

          {/* Firebase */}
          <div
            className={`bg-gradient-to-br from-white ${
              isFirebaseConfigured ? 'to-[#E8F5E9]' : 'to-[#FFF3E0]'
            } rounded-xl p-2.5 sm:p-4 border ${
              isFirebaseConfigured ? 'border-[#4CAF50]/40' : 'border-[#FF9800]/40'
            } shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center`}
          >
            <div
              className={`p-4 rounded-xl mb-3 ${
                isFirebaseConfigured ? 'bg-[#4CAF50]/15' : 'bg-[#FF9800]/15'
              }`}
            >
              <Database
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  isFirebaseConfigured ? 'text-[#388E3C]' : 'text-[#F57C00]'
                }`}
              />
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5 sm:mb-1">
              Firebase
            </div>
            <div
              className={`text-lg sm:text-2xl font-bold leading-none ${
                isFirebaseConfigured ? 'text-[#388E3C]' : 'text-[#F57C00]'
              }`}
            >
              {isFirebaseConfigured ? '✓' : '○'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {isFirebaseConfigured ? 'Connected' : 'Demo mode'}
            </div>
          </div>
        </div>

        {/* System Maintenance Section */}
        <FormSection icon={Database} title="🔧 SYSTEM MAINTENANCE">
          <div className="space-y-4">
            <div className="bg-[#E3F2FD] border-2 border-[#2196F3] rounded-lg p-4">
              <p className="text-sm text-[#333333]">
                <strong>Client Cleanup:</strong> Clear temporary data and optimize
                browser storage
              </p>
              <button
                onClick={onCleanup}
                disabled={cleanupRunning}
                className="mt-3 px-4 py-2 bg-[#2196F3] text-white rounded-lg hover:bg-[#1976D2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${cleanupRunning ? 'animate-spin' : ''}`}
                />
                {cleanupRunning ? 'Running Cleanup...' : 'Run Client Cleanup'}
              </button>
            </div>

            {isFirebaseConfigured && onFixTimestamps && (
              <div className="bg-[#FFF3E0] border-2 border-[#FF9800] rounded-lg p-4">
                <p className="text-sm text-[#333333]">
                  <strong>Fix Order Timestamps:</strong> Repair invalid timestamp formats in Firestore order documents
                </p>
                <button
                  onClick={onFixTimestamps}
                  disabled={timestampFixRunning}
                  className="mt-3 px-4 py-2 bg-[#FF9800] text-white rounded-lg hover:bg-[#F57C00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Wrench
                    className={`w-4 h-4 ${timestampFixRunning ? 'animate-spin' : ''}`}
                  />
                  {timestampFixRunning ? 'Fixing Timestamps...' : 'Fix Order Timestamps'}
                </button>
              </div>
            )}

            {/* ❌ REMOVED MAR 14, 2026: Firebase Cleanup button */}
            {/* The runFirestoreCleanup() function was a stub that returned { totalCleaned: 0 } */}
            {/* without doing any actual cleanup. This was misleading to users. */}
            {/* Will be re-implemented as a Cloud Function scheduled cleanup in the future. */}
            {/* See: /SYSTEM_SETTINGS_BUTTONS_DEEP_ANALYSIS.md for details */}
          </div>
        </FormSection>

        {/* Business Information */}
        <FormSection icon={Building2} title="🏢 BUSINESS INFORMATION">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Business Name"
              value={settings.businessName || ''}
              onChange={(value) => updateField('businessName', value)}
              placeholder="Your Business Name"
              icon={Building2}
            />
            
            <InputField
              label="Business Number"
              value={settings.businessNumber || ''}
              onChange={(value) => updateField('businessNumber', value)}
              placeholder="Tax/Registration Number"
              icon={Hash}
            />
            
            <InputField
              label="Business Email"
              value={settings.businessEmail || ''}
              onChange={(value) => updateField('businessEmail', value)}
              type="email"
              placeholder="business@example.com"
              icon={Mail}
            />
            
            <InputField
              label="Business Phone"
              value={settings.businessPhone || ''}
              onChange={(value) => updateField('businessPhone', value)}
              type="tel"
              placeholder="(604) 555-1234"
              icon={Phone}
            />
            
            <InputField
              label="Business Location"
              value={settings.businessLocation || ''}
              onChange={(value) => updateField('businessLocation', value)}
              placeholder="123 Main St"
              icon={MapPin}
            />
            
            <InputField
              label="Business City"
              value={settings.businessCity || ''}
              onChange={(value) => updateField('businessCity', value)}
              placeholder="Vancouver"
              icon={MapPin}
            />
          </div>
        </FormSection>

        {/* Delivery Settings */}
        <FormSection icon={Truck} title="🚚 DELIVERY SETTINGS">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Delivery Fee"
              value={settings.deliveryFee ?? ''}
              onChange={(value) => updateField('deliveryFee', parseFloat(value) || 0)}
              type="number"
              placeholder="0.00"
              icon={DollarSign}
              required
            />
            
            <InputField
              label="Free Delivery Threshold"
              value={settings.freeDeliveryThreshold ?? ''}
              onChange={(value) => updateField('freeDeliveryThreshold', parseFloat(value) || 0)}
              type="number"
              placeholder="0.00"
              icon={DollarSign}
              required
            />
            
            <InputField
              label="Free Delivery Minimum"
              value={settings.freeDeliveryMin ?? ''}
              onChange={(value) => updateField('freeDeliveryMin', parseFloat(value) || 0)}
              type="number"
              placeholder="0.00"
              icon={DollarSign}
            />
            
            <InputField
              label="Delivery Fee (Downtown)"
              value={settings.deliveryFeeDowntown ?? ''}
              onChange={(value) => updateField('deliveryFeeDowntown', parseFloat(value) || 0)}
              type="number"
              placeholder="0.00"
              icon={DollarSign}
            />
            
            <InputField
              label="Delivery Fee (East Van)"
              value={settings.deliveryFeeEastVan ?? ''}
              onChange={(value) => updateField('deliveryFeeEastVan', parseFloat(value) || 0)}
              type="number"
              placeholder="0.00"
              icon={DollarSign}
            />
            
            <InputField
              label="Order Deadline"
              value={settings.orderDeadline || ''}
              onChange={(value) => updateField('orderDeadline', value)}
              placeholder="12:00 PM"
              icon={Clock}
              required
            />
          </div>
          
          <div className="mt-4">
            <TextAreaField
              id="delivery-time-info"
              label="Delivery Time Information"
              value={settings.deliveryTimeInfo || ''}
              onChange={(value) => updateField('deliveryTimeInfo', value)}
              placeholder="Delivery information for customers..."
              rows={3}
            />
          </div>
        </FormSection>

        {/* Service Charge Settings */}
        <FormSection icon={DollarSign} title="💵 SERVICE CHARGE SETTINGS">
          <CheckboxField
            label="Enable Service Charge"
            checked={settings.serviceChargeEnabled || false}
            onChange={(checked) => updateField('serviceChargeEnabled', checked)}
            description="Add a service charge to orders"
          />
          
          {settings.serviceChargeEnabled && (
            <div className="mt-4">
              <InputField
                label="Service Charge Amount"
                value={settings.serviceChargeAmount ?? ''}
                onChange={(value) => updateField('serviceChargeAmount', parseFloat(value) || 0)}
                type="number"
                placeholder="3.99"
                icon={DollarSign}
              />
            </div>
          )}
        </FormSection>

        {/* Email & Notification Settings */}
        <FormSection icon={Mail} title="📧 EMAIL & NOTIFICATION SETTINGS">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Admin Email"
              value={settings.adminEmail || ''}
              onChange={(value) => updateField('adminEmail', value)}
              type="email"
              placeholder="admin@example.com"
              icon={Mail}
            />
            
            <InputField
              label="CC Email"
              value={settings.ccEmail || ''}
              onChange={(value) => updateField('ccEmail', value)}
              type="email"
              placeholder="cc@example.com"
              icon={Mail}
            />
            
            <InputField
              label="Order Email"
              value={settings.orderEmail || ''}
              onChange={(value) => updateField('orderEmail', value)}
              type="email"
              placeholder="orders@example.com"
              icon={Mail}
            />
            
            <InputField
              label="Order CC Email"
              value={settings.orderCcEmail || ''}
              onChange={(value) => updateField('orderCcEmail', value)}
              type="email"
              placeholder="ordercc@example.com"
              icon={Mail}
            />
          </div>
          
          <div className="mt-4">
            <CheckboxField
              label="Send Approval Emails"
              checked={settings.sendApprovalEmails || false}
              onChange={(checked) => updateField('sendApprovalEmails', checked)}
              description="Automatically send email notifications when orders are approved"
            />
          </div>
        </FormSection>

        {/* Payment Methods */}
        <FormSection icon={CreditCard} title="💳 PAYMENT METHODS">
          <div className="grid grid-cols-1 gap-4">
            <InputField
              label="Payment Method 1"
              value={settings.paymentMethod1 || ''}
              onChange={(value) => updateField('paymentMethod1', value)}
              placeholder="e.g., E-Transfer"
              icon={CreditCard}
            />
            
            <InputField
              label="Payment Method 2"
              value={settings.paymentMethod2 || ''}
              onChange={(value) => updateField('paymentMethod2', value)}
              placeholder="e.g., Cash"
              icon={CreditCard}
            />
            
            <TextAreaField
              id="payment-address"
              label="Payment Address/Instructions"
              value={settings.paymentAddress || ''}
              onChange={(value) => updateField('paymentAddress', value)}
              placeholder="Payment instructions for customers..."
              rows={3}
            />
          </div>
        </FormSection>

        {/* Order Policies */}
        <FormSection icon={FileText} title="📋 ORDER POLICIES">
          <TextAreaField
            id="daily-order-policy"
            label="Daily Order Policy"
            value={settings.dailyOrderPolicy || ''}
            onChange={(value) => updateField('dailyOrderPolicy', value)}
            placeholder="Daily order policy and terms..."
            rows={4}
          />
          
          <TextAreaField
            id="weekly-order-policy"
            label="Weekly Order Policy"
            value={settings.weeklyOrderPolicy || ''}
            onChange={(value) => updateField('weeklyOrderPolicy', value)}
            placeholder="Weekly order policy and terms..."
            rows={4}
          />
          
          <TextAreaField
            id="cancellation-policy"
            label="Cancellation Policy"
            value={settings.cancellationPolicy || ''}
            onChange={(value) => updateField('cancellationPolicy', value)}
            placeholder="Cancellation policy and terms..."
            rows={4}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <InputField
              label="Late Cancellation Fee Description"
              value={settings.lateCancellationFee || ''}
              onChange={(value) => updateField('lateCancellationFee', value)}
              placeholder="e.g., 50% of order total"
              icon={DollarSign}
            />
            
            <InputField
              label="Default Cancellation Fee % (pre-fills Cancel Order modal)"
              value={settings.cancellationFeePercent ?? ''}
              onChange={(value) => updateField('cancellationFeePercent', parseFloat(value) || 0)}
              type="number"
              placeholder="e.g., 0 (no fee) or 50"
              icon={Hash}
            />

            <InputField
              label="Max Monthly Cancellations"
              value={settings.maxMonthlyCancellations ?? ''}
              onChange={(value) => updateField('maxMonthlyCancellations', parseInt(value) || 0)}
              type="number"
              placeholder="e.g., 3"
              icon={Hash}
            />
          </div>
        </FormSection>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#D4A574] text-white font-medium rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving Settings...' : 'Save All Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}