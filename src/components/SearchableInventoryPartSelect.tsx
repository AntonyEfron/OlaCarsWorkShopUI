import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Search,
    ChevronDown,
    X,
    Check,
    AlertTriangle,
    Package,
    Loader2,
    CheckCircle2,
    Info
} from 'lucide-react';
import { type InventoryPart } from '../services/inventoryService';

interface SearchableInventoryPartSelectProps {
    parts: InventoryPart[];
    selectedPart: InventoryPart | null;
    onSelectPart: (part: InventoryPart) => void;
    loading?: boolean;
    vehicleObj?: any;
}

export type CompatibilityStatus = 'MATCH' | 'GENERAL' | 'MISMATCH';

export interface CompatibilityResult {
    status: CompatibilityStatus;
    isCompatible: boolean;
    modelDetected?: string;
    warningReason?: string;
}

export const checkVehicleCompatibility = (
    part: InventoryPart | null,
    vehicleObj: any
): CompatibilityResult => {
    if (!part || !vehicleObj) return { status: 'GENERAL', isCompatible: true };

    const nameRaw = (part.partName || '').toLowerCase();
    const numRaw = (part.partNumber || '').toLowerCase();
    const descRaw = (part.description || '').toLowerCase();
    const categoryRaw = (part.category || '').toLowerCase();
    const fullPartText = `${nameRaw} ${numRaw} ${descRaw} ${categoryRaw}`;

    // 1. Explicit General Stock / Consumable / Universal detection
    // Parts categorized as Fluids, or containing universal/generic/consumable keywords, are always GENERAL
    const isUniversalOrFluid =
        part.category === 'Fluids' ||
        fullPartText.includes('universal') ||
        fullPartText.includes('general stock') ||
        fullPartText.includes('consumable') ||
        fullPartText.includes('generic') ||
        fullPartText.includes('engine oil') ||
        fullPartText.includes('brake fluid') ||
        fullPartText.includes('transmission fluid') ||
        fullPartText.includes('coolant') ||
        fullPartText.includes('grease') ||
        fullPartText.includes('wd-40') ||
        fullPartText.includes('wiper fluid') ||
        fullPartText.includes('washer fluid') ||
        fullPartText.includes('freon') ||
        fullPartText.includes('r134a') ||
        fullPartText.includes('refrigerant') ||
        fullPartText.includes('distilled water');

    if (isUniversalOrFluid) {
        return { status: 'GENERAL', isCompatible: true };
    }

    const rawMake = (vehicleObj.basicDetails?.make || '').toLowerCase().trim();
    const rawModel = (vehicleObj.basicDetails?.model || '').toLowerCase().trim();
    const makeClean = rawMake.replace(/[^a-z0-9]/g, '');
    const modelClean = rawModel.replace(/[^a-z0-9]/g, '');

    let canonicalMake = makeClean;
    if (makeClean.includes('jetu') || makeClean.includes('jetour')) canonicalMake = 'jetour';
    else if (makeClean.includes('gell') || makeClean.includes('geel')) canonicalMake = 'geely';
    else if (makeClean.includes('soue')) canonicalMake = 'soueast';
    else if (makeClean.includes('tiggo') || makeClean.includes('cher')) canonicalMake = 'chery';
    else if (makeClean.includes('kia')) canonicalMake = 'kia';
    else if (makeClean.includes('honda')) canonicalMake = 'honda';

    let canonicalModel = modelClean;
    if (modelClean.includes('brv')) canonicalModel = 'brv';
    else if (modelClean.includes('x70')) canonicalModel = 'x70';
    else if (modelClean.includes('s07')) canonicalModel = 's07';
    else if (modelClean.includes('okvango') || modelClean.includes('okavango')) canonicalModel = 'okavango';
    else if (modelClean.includes('carens')) canonicalModel = 'carens';
    else if (modelClean.includes('soluto')) canonicalModel = 'soluto';
    else if (modelClean.includes('8pro') || modelClean.includes('tiggo')) canonicalModel = 'tiggo';

    const ALL_KNOWN_MODELS = [
        { key: 'carens', label: 'Kia Carens' },
        { key: 'soluto', label: 'Kia Soluto' },
        { key: 'brv', label: 'Honda BR-V' },
        { key: 'x70', label: 'Jetour X70' },
        { key: 's07', label: 'Jetour S07' },
        { key: 'okavango', label: 'Geely Okavango' },
        { key: 'tiggo', label: 'Chery Tiggo 8 Pro' },
    ];

    const nameClean = (part.partName || part.partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const descClean = (part.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const text = `${nameClean} ${descClean}`;

    const foundModel = ALL_KNOWN_MODELS.find((m) => text.includes(m.key));
    if (foundModel) {
        if (canonicalModel && foundModel.key === canonicalModel) {
            return { status: 'MATCH', isCompatible: true, modelDetected: foundModel.label };
        }
        return {
            status: 'MISMATCH',
            isCompatible: false,
            modelDetected: foundModel.label,
            warningReason: `Part is designated for ${foundModel.label}, which differs from work order vehicle (${vehicleObj.basicDetails?.make || ''} ${vehicleObj.basicDetails?.model || ''}).`,
        };
    }

    // Check make mismatch
    const KNOWN_MAKES = ['jetour', 'geely', 'soueast', 'chery', 'kia', 'honda'];
    const foundMake = KNOWN_MAKES.find((m) => text.includes(m));
    if (foundMake) {
        if (canonicalMake && foundMake === canonicalMake) {
            return { status: 'MATCH', isCompatible: true, modelDetected: foundMake.toUpperCase() };
        }
        return {
            status: 'MISMATCH',
            isCompatible: false,
            modelDetected: foundMake.toUpperCase(),
            warningReason: `Part is designated for ${foundMake.toUpperCase()}, which differs from vehicle make (${vehicleObj.basicDetails?.make || ''}).`,
        };
    }

    // Does not specify any specific conflicting vehicle model or make -> It is General Stock
    return { status: 'GENERAL', isCompatible: true };
};

export const SearchableInventoryPartSelect: React.FC<SearchableInventoryPartSelectProps> = ({
    parts,
    selectedPart,
    onSelectPart,
    loading = false,
    vehicleObj,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Filter parts: if search query empty, show first 8 items; otherwise search by name, partNumber, id, category, or description
    const displayedParts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return parts.slice(0, 8);
        }
        return parts.filter((p) => {
            const name = (p.partName || '').toLowerCase();
            const num = (p.partNumber || '').toLowerCase();
            const id = (p._id || '').toLowerCase();
            const cat = (p.category || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            return (
                name.includes(query) ||
                num.includes(query) ||
                id.includes(query) ||
                cat.includes(query) ||
                desc.includes(query)
            );
        });
    }, [parts, searchQuery]);

    const handleSelect = (part: InventoryPart) => {
        onSelectPart(part);
        setIsOpen(false);
        setSearchQuery('');
    };

    const selectedCompatibility = selectedPart ? checkVehicleCompatibility(selectedPart, vehicleObj) : null;

    return (
        <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-auto'}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`input-field w-full text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer min-h-[44px] ${
                    isOpen ? 'border-[var(--brand-lime)] ring-1 ring-[var(--brand-lime)]/40 shadow-sm' : ''
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Package size={16} className={selectedPart ? 'text-[var(--brand-lime)]' : 'text-gray-400'} />
                    {loading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Loader2 size={14} className="animate-spin text-[var(--brand-lime)]" />
                            <span>Loading inventory parts...</span>
                        </div>
                    ) : selectedPart ? (
                        <div className="flex items-center gap-2 truncate text-xs">
                            <span className="font-bold text-white truncate">{selectedPart.partName}</span>
                            {selectedPart.partNumber && (
                                <span className="font-mono text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                                    {selectedPart.partNumber}
                                </span>
                            )}
                            {(() => {
                                const available = selectedPart.quantityOnHand - selectedPart.quantityReserved;
                                return (
                                    <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                            available > 0
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-red-500/15 text-red-400 border border-red-500/20'
                                        }`}
                                    >
                                        {available > 0 ? `${available} in stock` : 'Out of stock'}
                                    </span>
                                );
                            })()}
                            {selectedCompatibility && (
                                selectedCompatibility.status === 'MISMATCH' ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                        <AlertTriangle size={10} /> Other Model
                                    </span>
                                ) : selectedCompatibility.status === 'GENERAL' ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 flex items-center gap-1">
                                        <Info size={10} /> General Stock
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                                        <CheckCircle2 size={10} /> Model Match
                                    </span>
                                )
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400">— Choose or search part from inventory —</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-gray-400">
                    <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--brand-lime)]' : ''}`}
                    />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-[100] left-0 right-0 mt-2 border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden bg-[#181818] animate-fadeIn">
                    {/* Search Input Bar */}
                    <div className="p-3 border-b border-[var(--border-main)]/40 bg-white/[0.02] flex items-center gap-2">
                        <Search size={15} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Type to search by name, part number, ID, or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-gray-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="p-1 text-gray-400 hover:text-white rounded-md"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Section Header */}
                    <div className="px-3.5 py-2 bg-white/[0.01] border-b border-[var(--border-main)]/20 flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                        <span>
                            {searchQuery ? `Search Results (${displayedParts.length})` : `First ${Math.min(parts.length, 8)} of ${parts.length} parts`}
                        </span>
                        <span className="text-[9px] font-normal lowercase tracking-normal text-gray-400">
                            {searchQuery ? 'type to refine' : 'all parts accessible'}
                        </span>
                    </div>

                    {/* Parts List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-main)]/20 scrollbar-none">
                        {displayedParts.length === 0 ? (
                            <div className="p-6 text-center space-y-2">
                                <Package size={22} className="mx-auto text-gray-400 opacity-40" />
                                <p className="text-xs text-gray-400 font-semibold">
                                    No inventory parts match "{searchQuery}"
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    Try searching by a broader keyword, part number, or category.
                                </p>
                            </div>
                        ) : (
                            displayedParts.map((p) => {
                                const isSelected = selectedPart?._id === p._id;
                                const available = p.quantityOnHand - p.quantityReserved;
                                const isOutOfStock = available <= 0;
                                const comp = checkVehicleCompatibility(p, vehicleObj);

                                return (
                                    <button
                                        key={p._id}
                                        type="button"
                                        onClick={() => handleSelect(p)}
                                        className={`w-full p-3.5 text-left transition-colors flex items-start justify-between gap-3 group cursor-pointer ${
                                            isSelected
                                                ? 'bg-[var(--brand-lime-alpha)] hover:bg-[var(--brand-lime-alpha)]'
                                                : 'hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`text-xs font-bold transition-colors ${
                                                        isSelected
                                                            ? 'text-[var(--brand-lime)]'
                                                            : 'text-white group-hover:text-[var(--brand-lime)]'
                                                    }`}
                                                >
                                                    {p.partName}
                                                </span>
                                                {p.partNumber && (
                                                    <span className="font-mono text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                                                        {p.partNumber}
                                                    </span>
                                                )}
                                                {p.category && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-semibold">
                                                        {p.category}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
                                                <span className="font-mono text-[9px] text-gray-400">
                                                    ID: {p._id.slice(-8)}
                                                </span>
                                                <span>•</span>
                                                <span
                                                    className={`font-semibold ${
                                                        !isOutOfStock ? 'text-emerald-400' : 'text-red-400'
                                                    }`}
                                                >
                                                    {!isOutOfStock ? `${available} ${p.unit || 'units'} available` : 'Out of stock'}
                                                </span>
                                                <span>•</span>
                                                <span className="font-mono font-medium text-gray-300">
                                                    ${(p.unitCost || 0).toFixed(2)}
                                                </span>
                                            </div>

                                            {/* Compatibility pill */}
                                            {comp.status === 'MISMATCH' ? (
                                                <div className="text-[10px] text-amber-300/90 flex items-center gap-1.5 font-medium pt-0.5">
                                                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                                                    <span className="truncate">
                                                        {comp.modelDetected ? `Assigned for ${comp.modelDetected}` : 'Other vehicle model part'}
                                                    </span>
                                                </div>
                                            ) : comp.status === 'GENERAL' ? (
                                                <div className="text-[10px] text-sky-300/80 flex items-center gap-1 font-medium pt-0.5">
                                                    <Info size={11} className="text-sky-400 flex-shrink-0" />
                                                    <span>General Stock / Universal item</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-emerald-400/80 flex items-center gap-1 font-medium pt-0.5">
                                                    <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                                                    <span>Matches work order vehicle</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            {isSelected && (
                                                <span className="w-5 h-5 rounded-full bg-[var(--brand-lime)] text-black flex items-center justify-center">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                            <span className="text-xs font-mono font-bold text-white">
                                                ${(p.unitCost || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableInventoryPartSelect;
