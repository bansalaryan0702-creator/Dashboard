import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import AutocompleteInput from './AutocompleteInput';

type OrderItem = {
  id: string;
  productName: string;
  description: string;
  vendorName: string;
  quantity: number | '';
  price: number | '';
};

type Ticket = {
  id: string;
  customerName: string;
  purchaseOrderNumber?: string;
  requesterName?: string;
  requesterPhone?: string;
  ticketDate: string;
  handoverDate: string;
  items: Array<{ id: string, productName: string, description?: string, vendorName?: string, quantity: number, price: number }>;
  employeeId: string;
  employeeName: string;
  status?: "pending" | "done";
  delayReason?: string;
  newHandoverDate?: string;
};

type EditTicketModalProps = {
  ticket: Ticket;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditTicketModal({ ticket, onClose, onSuccess }: EditTicketModalProps) {
  const [customerName, setCustomerName] = useState(ticket.customerName || '');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(ticket.purchaseOrderNumber || '');
  const [requesterName, setRequesterName] = useState(ticket.requesterName || '');
  const [requesterPhone, setRequesterPhone] = useState(ticket.requesterPhone || '');
  const [handoverDate, setHandoverDate] = useState(ticket.handoverDate || '');
  const [items, setItems] = useState<OrderItem[]>(
    ticket.items.map(i => ({ ...i, id: i.id || uuidv4(), description: i.description || '', vendorName: i.vendorName || '' }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [productsList, setProductsList] = useState<string[]>([]);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [vendorsList, setVendorsList] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchVendors();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const text = await res.text();
        if (text) setProductsList(JSON.parse(text));
      }
    } catch {}
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const text = await res.text();
        if (text) setCustomersList(JSON.parse(text));
      }
    } catch {}
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const text = await res.text();
        if (text) setVendorsList(JSON.parse(text));
      }
    } catch {}
  };

  const addItem = () => {
    const newId = uuidv4();
    setItems([...items, { id: newId, productName: '', description: '', vendorName: '', quantity: 1, price: 0 }]);
    setTimeout(() => document.getElementById(`product-${newId}`)?.focus(), 50);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.defaultPrevented) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
      if (target.getAttribute('type') === 'submit') return;
      
      e.preventDefault();
      const form = target.closest('form');
      if (!form) return;
      
      const focusable = Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea, button[type="submit"]'))
        .filter(el => !el.hidden && !(el as any).disabled && el.tabIndex !== -1);
      
      const index = focusable.indexOf(target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    } else if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return;
      
      e.preventDefault();
      const form = target.closest('form');
      if (!form) return;
      
      const focusable = Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea, button[type="submit"]'))
        .filter(el => !el.hidden && !(el as any).disabled && el.tabIndex !== -1);
      
      const index = focusable.indexOf(target);
      if (index > 0) {
        focusable[index - 1].focus();
      }
    }
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleBlur = async (type: 'product' | 'vendor' | 'customer', value: string) => {
    const cleanName = value.trim();
    if (!cleanName) return;

    try {
      if (type === 'product' && !productsList.some(p => p.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setProductsList(prev => [...prev, cleanName]);
      } else if (type === 'vendor' && !vendorsList.some(v => v.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setVendorsList(prev => [...prev, cleanName]);
      } else if (type === 'customer' && !customersList.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setCustomersList(prev => [...prev, cleanName]);
      }
    } catch (err) {
      console.error(`Failed to dynamically add ${type}`, err);
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const ticketPayload = {
      customerName,
      purchaseOrderNumber,
      requesterName,
      requesterPhone,
      handoverDate,
      items: items.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      }))
    };

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketPayload),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const text = await res.text();
        setErrorMsg(text || 'Failed to update ticket');
      }
    } catch (error: any) {
      console.error("Failed to update ticket", error);
      setErrorMsg(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-full flex flex-col my-8">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Edit Ticket</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          <form id="edit-ticket-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Company Name</label>
                <AutocompleteInput
                  value={customerName}
                  onChange={setCustomerName}
                  options={customersList}
                  placeholder="e.g. Acme Corp"
                  onBlur={() => handleBlur('customer', customerName)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order Number</label>
                <input
                  type="text"
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Name</label>
                <input
                  type="text"
                  required
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Phone Number</label>
                <input
                  type="tel"
                  required
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Order Items</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 p-3 hidden md:grid">
                  <div className="col-span-6">Product & Description</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-3">Price</div>
                  <div className="col-span-1 text-center">Act</div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={item.id} className="p-3 border-b last:border-b-0 border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start md:items-center">
                        <div className="col-span-1 md:col-span-6 space-y-2">
                          <label className="text-xs text-gray-500 block md:hidden">Product Name</label>
                          <AutocompleteInput
                            id={`product-${item.id}`}
                            value={item.productName}
                            onChange={(val) => updateItem(item.id, 'productName', val)}
                            options={productsList}
                            placeholder="Product name"
                            onBlur={() => handleBlur('product', item.productName)}
                            required
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-xs"
                              placeholder="Description/notes (opt)"
                            />
                            <AutocompleteInput
                              value={item.vendorName}
                              onChange={(val) => updateItem(item.id, 'vendorName', val)}
                              options={vendorsList}
                              placeholder="Vendor (opt)"
                              onBlur={() => handleBlur('vendor', item.vendorName)}
                              className="text-xs"
                            />
                          </div>
                        </div>
                        
                        <div className="col-span-1 md:col-span-2">
                          <label className="text-xs text-gray-500 block md:hidden">Quantity</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        
                        <div className="col-span-1 md:col-span-3">
                          <label className="text-xs text-gray-500 block md:hidden">Price</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-gray-500 text-sm">₹</span>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addItem();
                                }
                              }}
                              className="w-full pl-6 pr-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded-full hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Handover / Delivery Date</label>
              <input
                type="date"
                required
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                className="w-full md:w-1/3 px-4 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-ticket-form"
            disabled={submitting || items.length === 0}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
          >
            {submitting ? 'Updating...' : 'Update Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
