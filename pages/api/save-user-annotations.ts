import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const { user, annotations, text } = req.body
  if (!user || !annotations) {
    return res.status(400).json({ error: 'Missing user or annotations' })
  }
  const userDir = path.join(process.cwd(), 'data', 'user', user)
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true })
  }
  const filePath = path.join(userDir, 'annotations.json')
  fs.writeFileSync(filePath, JSON.stringify(annotations, null, 2), 'utf-8')
  if (typeof text === 'string') {
    const textPath = path.join(userDir, 'text.txt')
    fs.writeFileSync(textPath, text, 'utf-8')
  }
  res.status(200).json({ success: true })
} 