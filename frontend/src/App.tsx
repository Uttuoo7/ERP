import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import VendorList from './pages/VendorList';
import ItemCatalog from './pages/ItemCatalog';
import POList from './pages/POList';
import PurchaseOrderForm from './pages/PurchaseOrderForm';
import ReceiveGoods from './pages/ReceiveGoods';
import InvoiceList from './pages/InvoiceList';
import InvoiceEntry from './pages/InvoiceEntry';
import Login from './pages/Login';
import SOList from './pages/SOList';
import SOForm from './pages/SOForm';
import SODetails from './pages/SODetails';
import PurchaseOrderEdit from './pages/PurchaseOrderEdit';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import { AuthProvider, useAuth } from './AuthContext';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return children;
}

function Sidebar() {
  const { role, logout, email } = useAuth();
  const isAdmin = role === 'ADMIN';
  
  return (
    <aside className="w-64 bg-white shadow-md flex flex-col min-h-screen">
      <div className="p-6 border-b">
        <h2 className="text-xl font-extrabold text-blue-600 tracking-wider">P2P ERP</h2>
        <p className="text-sm text-gray-500 mt-1">User: <span className="font-bold text-gray-700">{email}</span></p>
      </div>
      <nav className="mt-4 flex-1">
        {(isAdmin || role === 'BUYER') && (
          <div className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Insights</h3>
            <Link to="/analytics" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-indigo-600 font-medium transition-colors">Analytics Dashboard</Link>
          </div>
        )}

        {(isAdmin || role === 'BUYER') && (
          <div className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Purchasing</h3>
            <Link to="/sales-orders" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Internal Requisitions</Link>
            <Link to="/vendors" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Vendors</Link>
            <Link to="/items" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Items</Link>
            <Link to="/pos" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Purchase Orders</Link>
          </div>
        )}
        
        {(isAdmin || role === 'WAREHOUSE') && (
          <div className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Warehouse</h3>
            <Link to="/items" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Inventory Catalog</Link>
            <Link to="/receive" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors">Receive Goods</Link>
          </div>
        )}

        {(isAdmin || role === 'FINANCE') && (
          <div className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Accounts Payable</h3>
            <Link to="/invoices" className="block px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-purple-600 font-medium transition-colors">Invoices</Link>
          </div>
        )}
      </nav>
      <div className="p-6 border-t">
        <button onClick={logout} className="w-full text-left text-sm text-red-600 hover:text-red-800 font-bold">Logout</button>
      </div>
    </aside>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/analytics" element={<ProtectedRoute><MainLayout><AnalyticsDashboard /></MainLayout></ProtectedRoute>} />
          <Route path="/sales-orders" element={<ProtectedRoute><MainLayout><SOList /></MainLayout></ProtectedRoute>} />
          <Route path="/sales-orders/new" element={<ProtectedRoute><MainLayout><SOForm /></MainLayout></ProtectedRoute>} />
          <Route path="/sales-orders/:id" element={<ProtectedRoute><MainLayout><SODetails /></MainLayout></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute><MainLayout><VendorList /></MainLayout></ProtectedRoute>} />
          <Route path="/items" element={<ProtectedRoute><MainLayout><ItemCatalog /></MainLayout></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute><MainLayout><POList /></MainLayout></ProtectedRoute>} />
          <Route path="/pos/new" element={<ProtectedRoute><MainLayout><PurchaseOrderForm /></MainLayout></ProtectedRoute>} />
          <Route path="/pos/:id/edit" element={<ProtectedRoute><MainLayout><PurchaseOrderEdit /></MainLayout></ProtectedRoute>} />
          <Route path="/receive" element={<ProtectedRoute><MainLayout><ReceiveGoods /></MainLayout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><MainLayout><InvoiceList /></MainLayout></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><MainLayout><InvoiceEntry /></MainLayout></ProtectedRoute>} />
          
          <Route path="/" element={<ProtectedRoute><MainLayout><Navigate to="/analytics" replace /></MainLayout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
