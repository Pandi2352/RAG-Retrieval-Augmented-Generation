import mongoose from 'mongoose'

// We keep the chunk text in Mongo (source of truth for citations) and the
// vector in Qdrant. The Qdrant point id === this chunk's `_id` string.
const chunkSchema = new mongoose.Schema(
  {
    _id: { type: String }, // uuid, shared with the Qdrant point id
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', index: true },
    filename: { type: String },
    chunkIndex: { type: Number },
    text: { type: String, required: true },
  },
  { timestamps: true, _id: false }
)

export const Chunk = mongoose.model('Chunk', chunkSchema)
