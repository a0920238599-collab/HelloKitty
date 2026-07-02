import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';
import { UserManagement } from './pages/UserManagement';
import { ProductsManager } from './pages/admin/ProductsManager';
import { TaskAssignments } from './pages/admin/TaskAssignments';
import { SystemSettings } from './pages/admin/SystemSettings';
import { AuditLogs } from './pages/AuditLogs';
import { GetTasks } from './pages/user/GetTasks';
import { PendingJudgments } from './pages/user/PendingJudgments';
import { SubmittedJudgments } from './pages/user/SubmittedJudgments';
import { FollowSaleProducts } from './pages/user/FollowSaleProducts';
import { ExportData } from './pages/user/ExportData';
import { isSupabaseConfigured } from './lib/supabase';

// Admin Route Guard
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>加载中...</div>;
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Root redirect based on role
const RootRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return <div>加载中...</div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/user" replace />;
};

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center border">
          <h2 className="text-2xl font-bold text-red-600 mb-4">系统配置缺失</h2>
          <p className="text-gray-700 mb-4">
            未检测到 Supabase 环境变量配置。
          </p>
          <p className="text-sm text-gray-500 mb-4 text-left bg-gray-50 p-4 rounded border">
            请确保在环境中设置了以下变量：
            <br/><br/>
            <code>VITE_SUPABASE_URL</code><br/>
            <code>VITE_SUPABASE_ANON_KEY</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<RootRedirect />} />
            
            {/* Admin Routes */}
            <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="admin/products" element={<AdminRoute><ProductsManager /></AdminRoute>} />
            <Route path="admin/tasks" element={<AdminRoute><TaskAssignments /></AdminRoute>} />
            <Route path="admin/settings" element={<AdminRoute><SystemSettings /></AdminRoute>} />
            <Route path="admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
            
            {/* User Route */}
            <Route path="user" element={<UserDashboard />} />
            <Route path="user/get-tasks" element={<GetTasks />} />
            <Route path="user/pending-judgments" element={<PendingJudgments />} />
            <Route path="user/submitted-judgments" element={<SubmittedJudgments />} />
            <Route path="user/follow-sale" element={<FollowSaleProducts />} />
            <Route path="user/export" element={<ExportData />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
