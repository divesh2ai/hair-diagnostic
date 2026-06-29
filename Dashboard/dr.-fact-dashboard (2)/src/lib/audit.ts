import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export const createAuditLog = async (
  profile: UserProfile,
  action: string,
  entity: string,
  entityId: string | undefined,
  details: string
) => {
  try {
    const logsRef = collection(db, 'audit_logs');
    await addDoc(logsRef, {
      userId: profile.uid,
      userName: profile.displayName || 'Anonymous',
      userRole: profile.role,
      clinicId: profile.clinicId || 'global',
      action,
      entity,
      entityId,
      details,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};
