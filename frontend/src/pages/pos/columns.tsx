import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  status: string;
  amendment_version: number;
  total_amount: number;
  vendor?: {
    name: string;
  };
  department?: {
    name: string;
  };
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "DRAFT":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
    case "PENDING_APPROVAL":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-150 animate-pulse">Awaiting Approval</span>;
    case "APPROVED":
    case "ISSUED":
    case "SENT":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">Issued / Sent</span>;
    case "PARTIAL_RECEIPT":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-150">Partially Received</span>;
    case "FULFILLED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">Fulfilled</span>;
    case "CLOSED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">Closed</span>;
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-150 text-gray-700">{status}</span>;
  }
};

export const columns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: 'po_number',
    header: 'PO Reference',
    cell: ({ row }) => (
      <Link to={`/pos/${row.original.id}`} className="font-extrabold text-blue-600 hover:text-blue-700">
        {row.getValue('po_number')}
      </Link>
    ),
  },
  {
    accessorKey: 'vendor.name',
    header: 'Vendor Partner',
    cell: ({ row }) => (
      <span className="text-slate-900 font-bold">{row.original.vendor?.name || 'N/A'}</span>
    ),
  },
  {
    accessorKey: 'department.name',
    header: 'Cost Area',
    cell: ({ row }) => (
      <span className="text-slate-400">{row.original.department?.name || 'Central Purchasing'}</span>
    ),
  },
  {
    accessorKey: 'expected_delivery_date',
    header: 'Expected Date',
    cell: ({ row }) => (
      <span className="text-slate-500 font-medium">
        {new Date(row.getValue('expected_delivery_date')).toLocaleDateString()}
      </span>
    ),
  },
  {
    accessorKey: 'total_amount',
    header: () => <div className="text-right">Commitment Value</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total_amount') as string);
      return (
        <div className="text-right text-slate-900 font-black">
          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: 'amendment_version',
    header: () => <div className="text-center">Version</div>,
    cell: ({ row }) => (
      <div className="text-center">
        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
          v{row.getValue('amendment_version')}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.getValue('status')),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link
          to={`/pos/${row.original.id}`}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
        >
          Details <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    ),
  },
];
