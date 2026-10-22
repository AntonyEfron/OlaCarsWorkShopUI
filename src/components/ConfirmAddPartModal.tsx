import React from 'react';
import {
    X,
    AlertTriangle,
    Package,
    Car,
    CheckCircle2,
    Loader2,
    Info,
    Check
} from 'lucide-react';
import { type WorkOrder } from '../services/workOrderService';
import { type InventoryPart } from '../services/inventoryService';
import { checkVehicleCompatibility } from './SearchableInventoryPartSelect';

interface ConfirmAddPartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    workOrder: WorkOrder;
    part: InventoryPart;
    quantity: number;
    loading: boolean;
}

export const ConfirmAddPartModal: React.FC<ConfirmAddPartModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    workOrder,
    part,
    quantity,
    loading,
}) => {
    if (!isOpen) return null;

    const vehicleObj = typeof workOrder.vehicleId === 'object' ? (workOrder.vehicleId as any) : null;
    const vehicleName = vehicleObj
        ? `${vehicleObj.basicDetails?.make || ''} ${vehicleObj.basicDetails?.model || ''} ${vehicleObj.basicDetails?.year || ''}`.trim()
        : 'Assigned Vehicle';

    const available = (part.quantityOnHand || 0) - (part.quantityReserved || 0);
    const isOutOfStock = available <= 0;
    const isInsufficient = !isOutOfStock && available < quantity;
    const totalCost = (part.unitCost || 0) * quantity;

    const compatibility = checkVehicleCompatibility(part, vehicleObj);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-lg glass-card rounded-3xl border border-[var(--border-main)] shadow-2xl overflow-hidden bg-[#181818] flex flex-col animate-scaleIn">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-main)]/40 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] flex items-center justify-center font-bold">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-wide">
                                Confirm Adding Part
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                Work Order #{workOrder.workOrderNumber}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="btn-icon text-gray-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Vehicle Compatibility & Stock Classification Banner */}
                    {compatibility.status === 'MISMATCH' ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
                            <AlertTriangle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                    Different Vehicle Model Part Detected
                                </h4>
                                <p className="text-xs leading-relaxed text-amber-200">
                                    {compatibility.warningReason ||
                                        `This part is designated for ${compatibility.modelDetected || 'another model'}, which differs from work order vehicle (${vehicleName}).`}
                                </p>
                                <p className="text-[11px] text-amber-300/80 font-medium pt-0.5">
                                    Please confirm that this part is mechanically suitable and intended for this repair.
                                </p>
                            </div>
                        </div>
                    ) : compatibility.status === 'GENERAL' ? (
                        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-start gap-3 text-sky-300">
                            <Info size={22} className="text-sky-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                        General Inventory Stock
                                    </h4>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                        Universal Item
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-sky-100/90">
                                    This part is general workshop inventory / consumable (not designated for any single vehicle model). It is safe and standard to use across multiple makes and models.
                                </p>
                                <p className="text-[11px] text-sky-300/80 font-medium pt-0.5">
                                    Ready to be assigned to {vehicleName}.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 size={18} className="flex-shrink-0" />
                            <span>This part is verified and cataloged specifically for {vehicleName}.</span>
                        </div>
                    )}

                    {/* Vehicle Info */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-300">
                            <Car size={16} className="text-[var(--brand-lime)]" />
                            <span className="font-semibold">{vehicleName}</span>
                        </div>
                        {vehicleObj?.legalDocs?.registrationNumber && (
                            <span className="font-mono text-[10px] bg-white/10 text-white px-2 py-0.5 rounded font-bold">
                                {vehicleObj.legalDocs.registrationNumber}
                            </span>
                        )}
                    </div>

                    {/* Part Details Summary */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className="text-sm font-bold text-white">{part.partName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    {part.partNumber && (
                                        <span className="font-mono text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                                            PN: {part.partNumber}
                                        </span>
                                    )}
                                    {part.category && (
                                        <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                                            {part.category}
                                        </span>
                                    )}
                                    {compatibility.status === 'GENERAL' && (
                                        <span className="text-[10px] bg-sky-500/15 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-medium">
                                            General Stock
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className="font-mono font-bold text-sm text-[var(--brand-lime)]">
                                ${(part.unitCost || 0).toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">/ {part.unit || 'ea'}</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-main)]/30 text-xs">
                            <div className="bg-white/5 p-2.5 rounded-xl">
                                <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                    Quantity to Add
                                </span>
                                <span className="font-mono font-black text-sm text-white">{quantity}</span>
                            </div>
                            <div className="bg-white/5 p-2.5 rounded-xl">
                                <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                    Total Estimated Cost
                                </span>
                                <span className="font-mono font-black text-sm text-[var(--brand-lime)]">
                                    ${totalCost.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Stock status indicator */}
                        <div
                            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                                isOutOfStock
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : isInsufficient
                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                        >
                            {isOutOfStock ? (
                                <>
                                    <AlertTriangle size={15} />
                                    <span>Out of stock — will be added as a REQUEST for manager approval.</span>
                                </>
                            ) : isInsufficient ? (
                                <>
                                    <AlertTriangle size={15} />
                                    <span>Only {available} in stock — need {quantity}. Will require approval.</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={15} />
                                    <span>{available} units available in stock — will be reserved immediately.</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-main)]/40 bg-black/20">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="btn-secondary h-10 px-5 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`h-10 px-6 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 transition-all ${
                            compatibility.status === 'GENERAL'
                                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-black'
                                : compatibility.status === 'MISMATCH'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                                : 'btn-primary'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={15} className="animate-spin" /> Adding Part...
                            </>
                        ) : compatibility.status === 'GENERAL' ? (
                            <>
                                <Check size={15} /> Confirm & Assign General Stock
                            </>
                        ) : compatibility.status === 'MISMATCH' ? (
                            <>
                                <AlertTriangle size={15} /> Confirm & Override
                            </>
                        ) : (
                            <>
                                <Check size={15} /> Confirm & Add Part
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmAddPartModal;
