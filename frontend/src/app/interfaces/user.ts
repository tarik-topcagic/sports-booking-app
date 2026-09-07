export interface User {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl: string | null;
    phoneNumber: string;
    location: string;
    cityId: number | null;
}

export interface UserSettings {
  username: string;
  email: string;
  phoneNumber: string;
  emailNotificationsEnabled: boolean;
  languagePreference: string;
}
