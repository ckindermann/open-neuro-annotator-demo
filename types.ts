export interface Annotation {
  id: string
  label: string
  comment: string
  text: string
}

export interface Dataset {
  id: string
  label: string
  description: string
  keywords?: Annotation[]
  inclusionTerms?: Annotation[]
  exclusionTerms?: Annotation[]
  authors?: string[]
  accessionNumber?: string
  doi?: string
  license?: string
}

// Category only describes hierarchy now
export interface Category {
  id: string
  label: string
  children: Category[]
}
