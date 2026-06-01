import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Save, ShoppingBag, Truck, Clipboard, Building, Calendar, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getPO, getWarehouses, convertPOToGRN, getPOs } from "../api";

const POToGRNConverter: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPoId = searchParams.get('po_id') || "";

  const [saving, setSaving] = useState(false);
  const [loadingPO, setLoadingPO] = useState(false);

  // Masters
  const [approvedPOs, setApprovedPOs] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Selection state
  const [poId, setPoId] = useState(initialPoId);
  const [poDetails, setPoDetails] = useState<any>(null);

  // Form parameters
  const [challanNo, setChallanNo] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [remarks, setRemarks] = useState("");
  
  // Line items receive quantities
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const poRes = await getPOs();
        // filter approved or partial order options only
        const activePOs = poRes.data.filter((x: any) => x.status === 'APPROVED' || x.status === 'PARTIAL_RECEIPT');
        setApprovedPOs(activePOs);

        const whRes = await getWarehouses();
        setWarehouses(whRes.data);
        if (whRes.data.length > 0) {
          setWarehouseId(whRes.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();
  }, []);

  useEffect(() => {
    if (poId) {
      loadPODetails(poId);
    } else {
      setPoDetails(null);
      setReceivedQuantities({});
    }
  }, [poId]);

  const loadPODetails = async (id: string) => {
    setLoadingPO(true);
    try {
      const res = await getPO(id);
      setPoDetails(res.data);
      
      // Seed default receive quantities to remaining PO balances
      const initialCounts: Record<string, number> = {};
      res.data.line_items.forEach((line: any) => {
        const remaining = line.quantity_ordered - line.quantity_received;
        initialCounts[line.id] = remaining > 0 ? remaining : 0;
      });
      setReceivedQuantities(initialCounts);
    } catch (err) {
      toast.error("Failed to load PO line items.");
    } finally {
      setLoadingPO(false);
    }
  };

  const handleQtyChange = (lineId: string, val: number, max: number) => {
    if (val < 0) return;
    if (val > max) {
      toast.error(`Cannot exceed outstanding balance of ${max} units.`);
      return;
    }
    setReceivedQuantities(prev => ({
      ...prev,
      [lineId]: val
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !warehouseId || !challanNo.trim()) {
      toast.error("Please supply all required receipt details.");
      return;
    }

    // Prepare received items
    const receivedItems = poDetails.line_items.map((line: any) => {
      const qtyRec = receivedQuantities[line.id] || 0;
      return {
        po_line_item_id: line.id,
        item_id: line.item_id,
        quantity_received: qtyRec,
        batch_number: "", // filled later in QC
        serial_numbers: [],
        expiry_date: null,
        warehouse_location: ""
      };
    }).filter((x: any) => x.quantity_received > 0);

    if (receivedItems.length === 0) {
      toast.error("Please receive at least one line item count.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        po_id: poId,
        warehouse_id: warehouseId,
        delivery_challan_number: challanNo.trim(),
        vehicle_details: vehicleDetails.trim() || null,
        remarks: remarks.trim() || null,
        received_items: receivedItems
      };

      await convertPOToGRN(payload);
      toast.success("PO converted to Goods Receipt challan! Status: QC Pending.");
      navigate('/grns');
    } catch (err: any) {
      // Handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/grns')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">PO to GRN Converter</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Select an active purchase order to process incoming physical inventory allocations</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-500">
        {/* PO Picker */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-blue-600" /> Active Purchase Order *
          </h3>
          <select
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
            className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-bold"
          >
            <option value="">-- Choose Approved PO to Unload --</option>
            {approvedPOs.map(po => (
              <option key={po.id} value={po.id}>{po.po_number} - {po.vendor?.name} (Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'N/A'})</option>
            ))}
          </select>
        </div>

        {poId && (
          <>
            {loadingPO ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Receipt Details Card */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-3">
                    <Truck className="w-4 h-4 text-blue-600" /> Unloading challan & Shipping details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Delivery Challan Number */}
                    <div className="space-y-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider">Delivery Challan Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DC-99843-RECEIPT"
                        value={challanNo}
                        onChange={(e) => setChallanNo(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                      />
                    </div>

                    {/* Shipping Vehicle */}
                    <div className="space-y-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider">Vehicle Details / Plate No.</label>
                      <input
                        type="text"
                        placeholder="e.g. KA-03-XX-9843"
                        value={vehicleDetails}
                        onChange={(e) => setVehicleDetails(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                      />
                    </div>

                    {/* Warehouse Destination */}
                    <div className="space-y-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider">Destination Warehouse Zone *</label>
                      <select
                        required
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                      >
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* General Remarks */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider">Unloading comments / remarks</label>
                    <textarea
                      placeholder="Enter remarks (e.g. Received shipment in good condition, packaging intact)..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full min-h-[70px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none"
                    />
                  </div>
                </div>

                {/* Line Items Receive Quantities */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clipboard className="w-4 h-4 text-blue-600" /> Receiving line checklist
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Double check physical counts on unloading
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-3">SKU & Item Name</th>
                          <th className="px-4 py-3 text-center">Ordered</th>
                          <th className="px-4 py-3 text-center">Already Received</th>
                          <th className="px-4 py-3 text-center text-blue-600">Outstanding balance</th>
                          <th className="px-4 py-3 text-right max-w-[120px]">Qty Received Today</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                        {poDetails?.line_items.map((line: any) => {
                          const remaining = line.quantity_ordered - line.quantity_received;
                          if (remaining <= 0) return null;

                          return (
                            <tr key={line.id} className="hover:bg-slate-50/20">
                              <td className="px-4 py-3">
                                <div>
                                  <span className="font-extrabold text-slate-800 text-sm block">{line.item?.sku}</span>
                                  <span className="text-[10px] text-slate-400 block line-clamp-1">{line.item?.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-900 font-bold">{line.quantity_ordered}</td>
                              <td className="px-4 py-3 text-center text-slate-400">{line.quantity_received}</td>
                              <td className="px-4 py-3 text-center text-blue-600 font-black">{remaining} units</td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  value={receivedQuantities[line.id] ?? 0}
                                  onChange={(e) => handleQtyChange(line.id, Number(e.target.value), remaining)}
                                  className="w-24 px-2 py-1 text-center text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-blue-500 font-bold text-slate-900"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2 justify-end pt-5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => navigate('/grns')}
                      className="px-5 py-2.5 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-250 transition-all font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Save Challan Draft
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </form>
    </div>
  );
};

export default POToGRNConverter;
