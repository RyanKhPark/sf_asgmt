# PDF Chat Application

A modern PDF analysis and conversation platform that allows users to upload PDFs and interact with them through an AI-powered chat interface. Built with Next.js 14 and featuring voice conversation capabilities.

## 🚀 Features

### Core Functionality
- **PDF Upload & Processing**: Drag-and-drop or file upload interface for PDF documents
- **AI-Powered Chat**: Conversational interface to ask questions about uploaded PDFs
- **Smart Text Extraction**: Automatic text extraction and processing from PDF documents
- **Real-time Highlighting**: AI automatically highlights relevant sections while answering questions

### Voice Features
- **Voice Conversation Mode**: Toggle voice input/output for hands-free interaction
- **Smart Speech Recognition**: Automatic sentence detection and submission
- **Text-to-Speech**: AI responses are read aloud using browser's speech synthesis
- **Real-time Transcription**: Live display of speech-to-text conversion

### User Experience
- **Authentication**: Secure user authentication with NextAuth.js (Google OAuth + email/password)
- **Chat History**: Persistent conversation history for each document
- **Document Management**: View and manage uploaded documents
- **Responsive Design**: Mobile-friendly interface with modern UI components

### Advanced Features
- **PDF Annotation System**: Highlight and annotate PDF content
- **Message-Highlight Linking**: Connect AI responses to specific PDF sections
- **Multi-page Support**: Handle complex, multi-page documents
- **Real-time Updates**: Live chat updates and status indicators

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Modern icon library
- **Sonner** - Toast notifications

### Backend & Database
- **Next.js API Routes** - Server-side API endpoints
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Primary database
- **Vercel Blob** - File storage solution

### AI & Voice
- **Anthropic Claude** - Primary AI model for PDF analysis
- **Google Gemini** - Alternative AI model
- **Web Speech API** - Browser-native speech recognition
- **Browser Speech Synthesis** - Text-to-speech functionality

### Authentication & Security
- **NextAuth.js 5** - Authentication framework
- **Google OAuth** - Social authentication
- **bcrypt.js** - Password hashing
- **Zod** - Runtime type validation

### PDF Processing
- **PDF.js** - Client-side PDF rendering and interaction
- **pdf-parse** - Server-side PDF text extraction

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth credentials (optional, for social login)
- Anthropic API key for AI functionality

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd studyfetch-assignment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Fill in your environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/pdfchat_db"

   # Authentication
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # AI Services
   ANTHROPIC_API_KEY=your-anthropic-api-key
   GEMINI_API_KEY=your-gemini-api-key

   # File Storage
   BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📝 Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio
- `npm run db:reset` - Reset database
- `npm run db:seed` - Seed database with initial data

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router
│   ├── (main)/            # Main application routes
│   │   ├── page.tsx       # Home page (PDF upload)
│   │   ├── history/       # Document history page
│   │   └── pdfchat/       # PDF chat interface
│   └── api/               # API routes
│       ├── auth/          # Authentication endpoints
│       ├── chat/          # Chat functionality
│       ├── documents/     # Document management
│       └── annotations/   # PDF annotation system
├── components/            # Reusable React components
│   ├── auth/             # Authentication components
│   ├── chat/             # Chat-related components
│   ├── pdf/              # PDF viewer and chat
│   └── ui/               # Base UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── prisma/               # Database schema and migrations
├── providers/            # Context providers
├── types/                # TypeScript type definitions
└── services/             # External service integrations
```

## 🎯 Usage Guide

### Uploading a PDF
1. Visit the home page
2. Either drag-and-drop a PDF file or click "Upload" to select one
3. Click "Let's Chat!" to process and open the document

### Voice Conversation
1. In the chat interface, click the microphone button to enable voice mode
2. Start speaking - the system will automatically detect when you finish
3. AI responses will be read aloud automatically
4. Click the microphone button again to disable voice mode

### PDF Interaction
- Ask questions about the document content
- View automatic highlights generated by AI responses
- Navigate through different pages of the PDF
- Access conversation history for each document

## 🔧 Configuration

### AI Models
The application supports multiple AI providers:
- **Anthropic Claude** (primary)
- **Google Gemini** (fallback)

Configure API keys in your `.env` file to enable AI functionality.

### Voice Features
Voice functionality uses browser-native APIs:
- **Speech Recognition**: Web Speech API
- **Text-to-Speech**: Speech Synthesis API

### File Storage
Uses Vercel Blob for file storage. Set up your `BLOB_READ_WRITE_TOKEN` in the environment variables.

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy automatically

### Manual Deployment
1. Build the application: `npm run build`
2. Set up PostgreSQL database
3. Configure environment variables
4. Run: `npm run dev`