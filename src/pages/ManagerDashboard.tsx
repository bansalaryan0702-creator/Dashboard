import { Link } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { format, isToday, parseISO } from 'date-fns';
import { LogOut, CalendarDays, Search, Edit, Trash2, Download } from 'lucide-react';
import PrintFieldLogo from '../components/PrintFieldLogo';
import EditTicketModal from '../components/EditTicketModal';
import { downloadTicketPdf } from '../utils/generatePdf';

type Ticket = {
  id: string;
  ticketNumber?: number;
  customerName: string;
  purchaseOrderNumber?: string;
  requesterName?: string;
  requesterPhone?: string;
  ticketDate: string;
  handoverDate: string;
  items: Array<{ id: string, productName: string, description?: string, vendorName?: string, quantity: number, price: number, gstRate?: number }>;
  employeeId: string;
  employeeName: string;
  status?: "pending" | "done";
  delayReason?: string;
  newHandoverDate?: string;
};

export default function ManagerDashboard() {
  const { logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const [delayModalTicket, setDelayModalTicket] = useState<Ticket | null>(null);
  const [delayReason, setDelayReason] = useState('');
  const [newHandoverDate, setNewHandoverDate] = useState('');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const ticketsRes = await fetch('/api/tickets');
      if (ticketsRes.ok) {
        const ticketsText = await ticketsRes.text();
        try {
          if (ticketsText && !ticketsText.trim().startsWith('<')) {
            setTickets(JSON.parse(ticketsText));
          } else {
            console.warn("Backend returned HTML instead of JSON for tickets.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for tickets.", e);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch data:", e);
    }
  };

  // Generate Daily Job Summary
  const todayTickets = tickets.filter(t => isToday(parseISO(t.ticketDate)));
  
  const dailySummaryByEmployee = todayTickets.reduce((acc, ticket) => {
    if (!acc[ticket.employeeName]) {
      acc[ticket.employeeName] = { jobs: 0, itemsCount: 0 };
    }
    acc[ticket.employeeName].jobs += 1;
    acc[ticket.employeeName].itemsCount += ticket.items.reduce((sum, item) => sum + item.quantity, 0);
    return acc;
  }, {} as Record<string, { jobs: number, itemsCount: number }>);

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    const term = search.toLowerCase();
    const matchText = 
      String(t.customerName || '').toLowerCase().includes(term) ||
      String(t.employeeName || '').toLowerCase().includes(term) ||
      String(t.requesterName || '').toLowerCase().includes(term) ||
      String(t.purchaseOrderNumber || '').toLowerCase().includes(term) ||
      t.items.some(i => String(i.productName || '').toLowerCase().includes(term));
      
    // Match date if selected (checks both handoverDate and ticketDate)
    const matchDate = searchDate 
      ? (t.newHandoverDate === searchDate || t.handoverDate === searchDate) || t.ticketDate.startsWith(searchDate)
      : true;
      
    return matchText && matchDate;
  });

  const handleUpdateTicketStatus = async (ticketId: string, status: "pending" | "done") => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to update ticket status", e);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to delete ticket", e);
    }
  };

  const handleDelayTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModalTicket || !delayReason || !newHandoverDate) return;

    try {
      const res = await fetch(`/api/tickets/${delayModalTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayReason, newHandoverDate })
      });
      if (res.ok) {
        setDelayModalTicket(null);
        setDelayReason('');
        setNewHandoverDate('');
        fetchData();
      }
    } catch (e) {
      console.error("Failed to update ticket delay info", e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow z-10 sticky top-0 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center">
            <PrintFieldLogo layout="horizontal" iconSize="md" />
            <span className="ml-3.5 bg-indigo-50 text-[#2D1F66] text-[10px] px-2.5 py-1 rounded-md font-semibold font-mono tracking-wider border border-indigo-100">
              MANAGER PORTAL
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
              Manager
            </span>
            <button
              onClick={logout}
              className="flex items-center text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN: Summary */}
          <div className="space-y-8 lg:col-span-1">
            {/* Daily Jobs Summary */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2 text-indigo-500" />
                  Today's Summary
                </h2>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                  {format(new Date(), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="p-5">
                {Object.keys(dailySummaryByEmployee).length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">No jobs completed today.</p>
                ) : (
                  <ul className="space-y-3">
                    {Object.entries(dailySummaryByEmployee).map(([name, stats]) => (
                      <li key={name} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-medium text-gray-800">{name}</span>
                        <div className="text-right text-gray-600 text-xs">
                          <span className="font-semibold text-gray-900">{stats.jobs}</span> jobs <br/>
                          <span className="font-semibold text-gray-900">{stats.itemsCount}</span> items
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Global History Log */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col h-[800px]">
            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Global History Log</h2>
                <p className="text-xs text-gray-500 mt-0.5">Filter and search tickets raised by system employees</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search company, employee, requester, PO..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 placeholder-gray-500 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="relative sm:w-44">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    title="Filter by Ticket Date or Handover Date"
                  />
                </div>
                {(search || searchDate) && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSearchDate('');
                    }}
                    className="px-3 py-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg font-medium transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-5">
              {filteredTickets.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  No tickets found.
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredTickets.slice().reverse().map(ticket => (
                    <div key={ticket.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Ticket Header */}
                      <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap gap-4 justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <span className="text-gray-500">#{ticket.ticketNumber || ticket.id.substring(0, 6)}</span>
                            {ticket.customerName || <span className="italic text-gray-400">No Company Name</span>}
                            {ticket.purchaseOrderNumber && (
                              <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded">PO: {ticket.purchaseOrderNumber}</span>
                            )}
                            {ticket.status === 'done' ? (
                              <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Done</span>
                            ) : (
                              <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">Pending</span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Raised by: <span className="font-medium text-gray-700">{ticket.employeeName}</span> on {format(parseISO(ticket.ticketDate), 'MMM d, yyyy h:mm a')}
                          </p>
                          {(ticket.requesterName || ticket.requesterPhone) && (
                            <p className="text-xs text-gray-500 mt-1">
                              Requested by: <span className="font-medium text-gray-700">{ticket.requesterName}</span> {ticket.requesterPhone && `(${ticket.requesterPhone})`}
                            </p>
                          )}
                          {ticket.delayReason && (
                            <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded border border-red-100">
                              <span className="font-semibold block">Delayed:</span> {ticket.delayReason}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Handover Date</span>
                            {ticket.newHandoverDate ? (
                              <div>
                                <span className="text-xs line-through text-gray-400 mr-2">{format(parseISO(ticket.handoverDate), 'MMM d, yyyy')}</span>
                                <span className="text-sm font-semibold text-red-600">{format(parseISO(ticket.newHandoverDate), 'MMM d, yyyy')}</span>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-blue-600">
                                {ticket.handoverDate ? format(parseISO(ticket.handoverDate), 'MMM d, yyyy') : 'No Date'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => downloadTicketPdf(ticket)}
                              className="px-2 py-1 bg-white text-gray-600 border border-gray-300 hover:text-green-600 hover:border-green-400 rounded text-xs font-medium transition-colors flex items-center gap-1"
                              title="Download as PDF"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </button>
                            {ticket.status !== 'done' ? (
                              <button
                                onClick={() => handleUpdateTicketStatus(ticket.id, 'done')}
                                className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded text-xs font-medium transition-colors"
                              >
                                Mark as Done
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateTicketStatus(ticket.id, 'pending')}
                                className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded text-xs font-medium transition-colors"
                              >
                                Mark as Undone
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingTicket(ticket);
                              }}
                              className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => {
                                setDelayModalTicket(ticket);
                                setDelayReason(ticket.delayReason || '');
                                setNewHandoverDate(ticket.newHandoverDate || ticket.handoverDate);
                              }}
                              className="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 rounded text-xs font-medium transition-colors"
                            >
                              Delay
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="px-2 py-1 bg-gray-50 text-red-600 border border-gray-200 hover:bg-red-50 hover:border-red-200 rounded text-xs font-medium transition-colors flex items-center gap-1"
                              title="Delete Ticket"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Ticket Items */}
                      <div className="px-4 py-3 bg-white">
                        <table className="min-w-full divide-y divide-gray-200 text-sm mt-1">
                          <thead>
                            <tr>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {ticket.items.map((item, i) => (
                              <tr key={i}>
                                <td className="px-2 py-2 whitespace-normal text-gray-800 font-medium">
                                  {item.productName}
                                  {(item.description || item.vendorName) && (
                                    <div className="text-xs text-gray-500 font-normal mt-1 space-y-0.5">
                                      {item.description && <span className="block">{item.description}</span>}
                                      {item.vendorName && <span className="block text-indigo-500">Outsourced: {item.vendorName}</span>}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-center text-gray-600 align-top">{item.quantity}</td>
                                <td className="px-2 py-2 whitespace-nowrap text-right text-gray-600 align-top">₹{Number(item.price).toFixed(2)}</td>
                                <td className="px-2 py-2 whitespace-nowrap text-right text-gray-600 align-top">{item.gstRate || 5}%</td>
                                <td className="px-2 py-2 whitespace-nowrap text-right text-gray-800 font-medium align-top">₹{(item.quantity * Number(item.price) * (1 + (item.gstRate || 5) / 100)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                               <td colSpan={4} className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</td>
                               <td className="px-2 py-3 whitespace-nowrap text-right text-sm font-bold text-gray-900 border-t border-gray-200">
                                 ₹{ticket.items.reduce((sum, item) => sum + (item.quantity * Number(item.price) * (1 + (item.gstRate || 5) / 100)), 0).toFixed(2)}
                               </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Delay Modal */}
      {delayModalTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Delay Order</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason and new handover date for {delayModalTicket.customerName}.</p>
            <form onSubmit={handleDelayTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delay Reason</label>
                <textarea
                  required
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                  placeholder="Why is it delayed?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Handover Date</label>
                <input
                  type="date"
                  required
                  value={newHandoverDate}
                  onChange={(e) => setNewHandoverDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDelayModalTicket(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <EditTicketModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSuccess={() => {
            setEditingTicket(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
