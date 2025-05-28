import type { NextApiRequest, NextApiResponse } from 'next'

type Payload = { text: string }

type ExtractResult = {
  keywords: string[]
  inclusionTerms: string[]
  exclusionTerms: string[]
}

// This mock handler lives at /api/extract-annotations
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ result?: ExtractResult; error?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { text } = req.body as Payload
    const words = text.trim().split(/\s+/)
    const result: ExtractResult = {
      keywords: words.slice(0, 3),
      inclusionTerms: words.slice(3, 5),
      exclusionTerms: words.slice(5, 7),
    }
    return res.status(200).json({ result })
  } catch (err: any) {
    console.error('Extraction error:', err)
    return res.status(500).json({ error: 'Extraction failed' })
  }
}
