# Dynamic LMS

A modern, full-featured Learning Management System (LMS) built with Next.js and Supabase. This platform provides separate interfaces for students and professors, enabling seamless course management, content delivery, and student tracking.

## Features

### For Students
- **Dashboard**: Overview of enrolled courses with progress tracking
- **Course Management**: Browse and access all enrolled courses
- **Course Content**: Access lessons organized by categories (Prelim, Midterm, Finals)
- **Assignments**: View and submit course assignments
- **Quizzes**: Take quizzes and assessments
- **Grades**: Track academic performance and grades
- **Progress Tracking**: Visual progress indicators for each course
- **Profile Management**: Update personal information

### For Professors
- **Dashboard**: Overview of teaching courses and materials
- **Course Management**: Create and manage multiple courses
- **Classlist Management**: View and manage enrolled students
- **Content Management**: Create and organize course content by categories
- **Assignment Management**: Create and manage assignments
- **Quiz Management**: Create and manage quizzes
- **Assessment Bank**: Centralized repository for assessments
- **Student Tracking**: Monitor student progress and engagement
- **Profile Management**: Update professor profile information

### General Features
- **Role-Based Access Control**: Separate interfaces for students and professors
- **Secure Authentication**: Login and signup with Supabase authentication
- **Modern UI/UX**: Beautiful, responsive design with gradient themes
- **Real-time Updates**: Built with Next.js for optimal performance

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

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dynamic-lms
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure
