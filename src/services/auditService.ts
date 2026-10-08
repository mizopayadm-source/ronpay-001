import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { AuditLog } from '../types';

export const addAuditLog = async (
  action: string,
  details: string,
  targetType: AuditLog['targetType'],
  targetId: string,
  performedBy: string
): Promise<void> => {
  try {
    const auditLogsCollection = collection(db, 'audit_logs');
    await addDoc(auditLogsCollection, {
      action,
      details,
      targetType,
      targetId,
      performedBy,
      timestamp: Timestamp.now().toISOString(),
    });
  } catch (error) {
    console.error('Error adding audit log:', error);
  }
};

export const getAuditLogs = async (
  targetType?: AuditLog['targetType'],
  targetId?: string
): Promise<AuditLog[]> => {
  try {
    let q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
    
    // Simplification for filtering, could be expanded to compound queries
    if (targetType) {
      q = query(collection(db, 'audit_logs'), where('targetType', '==', targetType), orderBy('timestamp', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};
