import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    // ── Core Job Info ────────────────────────────────────────────────────────
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    jobTitle: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters'],
    },
    jobDescription: {
      type: String,
      trim: true,
      default: null,
      // Stored as full text — used by ATS Analyzer in Phase 5
    },

    // ── Application Status Pipeline ──────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: [
          'applied',
          'phone_screen',
          'technical',
          'interview',
          'offer',
          'rejected',
          'withdrawn',
        ],
        message: 'Invalid status value',
      },
      default: 'applied',
    },

    // ── Dates ────────────────────────────────────────────────────────────────
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    followUpDate: {
      type: Date,
      default: null,
    },

    // ── Compensation ─────────────────────────────────────────────────────────
    salaryMin: {
      type: Number,
      default: null,
      min: [0, 'Salary cannot be negative'],
    },
    salaryMax: {
      type: Number,
      default: null,
      min: [0, 'Salary cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      uppercase: true,
      maxlength: [5, 'Currency code too long'],
    },

    // ── Location ─────────────────────────────────────────────────────────────
    location: {
      type: String,
      trim: true,
      default: null,
    },
    remote: {
      type: Boolean,
      default: false,
    },

    // ── Meta / Tracking ──────────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [5000, 'Notes cannot exceed 5000 characters'],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'Cannot add more than 20 tags',
      },
    },
    source: {
      type: String,
      enum: {
        values: ['LinkedIn', 'Indeed', 'Referral', 'Company Website', 'Glassdoor', 'Other'],
        message: 'Invalid source value',
      },
      default: 'Other',
    },

    // ── ATS Fields (populated in Phase 5) ───────────────────────────────────
    atsScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    atsKeywordsMatched: {
      type: [String],
      default: [],
    },
    atsKeywordGaps: {
      type: [String],
      default: [],
    },

    // ── Soft Delete ──────────────────────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
jobSchema.index({ userId: 1, appliedDate: -1, _id: -1 }); // primary listing index
jobSchema.index({ userId: 1, status: 1 });                 // status filter
jobSchema.index({ userId: 1, tags: 1 });                   // tag filter
jobSchema.index({ userId: 1, deletedAt: 1 });              // soft delete filter
jobSchema.index(                                            // text search
  { companyName: 'text', jobTitle: 'text' },
  { weights: { jobTitle: 3, companyName: 2 }, name: 'job_text_search' }
);

const Job = mongoose.model('Job', jobSchema);
export default Job;
