import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { Category, Dataset } from '../../types'

type Payload = {
  datasetId: string
  keywords: string[]
  inclusionTerms: string[]
  exclusionTerms: string[]
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const { datasetId, keywords, inclusionTerms, exclusionTerms } =
    req.body as Payload

  // Load the JSON file
  const dataPath = path.join(process.cwd(), 'data', 'sampleData.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const categories = JSON.parse(raw) as Category[]

  // Recursively update the right dataset
  const recurse = (cats: Category[]): Category[] =>
    cats.map(cat => ({
      ...cat,
      datasets: cat.datasets.map(ds =>
        ds.id === datasetId
          ? { ...ds, keywords, inclusionTerms, exclusionTerms }
          : ds
      ),
      children: cat.children ? recurse(cat.children) : undefined,
    }))

  const updated = recurse(categories)

  // Write back
  fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2), 'utf-8')
  return res.status(200).json({ success: true })
}
