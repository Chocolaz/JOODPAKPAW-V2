export interface Pet {
  id: number
  name: string
}

export interface PetsResponse {
  pets: Pet[]
}

export interface PetBreed {
  id: number
  breed: string
  petId: number
  petName: string
  imageUrl?: string
}

export interface PetBreedsResponse {
  petBreeds: PetBreed[]
}

export interface PetSizeCategory {
  id: number
  name: string
  code: number
  min: number
  max: number
}

export interface PetSizeCategoriesResponse {
  petSizeCategories: PetSizeCategory[]
}

export interface PetProfile {
  id: number
  name: string
  image: string | null
  birthDate: string
  age?: number // In list view
  petTypeName?: string // In list view
  petSizeCategoryId?: number // In list view
  sex?: 'male' | 'female' // In detail view
  petBreedName?: string // In detail view
  petSizeName?: string // In detail view
  rating?: number // In detail view
  contactName?: string // In detail view
  contactPhone?: string // In detail view
  note?: string // In detail view
}

export interface PetProfilesResponse {
  petProfiles: PetProfile[]
}

export enum PetGender {
  Male = 'male',
  Female = 'female',
  Other = 'other', // Renamed from "Not sure" for consistency with typical enum values
}

export interface PetProfileFormData {
  petTypeId: number | null
  petTypeName: string | null
  petBreedId: number | null
  petBreedName: string | null
  petName: string | null
  petImage: File | null
  petGender: PetGender | null
  petSizeCategoryId: number | null
  petSizeName: string | null
  petBirthDate: string | null
  petActivityLevel: number | null
  contactName: string | null
  contactPhone: string | null
  petNote: string | null
}
