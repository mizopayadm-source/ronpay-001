/**
 * Utility functions for consistent DD/MM/YYYY date formatting across RonPay
 */

export function formatDateDDMMYYYY(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return '—';

      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (ddmmyyyyMatch) {
        const d = ddmmyyyyMatch[1].padStart(2, '0');
        const m = ddmmyyyyMatch[2].padStart(2, '0');
        const y = ddmmyyyyMatch[3];
        return `${d}/${m}/${y}`;
      }

      const yyyymmddMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (yyyymmddMatch) {
        const y = yyyymmddMatch[1];
        const m = yyyymmddMatch[2].padStart(2, '0');
        const d = yyyymmddMatch[3].padStart(2, '0');
        return `${d}/${m}/${y}`;
      }
    }

    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

export function formatDateTimeDDMMYYYY(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    if (typeof dateInput === 'string') {
      const match = dateInput.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        let hours = parseInt(match[4], 10);
        const minutes = match[5].padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = String(hours).padStart(2, '0');
        return `${d}/${m}/${y}, ${strHours}:${minutes} ${ampm}`;
      }

      const ddmmyyyyMatch = dateInput.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?/i);
      if (ddmmyyyyMatch && ddmmyyyyMatch[4]) {
        const d = ddmmyyyyMatch[1].padStart(2, '0');
        const m = ddmmyyyyMatch[2].padStart(2, '0');
        const y = ddmmyyyyMatch[3];
        const hr = ddmmyyyyMatch[4].padStart(2, '0');
        const min = ddmmyyyyMatch[5].padStart(2, '0');
        const ampm = ddmmyyyyMatch[6] ? ddmmyyyyMatch[6].toUpperCase() : '';
        return `${d}/${m}/${y}, ${hr}:${min}${ampm ? ` ${ampm}` : ''}`;
      }
    }

    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return String(dateInput);
  }
}
