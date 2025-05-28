import { Dataset } from '../types'

interface DatasetViewProps {
  selectedDataset: Dataset | null
  onAnnotate: () => void
}

export default function DatasetView({ selectedDataset, onAnnotate }: DatasetViewProps) {
  if (!selectedDataset) {
    return <div className="p-4">Select a dataset</div>
  }

  return (
    <div className="relative p-4 h-full">
      <h2 className="text-xl font-semibold mb-2">{selectedDataset.label}</h2>
      <p className="mb-2">{selectedDataset.description}</p>
      {selectedDataset.authors && (
        <div className="mb-2">
          <span className="font-semibold">Authors: </span>
          {selectedDataset.authors.join(', ')}
        </div>
      )}
      {selectedDataset.accessionNumber && (
        <div className="mb-2">
          <span className="font-semibold">Accession Number: </span>
          {selectedDataset.accessionNumber}
        </div>
      )}
      {selectedDataset.doi && (
        <div className="mb-2">
          <span className="font-semibold">DOI: </span>
          <a
            href={`https://doi.org/${selectedDataset.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {selectedDataset.doi}
          </a>
        </div>
      )}
      {selectedDataset.license && (
        <div className="mb-2">
          <span className="font-semibold">License: </span>
          {selectedDataset.license}
        </div>
      )}
      <button
        type="button"
        className="absolute top-4 right-4 px-3 py-1 border rounded bg-blue-500 text-white hover:bg-blue-600"
        onClick={onAnnotate}
      >
        Annotate
      </button>
    </div>
  )
}
