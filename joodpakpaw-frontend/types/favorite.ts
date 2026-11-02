import { Property } from './property'

export interface FavoriteFolder {
  id: number
  name: string
  propertyCount: number
  firstPropertyImage: string
  createdAt: string
}

export interface FavoriteFolderDetail extends FavoriteFolder {
  properties: Property[]
}

export interface FavoriteFoldersResponse {
  favoriteFolders: FavoriteFolder[]
}
