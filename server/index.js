import app from './app.js'

const port = Number(process.env.PORT) || 3001

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Inventory API listening on http://127.0.0.1:${port}`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process, then run npm run dev again.`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
