export type PaymentStatus = 'paid' | 'pending' | 'partial';

export interface BawmItem {
  id: string;
  name: string; // e.g. "BCM Ebenezer", "YMA Chhiatni Fund"
  category: 'Church' | 'YMA' | 'KTP' | 'Village' | 'School' | 'Sports' | 'Other';
  description: string;
  upiId: string;
  targetAmount: number;
  sections: string[];
  createdAt: string;
  creatorName: string;
  colorTheme: string;
}

export interface MemberRollItem {
  id: string;
  memberId: string; // e.g. "BCM-001", "YMA-101"
  name: string;
  bawmId: string; // References BawmItem.id for strict isolation
  section: string; // e.g. "Section A", "Section B", "Veng Lai"
  phone: string;
  pledgeAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  paymentDate?: string;
  paymentMethod?: 'UPI QR' | 'Cash' | 'Bank Transfer';
  transactionRef?: string;
  remarks?: string;
  updatedAt: string;
}

export interface FilterOptions {
  selectedBawmId: string; // 'all' or specific Bawm id
  searchQuery: string;
  status: 'all' | PaymentStatus;
  section: string;
  sortBy: 'name' | 'id' | 'amount' | 'status' | 'date';
  sortOrder: 'asc' | 'desc';
}
