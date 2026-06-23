import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    rewritten: { type: String },
    feedback: { type: String, enum: ['up', 'down', null], default: null },
    followUps: { type: [String], default: [] },
    sources: [
      {
        n: { type: Number },
        documentId: { type: String },
        filename: { type: String },
        chunkIndex: { type: Number },
        score: { type: Number },
        snippet: { type: String },
      },
    ],
  },
  { timestamps: true }
)

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, default: 'New Chat' },
    tags: { type: [String], default: [] },
    messages: [messageSchema],
    selectedDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true }
)

export const Conversation = mongoose.model('Conversation', conversationSchema)
