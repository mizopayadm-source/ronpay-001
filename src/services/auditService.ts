import { supabase } from '../lib/supabase';
import { AuditLog, CreatorProfile } from '../types';
import { getStoredCreatorProfile, isSuperAdminOrAdminProfile } from '../utils/storage';

export const addAuditLog = async (
  action: string,
  details: string,
  targetType: AuditLog['targetType'],
  targetId: string,
  performedBy: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        action,
        details,
        targetType,
        targetId,
        performedBy,
        timestamp: new Date().toISOString(),
      }]);
    if (error) throw error;
  } catch (error) {
    console.error('Error adding audit log:', error);
  }
};

export const getAuditLogs = async (userProfile?: CreatorProfile | null): Promise<AuditLog[]> => {
  try {
    const profile = userProfile !== undefined ? userProfile : getStoredCreatorProfile();
    const isAdmin = isSuperAdminOrAdminProfile(profile);

    // If caller is regular user or guest, restrict access to audit logs
    const isStaff = profile && (
      profile.role === 'SUPER_ADMIN' ||
      profile.role === 'ADMIN' ||
      profile.role === 'CREATOR' ||
      profile.role === 'TREASURER' ||
      profile.role === 'ACCOUNTANT' ||
      profile.role === 'MODERATOR' ||
      profile.isAdmin
    );

    if (!isStaff) {
      return [];
    }

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    // If not super admin, only fetch logs performed by this user
    if (!isAdmin && profile?.phone) {
      query = query.ilike('performedBy', `%${profile.phone}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};
