import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Full path to your script
  const scriptPath = path.join(process.cwd(), 'extract_annotations.py')

  // Wrap in a promise so Next.js waits for it
  await new Promise<void>((resolve) => {
    const py = spawn('python3', [scriptPath])
    let stdoutData = ''
    let stderrData = ''

    py.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString()
    })
    py.stderr.on('data', (chunk) => {
      stderrData += chunk.toString()
    })

    py.on('close', (code) => {
      if (code !== 0) {
        console.error('Python exited', code, stderrData)
        res.status(500).json({ result: [] })
        return resolve()
      }
      try {
        const parsed = JSON.parse(stdoutData)
        res.status(200).json(parsed)
      } catch (err) {
        console.error('Invalid JSON:', err, stdoutData)
        res.status(500).json({ result: [] })
      }
      resolve()
    })

    // Send the JSON body to the Python script
    py.stdin.write(JSON.stringify(req.body))
    py.stdin.end()
  })
}
