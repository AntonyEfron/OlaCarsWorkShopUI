import api from './api';

export interface Vehicle {
    _id: string;
    purchaseDetails: {
        branch?: string | { _id: string; name: string };
        [key: string]: unknown;
    };
    basicDetails: {
        make: string;
        model: string;
        year: number;
        vin: string;
        category?: string;
        fuelType?: string;
        colour?: string;
        odometer?: number;
        [key: string]: unknown;
    };
    status: string;
    currentDriver?: {
        _id: string;
        personalInfo?: {
            fullName: string;
            phone?: string;
            email?: string;
        };
        driverId: string;
    };
    createdAt: string;
    updatedAt: string;
    gpsSerialNumber?: string;
    legalDocs?: {
        registrationNumber?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export const getVehicles = async (search?: string): Promise<Vehicle[]> => {
    const params: any = {};
    if (search) params.search = search;

    const response = await api.get('/api/vehicle/', {
        params,
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || response.data;
};

export const getVehicleById = async (id: string): Promise<Vehicle> => {
    const response = await api.get(`/api/vehicle/${id}`, {
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || response.data;
};

export interface DueForServiceVehicle {
    _id: string;
    basicDetails: Vehicle['basicDetails'];
    purchaseDetails: Vehicle['purchaseDetails'];
    status: string;
    currentDriver?: Vehicle['currentDriver'];
    maintenanceDetails?: Record<string, unknown>;
    distanceSinceService: number;
    threshold: number;
    lastServiceOdometer: number;
    percentUsed: number;
    serviceStatus: 'OK' | 'APPROACHING' | 'OVERDUE';
    isPulled?: boolean;
    activeAlertId?: string | null;
}

export interface DueForServicePagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface DueForServiceCounts {
    all: number;
    due: number;
    approaching: number;
    ok: number;
}

export interface DueForServiceResponse {
    data: DueForServiceVehicle[];
    pagination: DueForServicePagination;
    counts: DueForServiceCounts;
}

export const getVehiclesDueForService = async (
    showAll = true,
    page = 1,
    limit = 15,
    filter = 'ALL',
    search = ''
): Promise<DueForServiceResponse> => {
    const response = await api.get('/api/vehicle/due-for-service', {
        params: {
            showAll: showAll ? 'true' : 'false',
            warningPercent: 0.8,
            page,
            limit,
            filter,
            search
        },
        // @ts-ignore
        skipToast: true,
    });
    return {
        data: response.data.data || [],
        pagination: response.data.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 },
        counts: response.data.counts || { all: 0, due: 0, approaching: 0, ok: 0 },
    };
};

export interface GpsLocationData {
    imei: string;
    lat: number;
    lng: number;
    posType: string;
    speed: number;
    gpsTime: string;
    hbTime: string;
    accStatus: number;
    status: number;
    direction: number;
    electQuantity: number;
    locDesc: string;
    matchType?: string;
}

export const getVehicleGpsLocation = async (imei: string): Promise<GpsLocationData | null> => {
    const response = await api.get('/api/gps/locations', {
        params: { imeis: imei },
        // @ts-ignore
        skipToast: true,
    });
    const list = response.data.data || [];
    return list.length > 0 ? list[0] : null;
};

export const getGpsDevices = async (): Promise<any[]> => {
    const response = await api.get('/api/gps/vehicles', {
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || [];
};

export interface GpsMileageData {
    imei: string;
    mileage: number; // in meters or km depending on platform
    runTime: number; // minutes or seconds
}

export interface GpsTrackPoint {
    lat: number;
    lng: number;
    speed?: number;
    gpsSpeed?: number;
    mileage?: number;
    gpsTime: string;
}

export const getVehicleGpsMileage = async (imei: string): Promise<GpsMileageData[]> => {
    const response = await api.get('/api/gps/mileage', {
        params: { imeis: imei },
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || [];
};

export const getVehicleGpsTrack = async (imei: string): Promise<GpsTrackPoint[]> => {
    const response = await api.get('/api/gps/track', {
        params: { imei },
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || [];
};

export interface GpsObdData {
    imei: string;
    dataReportTime: string;
    odometerReading?: string;
    deviceAccumulatedMileage?: string;
    remainingFuel?: string | null;
    remainingFuelPercentage?: string;
    coolantTemperature?: string;
    vehicleBatterVoltage?: string;
    currentRPM?: string;
    currentSpeed?: string;
    vin?: string;
}

export const getVehicleGpsObdData = async (imei: string, startTime?: string, endTime?: string): Promise<any> => {
    const params = { imei, startTime, endTime };
    const response = await api.get('/api/gps/obd', {
        params,
        // @ts-ignore
        skipToast: true,
    });
    console.log("------------------------:", response.data);
    return response.data.data || response.data;
};
