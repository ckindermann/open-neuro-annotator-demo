import { useState } from 'react'
import TreeBrowser from '../components/TreeBrowser'
import DatasetFilter from '../components/DatasetFilter'
import DatasetView from '../components/DatasetView'
import sampleCategories from '../data/sampleData.json'
import { Category, Dataset } from '../types'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>(sampleCategories)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  const [keywordList, setKeywordList] = useState<string[]>([])
  const [inclusionList, setInclusionList] = useState<string[]>([])
  const [exclusionList, setExclusionList] = useState<string[]>([])
  const [isAnnotating, setIsAnnotating] = useState(false)

  const updateDataset = (id: string, fn: (ds: Dataset) => Dataset) => {
    const recurse = (cats: Category[]): Category[] =>
      cats.map(cat => ({
        ...cat,
        datasets: cat.datasets.map(ds => ds.id === id ? fn(ds) : ds),
        children: cat.children ? recurse(cat.children) : undefined,
      }))
    setCategories(prev => recurse(prev))
  }

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat)
    if (!isAnnotating) setSelectedDataset(null)
  }
  const handleSelectDataset = (ds: Dataset) => setSelectedDataset(ds)

  const handleAddKeyword = (t: string) => setKeywordList(list => list.includes(t) ? list : [...list, t])
  const handleAddInclusion = (t: string) => setInclusionList(list => list.includes(t) ? list : [...list, t])
  const handleAddExclusion = (t: string) => setExclusionList(list => list.includes(t) ? list : [...list, t])
  const handleRemoveKeyword = (t: string) => setKeywordList(list => list.filter(x => x !== t))
  const handleRemoveInclusion = (t: string) => setInclusionList(list => list.filter(x => x !== t))
  const handleRemoveExclusion = (t: string) => setExclusionList(list => list.filter(x => x !== t))
  const handleClearKeywords = () => setKeywordList([])
  const handleClearInclusion = () => setInclusionList([])
  const handleClearExclusion = () => setExclusionList([])

  const handleAnnotate = () => {
    if (!selectedDataset) return
    setKeywordList(selectedDataset.keywords ?? [])
    setInclusionList(selectedDataset.inclusionTerms ?? [])
    setExclusionList(selectedDataset.exclusionTerms ?? [])
    setIsAnnotating(true)
  }

  const handleCancelAnnotation = () => setIsAnnotating(false)

  const handleSubmitAnnotations = async () => {
    if (!selectedDataset) return
    await fetch('/api/save-annotations', {
      method: 'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        datasetId: selectedDataset.id,
        keywords: keywordList,
        inclusionTerms: inclusionList,
        exclusionTerms: exclusionList,
      })
    })
    updateDataset(selectedDataset.id, ds => ({
      ...ds, keywords: keywordList, inclusionTerms: inclusionList, exclusionTerms: exclusionList
    }))
    setIsAnnotating(false)
  }

  return (
    <div className="grid grid-cols-[1fr_2fr_2fr] h-screen">
      <TreeBrowser
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onAddKeyword={handleAddKeyword}
        onAddInclusion={handleAddInclusion}
        onAddExclusion={handleAddExclusion}
      />

      <DatasetFilter
        categories={categories}
        keywordList={keywordList}
        inclusionList={inclusionList}
        exclusionList={exclusionList}
        selectedCategory={selectedCategory}
        onSelectDataset={handleSelectDataset}
        onRemoveKeyword={handleRemoveKeyword}
        onRemoveInclusion={handleRemoveInclusion}
        onRemoveExclusion={handleRemoveExclusion}
        onClearKeywords={handleClearKeywords}
        onClearInclusion={handleClearInclusion}
        onClearExclusion={handleClearExclusion}
        isAnnotating={isAnnotating}
        onSubmitAnnotations={handleSubmitAnnotations}
        onCancelAnnotation={handleCancelAnnotation}
        onAddKeyword={handleAddKeyword}
        onAddInclusion={handleAddInclusion}
        onAddExclusion={handleAddExclusion}
      />

      <DatasetView
        selectedDataset={selectedDataset}
        onAnnotate={handleAnnotate}
      />
    </div>
  )
}
