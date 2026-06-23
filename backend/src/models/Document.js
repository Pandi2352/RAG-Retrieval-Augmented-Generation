import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    source: { type: String, enum: ['upload', 'web'], default: 'upload' },
    sourceUrl: { type: String },
    skippedUrls: {
      type: [{ _id: false, url: { type: String }, reason: { type: String } }],
      default: [],
    },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
    statusStep: { type: String, default: 'Initializing...' },
    suggestedQuestions: { type: [String], default: [] },
    keyDates: {
      type: [
        {
          _id: false,
          label: { type: String },
          date: { type: String },
          type: { type: String },
        },
      ],
      default: [],
    },
    chunkCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
)

export const Document = mongoose.model('Document', documentSchema)
