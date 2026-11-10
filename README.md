# ✂️ BookMySalon – Salon Booking Platform

BookMySalon is a full-stack salon booking platform that connects customers with salons and simplifies appointment management. Customers can discover salons, explore services, check available time slots, select workers and book appointments online.

The platform provides dedicated dashboards for customers, salon owners, workers and super admins to manage bookings, salons, services, payments and daily operations efficiently.

## 🚀 Features

### 👤 Customer Module

- Customer registration and login
- JWT-based authentication
- Google OAuth authentication
- Browse and search salons
- View salon details, branches and facilities
- Explore services, pricing and offers
- View worker profiles
- Check real-time slot availability
- Book appointments
- Select preferred workers
- Online payment using Razorpay
- Pay at Salon option
- Wallet payment
- Booking cancellation and refund management
- Customer wallet and transaction history
- Booking history and status tracking
- Service reviews and ratings
- Notifications
- Download service receipts

### 🏪 Salon Owner Module

- Salon owner registration and login
- Create and manage multiple salons and branches
- Admin approval workflow for new salons
- Manage salon information and facilities
- Add, update and delete services
- Manage service pricing and duration
- Add and manage workers
- Manage worker schedules and availability
- View and manage appointments
- Accept and manage bookings
- Booking cancellation management
- Create and manage promotional offers
- Manage service-specific and combo offers
- View customer reviews and ratings
- Sales and business analytics
- Subscription management
- Support ticket creation and tracking
- Notifications

### 💇 Worker Module

- Worker authentication
- Dedicated worker dashboard
- View assigned bookings
- View appointment details
- Check customer information
- View service details and appointment timings
- Track booking status
- Manage assigned appointments

### 🛡️ Super Admin Module

- Admin authentication
- Dashboard and platform analytics
- Customer management
- Salon management
- Approve or reject salon registrations
- Block and unblock customers and salons
- Manage existing bookings
- Subscription plan management
- Manage salon subscriptions and payments
- First-month free subscription after salon approval
- View platform-wide reviews and ratings
- Support ticket management
- Reply to salon support tickets
- Monitor platform activities

### 💳 Payment & Financial Management

- Razorpay payment integration
- Pay at Salon payment option
- Wallet payment system
- Booking cancellation refund management
- Automatic wallet refunds for eligible online bookings
- Wallet transaction history
- Payment status tracking
- Service receipt generation

### 🎟️ Offers & Promotions

- Service-specific offers
- First-booking offers
- Coupon-based discounts
- Combo offers
- Percentage-based discounts
- Fixed-amount discounts
- Minimum booking amount
- Maximum discount limit
- Offer validity and usage limits
- Branch-specific offers

### 🔔 Notification & Support

- Booking notifications
- Booking status updates
- Payment notifications
- Salon notifications
- Support ticket system
- Admin-to-salon communication

## 🛠️ Technologies Used

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- Django ORM
- Redis
- Celery
- Django Channels / WebSockets (real-time communication)

### Frontend

- React.js
- Vite
- Redux Toolkit
- React Router
- Tailwind CSS
- Axios
- JavaScript

### Authentication & Payment

- JWT Authentication
- Google OAuth
- Razorpay Payment Gateway

### Infrastructure & Tools

- Git & GitHub
- AWS EC2
- Nginx
- Gunicorn
- Cloudinary
- Linux / Ubuntu
- Environment Variables (.env)

## 📁 Project Structure

```text
BookMySalon/
│
├── backend/
│   ├── accounts/
│   ├── salons/
│   ├── services/
│   ├── workers/
│   ├── bookings/
│   ├── payments/
│   ├── wallet/
│   ├── subscriptions/
│   ├── offers/
│   ├── coupons/
│   ├── notifications/
│   ├── reviews/
│   ├── receipts/
│   ├── dashboard/
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   └── assets/
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

*Note: Update the folder names to match your actual project structure.*

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/BookMySalon.git

cd BookMySalon
```

### 2. Backend Setup

```bash
cd backend

python -m venv venv
```

Activate virtual environment:

**Linux / macOS**

```bash
source venv/bin/activate
```

**Windows**

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file inside the backend directory.

```env
SECRET_KEY=your_django_secret_key
DEBUG=True

DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=localhost
DB_PORT=5432

RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Configure additional environment variables according to your project settings.

### 4. Database Migration

```bash
python manage.py makemigrations

python manage.py migrate
```

Create a superuser:

```bash
python manage.py createsuperuser
```

Run the backend server:

```bash
python manage.py runserver
```

Backend runs at:

`http://127.0.0.1:8000/`

### 5. Frontend Setup

Open another terminal:

```bash
cd frontend

npm install
```

Start the development server:

```bash
npm run dev
```

Frontend runs at:

`http://localhost:5173/`

## 🔄 Application Workflow

1. Customers register and log in to the platform.
2. Customers browse approved salons and their branches.
3. Customers explore services, offers and available workers.
4. Customers select a service, date and available time slot.
5. Customers choose a payment method and confirm the booking.
6. Salon owners receive booking updates and manage appointments.
7. Workers view their assigned appointments.
8. Customers can track bookings, cancel appointments and receive eligible refunds.
9. Salon owners manage their business through their dashboard.
10. Super admins manage the entire platform.

## 💰 Subscription Model

BookMySalon follows a subscription-based business model for salon owners.

- Monthly subscription
- Six-month subscription
- Yearly subscription
- Flexible subscription plan management
- First month free after salon approval
- Subscription renewal and expiry management

## 🔐 Security

- JWT-based authentication
- Role-based access control
- Protected API endpoints
- Secure password handling
- Environment-based secret management
- Payment verification
- Server-side booking validation

## 🌐 Deployment

The application is designed for deployment using:

- AWS EC2 – Application hosting
- Nginx – Reverse proxy
- Gunicorn – Django application server
- PostgreSQL – Database
- Cloudinary – Media storage
- Redis – Caching and background task support
- Celery – Asynchronous task processing

## 🎯 Project Objective

The main objective of BookMySalon is to simplify salon appointment booking and salon business management through a centralized digital platform.

It aims to reduce manual appointment management, improve customer convenience, help salon owners manage their operations and provide a better booking experience.

## 👨‍💻 Developer

**Developed as a Full-Stack Web Development Project.**

Technologies: Python | Django | React | PostgreSQL

---

⭐ If you find this project interesting, feel free to explore the repository!
