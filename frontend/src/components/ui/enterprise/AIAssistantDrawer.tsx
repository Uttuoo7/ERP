import React, { useState } from 'react';
import { Drawer, Input, Button, Typography, Space, Tag, Spin } from 'antd';
import { Bot, Send, User as UserIcon, Sparkles, Database, AlertTriangle, FileSearch } from 'lucide-react';
import { useAuthStore } from "../../../store/authStore";

const { Text, Title } = Typography;

interface AIAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data_points?: any[];
  confidence?: number;
  sources?: string[];
}

export function AIAssistantDrawer({ open, onClose }: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your P2P ERP Executive AI. You can ask me about risky vendors, workflow bottlenecks, or inventory health.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useAuthStore(state => state.token);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: userMessage.content })
      });
      
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.narrative,
        data_points: data.data_points,
        confidence: data.confidence,
        sources: data.sources
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error querying the ERP databases.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestQuery = (q: string) => {
    setInput(q);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <span className="font-bold text-slate-800">Operational AI Assistant</span>
          <Tag color="purple" className="ml-2 font-bold tracking-widest text-[10px] border-none bg-purple-100 text-purple-700">BETA</Tag>
        </div>
      }
      placement="right"
      width={450}
      onClose={onClose}
      open={open}
      bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0, backgroundColor: '#f8fafc' }}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {msg.role === 'user' ? <UserIcon className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 rounded-tl-sm'}`}>
              <Text className={msg.role === 'user' ? 'text-white' : 'text-slate-700'} style={{ fontSize: '14px', lineHeight: '1.5' }}>
                {msg.content}
              </Text>
              
              {/* Explainability Meta */}
              {msg.role === 'assistant' && msg.confidence && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Tooltip title="Data Confidence Level">
                      <Tag color={msg.confidence > 0.9 ? 'green' : 'orange'} className="flex items-center gap-1 m-0 text-[10px]">
                        <ShieldCheck className="w-3 h-3" />
                        {(msg.confidence * 100).toFixed(0)}% Confidence
                      </Tag>
                    </Tooltip>
                    {msg.sources?.map((s, i) => (
                      <Tooltip title="ERP Data Source" key={i}>
                        <Tag className="flex items-center gap-1 m-0 text-[10px] text-slate-500 bg-slate-50">
                          <Database className="w-3 h-3" /> {s}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                  
                  {msg.data_points && msg.data_points.length > 0 && (
                    <div className="bg-slate-50 rounded p-2 mt-2 border border-slate-100">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Source Entities</Text>
                      <ul className="m-0 pl-4 text-xs text-slate-600">
                        {msg.data_points.map((dp, i) => (
                          <li key={i}>{dp.entity || dp.role || dp.item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
              <Spin size="small" />
              <Text className="text-slate-500 text-sm">Querying ERP databases...</Text>
            </div>
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button size="small" type="dashed" onClick={() => suggestQuery("Which vendors are risky?")}>Risky Vendors</Button>
          <Button size="small" type="dashed" onClick={() => suggestQuery("Why are approvals delayed?")}>Delayed Approvals</Button>
          <Button size="small" type="dashed" onClick={() => suggestQuery("Show low stock items")}>Low Stock</Button>
        </div>
        <div className="flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder="Ask anything about operations..."
            size="large"
            className="rounded-xl"
            disabled={loading}
          />
          <Button 
            type="primary" 
            size="large" 
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 w-12 flex items-center justify-center"
            icon={<Send className="w-5 h-5 ml-1" />}
            onClick={handleSend}
            loading={loading}
          />
        </div>
      </div>
    </Drawer>
  );
}

// Temporary mock of ShieldCheck since we didn't import it at the top
const ShieldCheck = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>;
