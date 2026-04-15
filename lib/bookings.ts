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
        // We use Socket.io for real-time, but this can be a fallback if needed
        // For now, we return a mock object that's compatible with the local state
        // since the actual persistence happens in the Socket 'send_message' handler
        return {
            _id: Math.random().toString(),
            bookingId,
            message,
            senderType: 'Partner',
            createdAt: new Date().toISOString()
        };
    }
};
