import React, { useState } from 'react';
import { Typography, Button, message, List, Badge, Card, Space } from 'antd';
import { Scan, PackageCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { ScannerOverlay } from "../../components/ui/enterprise/ScannerOverlay";
import toast from 'react-hot-toast';

const { Title, Text } = Typography;

interface ScannedItem {
  id: string;
  sku: string;
  scanned_qty: number;
  expected_qty: number;
}

export function MobileGRNWorkspace() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [poNumber, setPoNumber] = useState("PO-10025");
  
  // Mock data for a PO being received
  const [items, setItems] = useState<ScannedItem[]>([
    { id: '1', sku: 'SKU-ELEC-001', scanned_qty: 0, expected_qty: 50 },
    { id: '2', sku: 'SKU-MECH-092', scanned_qty: 12, expected_qty: 12 },
    { id: '3', sku: 'SKU-PACK-005', scanned_qty: 5, expected_qty: 100 },
  ]);

  const handleScan = (decodedText: string) => {
    setScannerOpen(false);
    
    // Simulate finding the item in our list based on scanned text
    const targetSku = decodedText.trim(); // Assume the barcode is just the SKU for this mockup
    
    const itemIndex = items.findIndex(i => i.sku === targetSku);
    
    if (itemIndex >= 0) {
      const updatedItems = [...items];
      updatedItems[itemIndex].scanned_qty += 1;
      setItems(updatedItems);
      
      // Haptic feedback if supported
      if (navigator.vibrate) navigator.vibrate(100);
      
      toast.success(`Scanned: ${targetSku} (+1)`, { icon: '📦' });
      
      // Simulate real-time activity engine broadcast
      window.dispatchEvent(new CustomEvent('NEW_ACTIVITY', { 
        detail: {
          id: Date.now().toString(),
          entity_type: 'INVENTORY',
          action: 'ITEM_SCANNED',
          severity: 'INFO',
          description: `Warehouse operator scanned 1 unit of ${targetSku}`,
          created_at: new Date().toISOString()
        }
      }));
      
    } else {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      toast.error(`Unknown Barcode: ${targetSku}`, { icon: '❌' });
    }
  };

  const handleComplete = () => {
    message.success("GRN Created Successfully!");
  };

  return (
    <div className="p-4 pb-24 h-full bg-slate-50">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Title level={4} className="m-0 text-slate-800">Receive Goods</Title>
          <Text type="secondary" className="text-sm">Scan items for {poNumber}</Text>
        </div>
        <Badge count={items.reduce((acc, curr) => acc + curr.scanned_qty, 0)} showZero color="#4f46e5" />
      </div>

      <Card 
        className="mb-6 border-indigo-100 bg-indigo-50/50 shadow-sm"
        bodyStyle={{ padding: '16px' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Scan className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <Text strong className="block text-indigo-900">Ready to Scan</Text>
              <Text className="text-xs text-indigo-600">Tap below to open camera</Text>
            </div>
          </div>
        </div>
        <Button 
          type="primary" 
          size="large" 
          block 
          className="mt-4 h-12 bg-indigo-600 hover:bg-indigo-700 text-lg font-bold shadow-md"
          icon={<Scan className="w-5 h-5 mr-2" />}
          onClick={() => setScannerOpen(true)}
        >
          START SCANNING
        </Button>
      </Card>

      <div className="flex items-center justify-between mb-3 px-1">
        <Text strong className="text-slate-700 text-sm">Expected Items</Text>
        <Text className="text-xs text-slate-500">{items.length} SKUs</Text>
      </div>

      <List
        dataSource={items}
        renderItem={(item) => {
          const isComplete = item.scanned_qty >= item.expected_qty;
          const isStarted = item.scanned_qty > 0;
          
          return (
            <div className={`mb-3 p-4 rounded-xl border bg-white shadow-sm transition-all ${
              isComplete ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <Text strong className={isComplete ? 'text-emerald-800' : 'text-slate-800'}>
                  {item.sku}
                </Text>
                {isComplete ? (
                  <Badge status="success" text="Complete" className="text-[10px]" />
                ) : isStarted ? (
                  <Badge status="processing" color="blue" text="In Progress" className="text-[10px]" />
                ) : (
                  <Badge status="default" text="Pending" className="text-[10px]" />
                )}
              </div>
              
              <div className="flex items-end justify-between mt-4">
                <div className="flex items-center gap-4">
                  <div>
                    <Text className="text-[10px] text-slate-400 block uppercase tracking-wider mb-1">Scanned</Text>
                    <Text className={`text-xl font-bold ${isComplete ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {item.scanned_qty}
                    </Text>
                  </div>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div>
                    <Text className="text-[10px] text-slate-400 block uppercase tracking-wider mb-1">Expected</Text>
                    <Text className="text-xl font-bold text-slate-700">{item.expected_qty}</Text>
                  </div>
                </div>
                
                {!isComplete && (
                  <Button 
                    type="dashed" 
                    size="small" 
                    onClick={() => handleScan(item.sku)}
                    className="text-xs"
                  >
                    Manual +1
                  </Button>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, (item.scanned_qty / item.expected_qty) * 100)}%` }}
                ></div>
              </div>
            </div>
          );
        }}
      />

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-slate-200 pb-safe">
        <Button 
          type="primary" 
          size="large" 
          block 
          className="h-12 bg-emerald-600 hover:bg-emerald-700 font-bold"
          icon={<PackageCheck className="w-5 h-5 mr-2" />}
          onClick={handleComplete}
        >
          GENERATE GRN
        </Button>
      </div>

      <ScannerOverlay 
        isOpen={scannerOpen} 
        onClose={() => setScannerOpen(false)} 
        onScan={handleScan} 
      />
    </div>
  );
}
