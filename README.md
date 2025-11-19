# DMM - Debrid Media Manager

<div align="center">

![DMM Logo](https://via.placeholder.com/150x50/4F46E5/FFFFFF?text=DMM)

**A modern, powerful media management application for Real-Debrid users**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECFFD?style=for-the-badge&logo=supabase&logoColor=black)](https://supabase.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[Documentation](./DEVELOPMENT.md) • [Tech Stack](./Tech-Stack-and-Feature-Components.md) • [Report Bug](https://github.com/your-username/dmm/issues) • [Request Feature](https://github.com/your-username/dmm/issues)

</div>

## ✨ Features

### 🗂️ **Virtual Folder System**

- Create unlimited virtual folders to organize your Real-Debrid files
- Hierarchical folder structure with drag-and-drop support
- Instant navigation with breadcrumb trails
- Performance optimized for thousands of files

### 🏷️ **Smart File Management**

- **Virtual File Naming**: Rename files without changing originals
- **Inline Editing**: F2 keyboard shortcuts and right-click menus
- **Bulk Operations**: Select and organize multiple files at once
- **Conflict Resolution**: Smart handling of duplicate names

### 🔍 **Advanced Search & Filtering**

- Real-time search across file names and metadata
- Filter by file type, size, and date ranges
- Sort by name, size, modified date, or custom criteria
- Search within virtual folders or entire library

### 🔄 **Real-Time Synchronization**

- Automatic sync with Real-Debrid account
- Real-time updates when files change
- Intelligent caching for fast performance
- Connection health monitoring

### ⌨️ **Power User Features**

- Full keyboard navigation support
- Advanced drag-and-drop with visual feedback
- Context menus for quick actions
- Customizable keyboard shortcuts

### 📱 **Responsive Design**

- Mobile-friendly interface
- Touch-optimized interactions
- Progressive Web App capabilities
- Offline support for cached content

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Real-Debrid account

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/dmm.git
cd dmm

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configuration (see below)

# Install git hooks
npm run prepare

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Real-Debrid OAuth2
REAL_DEBRID_CLIENT_ID=your_client_id
REAL_DEBRID_CLIENT_SECRET=your_client_secret
REAL_DEBRID_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

### Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Supabase (PostgreSQL 15), Real-Debrid API
- **Styling**: Tailwind CSS, shadcn/ui components
- **State Management**: Zustand, React Query (TanStack Query)
- **Authentication**: Supabase Auth with OAuth2
- **Testing**: Vitest, React Testing Library, Playwright

### Key Features Implementation

| Feature               | Technology                 | Performance          |
| --------------------- | -------------------------- | -------------------- |
| **Virtual Folders**   | Supabase DB + Zustand      | <200ms navigation    |
| **Search**            | React Query + Debouncing   | <300ms response      |
| **Drag & Drop**       | React DnD + HTML5 API      | 60fps performance    |
| **File Sync**         | Real-Debrid API + Webhooks | Real-time updates    |
| **Virtual Scrolling** | React Window               | 1000+ items smoothly |

## 📖 Documentation

### For Developers

- **[Development Guide](./DEVELOPMENT.md)** - Complete setup and development workflow
- **[Tech Stack & Components](./Tech-Stack-and-Feature-Components.md)** - Detailed technology overview
- **[Future Evolution Workflow](../BMAD-Future-Evolution-Workflow.md)** - Adding new features safely

### API Documentation

- API endpoints documentation in `/docs/api/`
- Database schema in Supabase migrations
- Component documentation in `/docs/components/`

## 🧪 Testing

```bash
# Run all tests
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📦 Build & Deployment

### Local Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Deployment

The application is optimized for deployment on:

- **Vercel** (Recommended) - Zero-config deployment
- **Netlify** - Static site generation support
- **Railway** - Full-stack deployment
- **DigitalOcean** - Docker deployment

```bash
# Deploy to Vercel
npm run deploy:vercel

# Prepare for any deployment
npm run prepare-release
```

## 🎯 Roadmap

### Current Release (v1.0)

- ✅ Virtual folder system
- ✅ File organization and naming
- ✅ Real-Debrid integration
- ✅ Search and filtering
- ✅ Responsive design

### Upcoming Features

- 🔄 File sharing and collaboration
- 📊 Advanced analytics and reporting
- 🎨 Custom themes and UI personalization
- 📱 Native mobile applications
- 🔌 Third-party integrations

See [Issues](https://github.com/your-username/dmm/issues) for detailed feature planning.

## 🤝 Contributing

We welcome contributions of all kinds! Please see our [Development Guide](./DEVELOPMENT.md) for detailed instructions.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Requirements

- All code must pass quality checks: `npm run quality-check`
- Tests must pass with minimum 80% coverage
- Follow the established code style and conventions
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Real-Debrid](https://real-debrid.com/)** - For providing the excellent API
- **[Supabase](https://supabase.com/)** - For the amazing backend services
- **[Vercel](https://vercel.com/)** - For the deployment platform
- **[Next.js Team](https://nextjs.org/)** - For the incredible framework
- **[shadcn/ui](https://ui.shadcn.com/)** - For the beautiful component library

## 📞 Support

- **Documentation**: Check our [Development Guide](./DEVELOPMENT.md)
- **Issues**: [Report bugs or request features](https://github.com/your-username/dmm/issues)
- **Discussions**: [Join community discussions](https://github.com/your-username/dmm/discussions)
- **Email**: [your-email@example.com](mailto:your-email@example.com)

---

<div align="center">

**Built with ❤️ by the DMM Team**

[⭐ Star this repo](https://github.com/your-username/dmm) • [🐛 Report Issue](https://github.com/your-username/dmm/issues) • [💡 Request Feature](https://github.com/your-username/dmm/issues)

</div>
