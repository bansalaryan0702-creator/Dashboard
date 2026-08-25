import React, { useState, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { format, parseISO } from "date-fns";

export type ReminderItem = {
  id: string;
  type: "ticket" | "sample";
  title: string;
  customerName: string;
  dateLabel: string;
  dateValue: string;
  details: string;
};

export default function ReminderPopup({
  reminders,
}: {
  reminders: ReminderItem[];
}) {
  const [activeReminders, setActiveReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    const checkReminders = () => {
      try {
        const dismissed = JSON.parse(
          localStorage.getItem("dismissed_reminders_time") || "{}"
        );
        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
        const now = Date.now();

        const pending = reminders.filter((r) => {
          const lastDismissed = dismissed[r.id];
          if (lastDismissed && (now - lastDismissed < THREE_HOURS_MS)) {
            return false;
          }
          return true;
        });

        // Sort so oldest/most overdue appear first, handle missing dates safely
        pending.sort((a, b) => {
          const aTime = a.dateValue ? new Date(a.dateValue).getTime() : Infinity;
          const bTime = b.dateValue ? new Date(b.dateValue).getTime() : Infinity;
          return aTime - bTime;
        });

        setActiveReminders(pending);
      } catch (e) {
        setActiveReminders(reminders);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [reminders]);

  if (activeReminders.length === 0) return null;

  const current = activeReminders[0];

  const handleDismiss = () => {
    try {
      const dismissed = JSON.parse(
        localStorage.getItem("dismissed_reminders_time") || "{}"
      );
      dismissed[current.id] = Date.now();
      localStorage.setItem(
        "dismissed_reminders_time",
        JSON.stringify(dismissed)
      );
    } catch (e) {}
    setActiveReminders((prev) => prev.slice(1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-white font-semibold">
            <Bell className="w-5 h-5 mr-2 animate-bounce" />
            Reminder ({activeReminders.length} remaining)
          </div>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <span
              className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mb-3 ${current.type === "ticket" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}
            >
              {current.type === "ticket" ? "Job Ticket" : "Sample Return"}
            </span>
            <h3 className="text-xl font-bold text-gray-900">{current.title}</h3>
            <p className="text-gray-600 mt-1 font-medium">
              {current.customerName}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
            <div className="text-sm font-medium text-gray-500 mb-1">
              {current.dateLabel}
            </div>
            <div
              className={`text-lg font-semibold ${new Date(current.dateValue) < new Date() ? "text-red-600" : "text-gray-800"}`}
            >
              {current.dateValue
                ? format(parseISO(current.dateValue), "MMM d, yyyy")
                : "N/A"}
            </div>
            {current.details && (
              <div className="mt-3 text-sm text-gray-700 border-t border-gray-200 pt-3 line-clamp-3">
                {current.details}
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <Check className="w-4 h-4 mr-2" />
            Acknowledge & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
