import { useState } from 'react'
import TreeBrowser from '../components/TreeBrowser'
import DatasetFilter from '../components/DatasetFilter'
import DatasetView from '../components/DatasetView'
import categoryTree from '../data/categories.json'
import datasetsData from '../data/datasets.json'
import { Category, Dataset, Annotation } from '../types'

export default function Home() {
  // categories only holds hierarchy
  const [categories] = useState<Category[]>(categoryTree)
  // datasets is full list, used for filtering & annotation
  const [datasets, setDatasets] = useState<Dataset[]>(datasetsData)

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  const [keywordList, setKeywordList] = useState<Annotation[]>([])
  const [inclusionList, setInclusionList] = useState<Annotation[]>([])
  const [exclusionList, setExclusionList] = useState<Annotation[]>([])
  const [isAnnotating, setIsAnnotating] = useState(false)

  // Update in‐memory dataset and selection after save
  const updateDataset = (id: string, fn: (ds: Dataset) => Dataset) => {
    setDatasets(prev => prev.map(ds => (ds.id === id ? fn(ds) : ds)))
    setSelectedDataset(prev => (prev && prev.id === id ? fn(prev) : prev))
  }

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat)
    if (!isAnnotating) setSelectedDataset(null)
  }
  const handleSelectDataset = (ds: Dataset) => setSelectedDataset(ds)

  const handleAddKeyword = (ann: Annotation) =>
    setKeywordList(list => (list.some(a => a.id === ann.id) ? list : [...list, ann]))
  const handleAddInclusion = (ann: Annotation) =>
    setInclusionList(list => (list.some(a => a.id === ann.id) ? list : [...list, ann]))
  const handleAddExclusion = (ann: Annotation) =>
    setExclusionList(list => (list.some(a => a.id === ann.id) ? list : [...list, ann]))

  const handleRemoveKeyword = (ann: Annotation) =>
    setKeywordList(list => list.filter(x => x.id !== ann.id))
  const handleRemoveInclusion = (ann: Annotation) =>
    setInclusionList(list => list.filter(x => x.id !== ann.id))
  const handleRemoveExclusion = (ann: Annotation) =>
    setExclusionList(list => list.filter(x => x.id !== ann.id))

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasetId: selectedDataset.id,
        keywords: keywordList,
        inclusionTerms: inclusionList,
        exclusionTerms: exclusionList,
      }),
    })
    updateDataset(selectedDataset.id, ds => ({
      ...ds,
      keywords: keywordList,
      inclusionTerms: inclusionList,
      exclusionTerms: exclusionList,
    }))
    setIsAnnotating(false)
  }

  return (
    <div className="grid grid-cols-[1fr_2fr_2fr] h-screen">
      <TreeBrowser
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onAddKeyword={handleAddKeyword}
        onAddInclusion={handleAddInclusion}
        onAddExclusion={handleAddExclusion}
      />

      <DatasetFilter
        datasets={datasets}
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
