export interface Arena {
  id: number;
  name: string;
  description: string;
  city: string;
  cityId: number;
  sportType: string;
  address: string;
  imageUrl: string;
  pricePerHour: number;
  createdAt: string | Date;
}

export interface CreateArenaDto {
  name: string;
  description: string;
  cityId: number;
  sportType: string;
  address: string;
  pricePerHour: number;
}

export interface UpdateArenaDto {
  name: string;
  description: string;
  cityId: number;
  sportType: string;
  address: string;
  pricePerHour: number;
}
