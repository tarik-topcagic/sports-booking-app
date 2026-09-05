export interface User {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl: string | null;
    phoneNumber: string;
    location: string;
    cityId: number | null;
}
