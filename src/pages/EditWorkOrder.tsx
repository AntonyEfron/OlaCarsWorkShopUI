import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Loader2,
    Camera,
    X,
    Check,
    Wrench,
    AlertTriangle,
    ClipboardList,
    Car,
    RotateCcw,
    Shield,
    Layers,
    Plus,
    Clock,
    Lock,
    Save,
    Trash2,
    Eye,
    MapPin,
} from 'lucide-react';
import {
    getWorkOrderById,
    updateWorkOrder,
    addPhotoFile,
    removePhoto,
    type WorkOrder,
    type WorkOrderType,
    type Priority,
} from '../services/workOrderService';
import toast from 'react-hot-toast';

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
    PREVENTIVE: Wrench,
    INTERVAL_MAINTENANCE: Clock,
    WEAR_ITEM: Layers,
    CORRECTIVE: AlertTriangle,
    PRE_ENTRY: ClipboardList,
    ACCIDENT: Car,
    RETURN_INSPECTION: RotateCcw,
    RECALL: AlertTriangle,
    SAFETY_PREP: Shield,
    OTHER: Wrench,
};

const EditWorkOrder = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const WORK_ORDER_TYPES: { value: WorkOrderType; label: string; description: string }[] = [
        { value: 'PREVENTIVE', label: t('workOrders.types.preventive', 'Preventive Maintenance'), description: 'Scheduled routine maintenance and inspections' },
        { value: 'INTERVAL_MAINTENANCE', label: t('workOrders.types.intervalMaintenance', 'Interval Maintenance'), description: 'Periodic mileage or time-based services' },
        { value: 'WEAR_ITEM', label: t('workOrders.types.wearItem', 'Wear & Tear Maintenance'), description: 'Brake pads, wiper blades, tyres, fluids' },
        { value: 'CORRECTIVE', label: t('workOrders.types.corrective', 'Corrective Repair'), description: 'Diagnose and fix unexpected failures or issues' },
        { value: 'PRE_ENTRY', label: t('workOrders.types.preEntry', 'Pre-Entry Inspection'), description: 'Inspection before entering fleet or rental' },
        { value: 'ACCIDENT', label: t('workOrders.types.accident', 'Accident Repair'), description: 'Body and structural restoration following collision' },
        { value: 'RETURN_INSPECTION', label: t('workOrders.types.returnInspection', 'Return Inspection'), description: 'Detailed check after return from rental or lease' },
        { value: 'RECALL', label: t('workOrders.types.recall', 'Recall'), description: 'Manufacturer safety recalls or campaigns' },
        { value: 'SAFETY_PREP', label: t('workOrders.types.safetyPrep', 'Safety Preparation'), description: 'Preparation for strict commercial roadworthiness' },
        { value: 'OTHER', label: t('workOrders.types.other', 'Others'), description: 'Miscellaneous custom jobs or modifications' },
    ];

    const PRIORITY_OPTIONS = [
        { value: 'LOW', label: t('workOrders.priorities.low', 'Low'), color: '#6B7280' },
        { value: 'MEDIUM', label: t('workOrders.priorities.medium', 'Medium'), color: '#C8E600' },
        { value: 'HIGH', label: t('workOrders.priorities.high', 'High'), color: '#E67E22' },
        { value: 'CRITICAL', label: t('workOrders.priorities.critical', 'Critical'), color: '#E74C3C' },
    ];

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [currentStep, setCurrentStep] = useState(1);

    // Form fields
    const [workOrderType, setWorkOrderType] = useState<WorkOrderType>('PREVENTIVE');
    const [priority, setPriority] = useState<Priority>('MEDIUM');
    const [faultDescription, setFaultDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [odometerAtEntry, setOdometerAtEntry] = useState('');

    // Photo states
    const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
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
    const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

    // Camera states
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Zoom preview
    const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);

    // Cleanup object URLs on unmount
    const additionalPhotosRef = useRef<{ file: File; preview: string }[]>([]);
    useEffect(() => {
        additionalPhotosRef.current = additionalPhotos;
    }, [additionalPhotos]);

    useEffect(() => {
        return () => {
            additionalPhotosRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [cameraStream]);

    // Attach camera stream
    useEffect(() => {
        if (isCameraOpen && videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [isCameraOpen, cameraStream]);

    // Fetch initial work order
    useEffect(() => {
        if (!id) return;
        const fetchWo = async () => {
            setLoading(true);
            try {
                const data = await getWorkOrderById(id);
                setWo(data);
                setWorkOrderType(data.workOrderType);
                setPriority(data.priority || 'MEDIUM');
                setFaultDescription(data.faultDescription || '');
                setNotes(data.notes || '');
                setOdometerAtEntry(
                    data.odometerAtEntry !== undefined && data.odometerAtEntry !== null
                        ? String(data.odometerAtEntry)
                        : ''
                );
                setExistingPhotos(data.photos || []);
            } catch (err: any) {
                toast.error(err.response?.data?.message || err.message || 'Failed to load work order details');
                navigate('/work-orders');
            } finally {
                setLoading(false);
            }
        };
        fetchWo();
    }, [id, navigate]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
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
            cameraStream.getTracks().forEach((track) => track.stop());
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
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const file = new File([blob], `${activeSlot}_${Date.now()}.jpg`, { type: 'image/jpeg' });
                        if (activeSlot === 'additional') {
                            const preview = URL.createObjectURL(file);
                            setAdditionalPhotos((prev) => [...prev, { file, preview }]);
                            toast.success('Additional photo captured successfully');
                        } else {
                            setArrivalPhotos((prev) => ({
                                ...prev,
                                [activeSlot]: file,
                            }));
                            toast.success('Photo captured successfully');
                        }
                    }
                },
                'image/jpeg',
                0.85
            );
        }
        stopCamera();
    };

    const triggerUpload = (slot: 'odometer' | 'plateNo' | 'condition' | 'additional') => {
        setActiveSlot(slot);
        fileInputRef.current?.click();
    };

    const triggerCamera = async (slot: 'odometer' | 'plateNo' | 'condition' | 'additional') => {
        setActiveSlot(slot);
        await startCamera();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeSlot) {
            const file = e.target.files[0];
            if (activeSlot === 'additional') {
                const preview = URL.createObjectURL(file);
                setAdditionalPhotos((prev) => [...prev, { file, preview }]);
                toast.success('Additional photo added successfully');
            } else {
                setArrivalPhotos((prev) => ({
                    ...prev,
                    [activeSlot]: file,
                }));
                toast.success(
                    `Photo added for ${
                        activeSlot === 'odometer'
                            ? 'Odometer'
                            : activeSlot === 'plateNo'
                            ? 'Plate Number'
                            : 'Vehicle Condition'
                    }`
                );
            }
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    const handleDeleteExistingPhoto = async (photoId: string) => {
        if (!id) return;
        setDeletingPhotoId(photoId);
        try {
            const updated = await removePhoto(id, photoId);
            setExistingPhotos(updated || []);
            toast.success('Photo removed');
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || 'Failed to remove photo');
        } finally {
            setDeletingPhotoId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        setSubmitting(true);
        try {
            // 1. Update Core Work Order Details
            await updateWorkOrder(id, {
                workOrderType,
                priority,
                faultDescription,
                notes,
                odometerAtEntry: odometerAtEntry ? Number(odometerAtEntry) : undefined,
            });

            // 2. Upload Staged Photos
            const uploadPromises = [];
            if (arrivalPhotos.odometer) {
                uploadPromises.push(addPhotoFile(id, arrivalPhotos.odometer, 'CHECK_IN', 'Odometer Reading'));
            }
            if (arrivalPhotos.plateNo) {
                uploadPromises.push(addPhotoFile(id, arrivalPhotos.plateNo, 'CHECK_IN', 'Plate Number'));
            }
            if (arrivalPhotos.condition) {
                uploadPromises.push(addPhotoFile(id, arrivalPhotos.condition, 'CHECK_IN', 'Vehicle Condition'));
            }
            additionalPhotos.forEach((item, idx) => {
                uploadPromises.push(addPhotoFile(id, item.file, 'CHECK_IN', `Arrival Photo ${idx + 1}`));
            });

            if (uploadPromises.length > 0) {
                try {
                    await Promise.all(uploadPromises);
                } catch (photoErr) {
                    console.warn('Some photos failed to upload:', photoErr);
                    toast.error('Work order details updated, but some photos failed to upload.');
                }
            }

            toast.success('Work order updated successfully');
            navigate(`/work-orders/${id}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || 'Failed to update work order');
        } finally {
            setSubmitting(false);
        }
    };

    const getExistingPhotoForSlot = (slot: 'odometer' | 'plateNo' | 'condition') => {
        return existingPhotos.find((p) => {
            const cap = (p.caption || '').toLowerCase();
            if (slot === 'odometer' && cap.includes('odometer')) return true;
            if (slot === 'plateNo' && (cap.includes('plate') || cap.includes('license'))) return true;
            if (slot === 'condition' && (cap.includes('condition') || cap.includes('front view'))) return true;
            return false;
        });
    };

    const renderPhotoSlot = (
        slot: 'odometer' | 'plateNo' | 'condition',
        title: string,
        description: string
    ) => {
        const file = arrivalPhotos[slot];
        const previewUrl = file ? URL.createObjectURL(file) : null;
        const existing = getExistingPhotoForSlot(slot);

        return (
            <div className="flex flex-col p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative justify-between min-h-[230px]">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-lime)]">
                            {title}
                        </h3>
                        {existing && !file && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-bold uppercase tracking-wider">
                                Uploaded
                            </span>
                        )}
                        {file && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] font-bold uppercase tracking-wider">
                                Staged New
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">{description}</p>
                </div>

                {file && previewUrl ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--border-main)] group shadow-md bg-black/10 mt-2">
                        <img src={previewUrl} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setArrivalPhotos((prev) => ({ ...prev, [slot]: null }));
                                    URL.revokeObjectURL(previewUrl);
                                }}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                                title="Remove staged photo"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 truncate text-[9px] text-white font-mono text-center">
                            New: {file.name}
                        </div>
                    </div>
                ) : existing ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group shadow-md bg-black/20 mt-2">
                        <img src={existing.url} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setZoomedPhotoUrl(existing.url)}
                                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer"
                                title="View full photo"
                            >
                                <Eye size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteExistingPhoto(existing._id)}
                                disabled={deletingPhotoId === existing._id}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete existing photo"
                            >
                                {deletingPhotoId === existing._id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 truncate text-[9px] text-white font-mono text-center flex items-center justify-between">
                            <span className="truncate">{existing.caption || 'Arrival Photo'}</span>
                            <span className="text-[8px] opacity-60 ml-1">Current</span>
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

    const steps = [
        { number: 1, label: t('workOrders.create.type', 'Work Order Type'), icon: Wrench },
        { number: 2, label: t('workOrders.create.vehicle', 'Vehicle'), icon: Car },
        { number: 3, label: t('workOrders.create.fault', 'Job Description'), icon: AlertTriangle },
        { number: 4, label: t('workOrders.create.requiredPhotos', 'Vehicle Arrival Photos') || 'Arrival Photos', icon: Camera },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <Loader2 size={36} className="animate-spin text-lime" style={{ color: 'var(--brand-lime)' }} />
                <p className="text-sm font-semibold text-gray-400">Loading work order details...</p>
            </div>
        );
    }

    if (!wo) {
        return (
            <div className="text-center py-20 space-y-4">
                <p className="text-gray-400 font-semibold">Work order not found.</p>
                <button className="btn-secondary" onClick={() => navigate('/work-orders')}>
                    Back to Work Orders
                </button>
            </div>
        );
    }

    const vehicleObj = typeof wo.vehicleId === 'object' ? (wo.vehicleId as any) : null;

    return (
        <div className="w-full flex flex-col space-y-4 animate-fadeInUp min-h-[calc(100vh-120px)]">
            {/* Hidden file input for uploads */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Live Camera Feed Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4">
                    <div className="relative w-full max-w-lg aspect-[4/3] bg-black rounded-3xl overflow-hidden border border-white/20 shadow-2xl flex items-center justify-center">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="absolute top-4 right-4 p-2.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="mt-6 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={capturePhoto}
                            className="btn-primary h-12 px-6 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                        >
                            <Camera size={18} /> Capture Photo
                        </button>
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="btn-secondary h-12 px-5 rounded-2xl text-xs font-bold uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Zoomed Photo Modal */}
            {zoomedPhotoUrl && (
                <div
                    className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setZoomedPhotoUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                        <img src={zoomedPhotoUrl} alt="Zoomed view" className="w-full h-full object-contain" />
                        <button
                            type="button"
                            onClick={() => setZoomedPhotoUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        className="btn-icon"
                        onClick={() => navigate(`/work-orders/${id}`)}
                        id="back-btn"
                        title="Back to Work Order Detail"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                                Edit Work Order
                            </h1>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)]">
                                {wo.workOrderNumber}
                            </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Modify initial creation steps data, specifications, and arrival photos
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="btn-primary !h-10 !px-5 text-xs font-black uppercase tracking-wider flex items-center gap-2 rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
                >
                    {submitting ? (
                        <>
                            <Loader2 size={15} className="animate-spin" /> Saving...
                        </>
                    ) : (
                        <>
                            <Save size={15} /> Save Changes
                        </>
                    )}
                </button>
            </div>

            {/* Stepper Card */}
            <div className="glass-card p-6 md:p-8 flex-1 flex flex-col justify-between">
                <div>
                    {/* Horizontal Stepper */}
                    <div className="mb-8 flex items-center justify-between w-full px-2 overflow-x-auto py-2 scrollbar-none border-b border-[var(--border-main)]/30 pb-6">
                        {steps.map((s, idx) => {
                            const IconComponent = s.icon;
                            const isCompleted = currentStep > s.number;
                            const isActive = currentStep === s.number;

                            return (
                                <div key={s.number} className="flex items-center flex-1 last:flex-initial">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(s.number)}
                                        className="flex items-center gap-3 cursor-pointer transition-all duration-200 text-left outline-none group"
                                    >
                                        <div
                                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border ${
                                                isCompleted
                                                    ? 'bg-lime text-black border-lime'
                                                    : isActive
                                                    ? 'bg-lime text-black border-lime ring-4 ring-lime/20 shadow-[0_0_15px_rgba(200,230,0,0.4)]'
                                                    : 'bg-[var(--bg-input)] text-gray-400 border-[var(--border-main)] group-hover:border-gray-500'
                                            }`}
                                        >
                                            {isCompleted ? <Check size={16} strokeWidth={3} /> : <IconComponent size={16} />}
                                        </div>
                                        <span
                                            className={`text-xs font-bold uppercase tracking-wider hidden md:inline whitespace-nowrap transition-colors duration-200 ${
                                                isActive
                                                    ? 'text-lime font-black'
                                                    : isCompleted
                                                    ? 'text-gray-300'
                                                    : 'text-gray-500'
                                            }`}
                                        >
                                            {s.label}
                                        </span>
                                    </button>
                                    {idx < steps.length - 1 && (
                                        <div
                                            className={`h-[1.5px] mx-6 flex-1 hidden md:block transition-all duration-500 ${
                                                isCompleted ? 'bg-lime' : 'bg-[var(--border-main)]'
                                            }`}
                                        />
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

                    {/* Form Section */}
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
                                            {t('workOrders.create.type', 'Work Order Type')}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Select the category of maintenance or repair required for this vehicle.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                                        {WORK_ORDER_TYPES.map((t_type) => {
                                            const IconComponent = TYPE_ICONS[t_type.value] || Wrench;
                                            const isSelected = workOrderType === t_type.value;
                                            return (
                                                <button
                                                    key={t_type.value}
                                                    type="button"
                                                    onClick={() => setWorkOrderType(t_type.value)}
                                                    className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[140px] group ${
                                                        isSelected
                                                            ? 'bg-[var(--brand-lime-alpha)] border-lime shadow-[0_0_15px_rgba(200,230,0,0.15)] ring-1 ring-lime'
                                                            : 'bg-[var(--bg-input)] border-[var(--border-main)] hover:border-gray-500'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div
                                                            className={`p-2.5 rounded-xl w-fit ${
                                                                isSelected
                                                                    ? 'bg-lime text-black font-bold'
                                                                    : 'bg-white/5 text-gray-400 group-hover:text-white'
                                                            }`}
                                                        >
                                                            <IconComponent size={20} />
                                                        </div>
                                                        {isSelected && (
                                                            <span className="w-5 h-5 rounded-full bg-lime text-black flex items-center justify-center">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-4">
                                                        <p
                                                            className={`text-xs font-bold leading-tight transition-colors ${
                                                                isSelected ? 'text-lime' : 'text-gray-200'
                                                            }`}
                                                        >
                                                            {t_type.label}
                                                        </p>
                                                        <p className="text-[9px] text-gray-500 mt-1.5 uppercase tracking-wider font-semibold font-mono">
                                                            {t_type.value.replace(/_/g, ' ')}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Vehicle (Disabled / Read-only with required notice) */}
                            {currentStep === 2 && (
                                <div className="space-y-5 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.vehicle', 'Vehicle')} Details
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Vehicle assigned to this work order.
                                        </p>
                                    </div>

                                    <div className="max-w-3xl space-y-4 pt-2">
                                        {/* Vehicle Card */}
                                        <div className="p-5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-4 shadow-sm relative">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 rounded-2xl bg-lime/10 text-lime">
                                                        <Car size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-white">
                                                                {vehicleObj?.basicDetails?.make || 'Vehicle'}{' '}
                                                                {vehicleObj?.basicDetails?.model || ''}{' '}
                                                                {vehicleObj?.basicDetails?.year || ''}
                                                            </p>
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-400 font-mono flex items-center gap-1">
                                                                <Lock size={10} /> Locked
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">
                                                            VIN: {vehicleObj?.basicDetails?.vin || 'No VIN provided'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-main)]/30">
                                                {vehicleObj?.legalDocs?.registrationNumber && (
                                                    <span className="text-[10px] bg-white/10 text-white px-2 py-1 rounded font-mono font-bold tracking-wider">
                                                        Plate: {vehicleObj.legalDocs.registrationNumber}
                                                    </span>
                                                )}
                                                {vehicleObj?.status === 'ACTIVE — RENTED' && (
                                                    <span className="text-[10px] bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] px-2 py-1 rounded font-bold uppercase tracking-wider">
                                                        Rented
                                                    </span>
                                                )}
                                                {vehicleObj?.currentDriver && (
                                                    <span className="text-xs text-gray-400 ml-auto">
                                                        Driver:{' '}
                                                        <span className="font-bold text-white">
                                                            {vehicleObj.currentDriver.personalInfo?.fullName}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* MANDATORY USER NOTICE UNDER THE VEHICLE FIELD */}
                                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-400">
                                                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-400" />
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-semibold leading-relaxed">
                                                        To chnage the vehicle, create new work order to proceed with the corresponding parts assining.
                                                    </p>
                                                    <p className="text-[11px] text-amber-300/80 leading-normal">
                                                        Vehicle reassignment on existing work orders is restricted to safeguard assigned parts and inventory tracking.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Editable Odometer Entry Input */}
                                        <div className="p-5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-main)] space-y-2">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                Odometer at Entry (KM)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="E.g. 45200"
                                                className="input-field w-full text-xs font-mono"
                                                value={odometerAtEntry}
                                                onChange={(e) => setOdometerAtEntry(e.target.value)}
                                            />
                                        </div>
                                    </div>
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
                                                {t('workOrders.create.priority', 'Priority')} *
                                            </label>
                                            <div className="flex flex-col gap-2.5">
                                                {PRIORITY_OPTIONS.map((p) => {
                                                    const isSelected = priority === p.value;
                                                    return (
                                                        <button
                                                            key={p.value}
                                                            type="button"
                                                            onClick={() => setPriority(p.value as Priority)}
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
                                                                <div
                                                                    className="w-2 h-2 rounded-full"
                                                                    style={{ backgroundColor: p.color }}
                                                                />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Column: Job Description & Notes */}
                                        <div className="lg:col-span-8 space-y-4">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                    {t('workOrders.create.fault', 'Job / Fault Description')} *
                                                </label>
                                                <textarea
                                                    value={faultDescription}
                                                    onChange={(e) => setFaultDescription(e.target.value)}
                                                    placeholder="Describe the vehicle symptoms, faults reported, or exact job scope required..."
                                                    rows={6}
                                                    className="input-field resize-none text-xs flex-1"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                                    Internal Workshop Notes (Optional)
                                                </label>
                                                <textarea
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="Add technician or workshop notes..."
                                                    rows={3}
                                                    className="input-field resize-none text-xs flex-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Vehicle Arrival Photos */}
                            {currentStep === 4 && (
                                <div className="space-y-6 animate-fadeInUp">
                                    <div className="flex flex-col gap-1 border-b border-[var(--border-main)]/30 pb-3">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                            {t('workOrders.create.requiredPhotos', 'Vehicle arrival photos')}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            Review, update, or upload arrival photos of the vehicle's condition upon arrival.
                                        </p>
                                    </div>

                                    {/* 3 Main Slots */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        {renderPhotoSlot('odometer', 'Odometer Reading', 'Capture or upload current dashboard mileage reading.')}
                                        {renderPhotoSlot('plateNo', 'Plate Number', 'Capture or upload license plate clearly for verification.')}
                                        {renderPhotoSlot('condition', 'Vehicle Condition', 'Capture or upload overall exterior view or visible damage.')}
                                    </div>

                                    {/* Additional Photos Section */}
                                    <div className="border-t border-[var(--border-main)]/30 pt-6 mt-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-lime)]">
                                                    Additional Photos
                                                </h3>
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    Upload or capture any additional photos of the vehicle (dents, scratches, interior, accessories).
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => triggerCamera('additional')}
                                                    className="btn-secondary h-9 px-3 text-[11px] font-bold flex items-center gap-1.5 rounded-xl border border-[var(--border-main)] hover:bg-white/5 cursor-pointer"
                                                >
                                                    <Camera size={14} /> Camera
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => triggerUpload('additional')}
                                                    className="btn-primary h-9 px-3 text-[11px] font-bold flex items-center gap-1.5 rounded-xl cursor-pointer"
                                                >
                                                    <Plus size={14} /> Upload
                                                </button>
                                            </div>
                                        </div>

                                        {/* Newly Staged Additional Photos */}
                                        {additionalPhotos.length > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-bold uppercase text-[var(--brand-lime)] tracking-wider">
                                                    Staged For Upload ({additionalPhotos.length})
                                                </span>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                                    {additionalPhotos.map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="relative aspect-video rounded-xl overflow-hidden border border-[var(--brand-lime)]/40 group shadow-md bg-black/20"
                                                        >
                                                            <img
                                                                src={item.preview}
                                                                alt={`Additional ${idx + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        URL.revokeObjectURL(item.preview);
                                                                        setAdditionalPhotos((prev) =>
                                                                            prev.filter((_, i) => i !== idx)
                                                                        );
                                                                    }}
                                                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Other Existing Stored Photos */}
                                        {(() => {
                                            const otherExisting = existingPhotos.filter(
                                                (p) =>
                                                    p._id !== getExistingPhotoForSlot('odometer')?._id &&
                                                    p._id !== getExistingPhotoForSlot('plateNo')?._id &&
                                                    p._id !== getExistingPhotoForSlot('condition')?._id
                                            );
                                            if (otherExisting.length === 0) return null;

                                            return (
                                                <div className="space-y-2 pt-2">
                                                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                                        Existing Stored Photos ({otherExisting.length})
                                                    </span>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                                        {otherExisting.map((p) => (
                                                            <div
                                                                key={p._id}
                                                                className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group shadow-md bg-black/20"
                                                            >
                                                                <img
                                                                    src={p.url}
                                                                    alt={p.caption || 'Photo'}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setZoomedPhotoUrl(p.url)}
                                                                        className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        <Eye size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteExistingPhoto(p._id)}
                                                                        disabled={deletingPhotoId === p._id}
                                                                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                                    >
                                                                        {deletingPhotoId === p._id ? (
                                                                            <Loader2 size={12} className="animate-spin" />
                                                                        ) : (
                                                                            <Trash2 size={12} />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1.5 py-0.5 truncate text-[8px] text-white font-mono text-center">
                                                                    {p.caption || p.stage || 'Photo'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex items-center justify-between border-t border-[var(--border-main)]/30 pt-6 mt-6">
                            <button
                                type="button"
                                onClick={() => {
                                    if (currentStep > 1) {
                                        setCurrentStep((prev) => prev - 1);
                                    } else {
                                        navigate(`/work-orders/${id}`);
                                    }
                                }}
                                className="btn-secondary h-11 px-6 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                            >
                                {currentStep === 1 ? 'Cancel' : 'Previous Step'}
                            </button>

                            <div className="flex items-center gap-3">
                                {currentStep < 4 ? (
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep((prev) => prev + 1)}
                                        className="btn-primary h-11 px-8 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-lg"
                                    >
                                        Next Step
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-primary h-11 px-8 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Saving Changes...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} /> Save Changes
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditWorkOrder;
