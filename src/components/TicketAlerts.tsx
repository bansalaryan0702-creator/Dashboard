import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';

type Ticket = {
  id: string;
  customerName: string;
  handoverDate: string;
  employeeId: string;
};

export default function TicketAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Ticket[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load dismissed alerts from sessionStorage so they don't pop up on every navigation
    const dismissedStore = sessionStorage.getItem('dismissedAlerts');
    if (dismissedStore) {
      setDismissed(new Set(JSON.parse(dismissedStore)));
    }

    const checkDueTickets = async () => {
      let retryTimeoutId: any = null;
      try {
        const res = await fetch('/api/tickets');
        if (!res.ok) {
          console.warn(`Tickets check returned status ${res.status}`);
          return;
        }
        const text = await res.text();
        let allTickets: Ticket[] = [];
        try {
          if (text && !text.trim().startsWith('<')) {
            allTickets = JSON.parse(text);
          } else {
            console.warn("Backend API is warming up or returned HTML. Retrying ticket check in 5 seconds...");
            retryTimeoutId = setTimeout(checkDueTickets, 5000);
            return;
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON, warming up. Retrying ticket check in 5 seconds...", e);
          retryTimeoutId = setTimeout(checkDueTickets, 5000);
          return;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueTickets = allTickets.filter(t => {
          if (!t.handoverDate) return false;
          const hDate = parseISO(t.handoverDate);
          hDate.setHours(0, 0, 0, 0);
          
          // It's due if the handover date is today or in the past
          const isDue = hDate <= today;
          
          if (!isDue) return false;

          // For admin and manager, notify for all. For employee, notify only for their tickets
          if (user?.role === 'admin' || user?.role === 'manager') return true;
          return t.employeeId === user?.id; // Assuming user.id matches employeeId
        });
        
        setAlerts(dueTickets);
      } catch (err) {
        console.warn("Failed to check due tickets (server may be restarting). Retrying ticket check in 5 seconds...", err);
        retryTimeoutId = setTimeout(checkDueTickets, 5000);
      }
    };

    checkDueTickets();
    // Check periodically (every 5 mins)
    const interval = setInterval(checkDueTickets, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const displayedAlerts = alerts.filter(a => !dismissed.has(a.id));

  const dismissAlert = (id: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(id);
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissedAlerts', JSON.stringify(Array.from(newDismissed)));
  };

  const dismissAll = () => {
    const newDismissed = new Set(dismissed);
    alerts.forEach(a => newDismissed.add(a.id));
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissedAlerts', JSON.stringify(Array.from(newDismissed)));
  };

  if (displayedAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {displayedAlerts.length > 1 && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex justify-between items-center text-sm font-medium">
          <span>{displayedAlerts.length} tickets are due!</span>
          <button onClick={dismissAll} className="hover:bg-blue-700 px-2 py-1 rounded text-xs transition">Dismiss All</button>
        </div>
      )}
      
      <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1">
        {displayedAlerts.slice(0, 3).map(ticket => (
          <div key={ticket.id} className="bg-white border-l-4 border-red-500 rounded-lg shadow-lg p-4 flex gap-3 relative animate-in slide-in-from-right-4">
            <div className="text-red-500 flex-shrink-0 mt-0.5">
              <Bell className="h-5 w-5" />
            </div>
            <div className="pr-4">
              <h4 className="text-sm font-bold text-gray-900">Task Due Notification</h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Ticket for <span className="font-semibold text-gray-800">{ticket.customerName || 'Unknown Company'}</span> is due for handover on <span className="font-medium text-red-600">{format(parseISO(ticket.handoverDate), 'MMM d, yyyy')}</span>.
              </p>
            </div>
            <button 
              onClick={() => dismissAlert(ticket.id)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {displayedAlerts.length > 3 && (
          <div className="text-center text-xs text-gray-500 font-medium py-1">
            + {displayedAlerts.length - 3} more alerts...
          </div>
        )}
      </div>
    </div>
  );
}
