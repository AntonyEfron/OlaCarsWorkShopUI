import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Loader2, Info, ListChecks, Package, Clock, Shield, Camera,
    Play, Pause, Square, PlusCircle, Trash2, CheckCircle2, ChevronRight, ChevronLeft, ArrowRight, Upload, AlertTriangle,
    Receipt, CreditCard, DollarSign, MapPin, ExternalLink, X, Plus, Pencil,
    Eye, Check, CheckCheck, Sparkles, Maximize2, FileCheck2, Wrench, AlertCircle, Layers, ZoomIn,
    User, Search, ChevronDown, ChevronUp, Phone, Mail, Car, FileText, Printer
} from 'lucide-react';
import {
    getWorkOrderById, progressWorkOrderStatus, addTask, updateTask, removeTask, toggleTaskDoable,
    addPart, updatePart, removePart, logLabour, generateQC, submitQC, addPhoto, addPhotoFile, removePhoto,
    generateBill, approveBill, markBillPaid, getServiceBillById, releaseVehicle,
    getHourlyLabourRate, getTaxProfiles, approvePart, rejectPart, approveAllParts,
    addPartQuantity, updatePartQuantity,
    getBillingDrivers, type BillingDriver,
    type WorkOrder, type WorkOrderPart, type WorkOrderStatus, type TaskStatus, type PartStatus,
    type QCResult, type AddTaskPayload, type AddPartPayload, type PartSource,
    type TaxProfile,
} from '../services/workOrderService';
import { getUserId, getUser, getUserRole } from '../utils/auth';
import { getParts, getPartById, type InventoryPart } from '../services/inventoryService';
import {
    getVehicleGpsLocation, getGpsDevices, getVehicleGpsMileage, getVehicleGpsTrack, getVehicleGpsObdData,
    type GpsLocationData, type GpsMileageData, type GpsTrackPoint, type GpsObdData
} from '../services/vehicleService';
import toast from 'react-hot-toast';
import workshopLogo from '../assets/image.png';
import SearchableInventoryPartSelect from '../components/SearchableInventoryPartSelect';
import ConfirmAddPartModal from '../components/ConfirmAddPartModal';

type Tab = 'tasks' | 'labour' | 'qc' | 'billing';

const ALLOWED_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
    TASKS: ['LABOUR', 'CANCELLED'],
    LABOUR: ['QC_PHOTOS', 'TASKS', 'CANCELLED'],
    QC_PHOTOS: ['BILLING', 'LABOUR', 'CANCELLED'],
    BILLING: ['QC_PHOTOS'],
};

const normalizeStatus = (status?: string): WorkOrderStatus => {
    if (!status) return 'TASKS';
    if (["DRAFT", "START", "VEHICLE_CHECKED_IN", "PARTS_REQUESTED", "PARTS_RECEIVED"].includes(status)) {
        return "TASKS";
    }
    if (["IN_PROGRESS", "PAUSED", "ADDITIONAL_WORK_FOUND"].includes(status)) {
        return "LABOUR";
    }
    if (["QUALITY_CHECK", "FAILED_QC", "READY_FOR_RELEASE"].includes(status)) {
        return "QC_PHOTOS";
    }
    if (["VEHICLE_RELEASED", "INVOICED", "CLOSED"].includes(status)) {
        return "BILLING";
    }
    return status as WorkOrderStatus;
};

const WorkOrderDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const isInitialLoadRef = useRef(true);
    const isReleasedOrLater = wo ? ['BILLING', 'CANCELLED'].includes(normalizeStatus(wo.status)) : false;
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('tasks');
    const [actionLoading, setActionLoading] = useState(false);
    const [showGpsModal, setShowGpsModal] = useState(false);

    /* ── Progressive QC Flow state ── */
    const [qcActiveStage, setQcActiveStage] = useState<'tasks' | 'general_parts' | 'repair_photos' | 'summary'>('tasks');
    const [qcCurrentTaskIndex, setQcCurrentTaskIndex] = useState<number>(0);
    const [qcViewMode, setQcViewMode] = useState<'progressive' | 'overview'>('progressive');
    const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption?: string; stage?: string } | null>(null);

    const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'tasks', label: 'Tasks & Parts', icon: ListChecks },
        { key: 'labour', label: 'Labour', icon: Clock },
        { key: 'qc', label: 'QC & Photos', icon: Shield },
        { key: 'billing', label: 'Billing', icon: Receipt },
    ];

    /* ── Task form state ── */
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [customTaskMode, setCustomTaskMode] = useState(false);
    const [taskForm, setTaskForm] = useState<AddTaskPayload>({ description: '', category: 'Mechanical', estimatedHours: 1 });

    /* ── Part form state ── */
    const [showPartForm, setShowPartForm] = useState(false);
    const [partForm, setPartForm] = useState<AddPartPayload>({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
    const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
    const [selectedInventoryPart, setSelectedInventoryPart] = useState<InventoryPart | null>(null);
    const [showConfirmAddPartModal, setShowConfirmAddPartModal] = useState(false);
    const [partsLoading, setPartsLoading] = useState(false);
    const user = getUser();
    const branchId = (user?.branchId as string) || '';

    /* ── Edit Part Quantity & Inventory Availability State ── */
    const [selectedPartForQty, setSelectedPartForQty] = useState<WorkOrderPart | null>(null);
    const [manualQtyInput, setManualQtyInput] = useState<string>('');
    const [checkingStock, setCheckingStock] = useState<boolean>(false);
    const [inventoryStockInfo, setInventoryStockInfo] = useState<{
        available: number;
        onHand: number;
        reserved: number;
        blocked?: number;
        isBlocked?: boolean;
        blockedReason?: string;
    } | null>(null);
    const [qtySubmitting, setQtySubmitting] = useState<boolean>(false);

    const handleOpenEditQtyModal = async (part: WorkOrderPart) => {
        setSelectedPartForQty(part);
        setManualQtyInput(part.quantity.toString());
        setInventoryStockInfo(null);

        // Fetch live inventory availability from backend
        const invPartId = typeof part.inventoryPartId === 'object'
            ? (part.inventoryPartId as any)?._id
            : part.inventoryPartId;

        const effectivePartId = invPartId || inventoryParts.find(p => 
            (part.partNumber && p.partNumber === part.partNumber) || 
            (part.partName && p.partName.toLowerCase() === part.partName.toLowerCase())
        )?._id;

        if (effectivePartId) {
            setCheckingStock(true);
            try {
                const livePart = await getPartById(effectivePartId);
                if (livePart) {
                    const available = Math.max(0, (livePart.quantityOnHand || 0) - (livePart.quantityReserved || 0) - (livePart.quantityBlocked || 0));
                    setInventoryStockInfo({
                        available,
                        onHand: livePart.quantityOnHand || 0,
                        reserved: livePart.quantityReserved || 0,
                        blocked: livePart.quantityBlocked || 0,
                        isBlocked: livePart.isBlocked || false,
                        blockedReason: livePart.blockedReason,
                    });
                }
            } catch {
                // Fallback to locally loaded inventory list
                const local = inventoryParts.find(p => p._id === effectivePartId);
                if (local) {
                    const available = Math.max(0, (local.quantityOnHand || 0) - (local.quantityReserved || 0) - (local.quantityBlocked || 0));
                    setInventoryStockInfo({
                        available,
                        onHand: local.quantityOnHand || 0,
                        reserved: local.quantityReserved || 0,
                        blocked: local.quantityBlocked || 0,
                        isBlocked: local.isBlocked || false,
                        blockedReason: local.blockedReason,
                    });
                }
            } finally {
                setCheckingStock(false);
            }
        }
    };

    const handleConfirmEditQty = async () => {
        if (!selectedPartForQty || !id) return;
        const newQty = parseFloat(manualQtyInput);
        if (isNaN(newQty) || newQty <= 0) {
            toast.error('Please enter a valid positive quantity greater than 0.');
            return;
        }

        const delta = Math.round((newQty - selectedPartForQty.quantity) * 1000) / 1000;
        if (delta === 0) {
            toast('Quantity is unchanged.', { icon: 'ℹ️' });
            setSelectedPartForQty(null);
            return;
        }

        // Validate available inventory if increasing
        if (delta > 0 && inventoryStockInfo) {
            if (inventoryStockInfo.isBlocked) {
                toast.error(`Part is blocked: ${inventoryStockInfo.blockedReason || 'Blocked from issuance'}`);
                return;
            }
            if (delta > inventoryStockInfo.available) {
                toast.error(`Insufficient inventory stock! Only ${inventoryStockInfo.available} units available in stock (+${delta} requested).`);
                return;
            }
        }

        setQtySubmitting(true);
        try {
            const updated = await addPartQuantity(id, selectedPartForQty._id, {
                newQuantity: newQty,
                additionalQuantity: delta > 0 ? delta : undefined
            });
            setWo(updated);
            if (delta > 0) {
                toast.success(`Quantity updated to ${newQty} (+${delta} sent for manager approval).`);
            } else {
                toast.success(`Quantity updated to ${newQty}.`);
            }
            setSelectedPartForQty(null);
            setManualQtyInput('');
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || 'Failed to update quantity.');
        } finally {
            setQtySubmitting(false);
        }
    };

    /* ── Photo form ── */
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    /* ── Release form ── */
    const [releaseOdometer, setReleaseOdometer] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');


    /* ── Additional Work Modal ── */
    const [showAdditionalWorkModal, setShowAdditionalWorkModal] = useState(false);
    const [additionalWorkScope, setAdditionalWorkScope] = useState('');
    const [additionalWorkTask, setAdditionalWorkTask] = useState('');

    /* ── Service Bill ── */
    const [bill, setBill] = useState<any>(null);
    const [showBillModal, setShowBillModal] = useState(false);
    const [isDriverBilled, setIsDriverBilled] = useState(false);
    const [billingDrivers, setBillingDrivers] = useState<BillingDriver[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [driverSearchQuery, setDriverSearchQuery] = useState('');
    const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
    const [driversLoading, setDriversLoading] = useState(false);
    const driverDropdownRef = useRef<HTMLDivElement | null>(null);

    // Close driver dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (driverDropdownRef.current && !driverDropdownRef.current.contains(event.target as Node)) {
                setIsDriverDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock background scroll when invoice preview modal is open so modal scrolls cleanly
    useEffect(() => {
        if (showBillModal) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [showBillModal]);

    // Handle ESC key to dismiss invoice preview modal
    useEffect(() => {
        if (!showBillModal) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowBillModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showBillModal]);

    // Sync customerId whenever selected driver changes
    useEffect(() => {
        if (selectedDriverId && billingDrivers.length > 0) {
            const matched = billingDrivers.find(d => d._id === selectedDriverId);
            if (matched && matched.customer?._id) {
                setSelectedCustomerId(matched.customer._id);
            }
        }
    }, [selectedDriverId, billingDrivers]);

    const [hourlyRate, setHourlyRate] = useState(150);
    const [taxRate, setTaxRate] = useState(7);
    const [taxProfileId, setTaxProfileId] = useState('');
    const [taxName, setTaxName] = useState('ITBMS 7%');
    const [taxProfiles, setTaxProfiles] = useState<any[]>([]);

    /* ── Labour Work Start/End Time state (Hours and Minutes inputs) ── */
    const [startHour, setStartHour] = useState<string>('00');
    const [startMin, setStartMin] = useState<string>('00');
    const [endHour, setEndHour] = useState<string>('00');
    const [endMin, setEndMin] = useState<string>('00');
    const [labourDebugInfo, setLabourDebugInfo] = useState<string | null>(null);

    useEffect(() => {
        if (wo) {
            if (wo.workStartTime) {
                const date = new Date(wo.workStartTime);
                if (!isNaN(date.getTime())) {
                    setStartHour(String(date.getHours()).padStart(2, '0'));
                    setStartMin(String(date.getMinutes()).padStart(2, '0'));
                }
            } else {
                setStartHour('00');
                setStartMin('00');
            }
            if (wo.workEndTime) {
                const date = new Date(wo.workEndTime);
                if (!isNaN(date.getTime())) {
                    setEndHour(String(date.getHours()).padStart(2, '0'));
                    setEndMin(String(date.getMinutes()).padStart(2, '0'));
                }
            } else {
                setEndHour('00');
                setEndMin('00');
            }
        }
    }, [wo]);

    /* ── GPS Data state ── */
    const [gpsData, setGpsData] = useState<GpsLocationData | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsMileage, setGpsMileage] = useState<GpsMileageData | null>(null);
    const [gpsTrack, setGpsTrack] = useState<GpsTrackPoint[]>([]);
    const [obdData, setObdData] = useState<GpsObdData | null>(null);
    const [resolvedImei, setResolvedImei] = useState<string>('');

    /* ── Camera/Webcam states & refs ── */
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraTargetSlot, setCameraTargetSlot] = useState<{ stage: string; label: string } | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Camera capture effect
    useEffect(() => {
        if (isCameraOpen && videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [isCameraOpen, cameraStream]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setCameraStream(stream);
            setIsCameraOpen(true);
        } catch (err: any) {
            console.error('Camera access error:', err);
            toast.error('Camera access denied or unavailable');
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraOpen(false);
        setCameraTargetSlot(null);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !cameraTargetSlot) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `verification_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    doAction(() => addPhotoFile(id!, file, cameraTargetSlot.stage as any, cameraTargetSlot.label || undefined));
                }
            }, 'image/jpeg', 0.85);
        }
        stopCamera();
    };

    const triggerUpload = (target: { stage: string; label: string }) => {
        setCameraTargetSlot(target);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    };

    const triggerCamera = async (target: { stage: string; label: string }) => {
        setCameraTargetSlot(target);
        await startCamera();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && cameraTargetSlot) {
            doAction(() => addPhotoFile(id!, file, cameraTargetSlot.stage as any, cameraTargetSlot.label || undefined));
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    const load = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getWorkOrderById(id);
            setWo(data);

            if (isInitialLoadRef.current) {
                const normStatus = normalizeStatus(data.status);
                if (normStatus === 'TASKS') setActiveTab('tasks');
                else if (normStatus === 'LABOUR') setActiveTab('labour');
                else if (normStatus === 'QC_PHOTOS') setActiveTab('qc');
                else if (normStatus === 'BILLING') setActiveTab('billing');
                isInitialLoadRef.current = false;
            }

            // Load custom hourly rate preference
            try {
                const rate = await getHourlyLabourRate();
                setHourlyRate(rate);
            } catch { }

            try {
                const taxes = await getTaxProfiles();
                setTaxProfiles(taxes || []);
                // Prioritize ITBMS 7% profile as default
                const itbms = taxes?.find((t: any) => /itbms/i.test(t.name) && Number(t.rate) === 7)
                    || taxes?.find((t: any) => t.name === 'ITBMS 7%')
                    || taxes?.find((t: any) => /itbms/i.test(t.name))
                    || taxes?.find((t: any) => Number(t.rate) === 7);
                if (itbms) {
                    setTaxRate(itbms.rate);
                    setTaxProfileId(itbms._id);
                    setTaxName(itbms.name);
                } else if (taxes?.length) {
                    setTaxRate(taxes[0].rate);
                    setTaxProfileId(taxes[0]._id);
                    setTaxName(taxes[0].name);
                }
            } catch { }

            // Load billing drivers
            try {
                setDriversLoading(true);
                const drivers = await getBillingDrivers();
                setBillingDrivers(drivers || []);
            } catch (driverErr) {
                console.error("Failed to fetch billing drivers", driverErr);
            } finally {
                setDriversLoading(false);
            }

            if (data.serviceBillId) {
                const b = await getServiceBillById(data.serviceBillId);
                setBill(b);
                if (b) {
                    setIsDriverBilled(!!b.isDriverBilled);
                    if (b.driverId) {
                        setSelectedDriverId(typeof b.driverId === 'object' ? b.driverId._id : b.driverId);
                    }
                    if (b.customerId) {
                        setSelectedCustomerId(typeof b.customerId === 'object' ? b.customerId._id : b.customerId);
                    }
                }
            } else {
                setBill(null);
                // Default isDriverBilled to true if vehicle has current driver assigned
                const v = data.vehicleId as any;
                if (v && v.currentDriver) {
                    setIsDriverBilled(true);
                    const vDriverId = typeof v.currentDriver === 'object' ? v.currentDriver._id : v.currentDriver;
                    if (vDriverId) {
                        setSelectedDriverId(vDriverId);
                    }
                } else {
                    setIsDriverBilled(false);
                }
            }
        } catch { /* interceptor */ } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // Ensure bill is loaded if serviceBillId exists but bill state is null
    useEffect(() => {
        if (wo?.serviceBillId && !bill) {
            getServiceBillById(wo.serviceBillId).then(b => {
                setBill(b);
                if (b) {
                    setIsDriverBilled(!!b.isDriverBilled);
                    if (b.driverId) {
                        setSelectedDriverId(typeof b.driverId === 'object' ? b.driverId._id : b.driverId);
                    }
                    if (b.customerId) {
                        setSelectedCustomerId(typeof b.customerId === 'object' ? b.customerId._id : b.customerId);
                    }
                }
            }).catch(() => { });
        }
    }, [wo?.serviceBillId, bill]);

    // Load inventory parts for the dropdown (all active branch parts accessible)
    useEffect(() => {
        const woBranchId = typeof wo?.branchId === 'object' ? (wo.branchId as any)?._id : wo?.branchId;
        const fetchBranchId = woBranchId || branchId;
        if (fetchBranchId) {
            setPartsLoading(true);
            getParts({ branchId: fetchBranchId }).then(parts => {
                const activeParts = Array.isArray(parts) ? parts.filter(p => p.isActive !== false) : [];
                setInventoryParts(activeParts);
            }).catch(() => { }).finally(() => setPartsLoading(false));
        }
    }, [wo?.branchId, branchId]);

    const matchGpsDevice = (devices: any[], plate?: string, vin?: string) => {
        if (!plate && !vin) return null;
        const cleanPlate = plate ? plate.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const cleanVin = vin ? vin.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

        // 1. First pass: try exact matches (strongest match first)
        let found = devices.find(d => {
            const dName = d.deviceName ? String(d.deviceName).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const dPlate = d.plateNum || d.plateNo || d.licencePlate || d.plate || d.plateNumber;
            const dPlateClean = dPlate ? String(dPlate).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const dImei = d.imei ? String(d.imei).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

            if (cleanPlate && (dName === cleanPlate || dPlateClean === cleanPlate)) {
                return true;
            }
            if (cleanVin && (dName === cleanVin || dImei === cleanVin)) {
                return true;
            }
            return false;
        });

        if (found) return found;

        // 2. Second pass: try partial/contained matches if length of query is reasonable (>= 4 chars)
        found = devices.find(d => {
            const dName = d.deviceName ? String(d.deviceName).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const dPlate = d.plateNum || d.plateNo || d.licencePlate || d.plate || d.plateNumber;
            const dPlateClean = dPlate ? String(dPlate).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const dImei = d.imei ? String(d.imei).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

            if (cleanPlate && cleanPlate.length >= 4 && (dName.includes(cleanPlate) || dPlateClean.includes(cleanPlate))) {
                return true;
            }
            if (cleanVin && cleanVin.length >= 4 && (dImei.includes(cleanVin) || dName.includes(cleanVin))) {
                return true;
            }
            return false;
        });

        return found;
    };

    const loadGps = useCallback(async (imei: string | undefined, plate: string, vin: string) => {
        setGpsLoading(true);
        try {
            let activeImei = imei;
            let matchType = '';

            if (!activeImei) {
                // Fetch all GPS devices and try to auto-match by plate number or VIN
                const devices = await getGpsDevices();
                const matchedDevice = matchGpsDevice(devices, plate, vin);
                if (matchedDevice) {
                    activeImei = matchedDevice.imei;
                    matchType = `Auto-matched GPS (Plate/Name: ${matchedDevice.plateNum || matchedDevice.deviceName || activeImei})`;
                }
            } else {
                matchType = 'Configured GPS Tracker';
            }

            setResolvedImei(activeImei || '');

            if (activeImei) {
                const [locationData, mileageData, trackData, obdResponse] = await Promise.all([
                    getVehicleGpsLocation(activeImei),
                    getVehicleGpsMileage(activeImei).catch(() => []),
                    getVehicleGpsTrack(activeImei).catch(() => []),
                    getVehicleGpsObdData(activeImei).catch((err) => {
                        console.error("[GPS Component] Failed to load OBD data:", err);
                        return null;
                    })
                ]);
                console.log(gpsMileage, "gpsMileage")
                setGpsData(locationData ? { ...locationData, matchType, imei: activeImei } : null);
                setGpsMileage(mileageData && mileageData.length > 0 ? mileageData[0] : null);
                console.log(trackData, 'trackData');
                setGpsTrack(trackData || []);

                console.log("[GPS Component] OBD API response:", obdResponse);
                const obdRecord = obdResponse?.data?.result?.[0] || obdResponse?.result?.[0] || null;
                console.log("[GPS Component] OBD resolved record:", obdRecord);
                setObdData(obdRecord);
            } else {
                setGpsData(null);
                setGpsMileage(null);
                setGpsTrack([]);
                setObdData(null);
            }
        } catch (err) {
            console.error('Failed to load GPS location', err);
        } finally {
            setGpsLoading(false);
        }
    }, []);

    useEffect(() => {
        const vehicleObj = typeof wo?.vehicleId === 'object' ? wo.vehicleId : null;
        const imei = vehicleObj?.gpsSerialNumber;
        const plate = vehicleObj?.legalDocs?.registrationNumber || '';
        const vin = vehicleObj?.basicDetails?.vin || '';

        if ((imei || plate || vin) && showGpsModal) {
            loadGps(imei, plate, vin);
        } else if (!showGpsModal) {
            setGpsData(null);
            setGpsMileage(null);
            setGpsTrack([]);
            setResolvedImei('');
        }
    }, [wo?.vehicleId, showGpsModal, loadGps]);

    const handleBackendError = (err: any) => {
        const msg = (err.response?.data?.message || err.message || '').toLowerCase();
        if (msg.includes('labour') || msg.includes('work start') || msg.includes('times must be updated') || msg.includes('hours must be greater') || msg.includes('actual labour')) setActiveTab('labour');
        else if (msg.includes('part')) setActiveTab('tasks');
        else if (msg.includes('task')) setActiveTab('tasks');
        else if (msg.includes('photo') || msg.includes('qc')) setActiveTab('qc');
        else if (msg.includes('odometer') || msg.includes('entry') || msg.includes('additional work')) setActiveTab('tasks');
        else if (msg.includes('payment') || msg.includes('bill')) setActiveTab('billing');
        return err;
    };

    const doAction = async (fn: () => Promise<unknown>) => {
        setActionLoading(true);
        try {
            await fn();
            await load();
        } catch (err: any) {
            handleBackendError(err);
            throw err;
        } finally {
            setActionLoading(false);
        }
    };

    const handleTransition = async (targetStatus: WorkOrderStatus, targetTab: Tab) => {
        if (targetStatus === 'LABOUR' && wo?.status === 'TASKS') {
            const doableTasks = (wo.tasks || []).filter(t => t.isDoable);
            if (doableTasks.length === 0) {
                toast.error("At least one task must be selected before proceeding to Labour.");
                setActiveTab('tasks');
                return;
            }
        }

        if (targetStatus === 'QC_PHOTOS' && wo?.status === 'LABOUR') {
            if (!wo.workStartTime || !wo.workEndTime) {
                toast.error("Please log labour start and end times before proceeding to QC & Photos.");
                setActiveTab('labour');
                return;
            }
        }

        if (targetStatus === 'BILLING' && normalizeStatus(wo?.status) === 'QC_PHOTOS') {
            const doableTasks = (wo?.tasks || []).filter(t => t.isDoable);
            const incompleteTasks = doableTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
            if (incompleteTasks.length > 0) {
                toast.error(`Please complete or skip all tasks: ${incompleteTasks.length} task(s) remaining.`);
                setActiveTab('qc');
                return;
            }

            const activeParts = (wo?.parts || []).filter(p => !p.taskTemplateId || doableTasks.some(t => t.taskTemplateId && p.taskTemplateId && t.taskTemplateId.toString() === p.taskTemplateId.toString()));
            const uninstalledParts = activeParts.filter(p => p.status !== 'INSTALLED' && p.status !== 'RETURNED');
            if (uninstalledParts.length > 0) {
                toast.error(`Please install or return all parts: ${uninstalledParts.length} part(s) remaining.`);
                setActiveTab('qc');
                return;
            }

            const missingTaskPhotos = doableTasks.filter(t => {
                if (t.status !== 'COMPLETED') return false;
                const hasOld = wo?.photos.some(p => p.caption === `TASK_${t._id}_OLD` || p.caption === `TASK_${t._id}_DETACHED`);
                const hasNew = wo?.photos.some(p => p.caption === `TASK_${t._id}_NEW` || p.caption === `TASK_${t._id}_FIXED`);
                const hasLegacy = wo?.photos.some(p => p.caption === `TASK_${t._id}`);
                return (!hasOld || !hasNew) && !hasLegacy;
            });
            if (missingTaskPhotos.length > 0) {
                toast.error(`Please upload both detached old part and new fixed part photos for completed tasks: ${missingTaskPhotos.map(t => t.description).join(', ')}`);
                setActiveTab('qc');
                return;
            }
        }

        await doAction(async () => {
            const res = await progressWorkOrderStatus(id!, targetStatus);
            setActiveTab(targetTab);
            return res;
        });
    };

    /* ── Helpers ── */
    const getStatusBadge = (status: string) => {
        if (status === 'TASKS') return 'badge-blue';
        if (status === 'LABOUR') return 'badge-lime';
        if (status === 'QC_PHOTOS') return 'badge-orange';
        if (status === 'BILLING') return 'badge-green';
        if (status === 'CANCELLED') return 'badge-red';
        return 'badge-gray';
    };
    const fmtStatus = (s: string) => s.replace(/_/g, ' ');
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleString() : '—';

    const vehicleLabel = () => {
        if (!wo) return '';
        const v = wo.vehicleId;
        if (typeof v === 'object' && v) {
            const bd = (v as Record<string, unknown>).basicDetails as Record<string, unknown> | undefined;
            if (bd) return `${bd.make || ''} ${bd.model || ''} ${bd.year || ''}`.trim();
        }
        return typeof v === 'string' ? v : 'N/A';
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} /></div>
    );
    if (!wo) return (
        <div className="text-center py-20"><p style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p></div>
    );

    const nextStatuses = ALLOWED_TRANSITIONS[wo.status] || [];

    return (
        <div className="space-y-5 animate-fadeInUp pb-56 md:pb-28">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                <button className="btn-icon flex-shrink-0" onClick={() => navigate('/work-orders')} id="back-to-list"><ArrowLeft size={18} /></button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{wo.workOrderNumber}</h1>
                        <span className={`badge ${getStatusBadge(wo.status)}`}>{fmtStatus(wo.status)}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {vehicleLabel()} • {wo.workOrderType.replace(/_/g, ' ')}
                        {(() => {
                            const v = wo.vehicleId as any;
                            if (v?.currentDriver) {
                                return (
                                    <span className="ml-2 px-2 py-0.5 bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] rounded-md text-[10px] font-bold uppercase tracking-wider">
                                        Driver: {v.currentDriver.personalInfo?.fullName}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </p>
                </div>
                </div>

                {/* Edit Work Order Button (Top Right) */}
                <div className="flex items-center gap-2 self-start">
                    <button
                        type="button"
                        id="edit-work-order-btn"
                        onClick={() => navigate(`/work-orders/edit/${id}`)}
                        className="btn-secondary !h-10 !px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 rounded-xl border border-[var(--border-main)] hover:border-[var(--brand-lime)] hover:text-[var(--brand-lime)] transition-all cursor-pointer shadow-sm group"
                    >
                        <Pencil size={14} className="text-[var(--brand-lime)] group-hover:rotate-12 transition-transform" />
                        Edit Work Order
                    </button>
                </div>
            </div>



            {/* ── Additional Work Modal ── */}
            {showAdditionalWorkModal && (
                <div className="glass-card p-5 border-orange/30 animate-scaleIn">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-orange/10 text-orange">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">{t('workOrders.detail.additionalWorkTitle') || 'Additional Work Found'}</h3>
                            <p className="text-xs text-muted-foreground">{t('workOrders.detail.additionalWorkSubtitle') || 'Document newly discovered issues'}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                                {t('workOrders.detail.additionalWorkScope') || 'Description of Issue / Scope'}
                            </label>
                            <textarea
                                value={additionalWorkScope}
                                onChange={(e) => setAdditionalWorkScope(e.target.value)}
                                placeholder="E.g. Found crack in rear brake disc while inspecting pads."
                                className="input-field w-full min-h-[80px] py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                                {t('workOrders.detail.additionalWorkTask') || 'Create Official Task'}
                            </label>
                            <input
                                type="text"
                                value={additionalWorkTask}
                                onChange={(e) => setAdditionalWorkTask(e.target.value)}
                                placeholder="E.g. Replace rear brake disc"
                                className="input-field w-full"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="btn-secondary flex-1 text-xs"
                                onClick={() => {
                                    setShowAdditionalWorkModal(false);
                                    setAdditionalWorkScope('');
                                    setAdditionalWorkTask('');
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn-primary flex-1 text-xs"
                                disabled={!additionalWorkScope || !additionalWorkTask || actionLoading}
                                onClick={() => doAction(async () => {
                                    // 1. Add the additional task
                                    const res = await addTask(id!, {
                                        description: `[ADDITIONAL WORK] ${additionalWorkTask}`,
                                        category: 'Mechanical',
                                        estimatedHours: 1,
                                        notes: additionalWorkScope
                                    });

                                    // 2. record the finding in status history without changing status
                                    await progressWorkOrderStatus(id!, wo!.status, `Additional work identified: ${additionalWorkScope}`);

                                    setShowAdditionalWorkModal(false);
                                    setAdditionalWorkScope('');
                                    setAdditionalWorkTask('');
                                    load();
                                    return res;
                                })}
                            >
                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

              {/* ── Overview Summary Banner ── */}
            <div className="glass-card p-5 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 border border-[var(--border-main)]/50 rounded-2xl relative overflow-hidden">
                <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Fault Description</span>
                    <p className="text-sm font-semibold text-white">{wo.faultDescription}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Vehicle Details</span>
                    <p className="text-sm font-semibold text-white">{vehicleLabel()}</p>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="text-left md:text-right">
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Priority / Type</span>
                        <span className="text-xs font-semibold text-white">{wo.priority} • {wo.workOrderType.replace(/_/g, ' ')}</span>
                    </div>
                    {/* GPS Tracking Trigger */}
                    <button 
                        className="btn-secondary !py-2 !px-4 text-xs font-bold uppercase flex items-center gap-1.5"
                        onClick={() => {
                            const vehicleObj = typeof wo.vehicleId === 'object' ? wo.vehicleId : null;
                            const gpsImei = vehicleObj?.gpsSerialNumber;
                            const plate = vehicleObj?.legalDocs?.registrationNumber || '';
                            const vin = vehicleObj?.basicDetails?.vin || '';
                            loadGps(gpsImei, plate, vin);
                            setShowGpsModal(true);
                        }}
                    >
                        <MapPin size={14} className="text-lime" style={{ color: 'var(--brand-lime)' }} />
                        GPS Live
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="tab-nav">
                {TABS.map((t_tab) => (
                    <button key={t_tab.key} className={`tab-btn ${activeTab === t_tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(t_tab.key)}>
                        <t_tab.icon size={16} className="inline mr-1.5" />{t_tab.label}
                        {t_tab.key === 'tasks' && wo.tasks.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.tasks.length})</span>}
                    </button>
                ))}
            </div>

            {/* ── TASKS & PARTS TAB ── */}
            {activeTab === 'tasks' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fadeInUp">
                    {/* Tasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.tasks')} ({wo.tasks.length})</h3>
                            {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                <button className="btn-primary text-xs !py-2" onClick={() => setShowTaskForm(!showTaskForm)}>
                                    <PlusCircle size={14} /> Add Task
                                </button>
                            )}
                        </div>
                        {showTaskForm && (
                            <div className="glass-card p-5 space-y-4 border border-[var(--border-main)]/50 rounded-2xl animate-fadeIn">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Quick Add Specific Task</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { name: 'OIL FILTER CHANGE', category: 'Mechanical' as const, hours: 0.5 },
                                        { name: 'AIR FILTER CHANGE', category: 'Mechanical' as const, hours: 0.5 },
                                        { name: 'AC FILTER CHANGE', category: 'Electrical' as const, hours: 0.5 },
                                        { name: 'COOLANT TOP-UP', category: 'Fluids' as const, hours: 0.5 },
                                        { name: 'ENGINE OIL CHANGE', category: 'Fluids' as const, hours: 0.5 },
                                    ].map((preTask) => (
                                        <button
                                            key={preTask.name}
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => doAction(async () => {
                                                await addTask(id!, {
                                                    description: preTask.name,
                                                    category: preTask.category,
                                                    estimatedHours: preTask.hours
                                                });
                                            })}
                                            className="flex flex-col p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[var(--brand-lime)]/50 hover:bg-white/10 text-left transition-all active:scale-[0.98] cursor-pointer group"
                                        >
                                            <span className="text-xs font-bold text-white group-hover:text-[var(--brand-lime)] transition-colors">{preTask.name}</span>
                                            <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{preTask.category} • {preTask.hours}h</span>
                                        </button>
                                    ))}

                                    {/* Add New Task (Custom) Option */}
                                    <button
                                        type="button"
                                        onClick={() => setCustomTaskMode(true)}
                                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-dashed border-[var(--border-main)] hover:border-[var(--brand-lime)] hover:bg-[var(--brand-lime-alpha)] text-center transition-all cursor-pointer min-h-[72px]"
                                    >
                                        <span className="text-xs font-black uppercase text-[var(--brand-lime)] tracking-widest flex items-center gap-1.5">
                                            <PlusCircle size={14} /> ADD NEW TASK
                                        </span>
                                    </button>
                                </div>

                                {customTaskMode && (
                                    <div className="border-t border-[var(--border-main)]/30 pt-4 space-y-3 mt-2 animate-fadeIn">
                                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Custom Task Details</h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] uppercase font-bold text-gray-400 ml-1">Task Category</label>
                                                <select
                                                    value={taskForm.category || ''}
                                                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as AddTaskPayload['category'] })}
                                                    className="input-field w-full"
                                                >
                                                    {['Mechanical', 'Electrical', 'Body', 'Tyres', 'Fluids', 'Other'].map((c) => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] uppercase font-bold text-gray-400 ml-1">Est. Hours</label>
                                                <input
                                                    type="number"
                                                    placeholder="Est. hours"
                                                    value={taskForm.estimatedHours || ''}
                                                    onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: Number(e.target.value) })}
                                                    className="input-field w-full"
                                                    min="0"
                                                    step="0.5"
                                                />
                                            </div>
                                            <div className="space-y-1 sm:col-span-3">
                                                <label className="text-[9px] uppercase font-bold text-gray-400 ml-1">Task Description</label>
                                                <input
                                                    placeholder="Enter custom task description..."
                                                    value={taskForm.description}
                                                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                                    className="input-field w-full"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="button"
                                                className="btn-secondary text-xs flex-1"
                                                onClick={() => {
                                                    setCustomTaskMode(false);
                                                    setTaskForm({ description: '', category: 'Mechanical', estimatedHours: 1 });
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-primary text-xs flex-1"
                                                disabled={!taskForm.description || actionLoading}
                                                onClick={() => doAction(async () => {
                                                    await addTask(id!, taskForm);
                                                    setTaskForm({ description: '', category: 'Mechanical', estimatedHours: 1 });
                                                })}
                                            >
                                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Create Custom Task'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-2 border-t border-[var(--border-main)]/20">
                                    <button
                                        type="button"
                                        className="text-[10px] uppercase font-bold text-gray-400 hover:text-white"
                                        onClick={() => {
                                            setShowTaskForm(false);
                                            setCustomTaskMode(false);
                                        }}
                                    >
                                        Close Menu
                                    </button>
                                </div>
                            </div>
                        )}
                        {wo.tasks.length === 0 ? (
                            <div className="glass-card p-8 text-center">
                                <ListChecks size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {wo.tasks.map((task) => {
                                    const isDoable = task.isDoable ?? false;
                                    return (
                                        <div
                                            key={task._id}
                                            className={`glass-card p-4 flex items-center justify-between gap-3 border transition-all duration-300 ${
                                                isDoable
                                                    ? 'border-[var(--brand-lime)]/30 bg-gradient-to-br from-[var(--brand-lime-alpha)]/5 via-[var(--brand-lime-alpha)]/1 to-transparent'
                                                    : 'border-[var(--border-main)]/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                {!['BILLING', 'CANCELLED'].includes(wo.status) ? (
                                                    <button
                                                        type="button"
                                                        disabled={actionLoading}
                                                        onClick={() => doAction(() => toggleTaskDoable(id!, task._id))}
                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-300 mt-0.5 shrink-0 ${
                                                            isDoable
                                                                ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black scale-105 shadow-md shadow-[var(--brand-lime)]/20'
                                                                : 'border-[var(--border-main)] text-transparent hover:border-[var(--brand-lime)] hover:scale-105'
                                                        }`}
                                                        title={isDoable ? "Mark as Not Applicable" : "Mark as Applicable & Assign Parts"}
                                                    >
                                                        <CheckCircle2 size={12} className="stroke-[3]" />
                                                    </button>
                                                ) : (
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 mt-0.5 shrink-0 ${isDoable ? 'bg-[var(--brand-lime)]/50 border-[var(--brand-lime)]/50 text-black/50' : 'border-[var(--border-main)]/30 text-transparent'}`}>
                                                        <CheckCircle2 size={12} className="stroke-[3]" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 select-none">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            onClick={() => {
                                                                if (!['BILLING', 'CANCELLED'].includes(wo.status)) {
                                                                    doAction(() => toggleTaskDoable(id!, task._id));
                                                                }
                                                            }}
                                                            className="text-sm font-medium cursor-pointer hover:text-[var(--brand-lime)] transition-colors"
                                                            style={{ color: 'var(--text-main)' }}
                                                        >
                                                            {task.description}
                                                        </span>
                                                        <span className={`badge text-[10px] ${task.status === 'COMPLETED' ? 'badge-green' : task.status === 'IN_PROGRESS' ? 'badge-lime' : 'badge-gray'}`}>
                                                            {task.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                                        {task.category} • Est: {task.estimatedHours || 0}h{task.actualHours ? ` • Actual: ${task.actualHours}h` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                                    <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                        onClick={() => {
                                                            if (window.confirm('Are you sure you want to remove this task?')) {
                                                                doAction(() => removeTask(id!, task._id));
                                                            }
                                                        }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Parts Section */}
                    <div className="space-y-4 lg:border-l lg:border-[var(--border-main)]/20 lg:pl-8 relative z-20">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.parts')} ({wo.parts.length})</h3>
                            {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                <button className="btn-primary text-xs !py-2" onClick={() => setShowPartForm(!showPartForm)}>
                                    <PlusCircle size={14} /> Add Part
                                </button>
                            )}
                        </div>
                        {showPartForm && (
                            <div className="glass-card p-4 space-y-3 relative z-30">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Select Part from Inventory *</label>
                                    <SearchableInventoryPartSelect
                                        parts={inventoryParts}
                                        selectedPart={selectedInventoryPart}
                                        onSelectPart={(part) => {
                                            setSelectedInventoryPart(part);
                                            setPartForm({
                                                ...partForm,
                                                partName: part.partName,
                                                partNumber: part.partNumber,
                                                unitCost: part.unitCost,
                                                inventoryPartId: part._id,
                                                source: 'IN_STOCK',
                                            });
                                        }}
                                        loading={partsLoading}
                                        vehicleObj={wo.vehicleId}
                                    />
                                </div>
                                {selectedInventoryPart && (() => {
                                    const available = selectedInventoryPart.quantityOnHand - selectedInventoryPart.quantityReserved;
                                    const isOutOfStock = available <= 0;
                                    const isInsufficient = !isOutOfStock && available < partForm.quantity;
                                    return (
                                        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${isOutOfStock ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            : isInsufficient ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            }`}>
                                            {isOutOfStock ? <AlertTriangle size={14} /> : isInsufficient ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                                            {isOutOfStock
                                                ? 'Out of stock — part will be added as a REQUEST for manager approval.'
                                                : isInsufficient
                                                    ? `Only ${available} available — need ${partForm.quantity}. Will be added as a REQUEST.`
                                                    : `${available} in stock — will be reserved.`
                                            }
                                        </div>
                                    );
                                })()}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Quantity</label>
                                    <input type="number" step="any" placeholder="Qty" value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: parseFloat(e.target.value) || 0 })} className="input-field max-w-[200px]" min="0.001" />
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-secondary text-xs flex-1" onClick={() => { setShowPartForm(false); setSelectedInventoryPart(null); }}>{t('common.cancel')}</button>
                                    <button
                                        type="button"
                                        className="btn-primary text-xs flex-1"
                                        disabled={!selectedInventoryPart || actionLoading || !partForm.quantity || partForm.quantity <= 0}
                                        onClick={() => setShowConfirmAddPartModal(true)}
                                    >
                                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : t('common.add')}
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Pending Approvals Warning Banner */}
                        {(() => {
                            const pendingCount = wo.parts.filter(p => (p as any).approvalStatus === 'PENDING').length;
                            if (pendingCount === 0) return null;
                            const activeRole = (getUserRole() || (user?.role as string) || '').toLowerCase();
                            const isManagerRole = ['workshopmanager', 'branchmanager', 'admin', 'countrymanager', 'operationadmin'].includes(activeRole);
                            return (
                                <div className="glass-card p-4 border border-amber-500/40 bg-amber-500/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300 animate-fadeIn">
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                                        <span>
                                            <strong>{pendingCount} Part(s) Awaiting Workshop Manager Approval</strong> — Parts must be approved before work order can proceed to Labour.
                                        </span>
                                    </div>
                                    {isManagerRole && (
                                        <button
                                            disabled={actionLoading}
                                            onClick={() => doAction(() => approveAllParts(id!))}
                                            className="btn-primary text-xs !py-1.5 !px-3 font-bold shrink-0 flex items-center gap-1"
                                        >
                                            <CheckCircle2 size={13} /> Approve All Parts
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {wo.parts.length === 0 ? (
                            <div className="glass-card p-8 text-center relative z-0">
                                <Package size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.detail.noParts') || 'No parts assigned'}</p>
                            </div>
                        ) : (
                            <div className="space-y-2 relative z-0">
                                {wo.parts.map((part) => {
                                    const appStatus = (part as any).approvalStatus || 'APPROVED';
                                    const activeRole = (getUserRole() || (user?.role as string) || '').toLowerCase();
                                    const isManagerRole = ['workshopmanager', 'branchmanager', 'admin', 'countrymanager', 'operationadmin'].includes(activeRole);
                                    return (
                                        <div key={part._id} className={`glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${
                                            appStatus === 'PENDING' ? 'border-amber-500/30 bg-amber-500/5'
                                            : appStatus === 'REJECTED' ? 'border-red-500/30 bg-red-500/5'
                                            : 'border-[var(--border-main)]/50'
                                        }`}>
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                    appStatus === 'REJECTED' ? 'bg-red-500/10 text-red-400'
                                                    : appStatus === 'PENDING' ? 'bg-amber-500/10 text-amber-400'
                                                    : part.status === 'INSTALLED' ? 'bg-green-500/10 text-green-500'
                                                    : 'bg-blue-500/10 text-blue-500'
                                                }`}>
                                                    {appStatus === 'REJECTED' ? <X className="text-red-400" size={20} />
                                                        : appStatus === 'PENDING' ? <AlertTriangle className="text-amber-400" size={20} />
                                                        : part.status === 'INSTALLED' ? <CheckCircle2 size={20} />
                                                        : <Package size={20} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-white">{part.partName}</p>
                                                        {/* Approval Status Badge */}
                                                        {appStatus === 'APPROVED' ? (
                                                            <span className="badge badge-green text-[10px]">APPROVED</span>
                                                        ) : appStatus === 'PENDING' ? (
                                                            <span className="badge badge-orange text-[10px] flex items-center gap-1">
                                                                <AlertTriangle size={10} /> PENDING APPROVAL
                                                            </span>
                                                        ) : (
                                                            <span className="badge text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">REJECTED</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                                        <span>Qty: <strong className="text-white">{part.quantity}</strong> • ${part.unitCost.toFixed(2)} each = <strong className="text-emerald-400">${part.totalCost.toFixed(2)}</strong></span>
                                                        {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                                            <button
                                                                type="button"
                                                                disabled={actionLoading}
                                                                onClick={() => handleOpenEditQtyModal(part)}
                                                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center ml-0.5 cursor-pointer"
                                                                title="Edit quantity number manually"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        )}
                                                        {Boolean((part as any).pendingAdditionalQuantity && (part as any).pendingAdditionalQuantity > 0) && (
                                                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                                                                (+{(part as any).pendingAdditionalQuantity} pending approval)
                                                            </span>
                                                        )}
                                                    </p>
                                                    {(part as any).rejectionReason && (
                                                        <p className="text-[11px] text-red-400 mt-1 font-semibold">Reason: {(part as any).rejectionReason}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                                                {/* Edit Qty Button: Always available (even after approval) as long as WO is active */}
                                                {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                                    <button
                                                        type="button"
                                                        disabled={actionLoading}
                                                        onClick={() => handleOpenEditQtyModal(part)}
                                                        className="btn-secondary text-xs !py-1.5 !px-2.5 font-bold flex items-center gap-1.5 !bg-amber-500/10 !text-amber-400 !border-amber-500/30 hover:!bg-amber-500/20 transition-all cursor-pointer"
                                                        title="Edit quantity number manually for this assigned part"
                                                    >
                                                        <Pencil size={13} />
                                                        <span>Edit Qty</span>
                                                    </button>
                                                )}

                                                {appStatus === 'PENDING' && isManagerRole && !['BILLING', 'CANCELLED'].includes(wo.status) && (
                                                    <>
                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={() => doAction(() => approvePart(id!, part._id))}
                                                            className="btn-primary text-xs !py-1.5 !px-3 font-bold flex items-center gap-1"
                                                        >
                                                            <CheckCircle2 size={12} /> Approve
                                                        </button>
                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={() => {
                                                                const reason = window.prompt(`Reason for rejecting '${part.partName}':`);
                                                                if (reason !== null) {
                                                                    doAction(() => rejectPart(id!, part._id, reason));
                                                                }
                                                            }}
                                                            className="btn-secondary !text-red-400 text-xs !py-1.5 !px-3 font-bold hover:!bg-red-500/20"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                                    <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                        onClick={() => {
                                                             const confirmMsg = part.status === 'INSTALLED'
                                                                ? 'This part is currently INSTALLED. Removing it will return the stock to inventory. Are you sure you want to delete it?'
                                                                : 'Are you sure you want to remove this part?';
                                                            if (window.confirm(confirmMsg)) {
                                                                doAction(() => removePart(id!, part._id));
                                                            }
                                                        }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════ LABOUR TAB ══════════════════ */}
            {activeTab === 'labour' && (
                <div className="space-y-4">
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.labour')}</h3>
                        <div className="flex flex-col gap-4">
                            {/* Time Taken Box */}
                            <div className="glass-card p-4 text-center border-l-2 border-[var(--brand-lime)] mb-2">
                                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Time Taken</p>
                                <p className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>
                                    {(() => {
                                        const sH = parseInt(startHour, 10);
                                        const sM = parseInt(startMin, 10);
                                        const eH = parseInt(endHour, 10);
                                        const eM = parseInt(endMin, 10);

                                        if (isNaN(sH) || sH < 0 || sH > 23 || isNaN(sM) || sM < 0 || sM > 59) return '--';
                                        if (isNaN(eH) || eH < 0 || eH > 23 || isNaN(eM) || eM < 0 || eM > 59) return '--';

                                        let startTotalMins = sH * 60 + sM;
                                        let endTotalMins = eH * 60 + eM;

                                        if (endTotalMins < startTotalMins) {
                                            endTotalMins += 24 * 60; // overnight
                                        }

                                        const diffMins = endTotalMins - startTotalMins;
                                        const h = Math.floor(diffMins / 60);
                                        const m = diffMins % 60;

                                        return `${h}h ${m}m`;
                                    })()}
                                </p>
                            </div>
                            <div className="mt-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)]/20 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Start Time Section */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
                                            Work Start Time
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="input-field font-mono text-center w-20"
                                                placeholder="HH"
                                                min="0"
                                                max="23"
                                                value={startHour}
                                                onChange={(e) => setStartHour(e.target.value)}
                                                disabled={actionLoading || ['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status)}
                                            />
                                            <span style={{ color: 'var(--text-dim)' }}>:</span>
                                            <input
                                                type="number"
                                                className="input-field font-mono text-center w-20"
                                                placeholder="MM"
                                                min="0"
                                                max="59"
                                                value={startMin}
                                                onChange={(e) => setStartMin(e.target.value)}
                                                disabled={actionLoading || ['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status)}
                                            />
                                        </div>
                                    </div>

                                    {/* End Time Section */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
                                            Work End Time
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="input-field font-mono text-center w-20"
                                                placeholder="HH"
                                                min="0"
                                                max="23"
                                                value={endHour}
                                                onChange={(e) => setEndHour(e.target.value)}
                                                disabled={actionLoading || ['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status)}
                                            />
                                            <span style={{ color: 'var(--text-dim)' }}>:</span>
                                            <input
                                                type="number"
                                                className="input-field font-mono text-center w-20"
                                                placeholder="MM"
                                                min="0"
                                                max="59"
                                                value={endMin}
                                                onChange={(e) => setEndMin(e.target.value)}
                                                disabled={actionLoading || ['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        className="btn-primary text-xs flex items-center gap-2"
                                        disabled={actionLoading || ['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status) || !startHour || !startMin || !endHour || !endMin}
                                        onClick={async () => {
                                            const sH = parseInt(startHour, 10);
                                            const sM = parseInt(startMin, 10);
                                            const eH = parseInt(endHour, 10);
                                            const eM = parseInt(endMin, 10);

                                            if (isNaN(sH) || sH < 0 || sH > 23 || isNaN(sM) || sM < 0 || sM > 59) {
                                                toast.error('Please enter a valid start hour (0-23) and minute (0-59).');
                                                return;
                                            }
                                            if (isNaN(eH) || eH < 0 || eH > 23 || isNaN(eM) || eM < 0 || eM > 59) {
                                                toast.error('Please enter a valid end hour (0-23) and minute (0-59).');
                                                return;
                                            }

                                            // Determine base date (use work order date if available, or today)
                                            const baseDate = wo.createdAt ? new Date(wo.createdAt) : new Date();

                                            const start = new Date(baseDate);
                                            start.setHours(sH, sM, 0, 0);

                                            const end = new Date(baseDate);
                                            end.setHours(eH, eM, 0, 0);

                                            if (end < start) {
                                                // Overnight shift
                                                end.setDate(end.getDate() + 1);
                                            }

                                            setLabourDebugInfo('Initiating request...');
                                            await doAction(async () => {
                                                try {
                                                    const payload = {
                                                        workStartTime: start.toISOString(),
                                                        workEndTime: end.toISOString()
                                                    };
                                                    setLabourDebugInfo(`Payload: ${JSON.stringify(payload)}. Sending POST request...`);
                                                    const updated = await logLabour(wo._id, payload);
                                                    setLabourDebugInfo(`Success! Server returned updated WO status: ${updated?.status}, actualLabourHours: ${updated?.actualLabourHours}, workStartTime: ${updated?.workStartTime}`);
                                                    setWo(updated);
                                                    toast.success('Work times updated successfully.');
                                                } catch (err: any) {
                                                    const msg = err.response?.data?.message || err.message || JSON.stringify(err);
                                                    setLabourDebugInfo(`Error returned from server: ${msg}`);
                                                    throw err;
                                                }
                                            });
                                        }}
                                    >
                                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                                        Update Work Times
                                    </button>
                                </div>

                                {['INVOICED', 'CLOSED', 'CANCELLED', 'VEHICLE_RELEASED'].includes(wo.status) && (
                                    <p className="text-[10px] text-[var(--text-muted)] italic">
                                        Work times cannot be modified because the work order is finalized.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════ QC & PHOTOS TAB ══════════════════ */}
            {activeTab === 'qc' && (() => {
                const doableTasks = wo.tasks.filter(t => t.isDoable);
                const totalTasksCount = doableTasks.length;
                const completedTasksCount = doableTasks.filter(t => t.status === 'COMPLETED').length;

                const activeParts = wo.parts.filter(p => !p.taskTemplateId || doableTasks.some(t => t.taskTemplateId && p.taskTemplateId && t.taskTemplateId.toString() === p.taskTemplateId.toString()));
                const totalPartsCount = activeParts.length;
                const installedPartsCount = activeParts.filter(p => p.status === 'INSTALLED').length;

                // Task Photo Helpers: each completed task requires 2 photos (Detached Old Part & New Fixed Part)
                const getTaskOldPhoto = (taskId: string) => wo.photos.find(p => p.caption === `TASK_${taskId}_OLD` || p.caption === `TASK_${taskId}_DETACHED`);
                const getTaskNewPhoto = (taskId: string) => wo.photos.find(p => p.caption === `TASK_${taskId}_NEW` || p.caption === `TASK_${taskId}_FIXED`);
                const getTaskLegacyPhoto = (taskId: string) => wo.photos.find(p => p.caption === `TASK_${taskId}`);
                const hasBothTaskPhotos = (taskId: string) => {
                    const hasOld = !!getTaskOldPhoto(taskId);
                    const hasNew = !!getTaskNewPhoto(taskId);
                    if (hasOld && hasNew) return true;
                    return !!getTaskLegacyPhoto(taskId);
                };

                const formatPhotoCaption = (caption?: string) => {
                    if (!caption) return 'QC Photo';
                    if (caption.startsWith('TASK_')) {
                        const isOld = caption.endsWith('_OLD') || caption.endsWith('_DETACHED');
                        const isNew = caption.endsWith('_NEW') || caption.endsWith('_FIXED');
                        const rawId = caption.replace('TASK_', '').replace('_OLD', '').replace('_NEW', '').replace('_DETACHED', '').replace('_FIXED', '');
                        const matchedTask = doableTasks.find(t => t._id === rawId);
                        const taskName = matchedTask ? matchedTask.description : 'Task';
                        if (isOld) return `Old Detached Part: ${taskName}`;
                        if (isNew) return `New Fixed Part: ${taskName}`;
                        return `Task Verification: ${taskName}`;
                    }
                    return caption;
                };

                const completedTasks = doableTasks.filter(t => t.status === 'COMPLETED');
                // 2 photos required per completed task (Detached Old Part & New Fixed Part)
                const requiredPhotosCount = completedTasks.length * 2;
                let uploadedPhotosCount = 0;
                completedTasks.forEach(t => {
                    const oldP = getTaskOldPhoto(t._id);
                    const newP = getTaskNewPhoto(t._id);
                    if (oldP) uploadedPhotosCount++;
                    if (newP) uploadedPhotosCount++;
                    if (!oldP && !newP && getTaskLegacyPhoto(t._id)) {
                        uploadedPhotosCount += 2;
                    }
                });

                // Vehicle repair verification photos (wo.requiredPhotos)
                const vehicleRequiredPhotos = wo.requiredPhotos || [];
                const uploadedVehiclePhotosCount = wo.photos.filter(p => vehicleRequiredPhotos.some(rp => rp.label === p.caption)).length;

                // Unassigned general parts
                const generalParts = activeParts.filter(p => !p.taskTemplateId || !doableTasks.some(t => t.taskTemplateId && p.taskTemplateId && t.taskTemplateId.toString() === p.taskTemplateId.toString()));
                const installedGeneralPartsCount = generalParts.filter(p => p.status === 'INSTALLED').length;

                const totalSteps = totalTasksCount + totalPartsCount + requiredPhotosCount;
                const completedSteps = completedTasksCount + installedPartsCount + uploadedPhotosCount;
                const overallPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 100;
                const hasAllTaskPhotos = totalTasksCount > 0 && doableTasks.every(t => t.status !== 'COMPLETED' || hasBothTaskPhotos(t._id));
                const allTasksCompleted = totalTasksCount > 0 && completedTasksCount === totalTasksCount;
                const allPartsInstalled = totalPartsCount === 0 || installedPartsCount === totalPartsCount;
                const isQcFullyComplete = allTasksCompleted && hasAllTaskPhotos && allPartsInstalled;

                // Safe current task in progressive queue
                const safeTaskIndex = Math.max(0, Math.min(qcCurrentTaskIndex, Math.max(0, doableTasks.length - 1)));
                const currentTask = doableTasks[safeTaskIndex];
                const currentTaskParts = currentTask
                    ? activeParts.filter(p => p.taskTemplateId && currentTask.taskTemplateId && p.taskTemplateId.toString() === currentTask.taskTemplateId.toString())
                    : [];
                const currentTaskOldPhoto = currentTask ? getTaskOldPhoto(currentTask._id) : undefined;
                const currentTaskNewPhoto = currentTask ? getTaskNewPhoto(currentTask._id) : undefined;
                const currentTaskLegacyPhoto = currentTask ? getTaskLegacyPhoto(currentTask._id) : undefined;
                const currentTaskHasBothPhotos = currentTask ? hasBothTaskPhotos(currentTask._id) : false;
                const currentTaskIsCompleted = currentTask ? currentTask.status === 'COMPLETED' : false;
                const currentTaskPendingParts = currentTaskParts.filter(p => p.status !== 'INSTALLED');
                const currentTaskAllPartsInstalled = currentTaskParts.length === 0 || currentTaskPendingParts.length === 0;

                // Helper to install all parts for a group
                const handleInstallPartsGroup = async (partsToInstall: any[]) => {
                    const pending = partsToInstall.filter(p => p.status !== 'INSTALLED');
                    if (pending.length === 0) return;
                    await doAction(async () => {
                        for (const part of pending) {
                            await updatePart(id!, part._id, { status: 'INSTALLED' });
                        }
                        toast.success(`Installed ${pending.length} part(s)`);
                    });
                };

                return (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* ═══════════════ QC TOP PROGRESS OVERVIEW ═══════════════ */}
                        <div className="glass-card p-4 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)]/90 to-[var(--brand-lime-alpha)]/10 border border-[var(--border-main)]/60 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
                            <div className="absolute -right-20 -top-20 w-44 h-44 rounded-full bg-[var(--brand-lime)]/10 blur-3xl pointer-events-none" />

                            <div className="flex items-center gap-3.5 relative z-10">
                                <div className="w-11 h-11 rounded-xl bg-[var(--brand-lime-alpha)]/20 border border-[var(--brand-lime)]/30 flex items-center justify-center text-[var(--brand-lime)] shrink-0 shadow-lg shadow-[var(--brand-lime)]/10">
                                    <Shield size={22} className="animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">Quality Control Inspection</h3>
                                        <span className="badge badge-lime text-[10px] font-mono px-2 py-0.5 bg-[var(--brand-lime)]/10 border border-[var(--brand-lime)]/40 text-[var(--brand-lime)]">
                                            {Math.round(overallPercent)}% Completed
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--text-dim)] font-medium mt-0.5">
                                        Progressive verification flow: inspect task parts, complete tasks, take proof photos, then capture repair verification photos.
                                    </p>
                                </div>
                            </div>

                            {/* Stat counters */}
                            <div className="flex flex-wrap items-center gap-2 relative z-10">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                                    allTasksCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-[var(--border-main)]/40 text-[var(--text-main)]'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Tasks</span>
                                    <span className="text-xs font-black font-mono">{completedTasksCount}/{totalTasksCount}</span>
                                    {allTasksCompleted && <CheckCircle2 size={12} className="text-emerald-400 stroke-[3]" />}
                                </div>

                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                                    allPartsInstalled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-[var(--border-main)]/40 text-[var(--text-main)]'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Parts</span>
                                    <span className="text-xs font-black font-mono">{installedPartsCount}/{totalPartsCount}</span>
                                    {allPartsInstalled && <CheckCircle2 size={12} className="text-emerald-400 stroke-[3]" />}
                                </div>

                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                                    hasAllTaskPhotos ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Task Photos</span>
                                    <span className="text-xs font-black font-mono">{uploadedPhotosCount}/{requiredPhotosCount}</span>
                                    {hasAllTaskPhotos ? <CheckCircle2 size={12} className="text-emerald-400 stroke-[3]" /> : <Camera size={12} />}
                                </div>

                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                                    uploadedVehiclePhotosCount > 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-[var(--border-main)]/40 text-[var(--text-main)]'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Repair Photos</span>
                                    <span className="text-xs font-black font-mono">{uploadedVehiclePhotosCount}/{vehicleRequiredPhotos.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* ═══════════════ PROGRESSIVE STAGE TABS BAR ═══════════════ */}
                        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-[var(--border-main)]/40">
                            <div className="flex items-center gap-2">
                                {/* Stage 1: Tasks */}
                                <button
                                    type="button"
                                    onClick={() => setQcActiveStage('tasks')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                        qcActiveStage === 'tasks'
                                            ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md shadow-[var(--brand-lime)]/20 scale-102'
                                            : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-white'
                                    }`}
                                >
                                    <ListChecks size={14} className={qcActiveStage === 'tasks' ? 'stroke-[2.5]' : ''} />
                                    <span>1. Task Verification & Photos</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                        qcActiveStage === 'tasks' ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-white/70'
                                    }`}>
                                        {uploadedPhotosCount}/{totalTasksCount}
                                    </span>
                                </button>

                                {/* Stage 2: General Parts (if any) */}
                                {generalParts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setQcActiveStage('general_parts')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                            qcActiveStage === 'general_parts'
                                                ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md shadow-[var(--brand-lime)]/20 scale-102'
                                                : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-white'
                                        }`}
                                    >
                                        <Package size={14} className={qcActiveStage === 'general_parts' ? 'stroke-[2.5]' : ''} />
                                        <span>2. General Materials</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                            qcActiveStage === 'general_parts' ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-white/70'
                                        }`}>
                                            {installedGeneralPartsCount}/{generalParts.length}
                                        </span>
                                    </button>
                                )}

                                {/* Stage 3: Repair Verification Photos */}
                                <button
                                    type="button"
                                    onClick={() => setQcActiveStage('repair_photos')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                        qcActiveStage === 'repair_photos'
                                            ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md shadow-[var(--brand-lime)]/20 scale-102'
                                            : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-white'
                                    }`}
                                >
                                    <Camera size={14} className={qcActiveStage === 'repair_photos' ? 'stroke-[2.5]' : ''} />
                                    <span>{generalParts.length > 0 ? '3.' : '2.'} Repair Verification Photos</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                        qcActiveStage === 'repair_photos' ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-white/70'
                                    }`}>
                                        {uploadedVehiclePhotosCount}/{vehicleRequiredPhotos.length}
                                    </span>
                                </button>

                                {/* Stage 4: QC Summary & Sign-off */}
                                <button
                                    type="button"
                                    onClick={() => setQcActiveStage('summary')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                        qcActiveStage === 'summary'
                                            ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md shadow-[var(--brand-lime)]/20 scale-102'
                                            : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-white'
                                    }`}
                                >
                                    <FileCheck2 size={14} className={qcActiveStage === 'summary' ? 'stroke-[2.5]' : ''} />
                                    <span>{generalParts.length > 0 ? '4.' : '3.'} QC Sign-Off & Review</span>
                                    {isQcFullyComplete && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                    )}
                                </button>
                            </div>

                            {/* View Mode Toggle when in tasks stage */}
                            {qcActiveStage === 'tasks' && doableTasks.length > 0 && (
                                <div className="flex items-center bg-black/30 p-1 rounded-xl border border-[var(--border-main)]/40 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setQcViewMode('progressive')}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                            qcViewMode === 'progressive'
                                                ? 'bg-[var(--brand-lime)] text-black shadow-sm'
                                                : 'text-[var(--text-muted)] hover:text-white'
                                        }`}
                                        title="Step-by-step single task focus"
                                    >
                                        <Sparkles size={11} /> Guided Flow
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQcViewMode('overview')}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                            qcViewMode === 'overview'
                                                ? 'bg-[var(--brand-lime)] text-black shadow-sm'
                                                : 'text-[var(--text-muted)] hover:text-white'
                                        }`}
                                        title="View all tasks in grid"
                                    >
                                        <Layers size={11} /> Overview Grid
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ═══════════════ STAGE 1: TASK VERIFICATION & EVIDENCE ═══════════════ */}
                        {qcActiveStage === 'tasks' && (
                            <div className="space-y-4">
                                {doableTasks.length === 0 ? (
                                    <div className="glass-card p-8 text-center space-y-3 border border-[var(--border-main)]">
                                        <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center text-[var(--text-dim)]">
                                            <ListChecks size={22} />
                                        </div>
                                        <h4 className="text-sm font-bold text-[var(--text-main)]">No active tasks assigned to this work order</h4>
                                        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                                            You can directly continue to vehicle repair verification photos.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setQcActiveStage('repair_photos')}
                                            className="btn-primary text-xs !py-2 !px-4 mt-2"
                                        >
                                            Go to Repair Photos <ArrowRight size={13} />
                                        </button>
                                    </div>
                                ) : qcViewMode === 'progressive' ? (
                                    /* ── PROGRESSIVE MODE: ONE TASK AT A TIME ── */
                                    <div className="space-y-4">
                                        {/* Horizontal Task Selector Queue */}
                                        <div className="glass-card p-2 px-3 border border-[var(--border-main)]/50 rounded-xl flex items-center gap-2 overflow-x-auto scrollbar-none">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] shrink-0 pl-1">
                                                Task Queue:
                                            </span>
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {doableTasks.map((t, idx) => {
                                                    const isCompleted = t.status === 'COMPLETED';
                                                    const oldP = getTaskOldPhoto(t._id);
                                                    const newP = getTaskNewPhoto(t._id);
                                                    const hasBoth = hasBothTaskPhotos(t._id);
                                                    const isSelected = idx === safeTaskIndex;
                                                    const isFullyVerified = isCompleted && hasBoth;
                                                    const photoCount = (oldP ? 1 : 0) + (newP ? 1 : 0) + (!oldP && !newP && getTaskLegacyPhoto(t._id) ? 2 : 0);

                                                    return (
                                                        <button
                                                            key={t._id}
                                                            type="button"
                                                            onClick={() => setQcCurrentTaskIndex(idx)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-[var(--brand-lime-alpha)]/25 text-[var(--brand-lime)] border-2 border-[var(--brand-lime)] shadow-md shadow-[var(--brand-lime)]/10 scale-102'
                                                                    : isFullyVerified
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60'
                                                                    : isCompleted
                                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:border-amber-500/60'
                                                                    : 'bg-white/5 text-[var(--text-muted)] border border-[var(--border-main)]/40 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-center">
                                                                {isFullyVerified ? (
                                                                    <CheckCircle2 size={13} className="text-emerald-400 stroke-[3]" />
                                                                ) : isCompleted ? (
                                                                    <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                                                                        <Camera size={11} /> {photoCount}/2
                                                                    </span>
                                                                ) : (
                                                                    <span className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-mono">
                                                                        {idx + 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="truncate max-w-[140px] text-left">
                                                                {idx + 1}. {t.description}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Quick "Next Pending" jumper */}
                                            {doableTasks.some(t => t.status !== 'COMPLETED' || !hasBothTaskPhotos(t._id)) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextPendingIdx = doableTasks.findIndex(t => t.status !== 'COMPLETED' || !hasBothTaskPhotos(t._id));
                                                        if (nextPendingIdx !== -1) setQcCurrentTaskIndex(nextPendingIdx);
                                                    }}
                                                    className="text-[10px] font-bold text-[var(--brand-lime)] hover:underline shrink-0 px-2 py-1 bg-white/5 rounded-md border border-[var(--brand-lime)]/30 cursor-pointer"
                                                >
                                                    Jump to Pending →
                                                </button>
                                            )}
                                        </div>

                                        {/* Focused Active Task Workspace Card */}
                                        {currentTask && (
                                            <div className="glass-card border border-[var(--border-main)] rounded-2xl overflow-hidden shadow-2xl relative bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-card)]/80">
                                                {/* Top Accent Indicator */}
                                                <div className="w-full h-1.5 bg-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[var(--brand-lime)] to-emerald-400 transition-all duration-500"
                                                        style={{ width: `${((safeTaskIndex + 1) / totalTasksCount) * 100}%` }}
                                                    />
                                                </div>

                                                {/* Header Bar */}
                                                <div className="p-4 sm:p-5 border-b border-[var(--border-main)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="badge badge-lime text-[10px] font-mono px-2 py-0.5 bg-[var(--brand-lime)]/10 text-[var(--brand-lime)] border border-[var(--brand-lime)]/30 font-bold">
                                                                Task {safeTaskIndex + 1} of {totalTasksCount}
                                                            </span>
                                                            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)] bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
                                                                {currentTask.category || 'Mechanical'}
                                                            </span>
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                                                currentTaskIsCompleted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-[var(--text-muted)]'
                                                            }`}>
                                                                {currentTask.status}
                                                            </span>
                                                        </div>
                                                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-1">
                                                            {currentTask.description}
                                                        </h2>
                                                    </div>

                                                    {/* Task Completion Switch */}
                                                    <button
                                                        type="button"
                                                        disabled={actionLoading}
                                                        onClick={() => doAction(() => updateTask(id!, currentTask._id, {
                                                            status: currentTaskIsCompleted ? 'PENDING' : 'COMPLETED'
                                                        }))}
                                                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                                            currentTaskIsCompleted
                                                                ? 'bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                                                                : 'bg-[var(--brand-lime)] text-black hover:scale-102 active:scale-98 shadow-lg shadow-[var(--brand-lime)]/20'
                                                        }`}
                                                    >
                                                        {actionLoading ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 size={15} className="stroke-[2.5]" />
                                                        )}
                                                        {currentTaskIsCompleted ? 'Marked Completed (Click to Revert)' : 'Mark Task Completed'}
                                                    </button>
                                                </div>

                                                {/* Content Area: Step 1 (Parts) + Step 2 (Photo Upload: Detached Old Part & New Fixed Part) */}
                                                <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                                                    {/* LEFT COLUMN: Step 1 Parts Verification */}
                                                    <div className="xl:col-span-5 space-y-4">
                                                        <div className="flex items-center justify-between border-b border-[var(--border-main)]/30 pb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                                                    <Wrench size={12} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                                                        1. Required Parts & Materials
                                                                    </h4>
                                                                    <p className="text-[10px] text-[var(--text-dim)]">
                                                                        Verify and mark pending parts installed before finalizing this task.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {currentTaskParts.length > 0 && currentTaskPendingParts.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => handleInstallPartsGroup(currentTaskParts)}
                                                                    className="text-[10px] font-bold text-[var(--brand-lime)] hover:text-white bg-[var(--brand-lime-alpha)]/20 hover:bg-[var(--brand-lime-alpha)]/40 border border-[var(--brand-lime)]/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <CheckCheck size={11} /> Install All ({currentTaskPendingParts.length})
                                                                </button>
                                                            )}
                                                        </div>

                                                        {currentTaskParts.length === 0 ? (
                                                            <div className="p-4 rounded-xl border border-dashed border-[var(--border-main)]/60 bg-white/[0.01] flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                                                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                                                <span>No replacement parts required for this specific task. Ready to inspect.</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {currentTaskParts.map((part) => {
                                                                    const isInstalled = part.status === 'INSTALLED';

                                                                    return (
                                                                        <div
                                                                            key={part._id}
                                                                            className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                                                                                isInstalled
                                                                                    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                                                                                    : 'border-orange-500/30 bg-orange-500/[0.03]'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={actionLoading}
                                                                                    onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                                        status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                                    }))}
                                                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer ${
                                                                                        isInstalled
                                                                                            ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black shadow-sm'
                                                                                            : 'border-orange-500/40 text-transparent hover:border-[var(--brand-lime)]'
                                                                                    }`}
                                                                                    title={isInstalled ? "Click to Mark Pending" : "Click to Mark Installed"}
                                                                                >
                                                                                    <Check size={12} className="stroke-[3]" />
                                                                                </button>

                                                                                <div className="min-w-0 select-none">
                                                                                    <span
                                                                                        onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                                            status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                                        }))}
                                                                                        className={`text-xs font-semibold cursor-pointer hover:text-[var(--brand-lime)] transition-colors truncate block ${
                                                                                            isInstalled ? 'line-through text-[var(--text-dim)]' : 'text-white'
                                                                                        }`}
                                                                                    >
                                                                                        {part.partName}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                                        <span className="text-[10px] text-[var(--text-dim)] font-mono">
                                                                                            Qty: {part.quantity}
                                                                                        </span>
                                                                                        {part.partNumber && (
                                                                                            <span className="text-[9px] text-[var(--text-dim)] bg-white/5 px-1.5 py-0.2 rounded font-mono">
                                                                                                #{part.partNumber}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono shrink-0 ${
                                                                                isInstalled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400 animate-pulse'
                                                                            }`}>
                                                                                {isInstalled ? 'INSTALLED' : 'PENDING'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {currentTaskAllPartsInstalled ? (
                                                                    <div className="p-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center gap-2">
                                                                        <CheckCircle2 size={13} className="shrink-0" />
                                                                        All parts installed for this task.
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-2 px-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold flex items-center gap-2">
                                                                        <AlertCircle size={13} className="shrink-0" />
                                                                        {currentTaskPendingParts.length} part(s) pending install. Click checkbox or "Install All".
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* RIGHT COLUMN: Step 2 Photo Proof Upload (Old Detached Part & New Fixed Part) */}
                                                    <div className="xl:col-span-7 space-y-4">
                                                        <div className="flex items-center justify-between border-b border-[var(--border-main)]/30 pb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                                                    <Camera size={12} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                                                        2. Task Verification Photos (2 Required)
                                                                    </h4>
                                                                    <p className="text-[10px] text-[var(--text-dim)]">
                                                                        Detached old part photo &amp; new fixed part photo
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                                                currentTaskHasBothPhotos
                                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                                    : (currentTaskOldPhoto || currentTaskNewPhoto)
                                                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                                    : 'bg-white/5 text-[var(--text-dim)] border-white/10'
                                                            }`}>
                                                                {currentTaskHasBothPhotos
                                                                    ? '2 / 2 Attached'
                                                                    : (currentTaskOldPhoto || currentTaskNewPhoto)
                                                                    ? '1 / 2 Attached'
                                                                    : '0 / 2 Attached'}
                                                            </span>
                                                        </div>

                                                        {/* Legacy Photo Banner if present */}
                                                        {currentTaskLegacyPhoto && !currentTaskOldPhoto && !currentTaskNewPhoto && (
                                                            <div className="p-2.5 px-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <Info size={14} className="shrink-0" />
                                                                    <span className="truncate">Legacy photo attached. You can upload dedicated old &amp; new photos below.</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewPhoto({ url: currentTaskLegacyPhoto.url, caption: `${currentTask.description} (Legacy)`, stage: 'QC Task Proof' })}
                                                                    className="text-[10px] underline font-bold shrink-0 cursor-pointer"
                                                                >
                                                                    View Legacy
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Two Photo Verification Cards Grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Card 1: Detached Old Part Image */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between px-0.5">
                                                                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                                                                        <Wrench size={12} className="text-amber-400" /> Detached Old Part
                                                                    </span>
                                                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                                                        currentTaskOldPhoto ? 'bg-amber-500/20 text-amber-300' : 'text-[var(--text-dim)]'
                                                                    }`}>
                                                                        {currentTaskOldPhoto ? '✓ Uploaded' : 'Required'}
                                                                    </span>
                                                                </div>

                                                                {currentTaskOldPhoto ? (
                                                                    <div className="glass-card aspect-[4/3] rounded-2xl overflow-hidden border border-amber-500/40 relative group shadow-lg">
                                                                        <img
                                                                            src={currentTaskOldPhoto.url}
                                                                            alt="Detached Old Part"
                                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                        />
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-between p-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="badge text-[9px] bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold font-mono">
                                                                                    Old Part Removed
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setPreviewPhoto({ url: currentTaskOldPhoto.url, caption: `Detached Old Part: ${currentTask.description}`, stage: 'QC Task Proof' })}
                                                                                    className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer"
                                                                                    title="View Fullscreen"
                                                                                >
                                                                                    <Maximize2 size={13} />
                                                                                </button>
                                                                            </div>

                                                                            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10">
                                                                                <div className="text-[9px] text-white/70 font-mono truncate">
                                                                                    {currentTaskOldPhoto.uploadedAt ? new Date(currentTaskOldPhoto.uploadedAt).toLocaleTimeString() : 'Verified'}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={actionLoading}
                                                                                        onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${currentTask._id}_OLD` })}
                                                                                        className="px-2 py-1 rounded-md bg-blue-500/80 hover:bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                                                        title="Retake old part photo"
                                                                                    >
                                                                                        <Camera size={11} /> Retake
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={actionLoading}
                                                                                        onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${currentTask._id}_OLD` })}
                                                                                        className="px-2 py-1 rounded-md bg-amber-500/80 hover:bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                                                        title="Upload different old part photo"
                                                                                    >
                                                                                        <Upload size={11} /> Change
                                                                                    </button>
                                                                                    {!isReleasedOrLater && (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={actionLoading}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                if (window.confirm("Delete detached old part verification photo?")) {
                                                                                                    doAction(() => removePhoto(id!, currentTaskOldPhoto._id));
                                                                                                }
                                                                                            }}
                                                                                            className="w-6 h-6 rounded-md bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer"
                                                                                            title="Delete Photo"
                                                                                        >
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-amber-500/35 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col items-center justify-center text-center space-y-2 relative group hover:border-amber-500/60 transition-all">
                                                                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-md">
                                                                            <Wrench size={18} />
                                                                        </div>
                                                                        <div className="space-y-0.5">
                                                                            <p className="text-xs font-black text-amber-300">
                                                                                Old Part Image
                                                                            </p>
                                                                            <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 px-1">
                                                                                Photo of removed / replaced part
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex gap-2 w-full pt-1">
                                                                            <button
                                                                                type="button"
                                                                                disabled={actionLoading}
                                                                                onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${currentTask._id}_OLD` })}
                                                                                className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                                                                            >
                                                                                <Camera size={12} /> Camera
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={actionLoading}
                                                                                onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${currentTask._id}_OLD` })}
                                                                                className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                                                                            >
                                                                                <Upload size={12} /> Upload
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Card 2: New Fixed Part Image */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between px-0.5">
                                                                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                                                                        <CheckCircle2 size={12} className="text-emerald-400" /> New Fixed Part
                                                                    </span>
                                                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                                                        currentTaskNewPhoto ? 'bg-emerald-500/20 text-emerald-300' : 'text-[var(--text-dim)]'
                                                                    }`}>
                                                                        {currentTaskNewPhoto ? '✓ Uploaded' : 'Required'}
                                                                    </span>
                                                                </div>

                                                                {currentTaskNewPhoto ? (
                                                                    <div className="glass-card aspect-[4/3] rounded-2xl overflow-hidden border border-emerald-500/40 relative group shadow-lg">
                                                                        <img
                                                                            src={currentTaskNewPhoto.url}
                                                                            alt="New Fixed Part"
                                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                        />
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-between p-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="badge text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold font-mono">
                                                                                    New Part Installed
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setPreviewPhoto({ url: currentTaskNewPhoto.url, caption: `New Fixed Part: ${currentTask.description}`, stage: 'QC Task Proof' })}
                                                                                    className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer"
                                                                                    title="View Fullscreen"
                                                                                >
                                                                                    <Maximize2 size={13} />
                                                                                </button>
                                                                            </div>

                                                                            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10">
                                                                                <div className="text-[9px] text-white/70 font-mono truncate">
                                                                                    {currentTaskNewPhoto.uploadedAt ? new Date(currentTaskNewPhoto.uploadedAt).toLocaleTimeString() : 'Verified'}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={actionLoading}
                                                                                        onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${currentTask._id}_NEW` })}
                                                                                        className="px-2 py-1 rounded-md bg-blue-500/80 hover:bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                                                        title="Retake new fixed part photo"
                                                                                    >
                                                                                        <Camera size={11} /> Retake
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={actionLoading}
                                                                                        onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${currentTask._id}_NEW` })}
                                                                                        className="px-2 py-1 rounded-md bg-emerald-500/80 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                                                        title="Upload different new part photo"
                                                                                    >
                                                                                        <Upload size={11} /> Change
                                                                                    </button>
                                                                                    {!isReleasedOrLater && (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={actionLoading}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                if (window.confirm("Delete new fixed part verification photo?")) {
                                                                                                    doAction(() => removePhoto(id!, currentTaskNewPhoto._id));
                                                                                                }
                                                                                            }}
                                                                                            className="w-6 h-6 rounded-md bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer"
                                                                                            title="Delete Photo"
                                                                                        >
                                                                                            <Trash2 size={11} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-emerald-500/35 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent p-4 flex flex-col items-center justify-center text-center space-y-2 relative group hover:border-emerald-500/60 transition-all">
                                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md">
                                                                            <Sparkles size={18} />
                                                                        </div>
                                                                        <div className="space-y-0.5">
                                                                            <p className="text-xs font-black text-emerald-300">
                                                                                New Part Image
                                                                            </p>
                                                                            <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 px-1">
                                                                                Photo of installed replacement / fix
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex gap-2 w-full pt-1">
                                                                            <button
                                                                                type="button"
                                                                                disabled={actionLoading}
                                                                                onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${currentTask._id}_NEW` })}
                                                                                className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                                                                            >
                                                                                <Camera size={12} /> Camera
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={actionLoading}
                                                                                onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${currentTask._id}_NEW` })}
                                                                                className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                                                                            >
                                                                                <Upload size={12} /> Upload
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!currentTaskIsCompleted && (
                                                            <div className="p-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold flex items-center gap-2">
                                                                <AlertCircle size={13} className="shrink-0" />
                                                                <span>Task is pending completion. Upload both photos and click "Mark Task Completed".</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bottom Task Navigation Footer */}
                                                <div className="p-4 bg-black/40 border-t border-[var(--border-main)]/50 flex items-center justify-between gap-3">
                                                    <button
                                                        type="button"
                                                        disabled={safeTaskIndex === 0}
                                                        onClick={() => setQcCurrentTaskIndex(Math.max(0, safeTaskIndex - 1))}
                                                        className={`btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 ${
                                                            safeTaskIndex === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                                        }`}
                                                    >
                                                        <ChevronLeft size={14} /> Previous Task
                                                    </button>

                                                    <div className="text-xs font-mono font-bold text-[var(--text-dim)] hidden sm:block">
                                                        Task {safeTaskIndex + 1} of {totalTasksCount}
                                                    </div>

                                                    {safeTaskIndex < totalTasksCount - 1 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setQcCurrentTaskIndex(safeTaskIndex + 1)}
                                                            className={`text-xs font-black flex items-center gap-1.5 py-2 px-5 rounded-xl transition-all cursor-pointer ${
                                                                currentTaskIsCompleted && currentTaskHasBothPhotos
                                                                    ? 'btn-primary shadow-lg shadow-[var(--brand-lime)]/20'
                                                                    : 'btn-secondary'
                                                            }`}
                                                        >
                                                            Next Task <ChevronRight size={14} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setQcActiveStage(generalParts.length > 0 ? 'general_parts' : 'repair_photos')}
                                                            className="btn-primary !py-2 !px-5 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[var(--brand-lime)]/20 cursor-pointer"
                                                        >
                                                            Proceed to Next Step <ArrowRight size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* ── OVERVIEW GRID MODE (ALL TASKS) ── */
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {doableTasks.map((task, tIndex) => {
                                                const oldPhoto = getTaskOldPhoto(task._id);
                                                const newPhoto = getTaskNewPhoto(task._id);
                                                const legacyPhoto = getTaskLegacyPhoto(task._id);
                                                const hasBothPhotos = (!!oldPhoto && !!newPhoto) || !!legacyPhoto;
                                                const isCompleted = task.status === 'COMPLETED';
                                                const taskParts = activeParts.filter(p => p.taskTemplateId && task.taskTemplateId && p.taskTemplateId.toString() === task.taskTemplateId.toString());
                                                const isFullyDone = isCompleted && hasBothPhotos;

                                                return (
                                                    <div
                                                        key={task._id}
                                                        className={`glass-card p-4 border rounded-2xl space-y-3.5 transition-all duration-300 relative ${
                                                            isFullyDone
                                                                ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.04] to-transparent'
                                                                : isCompleted
                                                                ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/[0.04] to-transparent'
                                                                : 'border-[var(--border-main)]/60'
                                                        }`}
                                                    >
                                                        {/* Task Card Header */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-2.5 min-w-0">
                                                                <button
                                                                    type="button"
                                                                    disabled={actionLoading}
                                                                    onClick={() => doAction(() => updateTask(id!, task._id, {
                                                                        status: isCompleted ? 'PENDING' : 'COMPLETED'
                                                                    }))}
                                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 mt-0.5 cursor-pointer ${
                                                                        isCompleted
                                                                            ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black'
                                                                            : 'border-[var(--border-main)] text-transparent hover:border-[var(--brand-lime)]'
                                                                    }`}
                                                                    title={isCompleted ? "Mark Pending" : "Mark Completed"}
                                                                >
                                                                    <CheckCircle2 size={12} className="stroke-[3]" />
                                                                </button>
                                                                <div className="min-w-0">
                                                                    <span className="text-xs font-bold text-white block truncate">
                                                                        {tIndex + 1}. {task.description}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <span className="text-[9px] uppercase font-mono text-[var(--text-dim)] bg-white/5 px-1.5 py-0.2 rounded">
                                                                            {task.category || 'General'}
                                                                        </span>
                                                                        <span className={`text-[9px] font-bold uppercase ${isCompleted ? 'text-[var(--brand-lime)]' : 'text-[var(--text-dim)]'}`}>
                                                                            {task.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setQcCurrentTaskIndex(tIndex);
                                                                    setQcViewMode('progressive');
                                                                }}
                                                                className="text-[10px] font-bold text-[var(--brand-lime)] hover:underline shrink-0 bg-white/5 px-2 py-1 rounded-md border border-[var(--brand-lime)]/20 cursor-pointer"
                                                            >
                                                                Focus →
                                                            </button>
                                                        </div>

                                                        {/* Parts nested inside overview card */}
                                                        {taskParts.length > 0 && (
                                                            <div className="pl-3 border-l-2 border-[var(--border-main)]/50 space-y-1.5">
                                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                                                                    <span>Parts ({taskParts.filter(p => p.status === 'INSTALLED').length}/{taskParts.length})</span>
                                                                    {taskParts.some(p => p.status !== 'INSTALLED') && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleInstallPartsGroup(taskParts)}
                                                                            className="text-[9px] font-bold text-[var(--brand-lime)] hover:underline cursor-pointer"
                                                                        >
                                                                            Install All
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {taskParts.map((part) => {
                                                                        const isInstalled = part.status === 'INSTALLED';
                                                                        return (
                                                                            <div key={part._id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/[0.02] border border-white/5">
                                                                                <div className="flex items-center gap-2 truncate flex-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => doAction(() => updatePart(id!, part._id, { status: isInstalled ? 'REQUESTED' : 'INSTALLED' }))}
                                                                                        className={`w-4 h-4 rounded flex items-center justify-center border text-[9px] ${
                                                                                            isInstalled ? 'bg-[var(--brand-lime)] text-black border-[var(--brand-lime)]' : 'border-white/20'
                                                                                        }`}
                                                                                    >
                                                                                        {isInstalled && <Check size={10} className="stroke-[3]" />}
                                                                                    </button>
                                                                                    <span className={`truncate text-[11px] ${isInstalled ? 'line-through text-white/50' : 'text-white'}`}>
                                                                                        {part.partName}
                                                                                    </span>
                                                                                </div>
                                                                                <span className={`text-[9px] font-mono font-bold ${isInstalled ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                                                    {isInstalled ? 'INSTALLED' : 'PENDING'}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Task Photos in Overview Card: Old Detached & New Fixed */}
                                                        <div className="pt-2 border-t border-[var(--border-main)]/30 space-y-2">
                                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                                                                <span>Verification Photos (2 Types)</span>
                                                                <span className={`font-mono px-1.5 py-0.2 rounded text-[9px] ${
                                                                    hasBothPhotos ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                                                }`}>
                                                                    {hasBothPhotos ? '2/2 Done' : (oldPhoto || newPhoto ? '1/2 Done' : '0/2 Done')}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {/* Old Detached Part */}
                                                                <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                                                    oldPhoto ? 'border-amber-500/40 bg-amber-500/5' : 'border-dashed border-amber-500/30 bg-white/[0.01]'
                                                                }`}>
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {oldPhoto ? (
                                                                            <img
                                                                                src={oldPhoto.url}
                                                                                alt="Old Part"
                                                                                onClick={() => setPreviewPhoto({ url: oldPhoto.url, caption: `Detached Old Part: ${task.description}`, stage: 'QC Task Proof' })}
                                                                                className="w-9 h-9 rounded-lg object-cover border border-amber-500/40 cursor-zoom-in shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                                                                <Wrench size={13} />
                                                                            </div>
                                                                        )}
                                                                        <div className="truncate">
                                                                            <span className="text-[10px] font-bold text-white block truncate">
                                                                                Old Part
                                                                            </span>
                                                                            <span className={`text-[9px] font-mono block ${oldPhoto ? 'text-amber-400 font-bold' : 'text-[var(--text-dim)]'}`}>
                                                                                {oldPhoto ? '✓ Attached' : 'Missing'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${task._id}_OLD` })}
                                                                            className="p-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-white transition-colors cursor-pointer"
                                                                            title="Camera: Old Detached Part"
                                                                        >
                                                                            <Camera size={11} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${task._id}_OLD` })}
                                                                            className="p-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white transition-colors cursor-pointer"
                                                                            title="Upload: Old Detached Part"
                                                                        >
                                                                            <Upload size={11} />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* New Fixed Part */}
                                                                <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                                                    newPhoto ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dashed border-emerald-500/30 bg-white/[0.01]'
                                                                }`}>
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {newPhoto ? (
                                                                            <img
                                                                                src={newPhoto.url}
                                                                                alt="New Part"
                                                                                onClick={() => setPreviewPhoto({ url: newPhoto.url, caption: `New Fixed Part: ${task.description}`, stage: 'QC Task Proof' })}
                                                                                className="w-9 h-9 rounded-lg object-cover border border-emerald-500/40 cursor-zoom-in shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                                                <Sparkles size={13} />
                                                                            </div>
                                                                        )}
                                                                        <div className="truncate">
                                                                            <span className="text-[10px] font-bold text-white block truncate">
                                                                                New Part
                                                                            </span>
                                                                            <span className={`text-[9px] font-mono block ${newPhoto ? 'text-emerald-400 font-bold' : 'text-[var(--text-dim)]'}`}>
                                                                                {newPhoto ? '✓ Attached' : 'Missing'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${task._id}_NEW` })}
                                                                            className="p-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-white transition-colors cursor-pointer"
                                                                            title="Camera: New Fixed Part"
                                                                        >
                                                                            <Camera size={11} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${task._id}_NEW` })}
                                                                            className="p-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                                                                            title="Upload: New Fixed Part"
                                                                        >
                                                                            <Upload size={11} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══════════════ STAGE 2: GENERAL MATERIALS & PARTS ═══════════════ */}
                        {qcActiveStage === 'general_parts' && (
                            <div className="glass-card p-5 border border-[var(--border-main)] rounded-2xl space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-main)]/40 pb-3">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Package size={16} className="text-[var(--brand-lime)]" />
                                            <h3 className="text-sm font-bold text-white">General Parts & Workshop Supplies</h3>
                                        </div>
                                        <p className="text-xs text-[var(--text-dim)]">
                                            These items are not tied to a specific task template. Mark all as installed to proceed.
                                        </p>
                                    </div>

                                    {generalParts.some(p => p.status !== 'INSTALLED') && (
                                        <button
                                            type="button"
                                            onClick={() => handleInstallPartsGroup(generalParts)}
                                            className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[var(--brand-lime)]/20 cursor-pointer"
                                        >
                                            <CheckCheck size={13} /> Install All General Parts
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {generalParts.map((part) => {
                                        const isInstalled = part.status === 'INSTALLED';

                                        return (
                                            <div
                                                key={part._id}
                                                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                                                    isInstalled ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-orange-500/30 bg-orange-500/[0.02]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => doAction(() => updatePart(id!, part._id, { status: isInstalled ? 'REQUESTED' : 'INSTALLED' }))}
                                                        className={`w-5 h-5 rounded-md flex items-center justify-center border text-[10px] cursor-pointer ${
                                                            isInstalled ? 'bg-[var(--brand-lime)] text-black border-[var(--brand-lime)]' : 'border-white/20'
                                                        }`}
                                                    >
                                                        {isInstalled && <Check size={11} className="stroke-[3]" />}
                                                    </button>
                                                    <div className="min-w-0">
                                                        <span className={`text-xs font-bold truncate block ${isInstalled ? 'line-through text-white/50' : 'text-white'}`}>
                                                            {part.partName}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-dim)] font-mono">Qty: {part.quantity}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded ${
                                                    isInstalled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                    {isInstalled ? 'INSTALLED' : 'PENDING'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="pt-3 border-t border-[var(--border-main)]/30 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setQcActiveStage('repair_photos')}
                                        className="btn-primary !py-2 !px-5 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                                    >
                                        Proceed to Repair Photos <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════ STAGE 3: REPAIR VERIFICATION PHOTOS ═══════════════ */}
                        {qcActiveStage === 'repair_photos' && (
                            <div className="space-y-6">
                                <div className="glass-card p-5 border border-[var(--border-main)] rounded-2xl space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-main)]/40 pb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Camera size={18} className="text-[var(--brand-lime)]" />
                                                <h3 className="text-base font-bold text-white">Repair Verification Photos</h3>
                                            </div>
                                            <p className="text-xs text-[var(--text-dim)] mt-0.5">
                                                Capture vehicle condition and repair verification photos (Front, Rear, Replaced Components, Engine, Interior).
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-[var(--border-main)] font-mono text-xs font-bold text-[var(--brand-lime)]">
                                            <Camera size={13} />
                                            {uploadedVehiclePhotosCount} of {vehicleRequiredPhotos.length} Uploaded
                                        </div>
                                    </div>

                                    {/* Grid of Required Angle Photos */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                                        {vehicleRequiredPhotos.map((rp) => {
                                            const photo = wo.photos.find(p => p.caption === rp.label);

                                            return (
                                                <div key={rp.label} className="relative group">
                                                    {photo ? (
                                                        <div className="glass-card aspect-[4/3] rounded-2xl overflow-hidden border border-emerald-500/40 relative hover:border-[var(--brand-lime)] transition-all shadow-md group">
                                                            <img
                                                                src={photo.url}
                                                                alt={rp.label}
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="badge badge-lime text-[8px] bg-black/70 backdrop-blur-md text-[var(--brand-lime)] border border-[var(--brand-lime)]/40 font-mono">
                                                                        {rp.label}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewPhoto({ url: photo.url, caption: rp.label, stage: 'Vehicle Verification' })}
                                                                        className="w-6 h-6 rounded-md bg-black/70 text-white flex items-center justify-center cursor-pointer hover:bg-black"
                                                                        title="View Fullscreen"
                                                                    >
                                                                        <Maximize2 size={11} />
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-center justify-end gap-1 pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => triggerCamera({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                        className="p-1 rounded bg-blue-500/80 hover:bg-blue-600 text-white cursor-pointer"
                                                                        title="Retake (Camera)"
                                                                    >
                                                                        <Camera size={10} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => triggerUpload({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                        className="p-1 rounded bg-orange-500/80 hover:bg-orange-600 text-white cursor-pointer"
                                                                        title="Replace (Upload)"
                                                                    >
                                                                        <Upload size={10} />
                                                                    </button>
                                                                    {!isReleasedOrLater && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                if (window.confirm(`Delete photo for ${rp.label}?`)) {
                                                                                    doAction(() => removePhoto(id!, photo._id));
                                                                                }
                                                                            }}
                                                                            className="p-1 rounded bg-red-500/80 hover:bg-red-600 text-white cursor-pointer"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={10} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[var(--border-main)]/60 hover:border-[var(--brand-lime)]/50 bg-white/[0.01] p-3 flex flex-col items-center justify-between text-center transition-all group">
                                                            <div className="flex flex-col items-center mt-1">
                                                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[var(--text-dim)] group-hover:text-[var(--brand-lime)] transition-colors mb-1">
                                                                    <Camera size={14} />
                                                                </div>
                                                                <span className="text-[11px] font-bold text-white truncate max-w-[120px]">
                                                                    {rp.label}
                                                                </span>
                                                                <span className="text-[8px] uppercase tracking-wider text-[var(--text-dim)] font-mono">
                                                                    Verification Slot
                                                                </span>
                                                            </div>

                                                            <div className="flex gap-1.5 w-full mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerCamera({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                    className="flex-1 py-1 px-1.5 text-[9px] font-bold rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                                >
                                                                    <Camera size={10} /> Cam
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerUpload({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                    className="flex-1 py-1 px-1.5 text-[9px] font-bold rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                                >
                                                                    <Upload size={10} /> Upload
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Additional Reference Photos */}
                                <div className="glass-card p-5 border border-[var(--border-main)] rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between border-b border-[var(--border-main)]/40 pb-3">
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Additional Reference Photos</h4>
                                            <p className="text-[10px] text-[var(--text-dim)]">Attach any extra angles, defect reports, or job proofs.</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => triggerCamera({ stage: 'IN_PROGRESS', label: '' })}
                                                className="btn-secondary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Camera size={12} /> Take Photo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => triggerUpload({ stage: 'IN_PROGRESS', label: '' })}
                                                className="btn-primary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Upload size={12} /> Add More
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                        {wo.photos.filter(p => !vehicleRequiredPhotos.some(rp => rp.label === p.caption) && !p.caption?.startsWith('TASK_')).map((p) => (
                                            <div key={p._id} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-main)] group hover:border-[var(--brand-lime)] transition-all">
                                                <img
                                                    src={p.url}
                                                    alt="Extra"
                                                    onClick={() => setPreviewPhoto({ url: p.url, caption: p.caption || 'Reference Photo', stage: p.stage || 'Extra' })}
                                                    className="w-full h-full object-cover cursor-zoom-in"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewPhoto({ url: p.url, caption: p.caption || 'Reference Photo', stage: p.stage || 'Extra' })}
                                                        className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center cursor-pointer"
                                                    >
                                                        <Maximize2 size={12} />
                                                    </button>
                                                    {!isReleasedOrLater && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (window.confirm("Permanently delete this photo?")) {
                                                                    doAction(() => removePhoto(id!, p._id));
                                                                }
                                                            }}
                                                            className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center cursor-pointer"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer navigation */}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setQcActiveStage('tasks')}
                                        className="btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <ChevronLeft size={14} /> Back to Tasks
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQcActiveStage('summary')}
                                        className="btn-primary !py-2 !px-5 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                                    >
                                        Review QC Sign-Off <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════ STAGE 4: QC SIGN-OFF & SUMMARY ═══════════════ */}
                        {qcActiveStage === 'summary' && (
                            <div className="glass-card p-6 border border-[var(--border-main)] rounded-2xl space-y-6 shadow-2xl">
                                <div className="border-b border-[var(--border-main)]/40 pb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-[var(--brand-lime-alpha)]/20 text-[var(--brand-lime)] flex items-center justify-center">
                                            <FileCheck2 size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-white">Quality Control Inspection Sign-Off</h3>
                                            <p className="text-xs text-[var(--text-dim)]">
                                                Final inspection scorecard before vehicle is sent to billing and hand-off.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Inspection Scorecard */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className={`p-4 rounded-xl border ${
                                        allTasksCompleted ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-orange-500/40 bg-orange-500/5'
                                    }`}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Doable Tasks</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-lg font-black font-mono text-white">{completedTasksCount}/{totalTasksCount}</span>
                                            {allTasksCompleted ? <CheckCircle2 size={18} className="text-emerald-400 stroke-[3]" /> : <AlertTriangle size={18} className="text-orange-400" />}
                                        </div>
                                        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                                            {allTasksCompleted ? 'All tasks completed' : `${totalTasksCount - completedTasksCount} task(s) remaining`}
                                        </span>
                                    </div>

                                    <div className={`p-4 rounded-xl border ${
                                        hasAllTaskPhotos ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-orange-500/40 bg-orange-500/5'
                                    }`}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Task Photos</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-lg font-black font-mono text-white">{uploadedPhotosCount}/{requiredPhotosCount}</span>
                                            {hasAllTaskPhotos ? <CheckCircle2 size={18} className="text-emerald-400 stroke-[3]" /> : <Camera size={18} className="text-orange-400" />}
                                        </div>
                                        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                                            {hasAllTaskPhotos ? 'All task proof uploaded' : `${requiredPhotosCount - uploadedPhotosCount} photo(s) missing`}
                                        </span>
                                    </div>

                                    <div className={`p-4 rounded-xl border ${
                                        allPartsInstalled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-orange-500/40 bg-orange-500/5'
                                    }`}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Parts Installed</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-lg font-black font-mono text-white">{installedPartsCount}/{totalPartsCount}</span>
                                            {allPartsInstalled ? <CheckCircle2 size={18} className="text-emerald-400 stroke-[3]" /> : <Wrench size={18} className="text-orange-400" />}
                                        </div>
                                        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                                            {allPartsInstalled ? 'All parts installed' : `${totalPartsCount - installedPartsCount} part(s) pending`}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-500/5">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">Repair Photos</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-lg font-black font-mono text-white">{uploadedVehiclePhotosCount}/{vehicleRequiredPhotos.length}</span>
                                            <Camera size={18} className="text-blue-400" />
                                        </div>
                                        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                                            {uploadedVehiclePhotosCount} vehicle angles captured
                                        </span>
                                    </div>
                                </div>

                                {/* Status Verdict Alert */}
                                {isQcFullyComplete ? (
                                    <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-[var(--brand-lime-alpha)]/10 border-2 border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                <CheckCircle2 size={22} className="stroke-[3]" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-emerald-300">
                                                    Quality Control Approved & Ready for Billing!
                                                </h4>
                                                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                                                    All doable tasks are completed, parts are marked installed, and required verification photos are attached.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleTransition('BILLING', 'billing')}
                                            className="btn-primary !py-3 !px-6 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-[var(--brand-lime)]/20 hover:scale-102 shrink-0 cursor-pointer"
                                        >
                                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} className="stroke-[2.5]" />}
                                            Proceed to Service Billing
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
                                        <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-orange-300">Incomplete Quality Control Items</h4>
                                            <p className="text-xs text-[var(--text-dim)]">
                                                To progress to billing, ensure all doable tasks are COMPLETED, all parts are INSTALLED, and proof photos are uploaded.
                                            </p>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setQcActiveStage('tasks')}
                                                    className="text-[11px] font-bold text-[var(--brand-lime)] hover:underline cursor-pointer"
                                                >
                                                    ← Review Incomplete Tasks
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Inspection Photo Reel */}
                                <div className="space-y-3 pt-3 border-t border-[var(--border-main)]/30">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                                        Inspection Photo Reel ({wo.photos.length} total photos)
                                    </h4>
                                    {wo.photos.length === 0 ? (
                                        <p className="text-xs text-[var(--text-muted)] italic">No photos uploaded yet.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                                            {wo.photos.map((photo) => (
                                                <div
                                                    key={photo._id}
                                                    onClick={() => setPreviewPhoto({ url: photo.url, caption: formatPhotoCaption(photo.caption), stage: photo.stage || 'QC' })}
                                                    className="aspect-square rounded-xl overflow-hidden border border-[var(--border-main)] hover:border-[var(--brand-lime)] transition-all relative group cursor-zoom-in"
                                                >
                                                    <img src={photo.url} alt="QC" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Maximize2 size={13} className="text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Hidden Native File Input for Photo Uploads */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                );
            })()}

            {activeTab === 'billing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 space-y-6">
                            <div className="glass-card p-6 border-[var(--border-main)] rounded-2xl">
                                <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-lime)]"></div>
                                    Service Bill Generation
                                </h3>

                                {!wo.serviceBillId ? (
                                    <div className="space-y-6">
                                        <div className="p-4 rounded-xl bg-[var(--brand-lime-alpha)] border border-[var(--brand-lime-alpha)]">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--brand-lime-alpha)] flex items-center justify-center text-[var(--brand-lime)] shrink-0">
                                                    <Receipt size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[var(--text-main)]">No bill generated yet</p>
                                                    <p className="text-xs text-[var(--text-muted)] mt-1">
                                                        Once work is finalized, generate a service bill to calculate final costs.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase ml-1">Hourly Rate (AED)</label>
                                                <input
                                                    type="number"
                                                    id="hourlyRate"
                                                    value={hourlyRate}
                                                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--brand-lime)]/50 transition-colors"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase ml-1">Tax Profile</label>
                                                <select
                                                    id="taxProfile"
                                                    value={taxProfileId}
                                                    onChange={(e) => {
                                                        const selected = taxProfiles.find(t => t._id === e.target.value);
                                                        if (selected) {
                                                            setTaxProfileId(selected._id);
                                                            setTaxRate(selected.rate);
                                                            setTaxName(selected.name);
                                                        }
                                                    }}
                                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--brand-lime)]/50 transition-colors"
                                                >
                                                    {taxProfiles.map(tax => (
                                                        <option key={tax._id} value={tax._id}>
                                                            {tax.name} ({tax.rate}%)
                                                        </option>
                                                    ))}
                                                    {taxProfiles.length === 0 && (
                                                        <option value="">ITBMS (7%)</option>
                                                    )}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Driver Billed Option */}
                                        <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDriverBilled ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] font-bold' : 'bg-white/5 text-[var(--text-dim)]'}`}>
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Driver Billed</p>
                                                            {isDriverBilled && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-lime)]/20 text-[var(--brand-lime)] uppercase tracking-wider">
                                                                    Enabled
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
                                                            Link this service bill directly to a driver and customer billing account
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-label="Toggle driver billed"
                                                    className={`w-12 h-6 rounded-full transition-all relative ${isDriverBilled ? 'bg-[var(--brand-lime)]' : 'bg-white/10'}`}
                                                    onClick={() => {
                                                        const next = !isDriverBilled;
                                                        setIsDriverBilled(next);
                                                        if (next && !selectedDriverId) {
                                                            const v = wo.vehicleId as any;
                                                            const vDriverId = v?.currentDriver?._id || (typeof v?.currentDriver === 'string' ? v?.currentDriver : null);
                                                            if (vDriverId) {
                                                                setSelectedDriverId(vDriverId);
                                                                const matched = billingDrivers.find(d => d._id === vDriverId);
                                                                if (matched?.customer?._id) {
                                                                    setSelectedCustomerId(matched.customer._id);
                                                                }
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDriverBilled ? 'right-1' : 'left-1'}`} />
                                                </button>
                                            </div>

                                            {isDriverBilled && (
                                                <div className="pt-3 border-t border-[var(--border-main)]/60 space-y-2.5">
                                                    {/* Quick vehicle driver suggestion if assigned to vehicle */}
                                                    {(() => {
                                                        const v = wo.vehicleId as any;
                                                        const vDriver = v?.currentDriver;
                                                        const vDriverId = vDriver?._id || (typeof vDriver === 'string' ? vDriver : null);
                                                        const vDriverName = vDriver?.personalInfo?.fullName || (billingDrivers.find(d => d._id === vDriverId)?.fullName);
                                                        if (vDriverId && vDriverName && selectedDriverId !== vDriverId) {
                                                            return (
                                                                <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--brand-lime-alpha)]/10 border border-[var(--brand-lime-alpha)]/30 text-[11px]">
                                                                    <div className="flex items-center gap-1.5 text-[var(--text-main)]">
                                                                        <Car size={13} className="text-[var(--brand-lime)]" />
                                                                        <span>Vehicle Assigned Driver: <strong>{vDriverName}</strong></span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedDriverId(vDriverId);
                                                                            const matched = billingDrivers.find(d => d._id === vDriverId);
                                                                            if (matched?.customer?._id) setSelectedCustomerId(matched.customer._id);
                                                                        }}
                                                                        className="px-2 py-0.5 rounded bg-[var(--brand-lime)] text-[var(--brand-black)] font-bold text-[10px] hover:brightness-110 transition-all"
                                                                    >
                                                                        Select
                                                                    </button>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    <div className="space-y-1.5" ref={driverDropdownRef}>
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                                                                Select Driver
                                                            </label>
                                                            {driversLoading && (
                                                                <span className="text-[10px] text-[var(--brand-lime)] flex items-center gap-1">
                                                                    <Loader2 size={10} className="animate-spin" /> Loading drivers...
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Custom Dropdown Trigger */}
                                                        <div className="relative">
                                                            {(() => {
                                                                const matchedDriver = billingDrivers.find(d => d._id === selectedDriverId);
                                                                const v = wo.vehicleId as any;
                                                                const fallbackName = typeof v?.currentDriver === 'object' && v?.currentDriver?._id === selectedDriverId
                                                                    ? v.currentDriver.personalInfo?.fullName
                                                                    : null;

                                                                return (
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        onClick={() => setIsDriverDropdownOpen(prev => !prev)}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDriverDropdownOpen(prev => !prev); }}
                                                                        className={`w-full bg-[var(--bg-card)] border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${isDriverDropdownOpen ? 'border-[var(--brand-lime)] ring-1 ring-[var(--brand-lime)]/20' : 'border-[var(--border-main)] hover:border-[var(--brand-lime)]/50'}`}
                                                                    >
                                                                        {matchedDriver || fallbackName ? (
                                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-lime)] text-[var(--brand-black)] font-bold flex items-center justify-center shrink-0 text-xs">
                                                                                    {(matchedDriver?.fullName || fallbackName || 'D').charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="text-xs font-bold text-[var(--text-main)] truncate">
                                                                                            {matchedDriver?.fullName || fallbackName}
                                                                                        </p>
                                                                                        {matchedDriver?.driverId && (
                                                                                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-[var(--brand-lime)]">
                                                                                                {matchedDriver.driverId}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                                                                                        {matchedDriver?.phone && (
                                                                                            <span className="flex items-center gap-1">
                                                                                                <Phone size={10} /> {matchedDriver.phone}
                                                                                            </span>
                                                                                        )}
                                                                                        {matchedDriver?.customer?.name && (
                                                                                            <span className="text-[var(--text-dim)] truncate">
                                                                                                • Account: <strong className="text-[var(--text-main)]">{matchedDriver.customer.name}</strong>
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2.5 text-[var(--text-muted)]">
                                                                                <Search size={15} />
                                                                                <span className="text-xs">Choose or search a driver to connect...</span>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                            {selectedDriverId && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSelectedDriverId('');
                                                                                        setSelectedCustomerId('');
                                                                                    }}
                                                                                    className="p-1 hover:bg-white/10 rounded-md text-[var(--text-dim)] hover:text-red-400 transition-colors"
                                                                                    title="Clear selection"
                                                                                >
                                                                                    <X size={14} />
                                                                                </button>
                                                                            )}
                                                                            {isDriverDropdownOpen ? <ChevronUp size={16} className="text-[var(--text-dim)]" /> : <ChevronDown size={16} className="text-[var(--text-dim)]" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Dropdown Menu */}
                                                            {isDriverDropdownOpen && (
                                                                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-fadeIn">
                                                                    {/* Search Input */}
                                                                    <div className="p-2.5 border-b border-[var(--border-main)] bg-[var(--bg-input)]">
                                                                        <div className="relative">
                                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Search by name, driver ID, phone, vehicle plate, customer..."
                                                                                value={driverSearchQuery}
                                                                                onChange={(e) => setDriverSearchQuery(e.target.value)}
                                                                                autoFocus
                                                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg pl-8 pr-8 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--brand-lime)]/50"
                                                                            />
                                                                            {driverSearchQuery && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setDriverSearchQuery('')}
                                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-white"
                                                                                >
                                                                                    <X size={12} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Driver List */}
                                                                    <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-main)]/50">
                                                                        {(() => {
                                                                            const q = driverSearchQuery.trim().toLowerCase();
                                                                            const filtered = billingDrivers.filter(d => {
                                                                                if (!q) return true;
                                                                                return (
                                                                                    d.fullName?.toLowerCase().includes(q) ||
                                                                                    d.driverId?.toLowerCase().includes(q) ||
                                                                                    d.phone?.toLowerCase().includes(q) ||
                                                                                    d.email?.toLowerCase().includes(q) ||
                                                                                    d.currentVehicle?.plateNumber?.toLowerCase().includes(q) ||
                                                                                    d.customer?.name?.toLowerCase().includes(q)
                                                                                );
                                                                            });

                                                                            if (filtered.length === 0) {
                                                                                return (
                                                                                    <div className="p-6 text-center text-xs text-[var(--text-dim)]">
                                                                                        {driversLoading ? 'Loading drivers...' : `No drivers found matching "${driverSearchQuery}"`}
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return filtered.map((driver) => {
                                                                                const isSelected = selectedDriverId === driver._id;
                                                                                const v = wo.vehicleId as any;
                                                                                const isCurrentVehicleDriver = (v?.currentDriver?._id || v?.currentDriver) === driver._id;

                                                                                return (
                                                                                    <div
                                                                                        key={driver._id}
                                                                                        onClick={() => {
                                                                                            setSelectedDriverId(driver._id);
                                                                                            setSelectedCustomerId(driver.customer?._id || '');
                                                                                            setIsDriverDropdownOpen(false);
                                                                                            setDriverSearchQuery('');
                                                                                        }}
                                                                                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-[var(--brand-lime-alpha)]/20' : 'hover:bg-white/5'}`}
                                                                                    >
                                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-[var(--brand-lime)] text-[var(--brand-black)]' : 'bg-white/10 text-[var(--text-main)]'}`}>
                                                                                                {driver.fullName ? driver.fullName.charAt(0).toUpperCase() : 'D'}
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-xs font-bold text-[var(--text-main)] truncate">
                                                                                                        {driver.fullName}
                                                                                                    </span>
                                                                                                    {driver.driverId && (
                                                                                                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/20 text-[var(--text-dim)]">
                                                                                                            {driver.driverId}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {isCurrentVehicleDriver && (
                                                                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-lime)]/20 text-[var(--brand-lime)] uppercase tracking-wider">
                                                                                                            This Vehicle
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-0.5">
                                                                                                    {driver.phone && (
                                                                                                        <span className="flex items-center gap-1">
                                                                                                            <Phone size={10} /> {driver.phone}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {driver.currentVehicle?.plateNumber && (
                                                                                                        <span className="flex items-center gap-1 text-[var(--text-dim)]">
                                                                                                            <Car size={10} /> {driver.currentVehicle.plateNumber}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {driver.customer?.name && (
                                                                                                        <span className="text-[var(--brand-lime)] text-[10px] font-semibold">
                                                                                                            Account: {driver.customer.name}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        {isSelected && (
                                                                                            <Check size={16} className="text-[var(--brand-lime)] shrink-0 ml-2" />
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isDriverBilled && !selectedDriverId && (
                                                            <p className="text-[10px] text-amber-400/90 flex items-center gap-1 ml-1">
                                                                <AlertCircle size={11} /> Please select a driver to connect to this bill
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {(() => {
                                            const installedParts = (wo.parts || []).filter((p: any) => p.status === 'INSTALLED');
                                            const computedPartsCost = installedParts.reduce((sum: number, p: any) => sum + (p.totalCost || (p.unitCost || 0) * (p.quantity || 1)), 0);
                                            const labourCost = (wo.actualLabourHours || 0) * hourlyRate;
                                            const preBillValue = labourCost + computedPartsCost;
                                            return (
                                                <>
                                                    <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-2">
                                                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                                            <span>Labour ({wo.actualLabourHours || 0} hrs @ {hourlyRate} AED/hr)</span>
                                                            <span className="font-mono text-[var(--text-main)]">{labourCost} AED</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                                            <span>Parts Cost ({installedParts.length} installed)</span>
                                                            <span className="font-mono text-[var(--text-main)]">{computedPartsCost} AED</span>
                                                        </div>
                                                        <div className="h-px bg-[var(--border-main)] my-2" />
                                                        <div className="flex justify-between text-sm font-bold">
                                                            <span className="text-[var(--text-main)] uppercase">Estimated Bill Total</span>
                                                            <span className="font-mono text-[var(--brand-lime)]">{preBillValue} AED</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="w-full h-14 bg-[var(--brand-lime)] hover:shadow-lg hover:shadow-[var(--brand-lime-alpha)] disabled:opacity-50 text-[var(--brand-black)] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                                        disabled={actionLoading || preBillValue <= 0 || (isDriverBilled && !selectedDriverId) || !['BILLING', 'QUALITY_CHECK', 'READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'INVOICED', 'CLOSED'].includes(wo.status)}
                                                        onClick={async () => {
                                                            if (isDriverBilled && !selectedDriverId) {
                                                                toast.error('Please select a driver to connect to this bill');
                                                                return;
                                                            }
                                                            try {
                                                                await doAction(async () => {
                                                                    const generated = await generateBill(id!, {
                                                                        hourlyRate: Number(hourlyRate),
                                                                        taxRate: Number(taxRate) || 7,
                                                                        taxName: taxName || 'ITBMS 7%',
                                                                        taxProfileId: taxProfileId || undefined,
                                                                        isDriverBilled,
                                                                        driverId: isDriverBilled ? selectedDriverId : undefined,
                                                                        customerId: isDriverBilled ? selectedCustomerId : undefined
                                                                    });
                                                                    if (generated) {
                                                                        setBill(generated);
                                                                    }
                                                                });
                                                                setShowBillModal(true);
                                                            } catch {
                                                                // error handled by doAction
                                                            }
                                                        }}
                                                    >
                                                        {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Receipt size={20} />}
                                                        Generate Final Bill
                                                    </button>

                                                    {preBillValue <= 0 && (
                                                        <div className="flex items-center justify-center gap-2 text-red-500/80">
                                                            <AlertTriangle size={14} />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">Bill value must be greater than 0 to generate a bill</span>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        {!['BILLING', 'QC_PHOTOS', 'QUALITY_CHECK', 'READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'INVOICED', 'CLOSED'].includes(wo.status) && (
                                            <div className="flex items-center justify-center gap-2 text-red-500/80">
                                                <AlertTriangle size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Status must be QC or higher to generate bill</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-2xl bg-[var(--brand-lime-alpha)]/5 border border-[var(--brand-lime-alpha)] relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <p className="text-[10px] font-bold text-[var(--brand-lime)] uppercase tracking-wider">
                                                        {bill?.status === 'APPROVED' ? 'Bill Approved' : 'Bill Draft Generated'}
                                                    </p>
                                                    <h4 className="text-xl font-bold text-[var(--text-main)] mt-1">
                                                        {bill?.status === 'APPROVED' ? 'Invoice Linked Successfully' : 'Awaiting Approval & Invoicing'}
                                                    </h4>
                                                    <p className="text-xs font-mono font-bold text-[var(--text-dim)] mt-2 bg-black/10 px-2 py-1 rounded-md inline-block">
                                                        ID: {bill?.billNumber}
                                                    </p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-[var(--brand-lime-alpha)] flex items-center justify-center text-[var(--brand-lime)]">
                                                    <CheckCircle2 size={24} />
                                                </div>
                                            </div>

                                            {bill?.isDriverBilled && (
                                                <div className="mb-5 p-3.5 rounded-xl bg-[var(--brand-lime-alpha)]/10 border border-[var(--brand-lime-alpha)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-[var(--brand-lime)] text-[var(--brand-black)] flex items-center justify-center font-bold shrink-0">
                                                            <User size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-lime)]">
                                                                    Driver Billed
                                                                </span>
                                                                {bill.driverId?.driverId && (
                                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-[var(--text-muted)]">
                                                                        {bill.driverId.driverId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-bold text-[var(--text-main)]">
                                                                {bill.driverId?.personalInfo?.fullName || bill.driverId?.fullName || (typeof bill.driverId === 'string' ? bill.driverId : 'Assigned Driver')}
                                                            </p>
                                                            {bill.driverId?.phone && (
                                                                <p className="text-[11px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5">
                                                                    <Phone size={10} /> {bill.driverId.phone}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {bill.customerId && (
                                                        <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-main)]/50">
                                                            <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider block">Customer Billing Account</span>
                                                            <p className="text-xs font-semibold text-[var(--text-main)]">
                                                                {bill.customerId?.name || 'Linked Account'}
                                                            </p>
                                                            {bill.customerId?.customerId && (
                                                                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                                                                    ID: {bill.customerId.customerId}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-4 py-4 border-y border-[var(--border-main)]">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-[var(--text-muted)]">Actual Labour ({wo.actualLabourHours} hrs)</span>
                                                    <span className="text-[var(--text-main)] font-mono">{(wo.actualLabourHours || 0) * (bill?.labourSummary?.hourlyRate || 50)} $</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-[var(--text-muted)]">Parts Total</span>
                                                    <span className="text-[var(--text-main)] font-mono">{wo.actualPartsCost || 0} $</span>
                                                </div>
                                            </div>

                                            <div className="pt-4 flex justify-between items-center">
                                                <span className="text-sm font-bold text-[var(--text-main)] uppercase">Total Amount</span>
                                                <span className="text-2xl font-black text-[var(--brand-lime)] font-mono">
                                                    {bill?.totalAmount?.toLocaleString() || ((wo.actualPartsCost || 0) + ((wo.actualLabourHours || 0) * 50))} $
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                className="w-full h-12 bg-transparent hover:bg-white/5 border border-[var(--border-main)] text-[var(--text-main)] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                                onClick={() => navigate(`/service-bills`)}
                                            >
                                                Go to Bills Management
                                                <ChevronRight size={16} />
                                            </button>
                                            <button
                                                className="w-full h-12 bg-[var(--brand-lime)] hover:shadow-lg hover:shadow-[var(--brand-lime-alpha)] text-[var(--brand-black)] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                                                onClick={() => setShowBillModal(true)}
                                            >
                                                <Eye size={16} />
                                                Show Bill
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                    </div>
                </div>
            )}

            {/* Webcam Photo Capture Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 w-full max-w-md space-y-4 flex flex-col items-center shadow-2xl">
                        <div className="w-full flex items-center justify-between">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Take Vehicle Photo</h3>
                            <button type="button" onClick={stopCamera} className="p-1 text-gray-400 hover:text-white rounded-lg cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex gap-3 w-full">
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="btn-secondary flex-1 py-3 text-xs font-bold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="btn-primary flex-1 py-3 text-xs font-bold cursor-pointer"
                            >
                                Capture
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Photo Preview Lightbox Modal ── */}
            {previewPhoto && (
                <div 
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <div 
                        className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)]/50 bg-black/40">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-lime)] bg-[var(--brand-lime-alpha)]/20 px-2 py-0.5 rounded font-mono">
                                    {previewPhoto.stage || 'QC'}
                                </span>
                                <h3 className="text-sm font-bold text-white truncate">
                                    {previewPhoto.caption || 'Verification Photo'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto(null)}
                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-3 bg-black flex items-center justify-center overflow-hidden flex-1 min-h-[300px]">
                            <img 
                                src={previewPhoto.url} 
                                alt={previewPhoto.caption || 'QC Photo'} 
                                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Add Part Modal ── */}
            {showConfirmAddPartModal && selectedInventoryPart && (
                <ConfirmAddPartModal
                    isOpen={showConfirmAddPartModal}
                    onClose={() => setShowConfirmAddPartModal(false)}
                    onConfirm={() => doAction(async () => {
                        await addPart(id!, partForm);
                        setShowConfirmAddPartModal(false);
                        setShowPartForm(false);
                        setSelectedInventoryPart(null);
                        setPartForm({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
                    })}
                    workOrder={wo}
                    part={selectedInventoryPart}
                    quantity={partForm.quantity}
                    loading={actionLoading}
                />
            )}

            {/* ── GPS MODAL ── */}
            {showGpsModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-main)]/50 rounded-2xl w-full max-w-4xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6 flex flex-col relative animate-scaleIn">
                        <div className="flex items-center justify-between border-b border-[var(--border-main)]/20 pb-3">
                            <h3 className="text-base font-bold flex items-center gap-2 text-white">
                                <MapPin size={18} className="text-lime" style={{ color: 'var(--brand-lime)' }} />
                                Real-time GPS Tracking
                                {gpsData?.matchType && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] uppercase tracking-wider font-bold">
                                        {gpsData.matchType}
                                    </span>
                                )}
                            </h3>
                            <button 
                                type="button"
                                className="btn-icon !min-w-[32px] !min-h-[32px] hover:bg-white/10 rounded-full"
                                onClick={() => setShowGpsModal(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {gpsLoading && !gpsData ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-lime" size={32} style={{ color: 'var(--brand-lime)' }} />
                                <span className="text-sm text-muted-foreground">Fetching live GPS coordinates...</span>
                            </div>
                        ) : !gpsData ? (
                            <div className="text-center py-12 border border-dashed rounded-xl border-white/10 bg-white/5">
                                <p className="text-sm text-muted-foreground">
                                    {!resolvedImei ? 'No direct GPS IMEI configured, and auto-match could not find a device in the GPS registry.' : `Unable to fetch current GPS coordinates or device offline (IMEI: ${resolvedImei}).`}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">IMEI Number</span>
                                        <span className="text-xs font-semibold text-white font-mono">{gpsData.imei || resolvedImei}</span>
                                    </div>

                                    <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Coordinates</span>
                                        <span className="text-xs font-semibold text-white font-mono">{gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}</span>
                                    </div>

                                    <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Engine Status (ACC)</span>
                                        <span className={`text-xs font-semibold uppercase tracking-wider ${gpsData.accStatus === 1 ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                            ● {gpsData.accStatus === 1 ? 'ON' : 'OFF'}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Speed / Battery</span>
                                        <span className="text-xs font-semibold text-white">{gpsData.speed} KM/H • 🔋 {gpsData.electQuantity}%</span>
                                    </div>

                                    <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Last Sync (GPS Time)</span>
                                        <span className="text-xs font-semibold text-white font-mono">{new Date(gpsData.gpsTime || gpsData.hbTime).toLocaleString()}</span>
                                    </div>

                                    {gpsMileage && (
                                        <>
                                            <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Total Odometer Mileage</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {(gpsMileage.totalMileage / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} KM
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Today's Trip Distance</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {(gpsMileage.distance / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} KM
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Today's Average Speed</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {gpsMileage.avgSpeed} KM/H
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-white/5 bg-white/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Today's Drive Duration</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {gpsMileage.elapsed > 0 ? `${Math.floor(gpsMileage.elapsed / 60)}m ${gpsMileage.elapsed % 60}s` : '0m'}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {obdData && (
                                        <>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Odometer Reading</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {obdData.odometerReading ? `${parseFloat(obdData.odometerReading).toLocaleString(undefined, { maximumFractionDigits: 1 })} KM` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Accum. Mileage</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {obdData.deviceAccumulatedMileage ? `${parseFloat(obdData.deviceAccumulatedMileage).toLocaleString(undefined, { maximumFractionDigits: 1 })} KM` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Remaining Fuel</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {obdData.remainingFuelPercentage ? `${obdData.remainingFuelPercentage}%` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Engine RPM</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {obdData.currentRPM ? `${obdData.currentRPM} RPM` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Coolant Temp</span>
                                                <span className="text-xs font-semibold text-white font-mono font-mono font-mono font-mono">
                                                    {obdData.coolantTemperature ? `${obdData.coolantTemperature}°C` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Battery Voltage</span>
                                                <span className="text-xs font-semibold text-white font-mono">
                                                    {obdData.vehicleBatterVoltage ? `${(parseFloat(obdData.vehicleBatterVoltage) / 10).toFixed(1)} V` : 'N/A'}
                                                </span>
                                            </div>
                                            {obdData.vin && (
                                                <div className="sm:col-span-2 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Vehicle VIN</span>
                                                    <span className="text-xs font-semibold text-white font-mono break-all">{obdData.vin}</span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {gpsData.locDesc && (
                                        <div className="sm:col-span-2 md:col-span-3 p-3 rounded-lg border border-white/5 bg-white/5">
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-60">Current Address</span>
                                            <span className="text-xs font-medium text-white">{gpsData.locDesc}</span>
                                        </div>
                                    )}

                                    <div className="sm:col-span-2 md:col-span-4 flex items-center justify-center p-0.5">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${gpsData.lat},${gpsData.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-primary w-full text-center text-xs flex items-center justify-center gap-1.5 !py-2.5"
                                        >
                                            <ExternalLink size={12} /> View on Google Maps
                                        </a>
                                    </div>
                                </div>

                                {gpsTrack && gpsTrack.length > 0 && (
                                    <div className="border-t border-white/10 pt-4">
                                        <h4 className="text-xs font-semibold mb-2.5 flex items-center gap-1.5 text-white">
                                            <Clock size={13} className="text-lime" style={{ color: 'var(--brand-lime)' }} /> Recent Historical Route Points
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px] border-collapse text-left">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-gray-400">Time</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-gray-400">Latitude</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-gray-400">Longitude</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-gray-400">Speed</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-gray-400">Mileage</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-right text-gray-400">Link</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gpsTrack.map((pt, idx) => (
                                                        <tr key={idx} className="border-b border-white/5">
                                                            <td className="py-2 text-white font-mono">{pt.gpsTime}</td>
                                                            <td className="py-2 text-white font-mono">{pt.lat.toFixed(5)}</td>
                                                            <td className="py-2 text-white font-mono">{pt.lng.toFixed(5)}</td>
                                                            <td className="py-2 text-white font-mono">{pt.gpsSpeed !== undefined ? pt.gpsSpeed : (pt.speed || 0)} km/h</td>
                                                            <td className="py-2 text-white font-mono">{pt.mileage !== undefined ? `${(pt.mileage / 1000).toFixed(2)} km` : 'N/A'}</td>
                                                            <td className="py-2 text-right">
                                                                <a
                                                                    href={`https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-lime hover:underline flex items-center justify-end gap-1 font-semibold"
                                                                    style={{ color: 'var(--brand-lime)' }}
                                                                >
                                                                    Map <ExternalLink size={10} />
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Service Bill Modal (Printable A4 Invoice Sheet) ── */}
            {showBillModal && bill && createPortal(
                <div 
                    id="printable-invoice-modal"
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 pb-24 md:pb-32 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain animate-fadeIn"
                    onClick={() => setShowBillModal(false)}
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'var(--brand-lime, #C8E600) rgba(15, 23, 42, 0.7)',
                    }}
                >
                    {/* Scoped Print & Modal Scrollbar CSS Styles */}
                    <style>{`
                        #printable-invoice-modal::-webkit-scrollbar {
                            width: 10px;
                        }
                        #printable-invoice-modal::-webkit-scrollbar-track {
                            background: rgba(15, 23, 42, 0.85);
                        }
                        #printable-invoice-modal::-webkit-scrollbar-thumb {
                            background: #C8E600;
                            border-radius: 6px;
                            border: 2px solid rgba(15, 23, 42, 0.85);
                        }
                        #printable-invoice-modal::-webkit-scrollbar-thumb:hover {
                            background: #d8f200;
                        }

                        @media print {
                            body * {
                                visibility: hidden !important;
                            }
                            #printable-invoice-paper, #printable-invoice-paper * {
                                visibility: visible !important;
                            }
                            #printable-invoice-paper {
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                margin: 0 !important;
                                padding: 12mm 15mm !important;
                                box-shadow: none !important;
                                border: none !important;
                                background: white !important;
                                color: #000 !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                            @page {
                                size: A4 portrait;
                                margin: 0;
                            }
                        }
                    `}</style>

                    {/* Modal Floating Toolbar (Sticky & Hidden on Print) */}
                    <div 
                        className="sticky top-2 sm:top-4 z-50 w-full max-w-[850px] mb-3 flex items-center justify-between bg-[#1e293b]/95 border border-white/10 rounded-2xl px-4 sm:px-5 py-3 shadow-2xl backdrop-blur-md shrink-0 no-print"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand-lime)] text-black flex items-center justify-center font-bold">
                                <Receipt size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white font-mono">{bill.invoiceNumber || bill.billNumber || 'Invoice'}</span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                        bill.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                        bill.status === 'PAID' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    }`}>
                                        {bill.status}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400">Official Workshop Service Invoice Preview</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-[var(--brand-lime)] hover:bg-[#b0cb00] text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                                title="Print A4 Invoice"
                            >
                                <Printer size={15} />
                                <span>Print Invoice</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBillModal(false);
                                    navigate('/service-bills');
                                }}
                                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                                <ExternalLink size={14} />
                                <span className="hidden sm:inline">Bills Module</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBillModal(false)}
                                className="p-2 hover:bg-white/15 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer ml-1"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* The Printable A4 Invoice Paper Container */}
                    <div 
                        id="printable-invoice-paper"
                        className="w-full max-w-[850px] bg-white text-slate-800 shadow-2xl rounded-2xl p-8 sm:p-12 relative font-sans border border-slate-200 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top-Left Corner Accent / Ribbon */}
                        <div className="absolute top-0 left-0 w-28 h-28 overflow-hidden pointer-events-none no-print">
                            <div className="absolute top-4 -left-9 w-32 py-1 bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider text-center -rotate-45 shadow-sm">
                                {bill.status === 'PAID' ? 'PAID' : 'INVOICE'}
                            </div>
                        </div>

                        {/* Top-Right Decorative Header Stripe */}
                        <div className="absolute top-0 right-0 w-36 h-2 bg-gradient-to-l from-sky-500 via-sky-400 to-transparent pointer-events-none"></div>

                        {/* Header: Logo & Address (Left) + Invoice Title & Dates (Right) */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-100 pb-8">
                            {/* Left: OLA WORKSHOP LOGO & SHORT ADDRESS */}
                            <div>
                                {/* OLA WORKSHOP LOGO */}
                                <div className="w-36 h-20 select-none">
                                    <img 
                                        src={workshopLogo} 
                                        alt="Ola Cars Workshop" 
                                        className="w-full h-full object-contain object-left rounded-lg"
                                    />
                                </div>

                                {/* OLA WORKSHOP SHORT ADDRESS */}
                                <div className="mt-3.5 text-xs text-slate-700 leading-relaxed font-sans">
                                    <div className="font-bold text-slate-900 tracking-wide uppercase text-xs">ARRENDADORA OLA WORKSHOP</div>
                                    <div>San Antonio, Avenida Domingo Díaz,</div>
                                    <div>Villa Lucre, Rufina Alfaro, Distrito de San Miguelito,</div>
                                    <div>Panama</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">RUC: 155711200-2-2022 DV: 44</div>
                                    <div className="text-[11px] text-slate-500">Tel: +507 833-9090 | taller@olacars.com</div>
                                </div>
                            </div>

                            {/* Right: Invoice #, Barcode, Dates */}
                            <div className="flex flex-col sm:items-end text-left sm:text-right pt-2 sm:pt-0">
                                <h1 className="text-4xl font-light text-slate-900 tracking-tight">Invoice</h1>
                                <div className="text-sm font-bold text-slate-900 tracking-wide font-mono mt-1">
                                    # {bill.invoiceNumber || bill.billNumber || 'INV2026OW5200'}
                                </div>

                                {/* Barcode Graphic */}
                                <div className="my-2.5">
                                    <svg className="h-8 w-44 text-slate-900" viewBox="0 0 176 32" fill="currentColor">
                                        <rect x="0" y="0" width="3" height="32" />
                                        <rect x="5" y="0" width="1" height="32" />
                                        <rect x="8" y="0" width="4" height="32" />
                                        <rect x="14" y="0" width="2" height="32" />
                                        <rect x="18" y="0" width="1" height="32" />
                                        <rect x="21" y="0" width="3" height="32" />
                                        <rect x="26" y="0" width="2" height="32" />
                                        <rect x="30" y="0" width="5" height="32" />
                                        <rect x="37" y="0" width="1" height="32" />
                                        <rect x="40" y="0" width="3" height="32" />
                                        <rect x="45" y="0" width="2" height="32" />
                                        <rect x="49" y="0" width="4" height="32" />
                                        <rect x="55" y="0" width="1" height="32" />
                                        <rect x="58" y="0" width="3" height="32" />
                                        <rect x="63" y="0" width="2" height="32" />
                                        <rect x="67" y="0" width="5" height="32" />
                                        <rect x="74" y="0" width="2" height="32" />
                                        <rect x="78" y="0" width="1" height="32" />
                                        <rect x="81" y="0" width="4" height="32" />
                                        <rect x="87" y="0" width="2" height="32" />
                                        <rect x="91" y="0" width="3" height="32" />
                                        <rect x="96" y="0" width="1" height="32" />
                                        <rect x="99" y="0" width="4" height="32" />
                                        <rect x="105" y="0" width="2" height="32" />
                                        <rect x="109" y="0" width="1" height="32" />
                                        <rect x="112" y="0" width="5" height="32" />
                                        <rect x="119" y="0" width="2" height="32" />
                                        <rect x="123" y="0" width="3" height="32" />
                                        <rect x="128" y="0" width="1" height="32" />
                                        <rect x="131" y="0" width="4" height="32" />
                                        <rect x="137" y="0" width="2" height="32" />
                                        <rect x="141" y="0" width="3" height="32" />
                                        <rect x="146" y="0" width="1" height="32" />
                                        <rect x="149" y="0" width="4" height="32" />
                                        <rect x="155" y="0" width="2" height="32" />
                                        <rect x="159" y="0" width="5" height="32" />
                                        <rect x="166" y="0" width="2" height="32" />
                                        <rect x="170" y="0" width="4" height="32" />
                                    </svg>
                                </div>

                                {/* Dates */}
                                <div className="space-y-1 text-xs text-slate-700 mt-1 min-w-[210px]">
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-slate-500 font-medium">Invoice Date :</span>
                                        <span className="font-semibold text-slate-900 font-mono">
                                            {(() => {
                                                const d = new Date(bill.createdAt || wo.createdAt || Date.now());
                                                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-slate-500 font-medium">Due Date :</span>
                                        <span className="font-semibold text-slate-900 font-mono">
                                            {(() => {
                                                const d = new Date(bill.dueDate || bill.createdAt || wo.createdAt || Date.now());
                                                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Middle Section: BILLED TO ADDRESS */}
                        <div className="pt-6 pb-2">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bill To</div>
                            {bill.isDriverBilled && bill.driverId ? (
                                <div className="text-xs text-slate-700 leading-relaxed">
                                    <div className="font-bold text-[#2563eb] text-sm tracking-tight uppercase">
                                        {bill.driverId?.personalInfo?.fullName || bill.driverId?.fullName || (typeof bill.driverId === 'string' ? bill.driverId : 'ARRENDADORA OLA CARS, S.A.')}
                                    </div>
                                    <div className="font-bold text-slate-900 mt-1 tracking-wide">
                                        VEHICLE NO : <span className="font-mono">{(wo.vehicleId as any)?.legalDocs?.registrationNumber || (wo.vehicleId as any)?.plateNumber || (wo.vehicleId as any)?.basicDetails?.vin || 'N/A'}</span>
                                    </div>
                                    {bill.driverId?.phone && <div className="text-slate-600">Tel: {bill.driverId.phone}</div>}
                                    {bill.customerId?.name && <div className="text-slate-600">Account: {bill.customerId.name}</div>}
                                    <div className="text-slate-500">Panama City, Panama</div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-700 leading-relaxed">
                                    <div className="font-bold text-[#2563eb] text-sm tracking-tight uppercase">
                                        ARRENDADORA OLA CARS, S.A.
                                    </div>
                                    <div className="font-bold text-slate-900 mt-1 tracking-wide">
                                        VEHICLE NO : <span className="font-mono">{(wo.vehicleId as any)?.legalDocs?.registrationNumber || (wo.vehicleId as any)?.plateNumber || (wo.vehicleId as any)?.basicDetails?.vin || 'N/A'}</span>
                                    </div>
                                    <div className="text-slate-600">Via Tocumen, Frente a Harinas del Istmo</div>
                                    <div className="text-slate-600">Don Bosco, Ciudad de Panamá</div>
                                    <div className="text-slate-500">R.U.C. 155711200-2-2022 D.V. 44</div>
                                </div>
                            )}
                        </div>

                        {/* REFFERANCE AREA */}
                        <div className="py-3 text-xs font-semibold text-slate-800 tracking-wider font-mono uppercase border-b border-gray-100">
                            {(() => {
                                const d = new Date(bill.createdAt || wo.createdAt || Date.now());
                                const dotDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                                const vObj = typeof wo.vehicleId === 'object' ? (wo.vehicleId as any) : null;
                                const make = (vObj?.basicDetails?.make || '').trim();
                                const model = (vObj?.basicDetails?.model || '').trim();
                                const plate = vObj?.legalDocs?.registrationNumber || vObj?.plateNumber || vObj?.basicDetails?.vin || '';
                                const mileage = wo.odometerAtRelease || wo.odometerAtEntry || vObj?.basicDetails?.currentMileage;
                                const mileageStr = mileage ? Number(mileage).toLocaleString() : '';
                                const tag = wo.workOrderType ? `${wo.workOrderType.replace(/_/g, ' ')}` : (wo.workOrderNumber || 'REG');

                                return [dotDate, `${make} ${model}`.trim() || 'VEHICLE', plate, mileageStr, tag].filter(Boolean).join('  ');
                            })()}
                        </div>

                        {/* Itemized Table */}
                        <div className="pt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                                <thead>
                                    <tr className="bg-[#374151] text-white text-[11px] font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-3 text-center w-10">#</th>
                                        <th className="py-2.5 px-3">Item & Description</th>
                                        <th className="py-2.5 px-3 text-center w-24">Qty</th>
                                        <th className="py-2.5 px-3 text-right w-24">Rate</th>
                                        <th className="py-2.5 px-3 text-right w-28">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-slate-800 text-xs">
                                    {(() => {
                                        const rawItems = bill.lineItems && bill.lineItems.length > 0 
                                            ? bill.lineItems 
                                            : [
                                                ...(wo.parts || []).filter((p: any) => p.status === 'INSTALLED').map((p: any) => ({
                                                    type: 'PART',
                                                    description: `${p.partNumber ? `${p.partNumber} - ` : ''}${p.partName}`.toUpperCase(),
                                                    quantity: p.quantity,
                                                    unitPrice: p.unitCost,
                                                    lineTotal: p.totalCost || (p.unitCost * p.quantity)
                                                })),
                                                ...((wo.actualLabourHours || 0) > 0 ? [{
                                                    type: 'LABOUR',
                                                    description: 'LABOUR CHARGE',
                                                    quantity: wo.actualLabourHours,
                                                    unitPrice: hourlyRate || 60,
                                                    lineTotal: (wo.actualLabourHours || 0) * (hourlyRate || 60)
                                                }] : [])
                                            ];

                                        return rawItems.map((item: any, idx: number) => {
                                            const desc = item.description || '';
                                            const descLower = desc.toLowerCase();
                                            let unit = 'pcs';
                                            let displayName = desc;

                                            if (item.type === 'LABOUR' || descLower.includes('labour')) {
                                                displayName = 'LABOUR CHARGE';
                                                unit = 'hrs';
                                            } else if (descLower.includes('oil') || descLower.includes('5w30') || descLower.includes('fluid') || descLower.includes('coolant') || descLower.includes('gallon') || descLower.includes('tank')) {
                                                unit = 'LTR';
                                            } else {
                                                unit = 'pcs';
                                            }

                                            return (
                                                <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
                                                    <td className="py-3 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                                                    <td className="py-3 px-3 font-medium text-slate-900">{displayName}</td>
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="font-mono text-slate-900 font-medium">
                                                            {Number(item.quantity || 0).toFixed(2)}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-sans">
                                                            {unit}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-slate-900">
                                                        {Number(item.unitPrice || 0).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                                                        {Number(item.lineTotal || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Area (Right-aligned) */}
                        <div className="flex justify-end pt-4">
                            <div className="w-72 space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>Total Taxable Amount</span>
                                    <span className="font-mono text-slate-900 font-semibold">
                                        {Number(bill.subtotal ?? (bill.totalAmount ? (bill.totalAmount - (bill.taxAmount || 0)) : 0)).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>{(() => {
                                        const raw = bill.taxName || 'ITBMS';
                                        const cleaned = raw.replace(/\(\s*\d+%\s*\)/g, '').replace(/\b\d+%\b/g, '').trim();
                                        return `${cleaned || 'ITBMS'} (${bill.taxRate ?? 7}%)`;
                                    })()}</span>
                                    <span className="font-mono text-slate-900 font-semibold">
                                        {Number(bill.taxAmount || 0).toFixed(2)}
                                    </span>
                                </div>
                                {Number(bill.discount || 0) > 0 && (
                                    <div className="flex justify-between items-center text-emerald-600">
                                        <span>Discount</span>
                                        <span className="font-mono font-semibold">
                                            -{Number(bill.discount).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                {(() => {
                                    const taxable = Number(bill.subtotal ?? (bill.totalAmount ? (bill.totalAmount - (bill.taxAmount || 0)) : 0));
                                    const taxAmt = Number(bill.taxAmount || 0);
                                    const disc = Number(bill.discount || 0);
                                    // Total amount should be Total Taxable Amount + ITBMS - Discount
                                    const computedTotal = Number(bill.totalAmount && bill.totalAmount > taxable ? bill.totalAmount : (taxable + taxAmt - disc));
                                    const balDue = Math.max(0, computedTotal - Number(bill.amountPaid || 0));
                                    return (
                                        <>
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-slate-900 font-bold text-sm">
                                                <span>Total</span>
                                                <span className="font-mono font-black">
                                                    ${computedTotal.toFixed(2)}
                                                </span>
                                            </div>

                                            {/* Highlighted Balance Due Box */}
                                            <div className="mt-2.5 p-3 bg-slate-100 rounded-lg flex justify-between items-center border border-slate-200">
                                                <span className="font-bold text-slate-800 text-sm">Balance Due</span>
                                                <span className="font-mono font-black text-slate-900 text-base">
                                                    ${balDue.toFixed(2)}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Notes & Terms & Conditions */}
                        <div className="pt-8 space-y-4 text-xs text-slate-600 border-t border-gray-100 mt-6">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-0.5">Notes</h4>
                                <p className="text-slate-600">{bill.notes || 'Thanks for your business.'}</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-0.5">Terms & Conditions</h4>
                                <p className="text-slate-600">Payment Terms and Late Fee Policy</p>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Edit Part Quantity Modal ── */}
            {selectedPartForQty && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="glass-card max-w-md w-full p-6 border border-[var(--border-main)] rounded-2xl space-y-5 shadow-2xl bg-[#0f172a]/95 text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                                    <Pencil size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Edit Part Quantity</h3>
                                    <p className="text-xs text-muted-foreground">{selectedPartForQty.partName} {selectedPartForQty.partNumber ? `(${selectedPartForQty.partNumber})` : ''}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPartForQty(null)}
                                disabled={qtySubmitting}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Part summary & Inventory availability stats */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">Current Assigned</span>
                                <span className="font-mono text-base font-bold text-white">{selectedPartForQty.quantity}</span>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">Available in Inventory</span>
                                {checkingStock ? (
                                    <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verifying stock...</span>
                                ) : inventoryStockInfo ? (
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <span className={`font-mono text-base font-bold ${inventoryStockInfo.available > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {inventoryStockInfo.available}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            ({inventoryStockInfo.onHand} on hand)
                                        </span>
                                    </div>
                                ) : (
                                    <span className="font-mono text-xs text-slate-400">Non-inventory part</span>
                                )}
                            </div>
                        </div>

                        {/* Manual Quantity Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                                <span>Quantity (Edit number manually)</span>
                                <span className="text-[10px] text-amber-400 font-mono">Supports decimals (e.g. 1.5, 2)</span>
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0.001"
                                placeholder="Enter quantity"
                                value={manualQtyInput}
                                onChange={(e) => setManualQtyInput(e.target.value)}
                                className="input-field w-full font-mono text-xl font-bold !py-2.5 !px-3"
                                autoFocus
                            />
                            {/* Quick adjust chips */}
                            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                <span className="text-[10px] text-muted-foreground font-medium mr-1">Quick adjust:</span>
                                {[-1, +0.5, +1, +2, +5].map((step) => (
                                    <button
                                        key={step}
                                        type="button"
                                        onClick={() => {
                                            const curr = parseFloat(manualQtyInput) || selectedPartForQty.quantity || 0;
                                            const nextVal = Math.max(0.1, Math.round((curr + step) * 10) / 10);
                                            setManualQtyInput(nextVal.toString());
                                        }}
                                        className="px-2 py-0.5 text-[11px] rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono cursor-pointer transition-colors"
                                    >
                                        {step > 0 ? `+${step}` : step}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Calculations & Availability Validation Preview */}
                        {(() => {
                            const newQty = parseFloat(manualQtyInput);
                            const isValid = !isNaN(newQty) && newQty > 0;
                            const delta = isValid ? Math.round((newQty - selectedPartForQty.quantity) * 1000) / 1000 : 0;
                            const newTotalCost = isValid ? Math.round((newQty * selectedPartForQty.unitCost) * 100) / 100 : selectedPartForQty.totalCost;
                            
                            const isShortage = delta > 0 && inventoryStockInfo && delta > inventoryStockInfo.available;
                            const isBlocked = Boolean(inventoryStockInfo?.isBlocked);

                            return (
                                <div className="space-y-2">
                                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5">
                                        <div className="flex justify-between text-slate-300">
                                            <span>New Total Quantity:</span>
                                            <span className="font-mono font-bold text-white">{isValid ? newQty : '—'}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-300">
                                            <span>Quantity Difference:</span>
                                            <span className={`font-mono font-bold ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                                                {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0 (No change)'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-300">
                                            <span>New Total Cost:</span>
                                            <span className="font-mono font-bold text-emerald-400">${newTotalCost.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Inventory stock availability validation alert */}
                                    {isBlocked ? (
                                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                                            <AlertTriangle size={15} className="shrink-0 text-red-400 mt-0.5" />
                                            <div>
                                                <strong className="block text-red-200">Part is Blocked in Inventory</strong>
                                                <span>Reason: {inventoryStockInfo?.blockedReason || 'Admin blocked issuance.'}</span>
                                            </div>
                                        </div>
                                    ) : isShortage ? (
                                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                                            <AlertTriangle size={15} className="shrink-0 text-red-400 mt-0.5" />
                                            <div>
                                                <strong className="block text-red-200">Insufficient Inventory Stock</strong>
                                                <span>
                                                    Available stock: <strong>{inventoryStockInfo?.available}</strong> units. You need +<strong>{delta}</strong> more units (Shortage: {Math.round((delta - (inventoryStockInfo?.available || 0)) * 1000) / 1000}).
                                                </span>
                                            </div>
                                        </div>
                                    ) : delta > 0 ? (
                                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                                            <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                                                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                                <span>Stock Verified: {inventoryStockInfo ? `${inventoryStockInfo.available} units available in backend inventory` : 'Available'}</span>
                                            </div>
                                            <p className="text-[11px] text-amber-300/90 flex items-center gap-1">
                                                <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                                                <span>Adding +{delta} units requires <strong>Manager Approval</strong> before inventory stock is deducted.</span>
                                            </p>
                                        </div>
                                    ) : delta < 0 ? (
                                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
                                            <Info size={14} className="shrink-0 text-blue-400" />
                                            <span>Reducing quantity by {Math.abs(delta)} unit(s).</span>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })()}

                        {/* Action buttons */}
                        {(() => {
                            const newQty = parseFloat(manualQtyInput);
                            const isValid = !isNaN(newQty) && newQty > 0;
                            const delta = isValid ? Math.round((newQty - selectedPartForQty.quantity) * 1000) / 1000 : 0;
                            const isShortage = delta > 0 && inventoryStockInfo && delta > inventoryStockInfo.available;
                            const isBlocked = Boolean(inventoryStockInfo?.isBlocked);
                            const isSaveDisabled = qtySubmitting || !isValid || delta === 0 || isShortage || isBlocked;

                            return (
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        disabled={qtySubmitting}
                                        onClick={() => setSelectedPartForQty(null)}
                                        className="btn-secondary text-xs flex-1 !py-2.5 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSaveDisabled}
                                        onClick={handleConfirmEditQty}
                                        className="btn-primary text-xs flex-1 !py-2.5 flex items-center justify-center gap-1.5 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {qtySubmitting ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : isShortage ? (
                                            'Insufficient Stock'
                                        ) : (
                                            <><CheckCircle2 size={14} /> {delta > 0 ? `Save & Request (+${delta})` : 'Update Quantity'}</>
                                        )}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── Status Stepper (Workflow) Fixed at Bottom ── */}
            <StatusStepper 
                currentStatus={wo.status} 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onTransition={handleTransition}
                actionLoading={actionLoading}
                hasPendingPartApprovals={(wo.parts || []).some(p => (p as any).approvalStatus === 'PENDING')}
            />
        </div>
    );
};

/* ── Reusable Info Row ── */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-start gap-4">
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm text-right font-medium" style={{ color: 'var(--text-main)' }}>{value}</p>
    </div>
);

const PHASES = [
    { key: 'tasks', label: 'Tasks & Parts', status: 'TASKS' },
    { key: 'labour', label: 'Labour', status: 'LABOUR' },
    { key: 'qc', label: 'QC & Photos', status: 'QC_PHOTOS' },
    { key: 'billing', label: 'Billing', status: 'BILLING' },
] as const;

const StatusStepper = ({
    currentStatus,
    activeTab,
    setActiveTab,
    onTransition,
    actionLoading,
    hasPendingPartApprovals
}: {
    currentStatus: WorkOrderStatus;
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    onTransition: (targetStatus: WorkOrderStatus, targetTab: Tab) => Promise<void>;
    actionLoading: boolean;
    hasPendingPartApprovals: boolean;
}) => {
    const normalizedStatus = normalizeStatus(currentStatus);
    const currentPhaseIndex = PHASES.findIndex(p => p.status === normalizedStatus);
    if (normalizedStatus === 'CANCELLED') return null;

    const prevPhase = currentPhaseIndex > 0 ? PHASES[currentPhaseIndex - 1] : null;
    const nextPhase = currentPhaseIndex < PHASES.length - 1 ? PHASES[currentPhaseIndex + 1] : null;
    const isLabourProgressBlocked = nextPhase?.status === 'LABOUR' && hasPendingPartApprovals;

    return (
        <div className="sticky bottom-0 z-40 w-full mt-8 bg-[#0c0c0e]/95 backdrop-blur-md border border-[var(--border-main)]/80 py-4 px-6 rounded-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Left: Status Indicator */}
                <div className="flex flex-col items-start min-w-[140px]">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Current Status</span>
                    <span className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand-lime)] animate-pulse" />
                        {currentStatus.replace(/_/g, ' ')}
                    </span>
                </div>

                {/* Center: Interactive Stepper (Switches active views/tabs) */}
                <div className="flex-1 flex items-center justify-center max-w-2xl w-full">
                    {PHASES.map((phase, idx) => {
                        const isCompleted = idx < currentPhaseIndex;
                        const isActive = idx === currentPhaseIndex;
                        const isTabActive = activeTab === phase.key;
                        const isLast = idx === PHASES.length - 1;
                        const isNavigable = idx <= currentPhaseIndex;

                        return (
                            <div key={phase.key} className="flex-1 flex items-center">
                                <button
                                    type="button"
                                    disabled={actionLoading || !isNavigable}
                                    onClick={() => {
                                        if (isNavigable) {
                                            setActiveTab(phase.key);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-1.5 relative focus:outline-none transition-all duration-200 select-none ${
                                        isNavigable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-30'
                                    }`}
                                >
                                    <div
                                        className={`w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 z-10 ${
                                            isCompleted ? 'bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                            isActive ? 'ring-4 ring-[var(--brand-lime-alpha)] bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                            'bg-[var(--bg-input)] text-[var(--text-dim)] border border-[var(--border-main)]'
                                        } ${isTabActive && !isActive ? 'border-[var(--brand-lime)] border-2' : ''}`}
                                    >
                                        {isCompleted ? <CheckCircle2 size={13} className="stroke-[3]" /> : idx + 1}
                                    </div>
                                    <span
                                        className={`text-[9px] font-bold whitespace-nowrap uppercase tracking-wider ${
                                            isTabActive ? 'text-[var(--brand-lime)] font-black' : 'text-[var(--text-dim)]'
                                        }`}
                                    >
                                        {phase.label}
                                    </span>
                                </button>
                                {!isLast && (
                                    <div className="flex-1 h-[2px] mx-4 mb-4 bg-[var(--border-main)]/30 overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--brand-lime)] transition-all duration-700 ease-in-out"
                                            style={{ width: isCompleted ? '100%' : '0%' }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right: Previous & Progress Action Buttons */}
                <div className="flex items-center justify-end gap-3 w-full md:w-auto flex-wrap">
                    {prevPhase && (
                        <button
                            type="button"
                            id="prev-step-btn"
                            disabled={actionLoading}
                            onClick={async () => {
                                await onTransition(prevPhase.status, prevPhase.key);
                            }}
                            className="btn-secondary !py-2.5 !px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 rounded-xl border border-[var(--border-main)] hover:border-white/40 hover:text-white transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-50"
                        >
                            <ArrowLeft size={13} className="stroke-[2.5]" />
                            Previous: {prevPhase.label}
                        </button>
                    )}

                    {nextPhase ? (
                        <button
                            type="button"
                            id="progress-step-btn"
                            disabled={actionLoading || isLabourProgressBlocked}
                            title={isLabourProgressBlocked ? "Cannot progress: Parts are awaiting Workshop Manager approval" : ""}
                            onClick={async () => {
                                if (isLabourProgressBlocked) return;
                                await onTransition(nextPhase.status, nextPhase.key);
                            }}
                            className={`btn-primary !py-2.5 !px-6 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all duration-150 ${
                                isLabourProgressBlocked
                                    ? '!bg-amber-500/20 !text-amber-300 !border-amber-500/40 cursor-not-allowed opacity-70 shadow-none hover:scale-100'
                                    : 'shadow-[var(--brand-lime-alpha)]/20 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                            {actionLoading ? (
                                <Loader2 size={13} className="animate-spin" />
                            ) : isLabourProgressBlocked ? (
                                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                            ) : (
                                <ArrowRight size={13} className="stroke-[2.5]" />
                            )}
                            {isLabourProgressBlocked ? 'Parts Approval Pending' : `Progress to ${nextPhase.label}`}
                        </button>
                    ) : (
                        <span className="text-xs font-bold text-[var(--brand-lime)] bg-[var(--brand-lime-alpha)] px-3 py-1.5 rounded-lg border border-[var(--brand-lime)]/20 uppercase tracking-wider">
                            Billing / Final Stage
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkOrderDetail;
