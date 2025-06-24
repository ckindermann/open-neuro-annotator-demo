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

  // 1) “Add annotations” merges the table items into the in‐memory lists, stays in annotation mode
  const handleAddAnnotations = (items: AnnotationItem[]) => {
    // map labels → ids
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

    // derive new sets
    const newKs: Annotation[] = []
    const newIs: Annotation[] = []
    const newEs: Annotation[] = []

    items.forEach(item => {
      const chosenLabel = item.term || item.subcategory
      const chosenId = labelToId.get(chosenLabel) ?? chosenLabel
      const ann: Annotation = {
        id: chosenId,
        label: chosenLabel,
        comment: '',
        text: item.text
      }
      if (item.keyword)   newKs.push(ann)
      if (item.inclusion) newIs.push(ann)
      if (item.exclusion) newEs.push(ann)
    })

    // merge avoiding duplicates
    setKeywordList(kl => [
      ...kl,
      ...newKs.filter(a => !kl.some(k => k.id === a.id))
    ])
    setInclusionList(il => [
      ...il,
      ...newIs.filter(a => !il.some(i => i.id === a.id))
    ])
    setExclusionList(el => [
      ...el,
      ...newEs.filter(a => !el.some(e => e.id === a.id))
    ])
    // stay in annotation mode
  }

  // 2) “Submit Annotations” writes out and exits annotation mode
  const handleSubmitAnnotations = async (items: AnnotationItem[]) => {
    if (!selectedDataset) return

    // map labels → ids
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

    // derive merged lists just like Add, but then persist
    const mergedKs: Annotation[] = []
    const mergedIs: Annotation[] = []
    const mergedEs: Annotation[] = []

    items.forEach(item => {
      const chosenLabel = item.term || item.subcategory
      const chosenId = labelToId.get(chosenLabel) ?? chosenLabel
      const ann: Annotation = {
        id: chosenId,
        label: chosenLabel,
        comment: '',
        text: item.text
      }
      if (item.keyword)   mergedKs.push(ann)
      if (item.inclusion) mergedIs.push(ann)
      if (item.exclusion) mergedEs.push(ann)
    })

    // also include any existing in-memory ones
    const finalKs = [
      ...keywordList,
      ...mergedKs.filter(a => !keywordList.some(k => k.id === a.id))
    ]
    const finalIs = [
      ...inclusionList,
      ...mergedIs.filter(a => !inclusionList.some(i => i.id === a.id))
    ]
    const finalEs = [
      ...exclusionList,
      ...mergedEs.filter(a => !exclusionList.some(e => e.id === a.id))
    ]

    // Persist
    await fetch('/api/save-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasetId: selectedDataset.id,
        keywords: finalKs,
        inclusionTerms: finalIs,
        exclusionTerms: finalEs,
      }),
    })

    // Update state & exit annotation mode
    updateDataset(selectedDataset.id, ds => ({
      ...ds,
      keywords: finalKs,
      inclusionTerms: finalIs,
      exclusionTerms: finalEs,
    }))
    setKeywordList(finalKs)
    setInclusionList(finalIs)
    setExclusionList(finalEs)
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
        onAddAnnotations={handleAddAnnotations}
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
