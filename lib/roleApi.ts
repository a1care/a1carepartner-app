import { useAuthStore } from "../stores/auth";

export function getRolePath(): string {
    const role = useAuthStore.getState().user?.role?.toLowerCase?.() ?? 'doctor';
    if (role.includes('nurse')) return 'nurse';
    if (role.includes('ambulance')) return 'ambulance';
    if (role.includes('rental')) return 'rental';
    return 'doctor';
}
