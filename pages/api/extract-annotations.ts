import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ error: 'Method Not Allowed' })
    }

    console.log('Starting annotation extraction...')
    
    // Full path to your script
    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_annotations.py')

    // Wrap in a promise with timeout
    await new Promise<void>((resolve, reject) => {
      let responseSent = false
      
      const py = spawn('python3.11', [scriptPath])
      let stdoutData = ''
      let stderrData = ''

      // Set timeout to 2 minutes
      const timeout = setTimeout(() => {
        if (!responseSent) {
          console.error('Python script timed out after 2 minutes')
          py.kill('SIGTERM')
          res.status(500).json({ error: 'Script timed out', result: [] })
          responseSent = true
        }
        resolve()
      }, 120000)

      py.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString()
      })

      py.stderr.on('data', (chunk) => {
        stderrData += chunk.toString()
        console.log('Python stderr:', chunk.toString())
      })

      py.on('close', (code) => {
        clearTimeout(timeout)
        console.log('Python script finished with code:', code)
        console.log('stdout length:', stdoutData.length)
        console.log('stdout preview:', stdoutData.substring(0, 200))
        
        if (responseSent) return resolve()
        
        if (code !== 0) {
          console.error('Python exited with error code:', code)
          console.error('stderr:', stderrData)
          res.status(500).json({ error: 'Python script failed', stderr: stderrData, result: [] })
          responseSent = true
          return resolve()
        }
        
        try {
          console.log('Parsing JSON response...')
          
          // Extract JSON from stdout (filter out log messages)
          const jsonMatch = stdoutData.match(/\{[^{}]*"result"[^{}]*\[[\s\S]*?\][^{}]*\}/)
          if (!jsonMatch) {
            console.error('No valid JSON found in stdout')
            console.error('stdout:', stdoutData)
            res.status(500).json({ error: 'No valid JSON found', stdout: stdoutData, result: [] })
            responseSent = true
            return resolve()
          }
          
          const jsonStr = jsonMatch[0]
          console.log('Extracted JSON:', jsonStr.substring(0, 200))
          
          const parsed = JSON.parse(jsonStr)
          console.log('Successfully parsed response with', parsed.result?.length || 0, 'annotations')
          console.log('Response structure:', Object.keys(parsed))
          
          // Check if response has the expected structure
          if (!parsed.result || !Array.isArray(parsed.result)) {
            console.error('Invalid response structure - missing or invalid result array')
            res.status(500).json({ error: 'Invalid response structure', result: [] })
            responseSent = true
            return resolve()
          }
          
          console.log('Sending successful response...')
          res.status(200).json(parsed)
          console.log('Response sent successfully')
          responseSent = true
        } catch (err) {
          console.error('Invalid JSON:', err)
          console.error('stdout:', stdoutData)
          res.status(500).json({ error: 'Invalid JSON response', stdout: stdoutData, result: [] })
          responseSent = true
        }
        resolve()
      })

      py.on('error', (err) => {
        clearTimeout(timeout)
        if (!responseSent) {
          console.error('Failed to start Python script:', err)
          res.status(500).json({ error: 'Failed to start script', result: [] })
          responseSent = true
        }
        resolve()
      })

      // Send the JSON body to the Python script
      console.log('Sending request to Python script...')
      py.stdin.write(JSON.stringify(req.body))
      py.stdin.end()
    })
  } catch (error) {
    console.error('Unexpected error in handler:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unexpected server error', result: [] })
    }
  }
}
