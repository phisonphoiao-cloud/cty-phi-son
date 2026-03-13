import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, Printer, Download, FileText, ChevronLeft, 
  Image as ImageIcon, FileSpreadsheet, History, BarChart3, 
  Save, Search, User, Phone, MapPin, Calendar, Edit2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceData, InvoiceItem, SavedInvoice, Customer, CustomerStats } from './types';
import * as XLSX from 'xlsx';
import { toJpeg } from 'html-to-image';

const INITIAL_ITEM: InvoiceItem = {
  id: Math.random().toString(36).substr(2, 9),
  shirtType: '',
  color: '',
  sizes: '',
  quantity: 0,
  unitPrice: 0,
};

const INITIAL_INVOICE: InvoiceData = {
  customerName: '',
  address: '',
  phone: '',
  date: new Date().toISOString().split('T')[0],
  items: [{ ...INITIAL_ITEM }],
};

type Tab = 'create' | 'history' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [invoice, setInvoice] = useState<InvoiceData>({ ...INITIAL_INVOICE });
  const [isPreview, setIsPreview] = useState(false);
  const [history, setHistory] = useState<SavedInvoice[]>([]);
  const [stats, setStats] = useState<CustomerStats[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Fetch history when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const fetchStats = async () => {
    try {
      const url = new URL('/api/stats/customers', window.location.origin);
      if (dateRange.startDate) url.searchParams.append('startDate', dateRange.startDate);
      if (dateRange.endDate) url.searchParams.append('endDate', dateRange.endDate);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const searchCustomers = async (q: string) => {
    if (!q) {
      setCustomers([]);
      return;
    }
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to search customers", err);
    }
  };

  const saveInvoice = async () => {
    if (!invoice.customerName) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      const data = await res.json();
      if (data.success) {
        setInvoice(prev => ({ ...prev, id: data.id }));
        alert("Đã lưu hoá đơn thành công!");
        if (activeTab === 'create') {
            // Optional: clear form or stay to print
        }
      }
    } catch (err) {
      console.error("Failed to save invoice", err);
      alert("Lỗi khi lưu hoá đơn");
    } finally {
      setIsSaving(false);
    }
  };

  const editInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      setInvoice({
        id: data.id,
        customerName: data.customerName,
        address: data.customerAddress,
        phone: data.customerPhone,
        date: data.date,
        items: data.items,
      });
      setActiveTab('create');
      setIsPreview(false);
    } catch (err) {
      console.error("Failed to load invoice", err);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá hoá đơn này?")) return;
    try {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete invoice", err);
    }
  };

  const addItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { ...INITIAL_ITEM, id: Math.random().toString(36).substr(2, 9) }],
    }));
  };

  const removeItem = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const totalQuantity = useMemo(() => {
    return invoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [invoice.items]);

  const totalPrice = useMemo(() => {
    return invoice.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);
  }, [invoice.items]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    const data = invoice.items.map((item, index) => ({
      'TT': index + 1,
      'Tên Hàng': `${item.shirtType} ${item.color} ${item.sizes}`,
      'Số Lượng': item.quantity,
      'Đơn Giá': item.unitPrice,
      'Thành Tiền': item.quantity * item.unitPrice,
    }));

    data.push({
      'TT': 'TỔNG CỘNG',
      'Tên Hàng': '',
      'Số Lượng': totalQuantity,
      'Đơn Giá': 0,
      'Thành Tiền': totalPrice,
    } as any);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoá đơn');
    XLSX.writeFile(wb, `HoaDon_${invoice.customerName || 'KhachHang'}.xlsx`);
  };

  const exportToImage = async () => {
    if (invoiceRef.current === null) return;
    try {
      const dataUrl = await toJpeg(invoiceRef.current, { 
        cacheBust: true, 
        backgroundColor: '#fff',
        pixelRatio: 3,
        quality: 0.95,
      });
      const link = document.createElement('a');
      link.download = `HoaDon_${invoice.customerName || 'KhachHang'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('oops, something went wrong!', err);
    }
  };

  const selectCustomer = (c: Customer) => {
    setInvoice(prev => ({
      ...prev,
      customerName: c.name,
      phone: c.phone,
      address: c.address
    }));
    setShowCustomerSuggestions(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="text-white" size={20} />
              </div>
              <span className="font-bold text-xl text-slate-800 hidden sm:block">Phi Sơn Invoice</span>
            </div>
            <div className="flex gap-1 sm:gap-4">
              <button 
                onClick={() => { setActiveTab('create'); setIsPreview(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${activeTab === 'create' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Plus size={18} /> <span className="hidden md:inline">Tạo mới</span>
              </button>
              <button 
                onClick={() => { setActiveTab('history'); setIsPreview(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <History size={18} /> <span className="hidden md:inline">Lịch sử</span>
              </button>
              <button 
                onClick={() => { setActiveTab('stats'); setIsPreview(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${activeTab === 'stats' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <BarChart3 size={18} /> <span className="hidden md:inline">Thống kê</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {!isPreview ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800">Tạo hoá đơn mới</h1>
                      <p className="text-slate-500">Nhập thông tin khách hàng và hàng hoá bên dưới</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => { setInvoice({ ...INITIAL_INVOICE, date: new Date().toISOString().split('T')[0] }); setIsPreview(false); }}
                        className="flex-1 md:flex-none px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Làm mới
                      </button>
                      <button
                        onClick={saveInvoice}
                        disabled={isSaving}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
                      >
                        <Save size={18} /> {isSaving ? 'Đang lưu...' : 'Lưu hoá đơn'}
                      </button>
                      <button
                        onClick={() => setIsPreview(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                      >
                        Xem & In <Printer size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                      <div className="space-y-5">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold border-b border-blue-100 pb-2">
                          <User size={18} /> <span>Thông tin khách hàng</span>
                        </div>
                        <div className="relative">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tên khách hàng hoặc SĐT</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={invoice.customerName}
                              onChange={(e) => {
                                setInvoice({ ...invoice, customerName: e.target.value });
                                searchCustomers(e.target.value);
                                setShowCustomerSuggestions(true);
                              }}
                              onFocus={() => setShowCustomerSuggestions(true)}
                              placeholder="Nhập tên hoặc số điện thoại..."
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          </div>
                          
                          {showCustomerSuggestions && customers.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                              {customers.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => selectCustomer(c)}
                                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                                >
                                  <div className="font-semibold text-slate-800">{c.name}</div>
                                  <div className="text-sm text-slate-500 flex items-center gap-3">
                                    <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                                    <span className="flex items-center gap-1"><MapPin size={12} /> {c.address}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Số điện thoại</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={invoice.phone}
                                onChange={(e) => setInvoice({ ...invoice, phone: e.target.value })}
                                placeholder="09xx..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                              />
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ngày lập</label>
                            <div className="relative">
                              <input
                                type="date"
                                value={invoice.date}
                                onChange={(e) => setInvoice({ ...invoice, date: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                              />
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Địa chỉ</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={invoice.address}
                              onChange={(e) => setInvoice({ ...invoice, address: e.target.value })}
                              placeholder="Địa chỉ giao hàng..."
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-2xl p-6 flex flex-col justify-center items-center text-center border border-blue-100">
                        <div className="text-blue-600 mb-2">
                          <FileText size={48} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Tổng quan hoá đơn</h3>
                        <p className="text-slate-500 text-sm mb-4">Tự động tính toán khi bạn thêm hàng</p>
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="bg-white p-3 rounded-xl shadow-sm">
                            <div className="text-xs text-slate-400 uppercase font-bold">Số lượng</div>
                            <div className="text-xl font-bold text-slate-800">{totalQuantity}</div>
                          </div>
                          <div className="bg-white p-3 rounded-xl shadow-sm">
                            <div className="text-xs text-slate-400 uppercase font-bold">Thành tiền</div>
                            <div className="text-xl font-bold text-blue-600">{formatCurrency(totalPrice)}</div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h2 className="text-lg font-bold text-slate-800">Danh sách hàng hoá</h2>
                        <button
                          onClick={addItem}
                          className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                        >
                          <Plus size={18} /> Thêm hàng
                        </button>
                      </div>

                      <div className="overflow-x-auto -mx-6 md:mx-0">
                        <table className="w-full text-left min-w-[800px]">
                          <thead>
                            <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                              <th className="px-4 pb-4 w-12 text-center">TT</th>
                              <th className="px-4 pb-4">Loại áo</th>
                              <th className="px-4 pb-4">Màu</th>
                              <th className="px-4 pb-4">Size (VD: 1 s 2 m)</th>
                              <th className="px-4 pb-4 w-24">SL</th>
                              <th className="px-4 pb-4 w-32">Đơn giá</th>
                              <th className="px-4 pb-4 w-32 text-right">Thành tiền</th>
                              <th className="px-4 pb-4 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {invoice.items.map((item, index) => (
                              <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-center text-slate-400 font-mono text-sm">
                                  {index + 1}
                                </td>
                                <td className="p-4">
                                  <input
                                    type="text"
                                    value={item.shirtType}
                                    onChange={(e) => updateItem(item.id, 'shirtType', e.target.value)}
                                    placeholder="Boxy"
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800 font-medium"
                                  />
                                </td>
                                <td className="p-4">
                                  <input
                                    type="text"
                                    value={item.color}
                                    onChange={(e) => updateItem(item.id, 'color', e.target.value)}
                                    placeholder="Trắng"
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800"
                                  />
                                </td>
                                <td className="p-4">
                                  <input
                                    type="text"
                                    value={item.sizes}
                                    onChange={(e) => updateItem(item.id, 'sizes', e.target.value)}
                                    placeholder="1 s 1 m"
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800"
                                  />
                                </td>
                                <td className="p-4">
                                  <input
                                    type="number"
                                    value={item.quantity || ''}
                                    onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800 font-bold"
                                  />
                                </td>
                                <td className="p-4">
                                  <input
                                    type="number"
                                    value={item.unitPrice || ''}
                                    onChange={(e) => updateItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800"
                                  />
                                </td>
                                <td className="p-4 text-right font-bold text-slate-900">
                                  {formatCurrency(item.quantity * item.unitPrice)}
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow-2xl print-area overflow-hidden relative rounded-xl">
                   {/* Preview Header (Screen only) */}
                  <div className="no-print bg-slate-800 text-white p-4 flex justify-between items-center">
                    <button 
                      onClick={() => setIsPreview(false)}
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={20} /> Quay lại chỉnh sửa
                    </button>
                    <div className="flex gap-3">
                      <button onClick={exportToExcel} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Xuất Excel">
                        <FileSpreadsheet size={20} />
                      </button>
                      <button onClick={exportToImage} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Lưu ảnh">
                        <ImageIcon size={20} />
                      </button>
                      <button onClick={handlePrint} className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <Printer size={18} /> In ngay
                      </button>
                    </div>
                  </div>

                  <div ref={invoiceRef} className="p-10 font-serif text-black leading-tight bg-white text-lg">
                    {/* Header Section */}
                    <div className="grid grid-cols-2 border-b-2 border-black pb-4 mb-6">
                      <div>
                        <h2 className="text-red-600 font-bold text-3xl uppercase tracking-tight">
                          TỔNG KHO PHÔI ÁO PHI SƠN
                        </h2>
                        <div className="text-base mt-2 space-y-1">
                          <p className="font-bold uppercase">CTY DỆT MAY PHI SƠN</p>
                          <p className="font-bold">Địa chỉ: 169 đường K2, Phú Đô, Nam Từ Liêm, Hà Nội</p>
                          <p className="font-bold uppercase">SĐT: 0877918706</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h1 className="text-4xl font-bold uppercase mb-2">HÓA ĐƠN BÁN HÀNG</h1>
                        <div className="text-base space-y-1">
                          <p className="font-bold uppercase">SỐ TÀI KHOẢN : 9699 6588 888</p>
                          <p className="font-bold">Ngân Hàng Techcombank</p>
                          <p className="font-bold">CTK: Phùng Thị Thuỳ Linh</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info Section */}
                    <div className="text-xl mb-6 space-y-1">
                      <p><span className="font-bold">Tên khách hàng:</span> <span>{invoice.customerName}</span></p>
                      <p><span className="font-bold">Địa chỉ:</span> <span>{invoice.address}</span></p>
                      <p><span className="font-bold">Sđt:</span> <span>{invoice.phone}</span></p>
                    </div>

                    {/* Table Section */}
                    <table className="w-full border-collapse border-2 border-black text-xl">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border-2 border-black px-2 py-2 w-12 uppercase font-bold text-center">TT</th>
                          <th className="border-2 border-black px-3 py-2 uppercase font-bold text-center">TÊN HÀNG</th>
                          <th className="border-2 border-black px-3 py-2 w-32 uppercase font-bold text-center">SỐ LƯỢNG</th>
                          <th className="border-2 border-black px-3 py-2 w-40 uppercase font-bold text-center">ĐƠN GIÁ</th>
                          <th className="border-2 border-black px-3 py-2 w-44 uppercase font-bold text-center">THÀNH TIỀN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((item, index) => (
                          <tr key={item.id} className="h-12">
                            <td className="border-2 border-black text-center">{index + 1}</td>
                            <td className="border-2 border-black px-3">
                              {item.shirtType} {item.color} {item.sizes}
                            </td>
                            <td className="border-2 border-black text-center">{item.quantity || ''}</td>
                            <td className="border-2 border-black text-right px-3">{item.unitPrice ? formatCurrency(item.unitPrice) : ''}</td>
                            <td className="border-2 border-black text-right px-3 font-bold">
                              {item.quantity && item.unitPrice ? formatCurrency(item.quantity * item.unitPrice) : ''}
                            </td>
                          </tr>
                        ))}
                        <tr className="h-12 font-bold uppercase">
                          <td colSpan={2} className="border-2 border-black text-center">TỔNG CỘNG</td>
                          <td className="border-2 border-black text-center">{totalQuantity}</td>
                          <td className="border-2 border-black"></td>
                          <td className="border-2 border-black text-right px-3">{formatCurrency(totalPrice)}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Amount in words */}
                    <div className="mt-6 text-xl italic space-y-3">
                      <div className="flex items-end gap-2">
                        <span className="whitespace-nowrap">Thành tiền (viết bằng chữ):</span>
                        <div className="flex-grow border-b border-dotted border-black mb-1"></div>
                      </div>
                      <div className="w-full border-b border-dotted border-black h-1"></div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-12 grid grid-cols-2 text-center text-xl items-start">
                      <div className="flex flex-col items-center">
                        <div className="h-8 mb-1"></div> 
                        <p className="font-bold uppercase">KHÁCH HÀNG</p>
                        <p className="text-sm italic">(Ký, họ tên)</p>
                        <div className="h-24"></div>
                      </div>
                      <div className="flex flex-col items-center">
                        <p className="italic mb-1">Ngày {new Date(invoice.date).getDate()} tháng {new Date(invoice.date).getMonth() + 1} năm {new Date(invoice.date).getFullYear()}</p>
                        <p className="font-bold uppercase">NGƯỜI BÁN HÀNG</p>
                        <p className="text-sm italic">(Ký, họ tên)</p>
                        <div className="h-24"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Lịch sử hoá đơn</h1>
                  <p className="text-slate-500">Xem và quản lý các hoá đơn đã lưu</p>
                </div>
                <button onClick={fetchHistory} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                  <History size={20} />
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Ngày</th>
                        <th className="px-6 py-4">Khách hàng</th>
                        <th className="px-6 py-4">SĐT</th>
                        <th className="px-6 py-4 text-right">Số lượng</th>
                        <th className="px-6 py-4 text-right">Tổng tiền</th>
                        <th className="px-6 py-4 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                            Chưa có hoá đơn nào được lưu.
                          </td>
                        </tr>
                      ) : (
                        history.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-600 font-medium">
                              {new Date(inv.date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                              {inv.customerName}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {inv.customerPhone}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-700">
                              {inv.totalQuantity}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-blue-600">
                              {formatCurrency(inv.totalPrice)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-2">
                                <button 
                                  onClick={() => editInvoice(inv.id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Sửa"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => deleteInvoice(inv.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xoá"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Thống kê khách hàng</h1>
                  <p className="text-slate-500">Theo dõi doanh thu và số lượng theo khách hàng</p>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Từ ngày</label>
                    <input 
                      type="date" 
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Đến ngày</label>
                    <input 
                      type="date" 
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={fetchStats}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Lọc
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-1">Tổng khách hàng</div>
                  <div className="text-3xl font-bold text-slate-800">{stats.length}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-1">Tổng số lượng áo</div>
                  <div className="text-3xl font-bold text-emerald-600">
                    {stats.reduce((sum, s) => sum + s.totalQuantity, 0)}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-1">Tổng doanh thu</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(stats.reduce((sum, s) => sum + s.totalPrice, 0))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Khách hàng</th>
                        <th className="px-6 py-4">SĐT</th>
                        <th className="px-6 py-4 text-right">Số lượng đã lấy</th>
                        <th className="px-6 py-4 text-right">Tổng tiền đã lấy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                            Không có dữ liệu thống kê.
                          </td>
                        </tr>
                      ) : (
                        stats.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">
                              {s.name}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {s.phone}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-700">
                              {s.totalQuantity}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-blue-600">
                              {formatCurrency(s.totalPrice)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Click outside to close suggestions */}
      {showCustomerSuggestions && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setShowCustomerSuggestions(false)}
        />
      )}
    </div>
  );
}
