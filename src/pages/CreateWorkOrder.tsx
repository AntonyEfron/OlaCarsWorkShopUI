import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Loader2,
    PlusCircle,
    Camera,
    X,
    Search,
    MapPin,
    Check,
    Wrench,
    AlertTriangle,
    ClipboardList,
    Car,
    RotateCcw,
    Shield,
    Layers,
    FileText,
    Plus
} from 'lucide-react';
import {
    createWorkOrder,
    addPhotoFile,
    type WorkOrderType,
    type Priority,
} from '../services/workOrderService';
import { getVehicles, getGpsDevices, getVehicleGpsLocation, getVehicleGpsMileage, type Vehicle } from '../services/vehicleService';
import { getBranchId } from '../utils/auth';
import toast from 'react-hot-toast';

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
    PREVENTIVE: Wrench,
    CORRECTIVE: AlertTriangle,
    PRE_ENTRY: ClipboardList,
    ACCIDENT: Car,
    RETURN_INSPECTION: RotateCcw,
    RECALL: AlertTriangle,
    SAFETY_PREP: Shield,
    WEAR_ITEM: Layers,
    OTHER: Wrench,
};

const CreateWorkOrder = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const branchId = getBranchId() || '';

    const WORK_ORDER_TYPES = [
        { value: 'PREVENTIVE', label: t('workOrders.types.preventive') },
        { value: 'CORRECTIVE', label: t('workOrders.types.corrective') },
        { value: 'PRE_ENTRY', label: t('workOrders.types.preEntry') },
        { value: 'ACCIDENT', label: t('workOrders.types.accident') },
        { value: 'RETURN_INSPECTION', label: t('workOrders.types.returnInspection') },
        { value: 'RECALL', label: t('workOrders.types.recall') },
        { value: 'SAFETY_PREP', label: t('workOrders.types.safetyPrep') },
        { value: 'WEAR_ITEM', label: t('workOrders.types.wearItem') },
        { value: 'OTHER', label: t('workOrders.types.other') },
    ];

    const PRIORITY_OPTIONS = [
        { value: 'LOW', label: t('workOrders.priorities.low'), color: '#6B7280' },
        { value: 'MEDIUM', label: t('workOrders.priorities.medium'), color: '#C8E600' },
        { value: 'HIGH', label: t('workOrders.priorities.high'), color: '#E67E22' },
        { value: 'CRITICAL', label: t('workOrders.priorities.critical'), color: '#E74C3C' },
    ];

    const [currentStep, setCurrentStep] = useState(1);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [selectedVehicleData, setSelectedVehicleData] = useState<Vehicle | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [arrivalPhotos, setArrivalPhotos] = useState<{
        odometer: File | null;
        plateNo: File | null;
        condition: File | null;
    }>({
        odometer: null,
        plateNo: null,
        condition: null,
    });
    const [additionalPhotos, setAdditionalPhotos] = useState<{ file: File; preview: string }[]>([]);
    const [activeSlot, setActiveSlot] = useState<'odometer' | 'plateNo' | 'condition' | 'additional' | null>(null);

    const additionalPhotosRef = useRef<{ file: File; preview: string }[]>([]);
    useEffect(() => {
        additionalPhotosRef.current = additionalPhotos;
    }, [additionalPhotos]);

    useEffect(() => {
        return () => {
            additionalPhotosRef.current.forEach(item => URL.revokeObjectURL(item.preview));
        };
    }, []);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Camera capture effects & handlers
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
        setActiveSlot(null);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !activeSlot) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `${activeSlot}_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    if (activeSlot === 'additional') {
                        const preview = URL.createObjectURL(file);
                        setAdditionalPhotos(prev => [...prev, { file, preview }]);
                        toast.success('Additional photo captured successfully');
                    } else {
                        setArrivalPhotos(prev => ({
                            ...prev,
                            [activeSlot]: file
                        }));
                        toast.success('Photo captured successfully');
                    }
                }
            }, 'image/jpeg', 0.85);
        }
        stopCamera();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeSlot) {
            const file = e.target.files[0];
            if (activeSlot === 'additional') {
                const preview = URL.createObjectURL(file);
                setAdditionalPhotos(prev => [...prev, { file, preview }]);
                toast.success('Additional photo added successfully');
            } else {
                setArrivalPhotos(prev => ({
                    ...prev,
                    [activeSlot]: file
                }));
                toast.success(`Photo added for ${activeSlot === 'odometer' ? 'Odometer' : activeSlot === 'plateNo' ? 'Plate No' : 'Condition'}`);
            }
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    // GPS states
    const [gpsLoading, setGpsLoading] = useState(false);
    const [matchedGps, setMatchedGps] = useState<any | null>(null);
    const [gpsLoc, setGpsLoc] = useState<any | null>(null);
    const [gpsMileage, setGpsMileage] = useState<any | null>(null);

    const [form, setForm] = useState({
        workOrderType: '' as string,
        vehicleId: '',
        priority: 'MEDIUM' as Priority,
        faultDescription: '',
        notes: '',
        requiredPhotos: [
            { label: 'Odometer Reading', stage: 'CHECK_IN', isMandatory: true },
            { label: 'Front View (Vehicle)', stage: 'CHECK_IN', isMandatory: true },
            { label: 'VIN Plate / Chassis Number', stage: 'CHECK_IN', isMandatory: true }
        ] as { label: string, stage: string, isMandatory: boolean }[],
    });

    // Debounced backend vehicle search
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (vehicleSearchTerm.length > 1) {
                setLoadingVehicles(true);
                try {
                    const data = await getVehicles(vehicleSearchTerm);
                    setVehicles(Array.isArray(data) ? data : []);
                } catch {
                    // handled by interceptor
                } finally {
                    setLoadingVehicles(false);
                }
            } else {
                setVehicles([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(handler);
    }, [vehicleSearchTerm]);

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleVehicleSelect = async (v: Vehicle) => {
        setSelectedVehicleData(v);
        handleChange('vehicleId', v._id);
        setVehicleSearchTerm('');
        setVehicles([]);

        // Fetch GPS device list and try to match
        setGpsLoading(true);
        setMatchedGps(null);
        setGpsLoc(null);
        try {
            const plate = v.legalDocs?.registrationNumber || '';
            const vin = v.basicDetails?.vin || '';
            const imei = v.gpsSerialNumber || '';
            
            let activeImei = imei;
            let matched = null;
            let matchLabel = '';
            
            if (activeImei) {
                matched = { imei: activeImei, deviceName: 'Configured Tracker' };
                matchLabel = 'Configured GPS Tracker';
            } else {
                const devices = await getGpsDevices();
                const cleanPlate = plate.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanVin = vin.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // 1. First pass: try exact matches (strongest match first)
                let found = devices.find((d: any) => {
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

                // 2. Second pass: try partial/contained matches if length of query is reasonable (>= 4 chars)
                if (!found) {
                    found = devices.find((d: any) => {
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
                }
                
                if (found) {
                    matched = found;
                    activeImei = found.imei;
                    matchLabel = `Auto-matched GPS (Plate: ${found.plateNum || found.deviceName || found.imei})`;
                }
            }
            
            if (activeImei) {
                setMatchedGps({ ...matched, matchLabel });
                const [loc, mileageData] = await Promise.all([
                    getVehicleGpsLocation(activeImei),
                    getVehicleGpsMileage(activeImei).catch(() => [])
                ]);
                setGpsLoc(loc);
                setGpsMileage(mileageData && mileageData.length > 0 ? mileageData[0] : null);
            }
        } catch (err) {
            console.error('Failed to resolve GPS matching', err);
        } finally {
            setGpsLoading(false);
        }
    };
    
    const handleVehicleClear = () => {
        setSelectedVehicleData(null);
        handleChange('vehicleId', '');
        setVehicleSearchTerm('');
        setVehicles([]);
        setMatchedGps(null);
        setGpsLoc(null);
        setGpsMileage(null);
    };

    const triggerUpload = (slot: 'odometer' | 'plateNo' | 'condition' | 'additional') => {
        setActiveSlot(slot);
        fileInputRef.current?.click();
    };

    const triggerCamera = async (slot: 'odometer' | 'plateNo' | 'condition' | 'additional') => {
        setActiveSlot(slot);
        await startCamera();
    };

    const renderPhotoSlot = (slot: 'odometer' | 'plateNo' | 'condition', title: string, description: string) => {
        const file = arrivalPhotos[slot];
        const previewUrl = file ? URL.createObjectURL(file) : null;

        return (
            <div className="flex flex-col p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative justify-between min-h-[220px]">
                <div className="space-y-1.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-lime)]">{title}</h3>
                    <p className="text-[10px] text-gray-400 leading-normal">{description}</p>
                </div>

                {file && previewUrl ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--border-main)] group shadow-md bg-black/10 mt-2">
                        <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setArrivalPhotos(prev => ({ ...prev, [slot]: null }));
                                    URL.revokeObjectURL(previewUrl);
                                }}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 truncate text-[9px] text-white font-mono text-center">
                            {file.name}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2.5 mt-2">
                        <button
                            type="button"
                            onClick={() => triggerCamera(slot)}
                            className="btn-secondary flex-1 h-10 text-[11px] font-bold flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-main)] hover:bg-white/5 cursor-pointer"
                        >
                            <Camera size={14} /> Camera
                        </button>
                        <button
                            type="button"
                            onClick={() => triggerUpload(slot)}
                            className="btn-primary flex-1 h-10 text-[11px] font-bold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                        >
                            <Plus size={14} /> Upload
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.workOrderType || !form.vehicleId || !form.faultDescription) {
            toast.error(t('workOrders.create.validation'));
            return;
        }

        if (!branchId) {
            toast.error(t('workOrders.create.noContext'));
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                workOrderType: form.workOrderType as WorkOrderType,
                vehicleId: form.vehicleId,
                branchId,
                priority: form.priority,
                faultDescription: form.faultDescription,
                notes: form.notes || undefined,
                requiredPhotos: form.requiredPhotos,
                gpsSerialNumber: matchedGps?.imei || undefined,
            };
            const result = await createWorkOrder(payload);

            // Upload arrival photos if any
            const uploadPromises = [];
            if (arrivalPhotos.odometer) {
                uploadPromises.push(addPhotoFile(result._id, arrivalPhotos.odometer, 'CHECK_IN', 'Odometer Photo'));
            }
            if (arrivalPhotos.plateNo) {
                uploadPromises.push(addPhotoFile(result._id, arrivalPhotos.plateNo, 'CHECK_IN', 'Plate No Photo'));
            }
            if (arrivalPhotos.condition) {
                uploadPromises.push(addPhotoFile(result._id, arrivalPhotos.condition, 'CHECK_IN', 'Condition Photo'));
            }
            additionalPhotos.forEach((item, idx) => {
                uploadPromises.push(addPhotoFile(result._id, item.file, 'CHECK_IN', `Arrival Photo ${idx + 1}`));
            });

            if (uploadPromises.length > 0) {
                try {
                    await Promise.all(uploadPromises);
                } catch (uploadErr) {
                    console.error('Failed to upload arrival photos', uploadErr);
                    toast.error('Work order created, but failed to upload some photos');
                }
            }

            toast.success(t('common.success'));
            navigate(`/work-orders/${result._id}`, { replace: true });
        } catch (error: any) {
            const message = error.response?.data?.message || t('common.error');
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const steps = [
        { number: 1, label: t('workOrders.create.type'), icon: Wrench },
        { number: 2, label: t('workOrders.create.vehicle'), icon: Car },
        { number: 3, label: t('workOrders.create.fault'), icon: AlertTriangle },
        { number: 4, label: t('workOrders.create.notes'), icon: FileText },
        { number: 5, label: t('workOrders.create.requiredPhotos') || 'Photos', icon: Camera }
    ];

    const canNavigateToStep = (stepNum: number) => {
        if (stepNum === 1) return true;
        if (stepNum === 2) return !!form.workOrderType;
        if (stepNum === 3) return !!form.workOrderType && !!form.vehicleId;
        if (stepNum === 4) return !!form.workOrderType && !!form.vehicleId && !!form.faultDescription;
        if (stepNum === 5) return !!form.workOrderType && !!form.vehicleId && !!form.faultDescription;
        return false;
    };

    return (
        <div className="w-full flex flex-col space-y-4 animate-fadeInUp min-h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button className="btn-icon" onClick={() => navigate(-1)} id="back-btn">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                        {t('workOrders.create.title')}
                    </h1>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.subtitle')}
                    </p>
                </div>
            </div>

            {/* Stepper Card */}
            <div className="glass-card p-6 md:p-8 flex-1 flex flex-col justify-between">
                <div>
                    {/* Horizontal Stepper (Desktop/Tablet) */}
                    <div className="mb-8 flex items-center justify-between w-full px-2 overflow-x-auto py-2 scrollbar-none border-b border-[var(--border-main)]/30 pb-6">
                        {steps.map((s, idx) => {
                            const IconComponent = s.icon;
                            const isCompleted = currentStep > s.number;
                            const isActive = currentStep === s.number;
                            const navEnabled = canNavigateToStep(s.number);

                            return (
                                <div key={s.number} className="flex items-center flex-1 last:flex-initial">
                                    <button
                                        type="button"
                                        disabled={!navEnabled}
                                        onClick={() => setCurrentStep(s.number)}
                                        className={`flex items-center gap-3 cursor-pointer transition-all duration-200 text-left outline-none group disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border ${
                                            isCompleted 
                                                ? 'bg-lime text-black border-lime' 
                                                : isActive 
                                                    ? 'bg-lime text-black border-lime ring-4 ring-lime/20 shadow-[0_0_15px_rgba(200,230,0,0.4)]' 
                                                    : 'bg-[var(--bg-input)] text-gray-400 border-[var(--border-main)] group-hover:border-gray-500'
                                        }`}>
                                            {isCompleted ? <Check size={16} strokeWidth={3} /> : <IconComponent size={16} />}
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-wider hidden md:inline whitespace-nowrap transition-colors duration-200 ${
                                            isActive ? 'text-lime font-black' : isCompleted ? 'text-gray-300' : 'text-gray-500'
                                        }`}>
                                            {s.label}
                                        </span>
                                    </button>
                                    {idx < steps.length - 1 && (
                                        <div className={`h-[1.5px] mx-6 flex-1 hidden md:block transition-all duration-500 ${
                                            isCompleted ? 'bg-lime' : 'bg-[var(--border-main)]'
                                        }`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Mobile Stepper Title */}
                    <div className="md:hidden text-center mb-6 border-b border-[var(--border-main)]/30 pb-4">
                        <span className="text-[10px] uppercase font-black text-lime tracking-widest">
                            Step {currentStep} of {steps.length}
                        </span>
                        <h2 className="text-sm font-bold text-white mt-0.5">
                            {steps[currentStep - 1].label}
                        </h2>
                    </div>

                    {/* Progressive Form Section */}
                    <form 
                        onSubmit={handleSubmit} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                                e.preventDefault();
                            }
                        }}
                        className="space-y-6 flex-1 flex flex-col justify-between"
                    >
                        <div>
                            {/* Step 1: Work Order Type */}
                            {currentStep === 1 && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.type')}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Select the category of maintenance or repair required for this vehicle.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                                        {WORK_ORDER_TYPES.map((t_type) => {
                                            const IconComponent = TYPE_ICONS[t_type.value] || Wrench;
                                            const isSelected = form.workOrderType === t_type.value;
                                            return (
                                                <button
                                                    key={t_type.value}
                                                    type="button"
                                                    onClick={() => {
                                                        handleChange('workOrderType', t_type.value);
                                                        // Smooth auto-advance
                                                        setTimeout(() => setCurrentStep(2), 250);
                                                    }}
                                                    className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[140px] group ${
                                                        isSelected
                                                            ? 'bg-[var(--brand-lime-alpha)] border-lime shadow-[0_0_15px_rgba(200,230,0,0.15)]'
                                                            : 'bg-[var(--bg-input)] border-[var(--border-main)] hover:border-gray-500'
                                                    }`}
                                                >
                                                    <div className={`p-2.5 rounded-xl w-fit ${
                                                        isSelected ? 'bg-lime text-black font-bold' : 'bg-white/5 text-gray-400 group-hover:text-white'
                                                    }`}>
                                                        <IconComponent size={20} />
                                                    </div>
                                                    <div className="mt-4">
                                                        <p className={`text-xs font-bold leading-tight transition-colors ${isSelected ? 'text-lime' : 'text-gray-200'}`}>
                                                            {t_type.label}
                                                        </p>
                                                        <p className="text-[9px] text-gray-500 mt-1.5 uppercase tracking-wider font-semibold font-mono">
                                                            {t_type.value.replace('_', ' ')}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Vehicle Search */}
                            {currentStep === 2 && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.vehicle')} Selection
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Search for and identify the vehicle that requires this service.
                                        </p>
                                    </div>

                                    {form.vehicleId && selectedVehicleData ? (
                                        <div className="max-w-3xl space-y-4 pt-2">
                                            {/* Combined Selected Vehicle & GPS Card */}
                                            <div className="p-5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-5 shadow-sm">
                                                {/* Vehicle Info */}
                                                <div className="space-y-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-3 rounded-2xl bg-lime/10 text-lime">
                                                                <Car size={24} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-white">
                                                                    {selectedVehicleData.basicDetails?.make} {selectedVehicleData.basicDetails?.model} {selectedVehicleData.basicDetails?.year}
                                                                </p>
                                                                <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">
                                                                    VIN: {selectedVehicleData.basicDetails?.vin || 'No VIN provided'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleVehicleClear}
                                                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-main)]/30">
                                                        {selectedVehicleData.legalDocs?.registrationNumber && (
                                                            <span className="text-[10px] bg-white/10 text-white px-2 py-1 rounded font-mono font-bold tracking-wider">
                                                                {selectedVehicleData.legalDocs.registrationNumber}
                                                            </span>
                                                        )}
                                                        {selectedVehicleData.status === 'ACTIVE — RENTED' && (
                                                            <span className="text-[10px] bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] px-2 py-1 rounded font-bold uppercase tracking-wider">
                                                                Rented
                                                            </span>
                                                        )}
                                                        {selectedVehicleData.currentDriver && (
                                                            <span className="text-xs text-gray-400 ml-auto">
                                                                Driver: <span className="font-bold text-white">{selectedVehicleData.currentDriver.personalInfo?.fullName}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* GPS Status Combined (nested) */}
                                                {(gpsLoading || matchedGps) ? (
                                                    <div className="pt-4 border-t border-[var(--border-main)]/30 space-y-4 text-xs">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                                <MapPin size={14} className="text-lime" style={{ color: 'var(--brand-lime)' }} /> GPS Tracking Status
                                                            </div>
                                                            {matchedGps?.matchLabel && (
                                                                <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] font-bold uppercase">
                                                                    {matchedGps.matchLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {gpsLoading ? (
                                                            <div className="flex items-center gap-2 py-4 justify-center text-gray-400">
                                                                <Loader2 size={16} className="animate-spin text-lime" style={{ color: 'var(--brand-lime)' }} />
                                                                <span>Connecting and mapping GPS device...</span>
                                                            </div>
                                                        ) : gpsLoc ? (
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-white">
                                                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                    <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-0.5">IMEI Number</span>
                                                                    <span className="font-mono font-bold text-xs">{matchedGps?.imei || 'N/A'}</span>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                    <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-0.5">Engine Status</span>
                                                                    <span className={`font-semibold uppercase text-xs ${gpsLoc.accStatus === 1 ? 'text-[var(--brand-lime)]' : 'text-orange-400'}`}>
                                                                        ● {gpsLoc.accStatus === 1 ? 'ON' : 'OFF'}
                                                                    </span>
                                                                </div>
                                                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                    <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-0.5">Coordinates</span>
                                                                    <span className="font-mono font-medium text-xs">{gpsLoc.lat.toFixed(5)}, {gpsLoc.lng.toFixed(5)}</span>
                                                                </div>
                                                                {gpsMileage ? (
                                                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                        <span className="block text-[8px] uppercase tracking-wider text-gray-400">Total Odometer</span>
                                                                        <span className="font-mono font-medium text-xs">{(gpsMileage.totalMileage / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} KM</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                        <span className="block text-[8px] uppercase tracking-wider text-gray-400">Speed</span>
                                                                        <span className="font-medium text-xs text-white">{gpsLoc.speed} KM/H</span>
                                                                    </div>
                                                                )}
                                                                <div className="col-span-2 sm:col-span-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                                                    <span className="block text-[8px] uppercase tracking-wider text-gray-400 mb-0.5">Current Location</span>
                                                                    <span className="font-medium text-xs text-white/90 leading-relaxed">{gpsLoc.locDesc || 'No address text returned'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5">
                                                                <p className="font-mono text-white text-xs font-bold">IMEI: {matchedGps?.imei}</p>
                                                                <p className="text-gray-400 text-xs mt-1">No active GPS coordinates returned from device.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="pt-4 border-t border-[var(--border-main)]/30 flex flex-col justify-center items-center text-center text-gray-500 py-4 bg-white/5 rounded-2xl border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                                                        <MapPin size={24} className="opacity-20 mb-2" />
                                                        <p className="text-xs">GPS hardware check will perform automatically upon device detection</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative pt-2">
                                            <div className="relative max-w-2xl">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-gray-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Search vehicle by Plate No, VIN, make, or model..."
                                                    className="input-field pl-11 text-xs"
                                                    value={vehicleSearchTerm}
                                                    onChange={(e) => setVehicleSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            
                                            {vehicleSearchTerm.length > 1 && (
                                                <div className="absolute z-10 left-0 right-0 mt-1.5 glass-card shadow-2xl max-h-64 overflow-y-auto border-[var(--border-main)] py-1.5 bg-[#1C1C1C] max-w-2xl">
                                                    {loadingVehicles ? (
                                                        <div className="p-6 text-center opacity-40">
                                                            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-lime" />
                                                            <p className="text-xs font-semibold">Searching database...</p>
                                                        </div>
                                                    ) : vehicles.length === 0 ? (
                                                        <div className="p-6 text-center opacity-40">
                                                            <Search size={20} className="mx-auto mb-2" />
                                                            <p className="text-xs font-semibold">No matching vehicles found</p>
                                                        </div>
                                                    ) : (
                                                        vehicles.map(v => (
                                                            <button
                                                                key={v._id}
                                                                type="button"
                                                                className="w-full px-4 py-3.5 text-left hover:bg-[var(--brand-lime-alpha)] flex items-center justify-between group transition-colors border-b border-[var(--border-main)]/30 last:border-0"
                                                                onClick={() => handleVehicleSelect(v)}
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <p className="text-xs font-bold truncate leading-tight text-white group-hover:text-lime transition-colors">
                                                                            {v.basicDetails?.make} {v.basicDetails?.model} {v.basicDetails?.year}
                                                                        </p>
                                                                        {v.legalDocs?.registrationNumber && (
                                                                            <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">{v.legalDocs.registrationNumber}</span>
                                                                        )}
                                                                        {v.status === 'ACTIVE — RENTED' && (
                                                                            <span className="text-[8px] bg-[var(--brand-lime)] text-black px-1.5 py-0.5 rounded font-bold uppercase">Rented</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[9px] opacity-60 font-mono tracking-widest uppercase">{v.basicDetails?.vin || 'No VIN'}</p>
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Priority & Job Description */}
                            {currentStep === 3 && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            Priority & Job Details
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Specify the service priority and describe the job or work needed on the vehicle.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                                        {/* Left Column: Priority */}
                                        <div className="lg:col-span-4 space-y-3">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                {t('workOrders.create.priority')} *
                                            </label>
                                            <div className="flex flex-col gap-2.5">
                                                {PRIORITY_OPTIONS.map((p) => {
                                                    const isSelected = form.priority === p.value;
                                                    return (
                                                        <button
                                                            key={p.value}
                                                            type="button"
                                                            onClick={() => handleChange('priority', p.value)}
                                                            className="w-full px-4 py-3.5 rounded-xl text-xs font-bold text-left transition-all duration-200 cursor-pointer flex items-center justify-between"
                                                            style={{
                                                                background: isSelected ? p.color + '22' : 'var(--bg-input)',
                                                                color: isSelected ? p.color : 'var(--text-muted)',
                                                                border: `1.5px solid ${isSelected ? p.color : 'var(--border-main)'}`,
                                                                minHeight: '44px',
                                                            }}
                                                        >
                                                            <span>{p.label} Status</span>
                                                            {isSelected && (
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Column: Job Description */}
                                        <div className="lg:col-span-8 space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                {t('workOrders.create.fault')} *
                                            </label>
                                            <textarea
                                                value={form.faultDescription}
                                                onChange={(e) => handleChange('faultDescription', e.target.value)}
                                                placeholder={t('workOrders.create.faultPlaceholder')}
                                                rows={8}
                                                className="input-field resize-none text-xs flex-1"
                                                id="fault-description"
                                                required
                                                style={{ minHeight: '215px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Additional Notes */}
                            {currentStep === 4 && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.notes')}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Provide any optional remarks, technician alerts, or specific requests.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                                        {/* Left Column: Live Summary Recap */}
                                        <div className="lg:col-span-5 space-y-3">
                                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-lime">Work Order Summary</h3>
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div>
                                                        <span className="block text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Order Type</span>
                                                        <span className="font-bold text-white uppercase">{form.workOrderType.replace('_', ' ')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Priority</span>
                                                        <span className="font-bold text-white uppercase">{form.priority}</span>
                                                    </div>
                                                    <div className="col-span-2 border-t border-white/5 pt-2">
                                                        <span className="block text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Vehicle</span>
                                                        <span className="font-bold text-white">
                                                            {selectedVehicleData ? `${selectedVehicleData.basicDetails?.make} ${selectedVehicleData.basicDetails?.model} (${selectedVehicleData.legalDocs?.registrationNumber || 'No Plate'})` : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 border-t border-white/5 pt-2">
                                                        <span className="block text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Job Description</span>
                                                        <p className="text-gray-300 font-medium leading-relaxed italic">"{form.faultDescription}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Additional Notes Input */}
                                        <div className="lg:col-span-7 space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                {t('workOrders.create.notes')} (Optional)
                                            </label>
                                            <textarea
                                                value={form.notes}
                                                onChange={(e) => handleChange('notes', e.target.value)}
                                                placeholder={t('workOrders.create.notesPlaceholder')}
                                                rows={8}
                                                className="input-field resize-none text-xs"
                                                style={{ minHeight: '200px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Vehicle Arrival Photos */}
                            {currentStep === 5 && (
                                <div className="space-y-6 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.requiredPhotos') || 'Vehicle arrival photos'}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Upload or capture the 3 required photos of the vehicle's condition upon arrival.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        {/* Slot 1: Odometer */}
                                        {renderPhotoSlot('odometer', 'Odometer Reading', 'Capture current dashboard mileage reading.')}

                                        {/* Slot 2: Plate No */}
                                        {renderPhotoSlot('plateNo', 'Plate Number', 'Capture license plate clearly for verification.')}

                                        {/* Slot 3: Condition */}
                                        {renderPhotoSlot('condition', 'Vehicle Condition', 'Capture overall exterior view or visible damage.')}
                                    </div>

                                    {/* Additional Photos Section */}
                                    <div className="border-t border-[var(--border-main)]/30 pt-6 mt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-lime)]">
                                                    Additional Photos
                                                </h3>
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    Upload or capture any additional photos of the vehicle (e.g., specific dents, interior, accessories).
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => triggerCamera('additional')}
                                                    className="btn-secondary h-8 px-3 text-[10px] font-bold flex items-center gap-1.5 rounded-xl border border-[var(--border-main)] hover:bg-white/5 cursor-pointer"
                                                >
                                                    <Camera size={12} /> Camera
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => triggerUpload('additional')}
                                                    className="btn-primary h-8 px-3 text-[10px] font-bold flex items-center gap-1.5 rounded-xl cursor-pointer"
                                                >
                                                    <Plus size={12} /> Upload
                                                </button>
                                            </div>
                                        </div>

                                        {additionalPhotos.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {additionalPhotos.map((item, index) => (
                                                    <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-[var(--border-main)] group shadow-md bg-black/10">
                                                        <img src={item.preview} alt={`Additional ${index + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    URL.revokeObjectURL(item.preview);
                                                                    setAdditionalPhotos(prev => prev.filter((_, i) => i !== index));
                                                                }}
                                                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 truncate text-[9px] text-white font-mono text-center">
                                                            Photo {index + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-white/5 rounded-2xl border border-dashed border-white/5">
                                                <p className="text-[10px] text-gray-500">No additional photos added yet.</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex gap-3 pt-6 border-t border-[var(--border-main)]/30 mt-8">
                            {currentStep > 1 ? (
                                <button
                                    type="button"
                                    className="btn-secondary flex-1"
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                >
                                    <ArrowLeft size={16} />
                                    {t('Previous') || 'Previous'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-secondary flex-1"
                                    onClick={() => navigate(-1)}
                                >
                                    {t('common.cancel')}
                                </button>
                            )}

                            {currentStep < 5 ? (
                                <button
                                    key="next-btn"
                                    type="button"
                                    className="btn-primary flex-1"
                                    disabled={
                                        (currentStep === 1 && !form.workOrderType) ||
                                        (currentStep === 2 && !form.vehicleId) ||
                                        (currentStep === 3 && !form.faultDescription)
                                    }
                                    onClick={() => setCurrentStep(prev => prev + 1)}
                                >
                                    {t('Next') || 'Next'}
                                </button>
                            ) : (
                                <button
                                    key="submit-btn"
                                    type="submit"
                                    className="btn-primary flex-1"
                                    disabled={submitting || !form.workOrderType || !form.vehicleId || !form.faultDescription}
                                    id="submit-work-order"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            {t('workOrders.create.creating')}
                                        </>
                                    ) : (
                                        <>
                                            <PlusCircle size={16} />
                                            {t('workOrders.create.submit')}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

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

export default CreateWorkOrder;
