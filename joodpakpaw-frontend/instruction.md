# Joodpakpaw Project Instruction

This document provides a comprehensive overview of the Joodpakpaw project, its structure, and how to get it up and running.

## Project Overview

Joodpakpaw is a web application built with Next.js, designed as a platform for browsing and managing pet-friendly properties. The name itself suggests a place for "paws" to rest. It features a mobile-first interface, allowing users to browse properties, manage their profiles, and for "hosts," to list and manage their own properties.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (v14) with App Router
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:**
  - [shadcn/ui](https://ui.shadcn.com/): A collection of re-usable components built on Radix UI (e.g., `carousel`, `button`, `input`, `card`, `dialog`, `spinner`).
  - [Lucide React](https://lucide.dev/): For icons.
  - [Sonner](https://sonner.emilkowal.ski/): For toast notifications.
- **Maps Integration:**
  - [Google Maps Static API](https://developers.google.com/maps/documentation/maps-static/overview): Used to display a static image of the property's location.
  - [Google Maps API](https://developers.google.com/maps): Used for the place autocompletion feature in search fields.
- **Linting & Formatting:**
  - [ESLint](https://eslint.org/)
  - [Prettier](https://prettier.io/)

## Getting Started

Follow these steps to set up and run the project on your local machine.

### Prerequisites

- Node.js (v20 or later recommended)
- npm or yarn

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd joodpakpaw
npm install
```

### 2. Environment Variables

The project requires a few environment variables to function correctly. Create a `.env.local` file in the root of the project and add the following:

```
# The base URL of the backend API
NEXT_PUBLIC_API_BASE_URL=http://your-api-backend-url.com

# Your Google Maps API key, required for the place autocomplete feature
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

### 3. Running the Development Server

Once the installation is complete and environment variables are set, you can run the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

The project follows the standard Next.js App Router structure. Here are some of the key directories:

- `/app`: Contains all the routes and UI of the application.
  - `/_components`: Global reusable components like the `BottomNav` and `AuthContext`.
  - `/(route-group)`: Different route groups for different sections of the app (e.g., `authen`, `profile`).
- `/lib`: Contains utility functions, API communication logic, and other core functionalities.
- `/components/ui`: Houses the `shadcn/ui` components.
- `/types`: Contains all TypeScript type definitions for the application, organized by feature.
- `/public`: For static assets like images and icons.

## Key Features

### Authentication

- **Sign Up, Sign In, Sign Out:** Standard user authentication flow.
- **OTP Verification:** Email verification using a one-time password.
- **Password Management:** Includes forgot and reset password functionality.
- **Auth Context:** The `app/_components/AuthContext.tsx` provides authentication state to the entire application.
- **Automatic Token Refresh:** The API client automatically handles refreshing expired JWTs, providing a seamless session management experience.

### Property Browsing

- **Property List:** The main page displays a list of available properties.
- **Property Details:** Clicking on a property leads to a detailed view with an image gallery, facilities, and location on a map.
- **Search:** A search bar is available to find properties.

### Host and Property Management

- **Host Role:** Users can become hosts to list their properties.
- **Add Property:** A multi-step form guides hosts through the process of adding a new property, including details, photos, and facilities.
- **Manage Properties:** Hosts can view and manage their listed properties, including activating or deactivating them.

## API and State Management

- **API Client:** All communication with the backend API is handled by a central `request` function in `lib/apiClient.ts`, which is used by the API functions in `lib/api.ts`.
- **State Management:** The application primarily uses React's built-in state management (`useState`, `useEffect`, `useContext`) for managing local and global state. The `AuthContext` and `ProfileContext` are examples of global state management.

## Available Scripts

Here are the scripts defined in `package.json`:

- `npm run dev`: Starts the development server.
- `npm run build`: Creates a production-ready build of the application.
- `npm run start`: Starts the production server.
- `npm run lint`: Lints the codebase for errors and style issues.
- `npm run format`: Formats the code using Prettier.
