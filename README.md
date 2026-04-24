# Dynamic LMS

A modern Learning Management System (LMS) built with Next.js and Supabase. This platform provides separate interfaces for students and professors, enabling course management, content delivery, and engagement through interactive study aids powered by Generative Artificial Intelligence

## Features

### For Students
- **Dashboard**: Overview of enrolled courses with upcoming assignments and quizzes
- **Course Access**: Browse and access all enrolled courses
- **Course Content**: Access lessons organized by categories (Prelim, Midterm, Finals)
- **Study Aids**: Interactive study tools including:
  - Validated AI-generated flashcards, multiple-choice questions, and fill-in-the-blank questions
  - Custom student-created flashcards for each lesson
- **Assignments**: View course assignments
- **Quizzes**: Take quizzes and track attempt history
- **Grades**: Track course grades and performance
- **Announcements**: View course announcements
- **Profile Management**: Update personal information

### For Professors
- **Dashboard**: Overview of teaching courses with quick stats
- **Course Management**: Manage courses (admin-assigned)
- **Content Management**: 
  - Create and organize lessons by categories (Prelim, Midterm, Finals)
  - Upload PDF materials for each lesson
- **Study Aid Generation**: Generate AI-powered study materials:
  - Multiple-choice questions
  - Fill-in-the-blank questions
  - Flashcards and summaries
- **Assignment Management**: Create and manage course assignments
- **Quiz Management**: Create and manage course quizzes
- **Class Management**: View enrolled students
- **Announcements**: Post course announcements
- **Profile Management**: Update professor profile information

### For Admin
- **Dashboard**: Overview of active courses, professors, and students
- **Course Management**: Create, edit, and delete courses; assign professors
- **Professor Management**: Create and manage professor accounts
- **Student Management**: Manage student accounts and enrollments
- **Enrollment Management**: Add/remove student enrollments

### General Features
- **Role-Based Access Control**: Separate secure interfaces for students, professors, and admins
- **Secure Authentication**: Login and signup with Supabase authentication
- **AI-Powered Study Tools**: Gemini AI integration for generating study materials
- **Modern UI/UX**: Clean, intuitive interface with easy navigation
- **PDF Lesson Materials**: Upload and access lesson PDFs

## Tech Stack

- **Framework**: [Next.js 16.0.1](https://nextjs.org/) (React 19.2.0)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: [Supabase](https://supabase.com/)
  - Authentication
  - Database
  - Server-side rendering support
- **Deployment**: Ready for Vercel deployment

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.x or higher
- npm or yarn package manager
- A Supabase account (for backend services)
