
import { useState } from "react";

import "./LandingPage.css";

const services = [
    { name: "Haircut", icon: "✂️", description: "Fresh styles" },
    { name: "Hair Spa", icon: "🧖", description: "Relax & refresh" },
    { name: "Facial", icon: "✨", description: "Healthy glow" },
    { name: "Manicure", icon: "💅", description: "Nail care" },
    { name: "Massage", icon: "🌿", description: "Relaxation" },
];

const salons = [
    {
        id: 1,
        name: "Mira's Beauty Studio",
        category: "Hair & Beauty",
        location: "Thiruvananthapuram",
        rating: "4.8",
        price: "₹499",
        image:
            "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
    },
    {
        id: 2,
        name: "Glow & Grace",
        category: "Spa & Wellness",
        location: "Kowdiar",
        rating: "4.7",
        price: "₹699",
        image:
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    },
    {
        id: 3,
        name: "The Style Lounge",
        category: "Hair Studio",
        location: "Vellayambalam",
        rating: "4.9",
        price: "₹599",
        image:
            "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80",
    },
];

function Landingpage() {
    const [location, setLocation] = useState("");
    const [service, setService] = useState("");
    const [selectedService, setSelectedService] = useState("");
    const [selectedSalon, setSelectedSalon] = useState(null);
    const [showLogin, setShowLogin] = useState(false);

    const handleSearch = (event) => {
        event.preventDefault();
        document
            .getElementById("salons")
            ?.scrollIntoView({ behavior: "smooth" });
    };

    const chooseService = (name) => {
        setSelectedService(name);
        setService(name);
        document
            .getElementById("salons")
            ?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="min-h-screen bg-[#f6f3ed] text-[#26382f]">
            {/* Navbar */}
            <header className="border-b border-[#e5e1d8] bg-[#f6f3ed]/95">
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
                    <a href="#" className="flex items-center gap-2 text-xl font-bold">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#29453a] text-white">
                            ✂
                        </span>
                        BookMySalon
                    </a>

                    <div className="hidden items-center gap-8 text-sm text-[#68736c] md:flex">
                        <a href="#services" className="hover:text-[#29453a]">
                            Services
                        </a>
                        <a href="#salons" className="hover:text-[#29453a]">
                            Salons
                        </a>
                        <a href="#how-it-works" className="hover:text-[#29453a]">
                            How It Works
                        </a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowLogin(true)}
                            className="hidden text-sm font-medium sm:block"
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setShowLogin(true)}
                            className="rounded-full bg-[#29453a] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1e342a]"
                        >
                            Sign Up
                        </button>
                    </div>
                </nav>
            </header>

            <main>
                {/* Hero */}
                <section className="px-5 pb-20 pt-16 lg:px-10 lg:pt-24">
                    <div className="mx-auto max-w-4xl text-center">
                        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-[#718078]">
                            Your beauty, your way
                        </p>

                        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                            Find the perfect
                            <br />
                            <span className="text-[#718b7b]">salon near you</span>
                        </h1>

                        <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[#7b827d] sm:text-base">
                            Discover trusted salons, explore premium services, and book
                            your next self-care experience in just a few clicks.
                        </p>

                        <form
                            onSubmit={handleSearch}
                            className="mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-2xl border border-[#dddcd3] bg-white p-2 shadow-sm sm:flex-row"
                        >
                            <div className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left">
                                <span className="text-lg">⌖</span>
                                <div className="flex-1">
                                    <label className="block text-xs text-[#89918a]">
                                        Location
                                    </label>
                                    <input
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="Enter your location"
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-[#a3aaa4]"
                                    />
                                </div>
                            </div>

                            <div className="hidden w-px bg-[#e5e5df] sm:block" />

                            <div className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left">
                                <span className="text-lg">✂</span>
                                <div className="flex-1">
                                    <label className="block text-xs text-[#89918a]">
                                        Service
                                    </label>
                                    <select
                                        value={service}
                                        onChange={(e) => setService(e.target.value)}
                                        className="w-full bg-transparent text-sm outline-none"
                                    >
                                        <option value="">Any service</option>
                                        {services.map((item) => (
                                            <option key={item.name} value={item.name}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="rounded-xl bg-[#29453a] px-7 py-3 text-sm font-medium text-white transition hover:bg-[#1e342a]"
                            >
                                Search →
                            </button>
                        </form>
                    </div>
                </section>

                {/* Services */}
                <section id="services" className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
                    <div className="mb-7 flex items-end justify-between">
                        <div>
                            <p className="mb-2 text-xs uppercase tracking-widest text-[#8a948b]">
                                Explore our services
                            </p>
                            <h2 className="text-2xl font-semibold sm:text-3xl">
                                Popular Services
                            </h2>
                        </div>
                        <button
                            onClick={() => setService("")}
                            className="text-sm text-[#657a6d] hover:underline"
                        >
                            View all →
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {services.map((item) => (
                            <button
                                key={item.name}
                                onClick={() => chooseService(item.name)}
                                className={`rounded-2xl border p-5 text-center transition hover:-translate-y-1 hover:border-[#9caf9f] hover:shadow-sm ${selectedService === item.name
                                        ? "border-[#29453a] bg-[#e1e9df]"
                                        : "border-[#e7e4dc] bg-white"
                                    }`}
                            >
                                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eeeae2] text-3xl">
                                    {item.icon}
                                </span>
                                <h3 className="font-medium">{item.name}</h3>
                                <p className="mt-1 text-xs text-[#8b938d]">
                                    {item.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Salons */}
                <section id="salons" className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
                    <div className="mb-7 flex items-end justify-between">
                        <div>
                            <p className="mb-2 text-xs uppercase tracking-widest text-[#8a948b]">
                                Discover your next favorite
                            </p>
                            <h2 className="text-2xl font-semibold sm:text-3xl">
                                Nearby & Popular Salons
                            </h2>
                            {selectedService && (
                                <p className="mt-2 text-sm text-[#748078]">
                                    Showing salons for: {selectedService}
                                </p>
                            )}
                        </div>
                        <span className="hidden text-sm text-[#8b938d] sm:block">
                            {salons.length} salons
                        </span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                        {salons.map((salon) => (
                            <article
                                key={salon.id}
                                className="overflow-hidden rounded-2xl border border-[#e5e1d8] bg-white"
                            >
                                <div className="relative">
                                    <img
                                        src={salon.image}
                                        alt={salon.name}
                                        className="h-56 w-full object-cover"
                                    />
                                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium">
                                        ★ {salon.rating}
                                    </span>
                                </div>

                                <div className="p-5">
                                    <h3 className="text-lg font-semibold">{salon.name}</h3>
                                    <p className="mt-1 text-sm text-[#8a928b]">
                                        {salon.category}
                                    </p>
                                    <p className="mt-3 text-xs text-[#8a928b]">
                                        ⌖ {salon.location}
                                    </p>
                                    <div className="mt-5 flex items-center justify-between border-t border-[#eeeae2] pt-4">
                                        <div>
                                            <p className="text-xs text-[#8a928b]">Starting from</p>
                                            <p className="font-semibold">{salon.price}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedSalon(salon)}
                                            className="rounded-full bg-[#29453a] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#1e342a]"
                                        >
                                            Book Now →
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {/* Promotion */}
                <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
                    <div className="flex flex-col overflow-hidden rounded-3xl bg-[#dce6d9] md:flex-row">
                        <div className="flex flex-1 flex-col justify-center p-8 sm:p-12">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#748a79]">
                                Special offer
                            </p>
                            <h2 className="mt-3 text-3xl font-semibold leading-tight">
                                Summer Radiance
                                <br />
                                Package
                            </h2>
                            <p className="mt-4 max-w-sm text-sm leading-6 text-[#697b6c]">
                                Treat yourself to a relaxing experience with our exclusive
                                salon packages.
                            </p>
                            <button
                                onClick={() => document.getElementById("salons")?.scrollIntoView({ behavior: "smooth" })}
                                className="mt-6 w-fit rounded-full bg-[#29453a] px-5 py-3 text-sm font-medium text-white hover:bg-[#1e342a]"
                            >
                                Explore Offers →
                            </button>
                        </div>
                        <img
                            src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1000&q=80"
                            alt="Beauty and skincare products"
                            className="h-64 w-full object-cover md:h-auto md:w-1/2"
                        />
                    </div>
                </section>

                {/* How it works */}
                <section id="how-it-works" className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
                    <div className="mb-8 text-center">
                        <p className="text-xs uppercase tracking-widest text-[#8a948b]">
                            Simple & convenient
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
                            How BookMySalon Works
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            ["01", "Search & Discover", "Find salons and services near your location."],
                            ["02", "Book a Service", "Choose your preferred service, stylist, and slot."],
                            ["03", "Enjoy Your Visit", "Arrive at your salon and enjoy your experience."],
                        ].map(([number, title, description]) => (
                            <div
                                key={number}
                                className="rounded-2xl border border-[#e5e1d8] bg-white p-7"
                            >
                                <span className="text-sm font-semibold text-[#91a596]">
                                    {number}
                                </span>
                                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                                <p className="mt-2 text-sm leading-6 text-[#8a928c]">
                                    {description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Owner CTA */}
                <section className="mx-5 mb-20 rounded-3xl bg-[#26382f] px-6 py-14 text-center text-white sm:px-10 lg:mx-auto lg:max-w-7xl">
                    <p className="text-xs uppercase tracking-widest text-[#aabaae]">
                        Grow your business
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                        Elevate Your Salon Business
                    </h2>
                    <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#bdc9bf]">
                        Join BookMySalon, reach more customers, and manage your salon
                        bookings in one place.
                    </p>
                    <button
                        onClick={() => setShowLogin(true)}
                        className="mt-7 rounded-full bg-[#e2e9df] px-6 py-3 text-sm font-semibold text-[#29453a] hover:bg-white"
                    >
                        Register Your Salon →
                    </button>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-[#e5e1d8] px-5 py-10 lg:px-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:justify-between">
                    <div>
                        <a href="#" className="text-lg font-bold">
                            ✂ BookMySalon
                        </a>
                        <p className="mt-3 max-w-xs text-sm text-[#8a928c]">
                            Your trusted platform for discovering and booking salon
                            experiences.
                        </p>
                    </div>
                    <div className="flex gap-12 text-sm text-[#748078]">
                        <div className="space-y-3">
                            <h4 className="font-semibold text-[#26382f]">Quick Links</h4>
                            <a href="#services" className="block hover:text-[#29453a]">Services</a>
                            <a href="#salons" className="block hover:text-[#29453a]">Salons</a>
                            <a href="#how-it-works" className="block hover:text-[#29453a]">How It Works</a>
                        </div>
                        <div className="space-y-3">
                            <h4 className="font-semibold text-[#26382f]">Support</h4>
                            <a href="#" className="block hover:text-[#29453a]">Contact Us</a>
                            <a href="#" className="block hover:text-[#29453a]">Privacy</a>
                            <a href="#" className="block hover:text-[#29453a]">Terms</a>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-8 max-w-7xl border-t border-[#e5e1d8] pt-5 text-xs text-[#9aa19b]">
                    © 2026 BookMySalon. All rights reserved.
                </div>
            </footer>

            {/* Temporary modal for login/signup */}
            {(showLogin || selectedSalon) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
                    <div className="w-full max-w-md rounded-3xl bg-[#f6f3ed] p-7 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">
                                {selectedSalon ? "Book Your Appointment" : "Welcome to BookMySalon"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowLogin(false);
                                    setSelectedSalon(null);
                                }}
                                className="text-xl text-[#68736c]"
                                aria-label="Close dialog"
                            >
                                ×
                            </button>
                        </div>

                        {selectedSalon ? (
                            <>
                                <p className="mt-3 text-sm text-[#7c877e]">
                                    You selected <strong>{selectedSalon.name}</strong>.
                                    Appointment scheduling will connect to your booking API.
                                </p>
                                <button
                                    onClick={() => {
                                        setSelectedSalon(null);
                                        setShowLogin(true);
                                    }}
                                    className="mt-6 w-full rounded-full bg-[#29453a] py-3 text-sm font-medium text-white"
                                >
                                    Continue to Login
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="mt-3 text-sm text-[#7c877e]">
                                    Sign in to book appointments and manage your salon profile.
                                </p>
                                <button
                                    onClick={() => setShowLogin(false)}
                                    className="mt-6 w-full rounded-full bg-[#29453a] py-3 text-sm font-medium text-white"
                                >
                                    Continue
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Landingpage;