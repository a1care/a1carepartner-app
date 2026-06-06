import { api } from "./api";

export const partnerBookingService = {
    updateStatus: async (id: string, status: string, bookingType: 'Doctor' | 'Service' = 'Doctor') => {
        const path = bookingType === 'Doctor' 
            ? `/appointment/status/${id}` 
            : `/service/booking/status/${id}`;
        
        // Map common statuses if needed
        const finalStatus = bookingType === 'Service' ? status.toUpperCase() : status;
        return api.patch(path, { status: finalStatus });
    },

    acceptServiceRequest: async (id: string, roleId?: string) => {
        const body = roleId ? { roleId } : {};
        return api.post(`/service/booking/accept/${id}`, body);
    },

    getBookingDetail: async (id: string, bookingType: 'Doctor' | 'Service' = 'Service') => {
        const res = await api.get(`/appointment/provider/booking/${id}`, { params: { type: bookingType } });
        return res.data.data;
    },

    rejectServiceRequest: async (id: string) => {
        return api.post(`/service/booking/reject/${id}`);
    },

    updateLocation: async (data: { latitude: number, longitude: number, heading?: number, speed?: number }) => {
        return api.post(`/appointment/location/update`, data);
    },

    getMessages: async (bookingId: string) => {
        const res = await api.get(`/chat/${bookingId}`);
        return res.data.data || [];
    },

    sendMessage: async (bookingId: string, message: string) => {
        // Persist via REST first (source of truth) so messages survive socket drops.
        // The socket emit is still used for real-time delivery to the other party.
        const res = await api.post(`/chat/${bookingId}`, { message });
        return res.data.data;
    }
};
