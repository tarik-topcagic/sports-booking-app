# 🏟️ Sports Facility Booking App

A full-stack web application for managing sports groups, memberships, real-time communication, arena browsing, and time slot booking for sports facilities — including a full admin panel for platform management.

⚠️ **Note:** This is a completed portfolio project, built to demonstrate full-stack development skills. All core features are implemented, including group management, real-time messaging, arena browsing, reservations, and a mock/simulated payment flow — no real payments are processed or real card data stored.

---

## 🌐 Live Demo

- **Frontend:** https://sport-booking-app.netlify.app/
- **Backend API / Swagger:** https://sports-booking-app.up.railway.app/swagger

### Demo Access

You can explore the application by registering a new account or by using one of the existing demo accounts below.

**Regular user** (browse arenas, book reservations, join groups, chat):
```text
Username: Tarik
Password: z@Rekreaciju07
```

**Admin account** (access the admin panel — manage users, groups, arenas, reservations, and notifications):
```text
Username: Tarik
Password: z@Rekreaciju07
```

---

## 🚀 Technologies

### Backend
- ASP.NET Core (.NET 8)
- Entity Framework Core
- PostgreSQL
- REST API
- SignalR
- Railway

### Frontend
- Angular
- TypeScript
- Bootstrap
- SCSS
- Netlify

---

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication
- User registration and login
- Protected API endpoints
- Role-based authorization (Admin/User)

### 👥 Group Management
- Create, edit, and delete groups
- Add group photo, description, city, and sport category
- View group details
- View group members
- Admin can remove members from a group

### 📩 Invitations & Join Requests
- Admin can invite users to groups
- Users can accept or decline invitations
- Users can request to join groups
- Admin can accept or reject join requests
- Pending invitations/requests remain visible in the groups list

### 💬 Messaging System
- Private chat between users
- Group chat between group members
- Real-time messaging using SignalR
- Live typing indicator for private and group chat
- Delivered and seen message status tracking
- Message reply threading
- Emoji reactions on messages, synced in real time
- Message pinning (up to 5 pinned messages per chat)
- Unsend/delete messages, synced live for all participants
- Swipe-to-reply gesture support on mobile
- Optimistic message sending with automatic retry and failed-send indicators
- Message notifications without page refresh
- Separate chat inbox notifications for group and private messages

### 🔔 Notifications System
- Bell icon in the top-right navbar
- Persistent notifications stored in the database
- Mark notifications as read
- Live system notifications using SignalR
- Notifications for:
  - received group invitations
  - accepted invitations
  - join requests
  - accepted join requests
  - chat/message activity
  - message reactions
  - upcoming reservation reminders (1 hour and 30 minutes before)

### 🟢 User & Group Activity Status
- Real-time online/offline user activity status
- Group activity status based on member presence
- Live presence updates without page refresh

### 👤 User Profiles
- View and edit user profiles
- Navigate to profile pages
- Display user information and profile photo
- Access messaging options from user-related views

### 📊 Group Members
- Popup displaying group members
- Admin highlighted
- Actions:
  - View profile
  - Send message
- Admin can remove members

### 🚪 Membership Management
- Leave group functionality
- Confirmation dialogs for important actions

### 🏟️ Sports Arenas
- Browse available sports arenas
- Arena details page with dynamic availability calendar
- Arena filtering by city and sport
- Arena image gallery
- Favorite/save arenas
- Responsive arena details view

### 📅 Reservations
- Book time slots for arenas, with variable duration (1h / 1.5h / 2h)
- Real-time availability calendar reflecting actual bookings
- Cancel existing reservations
- View upcoming and past reservations
- Reservation reminder notifications

### 💳 Payment (Simulated)
- Mock payment flow with card-style input and client-side validation (Luhn check, expiry, CVV)
- Simulated payment processing with randomized success/decline outcomes, for demo purposes
- **No real payment processing occurs and no real card data is stored or transmitted** — only the last 4 digits are retained, for display purposes only

### 🛠️ Admin Panel
- Role-based access, restricted to Admin users
- User management (view, lock/unlock accounts)
- Group management (view, edit, delete, remove members)
- Arena management (create, edit, delete, image upload)
- Reservation oversight (view all, cancel on behalf of users)
- Notification management (view, delete)
- Server-side filtering and search across all admin tables
- Full dark mode support

### 📱 Navigation
- Top navbar with notifications and profile access
- Bottom navbar displaying the user's groups
- Horizontally scrollable group navigation
- Fixed bottom navigation with smooth loading animation
- Lazy-loaded routes for faster initial load
- Skeleton loading states across all major pages

---

## 🏗️ Project Structure

```text
SportsBookingApp/
│
├── frontend/              # Angular application
│   ├── src/app/
│   ├── services/
│   ├── components/
│
├── SportsBookingAPI/    # ASP.NET Core backend
│   ├── Controllers/
│   ├── Models/
│   ├── DTOs/
│   ├── Repositories/
│   ├── Migrations/
│
├── SportsBookingAPI.sln
└── .gitignore
```

---

## ⚙️ Getting Started

### 🔧 Backend

```bash
cd SportsBookingAPI
dotnet restore
dotnet ef database update
dotnet run
```

### 🎨 Frontend

```bash
cd frontend
npm install
npm start
```

### 🗄️ Database

```bash
dotnet ef database update
```

---

## 📄 License

This project was developed for educational and portfolio purposes.
