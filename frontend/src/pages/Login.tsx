import { useState } from 'react';
import { useAuth } from "../AuthContext";
import { login as apiLogin } from "../api";
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        email: email.trim(),
        password: password
      };
      
      const res = await apiLogin(payload);
      login(res.data.access_token, res.data.refresh_token, res.data.role, email);
      navigate('/');
    } catch (err: any) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">P2P ERP Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email or Username</label>
            <input required type="text" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full p-2 border rounded border-gray-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full p-2 border rounded border-gray-300" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded shadow hover:bg-blue-700 font-bold transition-colors">Log In</button>
        </form>
        <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center leading-relaxed">
          <strong>Demo Accounts:</strong><br/>
          admin@example.com, buyer@example.com<br/>
          warehouse@example.com, finance@example.com<br/>
          Password: <em>password</em>
        </div>
      </div>
    </div>
  );
}
