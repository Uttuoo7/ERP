import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Typography } from 'antd';
import { X, ScanLine } from 'lucide-react';

const { Text } = Typography;

interface ScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function ScannerOverlay({ isOpen, onClose, onScan }: ScannerOverlayProps) {
  useEffect(() => {
    if (isOpen) {
      // Initialize the scanner
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render(
        (decodedText) => {
          scanner.clear(); // Stop scanning on success
          onScan(decodedText);
        },
        (error) => {
          // Ignored background errors during scanning
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Top Bar */}
      <div className="h-16 flex items-center justify-between px-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-indigo-400" />
          <Text className="text-white font-semibold tracking-wide">Warehouse Scanner</Text>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-6 h-6 text-slate-300" />
        </button>
      </div>

      {/* Scanner Container */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <div id="qr-reader" className="w-full max-w-md mx-auto h-full" />
      </div>

      {/* Helper Text */}
      <div className="h-24 bg-slate-900 shrink-0 flex items-center justify-center border-t border-slate-800">
        <Text className="text-slate-400 text-sm">
          Point camera at a Barcode or QR Code to scan
        </Text>
      </div>
    </div>
  );
}
