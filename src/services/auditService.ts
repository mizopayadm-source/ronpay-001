import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';

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

export const getAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};
