import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Loader2, Info, ListChecks, Package, Clock, Shield, Camera,
    Play, Pause, Square, PlusCircle, Trash2, CheckCircle2, ChevronRight, Upload, AlertTriangle,
    Receipt, CreditCard, DollarSign, MapPin, RefreshCw, ExternalLink, X, Plus
} from 'lucide-react';
import {
    getWorkOrderById, progressWorkOrderStatus, addTask, updateTask, removeTask,
    addPart, updatePart, removePart, logLabour, generateQC, submitQC, addPhoto, addPhotoFile, removePhoto,
    generateBill, approveBill, markBillPaid, getServiceBillById, releaseVehicle,
    getHourlyLabourRate, getTaxProfiles,
    type WorkOrder, type WorkOrderStatus, type TaskStatus, type PartStatus,
    type QCResult, type AddTaskPayload, type AddPartPayload, type PartSource,
    type TaxProfile,
} from '../services/workOrderService';
import { getUserId, getUser } from '../utils/auth';
import { getParts, type InventoryPart } from '../services/inventoryService';
import {
    getVehicleGpsLocation, getGpsDevices, getVehicleGpsMileage, getVehicleGpsTrack, getVehicleGpsObdData,
    type GpsLocationData, type GpsMileageData, type GpsTrackPoint, type GpsObdData
} from '../services/vehicleService';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'tasks' | 'parts' | 'labour' | 'qc' | 'billing';

const ALLOWED_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
    DRAFT: ['START', 'CANCELLED'],
    START: ['VEHICLE_CHECKED_IN', 'CANCELLED'],
    VEHICLE_CHECKED_IN: ['IN_PROGRESS'],
    PARTS_REQUESTED: ['PARTS_RECEIVED'],
    PARTS_RECEIVED: ['IN_PROGRESS'],
    IN_PROGRESS: ['PAUSED', 'QUALITY_CHECK'],
    PAUSED: ['IN_PROGRESS'],
    QUALITY_CHECK: ['READY_FOR_RELEASE', 'FAILED_QC'],
    FAILED_QC: ['IN_PROGRESS'],
    READY_FOR_RELEASE: ['VEHICLE_RELEASED'],
};

const WorkOrderDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [actionLoading, setActionLoading] = useState(false);

    const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'overview', label: t('workOrders.detail.overview'), icon: Info },
        { key: 'tasks', label: t('workOrders.detail.tasks'), icon: ListChecks },
        { key: 'parts', label: t('workOrders.detail.parts'), icon: Package },
        { key: 'labour', label: t('workOrders.detail.labour'), icon: Clock },
        { key: 'qc', label: 'QC & Photos', icon: Shield },
        { key: 'billing', label: 'Billing', icon: Receipt },
    ];

    /* ΓöÇΓöÇ Task form state ΓöÇΓöÇ */
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [customTaskMode, setCustomTaskMode] = useState(false);
    const [taskForm, setTaskForm] = useState<AddTaskPayload>({ description: '', category: 'Mechanical', estimatedHours: 1 });

    /* ΓöÇΓöÇ Part form state ΓöÇΓöÇ */
    const [showPartForm, setShowPartForm] = useState(false);
    const [partForm, setPartForm] = useState<AddPartPayload>({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
    const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
    const [selectedInventoryPart, setSelectedInventoryPart] = useState<InventoryPart | null>(null);
    const [partsLoading, setPartsLoading] = useState(false);
    const user = getUser();
    const branchId = (user?.branchId as string) || '';

    /* ΓöÇΓöÇ Photo form ΓöÇΓöÇ */
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    /* ΓöÇΓöÇ Release form ΓöÇΓöÇ */
    const [releaseOdometer, setReleaseOdometer] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');

    /* ΓöÇΓöÇ Odometer Entry Modal (Check-in) ΓöÇΓöÇ */
    const [showOdometerModal, setShowOdometerModal] = useState(false);
    const [odometerEntry, setOdometerEntry] = useState('');

    /* ΓöÇΓöÇ Additional Work Modal ΓöÇΓöÇ */
    const [showAdditionalWorkModal, setShowAdditionalWorkModal] = useState(false);
    const [additionalWorkScope, setAdditionalWorkScope] = useState('');
    const [additionalWorkTask, setAdditionalWorkTask] = useState('');

    /* ΓöÇΓöÇ Service Bill ΓöÇΓöÇ */
    const [bill, setBill] = useState<any>(null);
    const [isDriverBilled, setIsDriverBilled] = useState(false);
    const [hourlyRate, setHourlyRate] = useState(150);
    const [taxRate, setTaxRate] = useState(7);
    const [taxProfileId, setTaxProfileId] = useState('');
    const [taxName, setTaxName] = useState('');
    const [taxProfiles, setTaxProfiles] = useState<any[]>([]);

    /* ΓöÇΓöÇ GPS Data state ΓöÇΓöÇ */
    const [gpsData, setGpsData] = useState<GpsLocationData | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsMileage, setGpsMileage] = useState<GpsMileageData | null>(null);
    const [gpsTrack, setGpsTrack] = useState<GpsTrackPoint[]>([]);
    const [obdData, setObdData] = useState<GpsObdData | null>(null);
    const [resolvedImei, setResolvedImei] = useState<string>('');

    /* ΓöÇΓöÇ Camera/Webcam states & refs ΓöÇΓöÇ */
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
                const make = (vehicle?.basicDetails?.make || '').toLowerCase().trim();
                const model = (vehicle?.basicDetails?.model || '').toLowerCase().trim();

                const filtered = parts.filter(p => {
                    if (!p.isActive) return false;
                    if (make || model) {
                        const nameLower = (p.partName || '').toLowerCase();
                        const descLower = (p.description || '').toLowerCase();
                        
                        const matchesMake = make ? (nameLower.includes(make) || descLower.includes(make)) : true;
                        const matchesModel = model ? (nameLower.includes(model) || descLower.includes(model)) : true;
                        
                        return matchesMake && matchesModel;
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

        if ((imei || plate || vin) && activeTab === 'overview') {
            loadGps(imei, plate, vin);
        } else {
            setGpsData(null);
            setGpsMileage(null);
            setGpsTrack([]);
            setResolvedImei('');
        }
    }, [wo?.vehicleId, activeTab, loadGps]);

    const handleBackendError = (err: any) => {
        const msg = (err.response?.data?.message || err.message || '').toLowerCase();
        if (msg.includes('part')) setActiveTab('parts');
        else if (msg.includes('task')) setActiveTab('tasks');
        else if (msg.includes('photo') || msg.includes('qc')) setActiveTab('qc');
        else if (msg.includes('odometer') || msg.includes('entry') || msg.includes('additional work')) setActiveTab('overview');
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

    /* ΓöÇΓöÇ Helpers ΓöÇΓöÇ */
    const getStatusBadge = (status: string) => {
        if (['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'].includes(status)) return 'badge-lime';
        if (['DRAFT'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['CANCELLED'].includes(status)) return 'badge-red';
        return 'badge-gray';
    };
    const fmtStatus = (s: string) => s.replace(/_/g, ' ');
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleString() : 'ΓÇö';

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
        <div className="space-y-5 animate-fadeInUp">
            {/* ΓöÇΓöÇ Header ΓöÇΓöÇ */}
            <div className="flex items-start gap-3 flex-wrap">
                <button className="btn-icon flex-shrink-0" onClick={() => navigate('/work-orders')} id="back-to-list"><ArrowLeft size={18} /></button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{wo.workOrderNumber}</h1>
                        <span className={`badge ${getStatusBadge(wo.status)}`}>{fmtStatus(wo.status)}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {vehicleLabel()} ΓÇó {wo.workOrderType.replace(/_/g, ' ')}
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

            {/* ΓöÇΓöÇ Status Stepper (Workflow) ΓöÇΓöÇ */}
            <StatusStepper currentStatus={wo.status} t_func={t} />


            {/* ΓöÇΓöÇ Status Actions ΓöÇΓöÇ */}
            {nextStatuses.length > 0 && (
                <div className="glass-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('workOrders.detail.actions')}</p>
                    <div className="flex flex-wrap gap-2">
                        {nextStatuses.filter(ns => ns !== 'VEHICLE_RELEASED').map((ns) => (
                            <button key={ns} disabled={actionLoading}
                                className="btn-secondary text-xs !py-2 !px-4"
                                onClick={() => doAction(async () => {
                                    let updateData: any = ns === 'IN_PROGRESS' ? { assignedTechnician: getUserId() || undefined } : undefined;

                                    if (ns === 'VEHICLE_CHECKED_IN') {
                                        setShowOdometerModal(true);
                                        return; // Modal handles the submission
                                    }

                                    if (ns === 'PAUSED') {
                                        const promptMsg = 'Reason for pausing:';
                                        const reason = window.prompt(promptMsg);
                                        if (!reason) return;
                                        updateData = { pauseReason: reason };
                                    }

                                    if (ns === 'READY_FOR_RELEASE') {
                                        const missingMandatory = (wo.requiredPhotos || []).filter(rp =>
                                            rp.isMandatory && !wo.photos.some(p => p.caption === rp.label)
                                        );
                                        if (missingMandatory.length > 0) {
                                            toast.error(`Please upload mandatory photos: ${missingMandatory.map(m => m.label).join(', ')}`);
                                            setActiveTab('qc');
                                            return;
                                        }
                                    }

                                    if (wo.status === 'VEHICLE_CHECKED_IN' && wo.tasks.length === 0) {
                                        toast.error("Please add at least one task before proceeding.");
                                        setActiveTab('tasks');
                                        return;
                                    }

                                    const res = await progressWorkOrderStatus(id!, ns, undefined, updateData);
                                    if (ns === 'IN_PROGRESS') {
                                        setActiveTab('labour');
                                    } else if (ns === 'QUALITY_CHECK') {
                                        setActiveTab('qc');
                                    } else if (ns === 'READY_FOR_RELEASE') {
                                        setActiveTab('billing');
                                    }
                                    return res;
                                })}
                            >
                                <ChevronRight size={14} />
                                {fmtStatus(ns)}
                            </button>
                        ))}

                        {wo.status === 'IN_PROGRESS' && (
                            <button disabled={actionLoading} className="btn-secondary !border-orange/30 !text-orange text-xs !py-2 !px-4"
                                onClick={() => setShowAdditionalWorkModal(true)}
                            >
                                <AlertTriangle size={14} /> ADDITIONAL WORK FOUND
                            </button>
                        )}

                        {wo.status === 'READY_FOR_RELEASE' && (
                            <div className="flex flex-col gap-2">
                                <button
                                    disabled={actionLoading || !bill || bill.paymentStatus !== 'PAID'}
                                    className={`btn-primary text-xs !py-2 !px-4 ${(!bill || bill.paymentStatus !== 'PAID') ? 'opacity-50 !cursor-not-allowed grayscale' : ''}`}
                                    onClick={() => {
                                        const missingMandatory = (wo.requiredPhotos || []).filter(rp =>
                                            rp.isMandatory && !wo.photos.some(p => p.caption === rp.label)
                                        );
                                        if (missingMandatory.length > 0) {
                                            toast.error(`Mandatory photos missing: ${missingMandatory.map(m => m.label).join(', ')}`);
                                            setActiveTab('qc');
                                            return;
                                        }
                                        doAction(() => releaseVehicle(id!, { odometerAtRelease: releaseOdometer ? Number(releaseOdometer) : undefined, releaseNotes: releaseNotes || undefined }));
                                    }}
                                >
                                    <CheckCircle2 size={14} /> Release Vehicle
                                </button>
                                {(!bill || bill.paymentStatus !== 'PAID') && (
                                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider animate-pulse">
                                        ΓÜá∩╕Å Payment Required Before Release
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ΓöÇΓöÇ Odometer Entry Modal ΓöÇΓöÇ */}
            {showOdometerModal && (
                <div className="glass-card p-5 border-lime/30 animate-scaleIn">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-lime/10 text-lime">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">{t('workOrders.detail.odometerEntryTitle') || 'Vehicle Check-in'}</h3>
                            <p className="text-xs text-muted-foreground">{t('workOrders.detail.odometerEntrySubtitle') || 'Please record the current mileage'}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {(() => {
                            const vehicleObj = typeof wo.vehicleId === 'object' ? wo.vehicleId : null;
                            if (!vehicleObj) return null;

                            const make = vehicleObj.basicDetails?.make || '';
                            const model = vehicleObj.basicDetails?.model || '';
                            const year = vehicleObj.basicDetails?.year || '';
                            const vin = vehicleObj.basicDetails?.vin || 'N/A';
                            const plateNumber = vehicleObj.legalDocs?.registrationNumber || 'N/A';

                            return (
                                <div className="p-3 rounded-lg border space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Vehicle Info</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Vehicle</span>
                                            <span className="font-semibold text-white">{make} {model} {year}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plate Number</span>
                                            <span className="font-semibold text-white font-mono">{plateNumber}</span>
                                        </div>
                                        <div className="col-span-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>VIN / Chassis No.</span>
                                            <span className="font-semibold text-white font-mono">{vin}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                                {t('workOrders.detail.odometerAtEntry') || 'Odometer at Entry (KM)'}
                            </label>
                            <input
                                type="number"
                                value={odometerEntry}
                                onChange={(e) => setOdometerEntry(e.target.value)}
                                placeholder="E.g. 45200"
                                className="input-field w-full"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="btn-secondary flex-1 text-xs"
                                onClick={() => {
                                    setShowOdometerModal(false);
                                    setOdometerEntry('');
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn-primary flex-1 text-xs"
                                disabled={!odometerEntry || actionLoading}
                                onClick={() => doAction(async () => {
                                    const res = await progressWorkOrderStatus(id!, 'VEHICLE_CHECKED_IN', undefined, {
                                        odometerAtEntry: Number(odometerEntry)
                                    });
                                    setShowOdometerModal(false);
                                    setOdometerEntry('');
                                    setActiveTab('tasks');
                                    return res;
                                })}
                            >
                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ΓöÇΓöÇ Additional Work Modal ΓöÇΓöÇ */}
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

            {/* ΓöÇΓöÇ Tabs ΓöÇΓöÇ */}
            <div className="tab-nav">
                {TABS.map((t_tab) => (
                    <button key={t_tab.key} className={`tab-btn ${activeTab === t_tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(t_tab.key)}>
                        <t_tab.icon size={16} className="inline mr-1.5" />{t_tab.label}
                        {t_tab.key === 'tasks' && wo.tasks.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.tasks.length})</span>}
                        {t_tab.key === 'parts' && wo.parts.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.parts.length})</span>}
                    </button>
                ))}
            </div>

            {/* ΓöÇΓöÇ OVERVIEW TAB ΓöÇΓöÇ */}
            {activeTab === 'overview' && (
                <div className="space-y-4 animate-fadeInUp">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass-card p-5 space-y-4">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.overview')}</h3>
                            <InfoRow label={t('dashboard.table.type')} value={t(`workOrders.types.${wo.workOrderType.toLowerCase()}`, { defaultValue: wo.workOrderType.replace(/_/g, ' ') })} />
                            <InfoRow label={t('dashboard.table.priority')} value={t(`workOrders.priorities.${wo.priority.toLowerCase()}`, { defaultValue: wo.priority })} />
                            <InfoRow label={t('workOrders.create.vehicle')} value={vehicleLabel()} />
                            {(() => {
                                const v = wo.vehicleId as any;
                                if (v?.currentDriver) {
                                    return (
                                        <InfoRow
                                            label="Assigned Driver"
                                            value={`${v.currentDriver.personalInfo?.fullName} (${v.currentDriver.driverId}) ${v.currentDriver.personalInfo?.phone || ''}`}
                                        />
                                    );
                                }
                                return null;
                            })()}
                            <InfoRow label={t('common.created')} value={fmtDate(wo.createdAt)} />
                            <InfoRow label={t('common.updated')} value={fmtDate(wo.updatedAt)} />
                        </div>
                        <div className="glass-card p-5 space-y-4">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.faultCost')}</h3>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('workOrders.create.fault')}</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-main)' }}>{wo.faultDescription}</p>
                            </div>
                            <InfoRow label={t('workOrders.create.labourHrs')} value={String(wo.estimatedLabourHours)} />
                            <InfoRow label="Actual Labour Hours" value={String(wo.actualLabourHours)} />
                            <InfoRow label={t('workOrders.create.partsCost')} value={`$${wo.estimatedPartsCost.toFixed(2)}`} />
                            <InfoRow label="Actual Parts Cost" value={`$${wo.actualPartsCost.toFixed(2)}`} />
                            {wo.notes && <InfoRow label={t('workOrders.create.notes')} value={wo.notes} />}
                        </div>
                    </div>

                    {/* GPS Section */}
                    {(() => {
                        const vehicleObj = typeof wo.vehicleId === 'object' ? wo.vehicleId : null;
                        const gpsImei = vehicleObj?.gpsSerialNumber;
                        const plate = vehicleObj?.legalDocs?.registrationNumber || '';
                        const vin = vehicleObj?.basicDetails?.vin || '';

                        return (
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-main)' }}>
                                        <MapPin size={16} className="text-lime" style={{ color: 'var(--brand-lime)' }} /> Real-time GPS Tracking
                                        {gpsData?.matchType && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] uppercase tracking-wider font-bold">
                                                {gpsData.matchType}
                                            </span>
                                        )}
                                    </h3>
                                    <button
                                        className="btn-secondary !py-1 !px-2.5 text-[10px] uppercase font-bold flex items-center gap-1.5"
                                        onClick={() => loadGps(gpsImei, plate, vin)}
                                        disabled={gpsLoading}
                                    >
                                        {gpsLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                        Refresh GPS Status
                                    </button>
                                </div>

                                {gpsLoading && !gpsData ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="animate-spin text-lime" size={24} style={{ color: 'var(--brand-lime)' }} />
                                        <span className="text-xs text-muted-foreground ml-2" style={{ color: 'var(--text-muted)' }}>Fetching GPS tracking data...</span>
                                    </div>
                                ) : !gpsData ? (
                                    <div className="text-center py-6 border border-dashed rounded-lg border-white/10" style={{ background: 'rgba(255,255,255,0.01)' }}>
                                        <p className="text-xs text-muted-foreground" style={{ color: 'var(--text-muted)' }}>
                                            {!resolvedImei ? 'No direct GPS IMEI configured, and auto-match could not find a device in the GPS registry.' : `Unable to fetch current GPS coordinates or device offline (IMEI: ${resolvedImei}).`}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>IMEI Number</span>
                                            <span className="text-xs font-semibold text-white font-mono">{gpsData.imei || resolvedImei}</span>
                                        </div>

                                        <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Coordinates</span>
                                            <span className="text-xs font-semibold text-white font-mono">{gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}</span>
                                        </div>

                                        <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Engine Status (ACC)</span>
                                            <span className={`text-xs font-semibold uppercase tracking-wider ${gpsData.accStatus === 1 ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                                ΓùÅ {gpsData.accStatus === 1 ? 'ON' : 'OFF'}
                                            </span>
                                        </div>

                                        <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Speed / Battery</span>
                                            <span className="text-xs font-semibold text-white">{gpsData.speed} KM/H ΓÇó ≡ƒöï {gpsData.electQuantity}%</span>
                                        </div>

                                        <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Last Sync (GPS Time)</span>
                                            <span className="text-xs font-semibold text-white font-mono">{new Date(gpsData.gpsTime || gpsData.hbTime).toLocaleString()}</span>
                                        </div>

                                        {gpsMileage && (
                                            <>
                                                <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Total Odometer Mileage</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {(gpsMileage.totalMileage / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} KM
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Today's Trip Distance</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {(gpsMileage.distance / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} KM
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Today's Average Speed</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {gpsMileage.avgSpeed} KM/H
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Today's Drive Duration</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {gpsMileage.elapsed > 0 ? `${Math.floor(gpsMileage.elapsed / 60)}m ${gpsMileage.elapsed % 60}s` : '0m'}
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        {obdData && (
                                            <>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Odometer Reading</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {obdData.odometerReading ? `${parseFloat(obdData.odometerReading).toLocaleString(undefined, { maximumFractionDigits: 1 })} KM` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Accum. Mileage</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {obdData.deviceAccumulatedMileage ? `${parseFloat(obdData.deviceAccumulatedMileage).toLocaleString(undefined, { maximumFractionDigits: 1 })} KM` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Remaining Fuel</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {obdData.remainingFuelPercentage ? `${obdData.remainingFuelPercentage}%` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Engine RPM</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {obdData.currentRPM ? `${obdData.currentRPM} RPM` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Coolant Temp</span>
                                                    <span className="text-xs font-semibold text-white font-mono">
                                                        {obdData.coolantTemperature ? `${obdData.coolantTemperature}┬░C` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                    <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Battery Voltage</span>
                                                    <span className="text-xs font-semibold text-white font-mono font-mono">
                                                        {obdData.vehicleBatterVoltage ? `${(parseFloat(obdData.vehicleBatterVoltage) / 10).toFixed(1)} V` : 'N/A'}
                                                    </span>
                                                </div>
                                                {obdData.vin && (
                                                    <div className="sm:col-span-2 p-3 rounded-lg border border-purple-500/20" style={{ background: 'rgba(147, 51, 234, 0.02)' }}>
                                                        <span className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-purple-400">OBD Vehicle VIN</span>
                                                        <span className="text-xs font-semibold text-white font-mono break-all">{obdData.vin}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {gpsData.locDesc && (
                                            <div className="sm:col-span-2 md:col-span-3 p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                <span className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Current Address</span>
                                                <span className="text-xs font-medium text-white">{gpsData.locDesc}</span>
                                            </div>
                                        )}

                                        <div className={`p-0.5 flex items-center justify-center ${gpsData.locDesc ? 'col-span-1 sm:col-span-2 md:col-span-4' : 'sm:col-span-2 md:col-span-4'}`}>
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
                                )}

                                {gpsTrack && gpsTrack.length > 0 && (
                                    <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                        <h4 className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                                            <Clock size={13} className="text-lime" style={{ color: 'var(--brand-lime)' }} /> Recent Historical Route Points
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px] border-collapse text-left">
                                                <thead>
                                                    <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider" style={{ color: 'var(--text-muted)' }}>Time</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider" style={{ color: 'var(--text-muted)' }}>Latitude</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider" style={{ color: 'var(--text-muted)' }}>Longitude</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider" style={{ color: 'var(--text-muted)' }}>Speed</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider" style={{ color: 'var(--text-muted)' }}>Mileage</th>
                                                        <th className="pb-1.5 font-bold uppercase text-[9px] tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Link</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gpsTrack.map((pt, idx) => (
                                                        <tr key={idx} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.02)' }}>
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
                        );
                    })()}
                </div>
            )}

            {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ TASKS TAB ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.tasks')} ({wo.tasks.length})</h3>
                        <button className="btn-primary text-xs !py-2" onClick={() => setShowTaskForm(!showTaskForm)}>
                            <PlusCircle size={14} /> {t('common.addItem')}
                        </button>
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
                                        <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{preTask.category} ΓÇó {preTask.hours}h</span>
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
                            {wo.tasks.map((task) => (
                                <div key={task._id} className="glass-card p-4 flex items-start gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{task.description}</p>
                                            <span className={`badge text-[10px] ${task.status === 'COMPLETED' ? 'badge-green' : task.status === 'IN_PROGRESS' ? 'badge-lime' : 'badge-gray'}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                            {task.category} ΓÇó Est: {task.estimatedHours || 0}h{task.actualHours ? ` ΓÇó Actual: ${task.actualHours}h` : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        {task.status === 'PENDING' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Start" disabled={actionLoading}
                                                onClick={() => doAction(() => updateTask(id!, task._id, { status: 'IN_PROGRESS' as TaskStatus }))}>
                                                <Play size={14} />
                                            </button>
                                        )}
                                        {task.status === 'IN_PROGRESS' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Complete" disabled={actionLoading}
                                                onClick={() => doAction(() => updateTask(id!, task._id, { status: 'COMPLETED' as TaskStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {task.status === 'PENDING' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                onClick={() => doAction(() => removeTask(id!, task._id))}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ PARTS TAB ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
            {activeTab === 'parts' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.parts')} ({wo.parts.length})</h3>
                        <button className="btn-primary text-xs !py-2" onClick={() => setShowPartForm(!showPartForm)}>
                            <PlusCircle size={14} /> {t('common.addItem')}
                        </button>
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
                                    <option value="">{partsLoading ? 'Loading parts...' : 'ΓÇö Choose a part ΓÇö'}</option>
                                    {inventoryParts.map(p => {
                                        const available = p.quantityOnHand - p.quantityReserved;
                                        return (
                                            <option key={p._id} value={p._id}>
                                                {p.partName} ({p.partNumber}) ΓÇö {available > 0 ? `${available} available` : 'OUT OF STOCK'}
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
                                            ? 'Out of stock ΓÇö part will be added as a REQUEST for manager approval.'
                                            : isInsufficient
                                                ? `Only ${available} available ΓÇö need ${partForm.quantity}. Will be added as a REQUEST.`
                                                : `${available} in stock ΓÇö will be reserved.`
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
                    {wo.parts.length === 0 ? (
                        <div className="glass-card p-8 text-center">
                            <Package size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {wo.parts.map((part) => (
                                <div key={part._id} className="glass-card p-4 flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${part.status === 'INSTALLED' ? 'bg-green-500/10 text-green-500'
                                        : part.status === 'REQUESTED' ? 'bg-orange-500/10 text-orange-500'
                                            : 'bg-blue-500/10 text-blue-500'
                                        }`}>
                                        {part.status === 'INSTALLED' ? <CheckCircle2 size={20} />
                                            : part.status === 'REQUESTED' ? <AlertTriangle size={20} />
                                                : <Package size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{part.partName}</p>
                                            <span className={`badge text-[10px] ${part.status === 'INSTALLED' ? 'badge-green'
                                                : part.status === 'REQUESTED' ? 'badge-orange'
                                                    : part.status === 'RESERVED' ? 'badge-blue'
                                                        : part.status === 'RECEIVED' ? 'badge-blue'
                                                            : 'badge-gray'
                                                }`}>
                                                {part.status === 'REQUESTED' ? 'ΓÅ│ AWAITING APPROVAL' : part.status}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                            Qty: {part.quantity} ΓÇó ${part.unitCost.toFixed(2)} each = ${part.totalCost.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        {part.status === 'REQUESTED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Approve & Install" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {part.status === 'RESERVED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Mark Installed" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {part.status === 'RECEIVED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Mark Installed" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {(part.status === 'REQUESTED' || part.status === 'RECEIVED' || part.status === 'RESERVED') && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                onClick={() => doAction(() => removePart(id!, part._id))}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ LABOUR TAB ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
            {activeTab === 'labour' && (
                <div className="space-y-4">
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.labour')}</h3>
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div className="glass-card p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Estimated</p>
                                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{wo.estimatedLabourHours || 0}h</p>
                                </div>
                                <div className="glass-card p-4 text-center border-l-2 border-[var(--brand-lime)]">
                                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Actual</p>
                                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{wo.actualLabourHours || 0}h</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {wo.status === 'IN_PROGRESS' && (
                                    <button className="flex items-center justify-center gap-3 p-6 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 shadow-lg w-full"
                                        style={{ background: '#E67E2222', color: '#E67E22', border: '2px solid #E67E2244' }}
                                        disabled={actionLoading}
                                        onClick={() => doAction(async () => {
                                            const reason = window.prompt('Please enter the pause reason:');
                                            if (reason === null) return;
                                            if (!reason) {
                                                toast.error('Pause reason is required.');
                                                return;
                                            }
                                            return progressWorkOrderStatus(id!, 'PAUSED', reason, { pauseReason: reason });
                                        })}>
                                        <Pause size={24} />
                                        <div className="text-left">
                                            <p className="leading-tight">Pause Work</p>
                                            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">Requires reason prompt</p>
                                        </div>
                                    </button>
                                )}
                                {wo.status === 'PAUSED' && (
                                    <button className="flex items-center justify-center gap-3 p-6 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 shadow-lg w-full"
                                        style={{ background: '#3498DB22', color: '#3498DB', border: '2px solid #3498DB44' }}
                                        disabled={actionLoading}
                                        onClick={() => doAction(async () => {
                                            return progressWorkOrderStatus(id!, 'IN_PROGRESS');
                                        })}>
                                        <Play size={24} />
                                        <div className="text-left">
                                            <p className="leading-tight">Resume Work</p>
                                            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">Continues automated tracking</p>
                                        </div>
                                    </button>
                                )}
                                {(wo.status !== 'IN_PROGRESS' && wo.status !== 'PAUSED') && (
                                    <div className="glass-card p-6 text-center border-dashed border-2 opacity-60">
                                        <Clock size={32} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Labour Tracking</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {wo.status === 'QUALITY_CHECK' || wo.status === 'READY_FOR_RELEASE' || wo.status === 'VEHICLE_RELEASED'
                                                ? 'Work completed. Labour logs finalized.'
                                                : 'Automatic timer starts when status is set to IN PROGRESS.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ QC & PHOTOS TAB ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
            {activeTab === 'qc' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Photos Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Repair Verification Photos</h3>
                                <p className="text-xs text-[var(--text-dim)]">Upload required photos to proceed with release.</p>
                            </div>
                            <div className={`p-2 px-3 rounded-xl border border-[var(--border-main)] flex items-center gap-2 ${(wo.requiredPhotos || []).every(rp => !rp.isMandatory || wo.photos.some(p => p.caption === rp.label))
                                ? 'bg-[var(--brand-lime-alpha)] border-[var(--brand-lime)]'
                                : 'bg-[var(--bg-card)]'
                                }`}>
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 size={16} className={
                                        (wo.requiredPhotos || []).every(rp => !rp.isMandatory || wo.photos.some(p => p.caption === rp.label))
                                            ? 'text-[var(--brand-lime)]'
                                            : 'text-[var(--text-dim)]'
                                    } />
                                    <span className={`text-xs font-mono font-bold ${(wo.requiredPhotos || []).every(rp => !rp.isMandatory || wo.photos.some(p => p.caption === rp.label))
                                        ? 'text-[var(--brand-lime)]'
                                        : 'text-[var(--text-main)]'
                                        }`}>
                                        {wo.photos.filter(p => (wo.requiredPhotos || []).some(rp => rp.label === p.caption)).length} / {(wo.requiredPhotos || []).length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(wo.requiredPhotos || []).map((rp) => {
                                const photo = wo.photos.find(p => p.caption === rp.label);
                                return (
                                    <div key={rp.label} className="relative group">
                                        {photo ? (
                                            <div className="glass-card aspect-square rounded-2xl overflow-hidden border border-[var(--border-main)] hover:border-[var(--brand-lime)] transition-all duration-300">
                                                <img src={photo.url} alt={rp.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute bottom-3 left-3 flex flex-col opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{photo.stage || 'Repair'}</span>
                                                    <span className="text-[8px] text-white/70 font-mono italic">{new Date(photo.uploadedAt || '').toLocaleDateString()}</span>
                                                </div>
                                                <div className="absolute top-3 right-3 flex gap-1">
                                                    <div className="badge badge-lime text-[9px] bg-black/50 backdrop-blur-md border-[var(--brand-lime)] text-[var(--brand-lime)] font-mono">{rp.label}</div>
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
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-[var(--border-main)] hover:border-[var(--brand-lime)]/50 transition-all duration-300 group shadow-sm bg-[var(--bg-card)]/50 relative p-4 justify-between">
                                                <div className="flex flex-col items-center text-center mt-2">
                                                    <div className="w-10 h-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-2">
                                                        <Camera size={20} className="text-[var(--text-dim)]" />
                                                    </div>
                                                    <span className="text-xs font-bold text-[var(--text-main)] truncate max-w-[150px]">{rp.label}</span>
                                                    {rp.isMandatory && <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest mt-0.5">Required</span>}
                                                </div>
                                                <div className="flex gap-2 w-full mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerCamera({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                        className="btn-secondary flex-1 h-8 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg border border-[var(--border-main)] hover:bg-white/5 cursor-pointer"
                                                        disabled={actionLoading}
                                                    >
                                                        <Camera size={12} /> Camera
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerUpload({ stage: rp.stage || 'IN_PROGRESS', label: rp.label })}
                                                        className="btn-primary flex-1 h-8 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg cursor-pointer"
                                                        disabled={actionLoading}
                                                    >
                                                        <Upload size={12} /> Upload
                                                    </button>
                                                </div>
                                                {actionLoading && (
                                                    <div className="absolute inset-0 bg-[var(--bg-card)]/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-20">
                                                        <Loader2 size={24} className="animate-spin text-[var(--brand-lime)]" />
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

                    {/* QC Checklist Section */}
                    <div className="glass-card p-6 rounded-2xl border-[var(--border-main)] hover:border-[var(--brand-lime)]/30 transition-all duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--brand-lime-alpha)] flex items-center justify-center text-[var(--brand-lime)]">
                                    <Shield size={20} />
                                </div>
                                <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.qc')} Checklist ({wo.qcChecklist.length})</h3>
                            </div>
                            {wo.qcChecklist.length === 0 && (
                                <button className="btn-primary text-xs !py-2 !px-4" disabled={actionLoading}
                                    onClick={() => doAction(() => generateQC(id!))}>
                                    <PlusCircle size={14} /> Generate Standard Checklist
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {wo.qcChecklist.map((qc) => (
                                <div key={qc._id} className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-[var(--border-main)] group">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{qc.checkItem}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {(['PASS', 'FAIL', 'NA'] as const).map((r) => (
                                            <button key={r}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all transform active:scale-95 ${qc.result === r
                                                    ? r === 'PASS' ? 'bg-[#27AE60] text-white shadow-lg shadow-green-500/20'
                                                        : r === 'FAIL' ? 'bg-[#E74C3C] text-white shadow-lg shadow-red-500/20'
                                                            : 'bg-gray-500 text-white shadow-lg shadow-gray-500/20'
                                                    : 'bg-[var(--bg-input)] text-[var(--text-dim)] border border-[var(--border-main)] opacity-50 hover:opacity-100'
                                                    }`}
                                                disabled={actionLoading}
                                                onClick={() => doAction(() => submitQC(id!, [{ checkItem: qc.checkItem, result: r }]))}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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
                                            const preBillValue = (wo.actualLabourHours || 0) * hourlyRate + (wo.actualPartsCost || 0);
                                            return (
                                                <>
                                                    <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-2">
                                                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                                            <span>Labour ({wo.actualLabourHours || 0} hrs @ {hourlyRate} AED/hr)</span>
                                                            <span className="font-mono text-[var(--text-main)]">{(wo.actualLabourHours || 0) * hourlyRate} AED</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                                            <span>Parts Cost</span>
                                                            <span className="font-mono text-[var(--text-main)]">{wo.actualPartsCost || 0} AED</span>
                                                        </div>
                                                        <div className="h-px bg-[var(--border-main)] my-2" />
                                                        <div className="flex justify-between text-sm font-bold">
                                                            <span className="text-[var(--text-main)] uppercase">Estimated Bill Total</span>
                                                            <span className="font-mono text-[var(--brand-lime)]">{preBillValue} AED</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="w-full h-14 bg-[var(--brand-lime)] hover:shadow-lg hover:shadow-[var(--brand-lime-alpha)] disabled:opacity-50 text-[var(--brand-black)] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                                        disabled={actionLoading || preBillValue <= 0 || !['QUALITY_CHECK', 'READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'INVOICED', 'CLOSED'].includes(wo.status)}
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

                        <div className="w-full lg:w-80 space-y-6">
                            <div className="glass-card p-6 border-[var(--border-main)] rounded-2xl">
                                <h3 className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mb-4">Live Cost Tracker</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Package size={14} />
                                            </div>
                                            <span className="text-xs text-[var(--text-muted)]">Parts</span>
                                        </div>
                                        <span className="text-xs font-mono text-[var(--text-main)]">{wo.actualPartsCost || 0} AED</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                                <Clock size={14} />
                                            </div>
                                            <span className="text-xs text-[var(--text-muted)]">Labour</span>
                                        </div>
                                        <span className="text-xs font-mono text-[var(--text-main)]">{(wo.actualLabourHours || 0) * 50} $</span>
                                    </div>
                                    <div className="h-px bg-[var(--border-main)] my-2"></div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--text-main)]">Subtotal</span>
                                        <span className="text-sm font-bold text-[var(--brand-lime)]">
                                            {(wo.actualPartsCost || 0) + ((wo.actualLabourHours || 0) * 50)} $
                                        </span>
                                    </div>
                                </div>
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
        </div>
    );
};

/* ΓöÇΓöÇ Reusable Info Row ΓöÇΓöÇ */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-start gap-4">
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm text-right font-medium" style={{ color: 'var(--text-main)' }}>{value}</p>
    </div>
);

const PHASES = [
    { key: 'registration', label: 'Registration', statuses: ['DRAFT', 'START'] },
    { key: 'reception', label: 'Reception', statuses: ['VEHICLE_CHECKED_IN'] },
    { key: 'repair', label: 'Repair', statuses: ['PARTS_REQUESTED', 'PARTS_RECEIVED', 'IN_PROGRESS', 'PAUSED'] },
    { key: 'qc', label: 'QC', statuses: ['QUALITY_CHECK', 'FAILED_QC'] },
    { key: 'release', label: 'Release', statuses: ['READY_FOR_RELEASE', 'VEHICLE_RELEASED'] },
];

const StatusStepper = ({ currentStatus, t_func }: { currentStatus: WorkOrderStatus; t_func: any }) => {
    const currentPhaseIndex = PHASES.findIndex(p => p.statuses.includes(currentStatus));

    return (
        <div className="glass-card p-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[600px] px-2">
                {PHASES.map((phase, idx) => {
                    const isCompleted = idx < currentPhaseIndex;
                    const isActive = idx === currentPhaseIndex;
                    const isLast = idx === PHASES.length - 1;

                    return (
                        <div key={phase.key} className="flex-1 flex items-center">
                            <div className="flex flex-col items-center gap-2 relative">
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 z-10 ${isCompleted ? 'bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                        isActive ? 'ring-4 ring-[var(--brand-lime-alpha)] bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                            'bg-[var(--bg-input)] text-[var(--text-dim)] border border-[var(--border-main)]'
                                        }`}
                                >
                                    {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                                </div>
                                <span
                                    className={`text-[10px] font-semibold whitespace-nowrap uppercase tracking-tighter ${isActive ? 'text-[var(--brand-lime)]' : 'text-[var(--text-dim)]'
                                        }`}
                                >
                                    {t_func(`workOrders.phases.${phase.key}`)}
                                </span>
                            </div>
                            {!isLast && (
                                <div className="flex-1 h-[2px] mx-2 mb-4 bg-[var(--bg-input)] overflow-hidden">
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
        </div>
    );
};

export default WorkOrderDetail;
