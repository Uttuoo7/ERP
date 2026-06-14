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

import { StatusBadge } from '../../components/common/StatusBadge';

const getStatusBadge = (status: string) => {
  switch (status) {
    case "DRAFT":
      return <StatusBadge status="neutral" label="Draft" />;
    case "PENDING_APPROVAL":
      return <StatusBadge status="warning" label="Awaiting Approval" />;
    case "APPROVED":
    case "ISSUED":
    case "SENT":
      return <StatusBadge status="info" label="Issued / Sent" />;
    case "PARTIAL_RECEIPT":
      return <StatusBadge status="info" label="Partially Received" />;
    case "FULFILLED":
      return <StatusBadge status="success" label="Fulfilled" />;
    case "CLOSED":
      return <StatusBadge status="neutral" label="Closed" />;
    default:
      return <StatusBadge status="neutral" label={status} />;
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
