import { useState } from 'react'
import TreeBrowser from '../components/TreeBrowser'
import DatasetFilter from '../components/DatasetFilter'
import DatasetView from '../components/DatasetView'
import categoryTree from '../data/categories.json'
import datasetsData from '../data/datasets.json'
import { Category, Dataset, Annotation } from '../types'

// Shape of each row in the annotation table
interface AnnotationItem {
  text: string
  subcategory: string
  term: string
  keyword: boolean
  inclusion: boolean
  exclusion: boolean
}

export default function Home() {
  const [categories] = useState<Category[]>(categoryTree)
  const [datasets, setDatasets] = useState<Dataset[]>(datasetsData)

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  // Top‐pane filter lists
  const [keywordList, setKeywordList] = useState<Annotation[]>([])
  const [inclusionList, setInclusionList] = useState<Annotation[]>([])
  const [exclusionList, setExclusionList] = useState<Annotation[]>([])
  const [isAnnotating, setIsAnnotating] = useState(false)

  // Helper to update our in‐memory datasets (and selected)
  const updateDataset = (id: string, fn: (ds: Dataset) => Dataset) => {
    setDatasets(prev => prev.map(ds => (ds.id === id ? fn(ds) : ds)))
    setSelectedDataset(prev => (prev && prev.id === id ? fn(prev) : prev))
  }

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat)
    if (!isAnnotating) setSelectedDataset(null)
  }
  const handleSelectDataset = (ds: Dataset) => setSelectedDataset(ds)

  const handleAnnotate = () => {
    if (!selectedDataset) return
    setKeywordList(selectedDataset.keywords ?? [])
    setInclusionList(selectedDataset.inclusionTerms ?? [])
    setExclusionList(selectedDataset.exclusionTerms ?? [])
    setIsAnnotating(true)
  }
  const handleCancelAnnotation = () => setIsAnnotating(false)

  // Called when the user clicks “Submit Annotations” in the table
  const handleSubmitAnnotations = async (extractItems: AnnotationItem[]) => {
    if (!selectedDataset) return

    // Build a map from label to id for all categories and terms
    const labelToId = new Map<string, string>()
    const walk = (cats: Category[]) => {
      cats.forEach(c => {
        labelToId.set(c.label, c.id)
        c.children.forEach(sub => {
          labelToId.set(sub.label, sub.id)
          sub.children.forEach(term => {
            labelToId.set(term.label, term.id)
          })
        })
        walk(c.children)
      })
    }
    walk(categories)

    // Derive new annotations from the table
    const newKeywords: Annotation[] = []
    const newInclusions: Annotation[] = []
    const newExclusions: Annotation[] = []

    for (const item of extractItems) {
      const chosenLabel = item.term || item.subcategory
      const chosenId = labelToId.get(chosenLabel) ?? chosenLabel
      const ann: Annotation = {
        id: chosenId,
        label: chosenLabel,
        comment: '',
        text: item.text
      }
      if (item.keyword)    newKeywords.push(ann)
      if (item.inclusion)  newInclusions.push(ann)
      if (item.exclusion)  newExclusions.push(ann)
    }

    // Merge with existing lists, avoiding duplicates by id
    const mergedKeywords = [
      ...keywordList,
      ...newKeywords.filter(nk => !keywordList.some(k => k.id === nk.id))
    ]
    const mergedInclusions = [
      ...inclusionList,
      ...newInclusions.filter(ni => !inclusionList.some(i => i.id === ni.id))
    ]
    const mergedExclusions = [
      ...exclusionList,
      ...newExclusions.filter(ne => !exclusionList.some(e => e.id === ne.id))
    ]

    // Persist merged lists
    await fetch('/api/save-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasetId: selectedDataset.id,
        keywords: mergedKeywords,
        inclusionTerms: mergedInclusions,
        exclusionTerms: mergedExclusions,
      }),
    })

    // Update UI state
    updateDataset(selectedDataset.id, ds => ({
      ...ds,
      keywords: mergedKeywords,
      inclusionTerms: mergedInclusions,
      exclusionTerms: mergedExclusions,
    }))
    setKeywordList(mergedKeywords)
    setInclusionList(mergedInclusions)
    setExclusionList(mergedExclusions)
    setIsAnnotating(false)
  }

  return (
    <div className="grid grid-cols-[1fr_2fr_2fr] h-screen">
      <TreeBrowser
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onAddKeyword={ann =>
          setKeywordList(list =>
            list.some(a => a.id === ann.id) ? list : [...list, ann]
          )
        }
        onAddInclusion={ann =>
          setInclusionList(list =>
            list.some(a => a.id === ann.id) ? list : [...list, ann]
          )
        }
        onAddExclusion={ann =>
          setExclusionList(list =>
            list.some(a => a.id === ann.id) ? list : [...list, ann]
          )
        }
      />

      <DatasetFilter
        datasets={datasets}
        categories={categories}
        keywordList={keywordList}
        inclusionList={inclusionList}
        exclusionList={exclusionList}
        selectedCategory={selectedCategory}
        onSelectDataset={handleSelectDataset}
        onRemoveKeyword={ann =>
          setKeywordList(list => list.filter(x => x.id !== ann.id))
        }
        onRemoveInclusion={ann =>
          setInclusionList(list => list.filter(x => x.id !== ann.id))
        }
        onRemoveExclusion={ann =>
          setExclusionList(list => list.filter(x => x.id !== ann.id))
        }
        onClearKeywords={() => setKeywordList([])}
        onClearInclusion={() => setInclusionList([])}
        onClearExclusion={() => setExclusionList([])}
        isAnnotating={isAnnotating}
        onSubmitAnnotations={handleSubmitAnnotations}
        onCancelAnnotation={handleCancelAnnotation}
      />

      <DatasetView
        selectedDataset={selectedDataset}
        onAnnotate={handleAnnotate}
      />
    </div>
  )
}
