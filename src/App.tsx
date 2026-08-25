/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import CataloguePortal from './pages/CataloguePortal';
import CatalogueCreator from './pages/CatalogueCreator';
import TicketAlerts from './components/TicketAlerts';

function ProtectedRoute({ children, allowedRole, allowMultipleRoles }: { children: React.ReactNode, allowedRole?: 'admin' | 'employee' | 'manager', allowMultipleRoles?: ('admin' | 'employee' | 'manager')[] }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowMultipleRoles && !allowMultipleRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/employee'} replace />;
  }
  
  if (allowedRole && !allowMultipleRoles && user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/employee'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/employee'} replace /> : <Login />} />
        
        <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute allowedRole="manager"><ManagerDashboard /></ProtectedRoute>} />
        <Route path="/employee" element={<ProtectedRoute allowedRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
        
        <Route path="/catalogue" element={<ProtectedRoute><CataloguePortal /></ProtectedRoute>} />
        <Route path="/catalogue-creator" element={<ProtectedRoute allowedRole="admin"><AdminDashboard initialTab="catalogue-creator" /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      {user && <TicketAlerts />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
