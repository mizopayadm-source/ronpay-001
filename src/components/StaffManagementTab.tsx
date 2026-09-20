import React, { useState } from 'react';
import { 
  Shield, 
  UserCheck, 
  UserX, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Key, 
  Mail, 
  Phone, 
  CheckCircle, 
  AlertCircle,
  X,
  Lock,
  Clock
} from 'lucide-react';
import { StaffAccount, UserRole } from '../types';
import { ROLE_DEFINITIONS, getRoleBadgeInfo } from '../utils/rbac';
import { formatDateDDMMYYYY } from '../utils/date';

interface StaffManagementTabProps {
  currentRole: UserRole;
  staffList: StaffAccount[];
  onSaveStaff: (staff: StaffAccount) => void;
  onDeleteStaff: (staffId: string) => void;
}

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({
  currentRole,
  staffList,
  onSaveStaff,
  onDeleteStaff,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [editingStaff, setEditingStaff] = useState<StaffAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<StaffAccount>>({
    name: '',
    email: '',
    phone: '',
    role: 'MODERATOR',
    designation: '',
    isActive: true,
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData({
      id: `staff-${Date.now()}`,
      name: '',
      email: '',
      phone: '',
      role: 'MODERATOR',
      designation: '',
      isActive: true,
      notes: '',
      assignedAt: new Date().toISOString(),
      assignedBy: 'superadmin',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffAccount) => {
    setEditingStaff(staff);
    setFormData({ ...staff });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert('Hming leh Phone number ziah ngei ngei tur a ni.');
      return;
    }

    const newStaff: StaffAccount = {
      id: editingStaff ? editingStaff.id : (formData.id || `staff-${Date.now()}`),
      name: formData.name || '',
      email: formData.email || '',
      phone: formData.phone || '',
      role: (formData.role as UserRole) || 'MODERATOR',
      designation: formData.designation || '',
      isActive: formData.isActive ?? true,
      notes: formData.notes || '',
      assignedAt: editingStaff?.assignedAt || new Date().toISOString(),
      assignedBy: editingStaff?.assignedBy || currentRole,
      lastLogin: editingStaff?.lastLogin,
      avatarUrl: editingStaff?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Staff')}&background=6366f1&color=fff`,
    };

    onSaveStaff(newStaff);
    setIsModalOpen(false);
  };

  const filteredStaff = staffList.filter((staff) => {
    const matchesSearch = 
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.phone.includes(searchTerm) ||
      (staff.email && staff.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (staff.designation && staff.designation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || staff.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Staff & RBAC Clearance Management
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              RonPay Operations, Finance desk, leh KYC Verification-a thawk tura staff lakluh leh role siam remna.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-900/40 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Staff Thar Dahna</span>
          </button>
        </div>

        {/* Roles clearance legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
          <div className="bg-slate-950/60 p-2 rounded-xl border border-rose-900/40">
            <span className="font-bold text-rose-400">👑 SUPER_ADMIN</span>
            <p className="text-slate-400 text-[10px] mt-0.5">Platform pricing, staff accounts, leh system settings pumhlum.</p>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-indigo-900/40">
            <span className="font-bold text-indigo-400">🛡️ ADMIN</span>
            <p className="text-slate-400 text-[10px] mt-0.5">Finance reports, settlements, audit logs leh KYC Desk.</p>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-emerald-900/40">
            <span className="font-bold text-emerald-400">🔍 MODERATOR</span>
            <p className="text-slate-400 text-[10px] mt-0.5">Creator KYC verification leh Bawm moderation chauh.</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff name, phone, email..."
            className="w-full pl-8.5 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Staff List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredStaff.map((staff) => {
          const badge = getRoleBadgeInfo(staff.role);
          return (
            <div
              key={staff.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 space-y-3 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={staff.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}`}
                    alt={staff.name}
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white truncate flex items-center gap-1.5">
                      {staff.name}
                      {staff.isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Active" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" title="Inactive" />
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {staff.designation || 'Staff Member'}
                    </p>
                  </div>
                </div>

                {/* Role Badge */}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}>
                  {staff.role}
                </span>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-300 truncate">
                  <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{staff.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 truncate">
                  <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{staff.email || 'No email'}</span>
                </div>
              </div>

              {/* Footer info & action buttons */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {staff.lastLogin ? formatDateDDMMYYYY(staff.lastLogin) : 'Never logged in'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg text-slate-300 transition cursor-pointer"
                    title="Edit Staff"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  {deleteConfirmId === staff.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteStaff(staff.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[9.5px] transition cursor-pointer"
                      >
                        Nuaibo
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(staff.id)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-600/80 hover:text-white rounded-lg text-slate-300 transition cursor-pointer"
                      title="Delete Staff"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredStaff.length === 0 && (
          <div className="col-span-full py-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <UserX className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Staff an awm rih lo emaw i zawn hmuh loh a ni.</p>
          </div>
        )}
      </div>

      {/* Staff Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                {editingStaff ? 'Staff Account Siam Thatna' : 'Staff Thar Lakluhna'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Hming Pum</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Lalhmingliana"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Phone Number (Login ID)</label>
                <input
                  type="tel"
                  required
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 9862000000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. staff@ronpay.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">RBAC Role Assigned</label>
                <select
                  value={formData.role || 'MODERATOR'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="MODERATOR">MODERATOR - KYC Desk & Content Verification</option>
                  <option value="ADMIN">ADMIN - Finance, Settlement, & Operations</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN - Full System Clearance</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Designation / Nihna</label>
                <input
                  type="text"
                  value={formData.designation || ''}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Operations Assistant, KYC Desk Officer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formData.isActive ?? true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 bg-slate-950"
                />
                <label htmlFor="isActiveCheck" className="text-slate-300 font-bold text-[11px] cursor-pointer">
                  Account Active a ni (Login phalsak)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  {editingStaff ? 'Save Changes' : 'Staff Dah Lût Rawh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
