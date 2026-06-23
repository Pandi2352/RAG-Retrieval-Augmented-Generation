import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB.')

    const ChunkSchema = new mongoose.Schema({
      documentId: mongoose.Schema.Types.ObjectId,
      text: String
    })
    const Chunk = mongoose.model('Chunk', ChunkSchema)

    const chunks = await Chunk.find({ documentId: new mongoose.Types.ObjectId('6a3a3c6006daa73572583034') })
    console.log(`Found ${chunks.length} chunks. Texts:`)
    chunks.forEach((c, idx) => {
      console.log(`\n--- Chunk ${idx + 1} ---`)
      console.log(c.text)
    })
  } catch (err) {
    console.error(err)
  } finally {
    await mongoose.disconnect()
  }
}

run()
