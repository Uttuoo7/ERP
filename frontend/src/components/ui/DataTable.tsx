import React, { useState, useEffect, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Settings2, Download, TableProperties } from 'lucide-react';
import { DataTablePagination } from './DataTablePagination';
import { useTableDensityStore } from '../../store/tableDensityStore';
import { useBackgroundJobStore } from '../../store/backgroundJobStore';
import { TableSkeleton } from '../common/TableSkeleton';
import { EmptyState } from '../common/EmptyState';
import toast from 'react-hot-toast';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  tableId?: string; // for persistent column preferences
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  tableId = 'default-table'
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const { density, setDensity } = useTableDensityStore();
  const { addJob, updateProgress, completeJob } = useBackgroundJobStore();

  // Visible columns state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Virtualization Scroll parameters
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rowHeight = density === 'compact' ? 36 : 48;
  const viewportHeight = 400; // Visible scroll height limit

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Load column visibility settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`erp-table-cols-${tableId}`);
      if (stored) {
        setVisibleColumns(JSON.parse(stored));
      } else {
        // default: all visible
        const defaults: Record<string, boolean> = {};
        columns.forEach((col: any) => {
          if (col.accessorKey) defaults[col.accessorKey] = true;
          else if (col.id) defaults[col.id] = true;
        });
        setVisibleColumns(defaults);
      }
    } catch (e) {}
  }, [columns, tableId]);

  const saveColumnVisibility = (nextVisibility: Record<string, boolean>) => {
    setVisibleColumns(nextVisibility);
    try {
      localStorage.setItem(`erp-table-cols-${tableId}`, JSON.stringify(nextVisibility));
    } catch (e) {}
  };

  const toggleColumn = (key: string) => {
    const nextVal = !visibleColumns[key];
    saveColumnVisibility({ ...visibleColumns, [key]: nextVal });
  };

  // Filter columns based on visibility settings
  const activeColumns = columns.filter((col: any) => {
    const key = col.accessorKey || col.id;
    if (!key) return true;
    return visibleColumns[key] !== false;
  });

  const table = useReactTable({
    data,
    columns: activeColumns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const handleExport = (format: 'CSV' | 'Excel') => {
    const jobId = addJob(`Exporting ${tableId} report (${format})`);
    
    // Simulate async progress
    let pct = 0;
    const interval = setInterval(() => {
      pct += 25;
      updateProgress(jobId, pct);
      if (pct >= 100) {
        clearInterval(interval);
        completeJob(jobId);
        toast.success(`${tableId} exported as ${format} successfully.`);
      }
    }, 300);
  };

  const cellPadding = density === 'compact' ? 'px-4 py-1.5 text-[12px]' : 'px-6 py-3 text-xs';
  const headerPadding = density === 'compact' ? 'px-4 py-2.5' : 'px-6 py-3';

  if (isLoading) {
    return <TableSkeleton columns={columns.length} rows={5} />;
  }

  // Virtualization calculations
  const totalRows = table.getRowModel().rows?.length || 0;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  const endIndex = Math.min(totalRows - 1, Math.floor((scrollTop + viewportHeight) / rowHeight) + 5);

  const visibleRows = table.getRowModel().rows.slice(startIndex, endIndex + 1);

  const totalHeight = totalRows * rowHeight;
  const paddingTop = startIndex * rowHeight;
  const paddingBottom = Math.max(0, totalHeight - (endIndex + 1) * rowHeight);

  return (
    <div className="space-y-3 font-sans">
      {/* Table toolbar / controls */}
      <div className="flex items-center justify-between bg-slate-50 p-2 border border-slate-200 rounded-xl select-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Density:</span>
          <button
            onClick={() => setDensity('compact')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              density === 'compact' ? 'bg-blue-600 text-white' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            Compact
          </button>
          <button
            onClick={() => setDensity('comfortable')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              density === 'comfortable' ? 'bg-blue-600 text-white' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            Standard
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Columns Visibility dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
              className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white"
            >
              <Settings2 className="w-3.5 h-3.5" /> Column Settings
            </button>
            {isColumnPickerOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-30 max-h-56 overflow-y-auto">
                <div className="px-3 pb-1 border-b border-slate-100 text-[8px] font-black uppercase text-slate-400">
                  Visible Columns
                </div>
                {columns.map((col: any, idx) => {
                  const key = col.accessorKey || col.id;
                  if (!key || typeof col.header !== 'string') return null;
                  const isChecked = visibleColumns[key] !== false;
                  return (
                    <label
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>{col.header}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <button
            onClick={() => handleExport('CSV')}
            className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => handleExport('Excel')}
            className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Grid container with sticky header + sticky first column */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-text">
        <div 
          ref={containerRef} 
          onScroll={handleScroll} 
          className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin"
        >
          <table className="w-full text-left border-collapse table-fixed" style={{ width: table.getCenterTotalSize() }}>
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-20 border-b border-slate-200 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {headerGroup.headers.map((header, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <th 
                        key={header.id} 
                        style={{ width: header.getSize() }}
                        className={`relative group ${headerPadding} ${
                          isFirst ? 'sticky left-0 bg-slate-50/95 z-30 border-r border-slate-200 shadow-md shadow-slate-100/50' : ''
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {/* Column Resize Handle */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-500 bg-slate-200/50 z-10 transition-colors ${
                              header.column.getIsResizing() ? 'bg-blue-600 w-1.5' : ''
                            }`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={activeColumns.length} style={{ height: paddingTop }} />
                </tr>
              )}
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors data-[state=selected]:bg-slate-50 group"
                  >
                    {row.getVisibleCells().map((cell, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <td 
                          key={cell.id} 
                          style={{ width: cell.column.getSize() }}
                          className={`${cellPadding} ${
                            isFirst ? 'sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-150 shadow-md shadow-slate-100/20' : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={activeColumns.length} className="p-0">
                    <EmptyState 
                      icon={<TableProperties />} 
                      title="No records found" 
                      description="There are currently no items to display in this table view." 
                    />
                  </td>
                </tr>
              )}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={activeColumns.length} style={{ height: paddingBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
