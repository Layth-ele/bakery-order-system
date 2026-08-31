/**
 * CustomerProfileModal — View customer or admin profile
 *
 * ✅ MAR 28 2026: Admin vs customer split view
 * - Admin: shows admin-specific info, hides stats/credits/orders
 * - Customer: shows full stats, orders, credits as before
 */

import { useEffect, useState } from "react";
import type { ModalType } from '../../../types/modals';
import { toDate } from '../../../utils/timestampFormatting';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalLoading } from "../../../ui/modals/ModalLoadingState";
import {
  User, Mail, Phone, MapPin, Building, Calendar,
  Package, DollarSign, Wallet, Building2, Lock,
  ShieldCheck, KeyRound, AlertTriangle, CheckCircle,
  Clock, Hash,
} from "lucide-react";
import { Customer, Order } from "../../../types";
import { getOrdersByCustomer } from "../../../services/data/ordersDataService";
import { displayOrderNumber, displayCustomerCode } from '../../../utils/displayId';

interface CustomerProfileModalProps {
  customerEmail: string;
  onClose: () => void;
  isAdmin?: boolean;
  openModal?: (type: ModalType, props?: any) => void;
}

// ── shared field row ─────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2 text-gray-800 text-sm">
        <Icon className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
        <span>{value}</span>
      </div>
    </div>
  );
}

export function CustomerProfileModal({
  customerEmail,
  onClose,
  isAdmin = false,
  openModal,
}: CustomerProfileModalProps): JSX.Element | null {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [loading,  setLoading]  = useState(true);

  const loadCustomerData = async (cancelled: { value: boolean }) => {
    setLoading(true);
    try {
      const { getAllCustomers } = await import('../../../services/customersService');
      const all = await getAllCustomers();
      if (cancelled.value) return;
      const found = all.find(c => c.id === customerEmail || c.email === customerEmail);
      setCustomer(found || null);
      if (found) {
        const ord = await getOrdersByCustomer(found.id || customerEmail);
        if (cancelled.value) return;
        setOrders(ord);
      }
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  };

  useEffect(() => {
    // RACE-CONDITION FIX: cancelled flag prevents stale fetch (from a previous
    // customerEmail) writing to state after this effect has been cleaned up.
    const cancelled = { value: false };
    loadCustomerData(cancelled);
    return () => { cancelled.value = true; };
  }, [customerEmail]);

  if (loading) {
    return (
      <StyleModalShell width="4xl" skinType="default" onClose={onClose} title="PROFILE">
        <ModalLoading message="Loading profile..." />
      </StyleModalShell>
    );
  }

  if (!customer) {
    return (
      <StyleModalShell width="4xl" skinType="default" onClose={onClose} title="PROFILE"
        subtitle="Not found" icon={<User className="w-5 h-5 sm:w-6 sm:h-6" />}>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Customer not found.</p>
          <button onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            Close
          </button>
        </div>
      </StyleModalShell>
    );
  }

  const isAdminAccount = customer.customerType === 'admin'
    || (customer as any).role === 'admin';

  // ── ADMIN PROFILE ──────────────────────────────────────────────────────────
  if (isAdminAccount) {
    const memberSince = (toDate(customer.createdAt) ?? new Date())
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lastLogin = (customer as any).lastLoginAt
      ? (toDate((customer as any).lastLoginAt) ?? new Date())
          .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : null;

    return (
      <StyleModalShell
        width="4xl"
        skinType="default"
        onClose={onClose}
        title="ADMIN PROFILE"
        subtitle={customer.contactPerson || customer.storeName || customer.email}
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#FF9800] flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
        footer={
          <button onClick={onClose}
            className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">
            Close
          </button>
        }
      >
        <div className="space-y-5">

          {/* Admin role banner */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">System Administrator</p>
              <p className="text-xs text-amber-600">Full access to all admin features and customer data</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300">
              <ShieldCheck className="w-3 h-3" /> ADMIN
            </span>
          </div>

          {/* Identity */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={User}  label="Full Name" value={customer.contactPerson || customer.storeName || '—'} />
              <InfoRow icon={Mail}  label="Email"     value={customer.email} />
              <InfoRow icon={Phone} label="Phone"     value={customer.phone} />
              <InfoRow icon={Hash}  label="Admin ID"  value={displayCustomerCode(customer as any) || '—'} />
            </div>
          </div>

          {/* System Access */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">System Access</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Package,    label: 'Order Management',    desc: 'View, approve, reject orders' },
                { icon: User,       label: 'Customer Management', desc: 'Create, edit, manage accounts' },
                { icon: DollarSign, label: 'Payment Management',  desc: 'Confirm payments, issue credits' },
                { icon: ShieldCheck,label: 'System Settings',     desc: 'Configure app settings' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-[10px] text-gray-500">{desc}</p>
                  </div>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Account Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
                <Calendar className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500">Member Since</p>
                  <p className="text-xs font-semibold text-gray-800">{memberSince}</p>
                </div>
              </div>
              {lastLogin && (
                <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
                  <Clock className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500">Last Login</p>
                    <p className="text-xs font-semibold text-gray-800">{lastLogin}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500">Status</p>
                  <p className="text-xs font-semibold text-emerald-700">Active</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
                <KeyRound className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500">Auth Method</p>
                  <p className="text-xs font-semibold text-gray-800">Email / Password</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Admin accounts have unrestricted access. To change this admin's password, use the
              <strong> Reset Password</strong> button from the Customer Management page.
            </p>
          </div>

        </div>
      </StyleModalShell>
    );
  }

  // ── CUSTOMER PROFILE ───────────────────────────────────────────────────────
  const totalOrders     = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const totalSpent      = orders
    .filter(o => o.status === 'completed' || o.status === 'in_process')
    .reduce((s, o) => s + o.total, 0);

  const isCommercial = customer.customerType === 'commercial';
  const badgeColor   = isCommercial ? '#2196F3' : '#9C27B0';
  const BadgeIcon    = isCommercial ? Building2 : User;
  const badgeLabel   = isCommercial ? 'Commercial' : 'Individual';

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title="CUSTOMER PROFILE"
      subtitle={customer.storeName || customer.contactPerson || customer.email}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shadow-lg"
          style={{ backgroundColor: badgeColor }}>
          <BadgeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={
        <div className="flex w-full gap-3">
          {isAdmin && openModal && (
            <button
              onClick={() => openModal('ADD_CREDIT', {
                customer, onClose: () => {}, onSuccess: loadCustomerData,
              })}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#D4A574] text-white rounded-lg hover:bg-[#B8935F] transition-colors font-medium"
            >
              <Wallet className="w-5 h-5" />
              Add Credit
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5">

        {/* Type badge */}
        <div className="flex justify-end">
          <span className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-sm text-sm font-semibold text-white uppercase tracking-wide"
            style={{ backgroundColor: badgeColor }}>
            <BadgeIcon className="w-4 h-4" />{badgeLabel}
          </span>
          <span className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full shadow-sm"
            style={{ backgroundColor: badgeColor }}>
            <BadgeIcon className="w-4 h-4 text-white" />
          </span>
        </div>

        {/* Contact Information */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={Mail}     label="Email"          value={customer.email} />
            <InfoRow icon={Phone}    label="Phone"          value={customer.phone} />
            <InfoRow icon={User}     label="Contact Person" value={customer.contactPerson} />
            {isCommercial && <InfoRow icon={Building} label="Business Name" value={customer.storeName} />}
            <InfoRow icon={MapPin}   label="Address"        value={customer.storeAddress} />
            <InfoRow icon={Calendar} label="Member Since"   value={
              (toDate(customer.createdAt) ?? new Date()).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            } />
            <InfoRow icon={Hash}     label="Customer ID"    value={displayCustomerCode(customer as any)} />
          </div>
        </div>

        {/* Account Statistics */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Account Statistics</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Package,     label: 'Total Orders',   value: totalOrders,              color: 'text-[#D4A574]' },
              { icon: Package,     label: 'Completed',      value: completedOrders,          color: 'text-emerald-600' },
              { icon: DollarSign,  label: 'Total Spent',    value: `$${totalSpent.toFixed(2)}`, color: 'text-[#D4A574]' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
                <div className="text-base font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Credits */}
        {(customer as any).creditBalance !== undefined && (customer as any).creditBalance > 0 && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Account Credits</h3>
            <div className="bg-gradient-to-r from-[#D4A574]/10 to-[#C5A028]/10 border border-[#D4A574]/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#D4A574]" />
                  <span className="font-semibold text-gray-900 text-sm">Available Credits</span>
                </div>
                <span className="text-xl font-bold text-[#D4A574]">
                  ${((customer as any).creditBalance ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        {orders.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Recent Orders <span className="text-gray-400 font-normal normal-case">(last {Math.min(orders.length, 5)})</span>
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {orders.slice(0, 5).map(order => (
                <div key={order.id}
                  className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors shadow-sm border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      Order #{displayOrderNumber(order)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(toDate(order.createdAt) ?? new Date()).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-semibold text-gray-900 text-sm">${order.total.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      order.status === 'completed'  ? 'bg-green-100 text-green-700' :
                      order.status === 'in_process' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'pending'    ? 'bg-amber-100 text-amber-700' :
                                                      'bg-gray-100 text-gray-600'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </StyleModalShell>
  );
}
