export interface InvoiceItem {
  id: string;
  shirtType: string;
  color: string;
  sizes: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  id?: string;
  customerName: string;
  address: string;
  phone: string;
  date: string;
  items: InvoiceItem[];
}

export interface SavedInvoice extends InvoiceData {
  id: string;
  customerPhone: string;
  totalQuantity: number;
  totalPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface CustomerStats {
  name: string;
  phone: string;
  totalQuantity: number;
  totalPrice: number;
}
