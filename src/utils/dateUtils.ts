/**
 * Utility functions for consistent DD/MM/YYYY date formatting across RonPay
 */

export function formatDateDDMMYYYY(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'DD/MM/YYYY';
  try {
    const d = new Date(dateInput);
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
  if (!dateInput) return 'DD/MM/YYYY --:--';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}
