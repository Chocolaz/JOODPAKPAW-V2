import { countries } from 'countries-list'

export const propertyTypes = [
  { id: 1, name: 'House' },
  { id: 2, name: 'Apartment/Condo' },
  { id: 3, name: 'Pet Hotel' },
]
export const countryNames = Object.values(countries)
  .map((country) => country.name)
  .sort()
