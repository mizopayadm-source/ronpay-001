import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/auditService';
import { AuditLog } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/date';

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await getAuditLogs();
      setLogs(data);
    };
    fetchLogs();
  }, []);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
      <h3 className="text-sm font-black text-slate-800 mb-4">Audit Logs</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Action</th>
              <th className="p-2">Target</th>
              <th className="p-2">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="p-2 font-mono text-slate-500">{formatDateTimeDDMMYYYY(log.timestamp)}</td>
                <td className="p-2 font-bold text-slate-800 uppercase">{log.action}</td>
                <td className="p-2 text-slate-600">{log.targetType} ({log.targetId})</td>
                <td className="p-2 text-indigo-700 font-bold">{log.performedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
