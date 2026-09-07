export interface City {
    id: number,
    name: string,
    canton: string,
}

export interface CreateCityDto {
  name: string;
  canton: string;
}