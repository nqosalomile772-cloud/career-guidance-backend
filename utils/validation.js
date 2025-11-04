const Joi = require('joi');

// User schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'institute', 'student', 'company').required()
});

const loginSchema = Joi.object({
  idToken: Joi.string().required()
});

// Institution schemas
const institutionSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  type: Joi.string().required(),
  description: Joi.string(),
  contact: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string(),
    address: Joi.string()
  })
});

// Faculty schemas
const facultySchema = Joi.object({
  institutionId: Joi.string().required(),
  faculty: Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    departments: Joi.array().items(Joi.string())
  }).required()
});

// Course schemas
const courseSchema = Joi.object({
  institutionId: Joi.string().required(),
  facultyName: Joi.string().required(),
  course: Joi.object({
    name: Joi.string().required(),
    code: Joi.string().required(),
    description: Joi.string(),
    duration: Joi.number(),
    requirements: Joi.object({
      minGPA: Joi.number().min(0).max(4),
      subjects: Joi.array().items(Joi.string()),
      certificates: Joi.array().items(Joi.string())
    })
  }).required()
});

// Application schemas
const applicationSchema = Joi.object({
  institutionId: Joi.string().required(),
  courseId: Joi.string().required(),
  docs: Joi.array().items(Joi.string())
});

// Job schemas
const jobSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  requirements: Joi.object({
    minGPA: Joi.number().min(0).max(4),
    experienceYears: Joi.number().min(0),
    certificates: Joi.array().items(Joi.string()),
    skills: Joi.array().items(Joi.string())
  }).required(),
  location: Joi.string().required(),
  salary: Joi.object({
    min: Joi.number(),
    max: Joi.number(),
    currency: Joi.string()
  }),
  type: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').required()
});

// Profile schema
const profileSchema = Joi.object({
  name: Joi.string(),
  phone: Joi.string(),
  address: Joi.string(),
  bio: Joi.string(),
  socialLinks: Joi.object({
    linkedin: Joi.string().uri(),
    twitter: Joi.string().uri(),
    website: Joi.string().uri()
  })
}).min(1); // At least one field must be provided

// Transcript schema
const transcriptSchema = Joi.object({
  gpa: Joi.number().min(0).max(4).required(),
  certificates: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    issuer: Joi.string().required(),
    date: Joi.date().required(),
    url: Joi.string().uri()
  })),
  workExperience: Joi.array().items(Joi.object({
    company: Joi.string().required(),
    position: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date(),
    description: Joi.string(),
    years: Joi.number().required()
  }))
});

module.exports = {
  registerSchema,
  loginSchema,
  institutionSchema,
  facultySchema,
  courseSchema,
  applicationSchema,
  jobSchema,
  profileSchema,
  transcriptSchema
};