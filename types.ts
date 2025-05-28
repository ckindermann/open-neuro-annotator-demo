export interface Dataset {
  id: string
  label: string
  description: string
  keywords?: string[]
  inclusionTerms?: string[]
  exclusionTerms?: string[]
   authors?: string[]
   accessionNumber?: string
   doi?: string
   license?: string
}

export interface Category {
  id: string
  label: string
  datasets: Dataset[]
  children?: Category[]
}
