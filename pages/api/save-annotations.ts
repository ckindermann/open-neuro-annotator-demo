// pages/api/save-annotations.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { Dataset, Annotation } from '../../types'

type Payload = {
  datasetId: string
  keywords: Annotation[]
  inclusionTerms: Annotation[]
  exclusionTerms: Annotation[]
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { datasetId, keywords, inclusionTerms, exclusionTerms } =
    req.body as Payload

  const dataPath = path.join(process.cwd(), 'data', 'datasets.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const datasets = JSON.parse(raw) as Dataset[]

  const updated = datasets.map(ds =>
    ds.id === datasetId
      ? { ...ds, keywords, inclusionTerms, exclusionTerms }
      : ds
  )

  fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2), 'utf-8')
  res.status(200).json({ success: true })
}
