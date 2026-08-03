import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Loader2, Info, ListChecks, Package, Clock, Shield, Camera,
    Play, Pause, Square, PlusCircle, Trash2, CheckCircle2, ChevronRight, ArrowRight, Upload, AlertTriangle,
    Receipt, CreditCard, DollarSign, MapPin, RefreshCw, ExternalLink, X, Plus
} from 'lucide-react';
import {
    getWorkOrderById, progressWorkOrderStatus, addTask, updateTask, removeTask, toggleTaskDoable,
    addPart, updatePart, removePart, logLabour, generateQC, submitQC, addPhoto, addPhotoFile, removePhoto,
    generateBill, approveBill, markBillPaid, getServiceBillById, releaseVehicle,
    getHourlyLabourRate, getTaxProfiles, approvePart, rejectPart, approveAllParts,
    type WorkOrder, type WorkOrderStatus, type TaskStatus, type PartStatus,
    type QCResult, type AddTaskPayload, type AddPartPayload, type PartSource,
    type TaxProfile,
} from '../services/workOrderService';
import { getUserId, getUser, getUserRole } from '../utils/auth';
import { getParts, type InventoryPart } from '../services/inventoryService';
import {
    getVehicleGpsLocation, getGpsDevices, getVehicleGpsMileage, getVehicleGpsTrack, getVehicleGpsObdData,
    type GpsLocationData, type GpsMileageData, type GpsTrackPoint, type GpsObdData
} from '../services/vehicleService';
import toast from 'react-hot-toast';

type Tab = 'tasks' | 'labour' | 'qc' | 'billing';

const ALLOWED_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
    TASKS: ['LABOUR', 'CANCELLED'],
    LABOUR: ['QC_PHOTOS', 'CANCELLED'],
    QC_PHOTOS: ['BILLING', 'LABOUR', 'CANCELLED'],
    BILLING: [],
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
    const [partsLoading, setPartsLoading] = useState(false);
    const user = getUser();
    const branchId = (user?.branchId as string) || '';

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
    const [isDriverBilled, setIsDriverBilled] = useState(false);
    const [hourlyRate, setHourlyRate] = useState(150);
    const [taxRate, setTaxRate] = useState(7);
    const [taxProfileId, setTaxProfileId] = useState('');
    const [taxName, setTaxName] = useState('');
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
                const itbms = taxes?.find((t: any) => t.name === 'ITBMS');
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

            if (data.serviceBillId) {
                const b = await getServiceBillById(data.serviceBillId);
                setBill(b);
            } else {
                setBill(null);
                // Default isDriverBilled to true if vehicle has current driver assigned
                const v = data.vehicleId as any;
                if (v && v.currentDriver) {
                    setIsDriverBilled(true);
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
            getServiceBillById(wo.serviceBillId).then(setBill).catch(() => { });
        }
    }, [wo?.serviceBillId, bill]);

    // Load inventory parts for the dropdown
    useEffect(() => {
        const woBranchId = typeof wo?.branchId === 'object' ? (wo.branchId as any)?._id : wo?.branchId;
        const fetchBranchId = woBranchId || branchId;
        if (fetchBranchId) {
            setPartsLoading(true);
            getParts({ branchId: fetchBranchId }).then(parts => {
                const vehicle = wo?.vehicleId as any;
                const rawMake = (vehicle?.basicDetails?.make || '').toLowerCase().trim();
                const rawModel = (vehicle?.basicDetails?.model || '').toLowerCase().trim();

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

                const ALL_KNOWN_MODELS = ['carens', 'soluto', 'brv', 'x70', 's07', 'okavango', 'tiggo'];

                const filtered = parts.filter(p => {
                    if (!p.isActive) return false;
                    if (!rawMake && !rawModel) return true;

                    const nameClean = (p.partName || p.partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const descClean = (p.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const text = `${nameClean} ${descClean}`;

                    // 1. Model Specificity Rule:
                    const mentionedModel = ALL_KNOWN_MODELS.find(m => text.includes(m));
                    if (mentionedModel) {
                        return canonicalModel ? text.includes(canonicalModel) : false;
                    }

                    // 2. Make Rule:
                    if (canonicalMake) {
                        if (canonicalMake === 'jetour' || canonicalMake === 'soueast') {
                            return text.includes('jetour') || text.includes('soueast') || text.includes('souest');
                        }
                        if (canonicalMake === 'chery') {
                            return text.includes('chery') || text.includes('cherry') || text.includes('tiggo');
                        }
                        return text.includes(canonicalMake);
                    }

                    return true;
                });

                setInventoryParts(filtered);
            }).catch(() => { }).finally(() => setPartsLoading(false));
        }
    }, [wo?.branchId, wo?.vehicleId, branchId]);

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

            const missingTaskPhotos = doableTasks.filter(t =>
                t.status === 'COMPLETED' && !wo?.photos.some(p => p.caption === `TASK_${t._id}`)
            );
            if (missingTaskPhotos.length > 0) {
                toast.error(`Please upload photos for completed tasks: ${missingTaskPhotos.map(t => t.description).join(', ')}`);
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
            <div className="flex items-start gap-3 flex-wrap">
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
                    <div className="space-y-4 lg:border-l lg:border-[var(--border-main)]/20 lg:pl-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.parts')} ({wo.parts.length})</h3>
                            {!['BILLING', 'CANCELLED'].includes(wo.status) && (
                                <button className="btn-primary text-xs !py-2" onClick={() => setShowPartForm(!showPartForm)}>
                                    <PlusCircle size={14} /> Add Part
                                </button>
                            )}
                        </div>
                        {showPartForm && (
                            <div className="glass-card p-4 space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Select Part from Inventory *</label>
                                    <select
                                        className="input-field"
                                        value={selectedInventoryPart?._id || ''}
                                        onChange={(e) => {
                                            const part = inventoryParts.find(p => p._id === e.target.value);
                                            setSelectedInventoryPart(part || null);
                                            if (part) {
                                                setPartForm({
                                                    ...partForm,
                                                    partName: part.partName,
                                                    partNumber: part.partNumber,
                                                    unitCost: part.unitCost,
                                                    inventoryPartId: part._id,
                                                    source: 'IN_STOCK',
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">{partsLoading ? 'Loading parts...' : '— Choose a part —'}</option>
                                        {inventoryParts.map(p => {
                                            const available = p.quantityOnHand - p.quantityReserved;
                                            return (
                                                <option key={p._id} value={p._id}>
                                                    {p.partName} ({p.partNumber}) — {available > 0 ? `${available} available` : 'OUT OF STOCK'}
                                                </option>
                                            );
                                        })}
                                    </select>
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
                                    <input type="number" placeholder="Qty" value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: Number(e.target.value) })} className="input-field max-w-[200px]" min="1" />
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-secondary text-xs flex-1" onClick={() => { setShowPartForm(false); setSelectedInventoryPart(null); }}>{t('common.cancel')}</button>
                                    <button className="btn-primary text-xs flex-1" disabled={!selectedInventoryPart || actionLoading}
                                        onClick={() => doAction(async () => {
                                            await addPart(id!, partForm);
                                            setShowPartForm(false);
                                            setSelectedInventoryPart(null);
                                            setPartForm({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
                                        })}>
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
                            <div className="glass-card p-8 text-center">
                                <Package size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
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
                                                    <p className="text-xs mt-1 text-muted-foreground">
                                                        Qty: <strong className="text-white">{part.quantity}</strong> • ${part.unitCost.toFixed(2)} each = <strong className="text-emerald-400">${part.totalCost.toFixed(2)}</strong>
                                                    </p>
                                                    {(part as any).rejectionReason && (
                                                        <p className="text-[11px] text-red-400 mt-1 font-semibold">Reason: {(part as any).rejectionReason}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
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

                // Photos needed for completed tasks ONLY (parts do not require photos)
                const completedTaskIds = doableTasks.filter(t => t.status === 'COMPLETED').map(t => `TASK_${t._id}`);
                const requiredPhotoCaptions = completedTaskIds;

                const requiredPhotosCount = requiredPhotoCaptions.length;
                const uploadedPhotosCount = wo.photos.filter(p => p.caption && requiredPhotoCaptions.includes(p.caption)).length;

                const totalSteps = totalTasksCount + totalPartsCount + requiredPhotosCount;
                const completedSteps = completedTasksCount + installedPartsCount + uploadedPhotosCount;
                const overallPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 100;
                const hasAllPhotos = uploadedPhotosCount === requiredPhotosCount;

                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* QC Progress Overview Widget */}
                        <div className="glass-card p-2.5 px-4 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)]/90 to-[var(--brand-lime-alpha)]/5 border border-[var(--border-main)]/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md relative overflow-hidden">
                            {/* Decorative background glows */}
                            <div className="absolute -right-20 -top-20 w-32 h-32 rounded-full bg-[var(--brand-lime)]/5 blur-2xl pointer-events-none" />

                            <div className="flex items-center gap-3 shrink-0 relative z-10">
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-lime-alpha)]/20 flex items-center justify-center text-[var(--brand-lime)] shrink-0">
                                    <Shield size={16} className="animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-[var(--text-main)]">Quality Control</h3>
                                        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 inline-block">
                                            <div
                                                className="h-full bg-gradient-to-r from-[var(--brand-lime)] to-emerald-400 transition-all duration-500 ease-out"
                                                style={{ width: `${overallPercent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-[var(--brand-lime)] font-mono">{Math.round(overallPercent)}%</span>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-dim)] font-medium">Verify tasks, parts, and upload photo evidence.</p>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex flex-wrap items-center gap-2 md:border-l border-[var(--border-main)]/50 md:pl-4 relative z-10">
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-[var(--border-main)]/30">
                                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-bold">Tasks</span>
                                    <span className="text-xs font-extrabold text-[var(--text-main)] font-mono">
                                        {completedTasksCount}/{totalTasksCount}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-[var(--border-main)]/30">
                                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-bold">Parts</span>
                                    <span className="text-xs font-extrabold text-[var(--text-main)] font-mono">
                                        {installedPartsCount}/{totalPartsCount}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-[var(--border-main)]/30">
                                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-bold">Photos</span>
                                    <span className={`text-xs font-extrabold font-mono ${hasAllPhotos ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                        {uploadedPhotosCount}/{requiredPhotosCount}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════ COMBINED VERIFICATION CHECKLIST ══════════════════ */}
                        <div className="space-y-3">

                            {doableTasks.length === 0 && activeParts.length === 0 ? (
                                <div className="glass-card p-6 text-center text-xs text-[var(--text-muted)]">
                                    No active tasks or parts assigned to this work order.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {doableTasks.map((task) => {
                                        const photo = wo.photos.find(p => p.caption === `TASK_${task._id}`);
                                        const isCompleted = task.status === 'COMPLETED';
                                        const taskParts = activeParts.filter(p => p.taskTemplateId && task.taskTemplateId && p.taskTemplateId.toString() === task.taskTemplateId.toString());

                                        return (
                                            <div
                                                key={task._id}
                                                className={`glass-card p-0 border transition-all duration-300 flex overflow-hidden ${isCompleted
                                                        ? 'border-[var(--brand-lime)]/30 bg-gradient-to-br from-[var(--brand-lime-alpha)]/5 via-[var(--brand-lime-alpha)]/1 to-transparent'
                                                        : 'border-[var(--border-main)]/50'
                                                    }`}
                                            >
                                                {/* Left Side: Content & Parts */}
                                                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                                    <div className="flex items-start gap-2.5">
                                                        <button
                                                            type="button"
                                                            disabled={actionLoading}
                                                            onClick={() => doAction(() => updateTask(id!, task._id, {
                                                                status: isCompleted ? 'PENDING' : 'COMPLETED'
                                                            }))}
                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-300 mt-0.5 shrink-0 ${isCompleted
                                                                    ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black scale-105 shadow-md shadow-[var(--brand-lime)]/20'
                                                                    : 'border-[var(--border-main)] text-transparent hover:border-[var(--brand-lime)] hover:scale-105'
                                                                }`}
                                                            title={isCompleted ? "Mark Pending" : "Mark Completed"}
                                                        >
                                                            <CheckCircle2 size={12} className="stroke-[3]" />
                                                        </button>
                                                        <div className="min-w-0 select-none">
                                                            <span
                                                                onClick={() => doAction(() => updateTask(id!, task._id, {
                                                                    status: isCompleted ? 'PENDING' : 'COMPLETED'
                                                                }))}
                                                                className={`text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:text-[var(--brand-lime)] transition-colors break-words ${isCompleted ? 'line-through text-[var(--text-dim)] font-medium' : ''
                                                                    }`}
                                                            >
                                                                {task.description}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] bg-white/5 px-1.5 py-0.5 rounded font-mono">
                                                                    {task.category || 'General'}
                                                                </span>
                                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isCompleted ? 'text-[var(--brand-lime)]' : 'text-[var(--text-dim)]'
                                                                    }`}>
                                                                    {task.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Nested corresponding parts for this task */}
                                                    {taskParts.length > 0 && (
                                                        <div className="mt-2.5 pl-3 border-l border-[var(--border-main)]/30 space-y-1.5">
                                                            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Required Parts</p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {taskParts.map((part) => {
                                                                    const isInstalled = part.status === 'INSTALLED';

                                                                    return (
                                                                        <div
                                                                            key={part._id}
                                                                            className={`flex items-center justify-between gap-3 p-1.5 px-2 rounded-lg border transition-all duration-300 ${
                                                                                isInstalled 
                                                                                    ? 'border-[var(--brand-lime)]/20 bg-[var(--brand-lime-alpha)]/2' 
                                                                                    : 'border-[var(--border-main)]/20 bg-white/[0.01]'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={actionLoading}
                                                                                    onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                                        status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                                    }))}
                                                                                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-300 shrink-0 ${isInstalled
                                                                                            ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black'
                                                                                            : 'border-[var(--border-main)] text-transparent hover:border-[var(--brand-lime)]'
                                                                                        }`}
                                                                                    title={isInstalled ? "Mark Uninstalled" : "Mark Installed"}
                                                                                >
                                                                                    <CheckCircle2 size={8} className="stroke-[3]" />
                                                                                </button>
                                                                                <div className="min-w-0 select-none">
                                                                                    <span
                                                                                        onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                                            status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                                        }))}
                                                                                        className={`text-xs font-medium text-[var(--text-main)] cursor-pointer hover:text-[var(--brand-lime)] transition-colors truncate block ${isInstalled ? 'line-through text-[var(--text-dim)]' : ''}`}
                                                                                        title={part.partName}
                                                                                    >
                                                                                        {part.partName}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 shrink-0 font-mono">
                                                                                <span className="text-[9px] text-[var(--text-dim)] bg-white/5 px-1.5 py-0.5 rounded">
                                                                                    Qty: {part.quantity}
                                                                                </span>
                                                                                <span className={`text-[9px] font-bold uppercase ${isInstalled ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                                                                    {part.status === 'REQUESTED' ? 'REQ' : part.status === 'RESERVED' ? 'ASSIGNED' : part.status}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right Side: Image / Upload Panel stretching full height */}
                                                <div className="w-28 flex-shrink-0 border-l border-[var(--border-main)]/20 flex flex-col justify-stretch items-stretch bg-[var(--bg-card)]/30">
                                                    {isCompleted ? (
                                                        photo ? (
                                                            <div className="relative w-full h-full group/photo overflow-hidden">
                                                                <img src={photo.url} alt="Task verification" className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-105" />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                                    {isReleasedOrLater ? (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${task._id}` })}
                                                                                className="w-7 h-7 rounded-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-all transform scale-75 group-hover/photo:scale-100 hover:scale-110 active:scale-95 cursor-pointer shadow-md shadow-blue-500/25"
                                                                                title="Change Photo (Camera)"
                                                                                disabled={actionLoading}
                                                                            >
                                                                                <Camera size={11} className="stroke-[2.5]" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${task._id}` })}
                                                                                className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white transition-all transform scale-75 group-hover/photo:scale-100 hover:scale-110 active:scale-95 cursor-pointer shadow-md shadow-orange-500/25"
                                                                                title="Change Photo (Upload)"
                                                                                disabled={actionLoading}
                                                                            >
                                                                                <Upload size={11} className="stroke-[2.5]" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all transform scale-75 group-hover/photo:scale-100 hover:scale-110 active:scale-95 cursor-pointer"
                                                                            title="Delete Photo"
                                                                            disabled={actionLoading}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                if (window.confirm("Permanently delete this verification photo?")) {
                                                                                    doAction(() => removePhoto(id!, photo._id));
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Trash2 size={11} className="stroke-[2.5]" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 bg-gradient-to-b from-orange-500/5 to-amber-500/5 hover:from-orange-500/10 hover:to-amber-500/10 transition-all duration-300 group shadow-[inset_0_1px_2px_rgba(249,115,22,0.05)] border-l border-dashed border-orange-500/20">
                                                                <div className="flex flex-col items-center gap-0.5 select-none text-center">
                                                                    <span className="text-[8px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                                                                        QC Req
                                                                    </span>
                                                                    <span className="text-[7px] font-medium text-[var(--text-dim)]">Photo</span>
                                                                </div>
                                                                <div className="flex gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => triggerCamera({ stage: 'QC', label: `TASK_${task._id}` })}
                                                                        className="w-7 h-7 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm"
                                                                        title="Take Photo"
                                                                        disabled={actionLoading}
                                                                    >
                                                                        <Camera size={11} className="stroke-[2.5]" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => triggerUpload({ stage: 'QC', label: `TASK_${task._id}` })}
                                                                        className="w-7 h-7 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md shadow-orange-500/20"
                                                                        title="Upload Photo"
                                                                        disabled={actionLoading}
                                                                    >
                                                                        <Upload size={11} className="stroke-[2.5]" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center p-2 text-center text-[9px] text-[var(--text-dim)] italic bg-black/5 select-none leading-tight">
                                                            Pending Task
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* General Parts Section (for parts not linked to any task) */}
                                    {activeParts.filter(p => !p.taskTemplateId || !doableTasks.some(t => t.taskTemplateId && p.taskTemplateId && t.taskTemplateId.toString() === p.taskTemplateId.toString())).length > 0 && (
                                        <div className="space-y-3 pt-4 border-t border-[var(--border-main)]/30">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-semibold text-[var(--text-main)]">General Parts & Materials</h3>
                                                <p className="text-[10px] text-[var(--text-dim)]">Mark general parts as Installed.</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {activeParts
                                                    .filter(p => !p.taskTemplateId || !doableTasks.some(t => t.taskTemplateId && p.taskTemplateId && t.taskTemplateId.toString() === p.taskTemplateId.toString()))
                                                    .map((part) => {
                                                        const isInstalled = part.status === 'INSTALLED';

                                                        return (
                                                            <div
                                                                key={part._id}
                                                                className={`flex items-center justify-between gap-3 p-2 rounded-lg border transition-all duration-300 ${isInstalled
                                                                        ? 'border-[var(--brand-lime)]/20 bg-[var(--brand-lime-alpha)]/2'
                                                                        : 'border-[var(--border-main)]/20 bg-white/[0.01]'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <button
                                                                        type="button"
                                                                        disabled={actionLoading}
                                                                        onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                            status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                        }))}
                                                                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-300 shrink-0 ${isInstalled
                                                                                ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black'
                                                                                : 'border-[var(--border-main)] text-transparent hover:border-[var(--brand-lime)]'
                                                                            }`}
                                                                        title={isInstalled ? "Mark Uninstalled" : "Mark Installed"}
                                                                    >
                                                                        <CheckCircle2 size={8} className="stroke-[3]" />
                                                                    </button>
                                                                    <div className="min-w-0 select-none">
                                                                        <span
                                                                            onClick={() => doAction(() => updatePart(id!, part._id, {
                                                                                status: isInstalled ? 'REQUESTED' : 'INSTALLED'
                                                                            }))}
                                                                            className={`text-xs font-medium text-[var(--text-main)] cursor-pointer hover:text-[var(--brand-lime)] transition-colors truncate block ${isInstalled ? 'line-through text-[var(--text-dim)]' : ''}`}
                                                                            title={part.partName}
                                                                        >
                                                                            {part.partName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                                                                    <span className="text-[9px] text-[var(--text-dim)] bg-white/5 px-1.5 py-0.5 rounded">
                                                                        Qty: {part.quantity}
                                                                    </span>
                                                                    <span className={`text-[9px] font-bold uppercase ${isInstalled ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                                                        {part.status === 'REQUESTED' ? 'REQ' : part.status === 'RESERVED' ? 'ASSIGNED' : part.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Photos Section */}
                        <div className="space-y-6 pt-6 border-t border-[var(--border-main)]/30">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Repair Verification Photos</h3>
                                    <p className="text-xs text-[var(--text-dim)]">Upload verification photos for the vehicle (optional).</p>
                                </div>
                                <div className="p-2 px-3 rounded-xl border border-[var(--border-main)] flex items-center gap-2 bg-[var(--bg-card)]">
                                    <div className="flex items-center gap-1.5">
                                        <Camera size={14} className="text-[var(--text-dim)]" />
                                        <span className="text-xs font-mono font-bold text-[var(--text-main)]">
                                            {wo.photos.filter(p => (wo.requiredPhotos || []).some(rp => rp.label === p.caption)).length} / {(wo.requiredPhotos || []).length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {(wo.requiredPhotos || []).map((rp) => {
                                    const photo = wo.photos.find(p => p.caption === rp.label);
                                    return (
                                        <div key={rp.label} className="relative group">
                                            {photo ? (
                                                <div className="glass-card aspect-[1.3/1] rounded-xl overflow-hidden border border-[var(--border-main)] hover:border-[var(--brand-lime)] transition-all duration-300 relative">
                                                    <img src={photo.url} alt={rp.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="absolute bottom-2 left-2 flex flex-col opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                                                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">{photo.stage || 'Repair'}</span>
                                                        <span className="text-[7px] text-white/70 font-mono italic">{new Date(photo.uploadedAt || '').toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                        <div className="badge badge-lime text-[8px] px-1.5 py-0 bg-black/55 backdrop-blur-sm border-[var(--brand-lime)]/50 text-[var(--brand-lime)] font-mono">{rp.label}</div>
                                                        {isReleasedOrLater ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerCamera({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                    className="w-5 h-5 rounded-md bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white cursor-pointer"
                                                                    title="Change Photo (Camera)"
                                                                    disabled={actionLoading}
                                                                >
                                                                    <Camera size={10} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerUpload({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                                    className="w-5 h-5 rounded-md bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white cursor-pointer"
                                                                    title="Change Photo (Upload)"
                                                                    disabled={actionLoading}
                                                                >
                                                                    <Upload size={10} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                className="w-5 h-5 rounded-md bg-red-500/80 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                                                                title="Remove Photo"
                                                                disabled={actionLoading}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    if (window.confirm("Are you sure you want to remove this photo?")) {
                                                                        doAction(() => removePhoto(id!, photo._id));
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-between aspect-[1.3/1] rounded-xl border border-dashed border-[var(--border-main)] hover:border-[var(--brand-lime)]/50 transition-all duration-300 group shadow-sm bg-[var(--bg-card)]/50 relative p-2">
                                                    <div className="flex flex-col items-center text-center mt-1">
                                                        <Camera size={14} className="text-[var(--text-dim)] mb-1" />
                                                        <span className="text-[10px] font-bold text-[var(--text-main)] truncate max-w-[120px]">{rp.label}</span>
                                                        <span className="text-[8px] font-bold text-[var(--text-dim)] uppercase tracking-widest mt-0.5">Optional</span>
                                                    </div>
                                                    <div className="flex gap-1.5 w-full mt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => triggerCamera({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                            className="btn-secondary flex-1 h-6 text-[9px] font-bold flex items-center justify-center gap-0.5 rounded-md border border-[var(--border-main)] hover:bg-white/5 cursor-pointer"
                                                            disabled={actionLoading}
                                                        >
                                                            <Camera size={10} /> Camera
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => triggerUpload({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                            className="btn-primary flex-1 h-6 text-[9px] font-bold flex items-center justify-center gap-0.5 rounded-md cursor-pointer"
                                                            disabled={actionLoading}
                                                        >
                                                            <Upload size={10} /> Upload
                                                        </button>
                                                    </div>
                                                    {actionLoading && (
                                                        <div className="absolute inset-0 bg-[var(--bg-card)]/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-20">
                                                            <Loader2 size={16} className="animate-spin text-[var(--brand-lime)]" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>


                        {/* Additional Photos Section */}
                        <div className="pt-6 border-t border-[var(--border-main)]">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)]">Additional Reference Photos</h4>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => triggerCamera({ stage: 'IN_PROGRESS', label: '' })}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-lime)] hover:underline cursor-pointer bg-transparent border-0"
                                    >
                                        <Camera size={12} /> Take Photo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerUpload({ stage: 'IN_PROGRESS', label: '' })}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-lime)] hover:underline cursor-pointer bg-transparent border-0"
                                    >
                                        <PlusCircle size={12} /> Add More
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {wo.photos.filter(p => !(wo.requiredPhotos || []).some(rp => rp.label === p.caption)).map((p) => (
                                    <div key={p._id} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-main)] group hover:border-[var(--brand-lime)] transition-all cursor-zoom-in">
                                        <img src={p.url} alt="Extra" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isReleasedOrLater && (
                                                <button
                                                    className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all transform scale-75 group-hover:scale-100"
                                                    title="Delete Photo"
                                                    disabled={actionLoading}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (window.confirm("Permanently delete this photo?")) {
                                                            doAction(() => removePhoto(id!, p._id));
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                                        <option value="">No tax profiles available</option>
                                                    )}
                                                </select>
                                            </div>
                                        </div>

                                        {(() => {
                                            const v = wo.vehicleId as any;
                                            if (v && v.currentDriver) {
                                                return (
                                                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)]">
                                                        <div>
                                                            <p className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Driver Billed</p>
                                                            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">Toggle if this bill is to be paid by the driver</p>
                                                        </div>
                                                        <button
                                                            className={`w-12 h-6 rounded-full transition-all relative ${isDriverBilled ? 'bg-[var(--brand-lime)]' : 'bg-white/10'}`}
                                                            onClick={() => setIsDriverBilled(!isDriverBilled)}
                                                        >
                                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDriverBilled ? 'right-1' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

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
                                                        disabled={actionLoading || preBillValue <= 0 || !['BILLING', 'QUALITY_CHECK', 'READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'INVOICED', 'CLOSED'].includes(wo.status)}
                                                        onClick={() => {
                                                            doAction(() => generateBill(id!, {
                                                                hourlyRate: Number(hourlyRate),
                                                                taxRate: Number(taxRate),
                                                                taxName,
                                                                taxProfileId,
                                                                isDriverBilled
                                                            }));
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

                                        {!['QUALITY_CHECK', 'READY_FOR_RELEASE', 'VEHICLE_RELEASED'].includes(wo.status) && (
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
                                                    <p className="text-[10px] font-bold text-[var(--brand-lime)] uppercase tracking-wider">Bill Generated</p>
                                                    <h4 className="text-xl font-bold text-[var(--text-main)] mt-1">Invoice Linked Successfully</h4>
                                                    <p className="text-xs font-mono font-bold text-[var(--text-dim)] mt-2 bg-black/10 px-2 py-1 rounded-md inline-block">
                                                        ID: {bill?.billNumber}
                                                    </p>
                                                </div>
                                                <div className="w-12 h-12 rounded-xl bg-[var(--brand-lime-alpha)] flex items-center justify-center text-[var(--brand-lime)]">
                                                    <CheckCircle2 size={24} />
                                                </div>
                                            </div>

                                            {bill?.isDriverBilled && (
                                                <div className="mb-4 px-3 py-1.5 rounded-lg bg-[var(--brand-lime)] text-[var(--brand-black)] text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                                    Driver Billed
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
                                                className={`w-full h-12 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${bill?.paymentStatus === 'PAID'
                                                    ? 'bg-green-500/20 text-green-500 border border-green-500/30 cursor-default'
                                                    : 'bg-[var(--brand-lime)] hover:shadow-lg hover:shadow-[var(--brand-lime-alpha)] text-[var(--brand-black)] active:scale-[0.98]'
                                                    }`}
                                                disabled={actionLoading || bill?.paymentStatus === 'PAID'}
                                                onClick={() => {
                                                    if (wo.serviceBillId) {
                                                        doAction(async () => {
                                                            let currentBill = bill;
                                                            if (!currentBill) {
                                                                currentBill = await getServiceBillById(wo.serviceBillId!);
                                                                setBill(currentBill);
                                                            }

                                                            if (currentBill.paymentStatus === 'PAID') {
                                                                toast.success('Bill is already paid');
                                                                return;
                                                            }

                                                            if (currentBill.status === 'DRAFT' || currentBill.status === 'PENDING_APPROVAL') {
                                                                await approveBill(wo.serviceBillId!);
                                                            }

                                                            await markBillPaid(wo.serviceBillId!, currentBill.totalAmount, 'Cash');
                                                            toast.success('Payment completed');

                                                            // Force a refresh of everything
                                                            await load();
                                                        });
                                                    }
                                                }}
                                            >
                                                <CheckCircle2 size={16} />
                                                {bill?.paymentStatus === 'PAID' ? 'PAID' : 'Payment Complete'}
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

                {/* Right: Progress Action Button */}
                <div className="min-w-[200px] flex justify-end w-full md:w-auto">
                    {nextPhase ? (
                        <button
                            type="button"
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
