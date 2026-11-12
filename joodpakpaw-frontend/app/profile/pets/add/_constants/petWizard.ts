export interface SpeciesCardConfig {
  key: 'dog' | 'cat' | 'exotic'
  label: string
  subtitle: string
  imageSrc: string
}

export const SPECIES_CONFIG: SpeciesCardConfig[] = [
  {
    key: 'dog',
    label: 'Dog',
    subtitle: 'All breeds and sizes',
    imageSrc: '/icons/pets/dog.webp',
  },
  {
    key: 'cat',
    label: 'Cat',
    subtitle: 'Indoor and outdoor felines',
    imageSrc: '/icons/pets/cat.webp',
  },
  {
    key: 'exotic',
    label: 'Exotic pet',
    subtitle: 'Rabbits, birds, hamsters and reptiles',
    imageSrc: '/icons/pets/exotic.webp',
  },
]

export const MIXED_PET_ICON_SRC = '/icons/pets/mixed-pet.webp'

export interface WeightPreset {
  label: string
  desc: string
  min: number
  max: number
  defaultVal: number
  sizeId: number
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  { label: '< 5 kg', desc: 'Small (Chihuahua)', min: 0.1, max: 5, defaultVal: 3.5, sizeId: 1 },
  { label: '5 – 15 kg', desc: 'Medium (Beagle)', min: 5, max: 15, defaultVal: 10, sizeId: 2 },
  { label: '15 – 30 kg', desc: 'Large (Husky)', min: 15, max: 30, defaultVal: 22, sizeId: 3 },
  { label: '> 30 kg', desc: 'Giant (Great Dane)', min: 30, max: 120, defaultVal: 35, sizeId: 4 },
]

export interface EnergyLevelConfig {
  rating: number
  title: string
  desc: string
  iconSrc: string
}

export const ENERGY_LEVELS: EnergyLevelConfig[] = [
  {
    rating: 1,
    title: 'Couch potato',
    desc: 'Sleeps most of the day, prefers gentle strolls',
    iconSrc: '/icons/pets/energy-1.webp',
  },
  {
    rating: 2,
    title: 'Mellow',
    desc: 'Low energy, enjoys lounging and casual walks',
    iconSrc: '/icons/pets/energy-2.webp',
  },
  {
    rating: 3,
    title: 'Balanced',
    desc: 'Moderate energy, loves daily play and walks',
    iconSrc: '/icons/pets/energy-3.webp',
  },
  {
    rating: 4,
    title: 'High energy',
    desc: 'Very active, enjoys running and fetch games',
    iconSrc: '/icons/pets/energy-4.webp',
  },
  {
    rating: 5,
    title: 'Hyperactive',
    desc: 'High stamina, needs intensive daily exercise',
    iconSrc: '/icons/pets/energy-5.webp',
  },
]

export const SIZE_LABELS: Record<number, string> = {
  1: 'Small (< 5 kg)',
  2: 'Medium (5 – 15 kg)',
  3: 'Large (15 – 30 kg)',
  4: 'Giant (> 30 kg)',
}

export function formatCleanBreedName(rawBreed: string): string {
  const match = /(.*?)\s*\(.*?\)/.exec(rawBreed)
  return (match ? match[1] : rawBreed).trim()
}

export function isSpecialBreedName(rawBreed: string): boolean {
  const lower = rawBreed.toLowerCase()
  return (
    lower.includes('mixed') ||
    lower.includes('other') ||
    lower.includes('unknown') ||
    rawBreed.includes('พันธุ์ผสม') ||
    rawBreed.includes('อื่นๆ')
  )
}

export function deriveSizeFromBreed(cleanName: string): number {
  const lower = cleanName.toLowerCase()
  if (lower.includes('giant') || lower.includes('maine coon')) return 4
  if (
    lower.includes('golden') ||
    lower.includes('labrador') ||
    lower.includes('husky') ||
    lower.includes('ridgeback') ||
    lower.includes('ragdoll')
  ) {
    return 3
  }
  if (
    lower.includes('corgi') ||
    lower.includes('beagle') ||
    lower.includes('bulldog') ||
    lower.includes('shorthair') ||
    lower.includes('persian')
  ) {
    return 2
  }
  return 1
}

export function deriveSizeFromWeight(weightKg: number): number {
  if (weightKg <= 5) return 1
  if (weightKg <= 15) return 2
  if (weightKg <= 30) return 3
  return 4
}
